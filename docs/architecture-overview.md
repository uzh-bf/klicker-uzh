---
type: Architecture Overview
title: Architecture Overview
description: System map of apps and packages, the request path from browser to resolver, the async response pipeline, and where business logic lives.
timestamp: '2026-08-12'
tags:
  - architecture
---

# Architecture Overview

> **Migration status (2026-08-03):** GraphQL→tRPC (PR #5132) is open but unmerged — this page describes current reality until it lands, so check its status before touching the API layer. For chat, the AI-SDK route-handler layer **is** the production path after the AI SDK 7 / assistant-ui 0.14 upgrade shipped ([ADR 0003](./adr/0003-chat-framework-upgrade.md)); the Mastra `apps/chat-api` service split stays an open exploration in the draft PRs #5126 / #5129 and no longer implies holding back work on the chat platform. Staged doc/skill changes: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

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

Packages: `graphql` (schema + services + ops — the heart), `prisma` (schema + migrations), `prisma-data` (seeds), `grading` (pure scoring math), `hatchet` (task definitions), `types`, `util` (JWT/cookie helpers), `i18n`, `shared-components`, `markdown`, `export`, `word-cloud`, `next-config`, `transactional` (react-email).

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

## Async response pipeline

Student answers do not hit the GraphQL API. The path is:

1. `apps/response-api` accepts aggregate responses on `POST /AddResponse`, correlated responses on the versioned `POST /AddCorrelatedResponse` path, and assessment responses on the separate assessment path. Correlated admission validates the authored response against the acceptance-time instance snapshot and atomically creates the admitted identity, encrypted pending response, and outbox receipt under the shared quiz/block locks.
2. `apps/hatchet-worker-response-processor` consumes `response-received:{authenticated|anonymous|assessment}` and `response-received:correlated-v1`. Aggregate and correlated events use separate processors: Hatchet carries only the correlated outbox message id, while the correlated processor loads the authoritative row, persists the response through normal quiz end, and applies bounded Redis effects. Database uniqueness and the processed marker make redelivery idempotent; the aggregate path remains Redis-only.
3. `apps/hatchet-worker-general` runs aggregation plus scheduled work (publish/end scheduled activities, publication reconciliation with settlement-gated correlated finalization, and daily crons for group scores and random group assignments) — task definitions in `packages/hatchet/src/index.ts:prepareHatchetTasks`, handlers from `@klicker-uzh/graphql`.

Consequence: **publication, scheduling, and live-response features silently do nothing without a running Hatchet + workers** — mutations may even fail with `workflow not found`. The general worker selects its workflows via the `HATCHET_WORKFLOWS` env var (default: all).

The manage Live Quiz wizard persists `LiveQuizResponseCollectionMode` with the
activity (`apps/frontend-manage/src/components/activities/creation/liveQuiz/submitLiveQuizForm.tsx:submitLiveQuizForm`). Aggregate anonymous collection is the default; assessment courses force that mode, and correlated export cannot be combined with gamification. Once a quiz is published, the wizard keeps the response mode and incompatible course choices locked. The student page (`apps/frontend-pwa/src/pages/session/[id].tsx:ensureCorrelatedResponseIdentity`) initializes one anonymous response identity per quiz before using `POST /AddCorrelatedResponse`; it uses the HttpOnly respondent cookie when retained and a memory-only signed bearer token when the cookie is blocked. Aggregate responses continue through `POST /AddResponse`. The ended-quiz evaluation exposes the CSV download only when `canExportCorrelatedResponses` is true (`apps/frontend-manage/src/components/evaluation/CorrelatedResponseExport.tsx:CorrelatedResponseExport`).

The backend also runs a homegrown boot-time data-migration runner (`apps/backend-docker/src/migration.ts:migrate`, currently an empty list) tracked in its own `Migration` table — distinct from Prisma migrations.

## Subscriptions

`graphql-ws` on the same HTTP server (`apps/backend-docker/src/index.ts`), backed by Redis pub/sub. End-to-end example: service publishes (`services/feedbacks.ts` → `ctx.pubSub.publish('feedbackCreated', …)`), subscription field filters by quiz id (`schema/subscription.ts:feedbackCreated`), frontend consumes via `subscribeToMore` (`apps/frontend-manage/src/components/interaction/AudienceInteraction.tsx`).
