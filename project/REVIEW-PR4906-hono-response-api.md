# Review: PR #4906 — Hono Response API (2026-07-07)

Reviewer: Claude (requested by @rschlaefli). Scope: stability, security, UX, code quality, usefulness, and the remaining path to production readiness. All findings verified against the actual code on `hono-response-api` and current `v3` (see file:line evidence throughout).

## Verdict

The refactor itself is a clear improvement in structure and direction (Hono + zod + pino + typed env beats the 419-line hand-rolled `http.createServer`). **But the PR cannot be merged in its current state.** It has two bugs that would break student submissions outright, and — because the branch is ~294 commits behind `v3` — it silently reverts three security/correctness hardenings that landed on `v3` after this branch was cut. All of these are fixable; the plan below sequences the work.

Keep the PR as a draft until every item in "Blockers" is closed and verified.

---

## 1. Blockers (would break production)

### B1. Every real student submission gets rejected with 400 `INVALID_JSON`

The new `enforceJson` middleware rejects any POST whose `Content-Type` doesn't start with `application/json` ([apps/response-api/src/middleware/index.ts:13-28](../apps/response-api/src/middleware/index.ts)).

The PWA never sets that header — its `fetch` uses a plain `RequestInit` with only `method` and `credentials`, so the browser defaults the string body to `text/plain;charset=UTF-8`:

```ts
// apps/frontend-pwa/src/pages/session/[id].tsx:61-64
let requestOptions: RequestInit = {
  method: 'POST',
  credentials: 'include',
}
```

The old server never checked Content-Type, so this worked. With this PR, **every answer submitted from the live-quiz page fails with 400**.

**Fix (do both):**
1. Add `headers: { 'Content-Type': 'application/json' }` to `requestOptions` in `apps/frontend-pwa/src/pages/session/[id].tsx` (this must ship in the *same* PR or land on `v3` *before* this API deploys — deploy ordering matters because the old API tolerates the header, but the new API does not tolerate its absence).
2. Be aware this converts the POST from a CORS "simple request" into a preflighted one. The Hono `cors()` config already allows `Content-Type` and handles OPTIONS ([apps/response-api/src/app.ts:19-31](../apps/response-api/src/app.ts)), so this is fine — but it must be covered by an E2E test (see §4).

### B2. Assessment mode: the correlation-key check rejects every valid submission

The new code compares the JWT claim against a **stringified** body value:

```ts
// apps/response-api/src/routes/response.ts:113-116
correlationData.instanceId !== String(instanceId) ||
correlationData.liveQuizId !== String(liveQuizId)
```

But the backend signs the correlation key with a **numeric** `instanceId` — `instance.id` is a Prisma integer and jose preserves JSON types in claims:

```ts
// packages/graphql/src/services/liveQuizzes.ts:1134-1141 (same at :2947)
const correlationKey = await signJWT({
  instanceId: instance.id,   // number
  ...
```

So the check evaluates `5 !== "5"` → `true` → every assessment submission returns 400 `invalid_submission`. The old code compared raw values (`correlationData.instanceId !== instanceId`), which passed because the PWA also sends `instanceId` as a number.

**Fix:** coerce *both* sides: `String(correlationData.instanceId) !== String(instanceId)`. Add a unit test with a real signed JWT (numeric claim) to lock this in.

### B3. Branch is stale — merging reverts three `v3` hardenings

Merge-base is `d0e959169` (Sept 2025); `v3` is 294 commits ahead, including three PRs that changed this exact service. The Hono rewrite was based on the *old* `index.ts`, so it silently drops:

| Lost on this branch | Where it lives on `v3` (`apps/response-api/src/index.ts`) | Origin |
| --- | --- | --- |
| **JWT issuer verification**: correlationKey must be issued by `APP_ORIGIN_ASSESSMENT_API`, assessment cookie by `APP_ORIGIN_AUTH` | `verifyJWT(..., { issuer: process.env.APP_ORIGIN_ASSESSMENT_API })` and `{ issuer: process.env.APP_ORIGIN_AUTH }` | #4903 |
| **EDUID scope check**: assessment cookie must satisfy `user.scope === UserLoginScope.EDUID` (blocks delegated/other login cookies in exams) | `isAssessmentCookieValid = !!user && user.role === 'PARTICIPANT' && user.scope === UserLoginScope.EDUID` (imports `@klicker-uzh/prisma/client`) | #4912 |
| **Separate assessment Redis**: duplicate-vote check must hit `REDIS_ASSESSMENT_HOST/PORT/PASS/TLS` (default port 6381), not the standard cache | second `assessmentRedis` client; `assessmentRedis.hget(...)` | #4913 |

The deploy chart already provisions the assessment Redis secret ([deploy/charts/klicker-uzh-v2/templates/secret-response-api.yaml](../deploy/charts/klicker-uzh-v2/templates/secret-response-api.yaml) sets `REDIS_ASSESSMENT_PASS`), so the branch code would connect to the wrong Redis, find no votes, and **accept duplicate answers in exams** — plus accept assessment cookies that `v3` intentionally rejects.

**Fix:** rebase onto `v3` (see step 1 in §5), then port all three behaviors into the Hono routes. `package.json` must regain `@klicker-uzh/prisma` (for `UserLoginScope`); the Dockerfile on the branch already copies `packages/prisma/dist`, so that part is fine.

### B4. Pre-commit will fail: zod version conflict with syncpack

Branch adds `"zod": "3.23.8"` ([apps/response-api/package.json](../apps/response-api/package.json)); `v3` pins `zod 3.25.76` in `apps/chat` and `packages/graphql`. `pnpm run check:all` (husky pre-commit) runs syncpack and will reject the mismatch. **Fix:** use `3.25.76` after rebasing.

---

## 2. Major issues (fix before merge)

### M1. `z.any()` makes `response` effectively optional — weaker validation than the old code

`StandardResponseSchema` uses `response: z.any()` ([apps/response-api/src/schemas/index.ts:4](../apps/response-api/src/schemas/index.ts)). In zod, `z.any()` accepts `undefined`, so `{ liveQuizId, instanceId }` with **no response at all** passes validation and gets pushed to the worker. The old code rejected falsy responses (`if (!response || ...)`). Also, `z.union([z.string(), z.number()])` accepts `""` and `0` for the IDs.

**Fix:** `response: z.unknown().refine((v) => v !== null && v !== undefined)` (or better, a shape union over the known response types: `choices`/`value`/`selection`/`assessment`/`viewed` — see the PWA payloads at `apps/frontend-pwa/src/pages/session/[id].tsx:66-118`), and `liveQuizId: z.union([z.string().min(1), z.number()])`.

### M2. Redis-down now *silently* accepts duplicate exam answers (fail-open)

New behavior: if Redis errors during the duplicate check, log an audit event and continue ([apps/response-api/src/routes/response.ts:180-190](../apps/response-api/src/routes/response.ts)). Old behavior: the unhandled throw became a 500 (fail-closed). The plan file argues "let Hatchet handle deduplication" — but **nobody has verified that the assessment processor actually dedupes by `correlationId`**. For exams, silent duplicate acceptance is the worst failure mode.

**Fix:** either (a) verify `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts` dedupes on `correlationId` before insert and document that in the code, or (b) fail closed: return 503 with a `retry` code so the PWA can resubmit. Decide explicitly; don't leave it implicit.

### M3. Errors are swallowed without logging

- `app.onError` returns a 500 but never logs `err` ([apps/response-api/src/app.ts:48-58](../apps/response-api/src/app.ts)). A production incident would be invisible in the logs.
- `client.on('error', () => {})` discards all Redis errors ([apps/response-api/src/lib/redis.ts:17](../apps/response-api/src/lib/redis.ts)). ioredis retries forever; you'd never see the reconnect storm.
- The Hatchet push failure in standard mode returns 500 without logging `err` ([apps/response-api/src/routes/response.ts:82-90](../apps/response-api/src/routes/response.ts)).

**Fix:** `logger.error({ err, reqId }, ...)` in all three places (rate-limit the Redis one, e.g. log once per state change).

### M4. `/healthz` pings Redis even in standard mode, where Redis is never used

`getRedis()` is only needed in assessment mode, but `/healthz` calls `pingRedis` unconditionally ([apps/response-api/src/routes/health.ts:8-11](../apps/response-api/src/routes/health.ts)). In a standard-mode pod, `REDIS_HOST` is undefined → ioredis connects to `localhost:6379` → permanent reconnect loop + `redis: down` noise on every probe.

**Fix:** only check Redis when `env.ASSESSMENT_MODE` is true. Better: split `/healthz` (liveness, no dependencies) from `/readyz` (readiness: Redis when in assessment mode), and wire both into the k8s deployment probes.

### M5. Shutdown drops in-flight requests

`shutdown()` calls `server.close()` (ignoring its callback) and `process.exit(0)` immediately ([apps/response-api/src/index.ts:9-15](../apps/response-api/src/index.ts)). Under rolling deploys during a live quiz, in-flight submissions die.

**Fix:** await close with a timeout, then quit Redis, then exit:

```ts
await new Promise<void>((resolve) => {
  const t = setTimeout(resolve, 8000)
  server.close(() => { clearTimeout(t); resolve() })
})
```

### M6. Dead/unused configuration and dependencies

- `APP_SECRETS_PREVIOUS` is parsed in [apps/response-api/src/lib/env.ts:27-37](../apps/response-api/src/lib/env.ts) but **never used anywhere**. Either implement secret rotation (try current secret, fall back to previous list in `verifyJWT`) or delete it. Half-shipped config is a trap.
- `hono-pino` is in `package.json` but never imported (a custom logging middleware is used instead). Remove it.
- `CORRELATION_HASH_ALGO=hmac-sha256` is a good idea, but switching the algo **mid-quiz changes every `correlationId`**, which resets duplicate detection (everyone can answer again). Keep the `md5` default, and document in `.env.example`: *only flip this between exam sessions, never during one*.

### M7. `originGuard` blocks non-browser clients — including, likely, the future mobile app

POSTs to `/AddResponse` now require an allowlisted `Origin` header ([apps/response-api/src/middleware/index.ts:30-49](../apps/response-api/src/middleware/index.ts)). Browsers always send Origin on cross-origin POSTs, so the PWA is fine. But:
- k6/curl/synthetic monitors must now set `Origin` explicitly (the k6 plan already accounts for this).
- A Capacitor/WebView mobile app (in progress on `codex/capacitor-mobile-app`) typically sends `Origin: capacitor://localhost` or `null` — **both get 403**. Coordinate the allowlist (or an app-token bypass) with that branch before either merges.

---

## 3. Minor issues (quality polish)

1. `(logger as any).level === 'debug'` gating ([response.ts:66-70, 216-220](../apps/response-api/src/routes/response.ts)) — pino already filters by level; delete the `if` wrappers, or use `logger.isLevelEnabled('debug')` if you want to skip building the object. Remove the `as any`.
2. The zValidator error response omits `requestId` ([response.ts:24-31](../apps/response-api/src/routes/response.ts)) while every other error includes it. Add it for a consistent error contract.
3. `pingRedis` leaks its timeout timer on the success path ([redis.ts:20-32](../apps/response-api/src/lib/redis.ts)) — harmless at probe frequency, but `clearTimeout` in a `finally` is one line.
4. `c.req.valid('json') as any` defeats the point of zValidator — type the Hono generics (`zValidator` infers the type; remove the casts).
5. Two `const body = c.req.valid('json')` reads in the same handler ([response.ts:39, 97](../apps/response-api/src/routes/response.ts)) — hoist one.
6. `turbo.json` `globalEnv` is missing the new vars: `LOG_LEVEL`, `CORRELATION_HASH_ALGO`, `APP_SECRETS_PREVIOUS` (if kept), and after the rebase also confirm `REDIS_ASSESSMENT_*`, `APP_ORIGIN_ASSESSMENT_API`, `APP_ORIGIN_AUTH` are present. Repo rule: every Infisical-managed var must be listed there.
7. `.env.example` needs the post-rebase vars too (`REDIS_ASSESSMENT_*`, `APP_ORIGIN_*`).
8. PR title still says "WIP"; when ready, use a conventional title, e.g. `refactor(apps/response-api): migrate to hono with validation, structured logging and hardening`.

## What's genuinely good (keep it)

- Clean separation: `app.ts` / routes / middleware / lib — testable via `app.request()` with zero HTTP plumbing.
- Typed, validated env (`env.ts` with zod) — fail-fast beats `process.env.X as string` scattered everywhere.
- Request IDs propagated into responses and logs (`X-Request-Id` exposed via CORS) — real support value.
- pino with redaction of cookies/authorization/correlationKey ([logger.ts](../apps/response-api/src/lib/logger.ts)) — the old code `console.log`ged full payloads including responses (PII); this PR removes payloads from audit log messages too (e.g. no more `JSON.stringify(payload)` in audit entries). Genuine privacy improvement.
- `secureHeaders()`, body limit, JSON enforcement, origin guard: right instincts — they just need the rollout coordination described above.
- The k6 plan ([PLAN-k6-response-api.md](PLAN-k6-response-api.md)) is well thought out (Origin simulation, pre-generated tokens, tag-based thresholds). It's a plan without code, though — see step 8.

---

## 4. Verification loop (set this up before touching code)

Every step below ends with "prove it" — this is how:

1. **Unit/integration tests (new, vitest):** Hono apps test without a server:
   ```ts
   const res = await app.request('/AddResponse', { method: 'POST', headers: {...}, body: JSON.stringify({...}) })
   ```
   Mock `hatchetClient.events.push` and Redis (vitest `vi.mock`). Put tests in `apps/response-api/test/`, run with `pnpm --filter @klicker-uzh/response-api test` (add the script + vitest devDep, mirroring `packages/grading`).
2. **Local stack:** `docker compose up` (Postgres, Redis, hatchet-lite) + seeded DB. Run the API with `pnpm --filter @klicker-uzh/response-api dev`. Point the PWA at it (`NEXT_PUBLIC_ADD_RESPONSE_URL=http://localhost:7078/AddResponse`).
3. **Browser verification (mandatory, per repo policy):** `npx agent-browser` → log in as `testuser1`/`abcdabcd` (delegated), join the running live quiz of lecturer `lecturer`/`abcd`, submit an answer, confirm 200 in the network tab and the answer appearing in the lecturer evaluation view. Screenshot before/after for the PR.
4. **Existing E2E:** the Cypress/Playwright live-quiz workflow tests cover submission end-to-end; run the live-quiz spec after the frontend header change.

## 5. Remaining steps to production (ordered, one PR-commit each)

Do these in order; do not skip the verification at the end of each step.

**Step 1 — Rebase onto `v3`.**
```bash
git fetch origin && git rebase origin/v3
```
Expect conflicts in `apps/response-api/src/index.ts` (v3 rewrote it — resolve by keeping the *new* Hono files and deleting the old monolith content, then re-porting v3's logic in step 2), `package.json`, `pnpm-lock.yaml` (`pnpm install` after resolving), and possibly the Dockerfile. Afterwards: `pnpm install && pnpm run check` must pass.

**Step 2 — Re-port the v3 security semantics (fixes B3).**
In `routes/response.ts`: add `{ issuer: env.APP_ORIGIN_ASSESSMENT_API }` to the correlationKey `verifyJWT`, `{ issuer: env.APP_ORIGIN_AUTH }` to the cookie `verifyJWT`, add the `UserLoginScope.EDUID` scope check, add a second Redis client for `REDIS_ASSESSMENT_*` in `lib/redis.ts` and use it for the votes lookup. Extend `env.ts` with the new vars (issuer vars required when `ASSESSMENT_MODE=true` — use `.superRefine`). Add `@klicker-uzh/prisma` to `package.json`. Update `.env.example` + `turbo.json`.
*Prove it:* unit tests — wrong-issuer JWT → 400; non-EDUID cookie → 401; votes lookup goes to the assessment Redis (assert on the mocked client).

**Step 3 — Fix the two request-breaking bugs (B1, B2).**
String-coerce both sides of the correlation comparison; add `Content-Type: application/json` to the PWA fetch.
*Prove it:* unit test with a numerically-signed JWT passes; agent-browser submission succeeds end-to-end (§4.3).

**Step 4 — Validation tightening (M1) + error-contract consistency (minor #2).**
*Prove it:* unit tests — missing `response` → 400; `response: null` → 400; empty-string liveQuizId → 400.

**Step 5 — Observability + lifecycle (M3, M4, M5).**
onError/Redis/Hatchet-failure logging; healthz/readyz split gated on mode; graceful shutdown drain. Wire `readinessProbe` to `/readyz` in the deploy chart.
*Prove it:* kill Redis locally in assessment mode → readyz flips, liveness stays up, logs show a single reconnect warning, submissions behave per the chosen policy from step 6.

**Step 6 — Decide and implement the Redis-down policy (M2).**
Read `assessmentProcessor.ts`; if it dedupes by `correlationId`, keep fail-open and document it in the code. If not, fail closed (503 + retryable code) and make the PWA show the existing "please retry" path.
*Prove it:* unit test for the chosen behavior + a written note in the PR description.

**Step 7 — Cleanup (M6, B4, minors).**
zod → 3.25.76; drop `hono-pino`; delete or implement `APP_SECRETS_PREVIOUS`; document `CORRELATION_HASH_ALGO` rollout constraint; remove `as any` casts and debug-level `if`s.
*Prove it:* `pnpm run check:all` green (this also proves the syncpack fix).

**Step 8 — Load test (k6 plan → code).**
Implement the scripts from [PLAN-k6-response-api.md](PLAN-k6-response-api.md) under `apps/response-api/k6/` (token generator script included). Run against local Docker first, then staging. Record p95/p99 + error rates in the PR description. Remember: k6 must send `Origin` and `Content-Type` headers.

**Step 9 — Mobile-app coordination (M7).**
Agree with the Capacitor branch owner how the app will pass the origin guard (allowlist entry vs. token). Document the decision in this file or the PR.

**Step 10 — Ship.**
Update the PR title/description (use the full-branch description workflow), attach screenshots + k6 results, undraft, get review. Deploy order: this API must not go live before the PWA header change from step 3 is deployed.

---

## 6. Roadmap: Hono everywhere

Requested addition: evaluate Hono as the standard HTTP layer across the monorepo. Current inventory:

| Service | Today | Hono fit | Priority |
| --- | --- | --- | --- |
| `apps/response-api` | hand-rolled `node:http` → **this PR** | Pilot. Proves middleware stack, testing, deploy | Now |
| `apps/olat-api` | Express 4 + `express-rate-limit` | High. Small REST surface; direct port; `hono-rate-limiter` or keep infra-level limits; gains zod validation + shared middleware | Next (after this PR merges) |
| `apps/backend-docker` | Express 4 + GraphQL Yoga 3 | Medium. Yoga is fetch-native and mounts cleanly on Hono (`app.all('/api/graphql', (c) => yoga.fetch(c.req.raw))`), but this service carries auth cookies, subscriptions, and the largest blast radius. Do last, behind the shared package | Later |
| `apps/lti` | ltijs (bundles its own Express) | Low. Framework is coupled to Express; not worth fighting | Skip |
| `apps/auth`, `apps/chat`, frontends | Next.js | Out of scope — Next owns the HTTP layer | Skip |
| `apps/analytics` | Python service | Out of scope | Skip |

**Prerequisite for rollout — extract a shared package first.** The pilot already shows the pieces every service will duplicate: env loading, pino logger + redaction, requestId + logging middleware, secure headers/CORS defaults, healthz/readyz factories, Redis helper, graceful shutdown. Before porting `olat-api`, extract these from `apps/response-api` into `packages/hono-common` (name TBD) so the second consumer imports instead of copies. Do **not** build the package speculatively inside this PR — extract when the second consumer exists.

**Sequencing:** this PR → harden in production for one semester cycle (or at least one real live-quiz load) → extract `packages/hono-common` → port `olat-api` → reassess `backend-docker`.

**Decision to record now:** standardize on zod (already the repo direction) and pino for all Hono services, and keep the `app.ts`-exports-app / `index.ts`-serves pattern from this PR as the template — it's what makes `app.request()` testing free.

---

## Quick reference: evidence index

| Finding | Evidence |
| --- | --- |
| B1 missing Content-Type | `apps/frontend-pwa/src/pages/session/[id].tsx:61-64` vs `apps/response-api/src/middleware/index.ts:13-28` |
| B2 type-mismatched comparison | `apps/response-api/src/routes/response.ts:113-116` vs `packages/graphql/src/services/liveQuizzes.ts:1134-1141` |
| B3 lost issuer/scope/assessment-Redis | `v3:apps/response-api/src/index.ts` (issuer at correlationKey+cookie verify, `UserLoginScope.EDUID`, `assessmentRedis`) |
| B4 zod mismatch | branch `apps/response-api/package.json` (3.23.8) vs `packages/graphql/package.json` (3.25.76) |
| M1 z.any() optional | `apps/response-api/src/schemas/index.ts:4` |
| M2 fail-open dedupe | `apps/response-api/src/routes/response.ts:180-190` |
| M3 silent errors | `apps/response-api/src/app.ts:48-58`, `src/lib/redis.ts:17` |
| M4 healthz redis in standard mode | `apps/response-api/src/routes/health.ts:8-11` |
| M5 shutdown drop | `apps/response-api/src/index.ts:9-15` |
| M6 dead config | `apps/response-api/src/lib/env.ts:27-37`, `package.json` (`hono-pino`) |
| M7 origin guard vs non-browser | `apps/response-api/src/middleware/index.ts:30-49` |
