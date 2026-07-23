# RESEARCH: codeapi Integration Foundation (Shared)

Shared research base for [PLAN-code-element-type.md](PLAN-code-element-type.md), [PLAN-chat-code-execution-tool.md](PLAN-chat-code-execution-tool.md), and [PLAN-codeapi-further-features.md](PLAN-codeapi-further-features.md). Facts verified against the codeapi source workspace (`uzh-bf/code-interpreter` fork, upstream submodule pinned `607e019f`) and this repo (`v3`, 2026-07-06). Line refs into codeapi are `upstream/service/src/...` in that workspace.

These `plans_future` documents are reviewed architecture inputs, not an active execution plan. When implementation starts, create one dated active plan on the implementation branch, link these documents and the relevant ADRs, keep its `Progress` current, and ship that plan with the implementation PR.

## What codeapi is

- Self-hosted sandboxed code-execution service (fork of ClickHouse/code-interpreter, powers LibreChat Code Interpreter). Deployed on the DF AKS clusters (stg+prd), KVM/microVM sandbox pool, scale-to-zero via KEDA.
- Proven in production: DF LibreChat `execute_code` round-trips through it (JWT auth, pandas/matplotlib, artifact round-trip).

## Capability envelope (hard limits — design around these)

- Runtimes: python, javascript/bun, typescript/bun-ts, node, bash — 5 total (`config.ts:15-45` alias table; E2E-verified).
- ~50 pip packages baked into the sandbox image. **No runtime installs** — egress from the sandbox is blocked (security gate). Need a lib → rebuild sandbox image.
- **No network egress** inside sandbox: code cannot fetch URLs/APIs. Compute-over-provided-data only.
- Non-root (uid 65534), ephemeral, `SANDBOX_RUN_TIMEOUT=300000ms`, `SANDBOX_MAX_PROCESS_COUNT=100`.
- `JOB_TIMEOUT` default 300000ms — API waits up to 5 min for a job (`config.ts:47,95`). Cold start on scale-to-zero pool can consume a large chunk of this on the first run after idle.
- Working dir `/mnt/data`; files written there return as output refs.

## Auth: Bearer JWT only (x-api-key is dead)

- All `/v1/*` behind `apiKeyAuth` middleware (`middleware/auth.ts:67`, mounted `service-api.ts:29`). Any `X-API-Key` header → 401 reject (`auth.ts:79,110-113`). Only `Authorization: Bearer <JWT>` works.
- Verifier config env (all `auth/librechat-jwt.ts`): `CODEAPI_JWT_ISSUER` (default `librechat`, :265), `CODEAPI_JWT_AUDIENCE` (default `codeapi`, :266), `CODEAPI_JWT_ALLOWED_ALGS` (default `EdDSA,RS256`, :105-121), `CODEAPI_JWT_MAX_TTL_SECONDS` (hard cap 300s, :72-73), keys via `CODEAPI_JWT_JWKS_JSON` (inline JWKS keyed by kid, :151-174) or PEM dir/single key.
- Required claims (`validateClaims` :387-437): `iss`, `sub` (→ userId), `jti` (≤256 chars), `iat`, `nbf`, `exp` (lifetime ≤300s), `aud`, `principal_source`, `auth_context_hash`. Optional: `tenant_id`, `role`, `org_id`, `service_id`, `plan_id`.
- **Second-client gap**: `principal_source` allow-list is hardcoded to `'librechat_jwt' | 'openid_reuse'` (:75-78, 379-385). Klicker options: (a) set `principal_source: 'openid_reuse'` (works today, semantically loose), or (b) small upstream-neutral patch in our fork making the allow-list env-configurable (`CODEAPI_JWT_ALLOWED_PRINCIPAL_SOURCES`) — preferred, PR-able upstream.
- Multi-tenant: `tenant_id` claim namespaces ALL storage/session keys (`session-key.ts:66-124`, `execution-identity.ts:54-95`). Klicker gets its own `tenant_id` (e.g. `klicker-prd`) + own `kid`/keypair added to the shared `CODEAPI_JWT_JWKS_JSON`. No codeapi code change needed beyond the principal_source item.
- Klicker mints JWTs server-side (jose lib already used in this repo per plans_archive/PLAN-jose-jwt.md): TTL ≤300s, per-request, private key via Infisical/ESO. Never expose to browser.

## Exec API contract

- `POST /v1/exec` body: `{ lang, code, args?, user_id?, files? }` (`types/service.ts:125-131`). Identity comes from JWT `sub`, NOT body `user_id` (logging only, `service/router.ts:114-118,177`).
- **Response is FLAT** (live-verified; the `run`-wrapped shape in `openapi.yml`/`ExecuteResponse` is stale): `{ session_id, stdout, stderr, files: FileRef[], code, signal, message, status, wall_time }`. Code against flat; re-verify on upstream bumps.
- Files IN: 2-step. (1) `POST /v1/upload` (multipart, ≤25MiB/file default `MAX_FILE_SIZE`, `config.ts:48,94`) → returns `storage_session_id` + fileIds; (2) reference on exec via `files: [{id, resource_id, storage_session_id, name, kind, version?}]`. `kind ∈ user|agent|skill`; `skill` requires `version` (`session-key.ts:139-170`).
- Files OUT: exec-generated artifacts always land `kind='user'` scoped to JWT `sub` (`session-key.ts:106-124`); fetch via `GET /v1/download/{session_id}/{fileId}?kind=user` (kind param mandatory).
- No top-level `entity_id` anymore (legacy, removed) — scoping is per-file `kind`+`resource_id`(+`version`) + `tenant_id`.

## Recommended Klicker identity mapping

- `tenant_id` = one Klicker-wide tenant (e.g. `klicker-prd`) — storage isolation from LibreChat. Course-level isolation NOT needed at codeapi layer (Klicker enforces course access itself).
- `sub` = participantId → automatic per-student private sessions/outputs.
- Shared non-secret per-exercise assets (starter files, public fixtures): upload once as `kind='agent'`, `resource_id = element:<elementId>` (or `kind='skill'` + version if versioned reuse wanted), `read_only=true`; every student exec references them. Hidden expected outputs and instructor assertions must not be uploaded into the student's execution boundary.

## Security boundary for grading

- codeapi isolates untrusted code from Klicker infrastructure. It does not make one part of a sandbox execution confidential from another part running under the same sandbox identity.
- The CODE element therefore sends student code and test invocations to codeapi, but keeps expected outputs, weights, hidden-test metadata, and pass/fail decisions in the Klicker worker. See [ADR 0002](../../docs/adr/0002-keep-grading-assertions-outside-the-sandbox.md).
- Public and hidden invocations use separate fresh executions. Hidden files, session identifiers, stdout/stderr, and exception text are discarded after server-side comparison, so hostile code cannot carry hidden inputs into a later public result through the shared sandbox filesystem.
- Sandbox stdout, stderr, exit state, files, and structured result frames are untrusted input. The Klicker worker validates and caps them before comparison, persistence, logging, or display.

## Load + limits (classroom burst is the real risk)

- Per-user rate limit: 20 exec/30s (`EXEC_MAX_REQUESTS`/`EXEC_LIMIT_WINDOW`, `config.ts:97-98`) keyed `<tenant>:user:<sub>` — N students each get their own budget. Fine.
- Real bottleneck: worker concurrency. `PYTHON_CONCURRENCY=1` per worker pod (`config.ts:89`) — 200 students submitting at once = queue. KEDA scales on BullMQ queue depth (deployment overlay, listLength≈5/replica, max ~20 — live values must be verified in df-cloud/helm-charts, not this workspace).
- Design consequences: (1) client HTTP timeout ≥ JOB_TIMEOUT or graceful failure; (2) student-facing UX must be async (pending → graded), never block a request on exec; (3) live-quiz-scale simultaneous CODE grading needs load-testing before enabling; (4) consider pre-warming (scale min replicas up) around scheduled activities.
- 429s carry `Retry-After` headers (`middleware/limits.ts:117-124`) — client should honor.

## Evidence: does code execution help learning tools?

- PAL (ICML 2023, arxiv 2211.10435): offloading arithmetic to a Python interpreter: +15pts absolute GSM8K vs chain-of-thought, ~+40pts on GSM-Hard. LLMs decompose correctly, botch arithmetic; executed code doesn't.
- Khan Academy built Khanmigo a calculator + real-time math-verification agent because predictive math failed in tutoring (blog.khanacademy.org/khanmigo-math-computation-and-tutoring-updates). Their tutoring-accuracy dataset: ~90% of dialogues pedagogically sound, only ~57% entirely correct — calculation slips a named cause.
- Local amplifier: Klicker's model routing deliberately sends most chat traffic to cheap/low-effort tiers — the models that slip most on arithmetic. Compute offload is worth most exactly where we economize.
- Caveat: evidence proves accuracy gains, not learning gains. Chat tool prompt contract = verify-and-guide, not answer-vend (see chat plan).

## Independent review record (2026-07-06, pre-commit)

- Reviewers: 4-lens Claude workflow (file:line claims ×2, cross-doc consistency, adversarial architecture) + Codex CLI cross-model review over the worktree. (agy/Antigravity was first choice but its print mode returned empty output on every model — fell back to Codex per workflow rules.)
- Outcome: chat-plan claims + cross-doc consistency verified clean; async-grading-seam architecture confirmed (sync txn genuinely cannot host the sandbox call). 1 Critical + 7 Important + ~8 Minor findings, ALL integrated: PENDING persistence model + resubmit policy as slice-1 gate, `finalizeQuestionResponse` must cover all txn side effects, microlearning dup-guard visibility, client reload state machine, missing touchpoints (getInitialInstanceResults, wizard allow-lists, templates.ts, ElementContentInput/TypeMonitor/ActivityOverviewTable, shared charts/hooks/validateResponse), corrected citations (respondToElement dispatch chain, worker-side pubSub precedent, rehype-prism-plus dep, rag-tool-ui path), softened execute_code collision claim, tenant_id question resolved to one tenant.
- Addendum 2026-07-12: chat plan retargeted at the Mastra migration ([PR #5126](https://github.com/uzh-bf/klicker-uzh/pull/5126) `apps/chat-api` + `packages/chat-engine`, [PR #5129](https://github.com/uzh-bf/klicker-uzh/pull/5129)). Targeted revision, all new file:line refs verified directly against `codex/mastra-chat-openrouter-smoke`; no second external review round (docs-only, no architecture change — the native-tool decision, cost pattern, and inline-not-Hatchet stance all carry over).
- Addendum 2026-07-23: implementation-readiness review against `v3` @ `c8de9c897` plus an independent Gemini cross-check confirmed five High findings: hidden assertions shared an execution boundary with hostile code; Hatchet retries lacked an idempotent finalization contract; mixed stacks had undefined pending/score semantics; submission persistence had three conflicting shapes; and the chat-tool target remained blocked on [PR #5126](https://github.com/uzh-bf/klicker-uzh/pull/5126). The CODE plan now keeps grading expectations outside codeapi, uses a separate `CodeSubmission` lifecycle with claim/expiry and idempotent completion, blocks active resubmission, and restricts v1 to one CODE element per stack. Proposed decisions are recorded in [ADR 0001](../../docs/adr/0001-separate-code-submission-lifecycle.md) and [ADR 0002](../../docs/adr/0002-keep-grading-assertions-outside-the-sandbox.md).
- Follow-up review of commit `d58b6defb` found that one shared execution could still carry hidden inputs into later public output, and that the persistence fields were underspecified. The integrated correction separates public and hidden executions and adds a concrete `CodeSubmission` schema and GraphQL receipt contract to the CODE plan.

## Open questions (infra, resolve before live-service integration)

1. Live KEDA trigger values for prd codeapi (queue depth threshold, maxReplicas) — check helm-charts repo / cluster, not code defaults.
2. `CODEAPI_TENANT_ISOLATION_STRICT` value in prd — decides whether Klicker tokens MUST carry `tenant_id` (they should anyway).
3. principal_source: patch fork (env-configurable allow-list) vs use `'openid_reuse'` — decide with DF infra.
4. Package set: is the baked ~50-lib toolbelt enough for teaching use (pytest? numpy? matplotlib yes)? Audit against course needs; additions = sandbox image rebuild.
