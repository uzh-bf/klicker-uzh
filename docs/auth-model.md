---
type: Auth Model
title: Auth Model
description: Login flows for lecturers and participants, origin-based cookie selection in the backend, JWT scopes, and LTI launch rules.
timestamp: '2026-07-10'
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

## Login return targets

Manage and PWA login pages treat return targets as untrusted input:

- Manage preserves the current path when an authenticated query fails (`apps/frontend-manage/src/components/Layout.tsx:Layout`). Its login page resolves `redirect_to` against `NEXT_PUBLIC_MANAGE_URL` and accepts only that exact origin. External or malformed targets fall back to the manage root before the page redirects to the auth app (`apps/frontend-manage/src/pages/login.tsx:getServerSideProps`).
- PWA login accepts paths on the exact `NEXT_PUBLIC_PWA_URL` origin and normalizes them to relative navigation. It also accepts the exact `NEXT_PUBLIC_CHAT_URL` origin because chat login must return to a different app. Every other origin and malformed value falls back to the PWA root (`apps/frontend-pwa/src/pages/login.tsx:getSafeRedirectPath`). Local PWA targets use the Next router; chat targets use a full browser navigation after password login (`apps/frontend-pwa/src/pages/login.tsx:Login`). Assessment mode requires `NEXT_PUBLIC_PWA_URL` and resolves Auth return targets against that configured origin rather than the request `Host`.

The chat login-required page validates its own return target against `NEXT_PUBLIC_CHAT_URL` before passing an absolute URL to the PWA (`apps/chat/src/app/noLogin/page.tsx:getChatRedirectUrl`). Assessment login receives the same sanitized PWA target through the auth app.

## Where authorization happens

Authentication (this page) only puts a verified `user` on the GraphQL context. All authorization — role gates, scope ladder, object-level permissions, sharing grants — is enforced per-field in the API layer; see [GraphQL API Layer](./graphql-api-layer.md).
