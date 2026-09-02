# Embed Harness

Static parent page for verifying the embedded practice-quiz handshake locally.

## What it verifies

- parent sends `klicker:embed-init`
- parent retries initialization after 250 ms and 1 s so child hydration cannot
  lose the one-time iframe `load` handshake
- embedded practice quiz emits `klicker:quiz-state`
- resize-aware parents receive `klicker:embed-resize` and apply the iframe
  content height
- payload transitions through `overview`, `in-progress`, and `completed`
- accepted and rejected events are visible in the harness log

## Important

Use the local branch PWA URL, not `https://pwa.klicker.com/...`.

Production `pwa.klicker.com` is protected by CSP / `frame-ancestors` and will refuse to render inside the localhost harness. The harness is meant to verify this branch against the local verification stack.

## Run it

Open three terminals from the repo root.

### 1. Start the harness server

```bash
pnpm --dir util/embed-harness dev
```

### 2. Start the mock GraphQL API

```bash
ALLOWED_ORIGIN="http://127.0.0.1:3101" pnpm --dir util/embed-harness mock-api
```

### 3. Build and start the branch-local PWA

```bash
NEXT_PUBLIC_API_URL="http://127.0.0.1:4010/graphql" NODE_ENV=production pnpm --filter @klicker-uzh/frontend-pwa exec next build
NEXT_PUBLIC_API_URL="http://127.0.0.1:4010/graphql" NODE_ENV=production pnpm --filter @klicker-uzh/frontend-pwa exec next start --hostname 127.0.0.1 --port 3101
```

## Open the harness

Open:

```text
http://127.0.0.1:3020
```

The URL field is already prefilled with:

```text
http://127.0.0.1:3101/en/course/test-course/practiceQuizzes/test-quiz?embed=true
```

## Manual verification steps

### No handshake yet

1. Uncheck `Send init automatically after iframe load`.
2. Click `Load iframe`.
3. Confirm:
   - `Init state` is `Not sent`
   - `Last accepted type` is `-`
   - latest payload says no accepted payload yet

### Overview payload

1. Click `Send init`.
2. Confirm the latest payload becomes:

```json
{
  "version": 1,
  "status": "overview",
  "currentStep": 0,
  "totalSteps": 1
}
```

### Resize-aware embed

1. Keep `Let the host own vertical scrolling` enabled.
2. Click `Load iframe` and confirm the harness receives an
   `embed-resize` message.
3. Confirm `Viewport height` follows the reported height and the iframe has
   no independent vertical scrollbar.
4. Uncheck the option, reload the iframe, and confirm the harness no longer
   applies resize messages.

### In-progress payload

1. Click `Start` inside the iframe.
2. Confirm the latest payload becomes:

```json
{
  "version": 1,
  "status": "in-progress",
  "currentStep": 1,
  "totalSteps": 1
}
```

### Completed payload

1. Click `Submit` inside the iframe.
2. Confirm the latest payload becomes:

```json
{
  "version": 1,
  "status": "completed",
  "currentStep": 1,
  "totalSteps": 1
}
```

## Fallback if embedded Submit is flaky

Cross-origin iframe clicking can be unreliable in some browser setups.

If the payload does not move to `completed` after clicking `Submit` in the harness:

1. Open this URL in a second tab of the same browser session:

```text
http://127.0.0.1:3101/en/course/test-course/practiceQuizzes/test-quiz?embed=true
```

2. Click `Start`, then `Submit` there.
3. Return to the harness tab.
4. Click `Reload iframe`, then `Send init`.
5. Confirm the harness now shows the `completed` payload.

This works because the quiz persists progress in browser storage and the harness iframe shares that storage in the same browser session.

## Stop the local stack

Use `Ctrl-C` in each terminal.
