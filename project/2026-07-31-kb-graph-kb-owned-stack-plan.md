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

- **Schema.** Drop `ChatbotKnowledgeGraph`. Add `KBGraphBuild`, an append-only attempt ledger mirroring `KBIngestionRun` (client-supplied uuid id = idempotency key; `status`, `qualityTier`, `sourceContentDigest`, `graphName`, `graphmlBlobName`, `externalOperationId`, `externalStartedAt`, `statusMessage`, `errorCode`, `startedAt`, `finishedAt`). On `KB`, two plain uuid columns following the `ingestionAttemptId` precedent — `activeGraphBuildId` (the single-slot claim target for R1) and `publishedGraphBuildId` (what FalkorDB currently serves, R11). Enums `KBGraphBuildStatus` (QUEUED/PROCESSING/SUCCEEDED/FAILED/SUPERSEDED — timeouts are FAILED with an error code, keeping the enum aligned with `KBIngestionStatus`) and `KBGraphQualityTier`. Fresh migration; the parked `20260720150000_chatbot_knowledge_graph` is not ported.
- **Digest (R2).** Compute over the active serving set — `resourceId` + `activeContentSha256` of every non-deleted resource with an active hash — on demand, no column on `KB`. A pending replacement never suppresses the revision still serving RAG.
- **Identity.** `getKnowledgeGraphName(kbId, buildId)` → `klickeruzh:kb:<kbId>:<buildId>`; each completed build records its own graph name, while `graphSession` and `getPublishedKnowledgeGraph` are re-scoped to `kbId`. These are the only three seams the reader exposes.
- **Publication rule (R11).** The parked rule returned `DIRTY` = not published. Invert it: a build whose digest no longer matches the KB still serves; staleness is a label, not an outage.

`docs/domain-model.md` lands with this refactor, where its prose becomes true. Green at its own tip: `check`, `lint`, and the package's vitest run in-container.

**L3 `feat/kb-graph-lifecycle`** — re-home Patrick's direct external-Hatchet graph workflow dispatch to the KB-owned pinned manifest (R4), reconciliation (R5), timeout release, GraphML export plus retention sweep of only unreferenced, non-active/non-published graph names in `kbMaintenance` (R12), quality-tier config mapping (R7); GraphQL status/rebuild/read ops re-pointed at the KB with KB-edit authorization. The companion LightRAG branch extends that existing external workflow to verify each pinned source hash after extraction and write the deterministic GraphML artifact; it does not introduce a new graph-generation service.

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
