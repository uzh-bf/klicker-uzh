# Label indexed KB source origin (app-managed vs manually imported)

Status: active, revision 1. Cross-repo package: `klicker-uzh` (`v3-ai`) plus
`mcp-doc-query` (`main`).

## Approval summary

The KB detail page shows an "Imported sources" table that in fact lists **every**
source indexed in the KB's vector scope, because the doc-query inventory tool
groups all chunks in the scope and never reports which lane produced them. A
lecturer therefore sees their own uploads listed a second time as if they were
operator-imported content, and the notice claims those rows are excluded from
graph builds and quotas, which is false for app-added resources.

The requested outcome is to keep listing everything, label the manually
imported sources explicitly, and make the surrounding description state that the
list covers everything indexed in the KB/vector scope.

Two coherent changes deliver this. First, doc-query's `list_kb_sources` starts
reporting each source's `external_resource_id` provenance alongside the fields it
already returns. Second, Klicker uses that provenance to decide an `origin` per
source — `MANAGED` when the id is one of the KB's own `KBResource` rows,
`IMPORTED` otherwise — exposes it as a new non-null GraphQL field, and renders an
origin badge next to user-facing copy that names the table for what it is.

Unchanged: nothing is filtered out, retrieval and graph builds are untouched, the
managed resource list keeps its behavior, and the inventory stays read-only and
scope-guarded. There is no Klicker schema or migration change.

Material risks and open choices: the public GraphQL type gains a non-null field,
so Klicker's generated ops, the tracked SDL snapshot, and the Playwright spec all
move together; a collection that does not expose `external_resource_id` yields no
provenance, and every such source is labelled `IMPORTED` (today's truthful
default for the legacy import lanes). Internal identifiers that still say
"imported" while now covering both lanes are documented naming debt rather than
renamed in this package.

One residual risk: a source's chunks are grouped by `video_source_id`, else
`source_id`, and provenance is aggregated with first-non-empty across those
chunks. If the same physical source were both app-added and operator-imported it
would carry two different non-empty ids and the label could pick either one. The
two lanes write disjoint identity schemes, so this needs a genuine double-write to
occur and stays a cosmetic mislabel rather than a filtering defect.

Done means: the doc-query unit suite covers the provenance field and its absence;
Klicker's GraphQL test covers both origins plus the no-match default; a real
browser run on the local stack shows every source once, with uploaded documents
labelled as app-managed and the video labelled as manually imported; and both
repositories carry a draft PR/MR.

Approval authorizes: implementation commits and draft PR/MR delivery in both
repositories. Withheld: merge, deployment, live tenant reconfiguration, and any
corpus or live-data mutation.

## Execution details

### Root cause (source-confirmed and reproduced live)

Two lanes write into one Milvus collection. App-added content goes through
Klicker's ingestion API with `producer: "klicker"`,
`project_id: "klicker-course-materials"`, and `external_resource_id` equal to the
`KBResource` UUID (`packages/hatchet/src/kbIngestionApi.ts`). Operator-imported
content is written straight into the store with `external_resource_id` values such
as `video-lecture:01` or none at all.

`list_kb_sources` projects only `KB_SOURCES_OUTPUT_FIELDS`
(`video_source_id, source_id, title, video_name, display_name, file_name, name,
source_url, source_type, ingested_at, observed_at, created_at`) and groups by
`video_source_id`, else `source_id`. Because the app-managed lane's `source_id`
is an opaque identity hash, every indexed resource appears as a table row.

Live evidence, PRD collection `klicker_prd.klicker_course_materials_v1`
(18,211 chunks, 29 KB scopes): 2,948 chunks carry the ingestion-API
`source_url` and a UUID `external_resource_id`; 1,811 carry `video_source_id`;
the remainder carry neither. For the Finance I KB
(`15ff49a3-44b0-4328-b3c1-ac5ff65ab9a0`) the six PDFs uploaded in the app each
have a matching `KBResource` row and the same six are what the table lists,
alongside the imported `01_Finance1_VL.mp4`.

### Discriminator contract

A source is `MANAGED` exactly when its `external_resource_id` is non-empty and
equals the `id` of a `KBResource` row of that KB. Otherwise it is `IMPORTED`.
This keeps the semantics with the system that owns the resource concept and
covers URL-type resources, whose `source_url` is a public address rather than an
ingestion endpoint. Shape-based inference (for example "looks like a UUID") is
deliberately avoided.

### doc-query change (`mcp-doc-query`)

- Add `external_resource_id` to `KB_SOURCES_OUTPUT_FIELDS` and to the per-source
  entry built by `_build_kb_sources_inventory`, aggregated with the existing
  first-non-empty helper. The field is dynamic on the live collection, so
  `_collection_output_fields` keeps it; collections without it simply omit it.
- Rename the tool description and the function docstring from "imported sources"
  to the indexed-scope wording, stating that the list covers every source in the
  scope, with per-source chunk counts.
- Extend `tests/test_kb_sources_inventory.py` with cases for provenance present,
  provenance absent, and provenance shared across a source's chunks.

### Klicker change (`klicker-uzh`, `v3-ai`)

- `packages/graphql/src/services/docQuerySources.ts`: parse the optional
  `external_resource_id` into `KbImportedSourceItem` and keep it internal to the
  service.
- `packages/graphql/src/services/knowledge.ts`: in
  `getKbImportedSourcesConnection`, load the KB's `KBResource` ids in one
  bounded indexed query, then set `origin` per item. Expose the raw id only as
  the match input.
- `packages/graphql/src/schema/knowledge.ts`: add
  `enum KBSourceOrigin { MANAGED, IMPORTED }` and a non-null `origin` field on
  `KBImportedSource`; regenerate ops and the tracked SDL snapshot.
- `packages/kb-management/src/components/KnowledgeBaseImportedSourceList.tsx`:
  add an origin badge column and reword the section copy.
- `packages/i18n/messages/{en,de}.ts`: reword the section title and notice so the
  scope is explicit, and add origin badge labels. German copy uses Swiss
  conventions with real umlauts and guillemets, never `ue`/`ae`/`oe`.
- `packages/graphql/test/kbImportedSources.test.ts` and
  `playwright/tests/Y-kb-management-ux.spec.ts`: cover both origins, the
  no-match default, and the reworded copy.

### Verification

- doc-query: `uv run poe test` plus the focused inventory suite.
- Klicker: focused graphql vitest suite, `pnpm --filter @klicker-uzh/graphql check`
  (which regenerates and checks the schema), and the KB-management Playwright spec
  against the local routed stack.
- Browser evidence for the changed UI via `$rs-build-screenshot-gallery`, with
  desktop and compact captures and the reworded German locale.

### Ownership and sequence

The doc-query field projection is an independent seam and can ship first. The
Klicker side depends on it only at live-run time; its resolver and UI work is
independently testable with mocked transport payloads. Seam a single writer per
repository.

### Out of scope

Renaming `getKbImportedSources`, `KnowledgeBaseImportedSourceList`, the
`kb-imported-source*` test ids, or the i18n keys; a Klicker schema or migration
change; deployment and live tenant reconfiguration; backfilling provenance into
collections that never stored it.

## Progress

- Live root cause and the discriminator contract are source-confirmed and
  reproduced against PRD.
- Read-only planner pass reviewed the plan and approved it, with the mixed
  provenance aggregation case added above as the one residual risk.
- doc-query slice implemented and verified: `external_resource_id` projected and
  aggregated per source, tool description and docstring reworded, three new
  inventory tests, full suite green (913 passed) plus lint, format and typecheck.
- Klicker slice implemented and verified: provenance parsed, `origin` resolved
  with one bounded lookup over only the UUID-shaped ids on the page, `KBSourceOrigin`
  enum plus non-null `origin` field, ops and tracked SDL regenerated, origin badge
  and scope-accurate EN/DE copy, GraphQL suite green (17 passed), `check:ts` and
  `kb-management check` clean.
- Real-browser run on the local routed stack: `tests/Y-kb-management-ux.spec.ts`
  passed 1/1 with the new origin-badge assertions, and the four English/German
  desktop/compact captures are attached inline to the Klicker draft PR.
- Delivery: doc-query MR !92 and Klicker PR #6149 are open as drafts. Merge,
  deployment and live tenant reconfiguration remain withheld.
- Integrated the target branch after CI reported a base-branch syncpack breakage
  unrelated to this change. PR #6137 added the exact-pin rule for `vitest` but
  updated only 11 of 16 manifests and its own `check` gate was cancelled, so
  `v3-ai` failed `check:syncpack` with five `SemverRangeMismatch` findings.
  Fixed separately in PR #6151 (against `v3-ai`), merged in here, and re-verified:
  syncpack clean, `graphql check` and `kb-management check` clean, focused suite
  17 passed.
