---
type: Data Layer
title: Data & Migrations
description: Split Prisma schema, the migrate→sync→generate ritual, seeding paths, typed Json fields, and schema-level gotchas.
timestamp: '2026-07-22'
tags:
  - backend
  - prisma
---

# Data & Migrations

**The ritual: every schema edit is three steps, not one.**

```bash
# 1. edit packages/prisma/src/prisma/schema/<area>.prisma
pnpm run prisma:migrate   # 2. create + apply migration (Infisical env dev)
pnpm run prisma:sync      # 3. mirror schema into apps/analytics (Python client)
```

Forgetting step 3 silently desynchronizes the Python analytics service — `util/sync-schema.sh` copies every `.prisma` file **except `js.prisma`** into `apps/analytics/prisma/schema/`, where a separate `py.prisma` defines the Python generator. Then run `pnpm run check:prisma-sync`, regenerate the client (`pnpm --filter @klicker-uzh/prisma generate`, or `pnpm run build`), and update GraphQL types/resolvers if the API surface changed ([API layer](./graphql-api-layer.md)). Schema sync mirrors `.prisma` files, not SQL migration history.

## Split schema

The schema is a **folder** (`prisma.config.ts` → `schema: 'src/prisma/schema'`), 14 files split by area: `user`, `participant`, `course`, `element`, `quiz`, `response`, `gamification`, `sharing`, `chat`, `analytics`, `resources`, `other`, plus `datasource.prisma` (shared datasource, `DATABASE_URL` + shadow DB) and `js.prisma` (generators only: `prisma-client` ESM output to `../client`, Pothos types, `prisma-json-types-generator`).

The Python twin (`apps/analytics/prisma/schema/py.prisma`) uses `prisma-client-py` with `interface = "sync"` and **`enable_experimental_decimal = true`** — keep that flag whenever shared schema `Decimal` fields exist (chat credit fields are `@db.Decimal(18,6)`), and note the Python side still uses the older `prismaSchemaFolder` preview flag.

## Migrations

- Prisma migrations live in `packages/prisma/src/prisma/schema/migrations/` (~170 since 2022). Migrations may contain data backfills (SQL `ROW_NUMBER()` etc.), not just DDL.
- Separately, the backend runs a **homegrown boot-time data-migration runner** (`apps/backend-docker/src/migration.ts:migrate`) with its own `Migration` table for one-off data fixes — currently an empty list; don't confuse it with `prisma migrate deploy`.

### Import/export additive migration

Migration `20260707120000_import_export_fingerprints` is published feature-branch history and must remain immutable. Git ancestry shows it is absent from `origin/v3` and current release tags, but the staging/production `_prisma_migrations` tables could not be inspected while their cluster tunnels were unavailable. Repository ancestry is not proof that a manual deployment never applied it.

That prior migration creates its two owner/fingerprint indexes with ordinary blocking `CREATE INDEX` statements. If it is absent on a measured-large target, the concurrent-index pre-step below cannot safely pre-create those same names because the published migration does not use `IF NOT EXISTS`. Never edit the published migration. Use the audited reconciliation procedure below only with a named DBA/release owner, recorded target evidence, and approval through the protected production change process.

Migration `20260712205147_import_export_durable_state` is additive and compatible with the previous application: it adds new tables and nullable fields, while retaining the old owner/fingerprint indexes for mixed-version rollback. Follow-up migration `20260712223000_import_export_media_fingerprint_state` adds nullable `MediaFile.importFingerprintVersion`, a `NOT VALID` positive-version check, and the maintenance lookup index. Migration `20260713003000_element_import_receipt_identity_immutable` prevents updates to a receipt's token-binding identity while leaving the optional artifact relation detachable by expiry cleanup. Migration `20260713013000_import_export_result_and_target_immutability` makes completed receipt results monotonic and freezes the exact artifact/media cleanup identities; operational lease, state, expiry, orphan-ref, and media-link transitions remain mutable. Migration `20260713130636_import_export_duplicate_lookup_indexes` adds owner/version/fingerprint/active-state/trailing-`id` indexes for one bounded lowest-active-ID duplicate probe per package candidate, including under heavy soft-delete skew; the previous three-column indexes remain in place for mixed-version rollback. Migration `20260716085603_import_export_fingerprint_repair_indexes` adds version/deletion/ID indexes for the bounded scheduled-repair scans and an answer-collection/deletion/ID index for linked-element invalidation and refresh. Before sealing the server-canonical CHECK expressions, it installs and validates corrected durable-state constraints that explicitly require final bytes and SHA-256 for `READY` artifacts and a retention deadline for `COMPLETE` receipts; the previous comparison-only expressions could evaluate to SQL `NULL` and therefore pass a PostgreSQL CHECK. Constraint replacement and expression sealing run in one explicit transaction, so a validation or seal failure preserves the previously installed constraints; the preceding idempotent index creation and validation intentionally remain outside that transaction. Its NULL-safe compatibility guard also revalidates the four earlier concurrently pre-creatable indexes without modifying their published migrations. Migration `20260722100000_import_export_null_fingerprint_repair_indexes` adds the two active/null-fingerprint partial indexes in a new immutable follow-up, so databases that already applied the published repair migration keep a valid checksum and still receive the added scan support. Production inspection reads only the public schema, rejects failed or duplicate active migration attempts, checks CHECK/FK column shapes and exact CHECK-expression seals, and compares every ownership/immutability trigger body to its immutable repository migration source. The media, duplicate-lookup, and repair/invalidation indexes use ordinary transactional creation on measured-small targets. On a large target, record real table sizes, approve the media-index maintenance/lock budget, and use the documented concurrent pre-create procedure for the duplicate-lookup and repair/invalidation indexes. The repository exposes manual deployment aliases:

```bash
pnpm --filter @klicker-uzh/prisma prisma:deploy:qa
pnpm --filter @klicker-uzh/prisma prisma:deploy:prod
```

The repository does not contain a workflow that approves or orchestrates these production migrations. A named operator must execute the inspection and environment-specific deployment through an approved, reviewer-gated change process. Import/export operations use only the selected Infisical environment's standard `DATABASE_URL`; they do not map an assessment database. The required network-capable runner, named owners, backup/PITR proof, large/partial-history DBA work, previous-image smoke, and target artifacts remain external release blockers. Follow the [Import/Export Production Runbook](./import-export-production-runbook.md); never run `migrate dev` against staging or production.

Before deploying, record migration state and real table sizes for the selected environment database:

```sql
SELECT migration_name, checksum, started_at, finished_at,
       rolled_back_at, applied_steps_count
FROM "_prisma_migrations"
WHERE migration_name IN (
  '20260707120000_import_export_fingerprints',
  '20260712205147_import_export_durable_state',
  '20260712223000_import_export_media_fingerprint_state',
  '20260713003000_element_import_receipt_identity_immutable',
  '20260713013000_import_export_result_and_target_immutability',
  '20260713130636_import_export_duplicate_lookup_indexes',
  '20260716085603_import_export_fingerprint_repair_indexes',
  '20260722100000_import_export_null_fingerprint_repair_indexes'
)
ORDER BY migration_name;

SELECT relname AS table_name,
       n_live_tup AS estimated_live_rows,
       pg_size_pretty(pg_relation_size(relid)) AS heap_size,
       pg_size_pretty(pg_indexes_size(relid)) AS index_size,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('Element', 'AnswerCollection', 'MediaFile')
ORDER BY pg_total_relation_size(relid) DESC;
```

Classify the prior migration before changing the target:

- **Applied and successful:** require one finished, non-rolled-back row and the exact immutable checksum shown below. A normally executed one-file migration records `applied_steps_count = 1`; a manually completed migration baselined with `migrate resolve --applied` records `0`. Continue only when the execution/reconciliation evidence explains which shape is present.
- **Absent:** on a measured-small target, let normal `migrate deploy` apply it. On a measured-large target, use the controlled reconciliation below so its two indexes are built concurrently.
- **Failed or partial:** stop normal deployment. A DBA must either remove every partial object and mark the failed attempt rolled back, or finish the exact immutable schema and mark it applied. Do not resolve a failed row based only on its name.
- **Checksum mismatch, more than one non-rolled-back/active successful attempt, or otherwise unexplained history:** stop. Retained rolled-back attempts are expected recovery evidence; conflicting active/successful rows are not. Preserve the database and migration-table evidence and escalate; neither `--applied` nor `--rolled-back` is safe until the discrepancy is explained.

The immutable SHA-256 checksum is derived from the exact repository file and currently equals `a24a4a29b1927ce6f86ee3f020abaf98a4f0e1b4119401112281ff6b0d2be45c`:

```bash
shasum -a 256 packages/prisma/src/prisma/schema/migrations/20260707120000_import_export_fingerprints/migration.sql
```

The additive media-decision migration checksum is `bde6ff7866ad18fd03fc779d4d1e886278893d8a15fb8e459ca6e2a3765d33ae`. Recompute and record it with the target migration state before deployment:

```bash
shasum -a 256 packages/prisma/src/prisma/schema/migrations/20260712223000_import_export_media_fingerprint_state/migration.sql
```

The bounded duplicate-lookup migration checksum is `862ce0f89bbb1f6f74fcbf5ef2e42ca027a42b8aa8c34a31c9e9a5e0f84c1d69`. Recompute and record it with the target migration state before deployment:

```bash
shasum -a 256 packages/prisma/src/prisma/schema/migrations/20260713130636_import_export_duplicate_lookup_indexes/migration.sql
```

The published bounded repair/invalidation-index, durable-state correction, and CHECK-expression-seal migration checksum remains `7f3005b1bccda0a0a782f1e2c05f1a1f806e24399143568b3958da824234f30a`. Recompute and record it with the target migration state before deployment:

```bash
shasum -a 256 packages/prisma/src/prisma/schema/migrations/20260716085603_import_export_fingerprint_repair_indexes/migration.sql
```

The active/null-fingerprint repair-index follow-up checksum is `b6874fc6c0f12f6d2ae8db76f80d93b1d440877d69a4de868c0d8309346d38bf`:

```bash
shasum -a 256 packages/prisma/src/prisma/schema/migrations/20260722100000_import_export_null_fingerprint_repair_indexes/migration.sql
```

### Controlled reconciliation of the published fingerprint migration

Use this only when `20260707120000_import_export_fingerprints` is absent on a measured-large target, or when a named DBA has chosen to finish an inspected partial attempt. Record the target, operator, start/end time, table sizes, SQL output, locks, index build duration, and migration-table rows. Keep both feature gates off.

First verify the exact old columns and indexes. Existing objects must either match this shape or be explained as part of the partial-failure record:

```sql
SELECT table_name, column_name, data_type, is_nullable,
       column_default, is_identity, is_generated
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name, column_name) IN (
    ('Element', 'importFingerprint'),
    ('AnswerCollection', 'importFingerprint')
  );

SELECT table_rel.relname AS table_name,
       index_rel.relname AS index_name,
       index_state.indisready,
       index_state.indisvalid,
       pg_get_indexdef(index_state.indexrelid) AS definition
FROM pg_index index_state
JOIN pg_class index_rel ON index_rel.oid = index_state.indexrelid
JOIN pg_class table_rel ON table_rel.oid = index_state.indrelid
WHERE index_rel.relname IN (
  'Element_ownerId_importFingerprint_idx',
  'AnswerCollection_ownerId_importFingerprint_idx'
);
```

Add the exact nullable text columns. Build each index in its own autocommit statement—`CREATE INDEX CONCURRENTLY` must not run inside a transaction:

```sql
ALTER TABLE "public"."Element"
ADD COLUMN IF NOT EXISTS "importFingerprint" TEXT;

ALTER TABLE "public"."AnswerCollection"
ADD COLUMN IF NOT EXISTS "importFingerprint" TEXT;

CREATE INDEX CONCURRENTLY "Element_ownerId_importFingerprint_idx"
ON "public"."Element" ("ownerId", "importFingerprint");

CREATE INDEX CONCURRENTLY "AnswerCollection_ownerId_importFingerprint_idx"
ON "public"."AnswerCollection" ("ownerId", "importFingerprint");
```

If an interrupted concurrent build left an invalid same-name index, record it, drop only that index with `DROP INDEX CONCURRENTLY`, and rebuild it. Re-run the verification queries and require nullable `text` columns with no default/identity/generated expression plus exact ready and valid btree index definitions.

Only after the target schema exactly matches the immutable migration, baseline that one migration through the environment-specific wrapper:

```bash
# Staging; use prisma:resolve:prod for production.
pnpm --filter @klicker-uzh/prisma prisma:resolve:qa -- \
  --applied 20260707120000_import_export_fingerprints
```

Immediately verify the newly stored row and checksum:

```sql
SELECT migration_name, checksum, started_at, finished_at,
       rolled_back_at, applied_steps_count
FROM "_prisma_migrations"
WHERE migration_name = '20260707120000_import_export_fingerprints';
```

Require a finished, non-rolled-back row with `applied_steps_count = 0` (the Prisma baseline marker) and checksum `a24a4a29b1927ce6f86ee3f020abaf98a4f0e1b4119401112281ff6b0d2be45c`. Retain the preceding exact-schema verification as the evidence that the SQL was completed manually. Then run the version-column/concurrent-index pre-step below and normal `migrate deploy`.

For a failed/partial attempt, the DBA must choose exactly one recovery branch:

1. **Revert and retry:** remove only proven partial objects, then run `prisma:resolve:<env> -- --rolled-back 20260707120000_import_export_fingerprints` before using either the measured-small normal path or the measured-large reconciliation path.
2. **Finish and baseline:** create/verify the exact missing objects as above, then run `prisma:resolve:<env> -- --applied 20260707120000_import_export_fingerprints` and verify the checksum/history row before continuing.

Capture the before/after schema and `_prisma_migrations` output for either branch. Never combine `--rolled-back` and `--applied`, resolve a migration that is still running, or infer success from Prisma CLI exit status without the database verification queries.

For measured-small targets, normal `migrate deploy` creates the versioned fingerprint indexes, the two active-state/trailing-`id` duplicate-lookup indexes, four repair-scan indexes (version-stale plus active-null for both resource tables), and the linked-element invalidation index. The two active-null indexes live in the separate `20260722100000_import_export_null_fingerprint_repair_indexes` follow-up; never add them to the already-published `20260716085603_import_export_fingerprint_repair_indexes` file. For large targets, run the following audited pre-step immediately before `migrate deploy`. Each `CREATE INDEX CONCURRENTLY` statement must run outside a transaction:

```sql
ALTER TABLE "public"."AnswerCollection"
ADD COLUMN IF NOT EXISTS "importFingerprintVersion" INTEGER;

ALTER TABLE "public"."Element"
ADD COLUMN IF NOT EXISTS "importFingerprintVersion" INTEGER;

CREATE INDEX CONCURRENTLY IF NOT EXISTS
"AnswerCollection_owner_fpv_fp_idx"
ON "public"."AnswerCollection"
("ownerId", "importFingerprintVersion", "importFingerprint");

CREATE INDEX CONCURRENTLY IF NOT EXISTS
"Element_owner_fpv_fp_idx"
ON "public"."Element"
("ownerId", "importFingerprintVersion", "importFingerprint");

CREATE INDEX CONCURRENTLY IF NOT EXISTS
"AnswerCollection_owner_fpv_fp_id_idx"
ON "public"."AnswerCollection"
("ownerId", "importFingerprintVersion", "importFingerprint", "isDeleted", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS
"Element_owner_fpv_fp_id_idx"
ON "public"."Element"
("ownerId", "importFingerprintVersion", "importFingerprint", "isDeleted", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS
"AnswerCollection_repair_fpv_deleted_id_idx"
ON "public"."AnswerCollection"
("importFingerprintVersion", "isDeleted", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS
"AnswerCollection_repair_null_fp_id_idx"
ON "public"."AnswerCollection" ("id")
WHERE "isDeleted" = false AND "importFingerprint" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS
"Element_repair_fpv_deleted_id_idx"
ON "public"."Element"
("importFingerprintVersion", "isDeleted", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS
"Element_repair_null_fp_id_idx"
ON "public"."Element" ("id")
WHERE "isDeleted" = false AND "importFingerprint" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS
"Element_answer_collection_deleted_id_idx"
ON "public"."Element"
("answerCollectionId", "isDeleted", "id");
```

`IF NOT EXISTS` compares names, not definitions. Before continuing, verify both columns are nullable `integer` fields and all nine indexes have the exact keys and predicates above with `indisready=true` and `indisvalid=true`. A failed concurrent build may leave an invalid same-name index; record and drop only that index concurrently, then retry before `migrate deploy`. The migrations independently reject incompatible columns and invalid or differently defined indexes after an `IF NOT EXISTS` no-op.

```sql
SELECT table_name, column_name, data_type, is_nullable,
       column_default, is_identity, is_generated
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name, column_name) IN (
    ('Element', 'importFingerprintVersion'),
    ('AnswerCollection', 'importFingerprintVersion'),
    ('MediaFile', 'importFingerprintVersion')
  );

SELECT table_rel.relname AS table_name,
       index_rel.relname AS index_name,
       index_state.indisready,
       index_state.indisvalid,
       pg_get_indexdef(index_state.indexrelid) AS definition
FROM pg_index index_state
JOIN pg_class index_rel ON index_rel.oid = index_state.indexrelid
JOIN pg_class table_rel ON table_rel.oid = index_state.indrelid
WHERE index_rel.relname IN (
  'Element_owner_fpv_fp_idx',
  'AnswerCollection_owner_fpv_fp_idx',
  'Element_owner_fpv_fp_id_idx',
  'AnswerCollection_owner_fpv_fp_id_idx',
  'Element_repair_fpv_deleted_id_idx',
  'AnswerCollection_repair_fpv_deleted_id_idx',
  'Element_repair_null_fp_id_idx',
  'AnswerCollection_repair_null_fp_id_idx',
  'Element_answer_collection_deleted_id_idx',
  'MediaFile_import_fpv_id_idx'
);
```

The media-hash and fingerprint-version checks are `NOT VALID`: they enforce every new write immediately without scanning existing large tables. Drain version-1/null-writing application and worker images, then run `./util/import-export-backfill.sh stg|prd`; it classifies media at version 1, backfills didactic fingerprints at version 2, and requires zero active-resource invariant violations. After that successful evidence and a target lock-budget review, validate the existing checks one at a time before private preview:

```sql
ALTER TABLE "public"."MediaFile"
VALIDATE CONSTRAINT "MediaFile_contentHash_check";
ALTER TABLE "public"."MediaFile"
VALIDATE CONSTRAINT "MediaFile_importFingerprintVersion_check";
ALTER TABLE "public"."Element"
VALIDATE CONSTRAINT "Element_importFingerprintVersion_check";
ALTER TABLE "public"."AnswerCollection"
VALIDATE CONSTRAINT "AnswerCollection_importFingerprintVersion_check";
```

Rehearse the exact immutable migration against a production-like database, recording duration, locks, WAL, row counts, constraints, and index validity. Run the previous application build against the migrated database with import/export disabled and smoke-test ordinary Element, AnswerCollection, and MediaFile reads/writes. Rollback disables import/export and rolls back application images; it does not drop the additive schema or stop record-scoped cleanup.

A database constraint requiring every active element and answer collection to have a current non-null didactic fingerprint belongs in a separate follow-up migration after the environment backfill is recorded. Do not add it to the dark version-2 rollout: doing so would break previous-image writes during the compatibility window.

## Seeding

Three independent seed paths — changing one does NOT update the others:

1. **Dev seed**: `pnpm run prisma:setup` → reset + push + `packages/prisma-data/src/data/seedTEST.ts` (plus seedAccounts/Achievements/Levels/… modules) → canonical import/export fingerprint bootstrap. The devcontainer's `seed:raw` path uses the same post-seed bootstrap. These paths create the `testuser*` participants and seed courses (credentials: [AGENTS.md](../AGENTS.md) test-credentials section).
2. **Cypress**: its own `seedDatabase()` task in `cypress/cypress.config.ts`.
3. **Playwright**: its own `seedDatabase()` in `playwright/global-setup.ts` with its own fixtures.

Supported `prisma-data` dev, QA, Playwright-CI, and production-flashcard seed wrappers run `packages/graphql/src/scripts/importExportSeedFingerprintBootstrap.ts` after their data writer. The sequential wrapper uses `--continue-on-error`, so it still repairs rows changed before a partial writer failure and then preserves a non-zero overall exit. The bootstrap uses the same rollout advisory mutex, a four-minute cooperative budget, and at most ten bounded repair passes; it succeeds only when no active answer collection or element remains null or version-stale. Reaching either bound fails closed with guidance to run the guarded rollout backfill rather than turning a seed into an unbounded database scan. Flashcard helper updates explicitly clear both fingerprint fields before changing an existing element, so content changes enter the stale repair path without forcing a full-corpus rescan in the normal case. A canonicalization, persistence, lock, or backlog failure makes the seed command fail. The bootstrap never chooses an environment itself: it inherits the exact `DATABASE_URL` already selected by the surrounding dev/staging/production seed wrapper, so it cannot silently switch to another target. `seed:test:raw` is the internal data writer; supported callers use fingerprint-safe `seed:test`.

The Cypress and Playwright `seedDatabase()` baselines create users, courses, and related test fixtures but no active `Element` or `AnswerCollection` rows, so they do not run this bootstrap. Test-specific resources created later remain isolated test data and should exercise the normal GraphQL authoring paths when fingerprint behavior matters.

`prisma:setup` is destructive — run only against demonstrably test-seeded databases.

## Typed Json fields

Json columns are typed via `prisma-json-types-generator`: a `/// [TypeName]` doc comment on the field (e.g. `[PrismaElementOptions]` in `element.prisma`) maps to declarations in `packages/graphql/src/types/app.ts` (`declare global { namespace PrismaJson { … } }`), which import shapes from `@klicker-uzh/types`. Add the comment AND the declaration when introducing a typed Json field.

## Schema-level gotchas

- **Prisma `Decimal` is an object, never truthy-check it** — `Decimal(0)` is truthy. Convert with a `toNumber()` helper and compare with `!= null` (pattern in `packages/graphql/src/services/chatbots.ts`).
- **`Participant` email is unique per auth mode**: `@@unique([email, isSSOAccount])` means the same normalized email can exist once as manual and once as SSO. Queries by email alone can return the wrong account; blocking new cross-mode duplicates must happen in service logic (`packages/graphql/src/services/accounts.ts`).

## Adjacent: export package (`packages/export`)

Data-export gotchas that bite when touching report generation:

- Prisma relation inference can collapse nested `ElementInstance`/`ElementBlock` selects to `never` — keep explicit row DTOs at the query boundary and cast once there.
- ExcelJS sheet names collide **case-insensitively** and cap at 31 chars — dedupe on a lowercase key (`exportCourse.ts`).
- ExcelJS `autoFilter` must span data rows: a header-only range (or autoFilter on an empty sheet) makes Excel flag the workbook as corrupt on open — set `to.row` to the last data row and skip autoFilter on header-only sheets (`exportCourse.ts:addSheet`).
