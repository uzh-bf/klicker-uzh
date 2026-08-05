---
type: Auth Model
title: Auth Model
description: Login flows for lecturers and participants, origin-based cookie selection in the backend, JWT scopes, and LTI launch rules.
timestamp: '2026-08-04'
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
- **LTI 1.3 only** — `apps/lti` (ltijs). Launch targets resolve in strict precedence `custom claim (klicker_redirect_to)` → `query redirectTo`, with **no env fallback**; validation fails closed on the first present-but-invalid source and checks URL hostnames exact/subdomain against `COOKIE_DOMAIN` and `DF_DOMAIN` — never substring matching (`apps/lti/src/launchTarget.ts`).

**LTI 1.1 is retired and must not be reintroduced without signature verification.** The removed path derived a login identity from an unauthenticated form POST; no OAuth 1.0a signature was ever checked. `resolveOrCreateParticipantForLti` (`packages/graphql/src/services/accounts.ts`) now rejects any launch whose `scope` is not `LTI1.3`, so the trust boundary is enforced server-side rather than by the absence of a caller.

Two related properties of that resolver are worth knowing before changing it: it resolves by `ssoId` and then falls back to matching `Participant.email`, and both happen **before** the `allowCreate` gate — so `allowCreate: false` constrains account creation only, never account resolution. Any new launch path must therefore be verified before it reaches this function, not inside it.

Note the account-duplication trap: participant emails are only unique per auth mode (`@@unique([email, isSSOAccount])` — details in [Data & Migrations](./data-and-migrations.md)).

## Login return targets

Manage and PWA login pages treat return targets as untrusted input:

- Manage preserves the current path when an authenticated query fails (`apps/frontend-manage/src/components/Layout.tsx:Layout`). Its login page resolves `redirect_to` against `NEXT_PUBLIC_MANAGE_URL` and accepts only that exact origin. External or malformed targets fall back to the manage root before the page redirects to the auth app (`apps/frontend-manage/src/pages/login.tsx:getServerSideProps`).
- PWA login accepts paths on the exact origin the build is served from and normalizes them to relative navigation. It also accepts the exact `NEXT_PUBLIC_CHAT_URL` origin because chat login must return to a different app. Every other origin and malformed value falls back to the app root (`apps/frontend-pwa/src/pages/login.tsx:getSafeRedirectPath`). Local PWA targets use the Next router; chat targets use a full browser navigation after password login (`apps/frontend-pwa/src/pages/login.tsx:Login`).

**The anchoring origin is build-specific.** The regular build anchors on `NEXT_PUBLIC_PWA_URL`, the assessment build on `NEXT_PUBLIC_ASSESSMENT_URL`, and either falls back to the request `Host` when its variable is unset (`apps/frontend-pwa/src/pages/login.tsx:getServerSideProps`). Anchoring assessment mode on `NEXT_PUBLIC_PWA_URL` is a regression, not a shortcut: the two builds run on separate origins with separate sessions, and the regular PWA offers no Edu-ID login, so students sent there after Edu-ID cannot sign in at all. The Next.js 16 upgrade (#5166) introduced exactly that regression on `v3`; production never shipped it, because prd stayed pinned to a pre-#5166 tag while staging floats `v3`.

The chat login-required page validates its own return target against `NEXT_PUBLIC_CHAT_URL` before passing an absolute URL to the PWA (`apps/chat/src/app/noLogin/page.tsx:getChatRedirectUrl`). That page always routes through `NEXT_PUBLIC_PWA_URL/login`, so a chat target never reaches the assessment build.

**The PWA-side sanitizer is not the only gate.** The auth app independently validates the `/student` `redirectTo` against `AUTH_STUDENT_ALLOWED_HOSTS` and returns `400 Invalid redirect URL` for anything outside it (`apps/auth/src/middleware.ts`). That second gate is what keeps the request-`Host` fallback above safe, and it is also what a `400` from `/student` means: the target origin is missing from that env var (`assessment.klicker.stg.df-app.ch` on stg, `assessment.klicker.uzh.ch` on prd).

## Where authorization happens

Authentication (this page) only puts a verified `user` on the GraphQL context. All authorization — role gates, scope ladder, object-level permissions, sharing grants — is enforced per-field in the API layer; see [GraphQL API Layer](./graphql-api-layer.md).
