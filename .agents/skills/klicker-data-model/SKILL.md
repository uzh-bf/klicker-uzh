---
name: klicker-data-model
description: Change the KlickerUZH Prisma schema, write migrations, or update seed data. Use when editing packages/prisma schema files, adding models/fields/enums, creating typed Json fields, syncing the analytics Python schema, or when a schema change must reach GraphQL types and e2e fixtures.
---

# KlickerUZH Data Model Work

Facts (schema layout, seed paths, gotchas): [docs/data-and-migrations.md](../../../docs/data-and-migrations.md); domain vocabulary: [docs/domain-model.md](../../../docs/domain-model.md). Reference schema-change feature: commit `38c92d035` (#4958).

## The ritual (in full, every time)

```bash
# 1. edit the right area file in packages/prisma/src/prisma/schema/ (14 files by area)
pnpm run prisma:migrate      # 2. create + apply migration (Infisical env dev, needs running postgres)
pnpm run prisma:sync         # 3. mirror schema into apps/analytics — NEVER skip
pnpm run build               # 4. regenerate Prisma client + dependent packages
```

Then, if the change is API-visible: update Pothos types/resolvers (`klicker-graphql-api`) — the Pothos Prisma plugin picks up new fields, but object types expose them explicitly.

Provenance: steps 2 requires a database; on a machine without one running, write the schema change and STOP — hand the migration step to the user rather than faking a migration file.

## Rules that prevent real incidents

- **Pick the right area file** — don't create new `.prisma` files; `js.prisma` is generators-only, `datasource.prisma` is shared config.
- **Migrations may carry data backfills** (plain SQL in the migration file — `ROW_NUMBER()` example in `20260414223500_*`). Write the backfill in the same migration as the DDL.
- **Typed Json fields are two edits**: `/// [TypeName]` doc comment on the field AND the declaration in `packages/graphql/src/types/app.ts` (`PrismaJson` namespace, shape from `@klicker-uzh/types`).
- **Decimal fields**: Python client needs `enable_experimental_decimal = true` in `apps/analytics/prisma/schema/py.prisma` (already set — don't remove); TS side never truthy-checks Decimals.
- **Don't touch `apps/analytics/prisma/schema/*.prisma` by hand** — `prisma:sync` overwrites everything except `py.prisma`.
- **Participant email uniqueness is per auth mode** (`@@unique([email, isSSOAccount])`) — cross-mode duplicate prevention lives in service logic, not the schema.
- **KB ingestion has two state axes** — `KBResource` holds the latest operation plus active serving identity; `KBIngestionRun` is append-only. Lecturer runs use the ingestion attempt/idempotency UUID; a signed `resource.content_refreshed` webhook uses its event UUID and persists the platform operation ID. A platform refresh may advance only serving identity and must not overwrite a current lecturer operation; a failed replacement must not erase the active version.
- **KB/chatbot activation is a database invariant** — `KBChatbot` may keep disabled history, but a SQL partial unique index permits only one enabled KB per chatbot. Prisma cannot express that index; preserve and verify it in the migration SQL.
- **KB deletion retains correlation state** — `KB`/`KBResource` tombstones hide owner reads immediately, while `KBIngestionOperation.DELETE` runs remain until external serving is empty and storage cleanup succeeds. Preserve the restrictive `KBUploadTicket` relation so pending uploads block parent hard deletion.
- **KB quotas count retained allocations** — include every resource row (including tombstones) plus every upload ticket for the 100-item limit, and sum resource plus ticket `sizeBytes` for the 500 MiB limit. Allocate under the parent-KB row lock; confirmation consumes a reservation rather than claiming quota again. An unknown-size URL row reserves the full 25 MiB source limit until the worker records its measured size.
- **KB scale operations preserve stable order** — resource cursors use immutable `createdAt` plus UUID, and bulk mutations lock the live parent before sorted resource ids. Do not make `createdAt` mutable or introduce a competing child-first lock order.
- **KB owner cascade is not a cleanup mechanism** — `KB.owner` currently uses `onDelete: Cascade`; deleting a User would remove resource/run correlation before external and Blob cleanup. Any future account-deletion or GDPR flow must complete the KB tombstone lifecycle before deleting the User.

## Seeds — three independent paths

A fixture needed by tests must be added to EACH consumer:

| Consumer             | Seed location                                                           |
| -------------------- | ----------------------------------------------------------------------- |
| Dev / manual testing | `packages/prisma-data/src/data/seedTEST.ts` (+ topic modules alongside) |
| Cypress              | `seedDatabase()` task in `cypress/cypress.config.ts`                    |
| Playwright           | `seedDatabase()` in `playwright/global-setup.ts`                        |

Reseeding dev (`pnpm run prisma:setup`) is **destructive** — apply `klicker-environment-doctor` check 8 first.

## Boot-time data migrations (rare)

One-off production data fixes go into the homegrown runner `apps/backend-docker/src/migration.ts` (own `Migration` table), NOT into Prisma migrations. Currently empty — read its `migrate()` before adding an entry.
