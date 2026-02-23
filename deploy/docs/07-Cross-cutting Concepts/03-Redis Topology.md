# Redis Topology

Cross-cutting cache pattern using Redis for live quiz state, leaderboards, deduplication, GraphQL pub/sub, and response-cache, with a separate Redis instance for assessment isolation.

## Concept

- Live quiz execution maintains an in-Redis “hot state” keyed by `lq:{liveQuizId}:...` for fast fan-out to many connected clients.
- Assessment flows use a dedicated Redis connection (`REDIS_ASSESSMENT_*`) to isolate exam traffic and support correlation-based deduplication.
- The GraphQL backend also uses a separate “cache” Redis (`REDIS_CACHE_*`) for response caching and subscription pub/sub.

## How it works

- Redis clients (backend):
  - Live execution: `redisExec` (`REDIS_*`).
  - Assessment execution: `redisAssessmentExec` (`REDIS_ASSESSMENT_*`).
  - GraphQL cache + pub/sub: `redisCache`, `publishClient`, `subscribeClient` (`REDIS_CACHE_*`).
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/backend-docker/src/index.ts`
- Redis clients (response ingestion + workers):
  - Response API initializes both `redis` and `assessmentRedis` (`REDIS_*` + `REDIS_ASSESSMENT_*`).
  - Response processor uses `getRedis()` / `getAssessmentRedis()` with the same env var families.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/response-api/src/index.ts`
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/redis.ts`
- Key namespace and hierarchy (live quiz state):
  - Quiz meta: `HSET/HMSET lq:{liveQuizId}:meta ...` (namespace/start time/flags).
  - Instance metadata: `HGETALL lq:{liveQuizId}:i:{instanceId}:info`.
  - Aggregated results: `HINCRBY lq:{liveQuizId}:i:{instanceId}:results ...` and `... participants`.
  - Per-participant responses: `HSET lq:{liveQuizId}:i:{instanceId}:responses {participantId} ...`.
  - Open response mapping: `HSET lq:{liveQuizId}:i:{instanceId}:responseHashes {md5} {value}`.
  - Leaderboards / XP:
    - Global: `lq:{liveQuizId}:lb`, `lq:{liveQuizId}:xp`, `lq:{liveQuizId}:lbTemporary`.
    - Per-block: `lq:{liveQuizId}:b:{blockId}:lb`, `lq:{liveQuizId}:b:{blockId}:lbTemporary`.
  - Assessment-only dedup: `HSET lq:{liveQuizId}:i:{instanceId}:votes {correlationId} true`.
  - Code (cache init/meta/flush): `/Volumes/HOME/Git/klicker/klicker-uzh/packages/graphql/src/services/liveQuizzes.ts`
  - Code (non-assessment processing): `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/processors/processor.ts`
  - Code (leaderboards): `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/processors/helpers.ts`
  - Code (assessment processing): `/Volumes/HOME/Git/klicker/klicker-uzh/apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts`
- Performance/consistency tradeoffs:
  - Hot-path writes use Redis pipelines (non-atomic) for throughput.
  - Dedup is done via `HEXISTS` (non-assessment) or `HGET`/`HSET` votes (assessment) before applying scoring.

## Affected workloads

- [[Backend GraphQL]] / [[Backend GraphQL - Assessment]]
- [[Response API]] / [[Response API - Assessment]]
- [[Hatchet Worker - Response Processor]] / [[Hatchet Worker - Response Processor - Assessment]]
- [[Hatchet Worker - General]] (uses `REDIS_CACHE_*` for pub/sub)

## Configuration

- `REDIS_HOST` — redis
- `REDIS_PORT` — redis
- `REDIS_PASS` — redis
- `REDIS_TLS` — redis
- `REDIS_ASSESSMENT_HOST` — redis
- `REDIS_ASSESSMENT_PORT` — redis
- `REDIS_ASSESSMENT_PASS` — redis
- `REDIS_ASSESSMENT_TLS` — redis
- `REDIS_CACHE_HOST` — redis
- `REDIS_CACHE_PORT` — redis
- `REDIS_CACHE_PASS` — redis
- `REDIS_CACHE_TLS` — redis

## Related docs

- [[01-Live Quiz - Non-assessment]]
- [[02-Live Quiz - Assessment]]
- [[01-Assessment vs Non-assessment Split]]
- [[Azure Cache for Redis]]
