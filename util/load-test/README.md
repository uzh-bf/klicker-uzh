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

### 5. `pwa-burst.js` (PWA burst tier drill, in-cluster)

Ramps unauthenticated `/login` renders and their static assets through the PWA Service, and probes one baseline and one burst Pod at the same small rate so their latencies compare at equal load. `/login` calls no other backend. The script runs inside the cluster because only there can it reach individual Pods. The default shape ramps for 10 minutes, holds the peak for 10 and cools down for 15; `PEAK_RATE` is capped at 100 iterations per second. Each iteration requests one page and `ASSETS_PER_PAGE` assets.

Run it only on staging and in an announced window:

```bash
kc() { kubectl --context=aks-stg-apps-admin -n stg-klicker "$@"; }
B=$(kc get pod -l 'app.kubernetes.io/component=frontend-pwa,!klicker.uzh.ch/tier' \
  --field-selector=status.phase=Running -o jsonpath='{.items[0].status.podIP}')
U=$(kc get pod -l klicker.uzh.ch/tier=burst \
  --field-selector=status.phase=Running -o jsonpath='{.items[0].status.podIP}')
kc create configmap pwa-burst-k6-script --from-file=util/load-test/pwa-burst.js
I=$(kubectl --context=aks-stg-apps-admin -n hap get svc \
  df-infra-k8s-chart-hap-stg-apps-kubernetes-ingress -o jsonpath='{.spec.clusterIP}')
kc create configmap pwa-burst-k6-env \
  --from-literal=PWA_SERVICE_URL=https://pwa.klicker.stg.df-app.ch \
  --from-literal=PWA_INGRESS_IP=$I \
  --from-literal=PWA_BASELINE_POD_URL=http://$B:3000 \
  --from-literal=PWA_BURST_POD_URL=http://$U:3000 \
  --from-literal=PEAK_RATE=30
kc apply -f util/load-test/pwa-burst-pod.yaml
kc logs -f pwa-burst-k6
kc delete pod/pwa-burst-k6 configmap/pwa-burst-k6-script configmap/pwa-burst-k6-env
```

The summary reports failures per phase (`ramp`, `plateau`, `cool`) and p95 latency per probed tier. A probe fails when the HPA removes the probed burst Pod during scale-down; read those failures separately from Service failures. Staging's untainted node pools often run at their autoscaler maximum, so the k6 Pod keeps a small CPU request. Route the ramp through the ingress controller as shown: the PWA Service balances per connection, so k6's reused connections would keep the load on the Pods that existed when the drill started.

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
