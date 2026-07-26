# KB Management — Production v1 Roadmap Plan

## Plan Identity

- Date: 2026-07-24; grill rulings recorded 2026-07-25; branch topology corrected and W1 integrated 2026-07-26. Implementing branch: `kb-poc`, carried by [PR #5174](https://github.com/uzh-bf/klicker-uzh/pull/5174) into `v3-ai`. The roadmap was reviewed on `claude/admiring-nightingale-c30fa4`, then moved onto the implementing branch before W1 execution.
- Inputs reviewed: [PR #5182](https://github.com/uzh-bf/klicker-uzh/pull/5182) (junior implementation of the [POC plan](2026-07-15-pr-5174-kb-poc-plan.md), branch `feat/kb-poc-management-ui`, base `kb-poc`, 149 files / +23k), [PR #5078](https://github.com/uzh-bf/klicker-uzh/pull/5078) (older full-scale KB prototype, branch `codex/kb-management-ui`, ruled REPLACE by the 2026-07-23/24 program review), the R5.0 scope-grill handoff and the program's final roadmap + A6 Klicker lens report (external `_local` review artifacts, not in this repo).
- Method: three independent Opus review subagents (5182 core-plan conformance; 5182 beyond-plan scope vs the canonical ingestion-platform contract; 5078 salvage inventory vs 5182), synthesized here. `trees/kb-review-5182` was attached to `feat/kb-poc-management-ui` on 2026-07-26 and is now the W1 implementation worktree.
- Purpose: (1) reviewable record of the [PR #5182](https://github.com/uzh-bf/klicker-uzh/pull/5182) findings, (2) the ruled decision record of the product-scope grill (program gate R5.0), (3) the finalized production v1 work-package roadmap. Rulings recorded and roadmap finalized 2026-07-25.

## Fixed Program Constraints (user-ruled 2026-07-23/24 — do not re-litigate)

- Ingestion is an external producer-neutral service: Klicker calls a synchronous HTTP API (`POST /v1/resources` family), never fire-and-forget dispatch. Status returns via durable HMAC-signed webhooks (retry + dead-letter) PLUS reconciliation polling; webhooks are never the sole source of truth.
- Canonical status event: `OperationStatusEvent` with `X-Ingestion-*` headers, `operation_id` correlation, `resource_version` int, nested `serving: {active_resource_version, active_sha256}`; receiver schemas are `extra="forbid"`-strict — adopt verbatim, field-for-field.
- Resource identity is Klicker-owned: `external_resource_id == KBResource.id`; ingestion never assigns or overwrites Klicker-side ids.
- Per-resource monotonic versions; no whole-KB revision model; two-axis status (operation vs serving: "update failed, still serving v(N)"); candidate content invisible until `resource_active=true`.
- Feature gating via GrowthBook (external dependency, integration in progress); no ad hoc flag infra.
- `kb_id` server-side validation is deferred ONLY until lecturer self-service KB creation exists (D-8) — self-service in v1 triggers that gate.
- Platform-side gates outside this repo: Klicker tenant mount on shared `mcp-doc-query.stg-doc-query` (R4.3, needs blast-radius fixes R1.3/R1.4), producer-enable + 10-scenario synthetic journey (R4.4), `resource_active` retrieval gating (R1.1) and Milvus partition wiring (R1.2) block ANY retrieval canary.

## [PR #5182](https://github.com/uzh-bf/klicker-uzh/pull/5182) Review — Verdict and Findings

**Verdict: needs-fixes (1 blocker) before merging into `kb-poc`.** The core S2-S8 implementation conforms to the POC plan and is hardened beyond its minimum in several places. The problems concentrate where later beyond-plan work landed on the same branch.

### Blocker

| # | File | Problem | Fix |
| --- | --- | --- | --- |
| B1 | `packages/kb-management/src/components/KnowledgeBaseResourceList.tsx:193-207` | The per-resource "Ingest" button (POC Goal #4, slices S5/S7) was removed by later KG commit `61987498c`. The full `ingestKbResource` path (service `packages/graphql/src/services/knowledge.ts:484-571`, resolver, Hatchet task, ~1200 LOC + ~1900 LOC tests) is live and reachable via direct GraphQL but has zero UI callers — a zombie surface with doubled maintenance and attack surface. Plan `Progress` (S5/S7) and the committed screenshots are stale — they show a UI that no longer exists at HEAD. | Ruled by grill Q1: either restore a per-resource ingest entry point, or bless graph-level-only ingestion and delete the resource-level path. Update Progress + screenshots to match HEAD either way. |

### Major

| # | File | Problem | Fix |
| --- | --- | --- | --- |
| M1 | `packages/hatchet/src/kbIngestion.ts:442-519`, `kbGraphIngestion.ts:128-254` | Singleton monitor cron (`* * * * *`, `maxRuns:1/CANCEL_NEWEST`) polls every active resource/graph sequentially with synchronous external `runs.get_status()` calls — no batching, no per-call timeout, no cap. At dozens of concurrent ingestions one tick overruns 60s and `CANCEL_NEWEST` silently drops the next tick, stalling all status updates. | Batch status lookups, add per-call timeouts, shard the sweep. (Moot for the resource path if Q1/Q2 replace the bridge — still applies to the graph path.) |
| M2 | Two parallel ingestion state machines (`KBResource`-level and `ChatbotKnowledgeGraph`-level) are both live, monitored every minute, with two different internal boundaries (signed webhook vs direct Prisma writes from the worker) for the structurally identical problem. | One product owner per state machine, or collapse. Ruled by grill Q1/Q5. |
| M3 | `packages/i18n/messages/en.ts:1170-1172` + `de.ts` | Three dead `kb.ingestResource*` key pairs (fallout of B1). | Remove or restore with B1. |

### Minor

- `knowledgeWebhooks.ts:121-124` — `PROCESSING` transition allow-list is `[QUEUED]` only; plan says `[QUEUED, PROCESSING]`. Behaviorally equivalent (repeat PROCESSING no-ops); align code or plan text.
- `packages/hatchet/src/client.ts:9-19` — dev-only monkeypatch (`logger.undefined = ...`) works around the Hatchet 1.9.4 + `tsx --watch` bug instead of the repo's documented fix (run workers without `--watch`); breaks silently on SDK bump. Replace or fence with a version assertion.
- `packages/types/src/hatchet.ts` — model allow-list is a hardcoded TS array spanning three apps; production needs a config/DB-driven list.
- `packages/graphql/src/services/knowledge.ts:148-185` — core KB queries include the `knowledgeGraph` relation, coupling core-KB and KG code review-wise.

### Strengths to build on (verified)

- SAS/upload path exceeds the plan: server verifies uploaded blob `contentLength`/`contentType` against claims, idempotent `upsert` keyed by blob UUID, tested concurrent/cross-KB confirmation races.
- Deletion serialized with `SELECT ... FOR UPDATE` + bounded timeouts against concurrent ingestion claims.
- Webhook crypto textbook: HMAC over exact `${timestamp}.${rawBody}` raw bytes, `timingSafeEqual` with length guard, 300s window, 503-no-detail without secret; worker failure path goes through the signed webhook, not direct DB writes (D5 preserved).
- FalkorDB reader: parameterized Cypher, hard server-side LIMITs, read-only queries, node-id validation; graph DTO normalization denylists embeddings/secrets/SAS params before reaching the browser.
- i18n 51/51 keys en+de parallel; `data-cy` on every interactive element; `refetchQueries` uniform.
- Test suite (795-line `knowledge.test.ts`, 314-line webhook suite, KG + ingestion suites) exceeds 5078's coverage for the same surface.

### Contract fit — 5182's external Hatchet bridge vs canonical platform

| Element | Fit | Note |
| --- | --- | --- |
| Transport: `runNoWait()` onto a second Hatchet tenant (client token/host/TLS in Klicker worker) | **Opposed** | Exactly the Hatchet-to-Hatchet coupling the platform contract retires. Replace with sync `POST /v1/resources`. |
| Durable signed webhook + reconciliation sweep as complementary sources | **Aligned** | Correct shape; keep the skeleton (verification, correlation, DB-driven sweep discovery). |
| Event schema `{resourceId, ingestionAttemptId, status, statusMessage}` over `x-kb-*` headers | **Opposed** | Replace with `OperationStatusEvent` + `X-Ingestion-*` verbatim; HMAC-over-raw-body mechanics reusable. |
| Identity: `resourceId == KBResource.id` end-to-end | **Aligned** | Already correct. |
| Versions / two-axis status | **Adaptable** | Absent at resource level; KG's `selectionRevision`/`builtRevision` equality gate is the best existing analog of "candidate invisible until active". |
| Feature gating | **Absent** | No flags anywhere; GrowthBook per D-5. |

## [PR #5078](https://github.com/uzh-bf/klicker-uzh/pull/5078) Salvage — What to Take, When

5182 already independently rebuilt the valuable 5078 primitives (HMAC sign/verify, ownership + row-lock patterns, larger test suite) — **nothing to port there**. Genuine take-later items, mapped to v1 work packages:

| 5078 item | 5182 state | Recommendation | Target package |
| --- | --- | --- | --- |
| Soft-delete (`deletedAt`/`deletedById`) + delete-guard while QUEUED/PROCESSING | Absent (hard delete) | Take-later (columns + guard only) | W5 |
| `KBIngestionRun` per-resource run history | Absent (current-status only; retries lose history) | Take-later | W3 |
| `KBCourse`/`KBChatbot` M:N bindings + one-enabled-per-chatbot invariant | Absent; 5182 instead has `ChatbotKnowledgeGraph` (curated resource subset, revisioned) — **fundamentally different model** | Design reconciliation, not a port (grill Q5) | W4 |
| Typed metadata Zod-per-profile validation | Absent | Take-later (pattern, not values) if lecturer tagging prioritized | backlog |
| KB aggregate counts (`resourceCount`/`sizeBytes`) | Absent | Take-later | W7 |
| `KBWebhookInbox` event log | Absent; 5182's `updateMany` transition guard is immune to 5078's TOCTOU bug | Optional pure audit log later (insert-on-conflict-ignore), never as the dedupe gate | backlog |
| UX: ResourceInspector panel, bulk select/delete (ADD the missing confirm dialog), search/filter bar + server-side filter input, per-row progress bar, linked-consumers panel, metrics header, retry affordance | All absent | Re-implement (not copy) | W7 |
| KLICKER_OBJECT resource kind (reference live quizzes/elements as KB sources) | Absent | Take-later, needs enum translation onto 5182's `type` | v2 |
| Tests | 5182's suite is larger and matches its own API | Drop | — |

**Danger patterns from 5078 — never copy:** phantom upload flow (DB row, bytes never leave browser); non-transactional DB-write-then-webhook-dispatch mutations; unguarded `BigInt()` on webhook payload; `?? undefined` null-collapse making nullable fields unclearable; `window.prompt`/`window.confirm` for identifiers and destructive actions. (Plus the three program-ruled items: fire-and-forget dispatch, payload-sourced `externalResourceId`, pre-canonical event vocabulary.)

## Decisions — Grill Rulings (R5.0, ruled 2026-07-25)

All Q1-Q11 ruled by the user in the 2026-07-25 grill session. Ruling column is binding; consequences are folded into the roadmap below.

| Q | Decision | Ruling | Rationale / consequence |
| --- | --- | --- | --- |
| Q1 | Zombie ingest path (finding B1): v1 ingestion primitive | (a) Restore the per-resource Ingest entry point; resource-level ingestion is the primary primitive, KG build is one consumer of it | Matches the canonical platform contract (per-resource operations + versions). W1 restores the button and the `kb.ingestResource*` i18n keys (M3); Progress/screenshots refreshed to HEAD. |
| Q2 | Bridge replacement timing | Hybrid: merge 5182 into `kb-poc` as-is now (bridge intact); W2 contract alignment is the immediate next package and nothing else lands on the line before W2 completes; no STG lecturer exposure until aligned | Preserves working POC value without stalling the merge on the external API. M1 resource-path monitor fix is deferred into W2 (the sweep is replaced there by operations-API polling); revisit only if W2 slips. |
| Q3 | KG visualization + model selection | (b) Split into a separate parked PR during W1; core 5182 merges without it; re-lands as W9 after W2 | Reviewer-verified separable (clean migration split; coupling = `kbGraphIngestion` imports from `kbIngestion` + shared cron). Graph-path M1 monitor fix travels with the parked PR (W9). |
| Q4 | Self-service KB creation in v1 | (a) Keep self-service | Triggers the D-8 gate: server-side `kb_id` validation must ship in v1 (W6). |
| Q5 | KB↔chatbot↔course binding model | (a) KB-level attach: one enabled KB per chatbot (5078 `KBChatbot`-style one-enabled invariant); `KBCourse` deferred; KG resource-curation stays a KG-feature concern | Matches the scope-token design (one `kb_id` claim per chat request); cheapest correct v1; multi-KB (`kb_ids` array) stays v2 per prior ruling. Resolves M2 direction: one state machine per concern, resource level owns ingestion. |
| Q6 | Versioning depth in v1 | (a) Schema columns now (`resourceVersion`, `activeResourceVersion`, `activeContentSha256`, `errorCode`), replace-on-re-ingest semantics, minimal two-axis status UI | The canonical event schema requires the fields anyway; columns are cheap now, painful later (W3). |
| Q7 | Delete semantics for lecturers | (a) Soft-delete fence (`deletedAt`/`deletedById` + delete-guard while QUEUED/PROCESSING), async hard cleanup, tombstone-compatible ingestion delete | Aligns with the platform tombstone contract; port the 5078 column pair + guard (W5). |
| Q8 | Per-KB quotas for the ingestion registry allowlist | 100 resources / 500 MB per KB (tighter than the proposed 200 / 1 GB) | Conservative pilot posture; raisable later without migration (W6). Per-file 25MB and MIME allowlist pdf/txt/md/docx/pptx stand as previously ruled (D12). |
| Q9 | GrowthBook cohort shape | Broader pilot: courses opt in via an external Microsoft Forms form (faculty, course, use-case description, AI-Buddy-pilot participation — if participating, AI Buddy pays the AI cost, otherwise the course pays itself); the user then enables the course on GrowthBook. The gate covers **tutor chatbots only**; the other AI features are public beta for anyone with Catalyst at UZH. User-only flag administration; soft kill-switch = disable ingestion dispatch + hide attach UI, already-ingested content keeps serving | W8 rewritten to this shape. The Forms front door lives outside Klicker; Klicker-side work is the GrowthBook gate + kill-switch semantics only. |
| Q10 | Branch topology | Superseded 2026-07-26: `kb-poc` / [PR #5174](https://github.com/uzh-bf/klicker-uzh/pull/5174) is the v1 integration line into `v3-ai`. [PR #5182](https://github.com/uzh-bf/klicker-uzh/pull/5182) merges into `kb-poc`; W2+ continues there. The roadmap branch remains review history and is not rebased or force-pushed. | Keeps the plan and implementation in one PR. The older full-scale [PR #5078](https://github.com/uzh-bf/klicker-uzh/pull/5078) remains a read-only source for selective reimplementation of useful UI and behavior; it is never merged wholesale. |
| Q11 | Legacy static course chatbots (informational confirm) | Confirmed: untouched throughout v1 until the gated `chatbot_id`→`kb_id` migration (program R10.4); lecturers keep current behavior | Informational; no roadmap change. |

## Production v1 Roadmap (Klicker side — finalized 2026-07-25)

Work packages, dependency-ordered. Each lands as its own slice set with per-slice review per `$rs-sliced-development-workflow`; merges user-gated; everything behind the Q9 gating mechanism until platform gates pass.

| Pkg | What | Depends on | Notes |
| --- | --- | --- | --- |
| W1 | **5182 finish + merge into `kb-poc`**: keep this roadmap on the `kb-poc` integration line (Q10, done); extract KG visualization + model selection into a parked PR (Q3); restore the per-resource Ingest button + `kb.ingestResource*` i18n keys (B1/M3, Q1); align webhook transition table (minor); fence/remove the `tsx --watch` monkeypatch; refresh stale Progress/screenshots and affected engineering-wiki pages to HEAD; then merge [PR #5182](https://github.com/uzh-bf/klicker-uzh/pull/5182) into `kb-poc` with the bridge intact (Q2 hybrid) | Rulings Q1/Q2/Q3/Q10 (done) | CI on 5182 was green before W1 changes and must run fresh afterward. M1 is NOT fixed here: resource-path fix deferred to W2, graph-path travels with the parked PR (W9). Nothing else lands on the line until W2 completes. |
| W2 | **Contract alignment** (immediately after W1, hard ordering per Q2): replace bridge transport with sync ingestion API client (`POST /v1/resources` family), including the authenticated blob Source Gateway; receiver speaks `OperationStatusEvent` + `X-Ingestion-*` verbatim (`extra="forbid"`, replay-window check); keep HMAC/correlation/reconciliation-sweep skeleton; drop second-Hatchet client + `runs.list` recovery; reconciliation cron polls the operations API instead (absorbs the M1 resource-path fix). Persist `resourceVersion` and `contentSha256` here because both are required inputs to the canonical create contract and safe re-ingestion cannot use a hard-coded version. | W1; platform contract stable | Program packages R5.1/R5.2 effectively collapse into W1+W2: 5182 supersedes the "re-author 5078" framing. The W2/W3 boundary correction was user-approved on 2026-07-26 after comparison with the canonical fixtures. |
| W3 | **Two-axis status + history**: add `activeResourceVersion`, `activeContentSha256`, and `errorCode`; complete replace-on-re-ingest behavior; add `KBIngestionRun`-style attempt history, minimal status UI (operation vs serving axes), and retry affordance | W2 | `resourceVersion` and `contentSha256` moved to W2 as contract prerequisites; salvage 5078 run-history shape here |
| W4 | **Chatbot binding + retrieval seam**: KB-level attach with one-enabled-KB-per-chatbot invariant (Q5), ES256 scope-token minting per chat request (`kb_id` claim), `ChatbotMCPServer`/`ChatbotMCPConfig` wiring (no schema change needed), citation-card fix (`KB.doc_query` → `KB_doc_query`), "no enabled KB" warning | W2; platform R4.3 tenant mount (external) | The actual lecturer-value moment: chatbots answer from KBs. `KBCourse` deferred per Q5. |
| W5 | **Delete/tombstone + retention cleanup** (Q7): soft-delete fence (`deletedAt`/`deletedById` from 5078), ingestion `DELETE /v1/resources/{id}` + tombstone handling, async hard cleanup including expired unconfirmed upload blobs/tickets, delete-guard while active ops | W2 | W1 intentionally creates the DB row only after upload confirmation; W5 owns abandoned-upload retention rather than expanding the bridge schema. |
| W6 | **Quotas + `kb_id` validation**: per-KB caps 100 resources / 500 MB (Q8) enforced at mutation layer + ingestion registry numbers; server-side `kb_id` validation (D-8, triggered by Q4=self-service) | W2 | Per-file 25MB + MIME allowlist stand as ruled |
| W7 | **Scale + UX pack**: pagination/cursor on KB + resource lists, aggregate counts, search/filter (server-side filter input), inspector panel, bulk actions with confirm dialog, per-row progress, async-wait messaging, linked-consumers panel | W1 (parallel to W2-W6) | Re-implement 5078 nuggets in 5182's package |
| W8 | **GrowthBook gating + pilot** (Q9): gate covers tutor chatbots only (other AI features public beta for Catalyst users); opt-in via external Microsoft Forms (faculty, course, use case, AI-Buddy participation → cost ownership), user enables courses on GrowthBook; user-only flag admin; soft kill-switch (stop dispatch + hide attach UI, existing content keeps serving); default-off; STG canary with the platform's 10-scenario synthetic journey evidence before any real lecturer traffic | W2-W6; GrowthBook availability (external); platform R4.4 | Forms front door lives outside Klicker |
| W9 | **KG visualization re-landing** (Q3=split): parked PR rebased onto the aligned bridge replacement, model allow-list moved to config, graph-path monitor batching/timeouts fixed (M1) | W2 | Independently reviewed as solid (bounded queries, data minimization) |

External (platform-track) dependencies to watch, not owned here: R1.1 `resource_active` gating, R1.2 partition wiring, R1.3/R1.4 blast-radius fixes, R4.3 Klicker tenant mount, R4.4 producer enable + Gap-D proof, D-2 Langfuse per-tenant project for Klicker.

## Progress

- [x] 2026-07-24: Three-agent review complete (5182 core, 5182 extras/contract, 5078 salvage); findings synthesized; grill agenda drafted; roadmap drafted pending rulings. Review worktree `trees/kb-review-5182` still present (removal needs approval).
- [x] 2026-07-25: Grill rulings Q1-Q11 recorded (see Decisions section)
- [x] 2026-07-25: Roadmap finalized from rulings
- [x] 2026-07-26: Roadmap moved onto `kb-poc`; Q10 corrected so [PR #5174](https://github.com/uzh-bf/klicker-uzh/pull/5174) is the integration line into `v3-ai`
- [x] 2026-07-26: PR #5182 worktree attached to `feat/kb-poc-management-ui`; full pre-split head `9b5fc7af2` preserved on local branch `feat/kb-knowledge-graph-parked`; latest `kb-poc` roadmap merged into the implementation branch
- [x] 2026-07-26: W1 extraction complete — full KG visualization/model-selection head preserved on `feat/kb-knowledge-graph-parked` and published as draft [PR #5206](https://github.com/uzh-bf/klicker-uzh/pull/5206); core extraction committed as `f4984229a`
- [x] 2026-07-26: W1 core fixes complete — repeated `PROCESSING` callbacks accepted (`dab6aa63e`); unsupported Hatchet internal-logger patch removed and both workers verified live without `tsx --watch` (`720fe43cd`)
- [x] 2026-07-26: W1 UI re-verified on `https://manage.klicker.feat-kb-poc-management-ui.localhost` — delegated login, URL resource creation, `FAST` selection, Ingest -> `QUEUED`, local `ingest-kb-resource` receipt, privacy-safe stub log, EN desktop and DE 375 px screenshots. The isolated environment has no real external ingestion endpoint, so the expected sanitized external-dispatch failure remains the already-documented deployment smoke prerequisite.
- [x] 2026-07-26: W1 security remediation complete — URL resources reject embedded credentials and local/private/reserved literal destinations at registration and again before external dispatch; shared utility, GraphQL, and Hatchet regression suites pass. External DNS/redirect egress enforcement remains a required W2/deployment gate before lecturer exposure. Abandoned-upload retention remains explicitly owned by W5.
- [x] 2026-07-26: W1 local finish gate complete — root `check:all` passed (24 typecheck tasks plus lint, formatting, and syncpack); focused utility, Hatchet, and real-PostgreSQL GraphQL suites passed (73, 48, and 48 tests); the pre-push production build passed all 22 tasks. Contract and maintainability re-reviews found no W1 blocker. Security re-review confirmed literal/numeric destination bypasses are closed and classified DNS/redirect enforcement as the documented external deployment gate, not a #5182 merge blocker. Opengrep was unavailable in the environment. NEXT: read back fresh #5182 CI, then stop for merge approval.
- [x] 2026-07-26: Fresh PR #5182 CI passed and the approved squash merge landed on `kb-poc` as `b66ae0107d05c455af4165b276a052b0740088c2`. The integration line then absorbed current `v3-ai`; KB and verifiable-credential Prisma/GraphQL surfaces were reconciled, KB package peers were aligned with Next 16/React 19.2, generated artifacts were regenerated, and W1 behavior was added to the current engineering wiki. The merge also exposed and fixed a Next 16 integration fault: shared locale loading now uses statically analyzable imports and the i18n package resolves `next-intl` against the line's single Next 16 peer context. The merged line passes root `check:all`, the utility suite (73 tests), the Hatchet suite (48 tests), frozen-lockfile installation, and the full production build (22/22 tasks). The local GraphQL Docker harness cannot run inside the repository-mandated devcontainer because that image has no Docker CLI; W1's fresh pre-merge real-PostgreSQL GraphQL run and PR CI remain the database-backed evidence for this unchanged integration.
- [ ] 2026-07-26: W2 active. Canonical contract audit used data-ingestion `origin/main` at `2a58b8354161b7fb2730a2be0de537935893a56d`: `POST /v1/resources` requires an awaited `202 {operation_id}`, bearer auth, `Idempotency-Key`, monotonic `resource_version`, exact `content_sha256`, and a producer-authenticated Source Gateway for blob bytes; `GET /v1/operations/{operation_id}` is the reconciliation source. The user approved moving `resourceVersion` and `contentSha256` persistence from W3 into W2; W3 retains serving-axis fields, run history, and UI. Slice one implements exact accepted dispatch, immutable source hashing, authenticated blob streaming, operations-API polling with bounded concurrency, and the schema migration from workflow-run to operation correlation. Its independent review fixes preserve the original URL across redirect-backed idempotent retries, align URL admission with ingestion policy, and make active legacy rows retryable. Slice two replaces the POC callback with the exact canonical `OperationStatusEvent` body and four `X-Ingestion-*` headers, canonical-byte and extra-field rejection, current/previous-key HMAC verification with a five-minute replay window, operation/version correlation, serving version/digest gating before `READY`, and terminal-state race guards. Focused TypeScript checks and utility/Hatchet/real-PostgreSQL GraphQL tests pass. Next: independent slice-two review, then deployment/configuration/wiki cleanup and final verification.
- [ ] Program roadmap §3a amended (R5.0 satisfied) — external `_local` artifact, done outside this repo on user request
- [x] W1 executed (KG split, 5182 fixes, wiki/screenshots refreshed, merge into `kb-poc`)

## Active Autonomous Goal

- Objective: execute W2 contract alignment on `kb-poc` immediately after the verified W1 integration.
- Terminal condition: Klicker dispatches through the canonical synchronous `/v1/resources` ingestion API; status ingestion accepts the verbatim strict `OperationStatusEvent` body and `X-Ingestion-*` headers with replay protection; reconciliation polls the operations API; and the external Hatchet client plus `runs.list` recovery path are removed.
- Boundaries: nothing else lands on the line before W2 completes. Do not expose staging, change the parked W9 scope, implement W3-W8, or merge the older full-scale PR #5078. Preserve W1's HMAC, correlation, URL-safety, and reconciliation skeleton while replacing only the ruled transport/contract.
- Branch: implement and commit W2 directly on `kb-poc`; PR #5174 remains the draft integration PR into `v3-ai`.
- Verification: contract-focused unit/integration tests, generated GraphQL/Prisma artifacts where applicable, root `check:all`, production build, browser verification for any user-visible state change, then mandatory maintainability/security/branch crosscheck reviews and fresh PR CI.
- Pause conditions: stop only if the canonical external contract is unavailable or internally inconsistent, credentials/external infrastructure block required live proof, or a decision would change the ruled W2 scope.
