# k6 Load Testing Plan — Response API (Hono)

## Overview
Design and implement pragmatic k6 load tests for the Response API (Hono) with two production modes and hostnames:

- Standard mode (anonymous/authenticated via participant cookies)
- Assessment mode (JWT `correlationKey` + assessment cookie)

Goals: verify throughput, latency, error rates, correctness of CORS/origin handling, and assessment duplicate behavior with Redis present or absent.

## Test Objectives

- Baseline performance of the Hono Response API in both modes
- Validate CORS/origin enforcement under load (requests carry an allowed `Origin` header)
- Confirm assessment flow behavior (JWT checks, cookie checks)
- Validate duplicate handling path (returns 208) when Redis/processor is engaged
- Ensure graceful degradation when Redis is down (no hard failures; Hatchet still receives events)
- Produce actionable metrics (p95/p99 latency, failure rates) with tags per mode/instance

## Key Considerations

- k6 is not a browser: it won’t perform preflights; we must set the `Origin` header manually to simulate browser behavior. The server’s Origin guard will reject disallowed origins.
- Cookies: use `params.cookies` or `http.cookieJar()` to attach `participant_token`, `temporary_participant_token`, or `next-auth.participant-session-token`.
- Assessment: tokens must be valid (signed with `APP_SECRET`) and claims must match the body (`liveQuizId`, `instanceId`). We will pre-generate tokens outside k6 and load them via files or env.
- Duplicate responses (208): requires Redis state or the downstream processor to write votes. For tests without the processor, pre-populate Redis via a helper or include a small init step that `HSET`s the correlationId.

## Tooling References (k6)

- Scenarios & thresholds with tags: k6 supports multiple scenarios with tag-based thresholds; use `constant-arrival-rate` and `ramping-arrival-rate` for RPS-style control.
- HTTP usage: pass JSON via `http.post(url, JSON.stringify(body), { headers: { 'Content-Type': 'application/json', Origin }})`.
- Cookies: `http.cookieJar()` or `params.cookies` allow setting cookies per request.
- Tag thresholds: `'http_req_duration{mode:assessment}'` to separate modes.

## Environments

### Local (Docker)

- Targets:
  - `TARGET_URL_STANDARD` → e.g., `http://response-api:7078`
  - `TARGET_URL_ASSESSMENT` → e.g., `http://response-api-assessment:7078`
- Origins:
  - `ORIGIN_STANDARD` (allowed origin for standard instance)
  - `ORIGIN_ASSESSMENT` (allowed origin for assessment instance)
- Tokens (pre-generated; see below):
  - `TOKENS_FILE` (CSV/JSON for participant cookies)
  - `ASSESSMENT_TOKENS_FILE` (CSV/JSON for assessment cookies & correlation keys)

### Staging/Prod (Optional)

- Use the k6 operator for distributed tests in Kubernetes.
- Integrate with Prometheus remote-write or push JSON/HTML summaries to artifact storage.

## Data & Tokens Strategy

Because k6 lacks Node’s crypto and JWT libraries by default, we will pre-generate tokens externally and ingest them at runtime.

1) Create a tiny Node/TS script in repo (proposal):
   - `scripts/generate-k6-tokens.ts`
   - Uses `@klicker-uzh/util` `signJWT` with `APP_SECRET`
   - Emits:
     - Participant cookies: `participant_token` or `temporary_participant_token` for standard mode
     - Assessment cookie: `next-auth.participant-session-token` with `{ sub, role: 'PARTICIPANT' }`
     - Correlation keys (JWT with `{ liveQuizId, instanceId }`)
   - Output format: JSON lines (per VU) or CSV

2) Load in k6 with `SharedArray` for efficiency:
   - `const TOKENS = new SharedArray('tokens', () => JSON.parse(open(__ENV.TOKENS_FILE)))`
   - Same pattern for assessment tokens

3) Matching claims:
   - For assessment: the request body must carry `liveQuizId` and `instanceId` that match the correlation key’s claims.
   - For duplicate tests: reuse correlation key + cookie for the same `instanceId` to trigger 208 (with Redis vote pre-populated or processor running).

## Script Structure (tests/k6)

- `tests/k6/utils/payload.js`: generate realistic response payloads
- `tests/k6/utils/http.js`: wrapper for POST with headers/cookies, tagging per mode
- `tests/k6/utils/data.js`: load tokens via SharedArray
- `tests/k6/smoke.js`: quick health/endpoint checks
- `tests/k6/standard-load.js`: standard mode steady-state and ramp
- `tests/k6/assessment-load.js`: assessment steady-state and ramp
- `tests/k6/mixed.js`: combined 80/20 standard/assessment traffic using multiple scenarios
- `tests/k6/spike.js`: sudden spike then sustain
- `tests/k6/soak.js`: long-duration stability
- `tests/k6/duplicate.js`: exercise 208 behavior (requires Redis/processor or pre-pop)
- `tests/k6/summary.js`: handleSummary to emit JSON/HTML

## Scenarios (Examples)

### Mixed Scenarios (RPS-driven)

```js
// tests/k6/mixed.js
import http from 'k6/http'
import { sleep } from 'k6'

export const options = {
  scenarios: {
    standard_rps: {
      executor: 'ramping-arrival-rate',
      startRate: 100, timeUnit: '1s', preAllocatedVUs: 200, maxVUs: 2000,
      stages: [ { target: 500, duration: '3m' }, { target: 2000, duration: '10m' }, { target: 0, duration: '2m' } ],
      tags: { mode: 'standard' },
      exec: 'standard',
    },
    assessment_rps: {
      executor: 'constant-arrival-rate',
      rate: 200, timeUnit: '1s', duration: '15m', preAllocatedVUs: 400,
      tags: { mode: 'assessment' },
      exec: 'assessment',
    },
  },
  thresholds: {
    'http_req_duration{mode:standard}': ['p(95)<200', 'p(99)<350'],
    'http_req_duration{mode:assessment}': ['p(95)<250', 'p(99)<400'],
    http_req_failed: ['rate<0.01'],
  },
  discardResponseBodies: true,
}

const STD_URL = __ENV.TARGET_URL_STANDARD
const ASM_URL = __ENV.TARGET_URL_ASSESSMENT
const STD_ORIGIN = __ENV.ORIGIN_STANDARD
const ASM_ORIGIN = __ENV.ORIGIN_ASSESSMENT

export function standard () {
  const body = JSON.stringify({ response: { choices: [{ ix: 0, selected: true }] }, liveQuizId: 'LQ1', instanceId: 'I1' })
  const res = http.post(`${STD_URL}/AddResponse`, body, {
    headers: { 'Content-Type': 'application/json', Origin: STD_ORIGIN },
    // Optionally attach participant cookies per request:
    // cookies: { participant_token: pickToken() }
    tags: { mode: 'standard' },
  })
  sleep(0.2)
}

export function assessment () {
  const data = pickAssessment() // { cookie, correlationKey, liveQuizId, instanceId }
  const body = JSON.stringify({
    response: { choices: [{ ix: 1, selected: true }] },
    liveQuizId: data.liveQuizId,
    instanceId: data.instanceId,
    correlationKey: data.correlationKey,
  })
  const res = http.post(`${ASM_URL}/AddResponse`, body, {
    headers: { 'Content-Type': 'application/json', Origin: ASM_ORIGIN },
    cookies: { 'next-auth.participant-session-token': data.cookie },
    tags: { mode: 'assessment' },
  })
  sleep(0.5)
}
```

### Duplicate Behavior (208)

```js
// tests/k6/duplicate.js
// Precondition: Redis has HSET for key `lq:${liveQuizId}:i:${instanceId}:votes` with the correlationId
// Or ensure processor runs and records the first response; second submission should return 208.
```

## Metrics & Reporting

- Built-in metrics: `http_req_duration`, `http_req_failed`, `vus`, `iterations`, etc.
- Tag-based thresholds for `mode: standard|assessment` and per-scenario thresholds
- Custom counters: duplicates (208), invalid submissions, 401s (assessment cookie issues)
- Summary export: `handleSummary()` to write `summary.json` and `summary.html`
- Optional: `--out prometheus-remote-write` to stream results to Prometheus/Grafana

## Redis & Processor Interaction

- Without the response processor, duplicates won’t be recorded; the API only reads (`HGET`).
- For duplicate tests:
  - Option A: run the response processor worker
  - Option B: include a setup step to pre-populate Redis with `HSET` for computed correlationIds
  - Either way, verify 208 surfaces as expected under load

## Execution Recipes

### Local Docker

```bash
docker run --rm -i \
  -e TARGET_URL_STANDARD=http://host.docker.internal:7078 \
  -e TARGET_URL_ASSESSMENT=http://host.docker.internal:7079 \
  -e ORIGIN_STANDARD=https://pwa.klicker.com \
  -e ORIGIN_ASSESSMENT=https://assessment.klicker.com \
  -e TOKENS_FILE=/scripts/tokens.json \
  -e ASSESSMENT_TOKENS_FILE=/scripts/assessment_tokens.json \
  -v "$PWD/tests/k6":/scripts \
  grafana/k6:latest run /scripts/mixed.js
```

### k6 Operator (Kubernetes)

- Use the `TestRun` CRD to run distributed tests; configure `arguments`, `env`, and mount ConfigMaps for scripts.
- Use `ramping-arrival-rate` for RPS control and allocate enough VUs per pod.

## Pass/Fail Thresholds (Initial)

- Standard: `p95 < 200ms`, `p99 < 350ms`, error rate `< 1%`
- Assessment: `p95 < 250ms`, `p99 < 400ms`, error rate `< 1%`
- Tighten after observing baseline results

## Backlog

- Add a small token generator script in repo to simplify test data provisioning
- Add Redis init helper for duplicate tests (compute correlationId with MD5 or HMAC-SHA256 to match server config)
- Publish CI artifacts for summaries and raw metrics
- Optional dashboards: prebuilt Grafana dashboard JSON for k6 + Response API targets

## Risks & Mitigations

- Invalid tokens → ensure pre-generation uses the same `APP_SECRET` and matching claims
- Origin guard rejections → set `Origin` to allowed values per instance
- Redis unavailable → expected behavior; ensure tests include degraded-state runs
- Overly aggressive thresholds → start pragmatic; tighten with evidence

