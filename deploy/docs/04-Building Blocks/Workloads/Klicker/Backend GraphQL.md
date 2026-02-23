# Backend GraphQL

Main backend service providing the GraphQL API used by Klicker frontends (Manage/PWA/Control) and integrations.

## Code

- App: `apps/backend-docker/`
- GraphQL schema/resolvers: `packages/graphql/`

Entry points:

- HTTP server + Redis wiring: `apps/backend-docker/src/index.ts`
- Express + GraphQL Yoga setup: `apps/backend-docker/src/app.ts`

## Responsibilities

- Serve the **GraphQL API** at `POST /api/graphql` (GraphQL Yoga).
- Provide **subscriptions** over WebSocket on the same path (`/api/graphql`).
- Build request **context** (Prisma, Redis, PubSub, Hatchet, tasks) via `@klicker-uzh/graphql`.
- Enforce request hardening via GraphQL armor + CSRF prevention + persisted operations.
- Handle authentication by parsing cookies / bearer tokens and verifying JWTs (see `jwtMiddleware` in `apps/backend-docker/src/app.ts`).

## Dependencies

- **PostgreSQL** via Prisma (`@klicker-uzh/prisma`).
- **Redis** (multiple logical instances):
  - “standard” Redis (`REDIS_*`)
  - “assessment” Redis (`REDIS_ASSESSMENT_*`)
  - “cache/pubsub” Redis (`REDIS_CACHE_*`) used for response caching + subscription PubSub.
- **Hatchet orchestrator** via `@klicker-uzh/hatchet` (tasks/workflows are prepared so the backend can schedule/push work).

## Deployment (Helm)

- Chart: `deploy/charts/klicker-uzh-v3/`
- Deployment template: `deploy/charts/klicker-uzh-v3/templates/deployment-app.yaml` (component `backend-graphql`)
- ConfigMap: `deploy/charts/klicker-uzh-v3/templates/cm-backend-graphql.yaml`
- Secret: `{{ releaseFullname }}-secret-backend-graphql` (referenced via `envFrom.secretRef`)
- Service: `deploy/charts/klicker-uzh-v3/templates/service-app.yaml` (port `3000`)
- Health endpoint: `GET /healthz` (used by probes)

## Configuration (names only)

ConfigMaps provide (non-exhaustive):

- `APP_ORIGIN_*` (from `cm-global.yaml`)
- domain + cookie settings (from `cm-backend-graphql.yaml`)
- Hatchet client settings (non-secret)

Secrets typically provide (non-exhaustive, names only):

- `APP_SECRET` (JWT signing/verification)
- database/Redis connection secrets and other integration credentials as needed

## Notes

- Persisted operations are loaded from `@klicker-uzh/graphql/dist/server.json` (arbitrary operations only allowed in dev/test).
