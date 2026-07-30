---
type: Data Layer
title: Data & Migrations
description: Split Prisma schema, the migrate→sync→generate ritual, seeding paths, typed Json fields, and schema-level gotchas.
timestamp: '2026-07-30'
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
- **One enabled KB per chatbot is a SQL invariant**: Prisma cannot express the partial unique index `KBChatbot_one_enabled_per_chatbot_key`. Preserve it in `packages/prisma/src/prisma/schema/migrations/20260727124500_kb_chatbot_binding/migration.sql` and any replacement migration. `packages/prisma-data/src/data/seedMCPServers.ts:seedMCPServers` reconciles the KB server to `scope_token` auth and leaves KB MCP configs disabled unless an enabled binding exists.
- **KB upload tickets are quota reservations**: `KBUploadTicket.sizeBytes` is the declared byte reservation. New tickets always persist the exact positive upload size; the database default exists only so pre-W6 ephemeral tickets migrate safely. Quota aggregates include every retained resource and ticket until W5 cleanup removes it.
- **Unknown-size KB URLs reserve the maximum**: `packages/graphql/src/services/knowledge.ts:createKbUrlResource` charges one resource plus 25 MiB under the parent lock. When the worker observes the exact body size, replacement accounting swaps that conservative claim for the measured size; never create an unmeasured URL row with a zero-byte claim.
- **KB list order and bulk locks are deterministic**: resource pagination uses immutable `(createdAt DESC, id DESC)` keys, while bulk deletion locks the live parent KB and then the selected resource UUIDs in sorted order. Preserve `createdAt` as an immutable cursor key and the KB-first lock order when extending list operations.
- **User deletion cannot rely on the KB cascade**: `packages/prisma/src/prisma/schema/knowledge.prisma:KB.owner` has `onDelete: Cascade`, which would remove KB resources and ingestion runs before external and Blob cleanup completes. There is no current user hard-delete path. Any future account-deletion/GDPR implementation must first drive each KB through its tombstone lifecycle and verify cleanup before deleting the User.
- **The source-gateway key is deliberately tenant-wide**: `packages/graphql/src/services/knowledgeSourceGateway.ts:handleKBSourceGateway` authenticates the ingestion bridge with one shared `KB_SOURCE_GATEWAY_KEY`, then resolves the Blob container from the resource's persisted KB owner. It is not a per-owner credential; a valid key plus exact eligible resource id/version crosses owner containers by design. Preserve the live BLOB/digest/status/tombstone predicate before Blob access, and treat key exposure as all-tenant blast radius.

## Adjacent: export package (`packages/export`)

Data-export gotchas that bite when touching report generation:

- Prisma relation inference can collapse nested `ElementInstance`/`ElementBlock` selects to `never` — keep explicit row DTOs at the query boundary and cast once there.
- ExcelJS sheet names collide **case-insensitively** and cap at 31 chars — dedupe on a lowercase key (`exportCourse.ts`).
- ExcelJS `autoFilter` must span data rows: a header-only range (or autoFilter on an empty sheet) makes Excel flag the workbook as corrupt on open — set `to.row` to the last data row and skip autoFilter on header-only sheets (`exportCourse.ts:addSheet`).
