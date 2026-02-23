# Live Quiz - Non-assessment

End-to-end flow for ingesting a live quiz response in non-assessment mode and updating Redis-backed live results (and points/XP for authenticated participants).

## Actors

- Student participant using `[[Frontend PWA]]`
- `[[Response API]]` (ingress + Hatchet event dispatch)
- Hatchet orchestrator (`[[Hatchet Orchestrator]]`)
- `[[Hatchet Worker - Response Processor]]` (response processing)
- Redis (`[[Azure Cache for Redis]]`) for live quiz cache + leaderboards
- `[[Backend GraphQL]]` for block lifecycle (cache init + later persistence)
- PostgreSQL (`[[Azure Database for PostgreSQL]]`) as the durable store (later flush on block close / quiz end)

## Flow

1. **Student submits a response from the session UI**
   - Request is sent with `credentials: 'include'` to `NEXT_PUBLIC_ADD_RESPONSE_URL`.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/frontend-pwa/src/pages/session/[id].tsx`
2. **Response API accepts `POST /AddResponse` and creates a Hatchet event**
   - Validates payload shape (`response`, `liveQuizId`, `instanceId`) and enforces CORS allowlist (`CORS_ALLOWED_ORIGINS`).
   - Forwards only `participant_token` and/or `temporary_participant_token` cookies (no other cookies).
   - Chooses Hatchet event based on cookie presence (not JWT validity):
     - `response-received:authenticated` if either participant cookie name is present
     - `response-received:anonymous` otherwise
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts`
   - Helm: `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/deployment-response-api.yaml`
3. **Hatchet routes the event to the response-processor worker**
   - Anonymous path: `task` with `retries: 1`, `Priority.MEDIUM`.
   - Authenticated path: `durableTask` with `retries: 3`, `Priority.HIGH`.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/index.ts`
4. **Worker verifies participant identity (if cookies were forwarded)**
   - `participant_token` → must decode to role `PARTICIPANT`.
   - `temporary_participant_token` → must decode to role `TEMPORARY_PARTICIPANT`.
   - Invalid/unknown JWTs are logged and treated as “no participant identity”.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/processors/processor.ts`
5. **Worker deduplicates per participant + instance**
   - If identity is known, the worker checks:
     - `HEXISTS lq:{liveQuizId}:i:{instanceId}:responses {participantId}`
     - `HEXISTS lq:{liveQuizId}:i:{instanceId}:responses temporary-{participantId}`
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/processors/processor.ts`
6. **Worker loads instance metadata from Redis**
   - Reads `HGETALL lq:{liveQuizId}:i:{instanceId}:info` and rejects late submissions using `blockClosedAt`.
   - Instance cache is initialized when lecturers activate a block.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/packages/graphql/src/services/liveQuizzes.ts`
7. **Worker updates live results in Redis (pipeline, non-atomic)**
   - Aggregated counts:
     - `HINCRBY lq:{liveQuizId}:i:{instanceId}:results ...`
     - `HINCRBY lq:{liveQuizId}:i:{instanceId}:results participants 1`
   - Open responses store a hash→value map:
     - `HSET lq:{liveQuizId}:i:{instanceId}:responseHashes {md5} {value}`
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/processors/processor.ts`
8. **If participant identity is known: compute points/XP and update leaderboards**
   - Points are computed from correctness + timing bonus (relative to `firstResponseReceivedAt`) using `computeAwardedPoints`.
   - First fully-correct response sets `firstResponseReceivedAt` in `...:info` to anchor the bonus decay.
   - Leaderboards are separated for permanent vs temporary participants:
     - Permanent: `lq:{liveQuizId}:lb`, `lq:{liveQuizId}:xp`, and per-block `lq:{liveQuizId}:b:{blockId}:lb`
     - Temporary: `lq:{liveQuizId}:lbTemporary` and per-block `...:lbTemporary` (no XP)
   - Code (leaderboards + grading glue): `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/processors/helpers.ts`
   - Code (bonus decay math): `/Volumes/HOME/Git/klicker/klicker-uzh/packages/grading/src/index.ts`
9. **On block close / quiz end: GraphQL flushes cache to PostgreSQL**
   - Block close reads cached results to update `ElementInstance` results and publishes updates to clients.
   - Quiz end reads `lq:{liveQuizId}:lb` and `lq:{liveQuizId}:xp` for durable course/participant updates.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/packages/graphql/src/services/liveQuizzes.ts`

## Key decision points

- Event queue selection is based on cookie presence; JWT verification happens in the worker.
- Deduplication is only possible when a participant identity exists (permanent or temporary).
- Timing bonus uses `firstResponseReceivedAt` and declines linearly based on `maxBonusPoints` / `timeToZeroBonus`.
- Temporary participants accumulate points in `*Temporary` leaderboards and do not receive XP.

## Error handling

- Response API:
  - `400` for invalid JSON / missing required fields
  - `204` for CORS preflight
  - `200` for accepted responses (includes `responseTimestamp`)
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts`
- Worker:
  - Missing/invalid response formats return `400` from `processResponseMessage`.
  - Late submissions cancel processing (`ctx.cancel()`), returning `200` without mutating results.
  - Redis connectivity failures throw, relying on Hatchet retries (different between anonymous vs authenticated).

## Related docs

- [[Frontend PWA]]
- [[Response API]]
- [[Hatchet Worker - Response Processor]]
- [[Backend GraphQL]]
- [[Azure Cache for Redis]]
- [[Azure Database for PostgreSQL]]
- [[03-Redis Topology]]
- [[04-Hatchet Eventing]]
