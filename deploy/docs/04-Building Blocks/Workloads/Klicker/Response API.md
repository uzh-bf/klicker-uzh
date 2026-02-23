# Response API

HTTP service for ingesting live quiz responses from clients and forwarding them into asynchronous processing via Hatchet.

## Code

- App: `apps/response-api/`
- Entry point: `apps/response-api/src/index.ts`

## External interface

- Health: `GET /healthz` (also `GET /` returns OK JSON)
- Ingest: `POST /AddResponse`
  - In non-assessment mode, the service distinguishes **authenticated** vs **anonymous** based on forwarded participant cookies.
  - The service only forwards participant-related cookies (`participant_token`, `temporary_participant_token`) to downstream processing.

## Responsibilities

- Validate request payload shape (basic JSON + required fields).
- Apply strict CORS allowlist via `CORS_ALLOWED_ORIGINS` (never allow `"null"`).
- Emit Hatchet events:
  - `response-received:authenticated`
  - `response-received:anonymous`
- Provide a simple “backpressure boundary”: responses are accepted quickly and processed asynchronously.

Assessment-specific logic is documented in `04-Building Blocks/Workloads/Assessment/Response API - Assessment.md`.

## Dependencies

- **Redis**:
  - standard Redis (`REDIS_*`)
  - assessment Redis (`REDIS_ASSESSMENT_*`) (also required at startup; the service pings both)
- **Hatchet orchestrator**: used to push events (`hatchetClient.events.push(...)`).

## Deployment (Helm)

- Chart: `deploy/charts/klicker-uzh-v3/`
- Deployment template: `deploy/charts/klicker-uzh-v3/templates/deployment-response-api.yaml`
- ConfigMap: `deploy/charts/klicker-uzh-v3/templates/cm-response-api.yaml`
- Secret: `{{ releaseFullname }}-secret-response-api`
- Service port: `7078`
- Ingress: `deploy/charts/klicker-uzh-v3/templates/ingress-response-api.yaml`

## Configuration (names only)

- `CORS_ALLOWED_ORIGINS`
- `ASSESSMENT_MODE` (must be unset/false for this workload)
- Redis connection vars: `REDIS_*`, `REDIS_ASSESSMENT_*`
- JWT secret used for correlation/auth flows: `APP_SECRET`
