# PR 5109 PWA Embedded Chat Remainder Plan

## Goal

- Surface course chatbots in more student PWA surfaces.
- Support normal PWA and LMS/OLAT embedded PWA mode.
- Keep context answer-safe and course-scoped.
- Keep current practice quiz chatbot behavior working.
- Validate locally end to end before review.

## Non-Goals

- No live quiz chatbot in this slice.
- No group activity chatbot in this slice.
- No autonomous student answer submission beyond existing student MCP practice-card flow.
- No broad rewrite of assistant-ui thread/runtime.
- No new external dependency.

## Identity

- Plan path: `project/2026-06-07-pr-5109-pwa-embedded-chat-remainder-plan.md`
- Branch: `codex/manage-assistant-mcp-v3-ai`
- Target: `v3-ai`
- PR: #5109, `https://github.com/uzh-bf/klicker-uzh/pull/5109`
- Related old plan: `project/plans_wip/PLAN-chat-pwa-integration.md`

## Current State

- `CourseChatDrawer` exists and is mounted only on practice quiz detail.
- Chat context schema already supports `course-home`, `practice-quiz`, `live-quiz`, `microlearning`.
- Chat route already sanitizes page context and drops context if `courseId` mismatches chatbot course.
- Chat app embedded mode and assistant-ui runtime already work.
- PWA embedded activity pages already use parent-origin `postMessage` patterns.
- PWA has participant-token fallback for cookie-blocked LMS iframes.
- Chat has chat-guest fallback, but not account-mode PWA-to-chat embed handoff.

## Grill Findings

- Scope: course home, practice quiz, microlearning.
- Exclude: live quiz, temporary live quiz users, group activity.
- Embedded LMS mode: include.
- Embedded UX: open inside embedded PWA iframe by default.
- Fallback: open assistant in new tab.
- Auth: no raw `participant_token` in chat iframe URL.
- Threads: keep normal chat history; send fresh page context on every message.

## Research Notes

- assistant-ui docs: current `AssistantRuntimeProvider` + `useChatRuntime` + AI SDK transport pattern is correct. PWA work should focus on embedding, auth handoff, context, and layout.
- Local code: `CourseChatDrawer` already handles chatbot discovery, selected chatbot, avatar, context postMessage, ack retry, and new-tab link.
- Local code: practice quiz page has page-local preview cleanup; duplicate use on microlearning should be extracted.
- Local code: chat `apiGuards.ts` only supports account auth via `participant_token` cookie and guest auth via `chat_participant_token` cookie/header. Account-mode header fallback is intentionally absent today.
- Local code: nested iframe risk is mostly CSP and cookie behavior, not React UI.

## Security Decisions

- Add scoped embed auth, not raw token sharing.
- Proposed flow:
  1. PWA server mints short-lived exchange token after existing participant/course checks.
  2. Token claims: `participantId`, `courseId`, `chatbotId`, `purpose: pwa-chat-embed`, `exp`.
  3. Chat iframe opens with exchange token.
  4. Chat verifies token, mints chat-owned scoped embed session token.
  5. Chat stores embed session in host-only cookie when possible and sessionStorage/header fallback when cookies fail.
  6. Chat API guard accepts only scoped embed session for matching chatbot/course.
- Token logging: avoid raw token logs; strip URL query after bootstrap.
- Context: no solutions, no explanations, no submitted answers, no group data.
- CSP: confirm chat can be framed by PWA and by the full LMS ancestor chain where required.

## Progress

- 2026-06-07: Plan created. Scope/grill decisions locked. No implementation yet.
- 2026-06-07: Slice 1 in progress. Extracting answer-safe PWA chat context helpers and keeping practice quiz behavior unchanged.
- 2026-06-07: Slice 1 review/simplify done. Extracted pure client-safe helpers; tightened empty-string handling to match previous context serialization. Verification: `git diff --check` pass; changed-file Prettier pass. `pnpm --filter @klicker-uzh/frontend-pwa check` blocked by pnpm launcher `fetch failed` before package script execution, even with escalation and package-manager-version config attempts.
- 2026-06-07: Slice 2 in progress. Adding PWA exchange token, chat-owned scoped embed session, middleware/API guard matching, and sessionStorage fallback.
- 2026-06-07: Slice 2 review/simplify done. PWA embedded chatbot redirect now mints a short-lived exchange token after participation checks; chat bootstrap verifies it, sets a host-only scoped session, and supports `_pe` sessionStorage fallback for blocked cookies. API guards reject scoped sessions for the wrong chatbot/course. Verification: `git diff --check` pass; changed-file Prettier pass; direct util Vitest `packages/util/test/clientAuth.test.ts` pass, 7/7. `pnpm --filter @klicker-uzh/chat test:run` and `pnpm --filter @klicker-uzh/frontend-pwa check` still blocked by pnpm launcher `fetch failed` before script execution. Temporary direct chat Vitest config starts but cannot resolve symlinked app deps (`zod`, `next/navigation`) in this worktree.
- 2026-06-07: Slice 3 in progress. Adding embedded-aware `CourseChatDrawer` layout and mounting it in embedded practice quizzes while keeping normal PWA behavior unchanged.
- 2026-06-07: Slice 3 review/simplify done. Normal drawer styling remains unchanged; embedded drawer uses a compact bottom sheet without fixed minimum heights that could overflow short LMS iframes. Practice quizzes now render the drawer for both normal and embedded modes; footer remains normal-mode only. Verification: `git diff --check` pass; changed-file Prettier pass. Browser verification blocked because local `https://pwa.klicker.com` and `https://chat.klicker.com` are not running; `pnpm --filter @klicker-uzh/frontend-pwa check` still blocked by pnpm launcher `fetch failed`.
- 2026-06-07: Slice 4 in progress. Mounting course-home chat drawer on the course overview for normal and embedded PWA modes.
- 2026-06-07: Slice 4 review/simplify done. Course overview parses `embed`, passes it to `Layout`, builds `surface: course-home` context, and mounts `CourseChatDrawer` gated by `participantToken`; no-chatbot behavior stays silent. Verification: `git diff --check` pass; changed-file Prettier pass. Browser check blocked because local PWA server is not reachable (`curl https://pwa.klicker.com/de/course/1?test=true` connection refused).
- 2026-06-07: Slice 5 in progress. Mounting microlearning intro/question/evaluation chat with activity and question context, preserving embedded navigation.
- 2026-06-07: Slice 5 review/simplify done. Microlearning intro now uses SSR `embed`/participant token handling, preserves `embed=true` on start, and mounts activity-only chat. Question page derives embedded mode from the URL, passes it to `Layout` and `ElementStack`, preserves embedded navigation, and sends current stack preview context. Evaluation mounts activity-only chat when participant and participation context are available. Verification: `git diff --check` pass; changed-file Prettier pass. Browser check blocked because local PWA server is not reachable (`curl https://pwa.klicker.com/de/course/1/microLearnings/1/0?test=true` connection refused).
- 2026-06-07: Slice 6 in progress. Local stack started for PWA/chat/backend through Traefik. Validation found and fixed: chat iframe redirect did not complete after setting the chat-owned embed cookie, embedded chat had a duplicate internal header, activity-level contexts showed question suggestions, local Traefik CSP blocked sibling `*.klicker.com` framing, enrolled leaderboard-opt-out participants could not see course chatbots, and mobile embedded chat could be overlapped by the sticky quiz submit button.
- 2026-06-07: Slice 6 review/simplify done. Kept fixes narrow: HTML bootstrap response after scoped cookie set, embedded header removed from chat iframe, question suggestions tied to `context.question`, participation existence used for chatbot access, local CSP aligned with sibling-app framing, drawer raised above sticky controls and made full-width only on narrow embedded viewports, and leaking `URL` test global cleanup added. Browser evidence captured in `/private/tmp/klicker-pr5109-screens/`: normal course home `48-course-home-normal-open.png`, embedded course home `38-course-home-embedded-open.png`, normal practice question `34-practice-question-open.png`, embedded practice `36-practice-embedded-open.png`, normal microlearning intro/question `41-microlearning-intro-open.png` / `43-microlearning-question-open.png`, embedded microlearning question `45-microlearning-question-embedded-open.png`, mobile embedded fixed state `52-mobile-microlearning-embedded-open-fullwidth.png`, fallback standalone chat `46-fallback-link-after-click.png`. Verification: `git diff --check` pass; changed-file Prettier pass; explicit pnpm entrypoint `frontend-pwa check` pass; `chat check` pass; `chat test:run` pass (23 files, 105 tests); focused GraphQL `vitest run test/courseChatbots.test.ts` pass (2 tests). Local validation-only DB changes: practice quiz and microlearning rows set to `PUBLISHED`; no model-send check because local provider credentials were not exercised.
- 2026-06-07: Slice 7 in progress. Final branch review and security review done before PR refresh. Security focus: scoped PWA embed token handoff, chat API guard scoping, frame ancestors, and answer-safe context. No high-confidence vulnerability found. Residual manual checks: real LMS ancestor-chain behavior, third-party-cookie/browser behavior, and actual model-send prompt behavior in staging. PR body refreshed in `/private/tmp/pr5109-body.md` against `origin/v3-ai..HEAD`: 58 commits, 149 files changed, 12242 insertions, 350 deletions. Next: commit plan update, push, update PR #5109, check CI status.

## Slices

### Slice 1: Shared PWA Chat Context Helpers

Do:
- Add small helper module for answer-safe chat context construction.
- Move practice quiz content preview cleanup out of the page.
- Add helpers for:
  - course home context
  - activity context
  - stack/question preview context
- Keep preview cap at 500 chars.

Likely files:
- `apps/frontend-pwa/src/lib/chatbot/chatContext.ts`
- `apps/frontend-pwa/src/pages/course/[courseId]/practiceQuizzes/[id].tsx`

Check:
- `pnpm --filter @klicker-uzh/frontend-pwa check`
- Focused unit checks only if a local PWA test harness is added; otherwise typecheck plus browser.

Commit:
- `refactor(pwa): share course chatbot context helpers`

### Slice 2: Scoped Embedded Chat Auth Handoff

Do:
- Add PWA server-side embed exchange token minting for course chatbot iframe URLs.
- Add chat-side verification and scoped embed session bootstrap.
- Extend chat auth guards to accept scoped embed session only for matching chatbot/course.
- Add client bootstrap to store fallback token and strip URL query.
- Keep normal cookie path unchanged.

Likely files:
- `apps/frontend-pwa/src/components/chatbot/CourseChatDrawer.tsx`
- `apps/frontend-pwa/src/lib/chatbot/*`
- `apps/chat/src/lib/server/apiGuards.ts`
- `apps/chat/src/lib/server/*`
- `apps/chat/src/hooks/*`
- `apps/chat/src/lib/client/authedFetch.ts`
- `apps/chat/src/middleware.ts`
- `apps/chat/test/*`
- `turbo.json` if new env var is introduced.

Check:
- `pnpm --filter @klicker-uzh/chat test:run`
- `pnpm --filter @klicker-uzh/chat check`
- `pnpm --filter @klicker-uzh/frontend-pwa check`

Commit:
- `feat(chat): add scoped pwa embed auth`

### Slice 3: Embedded-Aware Drawer Layout

Do:
- Make `CourseChatDrawer` render in normal and embedded PWA pages.
- Normal PWA: keep current bottom-right bubble/drawer.
- Embedded PWA: use compact bottom sheet inside iframe; avoid wide side panel.
- Preserve avatar, title, current context chip, close button, and new-tab fallback.
- Ensure mobile menu and embedded content are not covered incoherently.

Likely files:
- `apps/frontend-pwa/src/components/chatbot/CourseChatDrawer.tsx`
- `packages/i18n/messages/en.ts`
- `packages/i18n/messages/de.ts`

Check:
- `pnpm --filter @klicker-uzh/frontend-pwa check`
- Browser screenshots normal and embedded practice quiz.

Commit:
- `feat(pwa): support embedded course chat drawer`

### Slice 4: Course Home Mount

Do:
- Mount drawer on course overview.
- Context: `surface: course-home`, course id, locale.
- Show only when participant token is present and course has at least one chatbot.
- Keep no-chatbot behavior silent on page; direct chatbot route still shows message.

Likely files:
- `apps/frontend-pwa/src/pages/course/[courseId]/index.tsx`
- `apps/frontend-pwa/src/lib/chatbot/chatContext.ts`

Check:
- `pnpm --filter @klicker-uzh/frontend-pwa check`
- Browser screenshot normal course home.
- Browser screenshot embedded course home in harness.

Commit:
- `feat(pwa): surface course chatbot on course home`

### Slice 5: Microlearning Mount

Do:
- Mount drawer on microlearning intro page.
- Mount drawer on microlearning question page.
- Mount drawer on microlearning evaluation page if participant/course context is available.
- Context:
  - intro/evaluation: activity only.
  - question: current stack/question preview, step, total steps.
- Do not include solutions/explanations/submitted answers.

Likely files:
- `apps/frontend-pwa/src/pages/course/[courseId]/microLearnings/[id]/index.tsx`
- `apps/frontend-pwa/src/pages/course/[courseId]/microLearnings/[id]/[ix].tsx`
- `apps/frontend-pwa/src/pages/course/[courseId]/microLearnings/[id]/evaluation.tsx`
- `apps/frontend-pwa/src/lib/chatbot/chatContext.ts`

Check:
- `pnpm --filter @klicker-uzh/frontend-pwa check`
- Browser screenshots normal + embedded microlearning question.

Commit:
- `feat(pwa): surface course chatbot in microlearning`

### Slice 6: End-to-End Browser Validation

Do:
- Run local app stack needed for PWA/chat.
- Verify:
  - normal course home drawer
  - embedded course home drawer
  - normal practice quiz drawer
  - embedded practice quiz drawer
  - normal microlearning drawer
  - embedded microlearning drawer
  - chat sends current page context after route/question changes
  - fallback new-tab link works
- Capture desktop/mobile-ish screenshots.
- Add screenshots to PR description/comment if UI changed.

Check:
- `agent-browser` screenshots.
- Cypress smoke where feasible:
  - focused practice quiz path
  - focused microlearning path
  - no live quiz chatbot assertions.

Commit:
- Usually no code commit unless screenshots/docs/PR body change.

### Slice 7: Final Review And PR Refresh

Do:
- Run review pass for correctness and regressions.
- Run simplification pass.
- Run security review focused on scoped token handoff, iframe ancestors, and context leakage.
- Refresh PR description using whole branch diff and new screenshots.

Check:
- `pnpm --filter @klicker-uzh/frontend-pwa check`
- `pnpm --filter @klicker-uzh/chat check`
- `pnpm --filter @klicker-uzh/chat test:run`
- Relevant Cypress smoke or full CI depending risk.
- `gh pr checks 5109 -R uzh-bf/klicker-uzh`

Commit:
- `docs(pr): refresh pwa embedded chat plan` only if docs/PR evidence changes.

## Open Risks

- Nested iframe CSP may require deployment config changes beyond app code.
- LMS third-party cookie behavior varies by browser; sessionStorage fallback must be validated.
- Short-lived exchange token alone is not enough for long chat sessions; chat-owned embed session token is needed.
- Course home and microlearning pages may lack `participantToken` props in some redirect paths; verify before mounting.
- Evaluation page may have weaker course context; avoid mounting there if course id cannot be proven.

## Goal Prompt

Work in `/private/tmp/klicker-pr5109-simplify` on branch `codex/manage-assistant-mcp-v3-ai` for PR #5109 against `v3-ai`. Use `project/2026-06-07-pr-5109-pwa-embedded-chat-remainder-plan.md` as current plan. Implement one slice at a time. Before each slice, update `Progress`. After each slice, verify, run review and simplification passes, integrate accepted findings, update `Progress`, then commit only that slice. Preserve current practice quiz chatbot behavior. Exclude live quiz and group activity. For embedded LMS mode, use scoped chat embed token handoff; never pass raw `participant_token` to chat. Finish with security review, browser screenshots for normal and embedded PWA, PR description refresh, and `gh pr checks`.
