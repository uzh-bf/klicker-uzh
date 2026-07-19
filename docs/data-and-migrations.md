---
type: Data Layer
title: Data & Migrations
description: Split Prisma schema, the migrate→sync→build ritual, seeding paths, typed Json fields, and schema-level gotchas.
timestamp: '2026-07-19'
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
- Separately, the backend runs a **homegrown boot-time data-migration runner** (`apps/backend-docker/src/migration.ts:migrate`) with its own `Migration` table for one-off data fixes — currently an empty list; don't confuse it with `prisma migrate deploy`. Where `migrate deploy` runs in deployment is **not documented in-repo** (open question — verify before making deploy claims).

## Seeding

Three independent seed paths — changing one does NOT update the others:

1. **Dev seed**: `pnpm run prisma:setup` → seed-free reset + push/generate + an explicit `packages/prisma-data/src/data/seedTEST.ts` run (plus seedAccounts/Achievements/Levels/… modules). Creates the `testuser*` participants and seed courses (credentials: [AGENTS.md](../AGENTS.md) test-credentials section).
2. **Cypress**: its own `seedDatabase()` task in `cypress/cypress.config.ts`.
3. **Playwright**: its own `seedDatabase()` in `playwright/global-setup.ts` with its own fixtures.

Prisma 7 does not seed after migrate/reset automatically. `pnpm run prisma:reset` therefore resets without fixtures. On the legacy host stack with Infisical, use `pnpm run prisma:setup` for the explicit reset/push/seed composite or `pnpm --filter @klicker-uzh/prisma prisma:seed` for seed-only. In the self-contained DevPod, use the environment-ready raw sequence from `.devcontainer/post-create.sh`: `pnpm --filter @klicker-uzh/prisma run prisma:reset:raw --force`, then `pnpm --filter @klicker-uzh/prisma run prisma:push:raw`, then `pnpm --filter @klicker-uzh/prisma-data run seed:raw`. Reset/setup is destructive — run only against demonstrably test-seeded databases.

## Auth adapter compatibility

Auth passes the shared client to `@auth/prisma-adapter` 2.11.2; its peer comparator already admits Prisma 7, so there is no package extension to maintain. `pnpm --filter @klicker-uzh/auth test:prisma-adapter` performs a disposable create/get/link/get/unlink/delete round-trip (`apps/auth/scripts/testPrismaAdapter.mjs`). It refuses remote databases and permits the DevPod `postgres` alias only when DevRouter identifies the workspace outside production mode. Run it only against a disposable local database.

### Production batch seeds

Production batch inputs, comparison sheets, and state dumps stay local and gitignored. The Summer School portfolio seed is isolated from the earlier activity seed and is safe-by-default:

```bash
pnpm --filter @klicker-uzh/prisma-data seed:prod:summerschool:portfolio
```

The default command only validates production references, resolves usernames case-insensitively, writes a comparison CSV and payload-bound before-state dump, and reports the intended point/XP and achievement changes. A write requires a separate `DRY_RUN=false` execution and refuses to start if production state or the payload no longer matches that dump. Dry-run cannot overwrite a changed snapshot, and an after-state dump blocks accidental replay. Writes run atomically and are verified before commit; the after-state dump records the result. Never reuse an earlier Summer School payload for a later activity.

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
