# PR 5109 review-fixes plan

## Identity

- Plan: `project/2026-07-20-pr-5109-review-fixes-plan.md`
- Branch: `codex/manage-assistant-mcp-v3-ai` (push HEAD here only, non-force FF)
- Target: `v3-ai`
- PR: [#5109](https://github.com/uzh-bf/klicker-uzh/pull/5109)
- Source review: [`project/2026-07-20-pr-5109-implementation-review.md`](2026-07-20-pr-5109-implementation-review.md); predecessor [`project/2026-07-07-pr-5109-production-readiness-review.md`](2026-07-07-pr-5109-production-readiness-review.md)

## Goal

Land the merge-blocker fix batch: green CI + a working lecturer course-list + clean mcp-student auth semantics. Fix the chat-feature author's code (not the devcontainer commits).

## Non-goals

- N1 (env-file flag for stg/prd) — rollout gating, done when they choose to enable. Not a code fix.
- N4/N5/N7 (onError sanitizer, MCP timeouts, CSP fail-closed) — next batch, out of scope here.
- U1 (chat i18n), noLogin iframe escape, F7/F8, tool-surface gaps — tracked follow-ups.
- OpenRouter key injection + live browser E2E — separate, needs secrets approval.

## Decisions

- N2 welcome: keep shipped `Ask {chatbotName}`; update stale spec assertion. Zero user-facing change. Alt (restore "How can I help you?") not taken — that is the author's copy call.
- N3: mirror lecturer's `Authentication failed:` prefix exactly (transport classifies 401 on the `Authentication` substring).
- N6 scope: exec-form CMD (student) + exhaustive student error switch + SIGTERM/SIGINT graceful shutdown (both servers). Gate shutdown on FastMCP `.stop()` existing (tsc-guarded).
- F5 guard: normalize `*`, `.*`, `.+`, `%`, whitespace-only → no filter, in `listCourses` and `searchElements`; `.describe()` all read-tool params.

## Verification

- Slice 1 (N2): run the 3 Y-chat specs vs the running worktree stack (uses `mockChatStream`, no LLM key). `devrouter exec` playwright.
- Slices 2-5: `devrouter exec . -- pnpm --filter @klicker-uzh/<pkg> test` + `tsc --noEmit`.
- Finish: full local check:all, Workflow adversarial review over `fb58d89e2..HEAD`, `$security-review`, `$thermo-nuclear-code-quality-review`, then CI on push.

## Slices

1. **N2 — chat testid + welcome e2e.** `apps/chat/src/components/thread.tsx` (move `data-cy="chat-assistant-message-content"` avatar-wrapper → text div), `playwright/tests/Y-chat.spec.ts` (welcome assertion → shipped copy). Commit `fix(chat): restore assistant-message testid and align welcome e2e copy`.
2. **F5 — lecturer query guard + describes + test.** `apps/mcp-lecturer/src/service.ts` (normalizeQuery guard in listCourses+searchElements, `.describe()` read schemas), `apps/mcp-lecturer/test/*` (wildcard→all unit test). Commit `fix(mcp-lecturer): treat wildcard course/element queries as no filter, describe params`.
3. **F6 — manage prompt reword.** `apps/chat/src/services/manageAssistantRuntime.ts:14` (no raw UUIDs), adjust any test pinning the string. Commit `fix(chat): stop manage assistant prompt from surfacing raw UUIDs`.
4. **N3 — mcp-student auth 401.** `apps/mcp-student/src/server.ts:72` + `auth.ts:40` + wrap verifyJWT `.catch()` → `Authentication failed:` prefix; unit-test the message. Commit `fix(mcp-student): return 401 not 500 on auth failure`.
5. **N6 — mcp-student ops hardening.** `apps/mcp-student/Dockerfile` exec-form CMD, `apps/mcp-student/src/toolErrors.ts` exhaustive safe switch, `apps/{mcp-student,mcp-lecturer}/src/index.ts` SIGTERM/SIGINT shutdown. Commit `fix(mcp-student): exec-form CMD, exhaustive safe errors, graceful shutdown`.

## Progress

- Plan committed `9a025d610`.
- Slice 1 (N2) done in worktree: `thread.tsx` moved `data-cy="chat-assistant-message-content"` from avatar-wrapper div to the text div wrapping `Unstable_PartsGrouped`; `Y-chat.spec.ts:344` welcome assertion `'How can I help you'` → `'Ask'` (matches shipped `Ask {chatbotName}`). Verification: local Playwright suite NOT run — its `global-setup` wipes the DB (`cleanupDatabase` deletes all courses/users/participants), which would destroy the running worktree dev stack's data; the mocked-stream Y-chat specs are the CI `test-playwright` gate against an ephemeral DB, which is the authoritative check on push. No user-visible rendering change (welcome copy unchanged, data-cy invisible), so no separate browser screenshot. Pre-commit `check:all` (tsc+lint+format) gates the edit.
- Slice 1 committed `54aaaf639` (pre-commit check:all green, 25 tasks).
- Slice 2 (F5) done: `service.ts` added `normalizeQuery` (wildcard/whitespace-only `*` `.*` `.+` `%` → no filter) applied in `listCourses` + `searchElements`; added `.describe()` to all four read schemas (courseList/courseGet/elementSearch/elementGet). `service.test.ts` +3 tests (genuine query keeps OR, wildcard-only course/element query drops OR). Verification: `pnpm --filter @klicker-uzh/mcp-lecturer test` → 36 passed (8 files); `check` (tsc --noEmit) clean, both in-container.
- Slice 2 committed `63fc1456b` (check:all green).
- Slice 3 (F6) done: `manageAssistantRuntime.ts:14` reworded — forbid raw tool JSON AND raw UUIDs, summarize by human-readable name, numeric question id only to disambiguate. `manage-assistant-runtime.test.ts` +1 assertion pinning the new instruction. Verification: `vitest run manage-assistant-runtime` → 3 passed, in-container. (Context block still passes `Course ID` to the model for tool calls — separate concern, not lecturer-facing output.)
- Slice 3 committed `06fa65f7b` (check:all green).
- Slice 4 (N3) done: mirrored lecturer's `Authentication failed:` prefix so the mcp-proxy transport (case-sensitive `Authentication` substring) classifies these as 401 not 500. `server.ts` missing-bearer message; `auth.ts` wrapped `verifyJWT` in `.catch()` → `Authentication failed: invalid participant token`, and prefixed the non-participant message. Also updated `toolErrors.ts` classifier: replaced the now-stale `=== 'Missing Authorization bearer token'` literal with `/Authentication failed/i` so all three new messages map to UNAUTHENTICATED. New `test/auth.test.ts` (4 tests, mirrors lecturer) + toolErrors classifier assertion. Verification: `pnpm --filter @klicker-uzh/mcp-student test` → 27 passed (8 files); `check` clean, in-container. (`safeStudentToolMessage` passthrough at line ~108 still references the old literal — intentionally left; slice 5/N6 rewrites that function to an exhaustive fixed-string switch.)
- Slice 4 committed `7f0358926` (check:all green, after prettier --write on the new test).
- Slice 5 (N6) done: (a) `mcp-student/Dockerfile` shell-form `CMD` → exec-form so node is PID 1 and receives SIGTERM (shell form swallowed it, defeating shutdown); (b) `toolErrors.ts` `safeStudentToolMessage` rewritten to an exhaustive per-code switch of fixed safe strings (no `default`, no raw-message passthrough) mirroring the lecturer allowlist — this stops the `default: return message` leak for QUESTION_REF_*/SUBMISSION_INVALID/PRACTICE_POOL_UNAVAILABLE and the UNAUTHENTICATED passthrough; (c) SIGTERM/SIGINT graceful shutdown (`await server.stop()`) added to both `mcp-student` and `mcp-lecturer` `index.ts` (FastMCP 3.15.2 `stop(): Promise<void>`, typed). Updated toolRunner/toolErrors tests — one previously asserted the raw `student-answer-payload` value in the client-facing error (the exact leak N6 fixes). Verification: student 28 passed (8 files) + tsc clean; lecturer 36 passed (8 files) + tsc clean, in-container. Dockerfile exec-form validated by CI image build.
- Slice 5 committed `0af98c8dd` (check:all green, after prettier --write on toolErrors test).
- Finish gate:
  - `$security-review` over `9a025d610..HEAD`: no high-confidence vulns. N3 leaves the auth decision unchanged (only error type/message); N6 removes the raw-message leak (safeStudentToolMessage no longer takes/returns `message`); F5 preserves `userId: session.userId` scoping (guard only rewrites the OR sub-clause), regex anchored/single-class over ≤120 chars (no ReDoS); exec-form CMD removes the shell. Net security-positive.
  - `$thermo-nuclear-code-quality-review` is user-invocation-only (`disable-model-invocation`) — substituted an independent read-only review subagent over the same range with the review rubric. Result: no BLOCKERs. Confirmed data-cy move is a real correctness fix, exhaustive switch is tsc-complete (all 11 codes), 401 fix traced into `node_modules/mcp-proxy` `errorMessage.includes("Authentication")` (case-sensitive), no scope creep.
  - Accepted 1 finding: shutdown handlers exited 0 even on `server.stop()` failure → now `exitCode = 1` on catch (both index.ts). Declined 2 NITs (regex `?`/`_` = scope creep beyond approved F5 sentinels; shutdown re-entrancy guard = YAGNI). Re-verified: both packages tsc clean.
- Review adjustment committed `50346484d`. Pushed `d93c2ce1d..50346484d` → `codex/manage-assistant-mcp-v3-ai` (clean FF, pre-push build green). PR #5109 body updated (whole-branch, added Post-review fixes section, refreshed head/counts).
- CI on new head: builds mostly green; `test-playwright` (Y-chat E2E gate — the authoritative check for slice 1) is gated behind `build-and-compile`, still pending. `GitGuardian` fails on the PRE-EXISTING June 2-secret history finding, not this batch (batch adds no secret/env/data files). Monitoring CI to terminal.
- Terminal condition: fix batch landed on PR head + PR updated + CI's test-playwright/check-types/test-graphql confirmed. React only if a job fails on this batch's code.
- CI TERMINAL on `50346484d`: **45 pass, 1 fail**. All 8 `test-playwright` shards green — shard 5 (8m50s, carries the Y-chat specs) confirms the N2 fix that could NOT be validated locally. `test-graphql` (5m41s), `check-types` (3m27s), `check-format`/`check-lint`/`check-syncpack`, `test-olat-api`, `build-and-compile`, all image builds green. Only failure: `GitGuardian` (2s scan) on the PRE-EXISTING June branch-history staging-JWT finding — batch touched 16 files (source/test/plan), zero secret/env/data files. Loop closed on every deferred check.
- DONE. Not merged (no merge authority for this batch); PR left in author's non-draft state. Residual: GitGuardian history finding (separate remediation — rotate staging JWT signing secret; tracked in memory).

## Local live verification (2026-07-20, uncommitted — evidence only)

Ran the full dev stack to verify the fixes in a browser. All fix-batch items verified live; found two dev-stack (non-fix-batch, non-production) blockers to the manage assistant answering, plus a clean end-to-end demo.

- **N2 live**: `Ask KlickerUZH Assistant` welcome renders standalone (`/manage`) and in the embedded drawer.
- **N3 live**: mcp-student returns `401` with `Authentication failed:` prefix on no-auth and bad-token.
- **F5 live (MCP layer, direct smoke as owner 8821)**: `course_list` no-query=6, `query '*'`=6, `query '.*'`=6 (wildcards → no filter → all courses); genuine `query 'Testkurs'`=3; `query 'zzz...'`=0. `element_search` `*`/`%` = all. Confirms the wildcard guard vs literal-substring bug.
- **F5+F6 live (full assistant, end-to-end)**: logged in as delegated `lecturer` (owner 8821, 6 courses). Assistant → `klicker_lecturer_course_list` with model-supplied `query:".*"` → F5 guard returned all 6 → bulleted names (Testkurs, Non-Gamified Course, Assessment Course, Gamified Assessment Course, Testkurs Calendar View, Testkurs 2), **no raw UUIDs** (F6). Path: session auth → LLM (Responses API via litellm→OpenRouter) → mcp-lecturer tool → synthesis.
- Composer-submit could not be driven via browser automation (assistant-ui controlled store ignores synthetic input); backend proven via same-origin `fetch` to `/api/manage/chat` (200, streams, tool calls). Human-browser composer expected fine; not independently proven.

### Dev-stack blockers found (NOT this fix batch; production unaffected)

1. **litellm dev model/provider breaks the manage assistant.** Committed `util/litellm/config.yaml` routes all model ids to `openrouter/openai/gpt-5.6-luna` — now rejected by OpenRouter (`400 not a valid model ID`, stealth model withdrawn). Separately, the `openrouter/` provider does not translate the OpenAI **Responses API** (leaks the `openrouter/` prefix to OpenRouter). The manage assistant uses the Responses API (`createManageAssistantModel` → default `createOpenAI()(id)`), so it errors regardless of model. Earlier PR "verification" only probed `/chat/completions` (works), which masked this. Local fix that works: `model: openai/openai/gpt-4.1` + `api_base: https://openrouter.ai/api/v1` (generic OpenAI-compatible; OpenRouter serves `/responses`). Production points at a real Responses-capable provider (litellm is dev-only) → unaffected.
2. **MCP servers not started by the dev stack + issuer mismatch.** `apps/mcp-lecturer` (7081) and `apps/mcp-student` (7080) are not in `dev:container`'s turbo filter, so the assistant's tools fail unless started manually. They must run with the workspace-namespaced `APP_ORIGIN_AUTH` (e.g. `https://auth.klicker.<workspace>.localhost`) or the chat-minted JWT is rejected `401 invalid lecturer MCP token` (issuer check). Launch: `docker exec <app> bash -lc 'cd apps/mcp-lecturer && setsid env NODE_ENV=development APP_ORIGIN_AUTH=<workspace-auth-url> pnpm exec tsx src/index.ts &'` (same for mcp-student).

Local-only runtime changes still in place for the user to click-verify: `util/litellm/config.yaml` gpt-5.5→`openai/openai/gpt-4.1` (uncommitted; revert with `git checkout -- util/litellm/config.yaml`), both MCP servers running. Open decision for the user: whether to make (1)/(2) permanent PR fixes (dev-chat wiring, author's call) — out of the merge-blocker batch scope.

## Batch 2 — Manage assistant UI fixes (2026-07-20)

User-reported, reproduced live in-browser on the running worktree stack. Same PR/branch (#5109, `codex/manage-assistant-mcp-v3-ai`).

### Bugs (three share one root cause; welcome copy is a new feature)

- Composer send button never enables when the lecturer types.
- Image upload does nothing.
- The three suggestion buttons (Draft question / Find questions / Improve feedback) do nothing.
- Missing a friendly welcome message ("hello how can I help you").

### Root cause (confirmed live)

Nothing in the manage assistant hydrates in a **devrouter linked worktree**. `packages/next-config/index.js` set `allowedDevOrigins: ['**.klicker.localhost']`. That glob matches the primary checkout host (`chat.klicker.localhost`) but NOT devrouter's workspace-namespaced host `chat.klicker.<workspace>.localhost` — devrouter inserts the workspace token between `klicker` and `localhost`, so the suffix is `.<workspace>.localhost`, not `.klicker.localhost`. Next 16 dev blocks cross-origin dev resources (`/_next/*` HMR, fonts) from non-allowed origins, so the turbopack dev runtime never finishes booting and **no React tree becomes interactive** — for every app in the worktree, not just chat. A dead React tree means the composer never enables, suggestion `autoSend` never fires, and the attachment button does nothing.

Evidence: `grep -c "Blocked cross-origin" /tmp/dev.log` was non-zero before the fix; a trivial `useState` counter page did not increment; both chat and frontend-manage were affected.

### Correction — the earlier runtime hypothesis was wrong

An earlier draft blamed `useChatRuntime` (thread-list runtime) for the disabled composer and proposed swapping it for `useAISDKRuntime`. That hypothesis was formed while hydration was globally broken, so no app was interactive and the swap looked necessary. After fixing `allowedDevOrigins`, **unmodified HEAD** (`useChatRuntime`, no dep changes) works end to end: type → send enables → `POST /api/manage/chat 200`; each suggestion → `POST 200`; image upload → attachment chip + preview → send with attachment → `POST 200`, no console errors. The runtime swap and the `@ai-sdk/react` dependency were reverted — they are not needed.

### Decisions

- Fix: `allowedDevOrigins: ['**.localhost']` (dev-only; `undefined` in production). Matches both primary and workspace-namespaced devrouter hosts. Dev-only origin allowlist widening, so low risk. This is a shared `@klicker-uzh/next-config` change that unblocks hydration for every app in a linked worktree — the direct cause of the reported manage-assistant bugs. Flagged to the user as slightly broader than PR #5109's feature scope; kept in this PR because it is the root cause of what the user saw.
- No manage-assistant code change and no new dependency for the three interaction bugs.
- Welcome message: `ThreadWelcome` in the shared `thread.tsx` renders `Ask {chatbotName}`. Add a friendly greeting; scope changes to avoid regressing the student chat.

### Slices

1. **Dev-origin hydration fix (composer + upload + suggestions).** `packages/next-config/index.js` (`allowedDevOrigins` glob). Verified live: type→send enables, suggestion→sends, image upload attaches + sends. Commit `fix(next-config): allow workspace-namespaced dev origins so worktree apps hydrate`.
2. **Welcome message.** `apps/chat/src/components/thread.tsx` `ThreadWelcome`, scoped to manage via a new optional prop. Verify live render. Commit `feat(chat): add manage assistant welcome greeting`.

### Progress

- Slice 1 done + verified (commit `f50d13579`). Real root cause = `allowedDevOrigins` not matching devrouter workspace-namespaced hosts (`{app}.klicker.<workspace>.localhost`); Next 16 dev blocked cross-origin resources → no app hydrated in the worktree. Fix applied in `packages/next-config/index.js` (`['**.klicker.localhost']` → `['**.localhost']`). Live verify on unmodified HEAD manage assistant: composer send enables on typing (`POST /api/manage/chat 200`), all three suggestions fire (`POST 200`), image upload attaches (chip+preview) and sends with the attachment (`POST 200`), no console errors. Earlier `useChatRuntime`→`useAISDKRuntime` runtime hypothesis disproven and reverted; `@ai-sdk/react` dep removed.
- Slice 2 done + verified. Added optional `welcomeMessage?: string` prop to `Thread`/`ThreadWelcome` (`apps/chat/src/components/thread.tsx`); `ThreadWelcome` renders `welcomeMessage ?? \`Ask ${chatbotName}\``. `manage-assistant.tsx` passes `MANAGE_ASSISTANT_WELCOME = 'Hello! How can I help you?'`. Student chat (`assistant.tsx`, two `<Thread>` usages) does not set the prop, so it keeps `Ask {chatbotName}` — no regression. In-container `pnpm --filter @klicker-uzh/chat check` EXIT 0. Live verify (agent-browser a11y snapshot): manage welcome now shows `Hello! How can I help you?` above the avatar + three suggestions; composer intact. Screenshot capture unavailable — CDP `Page.captureScreenshot` hangs for this Chromium session (infra, not the app); a11y snapshot + DOM text used as visual evidence instead. Next: per-slice review/simplify on both slices, then finish gates (security, thermo-nuclear), push to `HEAD:codex/manage-assistant-mcp-v3-ai`, update PR body.
