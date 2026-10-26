# W5 S5: Klicker consumer for typed, evidence-linked graph relations

Status: draft for approval. Approval mode: `executable batch`.
Contract: Catalyst ADR knowledge-graph/0001 and the Catalyst W5 plan
(`docs/project/knowledge-graph/2026-10-19-w5-typed-evidence-linked-relations-plan.md`,
slice S5). Roadmap: [KG quality roadmap](./2026-09-12-kg-quality-roadmap.md), W5.

## Approval summary

The generator can now write two scalar properties on every `RELATED` edge,
`relation_type` and `relation_status`, and a server-only
`internal_evidence_refs` property (`resourceId|page,page;…`) on concepts and
relations. The generator flag stays off until Klicker can consume them. Today
Klicker would show the new properties raw, and concept sources never resolve
because nodes carry generator chunk ids where Klicker expects resource ids.

This package makes Klicker read the two relation fields and the evidence
references on the server. The server resolves the references to the build's
own resources and pages, and returns them as typed GraphQL and chat payload
fields. The existing graph views show a relation type, an evidence status and
page-level sources. `contrasts_with` edges are drawn without an arrow. No new
UI framework or component is added.

Unchanged: graphs without the properties render as today and read as
`related`/`extracted`; their only visible change is the label "Related"
instead of "RELATED". Unknown or contract-breaking values fail closed to the
same reading. Graph queries, retrieval hints, the terminal result and
manifest schema 2, and the files of draft PR uzh-bf/klicker-uzh#6613 stay
untouched. `internal_evidence_refs` never leaves the server, and a test proves
it.

Two readings to confirm (recommendation in each):

- **Evidence index.** Klicker reads graph data only from FalkorDB and never
  the bundle. The generator folds `chunk_sources.json` into
  `internal_evidence_refs`, so Klicker resolves through that property.
- **Direction corrections.** Klicker has no lecturer correction path yet
  (W10). The generator already demotes a corrected typed edge to `related`.
  Klicker's duty is to render such an edge as plain `related`, which a fixture
  case proves.

Done when unit and contract tests pass, browser screenshots show a typed,
sourced graph in the lecturer and student views, and a draft PR into `v3-ai`
is open. Approval authorizes the commits, a push of the task branch, the draft
PR and screenshot upload. It withholds enabling the generator flag, paid model
calls, cluster access, marking ready, merge and reviewer requests.

## Execution details

### Evidence and binding contracts

Baselines: Klicker `origin/v3-ai` at `cf240ddb1e`; generator draft MR
kg-content-generation!47 at `54a46ac`, fixture
`lightrag_research/tests/fixtures/klicker_graph_rows/kg_relations_v1.json`
(synthetic, contract `kg-relations/v1`).

Klicker facts that bind the slices:

- `packages/knowledge-graph/src/queries.ts` reads nodes and edges with
  type-agnostic Cypher. Edge rows keep the stored orientation, which the
  generator export already sets from `kg_direction`. No query changes.
- `normalize.ts` `safeEdgeProperties` keeps every scalar edge property whose
  key does not match `SENSITIVE_PROPERTY_KEY`. The key pattern contains
  `internal`, so `internal_evidence_refs` is already dropped, but
  `relation_type` and `relation_status` would pass through and render raw in
  `KnowledgeGraphDetails` `PropertyList`.
- Node sources resolve `source_id` against the build's source map keyed by
  resource id (`publication.ts` `sources`). Generator `source_id` holds
  `<SEP>`-joined chunk ids, so nothing resolves today.
- `apps/chat/src/lib/server/knowledgeGraph.ts` `browserSafeEdge`,
  `browserSafeNode` and `browserSafeSourceReference` are explicit allowlists
  for the student payload.
- `KnowledgeGraphEdgeType` and `KnowledgeGraphSourceReferenceType` in
  `packages/graphql/src/schema/kbKnowledgeGraph.ts`; the three read ops
  `QGetKbKnowledgeGraphOverview`, `QGetKbKnowledgeGraphNeighbors`,
  `QSearchKbKnowledgeGraph` select edge and source fields explicitly.
- `knowledgeGraphCytoscape.ts` draws a target arrow on every edge.
- `KnowledgeGraphPanel.tsx` `toKnowledgeGraphResponse` (manage) and chat's
  `ChatKnowledgeGraphWorkspace.tsx` type guards copy or check every edge and
  source field explicitly. `client.ts` `normalizedEdges` gets no build
  sources today.
- `KnowledgeGraphViewer.tsx` renders `{source} → {target}` and `edge.label`
  in the relationship list.
- `apps/chat/scripts/seed-graph-e2e.mjs` already seeds a published graph for
  a disposable database (guarded, `SUCCEEDED` build, matching digest); see
  `docs/chat-platform.md`. It creates no `KBGraphBuildSource` rows, which
  evidence resolution needs.
- `packages/shared-components` has no test runner; its graph modules are
  tested from `apps/chat/test/knowledge-graph-state.test.ts`.
- Details-pane labels are English defaults in `knowledgeGraphLabels.ts`;
  manage passes none and chat overrides two. New labels follow that pattern.
- `readKnowledgeGraphSearchHints` and #6613's `graphAssistedDocQuery` call
  `normalizeKnowledgeGraphNode(row, sources)`; its signature stays.

### Consumer contract

| Edge input                                          | Klicker reading                                        |
| --------------------------------------------------- | ------------------------------------------------------ |
| No `relation_type` (legacy build)                   | `related` / `extracted`, rendered as today             |
| `relation_type` outside the ADR vocabulary          | `related` / `extracted`                                |
| `related`                                           | `related` / `extracted`, whatever the stored status    |
| Directed or symmetric type with `source`/`inferred` | that type and status                                   |
| Typed edge with a missing, unknown or `extracted` status | `related` / `extracted` (fail closed)             |
| `prerequisite_of` with `source`                     | `related` / `extracted` (breaks ADR 0001)              |
| `instructor` status                                 | unknown until W13, so `related` / `extracted`          |

- Values match exactly: lowercase, no trimming.
- GraphQL and payload fields are plain strings from this closed server-side
  vocabulary, not GraphQL enums. Enabling `instructor` in W13 is a one-line
  server change.
- Edges gain required `relationType`, `relationStatus` and `sourceReferences`;
  the server always fills them. Source references gain an optional `pages`
  integer list; `reference` stays.
- Evidence parsing: split on `;`, then on the first `|`. A resource id
  resolves only when it is in the published build's `sources`, so references
  can never name a resource outside the build. Pages are positive safe
  integers, de-duplicated and sorted, at most 50 per resource and 20
  resources per concept or relation; malformed parts are dropped. References
  for the same resource merge.
- Nodes use `internal_evidence_refs` when present and fall back to today's
  `source_id` lookup otherwise.
- `relation_type`, `relation_status` and `internal_evidence_refs` are removed
  from edge `properties`. Other raw properties keep today's behavior.
- Direction is the stored orientation. `contrasts_with` renders without an
  arrow, in the canvas and in the relationship list, and its details list the
  two concepts without From/To.
- Generator edges have no `label`, so `edge.label` falls back to `RELATED`.
  Wherever the views show `edge.label` (relationship list, details heading,
  aria label, ask selection), they show the relation-type label instead. The
  server's `label` field is unchanged. Legacy edges therefore read "Related"
  instead of "RELATED"; that is the only visible change for old graphs.
- The details pane's existing `Type` row shows the relation type instead of
  `edge.type`, followed by an evidence-status row and the source list.

### Primitive impact

| Primitive         | Disposition | Contract delta                                      |
| ----------------- | ----------- | --------------------------------------------------- |
| Graph relation    | extend      | `relationType`, `relationStatus`, `sourceReferences` |
| Source reference  | extend      | optional `pages`                                    |
| Concept           | unchanged   | `sourceReferences` now resolve                      |
| Retrieval hints   | unchanged   | —                                                   |

No Klicker ADR: Catalyst ADR knowledge-graph/0001 records the decision, and
the Klicker views make no new lasting product choice. `docs/` gets a short
update only if a knowledge-graph page describes edge properties.

### Test portfolio

| Risk / behavior                                                                    | Existing evidence              | Obligation      | Primary seam                                     | Distinct failure                           | Slice |
| ---------------------------------------------------------------------------------- | ------------------------------ | --------------- | ------------------------------------------------ | ------------------------------------------ | ----- |
| Fixture rows map to the consumer contract table, including legacy and demoted edges | `normalize.test.ts`            | extend existing | normalize over the pinned synthetic fixture      | typed edge misread or legacy edge relabeled | S1    |
| Evidence references resolve only to build sources, with pages; malformed parts drop | `normalize.test.ts`            | extend existing | normalize with a test-owned source map           | source from another resource or KB         | S1    |
| `internal_evidence_refs` never leaves the server                                    | `normalize.test.ts`, chat route test | extend existing | serialized normalize output for every fixture row; chat route allowlist | server-only evidence leaks to a browser    | S1    |
| New edge and page fields survive the chat allowlist, chat guards and manage mapper  | `knowledge-graph-route.test.ts`, `knowledge-graph-state.test.ts` | extend existing | chat route and state tests; typecheck for manage and ops | students or lecturers never see types      | S1    |

The leak proof sits in normalize, because GraphQL exposes edge `properties`
as an opaque `Json` blob, so a schema assertion would not test the path. For
every fixture row, the serialized normalized node and edge contain no
`internal_evidence_refs` or `internalEvidenceRefs` key, no `relation_*` key,
no raw reference text and no fixture chunk id. Every GraphQL and chat payload
is built from that output. The browser pass adds a network check.
`contrasts_with` arrow styling gets browser evidence, not a test that mirrors
the style rule.

The fixture's string ids are mapped to integers by a test-owned table, since
Klicker accepts only FalkorDB integer ids. Tests assert contract values and
key absence, never label prose. Details-pane copy gets browser evidence
instead of a test.

### Delegation map

| Workstream        | Slices | Owner    | Starts after | Done when                                  |
| ----------------- | ------ | -------- | ------------ | ------------------------------------------ |
| Server contract   | S1     | executor | approval     | S1 tests, typecheck and Biome green        |
| Views and proof   | S2, S3 | main     | S1           | screenshots captured, draft PR open        |

### Implementation slices

0. **Plan commit.** `docs(project): add W5 knowledge-graph relation consumer plan`.
1. **S1 — Typed relations and evidence through the server.**
   Route: executor. Files: `packages/types/src/knowledgeGraph.ts`,
   `packages/knowledge-graph/src/normalize.ts`, `client.ts` (pass build
   sources to edges), `packages/graphql/src/schema/kbKnowledgeGraph.ts`, the
   three read ops, the generated SDL snapshot,
   `apps/chat/src/lib/server/knowledgeGraph.ts` (allowlist, `pages`),
   `apps/chat/src/components/knowledge-graph/ChatKnowledgeGraphWorkspace.tsx`
   (guards), `packages/kb-management/src/components/KnowledgeGraphPanel.tsx`
   (mapper), a copied fixture
   `packages/knowledge-graph/test/fixtures/kgRelationsV1.json` (synthetic rows
   only; the test names generator MR !47 and SHA `54a46ac`, no course or KB
   identifiers), `normalize.test.ts`, and edge literals in
   `apps/chat/test/knowledge-graph-route.test.ts`,
   `knowledge-graph-state.test.ts` and `knowledge-graph-api-client.test.ts`.
   Check the hermetic mocks in `playwright/tests/Y-chat-knowledge-graph.spec.ts`
   against the stricter guards and update them if they would fail.
   Acceptance: `pnpm --filter @klicker-uzh/knowledge-graph test`, the chat
   route test, `pnpm --filter @klicker-uzh/graphql generate` and `check`,
   `pnpm run check`, Biome. Commit:
   `enhance(knowledge-graph): read typed relations and evidence pages`.
2. **S2 — Show relation types and sources.**
   Route: main (visual judgement with browser loop). Files:
   `KnowledgeGraphDetails.tsx`, `KnowledgeGraphViewer.tsx`,
   `knowledgeGraphView.ts` (ask selection), `knowledgeGraphLabels.ts`,
   `knowledgeGraphCytoscape.ts`, plus the local seeding extension below. The
   views follow the consumer contract; the source list is reused for edges and
   shows pages. Acceptance: Biome, typecheck, existing chat graph tests, and
   browser verification below. Commit:
   `enhance(knowledge-graph): show relation types and evidence sources`.
3. **S3 — Finish.** Simplification pass over the diff, final review,
   `Progress` update, push, draft PR into `v3-ai` with the screenshot table.

### Verification

- Unit and contract checks run in the devrouter container. If it fails with
  "address pools fully subnetted", run Vitest and Biome on the host and report
  that substitution.
- Browser evidence needs a typed graph, and no flag-on build exists:
  1. Extend `apps/chat/scripts/seed-graph-e2e.mjs`, keeping its
     disposable-database guard, with an option that loads the synthetic
     fixture rows. It maps `res-1`/`res-2` to the seeded KB's resources and
     writes the matching `KBGraphBuildSource` rows. The script keeps its
     current digest handling, because chat refuses stale graphs.
  2. Start a disposable local FalkorDB container on the host and write only
     the `KB_FALKORDB_*` keys into the ignored
     `.devcontainer/.local-kb-services.env`.
  3. Use `agent-browser`; do not run `pnpm playwright:host`, which purges the
     container's `node_modules`.
  Capture with `agent-browser` at desktop and mobile widths: manage
  (`lecturer`) with a `part_of` edge and its sources, a `contrasts_with` edge
  without an arrow, a legacy edge, and a concept with resolved pages; the chat
  graph panel as a seeded student with the same edges. Check the network
  responses in both views for the absent `internal_evidence_refs` key. Stop
  the harness container and the touched devrouter runtime afterwards.
- If the harness cannot run, browser evidence is a named blocker in the PR,
  not optional.

### Execution contract

- Authority granted on approval: plan and slice commits on
  `rs/w5-kg-relation-consumer`; local disposable FalkorDB and local seeded
  database writes for screenshots; normal push of the task branch; a draft PR
  into `v3-ai`; screenshot upload to the PR through `gh`; posting
  `/final-review` per the repository's standing authorization once CI settles.
- Withheld: enabling the generator flag anywhere, paid model calls, staging or
  cluster access, marking ready, merge, requesting reviewers.
- Terminal: S1 and S2 committed, final review dispositioned, draft PR open
  with screenshots or a named blocker, `Progress` final.
- Pause: the MR !47 fixture changes contract shape, or a needed change
  touches a #6613 file.
- Privacy: synthetic fixture and seeded data only; no course data, KB or
  chatbot identifiers, or production facts in Git, PR text or CI.

### Out of scope

- German translations for the graph details pane; today it is English-only.
- Hiding other raw generator properties (`kg_*`, `weight`) from the details
  pane.
- Retrieval or ranking use of types (W9c), lecturer type confirmation (W13),
  a correction UI (W10).

## Progress

- Status: S1 and S2 done, with screenshots, seeder extension and review
  fixes. The PR is ready for review (not draft); merging stays withheld.
- Worktree: `trees/rs/w5-kg-relation-consumer` on `rs/w5-kg-relation-consumer`
  from `origin/v3-ai` `cf240ddb1e`.
- Deviations: S1 ran in the main session instead of an executor (the design
  context was already loaded). Views show the relation-type label only when
  `edge.label` falls back to `edge.type`, so explicit edge labels keep showing.
  The manage panel reads the new fields through newly named
  `...WithRelations` persisted queries, because the rolling-deployment rule
  forbids editing existing operation documents. The seeder publishes the
  fixture with synthetic build sources and can target another chatbot,
  because the mcp profile's isolated chatbot has no knowledge-base
  resources. Commit hooks ran on the host, because the container-backed hook
  stalls on a devrouter stdio issue.
- Evidence: knowledge-graph Vitest 98 passed, 2 skipped; chat graph tests 74
  passed; `tsc` green for knowledge-graph, graphql, kb-management, chat and
  shared-components; host pre-commit and pre-push hooks passed. Browser
  checks on the seeded local stack: typed relations, evidence status and
  pages render in manage and chat; `contrasts_with` has no arrow; "Ask about
  this" drafts the relation type; the student payload and lecturer cache hold
  no evidence or relation keys. Eight screenshots are published in the PR.
- Test delta: added the fixture contract, fail-closed and evidence-bound
  tests, an ask-selection assertion and an unknown-relation-type guard case;
  changed edge literals and the route leak assertion.
- Simplifier: accepted dropping the redundant `related` vocabulary entry;
  kept the 20-resource cap the plan names.
- Reviews: first final review passed. The PR final review raised two LOW
  findings (nested ternary, repeated symmetric type), both fixed and
  dispositioned; the inline bot findings (persisted ops, guard membership,
  label fallback, symmetric accessible name) are fixed.
- Next action: `/final-review` once hosted CI is green on the head.

## Planning review

- Planner pass 1: approve with changes. Accepted all findings: manage
  mapper, chat guards, client sources and test literals added to S1; the
  untestable shared-components test dropped for browser evidence; the
  relationship list, heading, aria label and ask selection follow the
  relation type, and the `Type` row is replaced; the leak proof moved into
  normalize over serialized output; the existing graph seeder is extended
  with build-source rows; `instructor`, `extracted`-on-typed and
  `prerequisite_of`/`source` fail closed; exact matching and page caps
  stated.
