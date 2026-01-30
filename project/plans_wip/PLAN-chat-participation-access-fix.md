# Chat app: participation + access-control fixes (course membership ≠ leaderboard)

## Goal

Ensure chat access is gated by **course membership** (Participation record existence) and not by leaderboard opt-in, while also fixing inconsistent/unsafe access control across chat API routes.

## Current state (code)

### Membership check pattern
- `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
- `apps/chat/src/app/api/chatbots/[chatbotId]/threads/route.ts`

Both:
- verify `participant_token` (JWT via `jose.jwtVerify(APP_SECRET)`)
- check `Participation.findUnique({ where: { courseId_participantId: { courseId, participantId }}})`
- deny with 403 if missing

Important: `Participation.isActive` is **not checked** (good).

### Inconsistencies / issues

1. **Sensitive data leak**
   - `apps/chat/src/app/api/chatbots/[chatbotId]/route.ts` returns `prisma.chatbot.findUnique(...)` via `ChatbotsService.getChatbotById` with **no auth** and **no field projection**.
   - `Chatbot` includes `azureOpenAIKey` (encrypted but still sensitive), `ownerId`, etc.

2. **No membership checks on some endpoints**
   - `/api/chatbots/[chatbotId]/credits` validates token but does not check course participation.
   - `/api/chatbots/[chatbotId]/disclaimer` validates token but does not check course participation.

3. **Order-of-operations**
   - In chat + threads routes, participation is checked by first querying `Chatbot` for `courseId`.
   - If chatbot doesn’t exist, `courseId` becomes `''` and the user gets a misleading 403.

4. **Auth duplication**
   - JWT verification is repeated in each route.

### Course membership vs leaderboard
- `packages/prisma/src/prisma/schema/participant.prisma`: `Participation.isActive` is about leaderboard visibility.
- Some GraphQL paths set `isActive=true` only when joining leaderboard (intended).
- Chat must only require existence of `Participation`, not `isActive`.

## Proposed solution

### 1) Centralize auth + membership checks

Create shared helpers in `apps/chat`, e.g.:

- `src/lib/auth/requireParticipant.ts`
  - verify token and return `{ participantId, authMode }`
  - support both `participant_token` and `chat_participant_token` (see semi-anonymous plan)

- `src/lib/auth/requireChatbotAndCourseMembership.ts`
  - fetch chatbot `{ id, courseId, ...safeFields }`
  - if chatbot missing → return 404
  - check `Participation` existence for `(courseId, participantId)`
  - if missing → return 403 with consistent error shape

### 2) Enforce on all chatbot API routes

Apply the shared checks to:
- `/api/chatbots/[chatbotId]` (model/mode metadata)
- `/api/chatbots/[chatbotId]/credits`
- `/api/chatbots/[chatbotId]/disclaimer`
- `/api/chatbots/[chatbotId]/threads/*`
- `/api/chatbots/[chatbotId]/chat`

### 3) Return only safe chatbot fields

Replace `ChatbotsService.getChatbotById()` response with a safe projection:

- `id`, `name`, `description`, `avatar`
- `modelSelection`
- `systemPrompts` (if needed for mode labels/descriptions)
- disclaimer metadata (if needed)

Explicitly exclude:
- `azureOpenAIKey`
- `azureOpenAIEndpoint`
- any owner identifiers

### 4) Ensure “membership ≠ leaderboard” stays true

- Do **not** add `isActive` checks in chat.
- Do **not** change GraphQL leaderboard logic.
- If there are real-world cases where course members lack a `Participation` row, fix by ensuring participation is created on join/invite flows (separately), but keep chat checks on “Participation exists”.

## Implementation steps

1. Add auth/membership helper(s) in `apps/chat/src/lib/auth/`.
2. Update all chat API routes under `apps/chat/src/app/api/chatbots/[chatbotId]/` to use them.
3. Update `/api/chatbots/[chatbotId]` to return a safe DTO only.
4. Fix ordering so chatbot-not-found returns 404 (not 403).
5. Add lightweight tests:
   - helper unit tests (token + membership)
   - route-level tests if present in repo; otherwise add minimal integration coverage where feasible.

## Testing strategy

### Manual
- Participant not in course → 403 on all chatbot endpoints.
- Participant in course → 200 for metadata/credits/disclaimer/threads/chat.
- Invalid chatbotId → 404 (not participation error).

### Security regression
- Verify `/api/chatbots/[chatbotId]` never returns encrypted Azure key.

## Rollout

- Ship as a single change-set (low UX impact, high security impact).
- Monitor 401/403 rates after release.

## Open questions

1. Should `/[chatbotId]/page.tsx` also enforce membership server-side (instead of relying on API errors)?
2. Standardize API error codes (e.g. `code: 'NOT_A_COURSE_MEMBER'`) for UI-friendly handling?
