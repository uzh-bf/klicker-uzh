# OLAT API

REST API (Express.js) providing a simplified, API-key protected interface for LMS integrations (notably OpenOLAT). It exposes course and activity configuration endpoints based on Klicker data in PostgreSQL.

## Code

- App: `apps/olat-api/`
- Entry point: `apps/olat-api/src/index.ts`
- Query/service layer: `apps/olat-api/src/services.ts`
- OpenAPI spec: `apps/olat-api/static/openapi.yaml`

## External interface

- Health: `GET /health`
- OpenAPI spec: `GET /openapi.yaml`
- API docs UI: `GET /api-docs` (Scalar)
- Configuration API (requires `x-api-key`):
  - `POST /api/configuration/courses`
  - `GET /api/configuration/activityTypes`
  - `POST /api/configuration/course/:courseID/activityTypes`
  - `POST /api/configuration/course/:courseID/:activityTypeKey`

## Responsibilities

- Authenticate requests via API key header (`x-api-key`) and validate content type.
- Apply rate limiting (100 requests/minute per client).
- Resolve lecturer identity via Prisma accounts (`provider` + `providerAccountId`) and return:
  - accessible courses
  - available activity types (and whether subselection is required)
  - concrete activities for a given course + activity type key
- Serve a versioned OpenAPI contract and interactive API docs.

## Dependencies

- **PostgreSQL**: reads Klicker data via Prisma (`@klicker-uzh/prisma`).
- **LMS / OpenOLAT**: primary consumer of these endpoints (contract defined by `static/openapi.yaml`).

## Deployment (Helm)

- Chart: `deploy/charts/klicker-uzh-v3/`
- Deployment template: `deploy/charts/klicker-uzh-v3/templates/deployment-app.yaml` (component `olat-api`)
- ConfigMap: `deploy/charts/klicker-uzh-v3/templates/cm-global.yaml` (shared)
- Secret: `{{ releaseFullname }}-secret-olat-api`
- Service: `deploy/charts/klicker-uzh-v3/templates/service-app.yaml` (port `3000`)
- Ingress: `deploy/charts/klicker-uzh-v3/templates/ingress-olat-api.yaml`

## Configuration (names only)

- `OLAT_API_KEY` — apikey
- `DATABASE_URL` — db
- `PRISMA_LOG_LEVELS` — prisma
- `NODE_ENV` — env

## Notes

- This workload is intentionally REST (not GraphQL) to provide a stable LMS-facing contract and simpler authentication model.
- Related docs: `[[LMS - OpenOLAT and Moodle]]`, `[[Backend GraphQL]]`, `[[00-Component Catalog]]`.
