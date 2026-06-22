# Chat app: semi-anonymous LTI mode (dual persona)

## Overview

Enable **LTI-verified users** (e.g., from OLAT) to use the tutor chatbot **without creating a Klicker participant account**, while also allowing **existing account users** to intentionally chat in a separate **anonymous persona**.

Key constraint: **never merge anonymous chats into the real account**, to avoid retroactive de-anonymization.

## Progress (feat/chat-gpt-5-1)

**Done on this branch**
- No semi-anonymous implementation yet; prerequisites like URL-based thread routing and server-side metadata persistence are now in place.
- Verified LTI token acquisition upserts Participation before chat redirect (so check-only `ensureParticipation` does not block LTI entry).

**Remaining**
- Implement `chat_participant_token` + deterministic guest persona creation/lookup.
- Ensure guest enrollment/participation uses the specific course context from LTI (not `chatbot.courseId`) under course↔chatbot many-to-many.
- Enforce anonymous-mode model restrictions (server + UI).

## Goals

1. Users can enter chat via LTI even if no participant account exists.
2. Users can choose between:
   - **Account mode** (normal `participant_token` identity)
   - **Anonymous mode** (separate persona; chats remain anonymous)
3. Anonymous mode is visibly indicated in UI.
4. Anonymous mode is restricted to **cheapest unlimited models**.
5. Anonymous auth must be **chat-only** (must not grant access to PWA/GraphQL).

Entry/redirects should use course-scoped chat routes (courseId is available via LTI):
- `/course/<courseId>/chatbot/<chatbotId>`
- membership checks use explicit courseId, avoiding reliance on `chatbot.courseId`.

## Current state (relevant code)

### LTI token issuance
- `apps/lti/src/index.ts`
  - On LTI 1.3 connect, sets `lti-token` cookie (JWT signed with `APP_SECRET`, `expiresIn: 5m`, `scope: 'LTI1.3'`).
  - Redirects to `redirectTo` with `?jwt=<token>`.

### LTI → participant login
- `apps/frontend-pwa/src/lib/getParticipantToken.ts`
  - Exchanges `lti-token`/`jwt` for `participant_token` via GraphQL `loginParticipantWithLti`.
- `packages/graphql/src/services/accounts.ts::loginParticipantWithLti`
  - Requires an existing `ParticipantAccount` with `ssoId = ltiSub` (or existing SSO participant by email).
  - If no account exists, returns `null` (PWA then redirects to create-account flow).

### Chat authentication
- `apps/chat/src/middleware.ts`
  - Protects non-`/api` pages by requiring a valid `participant_token` cookie.
- Chat API routes (e.g. `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`)
  - Validate `participant_token` via `jose.jwtVerify(APP_SECRET)`.
  - Use `payload.sub` as `participantId`.

### Participation model
- `packages/prisma/src/prisma/schema/participant.prisma`
  - `Participation` exists per course+participant and is used as the membership record.
  - `Participation.isActive` is for leaderboard/visibility; **course membership must not depend on it**.

## Proposed design: dual persona (account + anonymous)

### 1) Anonymous persona identity

We represent anonymous users as a normal `Participant` row (reusing existing schema for threads, credits, disclaimers), but with **no user-facing account**.

We create/lookup a deterministic **guest SSO ID** derived from the LTI identity and course:

```
guestSsoId = "chat-guest:" + base64url(HMAC(CHAT_GUEST_SEED, ltiSub + ":" + courseId))
```

Properties:
- Deterministic: same LTI user + same course → same anonymous persona (so they can revisit prior chats).
- Course-scoped: anonymity does not leak across courses.
- Non-reversible: stored value is not the raw LTI `sub`.

Storage:
- `ParticipantAccount.ssoId = guestSsoId`
- `ParticipantAccount.ssoType = ltiScope` (`LTI1.1` / `LTI1.3`)
- `ParticipantAccount.type = 'lti_guest'` (new value; existing code already treats `type` as string)
- `Participant.email = null` (avoid storing personal data for anonymous persona)
- `Participant.username = random` (generated; not user-facing)
- `Participant.password = random` (not user-facing)

### 2) Chat-only token (critical security requirement)

To ensure anonymous mode does not grant access to GraphQL/PWA:

- Introduce **a new cookie**: `chat_participant_token`.
- Sign it with a **different secret**, e.g. `APP_CHAT_GUEST_SECRET`.
- Include a claim to mark it as chat-guest, e.g. `scope: 'CHAT_GUEST'`.

Chat app will accept:
- **Account mode**: `participant_token` (signed with `APP_SECRET`) and treated as normal participant.
- **Anonymous mode**: `chat_participant_token` (signed with `APP_CHAT_GUEST_SECRET`).

Other apps (backend GraphQL) will ignore `chat_participant_token` because they only read `participant_token`/`temporary_participant_token` (see `apps/backend-docker/src/app.ts`).

Cookie scoping:
- Prefer **host-only** cookie for `chat.klicker.com` (do not set `domain`), so it never leaves the chat subdomain.
- `SameSite=Lax` should work for `*.klicker.com` embedding and navigation (same-site).

### 3) Persona selection UX

Entry points:
- From LMS (LTI): user lands on chat with `?jwt=...`.
- From PWA: user usually already has `participant_token`; chat loads in account mode.

Behavior:
- If a valid `participant_token` exists and the user arrives without `jwt`, default to **Account mode**.
- If a valid LTI `jwt` is present:
  - If an account exists for `ltiSub` (real `ParticipantAccount`), show a choice:
    - **Continue with account**
    - **Continue anonymous**
  - If no account exists, automatically use **Anonymous mode** (and show messaging that an account can be created later).

In-chat UI:
- Show a persistent badge in the header/sidebar:
  - “Logged in” OR “Anonymous (LTI verified)” (with tooltip).
- Allow switching:
  - Switching to Account mode = clear `chat_participant_token`.
  - Switching to Anonymous mode requires a fresh LTI context (either a stored short-lived LTI cookie or redirect to LMS link).

## Backend / app changes

### A) apps/chat

1. **Auth helper**
   - Add a shared helper (e.g. `src/lib/auth/participant.ts`) that:
     - picks identity from `chat_participant_token` first, then `participant_token`
     - verifies with correct secret
     - returns `{ participantId, authMode: 'account'|'anonymous' }`

2. **LTI entry route**
   - Add a route (e.g. `/lti` or `/auth/lti`) that:
     - reads `jwt` query param or `lti-token` cookie
     - verifies with `APP_SECRET` (+ issuer if desired)
     - derives `guestSsoId`
     - looks up:
       - real account: `ParticipantAccount.ssoId = ltiSub`
       - guest account: `ParticipantAccount.ssoId = guestSsoId`
     - renders persona selection UI and sets/clears `chat_participant_token` accordingly
     - redirects to the target chatbot route

3. **Guest creation**
   - If guest persona doesn’t exist, create:
     - `Participant` (random username/password)
     - `ParticipantAccount` (guestSsoId)
     - `Participation` for the chatbot’s course

4. **Model restriction for anonymous**
   - In API route `/api/chatbots/[chatbotId]/chat`:
     - if `authMode === 'anonymous'`, force model to cheapest unlimited and ignore user selection.
   - Hide model picker in UI when anonymous.

### B) packages/graphql (optional)

This feature can be implemented fully in `apps/chat` (it already uses `prisma`).
Optional follow-up:
- Add a GraphQL mutation to create/resolve chat-guest identities so the logic is centralized.

## Testing strategy

### Unit/integration
- Guest SSO ID derivation is deterministic and course-scoped.
- `chat_participant_token` is accepted only by chat, not by backend GraphQL.
- Guest creation creates `ParticipantAccount` + `Participation`.

### Manual / browser
- LTI launch with no account → lands in anonymous chat, can send messages.
- LTI launch with existing account → persona selection works.
- Switching persona does not expose old anonymous threads under account.
- Anonymous mode forces cheapest model and UI indicates restriction.

## Rollout

1. Ship behind an env flag (e.g. `CHAT_ENABLE_LTI_GUEST=true`).
2. Initially enable for one course/chatbot.
3. Add telemetry (non-content): authMode + chatbotId + courseId.

## Open questions

1. Do we need anonymous personas per **course** (default) or per **chatbot**?
2. Should anonymous users be able to start chat from PWA without an LTI launch? (default: no)
3. Do we want automatic cleanup of unused guest participants after N days?
