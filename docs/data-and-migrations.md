---
type: Data Layer
title: Data & Migrations
description: Split Prisma schema, the migrate→sync→generate ritual, seeding paths, typed Json fields, and schema-level gotchas.
timestamp: '2026-07-10'
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

- Prisma migrations live in `packages/prisma/src/prisma/schema/migrations/` (~170 since 2022). Migrations may contain data backfills (SQL `ROW_NUMBER()` etc.), not just DDL.
- Separately, the backend runs a **homegrown boot-time data-migration runner** (`apps/backend-docker/src/migration.ts:migrate`) with its own `Migration` table for one-off data fixes — currently an empty list; don't confuse it with `prisma migrate deploy`. Where `migrate deploy` runs in deployment is **not documented in-repo** (open question — verify before making deploy claims).

## Seeding

Three independent seed paths — changing one does NOT update the others:

1. **Dev seed**: `pnpm run prisma:setup` → reset + push + `packages/prisma-data/src/data/seedTEST.ts` (plus seedAccounts/Achievements/Levels/… modules). Creates the `testuser*` participants and seed courses (credentials: [AGENTS.md](../AGENTS.md) test-credentials section).
2. **Cypress**: its own `seedDatabase()` task in `cypress/cypress.config.ts`.
3. **Playwright**: its own `seedDatabase()` in `playwright/global-setup.ts` with its own fixtures.

`prisma:setup` is destructive — run only against demonstrably test-seeded databases.

## Typed Json fields

Json columns are typed via `prisma-json-types-generator`: a `/// [TypeName]` doc comment on the field (e.g. `[PrismaElementOptions]` in `element.prisma`) maps to declarations in `packages/graphql/src/types/app.ts` (`declare global { namespace PrismaJson { … } }`), which import shapes from `@klicker-uzh/types`. Add the comment AND the declaration when introducing a typed Json field.

## Schema-level gotchas

- **Some adaptive integrity rules are migration-only PostgreSQL DDL.** `20260707120000_adaptive_practice_quiz_competence_trees` contains partial unique indexes for root ordering, in-progress attempts, and overall estimates. `20260710152000_adaptive_tree_integrity` adds same-tree composite foreign keys and an estimate node-kind check. `20260710190000_adaptive_practice_quiz_configuration` persists preset/attempt policy, preserves advanced legacy rows as Research, resets legacy warm-up/schedules, adds same-tree quiz overrides plus config/quiz/participant/participation/course/pool response constraints, installs numeric/preset/no-gamification checks, and creates immutable `PracticeQuizAdaptivePoolItem` snapshots. Pool-backed responses bind config, pool row, source assignment, and element id as one database identity. `apqr_pool_item_required_check` is deliberately `NOT VALID`: old nullable response rows remain readable, while every new insert must reference a pool item. Invalid legacy numbers or inconsistent attempt identities fail with explicit migration preconditions instead of being silently normalized. Prisma cannot represent every partial index/check constraint; do not remove migration-only checks merely because they are absent from Prisma schemas.
- **Prisma `Decimal` is an object, never truthy-check it** — `Decimal(0)` is truthy. Convert with a `toNumber()` helper and compare with `!= null` (pattern in `packages/graphql/src/services/chatbots.ts`).
- **`Participant` email is unique per auth mode**: `@@unique([email, isSSOAccount])` means the same normalized email can exist once as manual and once as SSO. Queries by email alone can return the wrong account; blocking new cross-mode duplicates must happen in service logic (`packages/graphql/src/services/accounts.ts`).

## Adjacent: export package (`packages/export`)

Data-export gotchas that bite when touching report generation:

- Prisma relation inference can collapse nested `ElementInstance`/`ElementBlock` selects to `never` — keep explicit row DTOs at the query boundary and cast once there.
- ExcelJS sheet names collide **case-insensitively** and cap at 31 chars — dedupe on a lowercase key (`exportCourse.ts`).
- ExcelJS `autoFilter` must span data rows: a header-only range (or autoFilter on an empty sheet) makes Excel flag the workbook as corrupt on open — set `to.row` to the last data row and skip autoFilter on header-only sheets (`exportCourse.ts:addSheet`).
