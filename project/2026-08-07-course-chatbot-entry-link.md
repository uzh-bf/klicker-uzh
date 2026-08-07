# Course Chatbot Entry Link on v3 (PWA) — Plan

- **Date:** 2026-08-07
- **Branch:** `rs/course-chatbot-link` (from `origin/v3` @ `39897712b`)
- **Status:** REVIEWED — planning-stage pass completed by agy (Antigravity CLI, trusted provider, read-only); verdict: complete & correct with 1 minor finding (PWA outer guard at `index.tsx:196`), verified and folded into step 5. Awaiting user approval of D1 before implementation.
- **Scope:** minimal v3 PR: participant-facing chatbot link on the student course overview page, without pulling in v3-ai
- **Companion (already shipped):** Option 1 — chatbot link appended to the VK1 course description in prod (verified read-back). This plan covers Option 2.

## Goal

Give Vorkurs students a discoverable entry point to the "Vorkurs Rechenfertigkeiten" chatbot directly from the course page on v3, after they have joined the course. No v3-ai merge, no embedded chat drawer — a simple link/button backed by a participant-authed GraphQL query, reusing the existing PWA deep-link route.

## Verified current state (2026-08-07)

| Item | State |
| --- | --- |
| Deep-link route | Already on v3: `apps/frontend-pwa/src/pages/course/[courseId]/chatbot/[chatbotId].tsx` — redirects to login if needed, runs `ensureParticipation` server-side, then 302 to `chat.klicker.uzh.ch/<chatbotId>` |
| Course overview page | `apps/frontend-pwa/src/pages/course/[courseId]/index.tsx` — tabs (leaderboard/info/assessment/groups), no chatbot entry today |
| GraphQL | v3 exposes `Chatbot` (lecturer view via `getChatbotsInfo`); **no** participant-facing chatbot field |
| Prisma | `Chatbot.courseId` required relation; `Course.chatbots Chatbot[]` — no schema change needed |
| v3-ai blueprint | `ChatbotPublic` type, `courseChatbots` query (`schema/query.ts:1244`), `getParticipantCourseChatbots` service, op `QGetCourseChatbots.graphql`, i18n keys `openCourseChat`/`courseChat` — cherry-pick only these pieces, never merge v3-ai |
| Chatbot (VK1) | `b39c0c2d-e66d-425f-8c2c-f231648a0fd7` "Vorkurs Rechenfertigkeiten", course `4263e80b-5fde-426b-91bb-be2b433c9ed9` |
| Origin head | `39897712b` (fetched over HTTPS; SSH agent signing broken on this host) |

## Decisions

### D1 — Entry UX: button(s) above the tabs (recommended)

Options:

1. **(a) Button(s) above the tabs** — a row of chatbot buttons rendered below the page header and above the tab list when the course has chatbots. Always visible, most discoverable for a one-week course. Minimal diff: one query + a small render block.
2. **(b) New tab "Kurs-Chatbot"** — fits the existing tab structure but hides the entry behind a click and adds tab-state handling.
3. **(c) v3-ai `CourseChatDrawer` (embedded iframe)** — explicitly out of scope per user.

**Recommendation: (a).** Each button links to `/course/<courseId>/chatbot/<chatbotId>` (existing deep-link route, handles auth + participation + redirect). With one chatbot per course (the VK1 case), this renders a single prominent button. Multiple chatbots render one button each; no dropdown logic needed.

**Ask:** OK to ship a visible button row above the tabs (opens chat in the same tab via the deep link)? Alternative is a new tab.

### D2 — Public type shape: match v3-ai `ChatbotPublic` exactly

`id`, `name`, `description` (nullable), `avatar` (nullable). The UI only needs `id` + `name` today, but matching v3-ai's public shape means a later v3-ai sync reconciles with zero diff.

### D3 — Empty/not-participating behavior

Service returns `[]` when the participant is not enrolled (mirrors v3-ai), so the button row simply does not render. The deep-link route additionally guards login/participation for direct navigation.

## Build order

1. **Service** — `packages/graphql/src/services/chatbots.ts`: `getParticipantCourseChatbots({ courseId }, ctx: ContextWithUser)` — participation lookup (`courseId_participantId`), return `[]` if absent, else `chatbot.findMany({ where: { courseId }, orderBy: [{ name: 'asc' }, { createdAt: 'asc' }], select: { id, name, description, avatar } })`.
2. **Type** — `packages/graphql/src/schema/resource.ts`: `IChatbotPublic` interface + `ChatbotPublicRef`/`ChatbotPublic` object (copy shape from v3-ai).
3. **Query field** — `packages/graphql/src/schema/query.ts`: `courseChatbots: t.withAuth(asParticipant).field({ type: [ChatbotPublic], args: { courseId: t.arg.string({ required: true }) }, resolve: one-liner → service })`. `asParticipant` is exact-role; no `withPermission` needed (participant-facing field, pattern at `query.ts:128`).
4. **Client op** — `packages/graphql/src/graphql/ops/QGetCourseChatbots.graphql` (`query GetCourseChatbots($courseId: String!) { courseChatbots(courseId: $courseId) { id name description avatar } }`), then codegen `pnpm --filter @klicker-uzh/graphql generate` and commit all regenerated artifacts (`ops.ts`, `ops.schema.json`, `public/schema.graphql`, `public/client.json`, `public/server.json` — stale `server.json` breaks persisted queries in prod).
5. **PWA course page** — `apps/frontend-pwa/src/pages/course/[courseId]/index.tsx`:
   - `useQuery(GetCourseChatbotsDocument, { variables: { courseId } })`
   - Render a button row above `<Tabs>` when `chatbots.length > 0`, each button `router.push('/course/' + courseId + '/chatbot/' + id)` (deep link; same tab).
   - **Outer guard (agy finding 1, verified):** extend the layout conditional at `index.tsx:196` — `course.isGamificationEnabled || course.isAssessmentEnabled || course.description` — with `(chatbots?.length ?? 0) > 0`, so a course that has a chatbot but none of the other three features still renders the layout (and the button) instead of the `noGamificationOrDescription` notification.
   - `data-cy="student-course-chatbot-link"` for e2e.
6. **i18n** — `packages/i18n/messages/{de,en}.ts` under existing `pwa.chatbot` block: `openCourseChat: 'KI-Tutor' / 'AI tutor'`, `courseChat: 'Kurs-Chatbot' / 'Course chatbot'` (labels from v3-ai).
7. **Wiki** — `docs/chat-platform.md` (or a short note in `docs/index.md`): participant chatbot entry on course page + deep-link route. Follow `klicker-wiki-maintenance` conventions; log entry under `docs/log/` if the change batch warrants one.
8. **Tests** — optional vitest for the service (`pnpm --filter @klicker-uzh/graphql test:local`, heavy pattern in `38c92d035`); optional Playwright spec in `playwright/tests/N-course.spec.ts` asserting the button renders for an enrolled participant. Decide during implementation based on existing coverage.

## Verification

- `pnpm --filter @klicker-uzh/graphql generate` then `pnpm run check`, `pnpm run lint`, `pnpm run format` (repo-native checks, run inside devcontainer per repo rules if available).
- **Browser (mandatory for UI):** `agent-browser` against local stack (`https://pwa.klicker.localhost`), delegated login as an enrolled participant in a course with a chatbot; assert button visible, click → deep link → chat page. Also check the not-participating case renders no button.
- Read back `chat.klicker.uzh.ch/<chatbotId>` reachability via the deep link with a real token if a live environment is available (else local).

## Review gates (full path)

1. **Planning-stage pass** — kimi-k3 via `opencode` (`opencode-go/kimi-k3`, user-approved route) reviews this draft read-only against the live repo; main session verifies and incorporates findings before presenting the plan.
2. **Final review** — after integration + verification, one read-only review of the exact committed diff before the PR is published.
3. PR stays **draft** until the user approves readiness.

## Out of scope

- v3-ai merge or cherry-pick beyond the five pieces listed above (drawer, chat context, chatbot index page, model wiring).
- Any change to `apps/chat`, credits, prompts, or the disclaimer.
- Option 1 follow-up (course-description link) is already shipped; only user verification of the rendered link remains.

## Risks / notes

- SSH agent signing fails on this host (`sign_and_send_pubkey: signing failed`); pushes may need the HTTPS remote (`gh` token available) — confirm before push.
- The main checkout has an unrelated dirty file (`deploy/env-uzh-stg/values.yaml`) — untouched, stays in the main checkout.
- `trees/` is gitignored; worktree lives at `trees/course-chatbot-link`.
