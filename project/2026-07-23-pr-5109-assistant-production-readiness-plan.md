# PR #5109 — Manage Assistant Production Readiness Plan

Date: 2026-07-23. Branch: `codex/manage-assistant-mcp-v3-ai` (local: `claude/finalize-v3-ai-branch-0fa103`). Target: `v3-ai`. PR: [#5109](https://github.com/uzh-bf/klicker-uzh/pull/5109).

Prior plans (history, do not edit): `project/2026-07-20-pr-5109-review-fixes-plan.md` (batches 1-3).

## Goal

Make the embedded manage assistant production ready. Six user-reported UX gaps plus the technical debt found in a full implementation review of `apps/mcp-lecturer` and the embedded chat.

## Non-goals

- No new proposal element types beyond SC/MC/FREE_TEXT (KPRIM/NUMERICAL/etc. stay read-only).
- No autonomous persistence: the signed-proposal + human-confirm model stays.
- No LLM-generated dynamic suggestions; suggestion sets stay static per surface.
- No publish/edit/delete flows via the assistant.

## Problems (user-reported, verified against code)

| # | Problem | Root cause (evidence) |
|---|---------|----------------------|
| P1 | Suggestions ("Draft a question idea based on the current Manage page context") make no sense when just browsing the library | Suggestions vary only on a boolean "any context present" flag, never on the actual surface. `getThreadSuggestions(contextual, mode)` in `apps/chat/src/components/thread.tsx:406-451` ignores `ManageAssistantContext.surface`/`ids` entirely. A lecturer on `/courses/42` and one on `/questions/17` see identical buttons. Bonus: `apps/chat/src/lib/config/suggestions.ts` is dead code — a same-named local function in `thread.tsx` shadows it. |
| P2 | Stored draft does not show up in the question library | No refetch signal. The confirm route (`apps/chat/src/app/api/manage/proposals/confirm/route.ts`) does a server-to-server GraphQL mutation; nothing tells the manage parent window to refetch `GetUserElementsDocument` (used by `apps/frontend-manage/src/pages/index.tsx:119-144`, `fetchPolicy: 'network-only'`). The chat→parent postMessage channel is currently ack-only (`apps/chat/src/hooks/useEmbeddedManageContext.ts`). |
| P3 | Drafted question sometimes rendered as plain text, not the proposal card | The card renders only for a tool-call part whose *result* matches the proposal shape (`getManageProposalResult`, `apps/chat/src/components/manage-proposal-card.tsx:50-73`, wired via `tool-fallback.tsx:76`). When the model free-forms JSON as message text, or uses the draft-only scaffolding tools (`question_draft`/`choices_draft`), no card appears. The system prompt (`apps/chat/src/services/manageAssistantRuntime.ts:8-18`) instructs proposal use but not strongly enough, and nothing forbids restating the payload as text. |
| P4 | Preview is a raw JSON dark box, not responsive, collapsed by default, with a redundant text summary below | `manage-proposal-card.tsx:206-210` renders `JSON.stringify(payload)` in a `<pre>` behind a `showPreview` toggle (`:83`, `:153-160`). Meanwhile `apps/chat` already renders REAL interactive questions with `StudentElement` from `@klicker-uzh/shared-components/src/StudentElement` in `student-practice-quiz-card.tsx:12-14` — the preview swap is pure UI work, all deps present. |
| P5 | No explanation of what the assistant can do | No capability explainer exists anywhere: not in the drawer (`ManageAssistantWidget.tsx:169-218`), not on `/manage` (`apps/chat/src/app/manage/page.tsx`), not in `ThreadWelcome` (`thread.tsx:314-375`). |
| P6 | (Found in review) Langfuse error storm; mcp-lecturer invisible in dev | `@langfuse/otel@4.6.1` peer-requires OTel v2 (`@opentelemetry/core ^2.0.1`, `sdk-trace-base ^2.0.1`, `exporter-trace-otlp-http >=0.202.0`) but the workspace resolves OTel v1.26.0 / 0.53.0 → `TypeError: Cannot read properties of undefined (reading 'name')` once per span, swallowed and logged. Inherited from `v3-ai` (no Langfuse changes on this branch). Separately, `apps/mcp-lecturer` is missing from the `dev:container` turbo filter (root `package.json:57`), while chat's `buildMcpServiceUrl` (`apps/chat/src/services/mcpUrl.ts:31-33`) always targets `http://localhost:7081/mcp` in dev — so the assistant silently degrades to zero tools unless someone hand-starts the server. |

## Implementation review — key facts a junior needs

- **MCP tool inventory** (`apps/mcp-lecturer/src/server.ts:89-237`, names in `src/toolPolicy.ts:1-11`): 1 meta (`capabilities`), 4 read (`course_list`, `course_get`, `element_search`, `element_get`), 3 draft-only scaffolds (`question_draft`, `choices_draft`, `feedback_draft` — non-persisting), 1 signed proposal (`element_create_draft_proposal`, the only one with `requiresHumanConfirmation: true`). No confirm tool exists — confirmation is exclusively the chat HTTP route.
- **Proposal payload** (`apps/mcp-lecturer/src/service.ts:423-438`, options built at `:596-618`): `{basePoints, content, explanation?, name, options.choices[{ix, correct, feedback?, value}], pointsMultiplier: 1, status: 'DRAFT', tags[], type: SC|MC|FREE_TEXT}` + `proposalToken` (HS256 JWT, 15-min expiry, signed `server.ts:40-63`). Chat-side verify schema: `apps/chat/src/services/manageProposals.ts:7-64`.
- **Preview stack that manage already uses**: `StudentElement` (`packages/shared-components/src/StudentElement.tsx:115-481`, deep import only — the package's declared `main` `src/index.ts` does not exist) needs an `ElementInstance`; manage fabricates one from form values via `useArtificialElementInstance` (`apps/frontend-manage/src/components/elements/manipulation/useArtificialElementInstance.ts:10-155`). Type→typename mapping: SC/MC→`ChoicesElementData`, FREE_TEXT→`FreeTextElementData` (canonical table: `ElementTypeMonitor.tsx:17-35`). `payload.options.choices` maps 1:1 to `elementData.options.choices` — no field renames. Synthetic ids (`id: 0`) are fine (that's what `useArtificialElementInstance.ts:26` does).
- **postMessage security model**: parent side checks `event.origin === assistantOrigin` AND `event.source === iframe.contentWindow` (`ManageAssistantWidget.tsx:90-112`) and always posts with an explicit target origin. Chat side checks `event.source === window.parent && event.origin !== 'null'` and echoes `event.origin` in acks. Chat does NOT yet cache the parent origin for proactive outbound messages — the sibling `chatContextStore` (`apps/chat/src/stores/chatContextStore.ts`) already does exactly this for the PWA embedding; copy that pattern.
- **Model**: `selectManageAssistantModel` picks the first non-fallback registry entry → `gpt-5.5`, `maxOutputTokens: 2048` (`apps/chat/src/lib/server/chatModelRegistry.ts:101-160`). Tool-call arguments count as output tokens — a full MC proposal with per-choice feedback can be large; check headroom (Slice 4).
- **Auth chain** (context for security review): lecturer MCP JWT minted by chat (`mcpAuthMint.ts:90-133`, purpose `lecturer-mcp`, scope `manage:read manage:draft`, 5-min TTL) and verified by mcp-lecturer (`auth.ts:44-80`); proposal token is a separate purpose (`manage-assistant-proposal`) on the same secret/issuer infra. No audience claim anywhere — do not weaken further; adding `aud` is optional hardening, not in scope.
- **FREE_TEXT proposals carry no sample-solution data** (`getProposalOptions` returns `{hasSampleSolution: false, restrictions: {}}`) — the preview will show just the prompt; acceptable, note in explainer copy if needed.

## Decisions (approved 2026-07-23 unless vetoed)

- D1: Static per-surface suggestion sets derived from `ManageAssistantContext.surface`; consolidate into one module; delete dead `lib/config/suggestions.ts`.
- D2: Library refresh via new chat→parent message `klicker:manage-element-created` + targeted `apolloClient.refetchQueries({ include: [GetUserElementsDocument] })` in the widget. No polling, no full reload.
- D3: Replace the JSON box with the real `StudentElement` preview, auto-expanded, raw JSON demoted to a "Show raw JSON" details toggle. Model instructed to add no textual restatement after the card.
- D4: Reliability via prompt hardening + tests, not forced tool choice (forcing breaks plain Q&A turns).
- D5: Capability explainer lives in the chat welcome (single source for embedded + new-tab); drawer subtitle stays short.
- D6: Fix the Langfuse/OTel peer mismatch in this PR (chat telemetry matters for the assistant); align OTel deps to the v2 line `@langfuse/otel@4.6.1` expects.
- D7: Add `mcp-lecturer` to the devcontainer dev stack so dev always has tools; keep silent-degradation behavior in prod but make the prompt fallback line the explicit UX ("tools unavailable" — already exists in `buildManageAssistantSystemPrompt`).

## Slices

Work one slice at a time. Per slice: implement → verify (fastest meaningful check first, then browser) → update `Progress` → conventional commit → review + simplification subagents on the exact commit → integrate → re-verify → commit adjustments. Push only to `HEAD:codex/manage-assistant-mcp-v3-ai`, non-force. Never commit secrets; data-hygiene check (`git diff --cached`) before every commit.

### Slice 1 — Context-aware suggestions

**Do:**
1. Create `apps/chat/src/lib/config/manageSuggestions.ts` exporting `getManageSuggestions(context: ManageAssistantContext | null): ThreadSuggestion[]`. Per-surface sets (labels ≤ ~22 chars so three fit the 28-rem drawer):
   - `question-pool`: "Draft a new question" (`Draft a new single-choice question I could add to my question pool. Ask me for the topic first if unclear.`); "Find questions" (`Search my question pool for questions about a topic I will give you. Include all statuses and types.`); "Improve feedback" (`Pick a question I name and suggest clearer answer feedback for it.`)
   - `element-editor` (has `ids.elementId`): "Improve this question" (reference the open question via its id); "Draft a variant"; "Better feedback".
   - `course-dashboard` (has `ids.courseId`): "Summarize this course"; "Draft course question"; "Find course material".
   - `activity-creation`: "Draft quiz questions"; "Find reusable questions"; "Balance difficulty".
   - `evaluation`: "Explain results"; "Draft follow-up question"; "Find similar questions".
   - `general` / `null` context: the current non-contextual set ("Draft question", "Find questions", "Improve feedback") with prompts that never mention "current page context".
   Exact prompt wording is the junior's craft — the rule: a suggestion must be actionable *on that surface with that context* and must never reference context that is not there.
2. In `thread.tsx`, delete the local `getThreadSuggestions` (`:406-451`); have `ThreadWelcomeSuggestions` take the suggestion list as a prop. `manage-assistant.tsx` computes it from the (already available) `context` object and passes it down. The student/pwa mode keeps its existing set (move it into the same module or leave the student set where the student assistant defines it — keep one live module per mode, zero dead ones).
3. Delete `apps/chat/src/lib/config/suggestions.ts` (dead) after confirming with grep that nothing imports it.
4. Unit test: `getManageSuggestions` per surface (six cases + null).

**Check:** `pnpm --filter @klicker-uzh/chat check` + `test:run`; agent-browser on 3 surfaces (library `/`, a question editor, a course dashboard) — buttons differ and wording matches surface; click one → sends.
**Commit:** `enhance(chat): derive manage assistant suggestions from the active manage surface`

### Slice 2 — Real question preview in the proposal card

**Do:**
1. New `apps/chat/src/components/manage-proposal-preview.tsx`: map proposal payload → `ElementInstance` (slim twin of `useArtificialElementInstance`, SC/MC/FREE_TEXT only; typename per `ElementTypeMonitor` table; synthetic `id: 0`; choices pass through unchanged) and render `StudentElement` with `preview` + `compact`, following `student-practice-quiz-card.tsx`'s import + response-props pattern. Deep import `@klicker-uzh/shared-components/src/StudentElement`.
2. In `manage-proposal-card.tsx`: render the preview **always** (remove `showPreview` gating for it); demote the JSON `<pre>` to a `<details>` "Show raw JSON" at the card bottom; repurpose/remove the Preview button. Constrain with `max-w-full overflow-x-auto`; verify at 28-rem drawer width AND mobile drawer (bottom sheet).
3. Prompt: append to `BASE_MANAGE_ASSISTANT_PROMPT`: after the proposal tool returns, reply with at most one short sentence and never restate the question content, options, or JSON — the card already shows them.
4. Zod-parse the payload with the existing `manageElementCreateProposalSchema` before mapping; on parse failure fall back to the raw JSON details block (never a crashed card).

**Check:** typecheck + chat tests; agent-browser: create SC, MC, and FREE_TEXT proposals → card shows the real rendered question (choices visible, markdown/KaTeX in content works), auto-expanded, no horizontal scroll of the page, assistant adds no redundant text summary. Screenshot for the PR.
**Commit:** `enhance(chat): render manage proposals with the real student question preview`

### Slice 3 — Library refresh after draft creation

**Do:**
1. In `useEmbeddedManageContext.ts`: cache `event.origin` (the verified parent origin) in state/store when a context message is accepted — copy the `chatContextStore` pattern (`apps/chat/src/stores/chatContextStore.ts`). Expose it (e.g. via the same hook return or a small store).
2. New helper `notifyManageParent(message)` used by `ManageProposalCard` after a successful confirm (`manage-proposal-card.tsx:111-115`): `window.parent.postMessage({ type: 'klicker:manage-element-created', payload: { id, name } }, cachedParentOrigin)`. Never post with `'*'`; skip silently when no cached origin (non-embedded /manage tab — nothing to refresh).
3. In `ManageAssistantWidget.tsx` message handler (`:90-112`, same origin + source checks): on `klicker:manage-element-created`, call `apolloClient.refetchQueries({ include: [GetUserElementsDocument] })` (`useApolloClient()` — the widget is inside `ApolloProvider`). Optionally fire the design-system `Toast` "Draft «name» added to your question pool".
4. Payload is data, not instructions: validate shape (id number, name string ≤ 200 chars) before using; render name only through React text (no HTML).

**Check:** agent-browser: open library, open assistant, create + confirm a draft → new row appears in the visible list without reload; new-tab `/manage` (non-embedded) confirm still works with no console errors.
**Commit:** `fix(manage-assistant): refresh the question pool when the assistant creates a draft`

### Slice 4 — Proposal-path reliability (text-instead-of-card)

**Do:**
1. Harden `BASE_MANAGE_ASSISTANT_PROMPT` (`manageAssistantRuntime.ts:8-18`): when the lecturer asks to create/save/store/persist a question, ALWAYS call `klicker_lecturer_element_create_draft_proposal`; NEVER print a proposal or question JSON as message text; draft-only scaffold tools are for brainstorming only and their output must be presented as prose, not JSON.
2. Extend the existing `manage-assistant-runtime` vitest suite: assert the prompt contains the new invariants; assert `buildManageAssistantSystemPrompt` output for tools-available and tools-unavailable branches.
3. Measure headroom: log/inspect a real MC proposal's output-token usage (litellm response `usage`); if a 5-choice MC with feedback approaches 2048, raise `maxOutputTokens` for the manage entry in `chatModelRegistry.ts:101-160` (e.g. 4096) — separate mini-commit if changed.
4. Manual eval matrix (document results in Progress): 6 phrasings ("create a question about X", "save this as a draft", "add to my pool", "make an MC question", "draft one but don't save", "store the one above") × expected outcome (card vs prose). Two failures on the same phrasing = iterate the prompt once more; persistent failure = record as known limitation, not a blocker.

**Check:** vitest green; eval matrix ≥ 5/6 producing the card for persistence-intent phrasings; "don't save" phrasing produces prose (no card).
**Commit:** `fix(chat): harden the manage assistant prompt so persistence intents always use the proposal tool`

### Slice 5 — Capability explainer

**Do:**
1. In `ThreadWelcome` (manage mode), under the greeting and above the suggestions, render a compact explainer (small text or 3 icon bullets):
   - "Search your courses and question pool"
   - "Draft single-choice, multiple-choice, and free-text questions — saved to your pool only after you confirm"
   - "Suggest improvements to question feedback"
   - One-line limits note: "Read-only for everything else — it never publishes or edits existing content."
   Drive it from a new prop (e.g. `capabilities?: string[]`) passed by `manage-assistant.tsx`, so the student chat is untouched.
2. Keep the drawer header subtitle (`t('manage.assistant.subtitle')` in `ManageAssistantWidget.tsx`) one line; update the i18n string (packages/i18n, DE+EN) to something like "AI assistant for your courses and question pool" if the current copy is vaguer.
3. Follow the chat app's existing language convention for the welcome strings (currently hardcoded EN in `manage-assistant.tsx`); do not invent a new i18n mechanism for chat in this slice.

**Check:** agent-browser: fresh drawer shows greeting → capabilities → suggestions without scrolling at 28-rem width; new-tab `/manage` shows the same; student chat welcome unchanged (existing Playwright `Y-chat` welcome assertion stays green).
**Commit:** `enhance(chat): explain manage assistant capabilities in the welcome screen`

### Slice 6 — Langfuse/OTel dependency fix

**Do:**
1. In `apps/chat/package.json`, align OTel to what `@langfuse/otel@4.6.1` peer-requires: `@opentelemetry/sdk-trace-node` → 2.x line, matching `@opentelemetry/core`, and `exporter-trace-otlp-http` ≥ 0.202.0 (check `pnpm why @opentelemetry/sdk-trace-base --filter @klicker-uzh/chat` resolves a single 2.x). Pin exact versions; `pnpm install`; commit lockfile with the manifest.
2. Verify `instrumentation.ts` still compiles against the v2 API (`NodeTracerProvider` constructor/`register()` moved slightly between majors — fix per current docs, use Context7 for the exact v2 API).
3. If the v2 bump cascades into other packages' OTel resolution, STOP and report — do not chase a workspace-wide OTel migration inside this PR; fallback is downgrading `@langfuse/*` to an OTel-v1-compatible major instead.

**Check:** `pnpm --filter @klicker-uzh/chat check` + full `pnpm run check`; dev stack: send one manage message → zero `[Langfuse SDK] [ERROR]` lines in `/tmp/dev.log`; if Langfuse creds exist in dev, confirm a trace arrives; otherwise verify no export errors and note creds-absent.
**Commit:** `build(chat): align OpenTelemetry packages with @langfuse/otel v4 peer requirements`

### Slice 7 — mcp-lecturer in the dev stack

**Do:**
1. Add `--filter=@klicker-uzh/mcp-lecturer` to the `dev:container` turbo command (root `package.json:57`).
2. Env: mcp-lecturer needs `APP_ORIGIN_AUTH` (workspace-namespaced!) and `MCP_LECTURER_JWT_SECRET`/`APP_SECRET` at startup (`apps/mcp-lecturer/src/config.ts:25-45`). `APP_ORIGIN_AUTH` is namespaced by `.devcontainer/post-start.sh` for other apps — wire mcp-lecturer the same way; do NOT hardcode a workspace name in committed files. Default port 7081 needs no route (chat reaches it in-container via `localhost:7081`).
3. Beware `tsx --watch` in `dev:raw`: known to kill long-running servers in this repo (Hatchet lesson, `docs/solutions/` + memory). If the worker dies under watch, run without `--watch` in the container script variant.
4. Update `.devcontainer/README.md` + the wiki page for the dev stack (`docs/`, per `klicker-wiki-maintenance`) — the assistant needs mcp-lecturer, and it now starts automatically.
5. Delete/retire the manual helper mention in older docs if any remain.

**Check:** `devrouter stop . && devrouter ensure .` from a clean state → `curl` inside the container to `localhost:7081/mcp` responds; assistant loads tools (send "create a question…" → proposal card appears) with zero manual steps.
**Commit:** `fix(dev): run the lecturer MCP server as part of the devcontainer stack`

### Slice 8 — E2E coverage + finish gates

**Do:**
1. Playwright spec (follow `klicker-playwright-e2e` skill + existing `Y-chat.spec.ts` mocked-stream pattern): lecturer-authed manage assistant journey with `/api/manage/chat` mocked to return (a) a plain text stream → text bubble renders; (b) a tool-call part shaped like the proposal result → card renders auto-expanded with the real preview; mock `/api/manage/proposals/confirm` → success state renders and the `klicker:manage-element-created` message fires (assert via page listener). Assert per-surface suggestions on two surfaces. If lecturer-auth in the chat app proves too deep for this PR, mock `getAuthenticatedManageUserId` at the route boundary and record the gap explicitly — do not silently skip.
2. Finish gates, in order, after all slices land:
   - fresh full verification: `pnpm run check:all`, `pnpm run test:run`, targeted Playwright, agent-browser pass over all five UX fixes with screenshots for the PR;
   - `$security-review` over the whole new range (focus: postMessage origins, proposal schema parse before preview render, no secret/env leakage in new client code);
   - `$thermo-nuclear-code-quality-review` as the final maintainability gate;
   - independent branch review (per Trusted Agent Access / `$rs-model-routing`);
   - update PR #5109 body with `$rs-mr-description-writer` (new range, screenshots, eval matrix results);
   - keep the PR draft; ready/merge only on Roland's explicit instruction.

**Commit:** `test(chat): cover the manage assistant journey with mocked-stream Playwright specs` (+ gate-fix commits as needed)

## Dependencies between slices

1, 5, 6, 7 independent. 2 before 3 (confirm handler moves). 4 any time after 2 (prompt references the card contract). 8 last.

## Risks

- OTel v2 bump cascade (Slice 6) — bounded by the explicit STOP rule.
- Model behavior (Slice 4) is probabilistic; the eval matrix defines "good enough" so the junior does not chase 100%.
- `StudentElement` renders interactively even with `preview` — confirm the proposal preview cannot submit anything (no response handlers wired = display-only; verify no console errors from missing handlers).
- Suggestions i18n: chat app is EN-hardcoded today; if product wants DE suggestions, that is a separate decision — flag, do not build.

## Progress

- 2026-07-23: Plan drafted from full implementation review (two exploration passes over apps/chat, apps/mcp-lecturer, apps/frontend-manage preview/query stack). Decisions D1-D7 proposed to Roland. No slices started.
