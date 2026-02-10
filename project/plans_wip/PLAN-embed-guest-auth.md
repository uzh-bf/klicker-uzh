# Plan: Generalized Guest Auth for Embed SDK & Third-Party Integrations

## Context

The LTI semi-anonymous chatbot access (commits `f695bf1` + `05670d6`) established a pattern: **external auth → launch token → guest persona → scoped session cookie**. The current implementation is LTI-specific, but the same pattern can serve any third-party application that embeds the chatbot.

This plan designs how to generalize the auth mechanism for the upcoming embed SDK (`@klicker-uzh/embed-sdk`, see `project/EMBED_SDK.md`), so any host application with its own login system can securely embed chatbots with user-scoped, persistent chat history.

---

## What Already Exists

### Current LTI flow (implemented)

```
LMS → apps/lti (OIDC verify) → short-lived JWT (5min, APP_SECRET)
  → apps/chat/auth/lti?jwt=...&courseId=...&chatbotId=...
    → verify JWT → create/find guest persona → issue chat_participant_token (14d)
      → redirect to /{chatbotId}
```

### Key components already built

| Component | File | Reusable? |
|-----------|------|-----------|
| Deterministic HMAC persona derivation | `apps/chat/src/lib/server/ltiGuest.ts` | Yes — core logic is LTI-agnostic |
| Dual-token auth guards | `apps/chat/src/lib/server/apiGuards.ts` | Yes — already source-agnostic |
| Edge-compatible middleware | `apps/chat/src/middleware.ts` | Yes — checks cookie, not source |
| Frontend `authMode` state | `apps/chat/src/stores/settingsStore.ts` | Yes — `'anonymous'` covers all guest types |
| Model restriction enforcement | `chat/route.ts`, `credits/route.ts` | Partially — currently hardcoded to fallback |

### Embed SDK plan (`project/EMBED_SDK.md`)

Already specifies `auth-required` event, CSP `frame-ancestors`, and "short-lived signed claims" — but **doesn't specify how the launch token is obtained** or how host apps authenticate with KlickerUZH.

---

## Core Insight

The LTI flow has two logically independent stages:

1. **Launch token issuance**: `apps/lti` verifies the LMS's OIDC proof and issues a JWT
2. **Token consumption**: `apps/chat/auth/lti` verifies the JWT and creates a guest session

For third-party embeds, stage 1 is replaced with a **generic launch token API** that any authorized host backend can call. Stage 2 stays almost identical.

---

## Design: Generalized Guest Auth

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                 HOST APPLICATION                     │
│                                                     │
│  Backend:                                           │
│    POST /api/embed/launch                           │
│      Authorization: Bearer <integration_api_key>    │
│      Body: { externalUserId, chatbotId }            │
│    → { launchToken: "eyJ..." }                      │
│                                                     │
│  Frontend:                                          │
│    createEmbed({                                    │
│      container: el,                                 │
│      chatbotId: '...',                              │
│      launchToken: '...',  // from backend           │
│    })                                               │
│    ┌──────────────────────────────────────────────┐  │
│    │          CHAT IFRAME                         │  │
│    │  /auth/launch?token=...&embed=true           │  │
│    │  → verify → guest persona → session cookie   │  │
│    │  → redirect to /{chatbotId}?embed=true       │  │
│    └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 1. Integration Registration (new Prisma model)

```prisma
// packages/prisma/src/prisma/schema/chat.prisma

model EmbedIntegration {
  id                String   @id @default(uuid())
  name              String                          // "MyApp Production"
  courseId          String
  course            Course   @relation(fields: [courseId], references: [id])

  // Auth
  apiKeyHash        String                          // bcrypt hash of API key
  apiKeyPrefix      String                          // first 8 chars for lookup

  // Security
  allowedOrigins    String[]                        // CSP frame-ancestors
  allowedChatbotIds String[] @default([])           // empty = all in course

  // Guest config
  guestAccountType  String   @default("embed_guest")
  modelRestriction  String   @default("fallback")   // "fallback" | "all" | JSON model ID array

  // Lifecycle
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([apiKeyPrefix])
}
```

**Per-course scoping** mirrors LTI. A host app serving multiple courses gets one integration per course.

### 2. Launch Token API

```
POST /api/embed/launch
Authorization: Bearer <api_key>
Body: { "externalUserId": "user-123", "chatbotId": "uuid" }
→ { "launchToken": "eyJ...", "expiresIn": 300 }
```

**File**: `apps/chat/src/app/api/embed/launch/route.ts`

Token claims: `{ sub, chatbotId, courseId, integrationId, scope: "EMBED_LAUNCH", exp: +5min }`

Signed with `APP_CHAT_GUEST_SECRET`. The `EMBED_LAUNCH` scope prevents use as a session token (session tokens have scope `CHAT_GUEST`).

### 3. Generic Auth Route

**File**: `apps/chat/src/app/auth/launch/route.ts`

| Route | Purpose | Stays? |
|-------|---------|--------|
| `/auth/lti` | LTI-specific entry (accepts `?jwt` from apps/lti) | Yes, keep |
| `/auth/launch` | Generic entry (accepts `?token` from embed SDK) | New |

`/auth/launch` flow:
1. Verify launch token (scope `EMBED_LAUNCH`)
2. Look up `EmbedIntegration` → validate `isActive`, chatbot allowed
3. Derive guest persona: `HMAC(CHAT_GUEST_SEED, externalUserId + ":" + integrationId + ":" + courseId)`
4. Create/find Participant + ParticipantAccount (type from integration) + Participation
5. Issue `chat_participant_token` (14d, scope `CHAT_GUEST`)
6. Redirect to `/{chatbotId}?embed=true`

### 4. Refactoring: Shared Guest Identity Core

Extract reusable core from `ltiGuest.ts`:

```
apps/chat/src/lib/server/
  guestIdentity.ts     ← NEW: shared core
    • deriveGuestSsoId(externalId, scope, courseId) — deterministic HMAC
    • findOrCreateGuestPersona(ssoId, accountType, ssoType, courseId) — DB ops
    • signChatGuestToken(participantId) / verifyChatGuestToken(token) — JWT ops
    • getChatGuestSecret() — secret derivation

  ltiGuest.ts          ← THIN wrapper
    • verifyLtiToken(jwt) — LTI-specific JWT verification
    • Calls guestIdentity with scope='lti', type='lti_guest'

  embedGuest.ts        ← NEW: embed-specific
    • verifyLaunchToken(token) — EMBED_LAUNCH scope verification
    • lookupIntegration(integrationId) — validate active integration
    • Calls guestIdentity with scope=integrationId, type=integration.guestAccountType
```

### 5. Embed SDK Auth Support

**In `@klicker-uzh/embed-sdk`'s `createEmbed()`:**

```typescript
const embed = createEmbed({
  container: document.getElementById('chat'),
  chatbotId: 'abc-123',
  launchToken: tokenFromBackend,
  onEvent: (event) => {
    if (event.type === 'auth-expired') {
      embed.updateToken(freshTokenFromBackend)
    }
  },
})
```

**Two delivery mechanisms** (phased):

| Mechanism | How | When |
|-----------|-----|------|
| URL parameter | SDK builds iframe src as `/auth/launch?token=<jwt>&embed=true` | v1 (simple, reuses existing redirect pattern) |
| postMessage | Iframe loads → emits `auth-required` → SDK responds with token via postMessage | v2 (more secure, token never in URL) |

### 6. Per-Integration Model & Credit Restrictions

Replace hardcoded `authMode === 'anonymous'` → fallback with integration-aware config:

- **`modelRestriction: "fallback"`** (default): only cheapest fallback model (current LTI behavior)
- **`modelRestriction: "all"`**: no restriction (integration sponsor pays)
- **`modelRestriction: '["gpt-4.1","gpt-4.1-mini"]'`**: allow specific models

For credits, add optional override fields on `EmbedIntegration`:
```prisma
guestCreditInitialCredits Int?
guestCreditMaxCredits     Int?
```

When null, falls back to the chatbot's standard credit config.

---

## How LTI Fits In After Generalization

LTI remains a separate entry point (`/auth/lti`) that doesn't use the `EmbedIntegration` model — it has its own trust chain (LTI OIDC → apps/lti → JWT). But both paths converge on the same **guestIdentity.ts** core for persona creation and session token issuance.

```
LTI path:  LMS → apps/lti → /auth/lti → guestIdentity.ts → chat_participant_token
Embed path: Host → /api/embed/launch → /auth/launch → guestIdentity.ts → chat_participant_token
```

The middleware, API guards, frontend authMode, and model restrictions are already source-agnostic — they don't care *how* the `chat_participant_token` was issued.

---

## Implementation Phases

| Phase | What | Depends on |
|-------|------|------------|
| A | Refactor: extract `guestIdentity.ts` from `ltiGuest.ts` | Nothing |
| B | Schema: add `EmbedIntegration` model, migrate | A |
| C | API: launch token endpoint + `/auth/launch` route + `embedGuest.ts` | A, B |
| D | SDK: add `launchToken` to `createEmbed()` (URL param delivery) | C, embed SDK Phase 2 |
| E | Config: per-integration model/credit restrictions | C |

Phase A can be done independently as a no-behavior-change refactor.
Phases B–C are the core feature.
Phases D–E layer on top.

---

## Security Summary

| Concern | Mitigation |
|---------|-----------|
| API key exposure | Key stays on host backend; only short-lived launch token reaches browser |
| Token replay | 5-min expiry; consumed on first load; redirect strips from URL |
| Scope confusion | Launch token: `scope: EMBED_LAUNCH`; session cookie: `scope: CHAT_GUEST`; main API: `APP_SECRET` |
| Cross-course access | Guest persona HMAC includes `integrationId + courseId`; integration is per-course |
| iframe clickjacking | CSP `frame-ancestors` from `EmbedIntegration.allowedOrigins` |
| PII leakage | No email, random username; stored ssoId is non-reversible HMAC |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `apps/chat/src/lib/server/guestIdentity.ts` | Create — shared core |
| `apps/chat/src/lib/server/ltiGuest.ts` | Refactor — thin LTI wrapper |
| `apps/chat/src/lib/server/embedGuest.ts` | Create — embed-specific logic |
| `apps/chat/src/app/api/embed/launch/route.ts` | Create — launch token API |
| `apps/chat/src/app/auth/launch/route.ts` | Create — generic auth entry |
| `packages/prisma/src/prisma/schema/chat.prisma` | Modify — add `EmbedIntegration` |
| `apps/chat/src/middleware.ts` | Modify — add `/auth/launch` to bypass list |
| `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` | Modify — integration-aware model restriction |
| `apps/chat/src/app/api/chatbots/[chatbotId]/credits/route.ts` | Modify — integration-aware filtering |
