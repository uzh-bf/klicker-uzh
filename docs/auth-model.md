---
type: Auth Model
title: Auth Model
description: Login flows for lecturers and participants, origin-based cookie selection in the backend, JWT scopes, and LTI launch rules.
timestamp: '2026-07-25'
tags:
  - backend
  - auth
  - security
---

# Auth Model

**The non-obvious core: the backend chooses which auth cookie to read based on the request's `Origin` header.** `jwtMiddleware` (`apps/backend-docker/src/app.ts`) inspects `req.headers.origin` against the `APP_MANAGE_SUBDOMAIN`/`APP_CONTROL_SUBDOMAIN`/`APP_STUDENT_SUBDOMAIN` env vars (defaults `manage`/`control`/`pwa`):

| Request origin                      | Cookie(s) tried, in order                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| manage / control                    | `next-auth.session-token`                                                       |
| pwa                                 | `participant_token` → `temporary_participant_token` → `next-auth.session-token` |
| assessment (`ASSESSMENT_MODE=true`) | `next-auth.participant-session-token`                                           |

A `Bearer` authorization header is always the final fallback (assessment live-quiz mode depends on it — marked `DO NOT TOUCH` in the source). Whatever token is found is verified with `verifyJWT(token, APP_SECRET)`; failure just yields an unauthenticated context, not an error. Consequence for local setups: apps and backend must share `APP_SECRET`, and cookie domains must match the origin the backend expects — this is why the Traefik `*.klicker.com` path mirrors production more faithfully than raw localhost.

## Lecturer login (`apps/auth`)

NextAuth (Auth.js) with `@auth/prisma-adapter`, JWT session strategy with a custom `encode` (so the backend can verify the same token), configured in `apps/auth/src/pages/api/auth/[...nextauth].ts`. Two provider groups:

- **Edu-ID OIDC** (`EduIDLecturerProvider`) — only registered when `EDUID_CLIENT_SECRET` is set; scope includes `https://login.eduid.ch/authz/User.Read`. Without Edu-ID credentials (typical local dev), this provider is absent — use delegated login.
- **Delegated login** (`CredentialsProvider`) — authenticates against `User.shortname` + a `UserLogin` record. Each `UserLogin` carries a `UserLoginScope` that ends up as `token.scope` in the JWT callback: the ladder `ACCOUNT_OWNER > FULL_ACCESS > SESSION_EXEC > READ_ONLY` is enforced field-by-field in the API layer ([three-layer auth](./graphql-api-layer.md)). Edu-ID logins get scope `EDUID`.

The NextAuth cookie domain is derived by stripping the first subdomain label from the auth URL, so the session cookie is shared across `*.klicker.com`-style app domains. The **Catalyst** flag is computed from Edu-ID affiliations (`packages/util/src/auth.ts:reduceCatalyst` — any `uzh.ch`/`usz.ch` affiliation).

## Participant login (`apps/frontend-pwa`)

- **Username/password** — PWA `LoginForm` → login mutation → `participant_token` cookie; the PWA Apollo client additionally sends the token as `Bearer` from sessionStorage.
- **Magic link** — `services/accounts.ts:sendMagicLink` signs a 15-minute JWT and emails `${APP_ORIGIN_PWA}/magicLogin?token=…`; the `magicLogin` page exchanges it via `LoginParticipantMagicLinkDocument` (`loginParticipantMagicLink`).
- **Edu-ID for participants** — separate NextAuth config in the same auth app (`EduIDParticipantProvider`), same `EDUID_CLIENT_SECRET` gating.
- **Temporary (anonymous)** — `temporary_participant_token` cookie, role `TEMPORARY_PARTICIPANT`.
- **LTI** — `apps/lti` (ltijs). Launch targets resolve in strict precedence `custom claim (klicker_redirect_to)` → `query redirectTo`, with **no env fallback**; validation fails closed on the first present-but-invalid source and checks URL hostnames exact/subdomain against `COOKIE_DOMAIN` and `DF_DOMAIN` — never substring matching (`apps/lti/src/launchTarget.ts`).

Note the account-duplication trap: participant emails are only unique per auth mode (`@@unique([email, isSSOAccount])` — details in [Data & Migrations](./data-and-migrations.md)).

## Lecturer MCP and Manage assistant

`apps/mcp-lecturer` is currently an internal backend service for the embedded Manage assistant, not an OAuth-exposed MCP server:

1. `getAuthenticatedManageUser` in `apps/chat/src/lib/server/manageAuth.ts` verifies the lecturer's `next-auth.session-token` with `APP_SECRET` and returns `{ sub, role, scope }`, rejecting (returning `null` for) any session whose role is not `USER` or `ADMIN` — mirroring the backend role lattice, where `ADMIN` satisfies every `USER` gate (`packages/graphql/src/builder.ts`). (`getAuthenticatedManageUserId` remains as a thin sub-only wrapper for the one caller — the Manage assistant page shell — that only needs the id.)
2. `mintLecturerMcpJwt(userId, sessionScope)` in `apps/chat/src/lib/server/mcpAuthMint.ts` creates a five-minute HS256 bearer token with `purpose: lecturer-mcp`, mapping the session's `UserLoginScope` to the minted MCP scope via `resolveLecturerMcpScope`:

   | Session `UserLoginScope`                                | Minted MCP scope           | Why                                                                                                                                                                                                |
   | ------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `ACCOUNT_OWNER`, `FULL_ACCESS`                          | `manage:read manage:draft` | The only session scopes the GraphQL layer lets author/persist content — `packages/graphql/src/schema/mutation.ts` gates every question/course-authoring mutation behind `FULL_ACCESS` or higher.   |
   | `SESSION_EXEC`, `READ_ONLY`                             | `manage:read`              | `SESSION_EXEC` only unlocks live-quiz run/feedback-moderation mutations, never content drafting — granting `manage:draft` here would over-grant exactly like the original bug did for `READ_ONLY`. |
   | `OTP`                                                   | rejected (mint throws)     | Activation/reset sessions, not working sessions — the GraphQL layer does not even consider `OTP` authenticated (`packages/graphql/src/builder.ts`).                                                |
   | missing (pre-scope sessions), or any other/future value | `manage:read`              | Availability-safe floor: an unrecognized scope degrades to read-only instead of breaking the assistant or over-granting.                                                                           |

   A real Edu-ID lecturer session always carries `ACCOUNT_OWNER` (the `apps/auth` lecturer `jwt` callback sets it whenever the OIDC profile carries `swissEduPersonUniqueID`, which Edu-ID's essential claims always provide), so this mapping does not restrict production Edu-ID lecturers to read-only. `EDUID` is a real `UserLoginScope` enum member, but only _participant_ sessions ever carry it (separate cookie, separate `jwt` callback in `apps/auth`) — it never reaches a lecturer/Manage session, so it only matters here as one of the "any other value" fallback cases.

   The in-process mint cache is keyed on `userId:mcpScope` (not just `userId`), since one lecturer can hold sessions with different scopes concurrently.

3. `loadLecturerMcpTools(userId, sessionScope)` in `apps/chat/src/services/lecturerMcp.ts` sends that token to the internal Streamable HTTP endpoint, then filters the returned toolset: when the minted scope lacks `manage:draft`, the four draft/proposal tools (`klicker_lecturer_question_draft`, `klicker_lecturer_choices_draft`, `klicker_lecturer_feedback_draft`, `klicker_lecturer_element_create_draft_proposal`) are dropped from what is advertised to the model, so it never attempts a call that would only come back `MISSING_SCOPE`. That tool-name list is duplicated from `LECTURER_MCP_TOOL_POLICIES` in `apps/mcp-lecturer/src/toolPolicy.ts` — the MCP `tools/list` response carries no `rbacScope` field to derive it from at request time, so keep the two lists in sync if the policy table changes. `buildManageAssistantSystemPrompt` (`apps/chat/src/services/manageAssistantRuntime.ts`) takes a matching `draftToolsAvailable` flag so the system prompt does not claim draft/proposal tools are available when they were filtered out.
4. `apps/mcp-lecturer/src/auth.ts` verifies the signature, issuer, subject, role, purpose, and scopes. Tool queries then enforce the lecturer's derived object permissions; proposal tools only return a separately signed draft proposal, and the authenticated chat confirmation route performs persistence under the lecturer's own session — so the GraphQL scope ladder remains the final enforcement point for any mutation regardless of what the MCP token carries.

There is no OAuth authorization-server configuration, protected-resource metadata, token endpoint, client registration, consent, PKCE, or external token acquisition flow. The service is deployed as Kubernetes `ClusterIP`; Helm points chat at its internal service name, and local development binds it to port 7081 without a devrouter route. Its `/mcp` endpoint still requires the custom bearer token, but network placement is not the authentication mechanism.

Current hardening boundaries:

- The MCP token has no `aud`/resource claim, so it is not resource-bound.
- Code supports a dedicated `MCP_LECTURER_JWT_SECRET`, but the current Helm deployment supplies the shared chat `APP_SECRET`.
- The chart does not currently add a lecturer-MCP NetworkPolicy.
- The MCP token always stamps `role: USER` even for `ADMIN`-role sessions — a deliberate downscope (the MCP layer treats every caller as a lecturer; ADMIN gains nothing extra there).

An external MCP integration therefore needs a separately approved authentication design: OAuth discovery and protected-resource metadata, audience-bound access tokens, external client registration/consent, delegated scope mapping, dedicated signing keys, ingress and network policy, and audit/rate-limit decisions.

## Login return targets

Manage and PWA login pages treat return targets as untrusted input:

- Manage preserves the current path when an authenticated query fails (`apps/frontend-manage/src/components/Layout.tsx:Layout`). Its login page resolves `redirect_to` against `NEXT_PUBLIC_MANAGE_URL` and accepts only that exact origin. External or malformed targets fall back to the manage root before the page redirects to the auth app (`apps/frontend-manage/src/pages/login.tsx:getServerSideProps`).
- PWA login accepts paths on the exact `NEXT_PUBLIC_PWA_URL` origin and normalizes them to relative navigation. It also accepts the exact `NEXT_PUBLIC_CHAT_URL` origin because chat login must return to a different app. Every other origin and malformed value falls back to the PWA root (`apps/frontend-pwa/src/pages/login.tsx:getSafeRedirectPath`). Local PWA targets use the Next router; chat targets use a full browser navigation after password login (`apps/frontend-pwa/src/pages/login.tsx:Login`). Assessment mode requires `NEXT_PUBLIC_PWA_URL` and resolves Auth return targets against that configured origin rather than the request `Host`.

The chat login-required page validates its own return target against `NEXT_PUBLIC_CHAT_URL` before passing an absolute URL to the PWA (`apps/chat/src/app/noLogin/page.tsx:getChatRedirectUrl`). Assessment login receives the same sanitized PWA target through the auth app.

## Where authorization happens

Authentication (this page) only puts a verified `user` on the GraphQL context. All authorization — role gates, scope ladder, object-level permissions, sharing grants — is enforced per-field in the API layer; see [GraphQL API Layer](./graphql-api-layer.md).
