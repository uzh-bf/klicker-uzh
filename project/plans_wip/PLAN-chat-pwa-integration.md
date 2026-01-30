# PWA ↔ Chat integration improvements (deep link + embedded side panel)

## Goal

Make the course chatbot easy to access from the Student PWA:

1. “Jump to chatbot” from course pages.
2. Optional **side panel chat** during practice quizzes (embedded mode).
3. Avoid brittle coupling (PWA shouldn’t need hardcoded chatbot IDs if possible).

## Current state (code)

### Existing PWA → Chat redirect
- `apps/frontend-pwa/src/pages/course/[courseId]/chatbot/[chatbotId].tsx`
  - Ensures participant token via `getParticipantToken()`.
  - Calls GraphQL `ensureParticipation(courseId)`.
  - Redirects to `NEXT_PUBLIC_CHAT_URL/<chatbotId>`.

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
  - Redirects to `/[chatbotId]`.

Then in PWA:

- Add a new page: `apps/frontend-pwa/src/pages/course/[courseId]/chatbot/index.tsx`
  - Ensures token + `ensureParticipation(courseId)`.
  - Redirects to `${NEXT_PUBLIC_CHAT_URL}/course/<courseId>`.

This allows “Jump to chatbot” without exposing chatbot IDs to the PWA.

### Phase 2 (better UX): chatbot discovery via GraphQL

Expose chatbots to participants:

- Add a minimal `ChatbotPublic` GraphQL type (id, name, description, avatar, courseId).
- Add query:
  - `courseChatbots(courseId: ID!): [ChatbotPublic!]!`
  - or add `Course.chatbots` for participants.

Use it to:
- Show a chatbot picker if multiple exist.
- Enable deep-linking via existing `/course/[courseId]/chatbot/[chatbotId]` page.

### Embedded side panel during practice quizzes

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
    - `src = ${NEXT_PUBLIC_CHAT_URL}/course/<courseId>?embed=1`
    - or `.../<chatbotId>?embed=1` (Phase 2)

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

## Rollout

- Start with Phase 1 (no GraphQL schema changes required).
- Add Phase 2 once chatbot discovery is needed.

## Open questions

1. What is the “default chatbot” selection rule if multiple exist?
2. Do we want chat embedded in other PWA views (microlearning, practice overview)?
