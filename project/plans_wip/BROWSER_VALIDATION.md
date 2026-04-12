# Browser Validation (DEV) — feat/chat-gpt-5-1

This document is the **browser-only (agent-browser)** validation plan for the changes on `feat/chat-gpt-5-1`.

## 0) Preconditions (you said you’ll ensure this is true)

- DEV environment is running (Traefik routing preferred):
  - `https://manage.klicker.com`
  - `https://pwa.klicker.com`
  - `https://chat.klicker.com`
  - `https://auth.klicker.com`
  - `https://api.klicker.com`
- DB is migrated + seeded (`pnpm prisma:setup`), so seeded users/course/chatbot exist.
- Use **Delegated login** for Manage (Edu-ID won’t work with agent-browser).

### If Traefik is not available

Use direct localhost ports (still OK for many checks, but cross-subdomain cookie behavior may differ):

- Manage: `http://localhost:3002`
- PWA: `http://localhost:3001`
- Chat: `http://localhost:3004`
- Auth: `http://localhost:3010`
- API/GraphQL: `http://localhost:3000`

## 1) Test data + accounts

### 1.1 Manage (Delegated Access)

- `lecturer` / `abcd` (ADMIN, `privatePreview=true`, owns seeded chatbot)
- `pro1` / `abcd` (`privatePreview=true`, **no chatbots**)
- `free` / `abcd` (`privatePreview=false`)

### 1.2 PWA participants

- Enrolled in Testkurs: `testuser1`–`testuser50` / `abcdabcd`
- Not enrolled by default: `testuser51` / `abcdabcd`

### 1.3 Seeded IDs (useful for direct URLs)

- Course (Testkurs): `7c12e44e-d083-4acf-845e-4c34aaff6b49`
- Chatbot (Benibot): `8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f`

## 2) agent-browser workflow conventions

### 2.1 Always capture evidence

Use `/tmp/` for artifacts.

- `agent-browser screenshot /tmp/klicker-<step>.png --full`
- Re-run `agent-browser snapshot -i -c` after each navigation or big UI change.

### 2.2 Prefer semantic locators where possible

Examples:

- `agent-browser find text "Delegated Access" click`
- `agent-browser find label "Username" fill "lecturer"`
- If semantic locators are flaky, fall back to snapshot refs (`@e123`).

### 2.3 Start each major flow with a clean session

Between users, clear storage:

- `agent-browser cookies clear`
- `agent-browser storage local clear`

(Optional) set a consistent viewport:

- `agent-browser set viewport 1440 900`

## 3) Smoke test flow A — Manage: Resources → Chatbots (happy path)

### A0 Open Manage + login as lecturer

1. `agent-browser open https://manage.klicker.com`
2. `agent-browser wait --load networkidle`
3. `agent-browser screenshot /tmp/manage-00-login.png --full`
4. Complete Delegated login (per AGENTS.md):
   - If a Terms checkbox blocks the button, check it first.
   - Then use Delegated Access.
5. `agent-browser wait --load networkidle`
6. `agent-browser screenshot /tmp/manage-01-after-login.png --full`

### A1 Verify navigation gating: Chatbots entry exists

Expectation: under **Resources**, there is a **Chatbots** entry (because `privatePreview=true` and `numChatbots>0`).

Steps:

1. Open the Resources dropdown (use snapshot refs).
2. Click Chatbots.
3. `agent-browser wait --url "**/resources/chatbots"`
4. `agent-browser screenshot /tmp/manage-02-chatbots-page.png --full`

### A2 Verify Chatbots page UI: list + details

Expectations:

- Left list exists (`[data-cy="chatbot-list"]`).
- There is an item for `Benibot` (`[data-cy="chatbot-Benibot"]`).
- Clicking it shows details (`[data-cy="chatbot-details"]`).

Suggested checks:

1. `agent-browser is visible "[data-cy=\"chatbot-list\"]"`
2. `agent-browser click "[data-cy=\"chatbot-Benibot\"]"`
3. `agent-browser wait "[data-cy=\"chatbot-details\"]"`
4. `agent-browser screenshot /tmp/manage-03-chatbots-details.png --full`

Verify in the details panel (visually + spot-check via text):

- Name/description/ID render.
- **Linked courses** shows at least one course with:
  - a Manage course link (`/courses/<id>`)
  - an **Open Chatbot** external link to PWA:
    - `/course/<courseId>/chatbot/<chatbotId>`
- Credits section shows initial/reset/max.
- Usage summary shows thread/message/participant counts (may start at 0).
- Disclaimer summary renders (accepted/declined totals if present).
- MCP configuration list/table renders without errors (if present).

### A3 Capture the “Open Chatbot” URL and open it (don’t rely on new tabs)

Because the link is `target=_blank`, prefer extracting the href:

1. Use snapshot on the details panel and locate the “Open Chatbot” link.
2. `agent-browser get attr @e<open-link> href`
3. `agent-browser open <that-href>`
4. `agent-browser wait --load networkidle`
5. `agent-browser screenshot /tmp/pwa-00-open-chatbot-entry.png --full`

## 4) Smoke test flow B — Manage nav gating (negative cases)

### B1 pro1: privatePreview=true but numChatbots=0

Expectation: **Chatbots entry is absent** under Resources.

Steps:

1. Clear cookies/storage.
2. Login as `pro1` / `abcd`.
3. Open Resources dropdown.
4. Confirm Chatbots is not present.

### B2 free: privatePreview=false

Expectation: **Chatbots entry is absent**.

(Optionally verify other privatePreview-gated entries show “Coming soon” disabled state, but Chatbots should be missing, not disabled.)

### B3 Direct URL access should be denied

Expectation: direct navigation to Chatbots resources is not allowed for `pro1` and `free`.

Steps (repeat for each user):

1. Login as `pro1` / `abcd`.
2. `agent-browser open https://manage.klicker.com/en/resources/chatbots` (use the locale prefix used in your environment).
3. Confirm redirect, 404, or access-denied state.
4. Repeat as `free` / `abcd`.

## 5) Smoke test flow C — PWA: chatbot redirect + ensureParticipation

Target URL:

- `https://pwa.klicker.com/course/7c12e44e-d083-4acf-845e-4c34aaff6b49/chatbot/8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f`

### C1 Logged-out behavior

Expectation: shows “login required” message and a login button.

Steps:

1. Clear cookies/storage.
2. Open the PWA chatbot URL.
3. Screenshot.
4. Click login.

### C2 Logged-in enrolled participant → redirects to Chat

Login:

- `testuser1` / `abcdabcd`

Expectation:

- After login, the page runs `ensureParticipation(courseId)` and then redirects to:
  - `https://chat.klicker.com/<chatbotId>` (and soon `.../threads/<threadId>`)

Steps:

1. Login.
2. `agent-browser wait --url "**chat.klicker.com/**"`
3. `agent-browser screenshot /tmp/chat-00-after-pwa-redirect.png --full`

### C3 Not-enrolled participant → participation required

Login:

- `testuser51` / `abcdabcd`

Expectation:

- PWA page shows “participation required” message + link back to the course.

## 6) Smoke test flow D — Chat: disclaimer, URL-based threads, model selection, streaming, metadata

Start from PWA redirect (preferred) or open directly:

- `https://chat.klicker.com/8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f`

### D0 Disclaimer modal (first-time participants)

Expectation:

- For a fresh enrolled participant, a disclaimer modal opens automatically.

Checks:

1. Confirm modal shows **Accept and continue** and **Decline**.
2. Click **Accept and continue**.
3. Confirm you reach the chat UI (look for placeholder “Write a message…”).

### D1 URL-based thread navigation

Expectation:

- On selecting/creating a thread, URL becomes `/<chatbotId>/threads/<threadId>`.

Checks:

1. `agent-browser get url` (after chat UI appears)
2. Create a new thread:
   - Click **New Chat**.
   - `agent-browser wait --url "**/threads/**"`
3. Switch between threads by clicking different thread list items.
4. Hard refresh on a deep link (`/threads/<threadId>`) and confirm the same thread loads.

### D2 Send a message (streaming must complete)

Goal: verify Azure **Responses API** streaming is working end-to-end.

Steps:

1. In the composer (placeholder “Write a message…”), enter a long-ish prompt, e.g.
   - “Write a structured explanation of X in ~8 paragraphs and end with a short summary.”
2. Send (use snapshot refs to hit the send button if needed).
3. Observe streaming continues until completion (no abrupt cutoff).
4. Screenshot when the assistant reply is complete.

### D3 Per-message metadata (mode/model/credits)

Expectation:

- Under **user messages**: `Mode — Model` (no credits)
- Under **assistant messages**: `Mode — Model — <n> credits`
- After refresh, metadata remains.

Checks:

1. After the first reply, visually confirm metadata is present under both messages.
2. Refresh the page.
3. Confirm metadata still shows (persistence).

### D3b Credits before/after a response

Expectation: credits decrement after a successful assistant response and `creditsUsed` displays in metadata.

Steps:

1. Capture current credits before sending a message:
   - `agent-browser eval "fetch('/api/chatbots/8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f/credits').then(r => r.json()).then(j => j.current)"`
2. Send a new message and wait for streaming to complete.
3. Capture credits after:
   - `agent-browser eval "fetch('/api/chatbots/8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f/credits').then(r => r.json()).then(j => j.current)"`
4. Confirm `current` decreased (or confirm a transaction/usage indicator is visible if credits are non-decrementing in your seed config).
5. Confirm the assistant message metadata shows `creditsUsed` and persists after refresh.

### D4 Model selection + mode selection

Expectation:

- The Settings panel shows:
  - Chat Mode selector
  - AI Model selector (enabled because `chatbot.modelSelection=true`)

Checks:

1. Open the Settings panel if collapsed.
2. Change Chat Mode (e.g. to `explainer`).
3. Change AI Model to **GPT‑5.1** (or the available label).
4. Send another message.
5. Confirm the _next_ messages’ metadata reflects the chosen mode/model.

### D5 Decline disclaimer blocks chat

Use a different enrolled participant that hasn’t accepted yet (e.g. `testuser2`).

Checks:

1. Clear cookies/storage, login as `testuser2`.
2. Open chat URL.
3. When disclaimer shows, click **Decline**.
4. Confirm blocked state appears (“Chatbot unavailable”) with “Show disclaimer again”.
5. Click “Show disclaimer again”, accept, confirm chat becomes usable.

### D6 Thread deletion and navigation correctness

Goal: validate the fixes for failed navigation after deletion and correct thread switching.

Checks:

1. Create at least 2 threads.
2. Delete a non-active thread → should not break URL.
3. Delete the active thread → app should navigate to `/<chatbotId>` (and then into a valid thread on selection).

### D7 Thread title editing

Checks:

1. Click **Edit name** on a thread.
2. Change title, save.
3. Refresh and confirm title persists.

## 7) Smoke test flow E — Back to Manage: usage/disclaimer aggregates

Goal: validate that GraphQL aggregates used by Manage update after chat activity.

Steps:

1. Return to Manage → Chatbots → Benibot.
2. Refresh.
3. Confirm usage summary changed (thread/message counts increased).
4. Confirm disclaimer summary reflects accepts/declines (if shown).

## 8) Smoke test flow F — API semantics for chatbotId (401/404)

Use `agent-browser eval` so HTTP status is explicit.

### F1 Logged-out → valid chatbot ⇒ 401

1. Clear cookies/storage.
2. `agent-browser open https://chat.klicker.com`
3. `agent-browser eval "fetch('/api/chatbots/8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f/credits').then(r => r.status)"`
4. Expect **401**.

### F2 Logged-in → invalid chatbotId ⇒ 404

1. From an authenticated chat session:
2. `agent-browser eval "fetch('/api/chatbots/not-a-uuid/credits').then(r => r.status)"`
3. Expect **404**.

### F3 Logged-in → nonexistent chatbotId (valid UUID) ⇒ 404

1. `agent-browser eval "fetch('/api/chatbots/00000000-0000-0000-0000-000000000000/threads').then(r => r.status)"`
2. Expect **404**.

### F4 Deep route invalid chatbotId ⇒ 404

1. `agent-browser eval "fetch('/api/chatbots/not-a-uuid/threads/anything/messages').then(r => r.status)"`
2. Expect **404**.

## 9) Smoke test flow G — Control app smoke

Expectation: Control loads without crashing (Formik transpilation regression guard).

Steps:

1. Clear cookies/storage.
2. `agent-browser open https://control.klicker.com`
3. `agent-browser wait --load networkidle`
4. `agent-browser screenshot /tmp/control-00-landing.png --full`
5. If prompted to login, use Delegated Access with `lecturer` / `abcd` and confirm a post-login screen renders.

## 10) What Droid can test vs what you should acceptance-test

### 8.1 Droid (agent-browser) can cover

- Manage gating + Chatbots UI layout (list/details)
- Manage “Open Chatbot” link correctness and cross-app flow into PWA
- PWA login-required and participation-required branches
- PWA ensureParticipation → redirect to Chat
- Chat disclaimer accept/decline + blocked state
- Chat URL thread routing (create/switch/refresh/deeplink/delete)
- Chat streaming completion (no mid-stream truncation)
- Mode/model selection flow + metadata rendering + persistence
- Basic “aggregates updated” check back in Manage
- API status behavior for invalid/missing chatbotId
- Control app basic smoke

### 8.2 You should acceptance-test (not reliable for agent-browser)

- Edu‑ID / real SSO flows
- Cross-browser behavior (Safari/Firefox mobile, cookie quirks)
- Real production-like data scale (many chatbots/courses/messages)
- Role/permission nuances in real accounts (OWNER vs ADMIN vs other roles)
- OLAT consumer integration end-to-end (OLAT UI calling the API, embeddings/iframe contexts)
- Long-running and cost-sensitive GPT‑5.1 usage scenarios (very long responses, sustained sessions)

## 11) Evidence checklist (what I’ll return after running this)

- A pass/fail checklist for each flow (A–G)
- The visited URLs
- Screenshots from `/tmp/` for each major step (at least one before/after per flow)
- Screenshots for any error states (403/401/404, disclaimer decline, participation required)
- Any console/network errors observed during the run (`agent-browser errors`, `agent-browser console`)

## 12) Progress / Run log (feat/chat-gpt-5-1)

### Flow results (template)
- A (Manage Chatbots): Pending
- B (Manage gating): Pending
- C (PWA login + participation): Pending
- D (Chat UX/threads/streaming/metadata): Pending
- E (Manage aggregates): Pending
- F (API semantics 401/404): Pending
- G (Control smoke): Pending

### Issues found + fixes
- (none)

### Notes
- LTI entry already creates Participation during token acquisition (`loginParticipantWithLti`).
- Validators: Pending
