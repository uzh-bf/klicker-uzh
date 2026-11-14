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

---

### 5. `chat-exam.js` (Exam-shaped Load Against the Local Mock Model)

Simulates an exam: N students (default 100), one chat turn per student every 45 s for 30 minutes (at most 40 per student, never two in flight per student), all starting at the same instant, plus a page reload with history fetch every 10th slot. Each student gets a participant session cookie signed with the development `APP_SECRET`; no Edu-ID and no paid model is involved. `KLICKER_AUTH_MODE=assessment` mints the assessment chat's `next-auth.participant-session-token` (HS256, `iss` the auth origin, `role` PARTICIPANT, `scope` EDUID). `KLICKER_AUTH_MODE=regular` (default) mints today's `participant_token` (`iss` the API origin), which the chat app in this repository authenticates. The issuer defaults to the chat origin with `chat.` replaced by `auth.` or `api.`, which matches the routed development origins. `KLICKER_AUTH_ISSUER` is required for non-local targets. `KLICKER_AUTH_COOKIE` and `KLICKER_AUTH_ISSUER` override the cookie name and issuer.

**Targets local only by default.** The script refuses any host other than `localhost`, `127.0.0.1` or `*.localhost`. A remote host also needs `KLICKER_ALLOW_REMOTE_TARGET=true` and `KLICKER_ALLOW_SIDE_EFFECTS=true` (plus `KLICKER_ALLOW_PRODUCTION=true` for production). Remote runs need separate authorization and a real seeded course; the seeder below is local-only.

Runbook, from the host, for a linked worktree runtime started with `devrouter ensure . --profile chat,ai`:

```bash
# 1. Seed synthetic fixtures (course, PUBLISHED chatbot, participants numbered from 100 (default 100, at most 125),
#    accepted disclaimers, owner budget). Refuses any database without the disposable-test marker.
devrouter exec . -- bash -c 'cd packages/prisma-data && \
  CHAT_EXAM_LOAD_WRITE=true CHAT_EXAM_LOAD_PARTICIPANTS=100 pnpm run seed:chat-exam-load'

# 2. Route chat to the mock model (stops the real litellm container; run after `ensure`).
LITELLM_CONTAINER=<project>-litellm-1 util/load-test/mock-litellm.sh start
devrouter exec . -- node util/load-test/chat-mock-registry.mjs   # add KEY=VALUE args, e.g. CHAT_ASSESSMENT_MODE=true CHAT_PUBLIC_PWA_URL=... CHAT_PUBLIC_URL=...
#    (chat restarts outside turbo; the other apps stop being served until the next `ensure`)

# 3. Run. The dev APP_SECRET is read from the committed dev-only env file.
KLICKER_APP_SECRET="$(grep '^APP_SECRET=' .devcontainer/devcontainer.env | cut -d= -f2-)" \
  KLICKER_BASE_URL=https://chat.klicker.<workspace>.localhost \
  k6 run util/load-test/chat-exam.js

# 4. Restore: LITELLM_CONTAINER=... util/load-test/mock-litellm.sh stop; devrouter stop .
```

Short smoke: `STUDENTS=10 DURATION_MINUTES=2 RELOAD_EVERY_SLOTS=1`. Other knobs: `INTERVAL_SECONDS` (45), `MAX_PER_STUDENT` (40), `WARMUP_SECONDS` (30, synchronized-start delay), `LATE_THRESHOLD_SECONDS` (2), `KLICKER_SELECTED_MODEL` (`gpt-6-luna`).

Counters: `chat_requests_scheduled` (slots reached), `_admitted` (sent), `_late` (sent more than the threshold after the slot start), `_missed` (previous turn ran past the whole slot; skipped, not queued), `_failed` (non-2xx, no `finish` event, or an `error` event). Trends: `chat_first_byte_ms` and `chat_full_response_ms`. The run fails if any request is missed or failed.

**Mock model route.** `util/litellm/load-test.config.yaml` maps every chat alias to a LiteLLM `mock_response` with `mock_delay: 8`. LiteLLM v1.96's mock does not stream on the Responses API (it returns a non-stream object and the proxy answers 500), so `util/litellm/load-test.registry.json` registers the fallback model with `usesResponsesApi: false` and chat uses chat completions. The delay is applied before the mock emits its chunks, so each chat request stays in flight for about 8 s, but the model stream itself arrives as one burst. Concurrency of in-flight chat requests is therefore realistic; model-side stream duration is not. The runtime mounts `util/litellm/config.yaml` read-only and offers no override hook, so `mock-litellm.sh` swaps the litellm container with a mock on the same network alias. It refuses any container that is not this checkout's own litellm service. The shared `config.yaml` is never edited.

**What it does not measure.** First text delta (not measured: `chat_first_byte_ms` is the time to the first response byte, which the stream `start` event delivers before any text); real model latency, token counts and provider rate limits; MCP/retrieval and knowledge-graph calls (the seeded chatbot has none); thread title generation; browser rendering, JavaScript or reconnect behavior; Edu-ID, Traefik/Azure ingress or production database sizing. Prompt growth (each turn sends only the newest user message, so prompt size does not grow as in a real exam conversation that replays the thread history). A fast local machine also understates production resource contention.

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
