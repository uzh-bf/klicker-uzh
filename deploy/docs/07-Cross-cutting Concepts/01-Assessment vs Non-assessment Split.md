# Assessment vs Non-assessment Split

Isolation pattern that runs “assessment” workloads as separate Kubernetes deployments (and domains) with stricter ingestion rules and separate Redis, while reusing the same codebases.

## Concept

- “Assessment” mode is a deployment variant for high-stakes exams (stricter auth, correlation tracking, and reduced blast radius).
- The split is implemented as separate Helm Deployments/Ingresses plus runtime gating via `ASSESSMENT_MODE='true'`.
- Assessment data-path isolation primarily uses a dedicated Redis connection (`REDIS_ASSESSMENT_*`) and an assessment-only dedup key (`...:votes`).

## How it works

- Request routing in the ingestion edge:
  - `POST /AddResponse` switches to assessment handling when `process.env.ASSESSMENT_MODE === 'true'`.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts`
- Assessment submission validation (before Hatchet dispatch):
  - Verifies `correlationKey` as a JWT (`APP_SECRET`) with issuer `APP_ORIGIN_ASSESSMENT_API`.
  - Requires Edu-ID participant auth via NextAuth cookie `next-auth.participant-session-token` (issuer `APP_ORIGIN_AUTH`, scope `UserLoginScope.EDUID`).
  - Deduplicates via assessment Redis: `HGET lq:{liveQuizId}:i:{instanceId}:votes {correlationId}` and returns `208` on duplicates.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts`
- Processing split in the response processor worker:
  - Non-assessment uses `process-authenticated-response` (durable, `Priority.HIGH`) and `process-anonymous-response` (`Priority.MEDIUM`).
  - Assessment uses workflow `process-assessment-response-workflow` + aggregation on `response-processed:aggregation`.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/index.ts`
- Cache split inside GraphQL services:
  - Live quiz cache uses `ctx.redisAssessmentExec` when `quiz.isAssessmentEnabled` and otherwise `ctx.redisExec`.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/packages/graphql/src/services/liveQuizzes.ts`
- Helm separation (separate Deployments/Ingresses and assessment-specific ConfigMaps):
  - Deployments: `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/deployment-assessment.yaml`
  - Response API Deployments (includes `*-response-api-assessment`): `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/deployment-response-api.yaml`
  - Hatchet workers Deployments (includes `*-hatchet-worker-response-processor-assessment`): `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/deployment-hatchet-workers.yaml`
  - Assessment backend ConfigMap (`ASSESSMENT_MODE: 'true'`): `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/cm-backend-assessment.yaml`
  - Assessment response-api ConfigMap (`ASSESSMENT_MODE: 'true'`): `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/cm-response-api-assessment.yaml`
  - Assessment worker ConfigMap (`ASSESSMENT_MODE: 'true'`): `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/cm-hatchet-workers.yaml`
  - Assessment ingresses: `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/ingress-frontend-assessment.yaml`, `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/ingress-backend-assessment.yaml`, `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/ingress-response-api-assessment.yaml`

## Affected workloads

- `[[Frontend PWA]]` / `[[Frontend PWA - Assessment]]`
- `[[Backend GraphQL]]` / `[[Backend GraphQL - Assessment]]`
- `[[Response API]]` / `[[Response API - Assessment]]`
- `[[Hatchet Worker - Response Processor]]` / `[[Hatchet Worker - Response Processor - Assessment]]`
- `[[Hatchet Worker - General]]` (shared scheduling + cron tasks)

## Configuration

- `ASSESSMENT_MODE` — gate
- `APP_SECRET` — jwt
- `APP_ORIGIN_AUTH` — jwt-iss
- `APP_ORIGIN_ASSESSMENT_API` — jwt-iss
- `CORS_ALLOWED_ORIGINS` — cors
- `REDIS_ASSESSMENT_HOST` — redis
- `REDIS_ASSESSMENT_PORT` — redis
- `REDIS_ASSESSMENT_PASS` — redis
- `REDIS_ASSESSMENT_TLS` — redis

## Related docs

- [[02-Live Quiz - Assessment]]
- [[01-Live Quiz - Non-assessment]]
- [[03-Redis Topology]]
- [[04-Hatchet Eventing]]
