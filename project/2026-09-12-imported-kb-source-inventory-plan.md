# Imported KB source inventory

## Approval summary

Lecturers need to see sources already indexed for their knowledge base, including video-derived content whose raw videos are not stored or accepted by the upload UI. Add a read-only imported-source inventory to the existing KB detail page, alongside managed uploads. Preserve existing KB scope, source identities, indexed chunks and citations. An imported source is a metadata record, not a completed managed ingestion operation.

Use a separate inventory table so imported metadata never enters upload quotas, ingestion retries, replacement, graph-build inputs or resource deletion. Display source title, kind and an optional safe original link; unknown ingestion time remains unknown. Videos require no raw file upload or retention. Segment timestamps remain in existing retrieval records. New normal uploads keep their existing KB routing.

Registration is an operator-only, metadata-only utility: offline validation by default, explicit fingerprint-bound apply, atomic scope checks, exact replay as a no-op, and rejection of conflicting metadata. No source downloads, embeddings or vector mutations. Whole-KB deletion is blocked while imported entries exist because cleanup is unsupported.

The user authorized this source implementation and ordinary task-branch delivery. Merge, deployment, live metadata registration and corpus mutations are excluded. Completion is a reviewed draft PR with generated migration, focused database tests and synthetic browser evidence. Live display for IUW/RSV follows a separately reviewed metadata registration after deployment. An independent existing synthetic staging ingestion test remains in progress.

## Execution details

Approval mode: executable batch, derived from the user's agreement to the imported-source proposal and explicit video constraint.
Ceremony: full path. One cohesive PR targeting v3-ai, not a stack.
Repo: /Users/rschlae/Git/klicker/klicker-uzh
Worktree: trees/rs/kb-imported-sources
Branch: rs/kb-imported-sources
Base: 529bd0cf6416b3a9af19f3bed1c3362354fc4b2d
Artifacts: project/

### Primitive impact

- Reuse KB identity, owner authorization and chatbot scope.
- Add imported-source inventory identity/provenance, independent of managed lifecycle.
- Preserve KBResource upload, ingestion, replacement and serving version semantics.
- Preserve citation source identity and video segment timestamps.

### Binding contracts

One inventory row identifies a source, not a chunk. Immutable coordinates are databaseName, collectionName, sourceIdentityField and sourceIdentityValue. Allowed identity fields are source_id and video_source_id: values must be observed original structured identifiers, never fabricated from titles or segment URLs. Optional projectId and producerId preserve attribution; absent values stay null. Store sourceKind (DOCUMENT, LINK, VIDEO, IMAGE), title, optional safe sourceUrl, optional ingestedAt and required observedAt from the reviewed inventory observation. Store createdAt separately. Identity SHA-256 covers canonical ordered JSON of the four coordinates; uniqueness is (kbId, identitySha256), avoiding oversized URL indexes. Compare full coordinates on collision. Metadata SHA-256 covers coordinates and all immutable presentation/attribution/observation fields; exclude local ID and createdAt. Fields are bounded and conflicting replay fails atomically.

Store no raw videos, transcript bodies, chunks, embeddings, signed links, credentials or fabricated serving versions. Local inventory IDs never replace retrieval IDs. The UI labels entries as imported metadata observed at the recorded time, not currently verified readiness. Timestamped citations remain in the existing indexed chunks, not copied to the inventory table.

Registration locks the target KB and checks explicit expected owner and non-deleted state. It compares all existing identities before inserting any missing row, rejects conflicting metadata atomically and preserves replay timestamps. Missing manifest entries never delete records. Uniqueness and the same KB lock serialize competing registrations and deletion. A restrictive relation prevents accidental hard deletion; explicitly exclude KBs with imported inventory from maintenance hard-delete selection, and inspect owner cascade consequences. Expose a specific KB_IMPORTED_SOURCES_PRESENT error with an operator-support explanation. No deregistration or cleanup path in this package.

The owner-only read endpoint applies existing Manage AI entitlement and KB ownership checks, offers bounded cursor pagination and exposes only presentation metadata. Imported count is separate from managed capacity. No imported mutation controls or public registration mutation. Existing graph builds retain their managed-only source semantics; show an explicit notice that imported sources are excluded from graph builds. This change does not block graph building, modify published graphs, or claim corpus completeness. Registration does not modify graph inputs. A proposed new graph prohibition is rejected as an unrelated behavior change; the inventory only exposes existing excluded content.

### Ownership and slices

| Workstream | Slice | Accountable owner / route | Dependency | Acceptance |
| --- | --- | --- | --- | --- |
| Inventory read contract | S1 | main coordinating executor | none | owner-scoped query and deletion invariant |
| Registration | S2 | executor | S1 | atomic idempotent registration |
| Manage inspection | S3 | executor | S1; serialize shared schema generation | synthetic browser inspection and upload |
| Delivery | S4 | main | S1-S3 | reviewed draft PR and released runtime |

S1 sequencing: executor completes schema edits, main generates migration and mirrors, then executor integrates API/tests. No concurrent writers on these paths. Main retains migration/runtime work because it crosses data and environment boundaries.

Main owns architecture, integration, migrations/runtime, external actions and proof. A bounded executor owns routine settled code after planner approval; no worker accesses secrets or live systems. No existing same-purpose child or report beyond planner 01a09580-7ed6-7ba2-8ba2-0bc51a87b642. Advisor validates the separate-inventory decision. Do not revive historical managed-adoption code.

1. S1: Persist and expose an owner-scoped inventory with whole-KB deletion protection. Route executor for schema/service/query and tests; main generates the single migration and schema mirrors. Files: packages/prisma/src/prisma/schema/knowledge.prisma, apps/analytics/prisma/schema/knowledge.prisma, packages/graphql/src/services/knowledge.ts, packages/graphql/src/schema/{knowledge,query}.ts, packages/graphql/src/graphql/ops/QGetKb.graphql, packages/graphql/src/graphql/ops/QGetKbImportedSources.graphql, packages/graphql/src/public/schema.graphql, packages/graphql/test/knowledge.test.ts, packages/hatchet/src/kbMaintenance.ts and its existing test file. One generated migration under packages/prisma/src/prisma/schema/migrations/<timestamp>_kb_imported_source_inventory/migration.sql. Acceptance: owner denial, pagination scope, no deletion side effects, unchanged managed quota/ingestion checks.
2. S2: Register imported metadata safely. Route executor. New packages/graphql/src/services/knowledgeImportedSources.ts, packages/graphql/src/scripts/registerImportedKbSources.ts and packages/graphql/test/knowledgeImportedSources.test.ts. Acceptance: malformed manifest rejection, exact replay no-op, changed input atomic failure, concurrent replay convergence in disposable DB. No live apply.
3. S3: Inspect imported sources alongside uploads. Route executor. KnowledgeBaseDetail.tsx; new components/KnowledgeBaseImportedSourceList.tsx; DeleteKnowledgeBaseModal.tsx; en/de i18n; existing playwright/tests/Y-kb-management-ux.spec.ts. Acceptance: synthetic video source without file, document/link sources, safe links, empty/error/paginated state, no unsupported actions and continued same-KB uploads. Desktop/mobile EN/DE and keyboard browser captures required.
4. S4: Main integrates, verifies existing video citation tests, reviews committed scope, documents operator boundary in docs/imported-kb-sources.md and updates this plan, then opens draft PR. No merge or deployment.

### Feature-wide test portfolio

- Extend knowledge service tests: ownership/pagination and deletion atomicity; imported inventory cannot enter managed quotas or ingestion.
- New registration tests: invalid identity, bounded/safe metadata, fingerprint mismatch, atomic conflict, repeat/concurrent repeat.
- Extend existing KB browser suite: imported video with no blob and working managed upload in same KB; no imported mutation controls.
- Test obligation none for new citation tests: reuse existing normalize-sources/source-display tests for video timestamps; do not change citation code.
- Test obligation none for migration/documentation automated tests: generate one migration with Prisma, inspect mirror/schema equivalence and restrictive FK. No content-pinning tests.

### Verification and delivery

Use the task-scoped Manage runtime for affected builds/codegen and disposable DB tests; build Prisma before dependents. Use repository format/type checks. Run focused browser proof and capture screenshots. Apply substantive slice simplifier and risk review, then integrated final review. Validate staged files contain no real source data or secrets. Ordinary non-force task-branch push and draft PR are authorized. Stop exact runtime and verify release at terminal or genuine pause.

### Live follow-up prerequisites

Evidence: the Resource API list exposes only each known synthetic managed resource for IUW/RSV, not their migrated corpus. IUW has 872 active chunks with 82 distinct nonempty video_source_id values, video names and hashes. Validate one-to-one consistency before registering 82 video rows; never use its corpus-wide source_id/external_resource_id as video identity. RSV has 546 distinct source_id values; confirm their source-level semantics against its existing Catalyst ingestion contract. After source deployment, a sanitized scoped source inventory must establish stable source grouping and retained video/link metadata for each target KB. Verify existing and newly uploaded content route to the same intended collection and KB filter. Prepare reviewed dry-run manifests outside Git. Ask only for the named live registration sequence; do not re-ingest working IUW/RSV or enable cleanup.

## Progress

- S1 committed as eb7534257f; independent simplifier and slice reviewer returned no findings. Reviewer independently reproduced the single generated Prisma migration and verified mirror equality. Knowledge service tests: 71/71 pass.
- S2 committed as e17d8cd573; independent simplifier and slice reviewer returned no findings. Registration tests: 22/22 pass, including disposable database conflict/concurrency cases. Offline validation avoids Prisma loading.
- S3 committed as 1a62606023; types pass. Synthetic browser run passed for video inventory, safe links, pagination and managed upload interactions. Refreshed Chromium run passed (15.2s); simplifier returned no changes, slice review running.
- Host workflow checks: 190/190 pass. Broad container checks passed after serial regeneration resolved a concurrent generated-output race. Two maintenance UPSERT retry tests fail identically on unchanged baseline source and tests; 20/22 pass including imported deletion protection. No claim of a green complete maintenance suite.
- Real local synthetic metadata was rendered through the API in EN/DE without raw video storage. Browser network fixtures exercise upload/pagination/error UI only; they do not prove deployed ingestion or retrieval. No live registration, deployment, or corpus changes performed.
- Task runtime: rs-kb-imported-sources at this worktree. Recovery after a launcher profile failure stopped only this runtime; the canonical Manage-profile browser retry passed with isolated blob port 51504. Stop and verify before final review.
- Video citation/source-display regression: 88/88 pass. Remaining: S3 risk review, integrated final review, draft PR delivery. No PR exists yet.

### Delivery checkpoint

- Final UI behavior verified by Chromium at 1a62606023; citation tests 88/88 pass. S3 reviewer found only a test cleanup issue; ce179a6f70 moves the override into outer scope and resets it at the start of finally. Production source unchanged.
- Runtime release verified: exact task container 47628fe6c1b0 is exited; exact workspace has zero routes. No data deletion.
- Public push was rejected by automatic approval review: explicit authorization for publishing the unpushed branch to public uzh-bf/klicker-uzh is required. No push or PR creation occurred.
- Claude final review returned terminal session limit with no review. Configured AGY Gemini 3.8 Flash high fallback was rejected by automatic approval review for missing explicit authorization to transmit the unpushed source to that provider. No fallback review occurred and no other provider attempted.
- Next required input: approval for public task-branch push/draft PR and for the named AGY read-only final review, or an available approved final-review route. Native goal remains incomplete. Local draft description and screenshots are in project/_local/imported-source-gallery; review manifest and results in project/_local/reviews.
