---
type: Data Layer
title: Data & Migrations
description: Split Prisma schema, the migrate→sync→build ritual, seeding paths, typed Json fields, and schema-level gotchas.
timestamp: '2026-08-25'
tags:
  - backend
  - prisma
---

# Data & Migrations

**The ritual: every schema edit is four steps, not one.**

```bash
# 1. edit packages/prisma/src/prisma/schema/<area>.prisma
pnpm run prisma:migrate   # 2. create + apply migration (Infisical env dev)
pnpm run prisma:sync      # 3. mirror model files into apps/analytics
pnpm run build            # 4. rebuild the generated client and dependents
```

`prisma:migrate` explicitly regenerates the TypeScript client after Prisma 7's `migrate dev`; Prisma no longer does that implicitly (`packages/prisma/package.json:scripts`). Forgetting step 3 still silently desynchronizes Analytics: `util/sync-schema.sh` copies the shared model files but excludes both `js.prisma` and `datasource.prisma`. Analytics keeps its own `py.prisma` generator and URL-bearing `datasource.prisma`; `util/check-prisma-sync.sh` fails closed if either owned file disappears. Update GraphQL types/resolvers if the API surface changed ([API layer](./graphql-api-layer.md)).

## Prisma 7 client and datasource ownership

JavaScript owns its runtime URL in `packages/prisma/prisma.config.ts`; the shared `datasource.prisma` declares only PostgreSQL. `packages/prisma/src/index.ts:createPrismaClient` is the single owner of `PrismaPg` construction and the development singleton. Apps, workers, seeds, and maintenance scripts import that shared client instead of constructing adapter-less clients. The Analytics Docker build likewise removes the shared JavaScript generator and datasource before restoring the two Analytics-owned files (`apps/analytics/Dockerfile`).

Prisma Client 7.8.0 and `prisma-json-types-generator` 5.1.0 emit declarations that compile directly under TypeScript 6. The former namespace patch, its invariant test, and the generator peer override are gone. Run generation through `pnpm --filter @klicker-uzh/prisma generate`; the package `check` regenerates before compiling. `prisma:migrate` and `prisma:push` wrappers also generate explicitly because Prisma 7 removed implicit post-command generation.

## Split schema

The schema is a **folder** (`prisma.config.ts` → `schema: 'src/prisma/schema'`), 15 files split by area: `user`, `participant`, `course`, `element`, `quiz`, `response`, `gamification`, `sharing`, `chat`, `analytics`, `resources`, `verification`, `other`, plus `datasource.prisma` (PostgreSQL provider only) and `js.prisma` (generators only: `prisma-client` ESM output to `../client`, Pothos types, `prisma-json-types-generator`). JavaScript datasource and migration settings live in `prisma.config.ts`.

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

The standard ArgoCD PreSync migrator applies pending migrations before application rollout (see the deployment-migrations section below). It does not approve the import/export rollout or perform its large-target reconciliation and backfills. Complete the target inspection and any approved DBA pre-steps before allowing that sync; use manual deployment aliases only through the documented break-glass path. Import/export operations use only the selected Infisical environment's standard `DATABASE_URL`; they do not map an assessment database. The required network-capable runner, named owners, backup/PITR proof, large/partial-history DBA work, previous-image smoke, and target artifacts remain external release blockers. Follow the [Import/Export Production Runbook](./import-export-production-runbook.md); never run `migrate dev` against staging or production.

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

### Deployment migrations

`prisma migrate deploy` runs **automatically** on every stg and prd rollout as an ArgoCD **`PreSync` hook Job** (`deploy/charts/klicker-uzh-v3/templates/job-migrate.yaml`), not by hand. On prd the hook is **enabled** because the pinned tags have reached a migrator-bearing release (see Bootstrap and rollback below), so normal prd migrations run through ArgoCD. Mechanics:

- A dedicated migrator image (`packages/prisma/Dockerfile`: `node:24.16.0-alpine` + a **local** `prisma` install, carrying `prisma.config.ts` + the schema + `migrations/`) runs `./node_modules/.bin/prisma migrate deploy`. The install must stay local, not `-g` — Prisma 7's `prisma.config.ts` imports `prisma/config`, which only resolves from `/app/node_modules`; the config supplies the datasource URL from `DATABASE_URL`. It exists because the backend runtime image installs `--prod --ignore-scripts` and so ships neither the Prisma CLI nor the migration engine. CI builds `backend-docker-migrator-arm` in lockstep with `backend-docker-arm` (`v3_backend-docker-{stg,prd}.yml`); the retained AMD migrator job is disabled. Its image **tag** auto-tracks the backend tag — the chart defaults `migrator.image.tag` to `backendGraphql.image.tag`, so each env pins only the migrator **repository** and never a separate tag.
- The hook draws `DATABASE_URL` from the externally-provisioned `…-secret-backend-graphql` Secret only (a PreSync hook must not depend on Sync-phase ConfigMaps). Toggle with `migrator.enabled`.
- A **failed** hook aborts the whole sync — app Deployments never roll onto an unmigrated DB. The Job runs while the **previous** app version is still live, so migrations must be **backward-compatible (expand-contract)**; a destructive/renaming migration must be split across releases.
- **Break-glass only:** `pnpm --filter @klicker-uzh/prisma prisma:deploy:prod` (Infisical `--env prd`) still applies migrations manually from a workstation. Use it only when the hook is unavailable; `prisma:resolve:prod` resolves a failed/partial migration.
- **Scope:** the hook migrates only the database in the `…-secret-backend-graphql` Secret. The assessment stack binds a separate `…-secret-backend-assessment` Secret; if that points at a different database, it is **not** covered here and still needs the manual path. Both Secrets are provisioned outside this repo, so confirm in Infisical before assuming coverage.
- **Bootstrap and rollback:** the tag coupling means a release tag with no matching migrator image renders an unpullable hook image, which fails the sync after `activeDeadlineSeconds`. Production now uses migrator-bearing release tags with `migrator.enabled: true`; rolling prd back to a pre-hook tag means setting it back to `false`. The alpha.70 and alpha.71 release workflows both built matching migrator images. Stg is unaffected: its selected floating source tag is rebuilt on every merge.

Where `migrate deploy` is invoked in deployment is now the PreSync hook above (see [CI & Deployment → Deployment migrations](./ci-and-deployment.md#deployment-migrations)). Rationale and rejected alternatives: [ADR-0001](./adr/0001-automate-db-migrations-via-argocd-presync-hook.md).

### Recovering a failed migration hook

A failed hook blocks **every** sync to that environment, by design. Recovery order:

Nothing alerts on hook failure — detection is whoever is watching ArgoCD, so a blocked environment stays blocked silently until someone looks. (The df-cloud staging Prometheus rules now provide early detection of stuck operations and failed syncs; see the linked solution doc below.)

1. **Get the logs first.** Find the Job with `kubectl get jobs -n <ns> -l app.kubernetes.io/component=migrate` (it is named `<helm-release>-klicker-uzh-v2-migrate` unless the release name already contains the chart name), then `kubectl logs job/<name> -n <ns>` — with the default values, both successful and failed Jobs are kept until the next sync (`hook-delete-policy: BeforeHookCreation`, no TTL by default). Keeping successful jobs prevents an upstream ArgoCD finalizer race from deadlocking the sync (see the [df-cloud incident analysis](https://gitlab.uzh.ch/uzh-bf/cloud/df-cloud-klickeruzh/-/blob/stg/docs/solutions/integration/argocd-hook-job-finalizer-update.md)). Treat the output as potentially containing row data from backfill migrations; scrub before pasting it anywhere.
2. **Classify the failure.** Image pull (`ImagePullBackOff` → the rendered tag has no migrator image, see bootstrap above); connection error (DB unreachable — `backoffLimit: 1` gives little retry, so a failover during the hook simply needs a re-sync); or a SQL error inside a migration.
3. **A SQL failure leaves the DB partially migrated.** Prisma marks the migration failed and every later run stops with `P3009` until it is resolved. `prisma migrate resolve` only rewrites that bookkeeping — it does **not** undo DDL the failed migration already committed. Inspect the schema, undo the partial DDL by hand, then `prisma:resolve:prod` with `--rolled-back` (re-apply later) or `--applied` (you finished it manually).
4. **Killed mid-migration is the same case.** The CLI ignores `SIGTERM`, so hitting `activeDeadlineSeconds: 600`, evicting the pod, or terminating the sync escalates to `SIGKILL` and leaves exactly the partial state above. An orphaned backend can also hold the advisory lock briefly; a later run then reports a connection-ish error that is really lock contention.
5. **Need to ship an app-only hotfix while the DB is wedged?** Set `migrator.enabled: false`, sync, then re-enable it — track the re-enable, since a silently disabled hook is the failure mode this whole feature exists to prevent.
6. **A migration that applied but shouldn't have** has no automatic undo: rolling the app image back leaves the schema ahead. That is why migrations must be expand-contract — roll _forward_ with a compensating migration. This repo documents no point-in-time restore procedure and the hook creates no restore point; whatever backup the managed Postgres provides is the only fallback, and recovering through it is a database-team operation, not a deploy step.

Long DDL runs unattended against the live database with no `lock_timeout`: a statement waiting on an `ACCESS EXCLUSIVE` lock queues application queries behind it until the deadline. Review lock-heavy migrations before release.

**Verify the image after any Prisma major** (ADR-0001 requires running it, not just building it):

```bash
docker build -f packages/prisma/Dockerfile -t migrator-check .   # repo root
docker network create mcheck && docker run -d --name mcheck-pg --network mcheck \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=klicker docker.io/library/postgres:15
until docker exec mcheck-pg pg_isready -U postgres; do sleep 1; done   # Postgres needs a few seconds
export MURL='postgresql://postgres:test@mcheck-pg:5432/klicker'
docker run --rm --network mcheck -e DATABASE_URL="$MURL" migrator-check   # all migrations applied, exit 0
docker run --rm --network mcheck -e DATABASE_URL="$MURL" migrator-check   # idempotent: no pending migrations
docker run --rm --network mcheck migrator-check                          # no DATABASE_URL: must fail, exit 1
docker rm -f mcheck-pg && docker network rm mcheck && docker image rm migrator-check
```

The third run proves `prisma.config.ts` is actually consulted — a migrator that cannot see `DATABASE_URL` must fail loudly rather than no-op.

Fresh-install caveat: the Job references a PriorityClass that the chart creates in the **Sync** phase, so a first-ever install into an empty namespace must have the PriorityClasses applied before the PreSync hook runs (or `migrator.priorityClassName` left unset). Both existing environments already have them.

Two independent seed paths — changing one does NOT update the other:

1. **Dev seed**: `pnpm run prisma:setup` → seed-free reset + push/generate + an explicit `packages/prisma-data/src/data/seedTEST.ts` run (plus seedAccounts/Achievements/Levels/… modules). Creates the `testuser*` participants and seed courses (credentials: [AGENTS.md](../AGENTS.md) test-credentials section).
2. **Playwright**: its own `seedDatabase()` in `playwright/global-setup.ts` with its own fixtures.

Prisma 7 does not seed after migrate/reset automatically. `pnpm run prisma:reset` therefore resets without fixtures. On the legacy host stack with Infisical, use `pnpm run prisma:setup` for the explicit reset/push/seed composite or `pnpm --filter @klicker-uzh/prisma prisma:seed` for seed-only. In the self-contained DevPod, use the environment-ready raw sequence from `.devcontainer/post-create.sh`: `pnpm --filter @klicker-uzh/prisma run prisma:reset:raw --force`, then `pnpm --filter @klicker-uzh/prisma run prisma:push:raw`, then `pnpm --filter @klicker-uzh/prisma-data run seed:raw`. Reset/setup is destructive — run only against demonstrably test-seeded databases.

### First-login demo content

First-login demo content is a third, request-driven seed path rather than an environment fixture. When a new lecturer submits `changeInitialSettings` with `seedDemoElements: true`, `packages/graphql/src/services/accounts.ts:seedDemoQuestions` creates the owned demo elements and Demo Live Quiz inside the first-login transaction. Selection and case-study demos share one owned `Demo Teaching Activities` answer collection: selection correctness and case-study items are Prisma relations to its entries, while case-study sample ranges embed those generated entry IDs in typed JSON. `packages/graphql/src/services/demoQuestions.ts:seedDemoSelectionAndCaseStudyElements` receives the same transaction context for the relational collection-plus-elements bundle, and `packages/util/src/elements.ts:processElementData` snapshots it into the final untimed live-quiz block.

This path does not run for users who opt out, does not backfill existing accounts, and is independent of the dev and Playwright fixture seeds above.

## Auth adapter compatibility

Auth passes the shared client to `@auth/prisma-adapter` 2.11.2; its peer comparator already admits Prisma 7, so there is no package extension to maintain. `pnpm --filter @klicker-uzh/auth test:prisma-adapter` performs a disposable create/get/link/get/unlink/delete round-trip (`apps/auth/scripts/testPrismaAdapter.mjs`). It refuses remote databases and permits the DevPod `postgres` alias only when DevRouter identifies the workspace outside production mode. Run it only against a disposable local database.

### Production batch seeds

Externally-earned points and badges (Summer School games, offline activities) are seeded by **one** script, `seedCourseAwards.ts`, parameterized by a _round_. Rounds are declared in `courseAwardRounds.ts`; every artefact a round produces is namespaced by its key inside the gitignored `packages/prisma-data/src/data/_local/`, so no round can replay another round's payload and no payload can be committed by picking an unignored filename.

```bash
ROUND=<key> pnpm --filter @klicker-uzh/prisma-data seed:prod:course-awards:prepare  # optional, derives an award from the DB
ROUND=<key> pnpm --filter @klicker-uzh/prisma-data seed:prod:course-awards          # dry run
ROUND=<key> DRY_RUN=false pnpm --filter @klicker-uzh/prisma-data seed:prod:course-awards
```

A new round is one entry in `ROUNDS` (course ID plus the achievement IDs it may grant) and a `_local/<round>_data.json` payload of `{ username, points?, awards? }` rows. Achievement IDs are asserted against `nameEN` before any write, so ID drift across environments fails loudly.

The dry run validates references, resolves usernames case-insensitively, writes a comparison CSV and a payload-bound before-state dump, and reports the intended point/XP and achievement changes. A write requires a separate `DRY_RUN=false` execution and refuses to start if production state or the payload no longer matches that dump. An after-state dump blocks accidental replay. Writes run atomically under `Serializable` and are verified inside the transaction before commit.

Points and badges are independent per row: `points` defaults to 0 and `awards` to none, but a row must grant one of the two. That makes a badge-only round ordinary rather than a special case — it skips the `leaderboardEntry`/`Participant.xp` writes, and the post-write check (score and XP must move by exactly the payload delta) then asserts they did not move at all. **A late addition to an already-seeded round is a new round, never a rerun:** the original is replay-locked, and recipients who already received points must not be paid twice.

Points earned inside Klicker (Swiss Quiz, microlearnings) are already on the leaderboard and are never part of these payloads — only externally-run activities are seeded. Awards that depend on in-platform behaviour are derived from the database rather than the workbook: `prepareMicrolearningAwards.ts` grants a round's `derivedAward` (Busy Bee, for Summer School) when the participant has a `QuestionResponse` for every `ElementInstance` of every non-deleted `MicroLearning` in the course. The derivation is frozen into the payload rather than recomputed at write time, so the payload hash still pins exactly what gets written.

**Do not derive microlearning completion from `ParticipantActivityPerformance.completion`, `MicroLearning.completedCount`, or `startedCount`.** All three are empty for the Summer School 2026 course (zero rows, zero counters) even though responses exist, so they silently yield zero for every participant instead of failing. `QuestionResponse` is the reliable signal; cross-check the derived count against the workbook before seeding.

### Dedicated demo participants

The three lecturer-demo courses use dedicated manual participant accounts. The
reconciler is idempotent: it creates the missing account, repairs only the
dedicated account's active/private state, activates its matching leaderboard
participation,
and deactivates an active leaderboard participation in another course without
deleting it.
It never touches the shared `teststudent` account. Course and chatbot names are
resolved under owner shortname `klick`; missing, archived, duplicated, or
re-owned targets fail before any write.

`Participation.isActive` is the course-leaderboard opt-in flag only. The
reconciler's participation updates change leaderboard inclusion; they do not
grant or revoke course, assessment, or chatbot access. Access remains governed
by the endpoint-specific authorization and invitation/account rules, so a
leaderboard change must never be presented as a security change.

| Demo         | Course                  | Chatbot                     | Participant username  | Password secret name                             |
| ------------ | ----------------------- | --------------------------- | --------------------- | ------------------------------------------------ |
| IuW          | `testkurs IuW`          | `Informatik und Wirtschaft` | `teststudent-iuw`     | `KLICKER_DEMO_IUW_PARTICIPANT_PASSWORD`          |
| RadioSurfVet | `testkurs RadioSurfVet` | `RadioSurfVet`              | `teststudent-rsv`     | `KLICKER_DEMO_RADIOSURFVET_PARTICIPANT_PASSWORD` |
| Culture      | `Demo Course Copy`      | `Culture Scenario Lab`      | `teststudent-culture` | `KLICKER_DEMO_CULTURE_PARTICIPANT_PASSWORD`      |

Run this from the repository root with the PRD operator profile. The default
mode and `--readback` are read-only; `--apply` is the sole write mode and
requires all three password mappings. The operator injects `DATABASE_URL` and
the password values only into this child process, so no `.env` file or shell
history entry carries them:

```bash
rs-infisical-operator --profile klicker-prd run \
  --map DATABASE_URL=DATABASE_URL \
  -- pnpm --filter @klicker-uzh/prisma-data run seed:demo-participants

rs-infisical-operator --profile klicker-prd run \
  --map DATABASE_URL=DATABASE_URL \
  -- pnpm --filter @klicker-uzh/prisma-data run seed:demo-participants --readback

rs-infisical-operator --profile klicker-prd run \
  --map DATABASE_URL=DATABASE_URL \
  --map KLICKER_DEMO_IUW_PARTICIPANT_PASSWORD=KLICKER_DEMO_IUW_PARTICIPANT_PASSWORD \
  --map KLICKER_DEMO_RADIOSURFVET_PARTICIPANT_PASSWORD=KLICKER_DEMO_RADIOSURFVET_PARTICIPANT_PASSWORD \
  --map KLICKER_DEMO_CULTURE_PARTICIPANT_PASSWORD=KLICKER_DEMO_CULTURE_PARTICIPANT_PASSWORD \
  -- pnpm --filter @klicker-uzh/prisma-data run seed:demo-participants --apply
```

The password names need exact read and write permission in that profile before
the first run. Write permission is used only to create a missing random value
with `rs-infisical-operator set-random --bytes 32`; do not rotate an existing
value without a separate decision. Never print, copy, or read back the values.
The script reports fixed target labels, status names, and booleans only. The
apply transaction verifies active, private, manual accounts, matching active
participations, password matches, and no active off-target participation before
commit; run `--readback` afterward for the non-secret account and participation
checks.

These password variables are deliberately not added to `turbo.json` global
environment inputs. Broad Turbo propagation would expose credentials to
unrelated tasks, so invoke this maintenance script directly through the
operator boundary.

Supported `prisma-data` dev, QA, Playwright-CI, and production-flashcard seed wrappers run `packages/graphql/src/scripts/importExportSeedFingerprintBootstrap.ts` after their data writer. The sequential wrapper uses `--continue-on-error`, so it still repairs rows changed before a partial writer failure and then preserves a non-zero overall exit. The bootstrap uses the same rollout advisory mutex, a four-minute cooperative budget, and at most ten bounded repair passes; it succeeds only when no active answer collection or element remains null or version-stale. Reaching either bound fails closed with guidance to run the guarded rollout backfill rather than turning a seed into an unbounded database scan. Flashcard helper updates explicitly clear both fingerprint fields before changing an existing element, so content changes enter the stale repair path without forcing a full-corpus rescan in the normal case. A canonicalization, persistence, lock, or backlog failure makes the seed command fail. The bootstrap never chooses an environment itself: it inherits the exact `DATABASE_URL` already selected by the surrounding dev/staging/production seed wrapper, so it cannot silently switch to another target. `seed:test:raw` is the internal data writer; supported callers use fingerprint-safe `seed:test`.

## Typed Json fields

Json columns are typed via `prisma-json-types-generator`: a `/// [TypeName]` doc comment on the field (e.g. `[PrismaElementOptions]` in `element.prisma`) maps to declarations in `packages/graphql/src/types/app.ts` (`declare global { namespace PrismaJson { … } }`), which import shapes from `@klicker-uzh/types`. Add the comment AND the declaration when introducing a typed Json field. `Chatbot.standardModeConfig` follows this pattern with the shared `ChatbotStandardModeConfig` shape; `apps/chat/src/types/app.d.ts` declares the same mapping for Chat's generated Prisma payloads. Run `util/sync-schema.sh` after editing shared schema files so the Analytics mirror stays aligned (its owned generator and datasource files remain untouched).

## Schema-level gotchas

- **Prisma `Decimal` is an object, never truthy-check it** — `Decimal(0)` is truthy. Convert with a `toNumber()` helper and compare with `!= null` (pattern in `packages/graphql/src/services/chatbots.ts`).
- **`Participant` email is unique per auth mode**: `@@unique([email, isSSOAccount])` means the same normalized email can exist once as manual and once as SSO. Queries by email alone can return the wrong account; blocking new cross-mode duplicates must happen in service logic (`packages/graphql/src/services/accounts.ts`).

## Adjacent: export package (`packages/export`)

Data-export gotchas that bite when touching report generation:

- Prisma relation inference can collapse nested `ElementInstance`/`ElementBlock` selects to `never` — keep explicit row DTOs at the query boundary and cast once there.
- ExcelJS sheet names collide **case-insensitively** and cap at 31 chars — dedupe on a lowercase key (`exportCourse.ts`).
- ExcelJS `autoFilter` must span data rows: a header-only range (or autoFilter on an empty sheet) makes Excel flag the workbook as corrupt on open — set `to.row` to the last data row and skip autoFilter on header-only sheets (`exportCourse.ts:addSheet`).
