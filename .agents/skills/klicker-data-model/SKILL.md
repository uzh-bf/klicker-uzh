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

## Seeds — three independent paths

A fixture needed by tests must be added to EACH consumer:

| Consumer             | Seed location                                                           |
| -------------------- | ----------------------------------------------------------------------- |
| Dev / manual testing | `packages/prisma-data/src/data/seedTEST.ts` (+ topic modules alongside) |
| Cypress              | `seedDatabase()` task in `cypress/cypress.config.ts`                    |
| Playwright           | `seedDatabase()` in `playwright/global-setup.ts`                        |

Use the supported `prisma-data` seed wrappers rather than invoking `seedTEST.ts`, `seedFlashcards.ts`, or internal `seed:test:raw` directly. `seed`, `seed:raw`, `seed:test`, `seed:qa`, `seed:flashcards`, and `seed:prod:flashcards` run the GraphQL stale-fingerprint repair bootstrap after their writer attempt; they continue to the repair after a partial writer failure while preserving a non-zero overall exit. The bootstrap inherits the wrapper's already-selected `DATABASE_URL`, takes the rollout advisory lock, and is bounded to ten passes/four minutes; it must not select an environment independently or expand into an unbounded historical backfill. Any direct seed helper that updates an existing element must clear `importFingerprint` and `importFingerprintVersion` in the same update so the bounded repair finds semantic changes without a full-corpus scan.

Reseeding dev (`pnpm run prisma:setup`) is **destructive** — apply `klicker-environment-doctor` check 8 first.

## Boot-time data migrations (rare)

One-off production data fixes go into the homegrown runner `apps/backend-docker/src/migration.ts` (own `Migration` table), NOT into Prisma migrations. Currently empty — read its `migrate()` before adding an entry.
