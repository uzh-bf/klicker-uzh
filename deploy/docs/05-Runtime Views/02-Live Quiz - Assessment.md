# Live Quiz - Assessment

End-to-end flow for assessment live quiz submissions, including correlation tracking, Edu-ID enforcement, audit logging, and direct persistence to PostgreSQL.

## Actors

- Student participant using `[[Frontend PWA - Assessment]]`
- `[[Response API - Assessment]]` (ingress + validation + Hatchet dispatch)
- Hatchet orchestrator (`[[Hatchet Orchestrator]]`)
- `[[Hatchet Worker - Response Processor - Assessment]]` (workflow + aggregation)
- Assessment Redis (`REDIS_ASSESSMENT_*`) for dedup + live aggregation
- PostgreSQL (`[[Azure Database for PostgreSQL]]`) for `LiveQuizResponse` persistence
- Audit log task (`create-audit-log-entry`)

## Flow

1. **Student submits an assessment response**
   - Client posts `correlationKey`, `response`, `liveQuizId`, `instanceId` to `NEXT_PUBLIC_ADD_RESPONSE_URL` with cookies.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/frontend-pwa/src/pages/session/[id].tsx`
2. **Response API routes `/AddResponse` to assessment logic (`ASSESSMENT_MODE='true'`)**
   - Validates request body and required fields.
   - Verifies `correlationKey` as a JWT using `APP_SECRET` with issuer `APP_ORIGIN_ASSESSMENT_API`.
   - Confirms `correlationKey.liveQuizId` and `correlationKey.instanceId` match the request.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts`
   - Helm: `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/deployment-response-api.yaml`
3. **Response API enforces Edu-ID participant authentication**
   - Reads cookie `next-auth.participant-session-token` and verifies it as JWT (`APP_SECRET`) with issuer `APP_ORIGIN_AUTH`.
   - Requires `role === 'PARTICIPANT'` and `scope === UserLoginScope.EDUID`, otherwise returns `401`.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts`
4. **Response API derives a correlation ID and logs receipt**
   - `correlationId = md5("{correlationKey}:{participantId}")`.
   - Emits `create-audit-log-entry` events with `correlationId` for traceability.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts`
   - Code (audit task): `/Volumes/HOME/Git/klicker/klicker-uzh/packages/hatchet/src/index.ts`
5. **Ingress deduplication in assessment Redis**
   - Checks `HGET lq:{liveQuizId}:i:{instanceId}:votes {correlationId}`.
   - If present, returns `208 Already Reported` without dispatching to Hatchet.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts`
6. **Response API dispatches Hatchet event `response-received:assessment`**
   - Payload includes `correlationId`, `participantId`, `liveQuizId`, `instanceId`, `response`, `responseTimestamp`.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts`
7. **Hatchet workflow processes the response with durable execution**
   - Workflow: `process-assessment-response-workflow` on `response-received:assessment`.
   - Durable task: `process-assessment-response` (`retries: 3`, `Priority.HIGH`).
   - Failure handler: `log-assessment-response-failure` emits `create-audit-log-entry`.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/index.ts`
8. **Worker validates, grades, checks participation, and persists to DB**
   - Uses assessment Redis (`REDIS_ASSESSMENT_*`) and reads instance metadata from `HGETALL lq:{liveQuizId}:i:{instanceId}:info`.
   - Rejects late submissions using `blockClosedAt` and cancels duplicates at DB level.
   - Computes:
     - base points (from `basePoints` + `defaultPoints`)
     - correctness + bonus points (timing bonus anchored by `firstResponseReceivedAt`)
     - XP (for correct submissions)
   - Enforces that the participant has a `Participation` in the assessment course.
   - Persists `LiveQuizResponse` with `instanceId`, `elementBlockExecution`, and `participantId` as a uniqueness boundary.
   - Writes `HSET lq:{liveQuizId}:i:{instanceId}:votes {correlationId} true` after DB success.
   - Emits `response-processed:aggregation` for live-result aggregation.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts`
9. **Aggregation task updates Redis results (concurrency-limited per instance)**
   - Durable task: `aggregate-assessment-responses` (`retries: 1`, `Priority.MEDIUM`).
   - Concurrency key: `input.instanceId`, `maxRuns: 1`, `GROUP_ROUND_ROBIN`.
   - Updates `lq:{liveQuizId}:i:{instanceId}:results` (and `:responseHashes` for open responses) and optionally leaderboards.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/index.ts`
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts`

## Key decision points

- `ASSESSMENT_MODE` switches `/AddResponse` into correlation + Edu-ID enforcement.
- `correlationKey` must be signed with issuer `APP_ORIGIN_ASSESSMENT_API` and match `liveQuizId` + `instanceId`.
- Participants must have `UserLoginScope.EDUID` and a `Participation` in the assessment course.
- Deduplication happens in multiple places (Redis votes hash, DB uniqueness check, Redis votes write after DB success).
- Aggregation is serialized per instance using Hatchet concurrency limits.

## Error handling

- Response API:
  - `400` for invalid/missing fields or correlation JWT mismatch
  - `401` for missing/invalid Edu-ID participant cookie
  - `208` for duplicate submissions detected via `...:votes`
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts`
- Worker:
  - `NonRetryableError` is used for validation/auth failures to stop retries.
  - Late submissions and DB-detected duplicates cancel processing (`ctx.cancel()`), returning `208` or `200` depending on stage.
  - Workflow failure handler emits an audit-log event with the serialized error list.

## Related docs

- [[01-Assessment vs Non-assessment Split]]
- [[Frontend PWA - Assessment]]
- [[Backend GraphQL - Assessment]]
- [[Response API - Assessment]]
- [[Hatchet Worker - Response Processor - Assessment]]
- [[Azure Cache for Redis]]
- [[Azure Database for PostgreSQL]]
- [[04-Hatchet Eventing]]
