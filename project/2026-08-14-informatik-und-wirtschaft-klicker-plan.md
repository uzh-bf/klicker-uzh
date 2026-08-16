# Informatik und Wirtschaft native Klicker chatbot

## Goal

Add one native Klicker chatbot configuration path for the Informatik-und-Wirtschaft video corpus by reusing the existing doc-query MCP integration and making the required MCP binding explicit, strict, and fail-closed before any thread, model, credit, or message side effect. Deliver it as a two-layer stack: generic runtime code first, optional course provisioner second.

## Non-goals and authority

- No deployment-route, LiteLLM, pipeline, corpus, secret, merge, or cleanup work in this package. Production database preparation is authorized for this follow-up; cluster deployment, route changes, MCP activation, and release promotion remain separate gates.
- Package B remains a separate operational step for any future automated provisioning or deployment apply. It supplies reviewed course/chatbot IDs, model/route/auth policy, disclaimer, credit policy, and credential ownership.
- These stack branches may edit and commit local repository code and project artifacts only. The current task separately authorizes the external Git push and draft PR creation described below; no other external state change is authorized.

## Plan identity

- Plan path: `project/2026-08-14-informatik-und-wirtschaft-klicker-plan.md`
- Repository: `klicker-uzh`
- Worktree: `informatik-und-wirtschaft-klicker`
- Stack branches: `rs/informatik-und-wirtschaft-chat-runtime` (bottom), `rs/informatik-und-wirtschaft-chatbot-provisioner` (optional top)
- Target: `v3`
- Base: `origin/v3` at `d76c13a3f28dcdbddac46ed8cc3fcb70fad42924`
- Replacement stack: bottom PR #5405 — https://github.com/uzh-bf/klicker-uzh/pull/5405; optional top PR #5406 — https://github.com/uzh-bf/klicker-uzh/pull/5406; GitHub stack #5407. Source safety PR #5404 — https://github.com/uzh-bf/klicker-uzh/pull/5404
- History: [previous cross-repository plan](../../../ai/klicker-uzh-video-ai/project/2026-08-14-informatik-und-wirtschaft-klicker-chatbot-migration-plan.md) and its handoff remain background evidence, not the current execution contract.

## Stack topology

- Bottom: `rs/informatik-und-wirtschaft-chat-runtime` targets `v3` and contains the generic required-MCP policy, route preflight, MCP aggregation/aliasing, focused tests, generic wiki changes, and this plan.
- Top: `rs/informatik-und-wirtschaft-chatbot-provisioner` targets the bottom branch and contains the optional course-specific provisioner, its data/migration documentation, change log, and course-specific wiki paragraph.
- The bottom layer is independently mergeable and useful without provisioning this course. The top layer is intentionally optional and may be abandoned without removing the generic runtime behavior.
- The original `rs/informatik-und-wirtschaft-klicker` branch and PR #5404 remain untouched as the recovery reference until both replacement layers validate.

## Research

- Problem: The old handoff plan treated a one-course chatbot as a multi-layer migration and relied on deployment-side assumptions that are not part of this repository.
- Evidence: The current chat route already loads enabled MCP configs, aggregates tools, builds prompt-cache identity from the final tool map, and recognizes generic `doc_query` source names. The current route filters inactive servers before the aggregator and creates a thread before MCP aggregation; both orderings weaken a required binding.
- Evidence: The existing `ChatbotMCPConfig.parameters` JSON field can carry a narrow runtime policy without a schema migration. The static route/tool probe found the deployment route exposes the video-expert tool rather than a bare `doc_query` tool, so Klicker needs a model-facing alias at the existing MCP seam.
- Prototype: A synthetic probe confirmed that one enabled route can carry a strict alias through the existing parameters field and that the existing source-card predicate recognizes the aliased `doc_query` name. No live MCP or credential was used.
- Planning review: `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-simplified-planning.md` (`DONE_WITH_CONCERNS`) reviewed this simplified plan. Accepted corrections are recorded below.

## Decisions

- Deliver this as a two-layer GitHub stack: generic runtime first, optional course provisioner second. Keep both replacement PRs as drafts; do not merge or close the source PR during conversion.
- Reuse `ChatbotMCPConfig.parameters` with exactly two reserved keys: `required` and `toolAlias`.
  - Existing configs without reserved keys keep current optional/fail-open behavior.
  - A strict config is `{ "required": true, "toolAlias": "<OpenAI-compatible tool name>" }`.
  - Partial, mistyped, optional-alias, wildcard, missing-alias, or disallowed-alias configurations fail closed during config validation.
  - Other parameter keys remain untouched for compatibility.
- Pass enabled MCP configs to the aggregator even when their server is inactive. Optional inactive servers are skipped; required inactive or unavailable servers produce a typed error.
- Return `503 { "code": "REQUIRED_MCP_UNAVAILABLE" }` before thread creation, model/cache work, image-model work, credit usage, or message writes. Preserve existing generic handling for optional failures.
- Alias only the single allowed raw tool for the strict config. Reject a missing raw tool, a raw-tool/alias collision, or an aggregate name collision instead of silently renaming it.
- Parse custom auth strictly: malformed custom headers are an MCP availability failure for required configs and remain an optional fail-open failure for optional configs; neither path logs secret values.
- Provisioning uses the repository's `DRY_RUN=false` safe-mutation protocol. The apply path validates the reviewed payload and before-state lock, then performs create-or-verify in one serializable transaction: absent exact state creates, exact desired state is a no-op, and partial/competing/drifted state performs zero writes.

## Primitive impact

| Primitive | Disposition | Contract delta |
| --- | --- | --- |
| Course chatbot | Reuse | Existing chatbot ownership, access, disclaimer, credits, model, and route contracts remain in force. |
| MCP server/config binding | Extend | Existing configs remain optional; a reserved JSON policy can make one exact tool binding required and give it a model-facing alias. |
| Chat sources and citations | Reuse | Existing generic `doc_query` recognition remains the source/citation contract; no source schema or renderer change is planned. |
| Course provisioner | Create | A one-shot, idempotent repository script creates only the approved course/chatbot/MCP binding shape after strict validation. |

No new user-facing lifecycle or authorization state is introduced. If the existing source/citation contract cannot recognize the alias without production-code changes, stop this package rather than widening it.

## Data protection by design and by default

- The provisioner reads only allowlisted course/owner UUIDs and fixed configuration values from an ignored local input; it rejects names, emails, credentials, unknown fields, malformed UUIDs, and owner/course mismatches.
- Existing course and chatbot ownership/access checks remain the authority. No new personal-data category, purpose, recipient, or retention period is introduced.
- Dry-run and apply receipts contain counts, operation names, and hashes/status only; never secret values, auth headers, raw personal data, or connection strings.
- Defaults are minimum-scope: no committed operational input, no secret logging, no broad discovery, no new public access, and no writes on validation drift or partial state. The operational input remains ignored; staging and production database preparation are values-free, separately authorized operations and do not change deployment or runtime activation.

## Delegation map

| Slice | Owner/route | Dependency | Acceptance boundary |
| --- | --- | --- | --- |
| S0 plan | Main | Current base and reviewed simplified plan | Plan is present, reviewed, and committed first. |
| S1 strict MCP runtime | Main | S0 | Focused chat tests and chat typecheck; no thread or credit side effect on required-MCP failure. Main retains this security/cross-system seam. |
| S2 course provisioner | Native `executor` | S1 runtime contract | Focused Prisma Data tests/check plus disposable local dry-run/apply/idempotence evidence; no STG or production access. |
| S3 integrated verification | Main | S1 and S2 accepted/reviewed | Full relevant checks, local/browser evidence when the environment is available, final review, and an updated Progress section. |

## Feature-wide test portfolio

| Risk/behavior | Obligation | Primary seam | Distinct failure caught | Owner |
| --- | --- | --- | --- | --- |
| Existing optional MCP configs remain compatible | Extend existing | MCP aggregation unit tests | Existing configs unexpectedly become strict or unavailable | S1 |
| Required alias contract is exact | Add new | MCP policy/aggregation tests | Missing tool, malformed policy, inactive server, auth failure, or alias collision is silently accepted | S1 |
| Required failure has no pre-generation side effects | Add new | Narrow route-handler or preflight integration seam | Thread/message/credit work occurs before a required MCP `503` | S1 |
| Alias remains source/citation-compatible | Extend existing | Source/citation and prompt-cache identity tests | Retrieval works but source cards/citations or cache identity lose the aliased tool | S1 |
| Provisioner is safe and idempotent | Add new | Script validation and disposable local database run | Partial/competing state writes, secret-bearing receipts, or second-run duplicate creation | S2 |

## Approved slices

### S0 — Persist the execution contract

- Route: main session.
- Do: create this plan, including the accepted simplified-planner corrections, and commit it separately before implementation.
- Check: inspect the exact staged diff for secrets/PII; verify branch, base, target, and authority boundary.
- Commit: `docs(project): add Informatik und Wirtschaft chatbot plan`.

### S1 — Make required MCP aliasing strict at the chat seam

- Route: main session; execution-tier skip reason: security-sensitive runtime policy and ordering are coupled to the route's side-effect boundary.
- Do: add the small runtime-policy parser/error type; preserve optional configs; pass inactive-server state to the aggregator; apply one strict alias; propagate required availability failures; move aggregation before thread creation; add focused tests and the affected chat-platform wiki note.
- Check: `pnpm --filter @klicker-uzh/chat test:run -- test/mcp-clients.test.ts test/required-mcp-route.test.ts test/prompt-cache-identity.test.ts test/citation-instructions.test.ts`; `pnpm --filter @klicker-uzh/chat check`.
- Commit: `enhance(chat): require configured MCP tools before chat generation`.
- Review: after the immutable commit, run exactly one simplifier and one slice reviewer in parallel. Lenses: correctness, security, architecture, compatibility, and cross-system failure boundary.
- Stop condition: do not change source/citation production code, Prisma schema, GraphQL contracts, or external deployment routing in this slice.

### S2 — Add the guarded course provisioner

- Route: native `executor`, clean context, exact owned paths only.
- Do: add `packages/prisma-data/src/scripts/2026-08-14_provision_informatik_und_wirtschaft_chatbot.ts`, an ignored local input/lock fixture under `packages/prisma-data/src/data/_local/`, and only the minimal existing-script test command wiring if needed. Validate fixed IDs, owner/course relation, one intended chatbot, exactly two enabled tutor/explainer MCP configs, the raw tool, and the alias before any write.
- Check: focused Prisma Data test/check; disposable local DB dry-run; `DRY_RUN=false` apply once plus readback; second apply is an exact no-op; no STG.
- Commit: `feat(prisma-data): provision Informatik und Wirtschaft chatbot`.
- Review: after the immutable commit, run exactly one simplifier and one slice reviewer in parallel. Lenses: data integrity, idempotence, secret/PII hygiene, and maintainability.

### S3 — Integrate and verify locally

- Route: main session.
- Do: integrate accepted review findings, update Progress, run the relevant chat and Prisma Data suites, `pnpm run check:all`, and `pnpm run build`; use `npx agent-browser@0.32.2` against the local devrouter URL only if a local runtime is already available. Verify the required-MCP failure path leaves no thread/message/credit writes. Do not apply STG, activate, or deploy during local verification; the current task separately authorizes a branch push and draft PR after this check.
- Check: fresh command output and exact diff against `origin/v3`; final review covers correctness/plan compliance, maintainability, security, architecture, and applicable data-integrity seams.
- Commit: any accepted review/Progress adjustment as a conventional follow-up commit. The current task permits a branch push and draft PR after this check; merge and deployment remain withheld.

## Progress

- Status: the generic runtime is merged as #5405. The optional provisioner remains in draft #5406 as a review artifact and will not be merged. The base promotion at `d76c13a3f` changes deployment values only; it does not contain an alternative implementation of this feature.
- Completed: handoff takeover; current-base reconciliation; synthetic alias/source probe; simplified planning review; product-primitive and DPbDD pass; branch/worktree reuse; S0 plan commit; strict MCP runtime implementation; S1 simplifier and slice review; all accepted S1 review corrections; guarded S2 provisioner, its simplifier/slice-review corrections, and wiki update; base rebase; final-review corrections for mode enforcement, URL credential rejection, credential replay verification, receipt recovery, strict allowedTools shape, long-name source recognition, and duplicate test coverage; two-layer stack split; draft PR publication.
- Runtime validation: bottom commit `219175ff8` passed the repository pre-commit checks (24/24 Turbo tasks, formatting, lint, syncpack, AGENTS checks, Prisma checks, and gitleaks). The chat command passed 37 test files and 306 tests. Provisioner validation passed `--validate-only`, Prisma Data `check:data`, and Prisma Data `check:scripts`.
- Planning review: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-simplified-planning.md`.
- Simplifier: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-s1-simplifier.md`; accepted redundant-default and in-process classifier reductions.
- Slice review: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-s1-slice-review.md`; accepted unsafe-header, collision-order, and wildcard-validation corrections.
- S1 correction review: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-s1-correction-review.md`; no findings at 100% confidence.
- S2 implementation evidence: synthetic `--validate-only` input validation passed; unknown top-level, secret-bearing, and query-bearing URL fields were rejected; `check:data` and `check:scripts` passed. The linked devrouter runtime was then started with the repository's self-contained container, its blank disposable database was initialized with the non-reset `prisma:push:raw`, and the synthetic local seed completed. A temporary synthetic fixture (restored to the template afterward) produced a five-row dry run, a five-row serializable apply, an exact second-apply no-op, and readback of the chatbot, disclaimer, inactive MCP server, and two strict tutor/explainer bindings. The receipt was removed after verification; no operational or repository data was retained.
- S2 simplifier: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-s2-simplifier.md`; accepted two behavior-preserving reductions.
- S2 slice review: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-s2-slice-review.md`; accepted exact second-apply no-op correction.
- S2 correction review: done — `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-s2-correction-review.md`; static contract passed, and the disposable database proof now covers dry run, serializable apply, and exact second-run no-op. Drift refusal and post-commit receipt recovery remain unexercised.
- Final review: initial findings were recorded in `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-combined-final.md`; the correction review closed all seven code findings in `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-combined-final-correction.md`. The wiki caveat identified by that review is corrected in the working tree.
- AGY review: Gemini 3.7 Flash at high effort reviewed the combined implementation and returned `APPROVE` with no must-fix findings. The chatbot-wide versus per-mode required-MCP policy remains an explicit maintainer decision; the optional provisioner’s hand-written validation remains isolated to #5406.
- Sol review: GPT-5.6 Sol reviewed the provisioner against the current remote base and returned `DONE_WITH_CONCERNS`; the values-free record is in `project/_local/reviews/2026-08-14-informatik-und-wirtschaft-provisioner-sol-review.md`. No committed credential or PII leak, transaction, idempotence, owner/course, or receipt defect was found. The review identified three hardening items: reject initial credits above the maximum, require an explicit template marker, and document target-bound `DATABASE_URL`/`APP_SECRET` prerequisites. The first two are now implemented in the working tree; the runbook contains the target-environment commands and key-provenance warning.
- Browser E2E: the linked feature worktree was proved with devrouter, and the missing Chromium headless-shell, ffmpeg artifact, and container libraries were installed in the disposable runtime. The full `Y-chat.spec.ts` Chromium run started against the real local apps: tests 1 and 2 passed, then the unknown-chatbot recovery test failed at `playwright/tests/Y-chat.spec.ts:98` because it expects `data-testid="chat-not-found"`. The unchanged base implementation uses `data-cy="chat-not-found"`; the response was HTTP 404, but the browser DOM contained no matching recovery marker. The changed-file diff confirms that the recovery page and E2E spec are outside this branch, so this baseline/runtime failure is not attributed to the feature. No application-level full-suite pass is claimed.
- Operational preparation: the ignored local payload contains the course-specific tutor/explainer prompts, a disclaimer adapted from the existing chatbot seed, the documented direct STG Doc Query endpoint, and the approved provisional test-seed credit/model defaults. A read-only staging query found five `Testkurs` rows; the newest non-archived row was selected as the proposed account target. The values-free dry run planned five rows, the authorized staging apply created and verified five rows, and the exact replay returned zero writes. Readback confirms the chatbot/disclaimer ownership, active MCP server, and two enabled strict tutor/explainer bindings.
- Staging activation: an exact preflight verified the reviewed no-auth MCP row and both strict bindings; one serializable update changed only `isActive` from `false` to `true`, with immediate readback confirming activation. This operation did not change deployment state.
- Package B STG provisioning: the existing exact target was read back values-free (course/owner/disclaimer/chatbot/server/config identities and policies matched). The server was temporarily deactivated to satisfy the provisioner’s inactive apply precondition, the default dry-run planned `0` rows, the authorized STG apply created `0` rows and verified the exact no-op, and a separate readback confirmed the server was active again with exactly two enabled strict tutor/explainer bindings. The current values-free receipt is ignored local state; a stale pre-existing receipt was moved to `/private/tmp/informatik-und-wirtschaft-chatbot.lock.stale-20260815T213300.json` before the fresh dry-run.
- Link verification: the course join path returned HTTP 200. The chatbot PWA path returned the expected unauthenticated login redirect, and the direct chat path returned the expected no-login redirect. The later authenticated browser smoke is recorded separately below.
- Authenticated STG smoke preparation: the course has no linked synthetic participant, no `testuser*` participant, and no participant named `klick`; the initial browser attempt therefore stopped at the login boundary without creating an account or staging data. The user later supplied an authorized browser login, allowing the focused retrieval probe below. No account or PII was created.
- Authenticated STG retrieval: after the user authenticated in the in-app browser, the Explainer mode accepted one non-sensitive German smoke question. The chat displayed the Doc Query tool card, and the MCP response reported 20 sources and 20 chunks. The answer completed without a transport error, but it used ad-hoc parenthesized titles/timestamps and no schema-compatible `[n]` markers; this is not a citation-contract pass.
- Prompt correction: the local payload now follows the established Vorkurs/Benibot tutor/explainer shape, adds the explicit `[n]` source-marker contract, and forbids standalone References lists, markdown URLs, raw URNs, and invented titles/timestamps. The same tutor/explainer prompt JSON was applied and values-free verified in the existing STG and prepared PRD chatbot records; production remains inactive.
- Prompt smoke after correction: fresh STG Explainer and Tutor chats both produced concise answers with `[1]`/`[5]` markers; Tutor also asked exactly one open-ended follow-up question. The rendered page still showed the old raw tool name, no source-card buttons or citation links, and the markers remained literal text. The prompt correction is therefore evidenced, but citation rendering remains blocked by the runtime/metadata mismatch.
- Bounded authenticated STG smoke after #5411: Explainer transcript-only, visual-only, and mixed-evidence questions completed; Tutor completed and asked exactly one open question; an unrelated benzene-formula question abstained because the course videos had no evidence. The disclaimer was visible, history persisted (`18/18` current history item), and each assistant card showed a mode/cost. The refreshed UI still exposes the raw `Informatik_und_Wirtschaft_Video_Doc_Query_doc_query` tool payload and literal `[n]` markers rather than source cards/citation links. The answers contain a visible folio title and timestamps, but continue to claim that no separate official video title is available. This is a retrieval/content pass, not a source-rendering or metadata-contract pass. Anonymous denial is confirmed by the unauthenticated `307` redirect; no authorized non-participant account was available, so that distinct denial check was not run.
- Owning-layer diagnosis (superseded): the video-AI handoff contract already defines `reference.video_name`, `reference.start_sec`, `reference.end_sec`, and representative-frame metadata. The initial failure was caused by the chatbot targeting a legacy pre-v0.8 route; that route was not upgraded as a shortcut.
- Retrieval/runtime diagnosis: STG readback confirms both enabled mode configs carry `required: true`, `toolAlias: "doc_query"`, and the raw expert allowlist. Before reconciliation, the browser exposed the old raw safe tool name `Informatik_und_Wirtschaft_Video_Doc_Query_informatik_un_642d457b` rather than the alias-compatible `..._doc_query` name produced by the checked-in runtime; the live chat Deployment was on rollout `f85b9c1d8663`, so the merged #5405 runtime was not deployed. The observed document payload also carried hash URNs and unstructured chunk content but no structured title field; deeper pipeline/metadata investigation is handed to thread `019fead0-f233-7e92-8f8f-96fc24662c3e`.
- STG runtime release: promotion PR #5408 merged, but its promotion workflow had failed while the PR was `OPEN/BLOCKED`; the Argo application `app-klicker` is manual and remained `OutOfSync`. The declared application was reconciled through Argo (no direct Deployment patch) to remote `v3` revision `2bcaddabe3bf3b39e23e71e7cf3eda7179f6291f`. The chat Deployment then reported rollout `19f3afbf540b`, revision `75`, one ready replica, and pod image digest `sha256:e38eb8679c08d95db06e635b68524985cc566e9a0155a5a201230f3534955973`; this historical rollout was later replaced by the #5411 promotion below.
- Package B continuation gate: PR #5411 (`enhance(chat): render structured video citations`) merged as `9222929ad8a54ab85bf6cecf1955c285d3f0dea0`; promotion #5412 advanced `v3` to `9a82e7fa63ba6b0f6b373470e3d6b77ae265d371`. The declared Argo application was reconciled and now reports `Synced`/`Healthy`; the native STG chat Deployment is on `ghcr.io/uzh-bf/klicker-uzh/chat-arm:v3`, release marker `9222929ad8a5`, revision `76`, with one ready replica and pod digest `sha256:9dd5740ad85e1edd4f012990964d8e6e143ea6852113ec1a721a54891d4abe9c`. The unauthenticated native route returns the expected `307` login redirect. This is native Klicker runtime evidence, independent of the Doc Query service probe.
- STG Doc Query release: mcp-doc-query MR !45 was released as v0.8.1 and pinned in deployment MR !601 at digest `sha256:6efb013df1c7fc42e40e48fb274efdf421c096bd1f2a8294aa7e943888fed953`. Argo application `app-doc-query-stg` is `Synced`/`Healthy`; the shared tenant route is `/mcp/klicker` with bearer authentication. A values-free source inspection of the live result found top-level `title`/`video_name` and chunk `start_sec`/`end_sec` metadata, so the expected video metadata is present in the MCP payload.
- STG credential/cutover: the existing target server was rekeyed using the running chat application's key while inactive, then activated and read back. The live authenticated Tutor and Explainer requests now complete through the shared route and return document results; this is the correct runtime proof, because the Infisical profile's `APP_SECRET` does not decrypt the chat row and must not be used as evidence for the live application key.
- Citation rendering diagnosis and fix: the live MCP envelope had valid document JSON in `content[0].text`, but FastMCP also supplied `structuredContent: { result: '<json>' }`. The merged #5411 native runtime prioritized that wrapper and passed `{ result: string }` to the source normalizer, so the tool chip said “no results”, source cards were absent, and `[n]` markers remained plain text. Generic follow-up PR #5414 (`rs/chat-unwrap-structured-content`) unwraps `structuredContent.result`, retains direct structured payload compatibility, adds a regression test, and documents the envelope shape. It merged as `2ad68d057acfe972b505d930e52e721a41f2fd94`; all required checks passed, including eight Playwright shards.
- Production preparation: a values-free preflight and serializable transaction created a new German course, disclaimer, chatbot, inactive production Doc Query server, and strict tutor/explainer bindings under the `klick` account. The course permissions were recomputed and production readback verified ownership, linkage, dates, model/credit policy, and inactive-server state. No cluster, deployment, route, or release state was changed.
- Generic-script disposition: do not merge #5406. Its reusable core is a small schema-driven bundle primitive with strict input validation, owner/course checks, dry-run and values-free receipts, serializable create-or-verify, drift/partial-state refusal, and activation kept separate. Keep the course-specific prompts, disclaimer, model defaults, route/tool names, and target discovery out of that generic layer; the current one-off production transaction is sufficient for this chatbot.
- STG runtime release and browser verification: promotion PR #5415 advanced the declared `v3` values to `2d9c5d04835430301fe49da31260fe657387eb13`; because native `app-klicker` has a manual sync policy, it initially remained `OutOfSync` on the old rollout marker `9222929ad8a5`. An authorized Argo sync reconciled the native application to `Synced`/`Healthy`; the chat Deployment now reports release marker `2ad68d057acf`, `ghcr.io/uzh-bf/klicker-uzh/chat-arm:v3`, and one ready pod. After reload, a fresh authenticated Explainer request produced the exact title `11.06 Künstliche Intelligenz - Turing-Test.mp4`, the range `02:10–03:28` / `130–208 Sekunden`, citation nodes with source-target hashes, and 12 rendered source cards with video titles and timestamps. The inline citation target resolved to an existing `chat-source-card`; no raw `[1]` text or “no results” chip remained in the rendered answer.
- Sol hardening delivery: the credit-cap rejection, the required explicit template marker, and the target-bound runbook prerequisites are committed on #5406, and the PR is marked ready for review with CI monitored. #5406 remains an intentionally unmerged review artifact.
- Baseline E2E repair delegation: the pre-existing `data-testid` versus `data-cy` mismatch in the chat recovery spec is delegated to a separate Codex task on branch `rs/fix-chat-recovery-e2e-selector` (worktree `trees/fix-chat-recovery-e2e-selector`), finish boundary verified local commits.
- Production go-live plan: added `project/2026-08-16-informatik-und-wirtschaft-production-go-live-plan.md`. It records that STG already uses the shared multi-tenant `/mcp/klicker` route, that no interim legacy PRD route should be built, and that PRD activation is gated on the parallel multi-tenant W5e direct-Chat proof. The I&W PRD source pair and collection-readiness evidence are owed to the W5a gate owned by thread `019febd4`, aligned with the RadioSurfVet thread `019fead3`.
- Remaining gate: production activation still requires the multi-tenant PRD service gates (W5a evidence through W5e direct-Chat proof), a production chat runtime containing #5405/#5411/#5414, a read-only preflight, and explicit MCP activation, each separately authorized. STG provisioning, the v0.8.1 route cutover, the #5411 runtime deployment, and the #5414 structured-content fix are complete. Bounded quality testing still needs an authorized non-participant identity for its distinct denial check.
- Active children: none.
- Delivery layer: generic runtime #5405, structured citation runtime #5411, and parser follow-up #5414 are merged and deployed in STG; optional provisioner #5406 remains an intentionally unmerged draft, and the original source PR #5404 remains untouched. Achieved layer: local code, documentation, disposable-database proof, bounded browser execution, draft-PR publication, staging provisioning/activation, unauthenticated link verification, production database preparation, and native STG runtime reconciliation with source-card/citation proof. Production deployment, runtime release, and MCP activation remain explicitly withheld.
- Next action: execute the production go-live plan phase by phase (P0 I&W PRD source pair and collection evidence first), complete bounded quality testing when an authorized non-participant identity is available, and keep every production action behind its own authorization. Do not merge #5406, run a broad video sweep, or touch STG reingestion or legacy consumers. No operational credential is retained locally.

## Next steps

- Keep the existing cross-repository handoff read-only; STG promotion currently requires explicit Argo reconciliation because `app-klicker` has a manual sync policy, and the current Package B sync is complete.
- Treat #5405/#5411/#5414 as the merged runtime reference and leave optional draft #5406 unmerged; the baseline chat recovery E2E repair runs as a delegated separate task on `rs/fix-chat-recovery-e2e-selector`.
- Follow the production go-live plan for PRD: contribute P0 source-pair and collection evidence to the multi-tenant W5a gate, then ride W5e before activation; complete the remaining bounded quality checks when an authorized non-participant identity is available.
- If more chatbots need this workflow, extract only the generic bundle primitive described above; do not promote the I&W payload into a general seed script.
