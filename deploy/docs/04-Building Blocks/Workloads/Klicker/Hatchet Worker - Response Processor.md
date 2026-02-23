# Hatchet Worker - Response Processor

Hatchet worker responsible for processing live quiz responses emitted by `Response API` and updating live quiz state (Redis) and (for assessment) persistent state (Postgres).

## Code

- App: `apps/hatchet-worker-response-processor/`
- Task/workflow registration: `apps/hatchet-worker-response-processor/src/index.ts`
- Live quiz processing: `apps/hatchet-worker-response-processor/src/processors/processor.ts`
- Assessment processing: `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts`

## Responsibilities (non-assessment mode)

- Consume Hatchet events:
  - `response-received:anonymous`
  - `response-received:authenticated`
- Validate response format and restrictions.
- Update live quiz instance state in Redis (leaderboards, response sets, correctness, etc.).
- Verify participant/temporary participant JWTs when cookies are provided (uses `APP_SECRET`).

## Dependencies

- **Hatchet orchestrator**
- **Redis**:
  - standard Redis (`REDIS_*`) for non-assessment live quiz state
  - assessment Redis (`REDIS_ASSESSMENT_*`) (used by the assessment variant)
- **PostgreSQL** via Prisma (used by assessment processing paths)

## Deployment (Helm)

- Values:
  - Non-assessment: `hatchet.workers.responseProcessor.*`
  - Assessment variant: `hatchet.workers.responseProcessorAssessment.*`
- Deployment template: `deploy/charts/klicker-uzh-v3/templates/deployment-hatchet-workers.yaml`
- ConfigMaps:
  - `config-hatchet-worker-response-processor`
  - `config-hatchet-worker-response-processor-assessment` (sets `ASSESSMENT_MODE='true'`)
- Secrets:
  - `{{ releaseFullname }}-secret-hatchet-worker-response-processor`
  - `{{ releaseFullname }}-secret-hatchet-worker-response-processor-assessment`

## Configuration (names only)

- `ASSESSMENT_MODE` (must be unset/false for this workload; set to `true` in the assessment variant)
- `APP_SECRET` (JWT verification)
- Redis connection vars: `REDIS_*`, `REDIS_ASSESSMENT_*`
- Optional heartbeat integration used by “ping” flow: `FUNCTION_HEARTBEAT_URL`
