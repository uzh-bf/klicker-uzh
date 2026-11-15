# Chatbot & Live Quiz k6 Load and Performance Testing

This directory contains k6 load and performance testing suites for KlickerUZH endpoints, including live-quiz response workloads and the Next.js chat platform (`apps/chat`).

## Safety & Execution Boundaries

- **Environment separation:** By default, scripts target Staging (`chat.klicker.stg.df-app.ch`). Running against Production (`chat.klicker.uzh.ch`) strictly requires explicit confirmation via `KLICKER_ALLOW_PRODUCTION=true`.
- **Cost & write safety for chat turns:** `chatbot-turn.js` triggers genuine AI model inference, MCP tool calls, database credit decrements, and chat thread persistence. It requires `KLICKER_ALLOW_SIDE_EFFECTS=true` and caps iterations via `MAX_TURNS` (default: 2, max: 10).
- **Secret hygiene:** Never pass plaintext secrets or raw tokens in committed scripts. Use `rs-infisical-operator` to inject secrets at runtime from the `klicker-dev` profile.
- **Values-free reporting:** Test output must report only request rates, durations, status codes, and boolean check results. Do not output session tokens, personal participant identifiers, or full model answer bodies.

---

## Test Scripts

### 1. `chatbot-http.js` (Anonymous HTTP Canary / Baseline)

Evaluates public endpoint performance, route redirects, disclaimer availability (401 unauthenticated check), and credit preflight checks.

```bash
# Run against Staging
KLICKER_BASE_URL=https://chat.klicker.stg.df-app.ch \
  KLICKER_CHATBOT_IDS="bd9ef6ed-27cd-47d1-bb65-b2b852f54fa1,66390140-2f5c-46e1-a8f4-cd466b7b4d86" \
  k6 run util/load-test/chatbot-http.js
```

### 2. `chatbot-auth.js` (Authenticated API Smoke)

Tests authenticated preflight checks (credits API, active disclaimer lookup) for one or more chatbots using a participant token or direct participant login.

```bash
# Run with direct participant login via Infisical
UV_CACHE_DIR=/tmp/uv-cache rs-infisical-operator --profile klicker-dev run \
  --map KLICKER_TESTSTUDENT_USERNAME=KLICKER_PARTICIPANT_USERNAME_OR_EMAIL \
  --map KLICKER_TESTSTUDENT_PASSWORD=KLICKER_PARTICIPANT_PASSWORD -- \
  k6 run -e TARGET_ENV=stg \
    -e KLICKER_BASE_URL=https://chat.klicker.stg.df-app.ch \
    -e KLICKER_API_URL=https://api.klicker.stg.df-app.ch \
    -e KLICKER_CHATBOT_IDS="bd9ef6ed-27cd-47d1-bb65-b2b852f54fa1,66390140-2f5c-46e1-a8f4-cd466b7b4d86" \
    -e KLICKER_ALLOW_LOGIN=true \
    util/load-test/chatbot-auth.js
```

### 3. `chatbot-turn.js` (Authenticated Chat Turn & SSE Streaming)

Executes real conversational turns against `/api/chatbots/[chatbotId]/chat`. Validates SSE streaming events, finish state, and MCP retrieval latency.

```bash
# Run 1-2 chat turns in Staging
UV_CACHE_DIR=/tmp/uv-cache rs-infisical-operator --profile klicker-dev run \
  --map KLICKER_TESTSTUDENT_USERNAME=KLICKER_PARTICIPANT_USERNAME_OR_EMAIL \
  --map KLICKER_TESTSTUDENT_PASSWORD=KLICKER_PARTICIPANT_PASSWORD -- \
  k6 run -e TARGET_ENV=stg \
    -e KLICKER_BASE_URL=https://chat.klicker.stg.df-app.ch \
    -e KLICKER_API_URL=https://api.klicker.stg.df-app.ch \
    -e KLICKER_CHAT_BASE_URL=https://chat.klicker.stg.df-app.ch \
    -e KLICKER_CHATBOT_ID=66390140-2f5c-46e1-a8f4-cd466b7b4d86 \
    -e KLICKER_CHAT_MODE=tutor \
    -e KLICKER_SELECTED_MODEL=auto \
    -e KLICKER_ALLOW_LOGIN=true \
    -e KLICKER_ALLOW_SIDE_EFFECTS=true \
    util/load-test/chatbot-turn.js
```

### 4. `k6.js` (Live Quiz Multi-user Load Test)

Legacy multi-stage load tester simulating concurrent student voting responses against `response-api`.

```bash
KLICKER_SESSION_TOKEN=<session-token> \
  KLICKER_PARTICIPANT_TOKEN=<participant-token> \
  LIVE_QUIZ_ID=<live-quiz-id> \
  k6 run util/load-test/k6.js
```

### 5. `escape-room-live.js` (Live Quiz Escape Room Smoke)

Logs in seeded participants who start and answer an active Live Quiz escape-room block, while one lecturer polls the progress table and one anonymous viewer polls the projector. It writes attempts and responses, so run it against the local seeded stack; production needs `KLICKER_ALLOW_PRODUCTION=true`. The header comment lists the required variables and how to read the block ids and projector digest.

```bash
k6 run --insecure-skip-tls-verify \
  -e KLICKER_API_URL=https://api.klicker.<workspace>.localhost \
  -e KLICKER_AUTH_URL=https://auth.klicker.<workspace>.localhost \
  -e KLICKER_RESPONSE_API_URL=https://response-api.klicker.<workspace>.localhost \
  -e KLICKER_LIVE_QUIZ_ID=<quiz id> -e KLICKER_BLOCK_ID=<block id> \
  -e KLICKER_INSTANCE_IDS=<id>,<id> -e KLICKER_PROJECTOR_DIGEST=<digest> \
  -e KLICKER_TEST_PASSWORD=<seeded password> \
  -e KLICKER_LECTURER_PASSWORD=<seeded password> \
  util/load-test/escape-room-live.js
```

### 6. `escape-room-group.js` (Group Activity Escape Room Session Smoke)

Spreads about 400 virtual students (`KLICKER_STUDENTS`) over the seeded course groups. They log in with a password, poll the session-phase query every 3 s like the PWA lobby, start their group's attempt once the session runs and answer the first stage at a low rate through the group decisions mutation. One lecturer polls the group activity's progress table every 5 s and one anonymous viewer polls the projector with its digest. It writes attempts and answers, so run it against the local seeded stack; production needs `KLICKER_ALLOW_PRODUCTION=true`. The seeded development passwords are used only when every target is a local `*.localhost` host; otherwise set `KLICKER_TEST_PASSWORD` and `KLICKER_LECTURER_PASSWORD`. The header comment lists the required ids (activity, `username:groupId` members, first stage instance, projector digest). Thresholds: p95 under 500 ms per endpoint and under 1 % failed requests.

```bash
k6 run --insecure-skip-tls-verify \
  -e KLICKER_API_URL=https://api.klicker.<workspace>.localhost \
  -e KLICKER_AUTH_URL=https://auth.klicker.<workspace>.localhost \
  -e KLICKER_GROUP_ACTIVITY_ID=<activity id> \
  -e KLICKER_MEMBERS=<username>:<group id>,<username>:<group id> \
  -e KLICKER_STAGE_INSTANCE_ID=<id> -e KLICKER_PROJECTOR_DIGEST=<digest> \
  util/load-test/escape-room-group.js
```

---

## Pre-requisites for Chatbot Testing

1. **Course enrollment:** The test participant must be enrolled in the course hosting the target chatbot (`Participation` record).
2. **Disclaimer acceptance:** If the chatbot requires a disclaimer, the participant must have an active `ChatUsageCredits` record with `disclaimerAcceptedAt` populated. Use `prd-disclaimer-accept.sh` or staging prisma setup if running from cold storage.
3. **Model selection:** When testing production or staging chatbots set to `auto-only`, pass `KLICKER_SELECTED_MODEL=auto`.

---

## Environment URL Matrix

| Setting                 | Staging (`stg`)                      | Production (`prd`)                   |
| ----------------------- | ------------------------------------ | ------------------------------------ |
| `KLICKER_BASE_URL`      | `https://chat.klicker.stg.df-app.ch` | `https://chat.klicker.uzh.ch`        |
| `KLICKER_API_URL`       | `https://api.klicker.stg.df-app.ch`  | `https://backend-sls.klicker.uzh.ch` |
| `KLICKER_CHAT_BASE_URL` | `https://chat.klicker.stg.df-app.ch` | `https://chat.klicker.uzh.ch`        |

---

## Troubleshooting & Common Pitfalls

- **`uv` cache permission error (`Operation not permitted`):**
  Prefix commands with `UV_CACHE_DIR=/tmp/uv-cache`.
- **`KLICKER_API_URL must be an explicit origin`:**
  Pass the base origin only (e.g. `https://api.klicker.stg.df-app.ch`), without `/graphql` or trailing slashes.
- **HTTP 403 / 404 on first chat turn:**
  Verify disclaimer acceptance for the participant account before initiating chat turns.
- **Production guard rejection:**
  Set `KLICKER_ALLOW_PRODUCTION=true` only after verifying approvals for production testing.
