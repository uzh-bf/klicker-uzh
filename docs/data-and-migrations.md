---
type: Data Layer
title: Data & Migrations
description: Split Prisma schema, the migrate→sync→generate ritual, seeding paths, typed Json fields, and schema-level gotchas.
timestamp: '2026-07-14'
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

Forgetting step 3 silently desynchronizes the Python analytics service — `util/sync-schema.sh` copies every `.prisma` file **except `js.prisma`** into `apps/analytics/prisma/schema/`, where a separate `py.prisma` defines the Python generator. Then regenerate the client (`pnpm --filter @klicker-uzh/prisma generate`, or `pnpm run build`) and update GraphQL types/resolvers if the API surface changed ([API layer](./graphql-api-layer.md)).

## Split schema

The schema is a **folder** (`prisma.config.ts` → `schema: 'src/prisma/schema'`), 14 files split by area: `user`, `participant`, `course`, `element`, `quiz`, `response`, `gamification`, `sharing`, `chat`, `analytics`, `resources`, `other`, plus `datasource.prisma` (shared datasource, `DATABASE_URL` + shadow DB) and `js.prisma` (generators only: `prisma-client` ESM output to `../client`, Pothos types, `prisma-json-types-generator`).

The Python twin (`apps/analytics/prisma/schema/py.prisma`) uses `prisma-client-py` with `interface = "sync"` and **`enable_experimental_decimal = true`** — keep that flag whenever shared schema `Decimal` fields exist (chat credit fields are `@db.Decimal(18,6)`), and note the Python side still uses the older `prismaSchemaFolder` preview flag.

## Migrations

- Prisma migrations live in `packages/prisma/src/prisma/schema/migrations/` (189 as of 2026-07-14). Migrations may contain data backfills (SQL `ROW_NUMBER()` etc.), not just DDL.
- Separately, the backend runs a **homegrown boot-time data-migration runner** (`apps/backend-docker/src/migration.ts:migrate`) with its own `Migration` table for one-off data fixes — currently an empty list; don't confuse it with `prisma migrate deploy`.
- The repository exposes explicit Prisma deploy commands: `pnpm --filter @klicker-uzh/prisma run prisma:deploy:qa` and `prisma:deploy:prod` inject the staging/production database URL through Infisical and run `prisma migrate deploy`. No automated production migration job is defined in this repository. Until the deployment repository names one, a release engineer is the executor and a database-operations owner must approve the backup/restore point, observe the run, and own an abort or forward fix. Record the people and command output in the restricted change record; do not infer that application startup applies Prisma migrations.

### Adaptive Phase 10 deployment contract

The three forward-only Phase 10 migrations are, in order:

1. `20260713210000_adaptive_runtime_constraint_validation` repairs deterministic lifecycle gaps, preflight-aborts ambiguous/corrupt values, and validates all six runtime checks. It uses a 5-second lock timeout and a 15-minute statement timeout inside its transaction.
2. `20260713212000_adaptive_competence_tree_audit_type` adds the internal `COMPETENCE_TREE` audit object type.
3. `20260713213000_adaptive_history_retention` replaces destructive owner/config/quiz foreign keys with validated `RESTRICT` constraints, adds a direct attempt-to-course retention constraint, and deliberately preserves participant/participation erasure cascades.

Before either environment is changed, replay the complete chain plus the populated pre-repair fixture on a disposable PostgreSQL 17 database server. `DATABASE_URL` must name an expendable administrative database on that disposable server because the verifier creates and drops a temporary database:

```bash
DATABASE_URL="$DISPOSABLE_POSTGRES_ADMIN_URL" \
  pnpm --filter @klicker-uzh/prisma run verify:adaptive-migration
```

Then follow the backup, aggregate preflight, monitoring, abort, and post-deploy procedure in [Adaptive Learning Operations](./adaptive-learning-operations.md#phase-10-migration-procedure). The migrations have no destructive down migration. Before the first application write, an operations-approved restore may return to the backup; after writes begin, keep the course gate disabled and use a reviewed forward fix so retained attempt history is not silently discarded.

### Adaptive Phase 11 contract cleanup

`20260713220000_adaptive_remove_inert_settings` is a forward-only contract cleanup. It removes `PracticeQuizAdaptiveConfig.standardErrorThreshold`, `showFinalResult`, `showLiveEstimate`, and `enableSelfAssessmentWarmup`, then recreates the numeric and preset checks without those columns. Completion level bands remain mandatory, `classificationZ` remains the only confidence-interval classification setting, and `minimumReachableStandardError` remains a computed readiness diagnostic rather than persisted runtime state. The migration uses a 5-second lock timeout and 5-minute statement timeout and must run with adaptive course flags disabled under the same backup/abort procedure as the preceding adaptive migrations.

A clean PostgreSQL 17 replay of all 189 migrations through the Phase 13 aggregate-release migration is local engineering evidence only. The populated Phase 10 verifier also passes after applying 184 prior migrations and its malformed pre-repair fixture. Staging and production still require the aggregate preflight, named operations owner, tested restore point, timed rehearsal, and forward-fix decision described in the operations runbook.

### Adaptive Phase 13 aggregate releases

`20260714075147_adaptive_cohort_snapshots` adds the typed `AdaptivePracticeQuizCohortSnapshot` aggregate read model, fixed-boundary/policy uniqueness, release/schema checks, completed-attempt/participant/estimate/response indexes, and an attempt-delete trigger that invalidates every snapshot for the affected config. The JSON check admits only schema version 1; the application type contains released aggregate results and no participant, attempt, username, answer, theta, level-result, or person-level timing field.

Snapshot generation is lazy on an authorized lecturer read and runs under the config lock. Participant submission does not write this table. Deleting an attempt, including the participant-erasure cascade, invalidates prior releases before a lower complete boundary can be recomputed. Treat this migration as additive but privacy-sensitive: verify the trigger, unique index, typed JSON generation, concurrent first-read idempotency, and five/ten-person erasure cases on the deployment clone.

## Seeding

Three independent seed paths — changing one does NOT update the others:

1. **Dev seed**: `pnpm run prisma:setup` → reset + push + `packages/prisma-data/src/data/seedTEST.ts` (plus seedAccounts/Achievements/Levels/… modules). Creates the `testuser*` participants and seed courses (credentials: [AGENTS.md](../AGENTS.md) test-credentials section).
2. **Cypress**: its own `seedDatabase()` task in `cypress/cypress.config.ts`.
3. **Playwright**: its own `seedDatabase()` in `playwright/global-setup.ts` with its own fixtures.

`prisma:setup` is destructive — run only against demonstrably test-seeded databases.

## Typed Json fields

Json columns are typed via `prisma-json-types-generator`: a `/// [TypeName]` doc comment on the field (e.g. `[PrismaElementOptions]` in `element.prisma`) maps to declarations in `packages/graphql/src/types/app.ts` (`declare global { namespace PrismaJson { … } }`), which import shapes from `@klicker-uzh/types`. Add the comment AND the declaration when introducing a typed Json field.

## Schema-level gotchas

- **Some adaptive integrity rules are migration-only PostgreSQL DDL.** `20260707120000_adaptive_practice_quiz_competence_trees` contains partial unique indexes for root ordering, in-progress attempts, and overall estimates. `20260710152000_adaptive_tree_integrity` adds same-tree composite foreign keys and an estimate node-kind check. `20260710190000_adaptive_practice_quiz_configuration` persists preset/attempt policy, preserves advanced legacy rows as Research, resets legacy warm-up/schedules, adds same-tree quiz overrides plus config/quiz/participant/participation/course/pool response constraints, installs numeric/preset/no-gamification checks, and creates immutable `PracticeQuizAdaptivePoolItem` snapshots. `20260710210000_adaptive_practice_quiz_runtime` removes the live-assignment next pointer and duplicate trajectory arrays, requires attempt/config/tree and estimate/config/tree identities, renames response trajectory columns to explicit overall semantics, and adds attempt-state, response-score/snapshot, and estimate-consistency checks. Its preflight identifies cross-tree final-level, estimate-node, and estimate-level rows before adding validated foreign keys. `20260712120000_competence_tree_archive_state` adds the explicit `isArchived` state so Manage can distinguish archival from destructive deletion while preserving linked and quiz-referenced trees. `20260713100504_course_adaptive_learning_rollout` adds only the default-false, non-null course rollout flag; it was curated after Prisma attempted to remove migration-only constraints and then verified through a clean 184-migration replay. The runtime checks were initially `NOT VALID` so new writes were protected while legacy rows remained readable; `20260713210000_adaptive_runtime_constraint_validation` now repairs deterministic gaps, rejects ambiguous corruption, and validates all six. `20260713220000_adaptive_remove_inert_settings` recreates adaptive numeric/preset checks after dropping four unsupported configuration columns. `20260714075147_adaptive_cohort_snapshots` adds fixed-boundary aggregate releases and erasure invalidation, plus indexes for bounded cohort selection and diagnostics. Pool-backed responses bind config, pool row, source assignment, and element id as one database identity. Invalid legacy numbers or inconsistent attempt identities fail with explicit migration preconditions instead of being silently normalized. Prisma cannot represent every partial index/check constraint; do not remove migration-only checks merely because they are absent from Prisma schemas.
- **Terminal adaptive attempts are backfilled before the runtime stop-reason constraint.** `20260710210000_adaptive_practice_quiz_runtime` maps abandoned attempts to `ABANDONED`, prefers an existing completed overall-estimate reason, maps a completed row with a final level to `CLASSIFIED`, and otherwise records `INSUFFICIENT_DATA`. A populated pre-runtime upgrade fixture must exercise all four paths; do not replace this with a blanket default that destroys historical meaning.
- **Prisma `Decimal` is an object, never truthy-check it** — `Decimal(0)` is truthy. Convert with a `toNumber()` helper and compare with `!= null` (pattern in `packages/graphql/src/services/chatbots.ts`).
- **`Participant` email is unique per auth mode**: `@@unique([email, isSSOAccount])` means the same normalized email can exist once as manual and once as SSO. Queries by email alone can return the wrong account; blocking new cross-mode duplicates must happen in service logic (`packages/graphql/src/services/accounts.ts`).

## Adjacent: export package (`packages/export`)

Data-export gotchas that bite when touching report generation:

- Prisma relation inference can collapse nested `ElementInstance`/`ElementBlock` selects to `never` — keep explicit row DTOs at the query boundary and cast once there.
- ExcelJS sheet names collide **case-insensitively** and cap at 31 chars — dedupe on a lowercase key (`exportCourse.ts`).
- ExcelJS `autoFilter` must span data rows: a header-only range (or autoFilter on an empty sheet) makes Excel flag the workbook as corrupt on open — set `to.row` to the last data row and skip autoFilter on header-only sheets (`exportCourse.ts:addSheet`).
