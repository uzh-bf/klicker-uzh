# W9 — KB-owned knowledge graph (stacked)

Roadmap: [2026-07-24-kb-production-v1-roadmap-plan.md](2026-07-24-kb-production-v1-roadmap-plan.md), package W9.
Decision record: [ADR 0001](../docs/adr/0001-kb-owns-two-derived-projections.md).
Base: `kb-poc` @ `38625cbbf`. Worktree: `trees/kb-graph-stack`. Gate 1 approved 2026-07-31.

## Provenance

- Parked [PR #5206](https://github.com/uzh-bf/klicker-uzh/pull/5206) (`feat/kb-knowledge-graph-parked` @ `9b5fc7af2`) is **Patrick Louis Aldover's** work — all 25 commits in `b4a99893c..9b5fc7af2`, 2026-07-20 to 2026-07-22. It is the base to evolve, not to rebuild. Preserve the branch and PR untouched until the stack validates against it.
- [PR #5116](https://github.com/uzh-bf/klicker-uzh/pull/5116) (`codex/falkordb-chatbot-graphs`, `packages/falkordb`, React Flow drawer) stays open as a reference for its visuals and package patterns. Not merged, not closed.
- The branch forked at `6b86f9ec7`; `kb-poc` has since advanced 75 commits (W1–W8), rewriting the ingestion ledger, serving identity, deletion fencing, quota, and upload tickets underneath the KG code.

## Rulings (2026-07-31 grill)

- R1 One active build per KB, conditional-update claim. Repeat request for the building revision returns it. KB advancing mid-build: build finishes and publishes for its own revision; no cancel, no auto-follow-up, no blocked edits.
- R2 KB revision = digest over active serving set (`resourceId` + `activeContentSha256`), computed on demand, stamped per build. No column on `KB`.
- R3 New platform-initiated refresh event; handler creates a ledger row from the platform operation id and advances serving identity. Existing attempt-scoped guards untouched.
- R4 Build request pins `buildId`, `kbId`, digest, per-resource hashes. External service resolves to **processed documents** and fails on hash mismatch.
- R5 Webhook-primary + cron poll backstop. Configurable generous timeout fails a wedged build and releases the slot. Late success accepted only if digest still matches.
- R6 No scheduled rebuilds. Explicit lecturer request only — builds spend the lecturer's AI budget.
- R7 Named quality tier, mapped to models in server config, never in source.
- R8 Build controls in a dedicated card in `KnowledgeBaseDetail`.
- R9 Stale label is **lecturer-only**, on KB and graph views. Students get no staleness signal. (Narrows the 2026-07-30 "every graph-backed feature" ruling.)
- R10 One ADR, establishing `docs/adr/`.
- R11 Nothing lands in FalkorDB until complete; every build writes to its own recorded graph name and the published pointer moves only to a successful build. Versioning via GraphML export to Blob.
- R12 GraphML under a reserved prefix in the owner's KB container, excluded from resource quota. After a bounded grace period, `kbMaintenance` sweeps both GraphML and any graph name that is neither active nor published.
- R13 Lecturer viewer in KB workspace **and** student viewer in chat, both KB-owned.
- R14 Carry Patrick's implementation and attribution forward while preserving the parked branch and PR. Keep a buildable verbatim port as a provenance commit where possible; when the current base makes a raw port intentionally non-buildable, re-home it in the first buildable layer commit with the source refs recorded in the commit body and this plan. Never bypass hooks or mutate Patrick's branch.

## Porting Patrick's 25 commits (R14)

His commits interleave layers rather than arriving in layer order, so contiguous squashing cannot produce layer-aligned groups. Group by file path instead. The range splits into **56 added** files and **44 modified** files:

- **Added files that remain buildable** are ported verbatim as Patrick-authored provenance commits — L2 is `068241088`. The adaptation to the KB-owned design lands as separate commits on top, so the two are never conflated.
- **Modified files are hand-merged inside each layer's refactor.** Taking his versions verbatim would revert W1–W8: `packages/prisma/src/prisma/schema/knowledge.prisma`, `packages/hatchet/src/kbIngestion.ts`, `packages/graphql/src/services/knowledge.ts`, and `packages/types/src/hatchet.ts` all evolved substantially after the fork. Generated artifacts (`ops.ts`, `ops.schema.json`, `public/*.json`, `public/schema.graphql`, `pnpm-lock.yaml`) are regenerated, never ported.

| Layer | Added files ported |
| --- | --- |
| L2 | `packages/knowledge-graph/**` (15), `packages/types/src/knowledgeGraph.ts` |
| L3 | `packages/hatchet/src/kbGraphIngestion.ts` + test, `packages/graphql/src/schema/chatbotKnowledgeGraph.ts`, `services/chatbotKnowledgeGraphs.ts` + test, 6 `.graphql` ops |
| L4 | `packages/shared-components/src/knowledgeGraph/**` (6), `ChatbotKnowledgeGraphPanel.tsx`, `ChatbotKnowledgeGraphPreview.tsx` |
| L5 | `apps/chat/**` knowledge-graph route, page, components, server lib, 3 tests (10) |

L3 provenance note: the L3 source port was first copied verbatim from Patrick's parked tip (`9b5fc7af2`), but the mandatory normal hook stopped at obsolete Chatbot types after the KB re-home. No `--no-verify` port commit was created. The first buildable L3 commit carries the KB-owned re-home and preserves the source lineage in its body; the parked branch remains untouched.

Deliberately **not** ported (11 files), each explained at union validation:

- `docs/superpowers/**` (6) — design docs for the rejected chatbot-owned architecture, superseded by ADR 0001 and preserved in PR #5206.
- `project/screenshots/*chatbot-knowledge-graph*` (4) — verification screenshots of the chatbot-owned UI, replaced by fresh ones at L4/L5.
- `packages/prisma/.../20260720150000_chatbot_knowledge_graph/migration.sql` — creates `ChatbotKnowledgeGraph`; the KB-owned migration is written fresh at L2 rather than created and then dropped.

## Layers

Each layer is independently functional, independently reviewable, green at its own tip. Drafts until actionable. No merge, un-draft, or deploy without explicit authority.

**L1 `feat/kb-ingestion-refresh-event`** — new platform-initiated refresh event type in `packages/graphql/src/services/knowledgeWebhooks.ts`; ledger row from the platform operation id; serving-identity advance; attempt-scoped guards preserved for lecturer-initiated runs. Carries this plan, ADR 0001, and the roadmap W9 revision. No parked equivalent — new work. Ships value alone: keeps RAG current regardless of graph work.

**L2 `feat/kb-graph-model`** — re-home `packages/knowledge-graph` and its schema from chatbot to KB. Patrick's 16 added files are ported verbatim as his commit (`068241088`); the re-homing lands on top:

- **Schema.** Drop `ChatbotKnowledgeGraph`. Add `KBGraphBuild`, an append-only attempt ledger mirroring `KBIngestionRun` (client-supplied uuid id = idempotency key; `status`, `qualityTier`, `sourceContentDigest`, `graphName`, `graphmlBlobName`, `externalOperationId`, `externalStartedAt`, `statusMessage`, `errorCode`, `startedAt`, `finishedAt`, and retention claim timestamps). Each build also owns immutable source snapshots so later resource edits or deletions cannot change the manifest being reconciled. On `KB`, two plain uuid columns following the `ingestionAttemptId` precedent — `activeGraphBuildId` (the single-slot claim target for R1) and `publishedGraphBuildId` (what FalkorDB currently serves, R11). Enums `KBGraphBuildStatus` (QUEUED/PROCESSING/SUCCEEDED/FAILED/SUPERSEDED — timeouts are FAILED with an error code, keeping the enum aligned with `KBIngestionStatus`) and `KBGraphQualityTier`. Fresh migration; the parked `20260720150000_chatbot_knowledge_graph` is not ported.
- **Digest (R2).** Compute over the active serving set — `resourceId` + `activeContentSha256` of every non-deleted resource with an active hash — on demand, no column on `KB`. A pending replacement never suppresses the revision still serving RAG.
- **Identity.** `getKnowledgeGraphName(kbId, buildId)` → `klickeruzh:kb:<kbId>:<buildId>`; each completed build records its own graph name, while `graphSession` and `getPublishedKnowledgeGraph` are re-scoped to `kbId`. These are the only three seams the reader exposes.
- **Publication rule (R11).** The parked rule returned `DIRTY` = not published. Invert it: a build whose digest no longer matches the KB still serves; staleness is a label, not an outage.

`docs/domain-model.md` lands with this refactor, where its prose becomes true. Green at its own tip: `check`, `lint`, and the package's vitest run in-container.

**L3 `feat/kb-graph-lifecycle`** — re-home Patrick's direct external-Hatchet graph workflow dispatch to the KB-owned pinned manifest (R4), direct status-poll reconciliation with timeout release (the external callback contract required to complete R5 is not available yet), GraphML export plus retention sweep of only unreferenced, non-active/non-published graph names in `kbMaintenance` (R12), quality-tier config mapping (R7); GraphQL status/rebuild/read ops re-pointed at the KB with KB-edit authorization. The companion LightRAG branch extends that existing external workflow to verify each pinned source hash after extraction and write the deterministic GraphML artifact; it does not introduce a new graph-generation service.

**L4 `feat/kb-graph-manage-ui`** — move build controls from `ChatbotKnowledgeGraphPanel` to a dedicated card in `KnowledgeBaseDetail` (R8): status, stale label (R9), tier selector, rebuild with cost stated; lecturer viewer keeping Patrick's Cytoscape presentation and accessible DOM fallback.

**L5 `feat/kb-graph-chat-viewer`** — Patrick's chat graph workspace and viewer, re-owned by the KB binding (R13). No staleness surface here (R9).

## Verification

- Per layer: `pnpm run check`, `pnpm run lint`, focused vitest, in-container per [klicker-verification-loop](../docs/index.md). Never run host-side `pnpm install`/`build`.
- L1/L3: webhook and reconciliation unit coverage including the refresh event, timeout release, and late-success digest mismatch.
- L4/L5: `agent-browser` against the stack's own devcontainer with before/after screenshots; delegated login (`lecturer`/`abcd`).
- Local FalkorDB: harvest the docker-compose service and env wiring from PR #5116 rather than inventing one.
- Union validation before any layer leaves draft: compare the stack against `b4a99893c..9b5fc7af2` and explain every deliberate difference.

## Boundaries

- Graph generation stays outside this repository. Do not reimplement it here.
- PRs #5174, #5206, #5116 stay untouched drafts. No merge, un-draft, deploy, or external-platform mutation.
- The W8 security review was skipped by explicit user choice; that is not authority for a broad W9 security assessment. Ask first.
- Public repo: no credentials, no real lecturer or student data.

## M1 continuation — W2 package

This section extends the existing W9 plan for the approved M1 package. It is
not a second plan or a new stack. The five W9 layers remain the topology; this
continuation adds the production-base reconciliation, graph-cost seams, and
current contract acceptance required by the roadmap.

### Identity and current boundary

- Branch: `feat/kb-graph-lifecycle` in `trees/kb-graph-stack`.
- Target: current GitHub `v3` ref `9a82e7fa63ba6b0f6b373470e3d6b77ae265d371`
  (read-only `git ls-remote` on 2026-08-15).
- Current implementation tip: `810ce4edb4768403a1326b0e400a1623136f2520`.
- The plan metadata refresh follows this implementation tip as a docs-only
  commit; no code changes are implied by that follow-up.
- Current local comparison: 143 commits ahead and 81 behind the stale local
  `origin/v3`. The live target has not been fetched because shared Git metadata
  still rejects `FETCH_HEAD` writes; no rebase or merge is implied.
- Local `origin/v3` is stale at `2bcaddabe3bf3b39e23e71e7cf3eda7179f6291f`;
  shared Git metadata currently rejects `FETCH_HEAD` writes. Read-only
  `git ls-remote` is the current target evidence. Do not rebase or merge until
  a writable Git metadata path is available; preserve the dirty primary
  checkout and this worktree's intentional docs/ADR changes.
- W1 graph contract: provider-side schema and metered result identity come from
  Catalyst W1. W2 owns Klicker consumer fixtures, reservation/settlement
  behavior, and lecturer cost presentation. This is separate from Catalyst's
  public chat-engine contract gate.
- Credential boundary: non-credential work may proceed. Credential-facing UI,
  provider-bearing/model-backed runs, and beta activation remain blocked on the
  generic credential architecture.

### Goal and non-goals

- Problem: W9 graph lifecycle and viewers exist locally, but current-base
  compatibility, disposable migration proof, cost settlement, and complete
  non-credential UX evidence remain open.
- Decision: Reconcile the current target before implementation, retain the
  five-layer topology, and land quota state in the model/reader layer,
  reservation/settlement in lifecycle, and cost presentation in the lecturer
  layer. Do not create a sixth quota package.
- Non-goals: no credential UI or custody, paid model call, cluster/runtime
  mutation, merge, push, PR update, production activation, or cleanup of
  parked branches/dirty files.

### Delegation map

| Workstream | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| W2-R active-plan and stack refresh | main | writable Git metadata | current target/base ledger, recovery ref, five-layer ownership and no duplicate plan |
| W2-A lifecycle and quota state | executor | W2-R and W1 graph fixtures | migrations, kill switch, opt-in, atomic reservation, idempotent settlement, focused tests |
| W2-B non-credential UI | executor | W2-A | cost/quota states and lecturer/student browser evidence without credential controls |
| W2-C five-layer integration | main | W1-B, W2-A, W2-B | contract conformance, union verification, and independently green layers |

### Feature-wide test portfolio

| Risk or behavior | Existing evidence | Test obligation | Primary seam | Distinct failure | Owner |
| --- | --- | --- | --- | --- | --- |
| Current base breaks W9 behavior | W9 focused tests and review evidence | extend existing | target-base revalidation and union diff | stale branch silently regresses current v3 behavior | W2-R |
| Migration or rollback is unsafe | Prisma migrations exist; application unverified | add new | disposable PostgreSQL migration and compatibility smoke | deployment migration fails or old app crashes on new schema | W2-A |
| Graph dispatch ignores kill switch or per-KB opt-in | lifecycle code and focused tests exist | extend existing | GraphQL mutation/dispatch boundary | disabled or non-opted-in KB starts a build | W2-A |
| Quota is oversubscribed or settled twice | no graph-cost ledger proof | add new | transactional reservation and terminal reconciliation | concurrent builds overrun quota or duplicate result double-charges | W2-A |
| Cost display misleads lecturer | partial UI cost label exists | add new | lecturer card with synthetic reservation/settlement states | estimate, balance, billing label, or actual cost is absent/wrong | W2-B |
| Unauthorized graph access | focused auth tests exist | extend existing | GraphQL and chat route auth seams | graph leaks across KB, owner, chatbot, or participant | W2-C |
| Patrick presentation regresses | component tests and parked provenance exist | extend existing | routed browser at mobile/desktop | Cytoscape or accessible fallback is unusable | W2-B/C |
| Graph archive is purged with serving cleanup | retention code exists | add new | maintenance policy over graph names and GraphML keys | durable GraphML is deleted while KB retention is active | W2-A/C |

### Approved slices

#### W2-R — Reconcile the current target and active W9 plan

- Route: `main`.
- Do: Obtain writable shared Git metadata or an equivalent approved runtime;
  create a recovery ref before any rebase/merge; compare current target to W9
  layers and parked provenance; classify new target changes touching W2 paths.
  Keep this existing plan as the single W2 plan.
- Check: exact target ref, merge base, dirty-state ledger, no unrelated file
  staged, and no topology mutation beyond the approved branch.
- Commit: plan/progress update first; no implementation before it.

#### W2-A — Complete lifecycle, quota, and contract acceptance

- Route: `executor` for bounded model/lifecycle changes after W2-R; main owns
  schema and cross-repository seams.
- Do: Add/verify the graph-build kill switch and per-KB opt-in; apply the
  W1-versioned fixtures; atomically reserve estimated maximum cost in integer
  minor units; deny unaffordable dispatch; settle valid actual cost exactly
  once by build ID; fail closed on duplicate, malformed, mismatched, or
  over-reservation results; release unused reservation in the same transition.
- Check: disposable migration, rollback compatibility, concurrency and
  duplicate/invalid terminal tests, graph publication/retention tests, and
  focused GraphQL checks.
- Commit: `enhance(kb-graph): complete quota and lifecycle seams`.

#### W2-B — Complete non-credential lecturer and student evidence

- Route: `executor` for bounded UI changes; main owns browser evidence and
  contract integration.
- Do: Render pre-dispatch estimate, remaining semester quota, worst-case
  balance, billing label, post-settlement actual usage and cost; keep provider
  credential controls absent; preserve stale lecturer-only state and student
  graph availability semantics.
- Check: `agent-browser` against the current live branch at mobile and desktop
  widths for empty, building, published, stale, failure, available, and
  unavailable states; screenshots contain synthetic data only.
- Commit: `enhance(kb-graph): present quota and settlement state`.

#### W2-C — Revalidate the five-layer integration

- Route: `main`.
- Do: Regenerate affected Prisma/GraphQL artifacts, run union verification
  against Patrick's parked range, and account for every deliberate difference.
  Keep W5 parity/harness retirement outside W2.
- Check: focused GraphQL/knowledge-graph/chat/component suites, workspace
  check/lint/build as available, migration evidence, browser screenshots, and
  contract fixture readback.
- Commit: `test(kb-graph): verify integrated graph stack` for test-only deltas,
  or the smallest accurate type for actual integration changes.

### Review and finish gates

- W2-A crosses data integrity and cross-system seams: run one simplifier and
  one risk-selected slice reviewer in parallel on its exact committed range.
- W2-B is a substantive UI slice: run the simplifier and mandatory browser
  verification; add the slice reviewer if it changes authorization or data
  exposure.
- W2-C receives one integrated final reviewer after fresh verification.
- No PR/stack readiness claim, push, merge, deployment, or production proof is
  made in this package until the pre-open gate is explicitly authorized.

## Progress

- 2026-07-31: Design grill complete (14 rulings). Gate 1 approved. Worktree `trees/kb-graph-stack` created from `kb-poc` @ `38625cbbf` on `feat/kb-ingestion-refresh-event`. ADR 0001 written, `docs/domain-model.md` KB section rewritten to the rulings, roadmap W9 row revised.
- 2026-07-31: `ed2cba55d` on L1 — this plan, ADR 0001, and the roadmap revision; later L1 implementation is tracked below.
- 2026-07-31: `068241088` on L2 — Patrick's `packages/knowledge-graph` (15 files) and `packages/types/src/knowledgeGraph.ts` ported verbatim, authored as him. Does not typecheck alone; identity still resolves through `ChatbotKnowledgeGraph`.
- 2026-07-31: The original L2 model refactor introduced `KBGraphBuild` + KB pointers, migration `20260731200443_kb_owned_knowledge_graph`, on-demand digest, per-build graph names, and the inverted publication rule. Its source tip passed workspace `check` (26/26), `syncpack:lint`, Prettier, and 67 package tests; revalidation after L1 propagation is pending. `apps/analytics` lint failed in-container on a `uv`/pandas source build — environmental, pre-existing, and untouched by this layer (its lint is `ruff`, which never reads `.prisma`).
- 2026-08-01: L1 implementation started after adopting the approved native stack (`kb-poc ← feat/kb-ingestion-refresh-event ← feat/kb-graph-model`). The focused real-PostgreSQL webhook baseline passes 17/17 in the managed DevPod. The broader `test:local` bootstrap remains unavailable there because its Docker-based harness cannot find a Docker client.
- 2026-08-01: L1 implementation complete locally. Signed `resource.content_refreshed` events append an operation-correlated terminal ledger row and advance only non-stale active serving state, leaving a concurrent lecturer attempt intact; repeat delivery is serialized and deduplicated. Focused real-PostgreSQL webhook coverage passes 20/20, `@klicker-uzh/graphql` typecheck passes, the full production build passes 22/22 packages, and the documentation bundle is OKF core-conformant. `pnpm run check:all` remains blocked only by the known unrelated analytics lint environment: `uv` cannot build `pandas==2.2.2` without a C compiler.
- 2026-08-01: Independent L1 review found that a platform-refresh ledger row could displace a concurrent lecturer attempt in the polled resource projection. The connection and its status filter now dereference `KBResource.ingestionAttemptId`; focused real-PostgreSQL `knowledge.test.ts` plus `knowledgeWebhooks.test.ts` pass 73/73 and GraphQL typecheck passes.
- 2026-08-01: Separate simplification review over `ed2cba55d..35988b8d2` found no actionable reduction. Gate 2 is approved and L2 is rebasing onto L1; revalidation is pending.
- 2026-08-01: L2 rebased cleanly onto L1. Its R2 digest now follows every non-deleted `activeContentSha256`, not the latest resource status, so a queued or processing replacement cannot omit its still-serving revision. The graph package passes 68 focused tests and typecheck; Prisma sync, workspace `check` (26/26), syncpack, Prettier, documentation validation, and the production build (23/23) pass. Workspace lint remains blocked only by the known analytics `pandas==2.2.2` C-compiler environment failure. Independent L2 review and simplification remain pending.
- 2026-08-01: Independent L2 review required the reader to reject a pointer to a foreign or non-successful build and Turbo to retain `KB_FALKORDB_*` configuration. The follow-up adds queued, failed, and foreign-pointer coverage (71 graph tests), records the pointer invariant in `klicker-data-model`, and aligns the per-build graph-name and bounded-retention contract. Focused tests, workspace `check` (26/26), documentation validation, and the production build (23/23) pass; separate L2 simplification remains pending.
- 2026-08-01: Separate L2 simplification review found no actionable reduction. The only unrun L2 proof is applying `20260731200443_kb_owned_knowledge_graph` to a disposable PostgreSQL database: the normal Docker-based local harness has no Docker client in this DevPod, so no shared development database was touched.
- 2026-08-01: L3 started. Patrick's existing direct external-Hatchet workflow is the dispatch seam being adopted, not replaced. Companion branch `feat/kb-graph-manifest-contract` in `/Users/rschlae/Git/klicker/lightrag/trees/feat-kb-graph-manifest-contract` will add the backward-compatible pinned-hash and deterministic-GraphML contract before the Klicker adapter is re-homed to KB ownership.
- 2026-08-01: L3 implementation is prepared on `feat/kb-graph-lifecycle`: KB-owned GraphQL rebuild/status/read operations, build-local source snapshots, pinned external Hatchet manifests, private-blob SAS URLs, timeout and late-success reconciliation, deterministic GraphML/FalkorDB retention, worker/chart configuration validation, and the LightRAG companion contract are in place. The adopted runtime seam remains direct Hatchet status polling because no authenticated inbound graph callback contract exists yet; the cron monitor is the reconciliation path. Focused Hatchet tests pass 73/73, knowledge-graph tests pass 72/72, workspace check/lint/build pass (26/26, 6/6, 23/23), Prisma sync, syncpack, AGENTS, and changed-file formatting pass; full-tree formatting still reports five unrelated generated `next-env.d.ts` files. Migration apply and live external integration remain unverified because this DevPod has no Docker-backed local harness and no live services were touched.
- 2026-08-01: L3 follow-up hardens the lifecycle boundary: timed-out and graph-retention windows rotate, retention claims the build before external deletion and uses explicit NULL-safe pointer guards, late success rechecks under a KB row lock and cannot race a cleanup claim, soft-deleting a KB clears its published graph pointer, and the v3 chart wires optional non-secret FalkorDB settings to both GraphQL and the general worker. The async-worker catalog now documents all six local workflows. Focused Hatchet coverage remains green after the hardening; migration application and live external integration are still intentionally unverified.
- 2026-08-01: Final L3 review found a digest race through resource-refresh webhooks. Late-success reconciliation now locks the KB and every live resource row before recomputing the pinned digest, while the worker reuses the locked KB projection and the shared GraphQL build select. Graph dispatch now fails Helm rendering without a FalkorDB host, and the general worker validates the complete FalkorDB config when graph integration is enabled. Hatchet tests pass 74/74; chart lint, configured/missing-host renders, changed-file formatting, and package typechecks pass. The webhook-primary R5 callback remains deferred because no authenticated external callback contract is available; direct status polling is the current seam. Migration application and live external integration remain intentionally unverified.
- 2026-08-01: The L3/L4/L5 takeover is reconciled on `feat/kb-graph-lifecycle`, preserving the parked branch as the merge parent. The pinned external builder contract at `f6cb38b` passes `uv run pytest` with 61 passed and 1 skipped. The target now has KB-owned graph config/rebuild/read GraphQL wiring, a dedicated lecturer card and Cytoscape viewer, and a student viewer resolved through the chatbot's enabled KB binding; the obsolete chatbot-owned graph GraphQL/UI/migration surfaces are not carried forward. Focused chat graph tests pass 41/41, the repository check passes 35/35, and affected lint passes with only five pre-existing chat warnings. Migration application, Docker-backed cross-repo stack/browser screenshots, live FalkorDB/Blob/Hatchet integration, deployment, and external publication remain unverified by design.
- 2026-08-02: Independent Git-level union verification confirms parked tip `9b5fc7af2` is an ancestor of `feat/kb-graph-lifecycle` through merge `bc6262f65`; both `b4a99893c..9b5fc7af2` and `b4a99893c..HEAD` pass `git diff --check`. The current DevRouter status reports the router and Docker unavailable, so disposable migration, cross-repository runtime, and browser screenshot evidence remain open; no local stack was started.
- 2026-08-15: The first M1 W2 correction pass completed through `c1358a2db`. The
  committed W2 range includes quota/lifecycle seams (`567cad080`,
  `a52d1cb18`, `a32648781`, `7ca0ff21f`, `18dce8eba`) and the final-review
  correction (`c1358a2db`). The correction revalidates the kill switch, KB
  opt-in, and complete reservation before external dispatch; fences
  pre-accounting rows and cleanup-claimed late success; rejects zero-value cost
  readiness; presents maximum cost and localized reservation status; isolates
  opt-in refresh failures; and adds release/cleanup accounting coverage.
  Prisma migration deployment to disposable databases, focused GraphQL
  accounting (5/5), cost (6/6), Hatchet (16/16), GraphQL, Hatchet, and
  kb-management checks, the root pre-commit suite (26/26), and staged secret
  scanning are green. Browser evidence remains deliberately limited to the
  synthetic empty/unconfigured EN/DE desktop/mobile state; enabled, active,
  settled, held, published, stale, failure, available, and student-visibility
  states still require a live-stack proof. Provider callback authentication
  and live external graph execution remain outside this package.
- 2026-08-16: W2 final-review corrections are implemented in
  `810ce4edb4768403a1326b0e400a1623136f2520`: valid metered non-success
  results now settle actual usage without publication; the worker validates
  every persisted reservation field and linked quota identity before the
  external effect; W1 counters and aggregate usage are bounded to PostgreSQL
  `INTEGER`; quota currency/limit drift is reported as unavailable while
  historical build cost stays separate; and the generated GraphQL contract,
  wiki, and task skills are synchronized. Real-PostgreSQL accounting passes
  7/7, pure contract/config passes 24/24, Hatchet passes 17/17, and the root
  pre-commit suite passes 26/26. The implementation tip above is the review
  base; this plan update is docs-only and does not change the package
  boundary. Browser proof remains limited to the previously recorded empty,
  unconfigured synthetic state, and live external execution remains outside
  this package.
