# Redis OAuth Store Plan

## Goal

Move the MCP OAuth authorization-code store from the current in-memory
process-local map to Redis, and wire the required local and Kubernetes deploy
configuration. Redis is a hard dependency for MCP OAuth: if Redis is
unavailable, OAuth code issuance and redemption must fail closed. There should
be no in-memory fallback in any environment.

## Progress

- Status: implemented, pending full typecheck cleanup and optional runtime OAuth
  smoke validation.
- Implemented Redis-backed async OAuth code storage in
  `apps/auth/src/pages/api/mcp/_store.ts` using `ioredis`, `SET ... EX 60 NX`,
  and atomic `GETDEL`.
- Updated `authorize.ts` to await code storage and fail closed with
  `temporarily_unavailable` before redirecting if Redis storage fails.
- Updated `token.ts` to await code redemption, preserve `invalid_grant` for
  missing/expired codes, and return `temporarily_unavailable` on Redis errors.
- Added `ioredis` as a direct pinned dependency of `apps/auth` and updated
  `pnpm-lock.yaml`.
- Wired local compose auth config to `redis_cache` with `REDIS_CACHE_HOST` and
  `REDIS_CACHE_PORT`.
- Added auth-scoped Redis cache values and rendered `REDIS_CACHE_HOST`,
  `REDIS_CACHE_PORT`, and `REDIS_CACHE_TLS` in the v3 Helm auth ConfigMap.
- Added `REDIS_CACHE_PASS` and `REDIS_CACHE_TLS` to `turbo.json` `globalEnv`.
- Verification completed: `pnpm --filter @klicker-uzh/auth build` passes;
  `helm lint deploy/charts/klicker-uzh-v3` passes; `helm template` renders the
  auth Redis env vars.
- Verification blocked: `pnpm --filter @klicker-uzh/auth check` still fails on
  existing unrelated Prisma transaction type errors in `apps/auth/src/lib/helpers.ts`.
- Not yet completed: runtime validation of fail-closed Redis outage behavior and
  full OAuth PKCE flow against a running local stack.

## Current State

- `apps/auth/src/pages/api/mcp/_store.ts` stores one-time OAuth authorization
  codes in an in-process `Map` with a one-minute TTL.
- `apps/auth/src/pages/api/mcp/authorize.ts` calls `putCode(...)`
  synchronously before redirecting back to the MCP client with the code.
- `apps/auth/src/pages/api/mcp/token.ts` calls `popCode(...)` synchronously
  during code redemption.
- The current token endpoint has no refresh-token flow; this plan is scoped to
  short-lived one-time authorization codes only.
- `docker-compose.yml` already provides `redis_cache`, but the `auth` service
  is not wired to it.
- `deploy/charts/klicker-uzh-v3/templates/cm-auth.yaml` is currently an empty
  auth-specific ConfigMap shell.
- The auth deployment already imports `config-auth` and `secret-auth`, and the
  auth pod template already has a checksum annotation for `cm-auth.yaml`.

## Design

### Store Implementation

- Keep `_store.ts` as the public boundary for OAuth code storage.
- Change `putCode(code, record)` and `popCode(code)` to async functions.
- Add a singleton `ioredis` client configured from:
  - `REDIS_CACHE_HOST`
  - `REDIS_CACHE_PORT`
  - `REDIS_CACHE_PASS`
  - `REDIS_CACHE_TLS`
- Use the cache Redis instance, not the execution Redis instance.
- Use keys of the form `mcp:oauth:code:${code}`.
- Store the existing `CodeRecord` fields as JSON, including `createdAt`.
- Write codes with Redis server-side TTL and no overwrite:

```ts
SET key value EX 60 NX
```

- Redeem codes atomically with:

```ts
GETDEL key
```

- Keep the current one-minute lifetime. Redis TTL is the primary expiry
  mechanism; `createdAt` can remain as defense-in-depth and for diagnostics.

### Failure Behavior

- `authorize.ts` must `await putCode(...)` before redirecting.
- If Redis write fails or returns a non-success result, the endpoint must fail
  closed and must not issue a code that cannot be redeemed.
- `token.ts` must `await popCode(...)` during redemption.
- A missing Redis key remains a normal OAuth `invalid_grant` case.
- Redis operational errors should be treated as OAuth unavailable/server error,
  not as a normal expired-code case.
- There must be no silent memory fallback. Redis unavailable means MCP OAuth is
  unavailable.

### Dependencies

- Add `ioredis` as a direct dependency of `apps/auth`.
- Pin it to the version style already used in the monorepo.
- Update the lockfile in the implementation branch.
- Do not rely on transitive dependencies from other workspaces.

## Deploy Configuration

### Local Docker Compose

Update the `auth` service in `docker-compose.yml` to use the existing
`redis_cache` service:

```yaml
REDIS_CACHE_HOST: redis_cache
REDIS_CACHE_PORT: 6379
REDIS_CACHE_PASS: ''
```

Leave `REDIS_CACHE_TLS` unset or empty for local compose unless the runtime
parser requires an explicit false-like value.

Use `redis_cache`, not `redis_exec`, because OAuth authorization codes are
short-lived auth/cache state rather than live quiz execution state.

### Helm v3 Chart

Add auth-scoped Redis cache values in
`deploy/charts/klicker-uzh-v3/values.yaml`, for example:

```yaml
auth:
  redisCache:
    host: ''
    port: 6379
    tls: false
```

Populate non-secret Redis environment variables in
`deploy/charts/klicker-uzh-v3/templates/cm-auth.yaml`:

```yaml
REDIS_CACHE_HOST: {{ .Values.auth.redisCache.host | quote }}
REDIS_CACHE_PORT: {{ .Values.auth.redisCache.port | quote }}
REDIS_CACHE_TLS: {{ .Values.auth.redisCache.tls | quote }}
```

Keep `REDIS_CACHE_PASS` in the external `secret-auth`. The v3 chart currently
references external secrets but does not define Secret manifests, so do not add
a new Secret manifest for this plan.

No structural change should be needed in `deployment-app.yaml` because the auth
container already imports `config-auth` and `secret-auth`, and changes to
`cm-auth.yaml` already trigger an auth rollout through the checksum annotation.

### Turbo Environment Sync

`REDIS_CACHE_HOST` and `REDIS_CACHE_PORT` are already listed in `turbo.json`.
If the auth runtime reads `REDIS_CACHE_PASS` or `REDIS_CACHE_TLS`, add both to
`turbo.json` `globalEnv` during implementation.

### Staging And Production Operations

- Ensure the auth workload has non-secret Redis host, port, and TLS config from
  `config-auth`.
- Ensure `secret-auth` provides `REDIS_CACHE_PASS` when the target Redis
  endpoint requires authentication.
- Treat Redis availability as part of MCP OAuth availability. If Redis cache is
  down, code issuance and redemption should fail by design.

## Implementation Steps

1. Add `ioredis` to `apps/auth/package.json` and update the lockfile.
2. Replace `_store.ts` internals with Redis-backed async `putCode` and
   `popCode`.
3. Update `authorize.ts` and `token.ts` to await store operations and fail
   closed on Redis operational errors.
4. Wire `docker-compose.yml` `auth` service to `redis_cache`.
5. Add auth Redis values and `cm-auth.yaml` entries to the v3 Helm chart.
6. Add missing Redis env names to `turbo.json` if they are read by auth.
7. Update the MCP/auth docs or plan notes to document the hard Redis
   dependency.

## Verification Plan

- Run the auth package typecheck/build after code changes.
- Run relevant MCP checks if auth changes affect the full branch validation.
- Render or lint the Helm chart to confirm auth Redis env vars are present.
- Start the full local stack and verify the OAuth endpoints fail closed when
  Redis is unavailable.
- Start the full local stack with Redis available and validate the real OAuth
  PKCE flow separately from the existing direct-JWT MCP smoke script.

## Open Decisions

- Confirm the exact external staging/production Redis endpoint values to place
  under `auth.redisCache`.
- Confirm whether `REDIS_CACHE_TLS` should be rendered when false or omitted
  when disabled, based on the final auth Redis parser.
