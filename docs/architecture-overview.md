---
type: Architecture Overview
title: Architecture Overview
description: System map of apps and packages, the request path from browser to resolver, the async response pipeline, and where business logic lives.
timestamp: '2026-07-29'
tags:
  - architecture
---

# Architecture Overview

> **Migrations in flight (2026-07):** GraphQL→tRPC (PR #5132) and AI-SDK→Mastra (PRs #5126/#5129) are open but unmerged — this page describes current reality until they land. If you touch the API layer or the chat platform, check those PRs' status first. Staged doc/skill changes: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

**The one thing to internalize: the GraphQL codegen artifacts are part of the API contract.** Outside dev/test, the backend executes only _persisted_ operations — it looks incoming hashes up in `@klicker-uzh/graphql/dist/server.json` and rejects unknown ones (`apps/backend-docker/src/app.ts:usePersistedOperations`, `allowArbitraryOperations` only under `NODE_ENV development|test`). Clients send hashes from the sibling `client.json`. Both files (plus `src/ops.ts`) are **git-tracked codegen outputs**: every change to a `.graphql` op or the schema must rerun `pnpm --filter @klicker-uzh/graphql generate` and commit the results, or production-mode requests fail.

## System map

Apps (dev ports in [Getting Started](./getting-started.md)):

| App                                                   | Role                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/backend-docker`                                 | Main GraphQL API (Express + Yoga)                                                   |
| `apps/frontend-manage`                                | Lecturer UI (Next.js, pages router)                                                 |
| `apps/frontend-pwa`                                   | Student PWA (Next.js, pages router)                                                 |
| `apps/frontend-control`                               | Mobile live-quiz controller (pages router)                                          |
| `apps/auth`                                           | Identity provider — Edu-ID OIDC + delegated login (Auth.js, `@auth/prisma-adapter`) |
| `apps/chat`                                           | AI chat (Next.js **app** router — the only one; own conventions)                    |
| `apps/response-api`                                   | Bare-`http` ingest endpoint for student responses                                   |
| `apps/hatchet-worker-general` / `-response-processor` | Async workers (Hatchet)                                                             |
| `apps/analytics`                                      | Python analytics service (own Prisma client)                                        |
| `apps/olat-api`, `apps/lti`, `apps/office-addin`      | LMS/Office integrations                                                             |
| `apps/docs`                                           | User-facing Docusaurus site (not this wiki)                                         |

Packages: `graphql` (schema + services + ops — the heart), `prisma` (schema + migrations), `prisma-data` (seeds), `grading` (pure scoring math), `hatchet` (task definitions), `types`, `util` (JWT/cookie and CodeAPI helpers), `i18n`, `shared-components`, `markdown`, `export`, `word-cloud`, `next-config`, `transactional` (react-email).

## Request flow (query/mutation)

Client side (`apps/frontend-manage/src/lib/apollo.ts`, pwa variant adds an `authLink` injecting `Bearer <participant token>` from sessionStorage): `retryLink → errorLink → createPersistedQueryLink(client.json hashes) → split(ws | http)`. URI is `NEXT_PUBLIC_API_URL` in the browser, `API_URL_SSR` during SSR; a custom `x-graphql-yoga-csrf` header satisfies Yoga's CSRF prevention.

Server side (`apps/backend-docker/src/app.ts:prepareApp`): `cors → cookieParser → jwtMiddleware (verifies cookie/bearer JWT via @klicker-uzh/util:verifyJWT, puts payload on the request) → Yoga at /api/graphql`. Yoga runs `EnvelopArmor`, CSRF prevention, and the persisted-operations gate from the lead paragraph. Context is built by `packages/graphql/src/lib/context.ts:enhanceContext` and carries `prisma`, `redisExec`, `redisAssessmentExec`, `pubSub`, `emitter`, `hatchet`, `tasks`, and the optional `user`. Health: `GET /healthz`.

Redis has three roles, one client each (`apps/backend-docker/src/index.ts`): **exec** (6379, live-quiz execution state), **assessment exec** (6381), **cache + pub/sub** (6380).

## Where logic lives

`packages/graphql/src/` is strictly layered:

- `builder.ts` — Pothos `SchemaBuilder` with `ScopeAuthPlugin`, `PrismaPlugin`, `ZodPlugin`; auth scopes defined once here (details in the API-layer page).
- `schema/*.ts` — Pothos types + root `query.ts`/`mutation.ts`/`subscription.ts`. Resolvers are **one-liners** delegating to services; auth is declared here via `t.withAuth(...)`.
- `services/*.ts` — all business logic, Prisma access, pubSub publishes. Also exported as the `HatchetHandlers` map consumed by workers (`packages/graphql/src/index.ts`).
- `graphql/ops/*.graphql` — hand-written client operations, prefixed `Q`/`M`/`S`/`F` → codegen → `src/ops.ts` + `src/public/{client,server}.json`.

Frontends import generated documents from `@klicker-uzh/graphql/dist/ops` — never write inline gql.

## CODE sandbox grading boundary

The server-only `@klicker-uzh/util/code-api` entry (`packages/util/src/codeApi.ts`) owns the hostile boundary to CodeAPI; it is deliberately absent from the browser-used util root. It loads the `CODEAPI_*` endpoint and asymmetric JWT settings, mints short-lived `klicker_jwt` tokens, and sends only student code plus test invocation arguments. Expected values, weights, and pass/fail decisions remain in Klicker.

Public and hidden tests are derived from the authored visibility and sent in separate `/v1/exec` requests that must return distinct session IDs. Each generated Python batch runner starts a fresh child process group per test, drains its pipes under a byte cap, and kills the full group on timeout or overflow. Authoring and execution share depth, node, and serialized-byte limits for JSON inputs and outputs. The client accepts only the verified flat CodeAPI response, rejects artifacts and unsupported fields, parses a versioned result envelope, compares exact JSON, and returns only the sanitized `CodeSubmissionResult`; raw sessions and hidden diagnostics cannot cross its public boundary.

Participant CODE answers create a participant-owned `CodeSubmissionReceipt` through GraphQL. A partial unique database index permits only one `PENDING` or `RUNNING` receipt for a participant and element instance, so an active resubmission returns the existing receipt. The general Hatchet worker uses expiring claim tokens and a three-claim budget; CodeAPI execution happens outside the database transaction. Finalization first locks the matching claim and shared `ElementInstance` aggregate row, then applies `QuestionResponseDetail`, the participant-specific `QuestionResponse` aggregate, instance-wide results/statistics, spaced repetition, points, XP, leaderboard, timeline, and `COMPLETED` together. Retry after commit and duplicate or concurrent delivery therefore produce no lost or repeated side effects. Completion events contain only the participant receipt; the participant-owned query is the durable polling fallback.

CodeAPI rate limits are deferred in the receipt itself. A `429` releases the active claim back to `PENDING`, records a bounded `retryAt`, and completes the current Hatchet attempt successfully so it cannot spin. Recovery re-enqueues only receipts whose deferral is due; other transient failures still use Hatchet retry behavior, while the database claim budget remains the final fence. The operational timing policy is canonical in [Async and workers](./async-and-workers.md).

The live integration remains gated on the separate CodeAPI deployment accepting the `klicker_jwt` principal source selected in [ADR 0003](./adr/0003-use-klicker-codeapi-principal-source.md). Service-free contract tests cover the client until that gate is open.

## Async response pipeline

Student answers do not hit the GraphQL API. The path is:

1. `apps/response-api` (`handleAddResponse` / `handleAddAssessmentResponse`) accepts `POST /AddResponse`, verifies/dedupes (assessment path: JWT correlation key + Redis `hget`), and emits Hatchet events `response-received:{authenticated|anonymous|assessment}`.
2. `apps/hatchet-worker-response-processor` consumes them (`processAnonymousResponseTask`, `processAuthenticatedResponseTask`, `processAssessmentResponseWorkflow`) and re-emits aggregation events.
3. `apps/hatchet-worker-general` runs aggregation plus scheduled work (publish/end scheduled activities, daily crons for group scores and random group assignments) — task definitions in `packages/hatchet/src/index.ts:prepareHatchetTasks`, handlers from `@klicker-uzh/graphql`.

Consequence: **publication, scheduling, and live-response features silently do nothing without a running Hatchet + workers** — mutations may even fail with `workflow not found`. The general worker selects its workflows via the `HATCHET_WORKFLOWS` env var (default: all).

The backend also runs a homegrown boot-time data-migration runner (`apps/backend-docker/src/migration.ts:migrate`, currently an empty list) tracked in its own `Migration` table — distinct from Prisma migrations.

## Subscriptions

`graphql-ws` on the same HTTP server (`apps/backend-docker/src/index.ts`), backed by Redis pub/sub. End-to-end example: service publishes (`services/feedbacks.ts` → `ctx.pubSub.publish('feedbackCreated', …)`), subscription field filters by quiz id (`schema/subscription.ts:feedbackCreated`), frontend consumes via `subscribeToMore` (`apps/frontend-manage/src/components/interaction/AudienceInteraction.tsx`).
