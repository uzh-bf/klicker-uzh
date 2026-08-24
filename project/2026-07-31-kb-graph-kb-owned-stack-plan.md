# W9 — KB-owned knowledge graph (stacked)

Roadmap: [2026-07-24-kb-production-v1-roadmap-plan.md](2026-07-24-kb-production-v1-roadmap-plan.md), package W9.
Decision record: [ADR 0009](../docs/adr/0009-kb-owns-two-derived-projections.md).
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

- `docs/superpowers/**` (6) — design docs for the rejected chatbot-owned architecture, superseded by ADR 0009 and preserved in PR #5206.
- `project/screenshots/*chatbot-knowledge-graph*` (4) — verification screenshots of the chatbot-owned UI, replaced by fresh ones at L4/L5.
- `packages/prisma/.../20260720150000_chatbot_knowledge_graph/migration.sql` — creates `ChatbotKnowledgeGraph`; the KB-owned migration is written fresh at L2 rather than created and then dropped.

## Layers

Each layer is independently functional, independently reviewable, green at its own tip. Drafts until actionable. No merge, un-draft, or deploy without explicit authority.

**L1 `feat/kb-ingestion-refresh-event`** — new platform-initiated refresh event type in `packages/graphql/src/services/knowledgeWebhooks.ts`; ledger row from the platform operation id; serving-identity advance; attempt-scoped guards preserved for lecturer-initiated runs. Carries this plan, ADR 0009, and the roadmap W9 revision. No parked equivalent — new work. Ships value alone: keeps RAG current regardless of graph work.

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
  (materialized in the read-only clone `/tmp/klicker-v3-review.THD0dw` on
  2026-08-16).
- Current implementation tip: `1245ba6102659f11d92d256dc4790a36daf5d779`.
- Current local comparison: 145 commits ahead and 81 behind the stale local
  `origin/v3`. Shared Git metadata still rejects `FETCH_HEAD` writes, so the
  exact target was reconciled through the read-only clone without changing
  refs.
- Local `origin/v3` is stale at `2bcaddabe3bf3b39e23e71e7cf3eda7179f6291f`;
  it is an ancestor of the exact target. The target range contains only
  `9222929ad` (`chat`: structured video citations), and the scoped W2 paths
  have no target delta. W2 therefore needs no rebase or merge for this target;
  preserve the dirty primary checkout and this worktree's intentional
  docs/ADR changes.
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

- 2026-07-31: Design grill complete (14 rulings). Gate 1 approved. Worktree `trees/kb-graph-stack` created from `kb-poc` @ `38625cbbf` on `feat/kb-ingestion-refresh-event`. ADR 0009 written, `docs/domain-model.md` KB section rewritten to the rulings, roadmap W9 row revised.
- 2026-07-31: `ed2cba55d` on L1 — this plan, ADR 0009, and the roadmap revision; later L1 implementation is tracked below.
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
- 2026-08-16: The exact target `v3` ref was reconciled in a read-only clone:
  stale local `origin/v3` `2bcaddabe3bf3b39e23e71e7cf3eda7179f6291f` is an
  ancestor of target `9a82e7fa63ba6b0f6b373470e3d6b77ae265d371`; its only
  intervening commit is the chat-only `9222929ad`, with no W2-scoped path
  delta. W2 correction commit `22a13576e` adds the durable dispatch claim and
  ambiguous-acceptance hold, locked matching/stale/superseded timeout
  reconciliation, current-quota-currency presentation, and the disposable
  migration plus real-PostgreSQL seam tests. The local hook passes 26/26,
  focused Hatchet passes 80/80 across its four files, focused accounting
  passes 10/10 on PostgreSQL, and the package checks pass. Browser evidence
  remains limited to the previously recorded synthetic empty/unconfigured
  state; no provider run, cluster access, merge, push, or deployment occurred.
- 2026-08-16: W2 final-review follow-up is committed in `045c01c11` and
  `1245ba610`. The first commit wires the external Hatchet terminal-result
  fetch and GraphQL settlement adapters into the backend, general worker, and
  scheduled script compositions, closes dispatch-claim compensation races, and
  validates late-success accounting before claiming publication. The second
  retains the active KB build slot for an accepted-but-uncorrelated provider
  run and refuses a second rebuild until recovery, cancellation, settlement, or
  manual resolution; the regression is covered in the GraphQL integration and
  Hatchet tests. Hatchet passes 83/83, the PostgreSQL-backed knowledge and graph
  accounting tests pass 66/66, all four affected package checks pass, the root
  hook passes 26/26, and staged secret scanning is clean. W3's corrected
  transfer ledger is committed at `48ba5ff093439b61f5d5165f42ddd8287089c436`;
  its focused suite passes 34/34 with Ruff, Pyrefly, catalog-sync, ShellCheck,
  and shell syntax checks. The W3 repository's four unrelated pre-existing
  dirty paths remain unstaged. Independent final review of W2 range
  `eb4c0fd546b94a73068a4ae2e3226682f1103c85..e851e1deb` and W3 range
  `06d55a4cc7b86bdda86adeab2238d5de56ad16c2..48ba5ff093439b61f5d5165f42ddd8287089c436`
  passed with no findings. The reviews confirmed the terminal-result wiring,
  dispatch and ambiguous-acceptance fences, late-success accounting, newest
  attempt visibility, active-content digest contract, stable named evidence,
  and mutation/retry semantics. Residual verification limits remain browser
  proof, live provider execution, worker-process startup, migration
  application, cluster access, merge, push, and deployment.
- 2026-08-16: W2-B/W2-C runtime verification was attempted without changing
  code or external state. `devrouter status --json` reported the router, TLS,
  shared network, and eleven-route repository configuration healthy, but the
  exact `devrouter ensure .` retry reached the named worktree and failed while
  Docker Compose tried to attach a referenced missing network. The managed
  route returned `502`; no browser session or screenshot evidence was produced.
  The failed exact runtime was stopped with `devrouter stop .`, and the second
  ensure attempt reproduced the same environment blocker. Migration application,
  worker startup, provider execution, cluster access, merge, push, and deployment
  remain unverified; repair the exact DevPod/network and rerun W2-B/W2-C before
  treating M1 as complete.
- 2026-08-16: The requested runtime retry found the real root cause and caused
  a cross-workspace dev-database incident. A Docker daemon restart about six
  hours earlier left this workspace's `postgres`, `redis_*`, and `mailhog`
  containers attached to no Docker network, while the shared `devnet` resolves
  the bare name `postgres` to four sibling workspaces' Postgres containers.
  Repeated `devrouter ensure .` retries recreated the app container, and each
  recreation re-ran `.devcontainer/post-create.sh`, whose `prisma migrate reset
  --skip-seed --force` plus `db push` therefore executed against sibling
  databases. Read-only inspection confirms the `klicker-prod` databases of
  `trees/pr5134-b2-ui`, `trees/fix-chat-recovery-e2e-selector`,
  `trees/chat-history-rail`, and the
  `.claude/worktrees/klicker-uzh-ux-accessibility-32b832` worktree now carry
  this branch's `20260816120000_kb_graph_dispatch_claim` migration and were
  reset to this branch's schema; this workspace's own database was untouched
  (its newest migration remains `20260815190114_kb_graph_cost_accounting`).
  The exact runtime was halted with `devrouter stop .`; DevPod reports
  `Stopped`, every project container is exited, and zero routes remain for
  `feat-kb-ingestion-refresh-event`. One stale hatchet container (created
  against the deleted compose network) was removed and recreated during the
  retries; its named config/token volumes were preserved. No browser evidence
  was produced; W2-B/W2-C verification stays blocked pending (1) explicit
  approval to recreate this workspace's network-detached `postgres`, `redis_*`,
  and `mailhog` containers before any further `ensure`, and (2) a ruling on
  remediating the four sibling dev databases (each can rebuild via its own
  worktree's post-create reset/reseed, which is itself destructive).
- 2026-08-16: Both approved repairs are complete. Each affected sibling
  database was rebuilt from its own worktree code with `DATABASE_URL` pinned
  to its own postgres container name (no DNS ambiguity):
  `fix-chat-recovery-e2e-selector` and `chat-history-rail` at
  `20260721193705_chat_message_rating`, the ux-accessibility worktree at
  `20260706151837_add_verifiable_credentials`, and `pr5134-b2-ui` at
  `20260815180000_live_quiz_pending_response_generation`; all four verify
  with 5 users and 52 participants, and `pr5134-b2-ui`'s containers were
  returned to their prior stopped state. Recorded contamination events
  (UTC): rs-917c1 20:02, rs-0f6d6 20:05, rs-497d8 20:07, cl-7d302 20:18 and
  20:32. The 22:32 re-attempt proved `devrouter ensure` keeps appending the
  localhost overlay on re-up (postgres `127.0.0.1:5432` conflicts with
  devrouter Traefik's `0.0.0.0:5432`), which recreated the app and re-ran
  post-create against a sibling once more before the runtime was halted.
- 2026-08-16: This workspace's stack was recovered under direct compose
  control and is fully verified. Six stale-network containers were removed
  and recreated with `docker compose -p default-fe-625ea` over only
  `docker-compose.yml` + `docker-compose.devrouter.yml` (workspace env set,
  no localhost overlay); the app's `DATABASE_URL`, `SHADOW_DATABASE_URL`, and
  `LTI_DB_HOST` are pinned to `default-fe-625ea-postgres-1` via
  `/tmp/kb-graph-pin-db.yml`. Our database was reset and seeded from this
  branch (latest migration `20260816120000_kb_graph_dispatch_claim`, 5 users,
  52 participants); in-app `postgres` DNS resolves to exactly this stack's
  default-network IP. Hatchet migrated and minted its client token; dev
  processes run through the canonical `post-start.sh` with the devrouter
  process helper copied from a healthy sibling container; all 11 routes were
  reconciled via `devrouter app run`. Host proof: manage returns 200, the
  API returns its expected CSRF 403 for an unauthenticated curl POST, and the
  general worker executed `monitor-kb-graph-builds` successfully. Do not run
  `devrouter ensure` for this worktree until the overlay bug and the shared
  devnet bare-`postgres` alias hazard are fixed upstream; the runtime stays up
  under an explicit lease for the approved W2-B/W2-C browser verification,
  whose screenshots are the next open evidence.
- 2026-08-17: W2-C student-view evidence captured. Root cause of the earlier
  hydration hang is fixed and recorded in the roadmap: the worktree shipped a
  stale `allowedDevOrigins: ['**.klicker.localhost']` in
  `packages/next-config/index.js` (predates upstream fix in #5248), which
  blocked the dev HMR WebSocket for the four-label worktree host; Next's
  app-router hydration decoder waits on the HMR debug channel, so the page
  hung pre-hydration. Applied the upstream pattern
  (`allowedDevOrigins: ['**.localhost']` in development) to the worktree
  file only (uncommitted; commit needs approval). Stack restarted, chat
  hydrates, all instrumentation restored. W2-C: minted a chat-guest JWT
  (HS256, `CHAT_GUEST` scope, 14d) for testuser1 in the container from the
  chat dev process env, set as host-only `chat_participant_token` cookie,
  and captured
  `w2c-kb-graph-student-graph-unavailable-en-desktop.png` (Benibot → KB
  graph, guest session, desktop 1440×900): graph workspace renders the
  graceful "Knowledge graph temporarily unavailable" state with Retry,
  search, and zoom controls — expected with FalkorDB absent (partial
  evidence; graph unavailability, not a healthy graph). Contract readback:
  with the published binding enabled, plain-Node probe of
  `getPublishedKnowledgeGraphForChatbot` resolves to
  `10000000-...-0004` build `20000000-...-0004` (isStale false) and the
  overview read fails with `KB_FALKORDB_HOST must be a non-empty value`
  (503 source). Unbinding (isEnabled=false) makes the same probe throw
  `KnowledgeGraphNotPublishedError` code EMPTY (409 source), and the
  binding was restored to enabled afterward (verified). Caveat: the live API
  degrades every graph error to 503 in this dev runtime because Turbopack
  cannot load `@klicker-uzh/knowledge-graph` via `createRequire`
  ("Cannot find module as expression is too dynamic"), so
  `isKnowledgeGraphNotPublishedError` never matches in dev; the 409 branch
  is unreachable in this environment but proven correct by direct probe.

- 2026-08-17 (merge + relaunch): Integrated v3 through #5420 (tip
  `3fd5259ad`, base `3872caee7`) into this worktree and merged into
  `feat/kb-graph-lifecycle`. v3 does NOT contain the KB schema or
  chat-graph UI — the feature remains branch-only; every conflict was v3-ai
  reintegration lineage. Took v3 side for ~20 pure-lineage files
  (shared-components questions, schema/resource.ts, seedChatbots, codegen
  outputs, chatStore reset, tool-fallback, credits routes, assistant reset
  base); unioned turbo.json, chat/hatchet/prisma-data package.json,
  devcontainer.env, post-start.sh, app-sidebar.tsx (Guest badge + graph
  switch + v3 header), chatStore.ts (v3 participation refactor + re-added
  `setParticipationRequired` for KG), assistant.tsx (rebuilt from v3 base +
  re-added `useChatGuestTokenBootstrap`, authedFetch disclaimers,
  graphMode + ChatGraphModeSwitch + ChatKnowledgeGraphWorkspace),
  docs/log/ -> v3 per-batch convention. Commit 1 `7882bccc3`. Kept our KB
  docs sections and v3's course-duplication. During codegen, the merge
  dropped our `enabledKnowledgeBase` field on Chatbot (I took v3's
  resource.ts); orphan op `QGetChatbotsInfo` referenced it. Re-added the
  Pothos type + field to packages/graphql/src/schema/resource.ts (resolve
  `chatbot.enabledKnowledgeBase ?? null`; service already maps
  `knowledgeBases[0]?.kb`) and regenerated — commit 2 `919d22f54`;
  graphql build EXIT=0 (only non-fatal circular-dep warnings). NOTE: the
  service returns enabledKnowledgeBase only when knowledgeBases is loaded —
  verify chat/manage resolvers include .knowledgeBases. Combined pnpm
  install kept OOM-killing the app container (its cgroup, not host RAM);
  containers rebuilt via `docker start` and install succeeded with
  `--child-concurrency=1 --network-concurrency=4`. Relaunched pipeline via
  explicit post-start.sh (NEVER `devrouter ensure` — overlay bug). All
  apps Ready (3001-3004, 3010), graphql build green, hatchet workers up.
  Runtime left RUNNING under the current lease for user self-test (user
  asked to keep it up). Expected dev-only errors: worker
  `KB_GRAPH_HATCHET_CLIENT_TLS_STRATEGY must be configured` (no external
  graph builder wired — no .local-kb-services.env, no UPSTREAM_OPENAI_API_KEY,
  no FalkorDB), Langfuse no-op exporter warnings, LTI
  MISSING_PLATFORM_URL_OR_CLIENTID.
- 2026-08-17 (KG data seeding): Confirmed there is NO prebuilt graph data to
  seed. No *.graphml fixtures anywhere in the repo; local Azurite blob store
  (default-fe-625ea-azurite-1) is EMPTY — the two SUCCEEDED KBGraphBuild rows
  (kb-graph/synthetic-0004/0005.graphml) are record metadata only, with no
  blob artifact. No FalkorDB container is running; graph data is written
  directly to FalkorDB by the external Catalyst `kg-content-generation/
  lightrag_research` stack (bridge contract export_to/n_graph_name), not by
  Klicker from GraphML. Klicker only reads (client.ts FalkorDB.connect) and
  removes graphs/artifacts (kbMaintenance cleanup). ADR 0010's "GraphML
  archive recovers FalkorDB" is an operational recovery concept (re-run the
  external builder from archived GraphML), NOT an in-repo import API. So
  seeding a real student-visible graph requires running the external
  lightrag/FalkorDB stack (util/configure-local-kb-graph-builder.sh), which
  is not set up here. The 5 synthetic KBs + SUCCEEDED builds exist in the DB
  (verified) purely to render the empty/active/failed/published/stale UI
  states; without FalkorDB the student graph view shows the graceful
  "temporarily unavailable" state (W2-C evidence).

## 2026-08-23 finalization amendment — single PR #5424 landing

The user superseded the earlier five-PR delivery topology for this package.
[PR #5424](https://github.com/uzh-bf/klicker-uzh/pull/5424) is now the sole
integration line and the first KB PR to land on `v3-ai`. PR #5174 is its
ancestor, PR #5078 remains selective reference material, and the question
generation PRs remain under their existing owner. Question generation consumes
the canonical `KBGraphBuild` ledger after a build is succeeded and published;
it does not introduce a separate `KBGraphVersion` lifecycle or webhook.

### Frozen integration refs

- Clean worktree: `trees/rs/kb-v3-ai-finalization` on
  `rs/kb-v3-ai-finalization`.
- Target: `origin/v3-ai` at
  `3425cebb41c6f92a0c6be64e4325382205e9619c`.
- PR head: `origin/feat/kb-graph-lifecycle` at
  `599ffcd155377f9a24e8688e16af685674d29682`.
- The frozen head is 158 commits ahead and one commit behind the target. Recheck
  both refs before publication and stop for review if either changes.

### Integration and corrective slices

1. **I1 — integrate current `v3-ai`.** Merge the frozen target into the clean
   finalization branch. Seven files changed on both sides. Four require manual
   conflict resolution: preserve the local KB/Azurite setup alongside current
   MCP and LiteLLM documentation in `.devcontainer/README.md`; keep the generic
   dependency build plus the knowledge-graph changed-path trigger in
   `.github/workflows/test-chat.yml`; retain auth, client-auth, and public-URL
   entries in `packages/util/rollup.config.js`; and keep the current
   `suggestions` naming in `playwright/tests/Y-manage-assistant.spec.ts`.
   Inspect the three automatic merges in `.devcontainer/devcontainer.env`,
   `.devcontainer/post-start.sh`, and `docs/chat-platform.md` before committing.
2. **B1 — restore backend ingestion routes.** Mount the authenticated GET source
   gateway and raw-body POST ingestion webhook before end-user JWT middleware.
   Add service-free route tests and CI execution for successful forwarding,
   invalid input/content type, and generic failure responses.
3. **B2 — keep new-thread token scope stable.** Preallocate one UUID for a new
   chat thread, mint the MCP scope token with that UUID, and persist the same ID
   only after required-MCP availability succeeds. Preserve no-thread-on-MCP-
   failure behavior and cover first-turn and existing-thread ownership cases.
4. **B3 — bound graph reconciliation.** Reuse the rotating monitor window for at
   most 32 active builds, process at concurrency eight, and apply a ten-second
   timeout to every provider operation awaited by the sweep. A timed-out call
   leaves correlated state fenced for a later retry; independent builds continue.
5. **B4 — complete safe local-runtime wiring.** Selectively reimplement only the
   relevant semantics from `8fa7ea50d` and `09ac131d8`: overridable loopback-
   bound graph and ingestion ports; host-reachable Azurite source URLs through
   `KB_GRAPH_BLOB_ACCOUNT_URL`; HTTP SAS URLs only for loopback or `.localhost`;
   optional explicitly configured shared PostgreSQL ingestion state while
   keeping SQLite as the default; and matching tests, docs, env, post-start,
   ignore, and Turbo wiring. Do not copy model IDs or unrelated dirty runtime/UI
   work. Preserve the user-owned dirty `trees/kb-graph-stack` unchanged.
6. **B5 — add graph interaction selectors.** Add stable `data-cy` hooks to the
   graph search submit, search results, loaded nodes, relationships, and close
   action without changing interaction behavior.
7. **B6 — align owner-only authorization guidance.** Clarify the GraphQL wiki
   and matching API skill: KB aggregates are owner-only and enforce ownership
   inside the service; `withPermission` remains required for shareable
   aggregates supported by `PermissionCheck`. Do not widen KB sharing. Record
   the behavioral/documentation changes in the dated wiki log.

### Verification and publication boundary

- Run each focused package suite, route tests, type checks, generation where
  needed, root `check:all`, the production build, and `git diff --check`.
- Start the exact finalization worktree through DevRouter. Verify the affected
  lecturer graph interactions and first-turn chat scope path with delegated
  local login, capture required screenshots, then stop that exact runtime and
  prove zero remaining routes and a stopped provider workspace.
- Run simplifier and risk-selected slice review on substantive B1-B4 commits,
  then one final reviewer over the integrated verified branch.
- Publication authority covers normal push of the exact finalization commits to
  `feat/kb-graph-lifecycle`, PR #5424 body/readback updates, reviewed Sonar thread
  disposition, and exact-head CI monitoring. Force-push, merge, close, deploy,
  external ingestion/platform mutation, and sibling PR changes remain withheld.
- GitGuardian incidents are classified separately using names/statuses only.
  Stop if classification requires incident values, credentials, or new
  administrative authority. The hardcoded private CIDRs in `publicUrl.ts` are
  intentional SSRF denylist entries and are documented as Sonar false positives.

### Progress

- 2026-08-23: Ref freeze and independent plan review completed. The review
  confirmed three merge blockers at the frozen head: the source and webhook
  handlers are not mounted, a first-turn MCP token uses the request ID rather
  than the eventual thread ID, and active graph reconciliation is unbounded and
  sequential. The seven-changed-path/four-conflict distinction is recorded
  above. No merge, push, PR mutation, deployment, or sibling worktree mutation
  occurred during this planning checkpoint.
- 2026-08-23: Corrective commits `4319bb4b3` and `7c2763742` close the two
  code findings from the final-package review. Graph and maintenance rotation
  now uses page-aligned starts, so non-multiple totals do not lose the wrapped
  portion of a 32-row window; graph-monitor and maintenance tests cover totals
  33 and 65. The development graph loader now uses a literal package
  specifier, and a direct Node 24 development import reaches the expected
  `EMPTY` publication error instead of failing module resolution. Exact Node 24
  focused Hatchet tests pass 99/99, chat typecheck passes, and the full Node 24
  production build passes 25/25 tasks. The host pre-push hook remains unusable
  for this branch because the host runs Node 26 while the repository pins Node
  24; the equivalent container build is the supported evidence. Exact
  authenticated browser screenshots remain open: the branch-local namespaced
  route could not be reconciled because the shared route ledger/TLS probe
  reports `curl (60) SSL certificate problem: out of memory`, so no browser
  success or screenshot is claimed. Runtime teardown remains required after
  the final runtime-dependent checks.
- 2026-08-23: Publication landed at head `30c3b0ee7` on
  `feat/kb-graph-lifecycle` (fast-forward through `0387560a8`); PR #5424
  readback matches this exact head and frozen target `v3-ai` is unchanged at
  `3425cebb4`. A formatting-only follow-up commit fixed the one drift CI found.
  Browser evidence remains open for a different reason than first recorded:
  the route itself serves correctly (curl reaches Traefik over HTTPS), but
  macOS curl cannot validate the oversized multi-SAN certificate, and both the
  in-app automation browser and sandboxed Chrome refuse every `*.localhost`
  origin with `ERR_BLOCKED_BY_CLIENT`, so no authenticated screenshot could be
  captured from this environment. Runtime teardown follows as the last step;
  merge/close/deploy authority stays withheld per plan.
- 2026-08-23: Publication completed. Normal push landed
  `feat/kb-graph-lifecycle` at `30c3b0ee7` (fast-forward from the frozen head;
  target `v3-ai` unchanged at `3425cebb4`). The first push failed CI file
  formatting on a biome drift in `kbHttpRoutes.test.ts`; fixed in commit
  `30c3b0ee7` and re-pushed. Exact-head CI now passes 26/26 workflows with zero
  failures (codebase check, types, graphql/chat/hatchet/MCP tests, Playwright
  E2E, CodeQL, SonarCloud, gitleaks, stg image builds). Remaining open:
  authenticated browser screenshots (TLS/curl route-reconciliation blocker,
  documented above) and runtime teardown.
- 2026-08-23: Runtime lifecycle closed. The exact checkout
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/rs/kb-v3-ai-finalization`
  (DevPod workspace `rs-kb-v3-ai-finalization`, provider docker) is
  `stopped`: `devpod status` reports Stopped, all nine task containers
  (app, hatchet, postgres, litellm, three redis, azurite, mailhog) exited,
  and the devrouter route ledger carries zero routes for this workspace.
  No deletion was performed. Merge/close/deploy authority remains withheld
  per plan; the plan and log record the browser-evidence limitation instead
  of claiming screenshots.
- 2026-08-24: Sol recommended merging the current target into the published
  PR head instead of rebasing its 174-commit history. The merge reported 29
  manual conflict paths (the earlier inventory's “30” was a counting error),
  and the resolutions preserve both the KB graph/MCP lifecycle and current
  `v3-ai` feature-flag, assessment, and API changes. Generated GraphQL
  artifacts and `pnpm-lock.yaml` were regenerated. Local merge commit
  `703d026ac` has parents `8eee6f084` and `8e23a7bd1`; it is not pushed, so
  PR #5424 remains at its published head. Root `pnpm run check` passed 29/29
  tasks; focused KB GraphQL, knowledge-graph, Hatchet, util, backend, and chat
  suites passed (95, 72, 99, 5, 6, and 590 tests respectively), and
  `pnpm run format:check` passed. The GraphQL `test:local` wrapper still needs
  a Docker CLI unavailable inside the DevPod; direct focused suites pass.
  `pnpm run check:all` remains blocked only by the analytics Python
  environment needing a compiler to build pandas, and the full build reached
  24/26 tasks before the manage frontend was killed with exit 137 during page
  data collection. The host commit hook also remains unusable under Node 26;
  the equivalent Node 24 container checks passed. Browser screenshots remain
  unavailable under the documented TLS/browser restriction. No push, PR
  merge, close, deploy, or sibling worktree mutation occurred.
- 2026-08-24: Sol's final review identified four GrowthBook/ADR findings as
  target-owned baseline concerns: they are present on `origin/v3-ai` but are
  outside the `origin/v3-ai..HEAD` PR diff, so this reconciliation made no
  sibling or target-branch changes for them. The review also found one actual
  conflict-loss omission; the Prisma seed-reconciliation test row is restored
  in the verification skill. PR-owned graph corrections are committed in
  `c92d89cb9`: timed-out provider operations remain counted until their
  underlying promises settle, and `127.example.com` is rejected as a fake
  loopback host while real loopback literals remain available for local use.
  The Hatchet package check and complete package suite pass (101/101), the
  focused regression suite passes, and repository formatting plus diff checks
  pass. The restarted runtime hit the existing TLS/route-readiness
  `curl (60) ... out of memory` limitation and the shared lifecycle lock
  prevented `devrouter exec`; equivalent checks ran directly through the
  already-running task DevPod. No push, PR merge, close, deploy, or sibling
  worktree mutation occurred.
