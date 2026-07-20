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
- Next: commit slice 1, then slice 2 (F5).
