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
- Next: commit review adjustment, push HEAD to `codex/manage-assistant-mcp-v3-ai` (non-force FF), update PR #5109 body, watch CI (esp. test-playwright Y-chat + mcp image builds).
