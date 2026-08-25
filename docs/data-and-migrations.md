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

### Deployment migrations

`prisma migrate deploy` runs **automatically** on every stg and prd rollout as an ArgoCD **`PreSync` hook Job** (`deploy/charts/klicker-uzh-v3/templates/job-migrate.yaml`), not by hand. On prd the hook is **enabled** because the pinned tags have reached a migrator-bearing release (see Bootstrap and rollback below), so normal prd migrations run through ArgoCD. Mechanics:

- A dedicated migrator image (`packages/prisma/Dockerfile`: `node:24.16.0-alpine` + a **local** `prisma` install, carrying `prisma.config.ts` + the schema + `migrations/`) runs `./node_modules/.bin/prisma migrate deploy`. The install must stay local, not `-g` — Prisma 7's `prisma.config.ts` imports `prisma/config`, which only resolves from `/app/node_modules`; the config supplies the datasource URL from `DATABASE_URL`. It exists because the backend runtime image installs `--prod --ignore-scripts` and so ships neither the Prisma CLI nor the migration engine. CI builds it as `backend-docker-migrator{-arm,-amd}` in lockstep with `backend-docker` (`v3_backend-docker-{stg,prd}.yml`). Its image **tag** auto-tracks the backend tag — the chart defaults `migrator.image.tag` to `backendGraphql.image.tag`, so each env pins only the migrator **repository** and never a separate tag.
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

## Typed Json fields

Json columns are typed via `prisma-json-types-generator`: a `/// [TypeName]` doc comment on the field (e.g. `[PrismaElementOptions]` in `element.prisma`) maps to declarations in `packages/graphql/src/types/app.ts` (`declare global { namespace PrismaJson { … } }`), which import shapes from `@klicker-uzh/types`. Add the comment AND the declaration when introducing a typed Json field.

## Schema-level gotchas

- **Prisma `Decimal` is an object, never truthy-check it** — `Decimal(0)` is truthy. Convert with a `toNumber()` helper and compare with `!= null` (pattern in `packages/graphql/src/services/chatbots.ts`).
- **`Participant` email is unique per auth mode**: `@@unique([email, isSSOAccount])` means the same normalized email can exist once as manual and once as SSO. Queries by email alone can return the wrong account; blocking new cross-mode duplicates must happen in service logic (`packages/graphql/src/services/accounts.ts`).
- **One enabled KB per chatbot is a SQL invariant**: Prisma cannot express the partial unique index `KBChatbot_one_enabled_per_chatbot_key`. Preserve it in `packages/prisma/src/prisma/schema/migrations/20260825190000_kb_management_foundation/migration.sql` and any replacement migration. The migration deliberately leaves an existing KB MCP server row unchanged so the previous Chat runtime remains usable during rollout and rollback. The new runtime identifies the reserved `KB` server by name, ignores its persisted credentials, and sends only a scoped token. `packages/prisma-data/src/data/seedMCPServers.ts:seedMCPServers` reconciles new or explicitly reseeded environments to `scope_token` auth and leaves KB MCP configs disabled unless an enabled binding exists.
- **KB upload tickets are quota reservations**: `KBUploadTicket.sizeBytes` is the declared byte reservation. New tickets always persist the exact positive upload size; the database default exists only so pre-W6 ephemeral tickets migrate safely. Quota aggregates include every retained resource and ticket until W5 cleanup removes it.
- **Unknown-size KB URLs reserve the maximum**: `packages/graphql/src/services/knowledge.ts:createKbUrlResource` charges one resource plus 25 MiB under the parent lock. When the worker observes the exact body size, replacement accounting swaps that conservative claim for the measured size; never create an unmeasured URL row with a zero-byte claim.
- **KB list order and bulk locks are deterministic**: resource pagination uses immutable `(createdAt DESC, id DESC)` keys, while bulk deletion locks the live parent KB and then the selected resource UUIDs in sorted order. Preserve `createdAt` as an immutable cursor key and the KB-first lock order when extending list operations.
- **User deletion cannot rely on the KB cascade**: `packages/prisma/src/prisma/schema/knowledge.prisma:KB.owner` has `onDelete: Cascade`, which would remove KB resources and ingestion runs before external and Blob cleanup completes. There is no current user hard-delete path. Any future account-deletion/GDPR implementation must first drive each KB through its tombstone lifecycle and verify cleanup before deleting the User.
- **The source-gateway key is deliberately tenant-wide**: `packages/graphql/src/services/knowledgeSourceGateway.ts:handleKBSourceGateway` authenticates the ingestion bridge with one shared `KB_SOURCE_GATEWAY_KEY`, then resolves the Blob container from the resource's persisted KB owner. It is not a per-owner credential; a valid key plus exact eligible resource id/version crosses owner containers by design. Preserve the live BLOB/digest/status/tombstone predicate before Blob access, and treat key exposure as all-tenant blast radius.
- **KB graph cost accounting is integer-only and transactional**: `KBGraphQuota` is unique per owner and semester, and `reserveKBGraphCost` inserts the row with `ON CONFLICT DO NOTHING`, locks it, and increments `reservedMinorUnits` only after checking the configured limit. `KBGraphBuild.costStatus` is the idempotency fence, while `dispatchClaimedAt` is the durable claim that distinguishes an unattempted dispatch from a provider-accepted run whose correlation is ambiguous. A valid W1 success result settles and publishes; a valid non-success result with metering settles actual usage without publishing; a non-success result without metering releases only an ordinary reservation. Malformed, mismatched, overflowed, or cleanup-fenced results move to `NEEDS_HUMAN_REVIEW` without publishing. A timed-out late success is eligible for publication only after an atomic no-newer-build and current-digest check under the KB/resource lock order; stale or superseded results still settle usage without publication. The worker also refuses active builds unless the reservation fields and linked quota identity are complete, which is the compatibility guard for pre-accounting rows; deploy the schema with old graph dispatch drained or behind a two-phase rollout so an old writer cannot create an unreserved run during migration. Keep `meteredCost` aligned with the typed `PrismaKBGraphMeteredCost` declaration and run `prisma:sync` after editing the shared schema.

## Adjacent: export package (`packages/export`)

Data-export gotchas that bite when touching report generation:

- Prisma relation inference can collapse nested `ElementInstance`/`ElementBlock` selects to `never` — keep explicit row DTOs at the query boundary and cast once there.
- ExcelJS sheet names collide **case-insensitively** and cap at 31 chars — dedupe on a lowercase key (`exportCourse.ts`).
- ExcelJS `autoFilter` must span data rows: a header-only range (or autoFilter on an empty sheet) makes Excel flag the workbook as corrupt on open — set `to.row` to the last data row and skip autoFilter on header-only sheets (`exportCourse.ts:addSheet`).
