# Hono Response-API Refactoring Plan

## Overview
Refactor the response-api from Node.js built-in HTTP server to Hono framework, implementing security best practices, type-safe validation, and structured logging while maintaining all existing functionality. Adopt pragmatic defaults, keep current API contracts, and design for future hardening without adding unnecessary complexity.

## Phase 1: Setup and Dependencies
1. **Update package.json**
   - Add Hono and middleware dependencies:
     - `hono` - Core framework
     - `@hono/node-server` - Node.js adapter
     - `@hono/zod-validator` - Validation middleware
     - `zod` - Schema validation
     - `hono-pino` - Structured logging
     - `pino` - Logger

2. **Create TypeScript types**
   - Define request/response schemas with Zod
   - Create type definitions for all endpoints
   - Ensure compatibility with existing JWTPayload type

## Phase 2: Core Application Structure
1. **Create new app structure** (`src/app.ts`)
   - Initialize Hono application
   - Configure global middleware stack:
     - CORS with dynamic origin validation (strict allowlist; reject "null" and unknown origins)
     - Enforce JSON-only POSTs (`Content-Type: application/json`)
     - Body limit (1MB as currently configured)
     - Secure headers
     - Request logging with hono-pino (pino under the hood)
   
2. **Implement validation schemas**
   - AddResponse schema for standard mode
   - AddAssessmentResponse schema for assessment mode
   - Shared response validation logic

## Phase 3: Route Implementation
1. **Health check routes**
   - GET `/healthz` - Health status endpoint
   - GET `/` - Root health check

2. **Response handling routes**
   - POST `/AddResponse` - Main response endpoint
     - Standard mode handler with cookie forwarding
     - Assessment mode handler with JWT verification
     - Proper error responses with structured logging

3. **Error handling**
   - Global error handler for uncaught errors
   - Validation error formatting
   - Consistent error response structure (see Error Model)

## Phase 4: Middleware Configuration
1. **CORS Middleware**
   - Dynamic origin validation from environment
   - Credentials support for cookies
   - Proper preflight handling

2. **Security Controls**
   - No CSRF tokens (not needed for our current threat model). Enforce strict Origin validation, JSON-only POST, and credentials only for allowed origins.
   - Secure headers configuration
   - Body size limit enforcement

3. **Logging Middleware**
   - Structured request/response logging with pino via hono-pino
   - Request ID generation + propagation (`X-Request-Id` header)
   - Correlation ID tracking in assessment flow
   - Redaction of sensitive fields by default (see Logging & Redaction)
   - Performance metrics (duration) in logs

## Phase 5: Service Integration
1. **Redis connection**
   - Maintain existing Redis client setup
   - Implement graceful degradation: wrap all Redis operations in try-catch
   - If Redis fails, log warning but continue processing (let Hatchet handle deduplication)
   - Redis is purely an optimization, not a requirement for operation

2. **Hatchet integration**
   - Preserve event publishing logic
   - Maintain audit logging patterns

3. **JWT verification**
   - Keep existing JWT utility usage
   - Type-safe payload handling

4. **Audit Service integration**
   - Create `src/lib/audit.ts` module for network-based audit logging
   - Environment variables for audit service endpoint/credentials
   - Implement retry logic for critical audit events
   - Structured audit event types (response received, duplicate detected, authentication failure)
   - Consider batching for non-critical events

## Phase 6: Server Configuration
1. **Update index.ts**
   - Import Hono app from app.ts
   - Use @hono/node-server for Node.js runtime
   - Maintain PORT configuration
   - Proper shutdown handling

2. **Environment configuration**
   - Preserve all existing environment variables
   - Add any new Hono-specific configurations

## Phase 7: Testing & Validation
1. **Type checking**
   - Ensure all TypeScript types are correct
   - Validate request/response interfaces

2. **Functionality testing**
   - Test both standard and assessment modes
   - Verify CORS behavior
   - Validate error handling
   - Check audit logging

3. **Performance validation**
   - Ensure no performance regression
   - Validate memory usage

## Phase 8: Documentation & Cleanup
1. **Update documentation**
   - Document new middleware configuration
   - Add validation schema documentation
   - Update deployment notes if needed

2. **Code cleanup**
   - Remove unused dependencies
   - Clean up old HTTP server code
   - Ensure consistent code style

## Key Benefits
- **Type Safety**: End-to-end type safety with Zod validation
- **Security**: Built-in CSRF, CORS, and security headers
- **Maintainability**: Cleaner, more modular code structure
- **Observability**: Structured logging with hono-pino
- **Performance**: Optimized middleware pipeline
- **Developer Experience**: Better error messages and validation

## Migration Notes
- All existing API contracts remain unchanged
- Cookie handling logic preserved
- Hatchet event publishing unchanged
- Redis operations maintain same patterns with added graceful degradation
- Environment variables remain compatible
- Docker deployment unchanged
- **Runtime switching**: Single container image with `ASSESSMENT_MODE` flag for mode selection
- **Deployment model**: Two physical instances (standard vs assessment) with separate infrastructure for resource and security isolation
- **CORS configuration**: Each instance has tailored allowlists via environment configuration
- **Audit trail**: Network-based audit service integration for compliance and security monitoring
- Error response strings currently used by clients remain unchanged; we will add structured fields alongside for future migration.

## Implementation Checklist

### Dependencies to Add
```json
{
  "hono": "^4.x",
  "@hono/node-server": "^1.x",
  "@hono/zod-validator": "^0.x",
  "zod": "^3.x",
  "hono-pino": "^0.x",
  "pino": "^9.x"
}
```

### Files to Create
- [ ] `src/app.ts` - Main Hono application
- [ ] `src/schemas/index.ts` - Zod validation schemas
- [ ] `src/routes/health.ts` - Health check routes
- [ ] `src/routes/response.ts` - Response handling routes
- [ ] `src/middleware/index.ts` - Custom middleware
- [ ] `src/lib/redis.ts` - Redis client setup with graceful degradation
- [ ] `src/lib/logger.ts` - Logger configuration
- [ ] `src/lib/env.ts` - Environment schema (zod) and loader
- [ ] `src/lib/audit.ts` - Audit service client with retry logic

### Files to Modify
- [ ] `src/index.ts` - Server startup
- [ ] `package.json` - Dependencies
- [ ] `tsconfig.json` - If needed for Hono

### Testing Requirements
- [ ] Standard response mode works
- [ ] Assessment response mode works
- [ ] CORS headers are correct
- [ ] Body size limits work
- [ ] Error responses are structured
- [ ] Logging captures all requests
- [ ] Performance is acceptable
- [ ] Docker container builds
- [ ] Deployment works in K8s
 - [ ] Health indicates Redis state without failing the endpoint
 - [ ] Both hostnames (standard and assessment) behave with correct CORS allowlists

### Rollback Plan
If issues arise during deployment:
1. Keep old implementation alongside new
2. Use feature flag to switch between implementations
3. Monitor error rates and performance
4. Quick rollback via container image swap

---

## Detailed Design Decisions

### 1) CSRF Posture
- We will NOT implement CSRF tokens. For our REST-style API that accepts cross-origin credentialed requests only from a strict Origin allowlist, CSRF tokens do not materially improve the posture.
- Controls in place:
  - Strict dynamic Origin allowlist (reject "null" and unknown).
  - JSON-only POST (`Content-Type: application/json`).
  - Credentials permitted only for allowed origins.
- We will leave a hook to introduce CSRF later if the threat model changes.

### 2) Correlation ID Hashing
- Purpose is stable compaction for audit correlation and Redis de-duplication, not cryptographic verification.
- **Decision**: Continue using MD5 for correlationId as it's 3-5x faster than HMAC-SHA256 and sufficient for deduplication purposes.
- Performance consideration: MD5 is optimal for this use case (deduplication, not security).
- Future option: Could introduce `CORRELATION_HASH_ALGO` env if security requirements change, but not currently planned.

### 3) Logging & Redaction
- Use `hono-pino` with pino. Generate and attach a `requestId` (UUIDv4) to all logs and responses (`X-Request-Id`).
- Default log level via `LOG_LEVEL`. When `debug`, include raw `response` payload in logs for troubleshooting; otherwise omit.
- Redact by default (both request and response logs):
  - `req.headers.cookie`, `req.headers.authorization`, `res.headers['set-cookie']`
  - Body fields likely to carry secrets: `correlationKey`, JWT-like strings
  - Note: Conditional logging of `body.response` at debug level only
- Include `correlationId` (assessment flow) in logs where available.
- On Hatchet push failures, create an audit log event and include `requestId`.

### 4) Error Model
- Maintain current `error` string values for compatibility in responses where present today.
- Add structured fields universally:
  - `code`: machine-friendly enum string
  - `message`: optional human-readable explanation (omitted in production responses unless useful)
  - `requestId`: to correlate with logs
- Proposed codes and HTTP statuses:
  - `OK` (200): success path with `{ status: 'ok' | 'response_submitted' }`
  - `ALREADY_SUBMITTED` (208): duplicate submission in assessment
  - `INVALID_JSON` (400): malformed JSON
  - `MISSING_FIELDS` (400): missing required fields (e.g., response, liveQuizId, instanceId[, correlationKey])
  - `INVALID_SUBMISSION` (400): invalid correlationKey or mismatched ids
  - `INVALID_ASSESSMENT_COOKIE` (401): missing/invalid assessment cookie
  - `NOT_FOUND` (404): route not found
  - `SERVER_ERROR` (500): unexpected error
- Validation (zod) errors will be mapped to `MISSING_FIELDS` with compact field issue list in `details` at `debug` log level only; response stays minimal.

### 5) Health Checks
- `GET /healthz` and `GET /` always return `200` with `{ status: 'ok', redis: 'up' | 'down' }`.
- Implement a fast Redis ping with short timeout; if it fails, report `redis: 'down'` but do not fail the endpoint.
- **Redis as optional optimization**: The service can function without Redis - it's used purely for deduplication to save Hatchet processing. If Redis is down, responses are still processed and sent to Hatchet.
- Log a warning when Redis is down with `requestId`.

### 6) CORS & Dual Instances
- **Runtime switching**: Single container image with `ASSESSMENT_MODE` environment flag controlling behavior at runtime. This avoids separate builds and simplifies CI/CD.
- **Physical isolation**: Two physical deployments with separate infrastructure for resource isolation and security, each with its own hostname and CORS configuration.
- Each instance has its own `CORS_ALLOWED_ORIGINS` allowlist configured via environment.
- Use `hono/cors` with a dynamic `origin` function:
  - Allow only exact matches from the env list; set `Vary: Origin`; `credentials: true`.
  - Expose only necessary headers; do NOT include `Cookie` in `Access-Control-Allow-Headers` (browsers never set it manually).
- Enforce JSON-only POST and reject unknown `Content-Type` values.

### 7) Security Headers
- Apply `hono/secure-headers` with minimal tweaks to avoid breaking clients. Start with defaults; adjust `frameguard`/CSP only if needed.

### 8) Body Size Limit
- Apply `hono/body-limit` to enforce a 1MB limit on applicable routes.

### 9) Cookie Handling
- Use `hono/cookie` helpers to read cookies. For standard mode, forward only:
  - `participant_token`
  - `temporary_participant_token`
- Do not log cookie values; consider redaction at the logger level.

### 10) Environment Validation
- Add `src/lib/env.ts` using zod to validate and parse env at startup.
- Required envs (per instance): `PORT`, `CORS_ALLOWED_ORIGINS`, `APP_SECRET`, `REDIS_*`, Hatchet config, `ASSESSMENT_MODE`.
- Optional: `LOG_LEVEL`, `AUDIT_SERVICE_URL`, `AUDIT_SERVICE_TOKEN`.
- Runtime behavior changes based on `ASSESSMENT_MODE` flag (true/false).

### 11) Rate Limiting (Hook Only)
- Leave an integration point for future rate limiting (per-IP / per-session) on `/AddResponse` standard mode.
- Do not implement now; add plan steps and config placeholder.

### 12) Secret Rotation & Future Asymmetric Keys
- Short-term: support rotation by allowing verification with a list of secrets.
  - Env: `APP_SECRET` (current) and optional `APP_SECRETS_PREVIOUS` (comma-separated). Verify against current first then fallbacks.
- Mid-term: design for JWKS/asymmetric verification by issuer. Keep API surface compatible (the cookie and correlationKey verification calls remain the same; only the implementation changes).

### 13) Redis Graceful Degradation Pattern
- **Design principle**: Redis is an optimization layer, not a critical dependency.
- **Implementation approach**:
  ```typescript
  // All Redis operations wrapped with fallback
  async function checkDuplicate(key: string, value: string): Promise<boolean> {
    try {
      const exists = await redis.hget(key, value);
      return !!exists;
    } catch (error) {
      logger.warn({ error, key }, 'Redis check failed, proceeding without dedup');
      return false; // Let Hatchet handle deduplication
    }
  }
  
  async function recordVote(key: string, value: string, data: any): Promise<void> {
    try {
      await redis.hset(key, value, JSON.stringify(data));
    } catch (error) {
      logger.warn({ error, key }, 'Redis write failed, continuing without cache');
      // Continue processing - Hatchet will handle it
    }
  }
  ```
- **Health check behavior**: Redis status reported but never fails the health endpoint
- **Monitoring**: Track Redis failure rate via logs for operational awareness

### 14) Audit Service Integration
- **Network-based audit logging**: Separate service handles audit trail
- **Event types**:
  - Response received (standard and assessment)
  - Duplicate submission detected
  - Authentication failures
  - Correlation ID generation
  - Processing errors
- **Implementation considerations**:
  - Async fire-and-forget for non-critical events
  - Retry logic for critical security events
  - Structured event format with correlation IDs
  - Fallback to local logging if audit service unavailable

---

## Phase Breakdown (Updated)

1. Setup and Dependencies
   - Add Hono, node adapter, zod, @hono/zod-validator, hono-pino, pino
   - Add `src/lib/env.ts` and validate env at startup

2. Core Application Structure
   - Initialize Hono app and variables typing (logger, redis, requestId)
   - Global middleware: secure headers, CORS (strict Origin), JSON-only, body limit, logging, cookie helper

3. Schemas & Types
   - Zod schemas for Standard and Assessment payloads
   - Types inferred from schemas and exported

4. Routes
   - Health: `GET /healthz`, `GET /` with Redis health indicator
   - Responses: `POST /AddResponse` branching by `ASSESSMENT_MODE`

5. Error Handling
   - Global `onError` mapping to structured error model without leaking internals
   - Zod error mapping

6. Integrations
   - Redis client with event handlers and short ping helper
   - Hatchet event push with error handling and audit log fallback
   - JWT verification using existing util

7. Server
   - `@hono/node-server` startup, graceful shutdown (server.close, redis.quit)

8. Testing & Validation
   - Contract tests for both modes; CORS behavior per hostname; body limit; error shapes; logging at debug vs info

9. Rate Limiting (Hook)
   - Document integration point and config. No runtime change yet.

10. Documentation & Cleanup
   - Document middleware, error model, env, and ops notes (dual instances)
   - Remove legacy HTTP server code post-cutover

---

## Implementation Checklist (Updated)

- [ ] Add dependencies and env loader
- [ ] Scaffold app with global middleware
- [ ] Implement health routes with Redis indicator
- [ ] Implement response route (standard)
- [ ] Implement response route (assessment)
- [ ] Add structured error handling
- [ ] Configure logger with redaction and requestId
- [ ] Wire Redis and Hatchet integrations
- [ ] Graceful shutdown
- [ ] Tests for both instances and CORS
- [ ] Update docs and configs
