# PWA ↔ Chat integration improvements (deep link + embedded side panel)

## Goal

Make the course chatbot easy to access from the Student PWA:

1. “Jump to chatbot” from course pages.
2. Optional **side panel chat** on course pages (embedded mode, minimal UI).
3. Avoid brittle coupling (PWA shouldn’t need hardcoded chatbot IDs if possible).

## Progress (feat/chat-gpt-5-1)

**Done on this branch**
- Chat now supports URL-addressable threads (`/<chatbotId>/threads/<threadId>`) while keeping the assistant runtime mounted via layout nesting.
- Manage UI links to chatbots via the existing PWA redirect route (courseId + chatbotId), ensuring participant auth.
- OLAT API now exposes course chatbots for course managers (individual chatbots; no overview entry).
- Fixed PWA login crash caused by dual Formik bundles by adding `formik` to `transpilePackages` (PWA/Manage/Control).
- `ensureParticipation(courseId)` is now check-only (no implicit Participation creation); LTI still creates Participation during token acquisition.

**Remaining**
- Phase 1: implement chat `/course/<courseId>` entry route and PWA `/course/<courseId>/chatbot` redirect.
- Because courses can have multiple chatbots and chatbots can be attached to multiple courses, define a stable “default chatbot per course” rule (ideally stored on the course↔chatbot link, e.g. `CourseChatbot.isDefault`).
- Phase 2 (optional): participant-facing chatbot discovery/picker for a course based on course↔chatbot links.
- Add PWA sidebar chat (course pages): chatbot picker, `?embed=1` minimal UI, and always start a new thread on open.
- Add `?embed=1` mode + CSP `frame-ancestors` to support an iframe side panel in the PWA.
- Update OLAT/PWA/chat implementations to stop relying on `chatbot.courseId` once the link table exists.

## Current state (code)

### Existing PWA → Chat redirect
- `apps/frontend-pwa/src/pages/course/[courseId]/chatbot/[chatbotId].tsx`
  - Ensures participant token via `getParticipantToken()`.
  - Calls GraphQL `ensureParticipation(courseId)`.
  - Redirects to `NEXT_PUBLIC_CHAT_URL/<chatbotId>` (will change once course-scoped chat routes are in place).

### No course→chatbot discovery
- PWA has no way to list/select chatbots for a course.
- `packages/graphql/src/schema/*` currently does not expose `Chatbot` for participants.

### Embedded mode exists elsewhere
- Practice quizzes support `?embed=1` (`apps/frontend-pwa/src/pages/course/[courseId]/practiceQuizzes/[id].tsx`).
- Chat app currently has no embed mode and no explicit iframe policy.

## Proposed approach

### Phase 1 (minimal coupling): course-level entry URL

Add a chat entry route that resolves course → default chatbot:

- Add a new chat page route: `apps/chat/src/app/course/[courseId]/page.tsx`
  - Looks up a default chatbot for the course (e.g. first by `createdAt` or by a future `isDefault` flag).
  - Redirects to `/course/<courseId>/chatbot/<chatbotId>`.

Then in PWA:

- Add a new page: `apps/frontend-pwa/src/pages/course/[courseId]/chatbot/index.tsx`
  - Ensures token + `ensureParticipation(courseId)`.
  - Redirects to `${NEXT_PUBLIC_CHAT_URL}/course/<courseId>` (which then resolves to `/course/<courseId>/chatbot/<chatbotId>`).

This allows “Jump to chatbot” without exposing chatbot IDs to the PWA.

### Phase 2 (better UX): chatbot discovery via GraphQL

Expose chatbots to participants:

- Add a minimal `ChatbotPublic` GraphQL type (id, name, description, avatar). The course context is implicit in the query.
- Add query:
  - `courseChatbots(courseId: ID!): [ChatbotPublic!]!`
  - or add `Course.chatbots` for participants.

Use it to:
- Show a chatbot picker if multiple exist.
- Enable deep-linking via existing `/course/[courseId]/chatbot/[chatbotId]` page.

### Embedded side panel during practice quizzes

Practice quizzes can reuse the same embed-mode chat UI described below.

### Sidebar chat on course pages (minimal UI, no history)

Target scope: Student PWA course pages (initially), with a simplified UI and **no chat history**.

#### Variant A (recommended): iframe embed
- PWA renders a sidebar/drawer containing an iframe to `chat.klicker.com`.
- Chat app supports `?embed=1` (hide thread list/chrome) and `?newThread=1` (always create a fresh thread on open).
- PWA shows a **chatbot picker** (course-scoped) before opening the sidebar.

#### Variant B: native sidebar (no iframe)
- PWA renders a minimal chat UI directly, calling chat APIs.
- Higher effort (auth, streaming, threads) but more control.

Required support (regardless of variant):
- `courseChatbots(courseId)` participant-safe query for the picker.
- Embed-safe CSP (`frame-ancestors` allow `https://pwa.klicker.com`).
- New-thread-on-open semantics for the “no history” UX.

#### Chat app: embed mode
- Add `?embed=1` support in chat UI:
  - Hide navigation chrome not needed in iframe (e.g. thread list, settings panel header).
  - Use full-height layout, no outer margins.
- Add postMessage hooks (optional):
  - allow PWA to request “open/close” or “scroll to bottom”.

#### PWA: side panel UI

Add an optional drawer/side panel on practice quiz pages:

- `apps/frontend-pwa/src/pages/course/[courseId]/practiceQuizzes/[id].tsx`
  - Add a “Chat” toggle button.
  - When open, render an iframe:
    - `src = ${NEXT_PUBLIC_CHAT_URL}/course/<courseId>/chatbot/<chatbotId>?embed=1`
    - or `.../course/<courseId>?embed=1` (Phase 1 default chatbot redirect)

Ensure:
- iframe is only used when user is authenticated and has course access.
- Provide fallback: open chat in new tab if iframe blocked.

### Iframe/security headers

Verify and explicitly allow PWA to embed chat:

- Add a CSP header in chat app (via `next.config.ts` `headers()`):
  - `Content-Security-Policy: frame-ancestors 'self' https://pwa.klicker.com` (and dev equivalents)
- Avoid `X-Frame-Options: SAMEORIGIN` (or remove it if set elsewhere).

## Implementation steps

1. Phase 1: Add chat course entry route `/course/[courseId]` and PWA route `/course/[courseId]/chatbot`.
2. Add PWA entry points:
   - Course home page button (`apps/frontend-pwa/src/pages/course/[courseId]/index.tsx`).
   - Practice quiz page chat toggle with iframe.
3. Add chat `?embed=1` mode.
4. Add/verify chat iframe headers (CSP frame-ancestors).
5. Phase 2 (optional): Add GraphQL exposure for chatbots + UI selection.

## Testing strategy

### Manual (recommended with `agent-browser`)
- Open course page → click “AI Tutor” → chat opens with correct course chatbot.
- Practice quiz → open side panel → chat loads in iframe, cookies work.
- Ensure 403/401 are handled gracefully (show fallback message or open new tab).

### Regression
- Existing `/course/[courseId]/chatbot/[chatbotId]` redirect still works.
- Reference: `PLAN-course-chatbot-nn-alignment.md` (course-scoped routing + link table).

## Rollout

- Start with Phase 1 (no GraphQL schema changes required).
- Add Phase 2 once chatbot discovery is needed.

## Open questions

1. What is the “default chatbot” selection rule if multiple exist?
2. Do we want chat embedded in other PWA views (microlearning, practice overview)?
