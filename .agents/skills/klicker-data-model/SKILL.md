---
name: klicker-data-model
description: Change the KlickerUZH Prisma schema, write migrations, or update seed data. Use when editing packages/prisma schema files, adding models/fields/enums, creating typed Json fields, syncing the analytics Python schema, or when a schema change must reach GraphQL types and e2e fixtures.
---

# KlickerUZH Data Model Work

Facts (schema layout, seed paths, gotchas): [docs/data-and-migrations.md](../../../docs/data-and-migrations.md); domain vocabulary: [docs/domain-model.md](../../../docs/domain-model.md). Reference schema-change feature: commit `38c92d035` (#4958).

## The ritual (in full, every time)

```bash
# 1. edit the right area file in packages/prisma/src/prisma/schema/ (15 schema files)
pnpm run prisma:migrate      # 2. create/apply migration + regenerate TS client (needs dev postgres)
pnpm run prisma:sync         # 3. mirror model files into apps/analytics — NEVER skip
pnpm run build               # 4. regenerate Prisma client + dependent packages
```

Then, if the change is API-visible: update Pothos types/resolvers (`klicker-graphql-api`) — the Pothos Prisma plugin picks up new fields, but object types expose them explicitly.

Run Prisma client generation through `pnpm --filter @klicker-uzh/prisma generate` (or a build/migrate/push wrapper that calls it). Prisma 7.8 and JSON generator 5.1 emit TypeScript 6-compatible declarations directly; there is no generated-source patch. The package's canonical `check` regenerates before compiling.

Provenance: steps 2 requires a database; on a machine without one running, write the schema change and STOP — hand the migration step to the user rather than faking a migration file.

## Rules that prevent real incidents

- **Pick the right area file** — don't create new `.prisma` files; `js.prisma` is generators-only and the shared `datasource.prisma` declares only the provider. JavaScript URLs live in `packages/prisma/prisma.config.ts`.
- **Migrations may carry data backfills** (plain SQL in the migration file — `ROW_NUMBER()` example in `20260414223500_*`). Write the backfill in the same migration as the DDL.
- **Every migration must be expand-contract (backward-compatible).** Deployments apply migrations as an ArgoCD PreSync hook _while the previous app version is still serving_, so a drop/rename/narrowing that the old code still depends on takes production down. Split it across releases: add and backfill first, switch the code, remove in a later release. There is no automatic undo — a wrong migration is recovered by rolling forward with a compensating one, and a failed one blocks every deploy to that environment ([runbook](../../../docs/data-and-migrations.md#recovering-a-failed-migration-hook)). Lock-heavy DDL runs unattended with no `lock_timeout`: an `ACCESS EXCLUSIVE` wait queues app queries behind it.
- **Typed Json fields are two edits**: `/// [TypeName]` doc comment on the field AND the declaration in `packages/graphql/src/types/app.ts` (`PrismaJson` namespace, shape from `@klicker-uzh/types`).
- **Student-owned cards** use the `PersonalElement` and `ChatGenerationApproval` models. Their `origin`, `options`, and `sources` fields remain explicit or typed JSON, source metadata is bounded and contains no retrieved text, and the participant/course relations must be kept in sync with the schema file and migration. Personal cards have no lecturer verification state; course adoption is a later copy into a lecturer-owned `Element`.
- **Decimal fields**: Python client needs `enable_experimental_decimal = true` in `apps/analytics/prisma/schema/py.prisma` (already set — don't remove); TS side never truthy-checks Decimals.
- **Don't touch synced Analytics model files by hand** — `prisma:sync` overwrites them while preserving Analytics-owned `py.prisma` and `datasource.prisma`.
- **Participant email uniqueness is per auth mode** (`@@unique([email, isSSOAccount])`) — cross-mode duplicate prevention lives in service logic, not the schema.
- **KB ingestion has two state axes** — `KBResource` holds the latest operation plus active serving identity; `KBIngestionRun` is append-only. Lecturer runs use the ingestion attempt/idempotency UUID; a signed `resource.content_refreshed` webhook uses its event UUID and persists the platform operation ID. A platform refresh may advance only serving identity and must not overwrite a current lecturer operation; resource-list operation status and filtering must resolve through the stored attempt, not the newest ledger row; a failed replacement must not erase the active version.
- **KB graph pointers are untrusted state** — `KB.publishedGraphBuildId` is a plain UUID rather than a relation. A reader must verify that the resolved `KBGraphBuild` belongs to the requested KB and is `SUCCEEDED` before using its graph name; retain old per-build graphs through a grace period and never sweep the active or published graph.
- **KB graph cost state is a locked ledger** — `KBGraphQuota` is unique per owner and semester, `KBGraphBuild.costStatus` fences reservation settlement by build id, and `dispatchClaimedAt` durably distinguishes an unattempted dispatch from an accepted-but-uncorrelated provider run. All monetary and persisted usage counters stay within PostgreSQL `INTEGER` bounds. Use the `ON CONFLICT DO NOTHING` insert followed by a row lock for concurrent first reservations; valid metered non-success terminal results settle actual usage without publishing, while invalid, mismatched, overflowed, or cleanup-fenced results become `NEEDS_HUMAN_REVIEW` and retain the reservation. A timed-out success may publish only after locked no-newer-build and current-digest reconciliation; stale or superseded late results settle without publication.
- **KB/chatbot activation is a database invariant** — `KBChatbot` may keep disabled history, but a SQL partial unique index permits only one enabled KB per chatbot. Prisma cannot express that index; preserve and verify it in the migration SQL.
- **KB deletion retains correlation state** — `KB`/`KBResource` tombstones hide owner reads immediately, while `KBIngestionOperation.DELETE` runs remain until external serving is empty and storage cleanup succeeds. Preserve the restrictive `KBUploadTicket` relation so pending uploads block parent hard deletion.
- **KB quotas count retained allocations** — include every resource row (including tombstones) plus every upload ticket for the 100-item limit, and sum resource plus ticket `sizeBytes` for the 500 MiB limit. Allocate under the parent-KB row lock; confirmation consumes a reservation rather than claiming quota again. An unknown-size URL row reserves the full 25 MiB source limit until the worker records its measured size.
- **KB scale operations preserve stable order** — resource cursors use immutable `createdAt` plus UUID, and bulk mutations lock the live parent before sorted resource ids. Do not make `createdAt` mutable or introduce a competing child-first lock order.
- **KB owner cascade is not a cleanup mechanism** — `KB.owner` currently uses `onDelete: Cascade`; deleting a User would remove resource/run correlation before external and Blob cleanup. Any future account-deletion or GDPR flow must complete the KB tombstone lifecycle before deleting the User.

## Seeds — two independent paths

A fixture needed by tests must be added to EACH consumer:

| Consumer             | Seed location                                                           |
| -------------------- | ----------------------------------------------------------------------- |
| Dev / manual testing | `packages/prisma-data/src/data/seedTEST.ts` (+ topic modules alongside) |
| Playwright           | `seedDatabase()` in `playwright/global-setup.ts`                        |

Prisma 7 reset/migrate commands do not seed automatically. The legacy host uses `pnpm run prisma:setup`; the self-contained DevPod uses the raw reset/push/Prisma Data seed sequence in `.devcontainer/post-create.sh`. Both are explicit and **destructive** — apply `klicker-environment-doctor` check 8 first.

## Boot-time data migrations (rare)

One-off production data fixes go into the homegrown runner `apps/backend-docker/src/migration.ts` (own `Migration` table), NOT into Prisma migrations. Currently empty — read its `migrate()` before adding an entry.
