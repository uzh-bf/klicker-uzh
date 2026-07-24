# KB Management — Production v1 Roadmap Plan

## Plan Identity

- Date: 2026-07-24. Branch: `claude/admiring-nightingale-c30fa4` (currently based on `v3` — see Open Decision Q10 on branch topology).
- Inputs reviewed: PR #5182 (junior implementation of the [POC plan](2026-07-15-pr-5174-kb-poc-plan.md), branch `feat/kb-poc-management-ui`, base `kb-poc`, 149 files / +23k), PR #5078 (older full-scale KB prototype, branch `codex/kb-management-ui`, ruled REPLACE by the 2026-07-23/24 program review), the R5.0 scope-grill handoff and the program's final roadmap + A6 Klicker lens report (external `_local` review artifacts, not in this repo).
- Method: three independent Opus review subagents (5182 core-plan conformance; 5182 beyond-plan scope vs the canonical ingestion-platform contract; 5078 salvage inventory vs 5182), synthesized here. Review worktree: `trees/kb-review-5182` (detached at `9b5fc7af2`, read-only; remove after this plan lands — needs approval).
- Purpose: (1) reviewable record of the PR 5182 findings, (2) the decision agenda for the product-scope grill (program gate R5.0), (3) the draft production v1 work-package roadmap. Roadmap is DRAFT until the grill rulings in the Decisions section are filled in.

## Fixed Program Constraints (user-ruled 2026-07-23/24 — do not re-litigate)

- Ingestion is an external producer-neutral service: Klicker calls a synchronous HTTP API (`POST /v1/resources` family), never fire-and-forget dispatch. Status returns via durable HMAC-signed webhooks (retry + dead-letter) PLUS reconciliation polling; webhooks are never the sole source of truth.
- Canonical status event: `OperationStatusEvent` with `X-Ingestion-*` headers, `operation_id` correlation, `resource_version` int, nested `serving: {active_resource_version, active_sha256}`; receiver schemas are `extra="forbid"`-strict — adopt verbatim, field-for-field.
- Resource identity is Klicker-owned: `external_resource_id == KBResource.id`; ingestion never assigns or overwrites Klicker-side ids.
- Per-resource monotonic versions; no whole-KB revision model; two-axis status (operation vs serving: "update failed, still serving v(N)"); candidate content invisible until `resource_active=true`.
- Feature gating via GrowthBook (external dependency, integration in progress); no ad hoc flag infra.
- `kb_id` server-side validation is deferred ONLY until lecturer self-service KB creation exists (D-8) — self-service in v1 triggers that gate.
- Platform-side gates outside this repo: Klicker tenant mount on shared `mcp-doc-query.stg-doc-query` (R4.3, needs blast-radius fixes R1.3/R1.4), producer-enable + 10-scenario synthetic journey (R4.4), `resource_active` retrieval gating (R1.1) and Milvus partition wiring (R1.2) block ANY retrieval canary.

## PR 5182 Review — Verdict and Findings

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

## PR 5078 Salvage — What to Take, When

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

## Open Decisions — Grill Agenda (R5.0)

Each row needs a user ruling; REC = recommendation. Rulings recorded in place, then the roadmap below is finalized.

| Q | Decision | Options | REC |
| --- | --- | --- | --- |
| Q1 | Zombie ingest path (finding B1): what is the v1 ingestion primitive? | (a) restore per-resource Ingest button, keep resource-level path as primary, KG build consumes it; (b) bless graph-level-only ingestion, delete resource-level path (~3k LOC incl. tests) | (a) — the canonical platform ingests resources (per-resource operations, per-resource versions); graph builds are one consumer. (b) contradicts the platform contract shape. |
| Q2 | Bridge replacement timing: when does the Hatchet-to-Hatchet transport get replaced by the producer-neutral HTTP API + `OperationStatusEvent`? | (a) before anything merges to `v3-ai`; (b) merge 5182 to `kb-poc` as POC state now, replace in W2 as first v1 package, no STG lecturer exposure until aligned; (c) keep bridge for STG demo term, align later | (b) — preserves working POC value; contract alignment is mandatory before real traffic anyway (program gate). |
| Q3 | KG visualization + model selection: ship in v1? | (a) keep in the merged branch; (b) split into separate parked PR, re-land after W2 (it depends on bridge primitives being replaced) | (b) — reviewer-verified separable (clean migration split; coupling = `kbGraphIngestion` imports from `kbIngestion` + shared cron). |
| Q4 | Self-service KB creation in v1 (5182 has it) | (a) keep self-service → schedules the D-8 `kb_id` server-side validation gate into v1; (b) admin-created KBs only for v1 | (a) — it exists, it is the core UX; add validation package W6. |
| Q5 | KB↔chatbot↔course binding model for v1 | (a) KB-level attach: one KB per chatbot (5078 `KBChatbot`-style, one-enabled invariant), `KBCourse` deferred, KG resource-curation stays a KG-feature concern; (b) resource-level curation as THE binding (extend `ChatbotKnowledgeGraph` shape); (c) both layers in v1 | (a) — matches the scope-token design (one `kb_id` claim per chat request), cheapest correct v1; multi-KB (`kb_ids` array) stays v2 per prior ruling. |
| Q6 | Versioning depth in v1 | (a) schema columns now (`resourceVersion`, `activeResourceVersion`, `activeContentSha256`, `errorCode`), replace-on-re-ingest semantics, minimal two-axis UI; (b) full update UX incl. failed-update-keeps-serving surfaced everywhere; (c) defer all versioning | (a) — the canonical event schema requires `resource_version` anyway; columns are cheap now, painful later. |
| Q7 | Delete semantics for lecturers | (a) soft-delete fence + async hard cleanup + tombstone-compatible ingestion delete; (b) keep 5182 hard delete for v1 | (a) — aligns with the platform tombstone contract; port the 5078 column pair + guard. |
| Q8 | Quotas for the ingestion registry allowlist (concrete numbers needed) | per-file 25MB is ruled; propose per-KB caps: 200 resources / 1 GB total; MIME allowlist pdf/txt/md/docx/pptx (ruled D12) | Confirm or adjust the two numbers. |
| Q9 | GrowthBook cohort shape | pilot course set (which?), who flips flags (user only?), kill-switch semantics (hide UI vs disable ingestion vs both), and the availability timeline of the GrowthBook integration as external dependency | Propose: pilot = 1-2 volunteer courses; user flips; kill-switch disables dispatch + hides attach UI, existing content keeps serving. |
| Q10 | Branch topology | This plan branch is `v3`-based; `kb-poc`/5182 are `v3-ai`-based. (a) rebase this branch onto `v3-ai` and make it the v1 integration branch that 5182 (via `kb-poc`) merges into; (b) keep plan here, merge mechanics separately | (a) — merging `v3-ai`-history branches into a `v3`-based branch drags the whole `v3-ai` line in; rebase first. |
| Q11 | Legacy static course chatbots (informational confirm) | Untouched until the gated `chatbot_id`→`kb_id` migration (program R10.4) — lecturers keep current behavior throughout v1 | Confirm framing. |

## Draft Production v1 Roadmap (Klicker side — finalize after rulings)

Work packages, dependency-ordered. Each lands as its own slice set with per-slice review per `$rs-sliced-development-workflow`; merges user-gated; everything behind the Q9 cohort mechanism until platform gates pass.

| Pkg | What | Depends on | Notes |
| --- | --- | --- | --- |
| W1 | **5182 finish + merge into `kb-poc`**: resolve B1 per Q1, remove dead i18n (M3), fix monitor batching/timeouts (M1), align webhook transition table (minor), fence/remove the `tsx --watch` monkeypatch, refresh stale Progress/screenshots; then merge 5182 → `kb-poc` (PR 5174 line) | Q1, Q3 (if split, extract KG first) | CI on 5182 already green (check/test pass) |
| W2 | **Contract alignment**: replace bridge transport with sync ingestion API client (`POST /v1/resources` family), receiver speaks `OperationStatusEvent` + `X-Ingestion-*` verbatim (`extra="forbid"`, replay-window check), keep HMAC/correlation/reconciliation-sweep skeleton, drop second-Hatchet client + `runs.list` recovery; reconciliation cron polls the operations API instead | Q2; platform contract stable | Program packages R5.1/R5.2 effectively collapse into W1+W2: 5182 supersedes the "re-author 5078" framing |
| W3 | **Versioning + two-axis status**: schema columns per Q6, replace-on-re-ingest flow, `KBIngestionRun`-style attempt history, status UI (operation vs serving axes), retry affordance | W2 | Salvage: 5078 run-history shape |
| W4 | **Chatbot binding + retrieval seam**: KB↔chatbot attach per Q5, ES256 scope-token minting per chat request (`kb_id` claim), `ChatbotMCPServer`/`ChatbotMCPConfig` wiring (no schema change needed), citation-card fix (`KB.doc_query` → `KB_doc_query`), "no enabled KB" warning | W2; platform R4.3 tenant mount (external) | The actual lecturer-value moment: chatbots answer from KBs |
| W5 | **Delete/tombstone**: soft-delete fence, ingestion `DELETE /v1/resources/{id}` + tombstone handling, async hard cleanup, delete-guard while active ops | W2, Q7 | |
| W6 | **Quotas + `kb_id` validation**: per-KB caps per Q8 enforced at mutation layer + ingestion registry numbers; server-side `kb_id` validation (D-8, triggered by Q4=self-service) | W2 | |
| W7 | **Scale + UX pack**: pagination/cursor on KB + resource lists, aggregate counts, search/filter (server-side filter input), inspector panel, bulk actions with confirm dialog, per-row progress, async-wait messaging, linked-consumers panel | W1 (parallel to W2-W6) | Re-implement 5078 nuggets in 5182's package |
| W8 | **GrowthBook gating + pilot**: cohort per Q9, kill-switch, default-off; STG canary with the platform's 10-scenario synthetic journey evidence before any real lecturer traffic | W2-W6; GrowthBook availability (external); platform R4.4 | |
| W9 | **KG visualization re-landing** (if Q3=split): parked PR rebased onto the aligned bridge replacement, plus model allow-list moved to config | W2 | Independently reviewed as solid (bounded queries, data minimization) |

External (platform-track) dependencies to watch, not owned here: R1.1 `resource_active` gating, R1.2 partition wiring, R1.3/R1.4 blast-radius fixes, R4.3 Klicker tenant mount, R4.4 producer enable + Gap-D proof, D-2 Langfuse per-tenant project for Klicker.

## Progress

- [x] 2026-07-24: Three-agent review complete (5182 core, 5182 extras/contract, 5078 salvage); findings synthesized; grill agenda drafted; roadmap drafted pending rulings. Review worktree `trees/kb-review-5182` still present (removal needs approval).
- [ ] Grill rulings Q1-Q11 recorded
- [ ] Roadmap finalized from rulings; program roadmap §3a amended (R5.0 satisfied) — external `_local` artifact, done outside this repo
- [ ] W1 executed (5182 fixes + merge into `kb-poc`)
