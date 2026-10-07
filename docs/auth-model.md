---
type: Auth Model
title: Auth Model
description: Login flows for lecturers and participants, origin-based cookie selection in the backend, JWT scopes, and LTI launch rules.
timestamp: '2026-09-19'
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

- **Edu-ID OIDC** (`EduIDLecturerProvider`) — only registered when `EDUID_CLIENT_SECRET` is set; scope is `openid email profile https://login.eduid.ch/authz/User.Read`, following the SWITCH integration guide (`profile` is what releases `given_name`/`family_name`, `User.Read` the `swissEduPerson*` and affiliation claims). The devcontainer supplies a synthetic `EDUID_CLIENT_SECRET` plus the local OIDC mock's issuer while its profile selection routes the mock (the default `full` profile, or `eduid` next to a selective one), so the provider is registered there too; in deployments without credentials the provider stays absent — use delegated login.
- **Delegated login** (`CredentialsProvider`) — authenticates against `User.shortname` + a `UserLogin` record. Each `UserLogin` carries a `UserLoginScope` that ends up as `token.scope` in the JWT callback: the ladder `ACCOUNT_OWNER > FULL_ACCESS > SESSION_EXEC > READ_ONLY` is enforced field-by-field in the API layer ([three-layer auth](./graphql-api-layer.md)). Edu-ID logins get scope `EDUID`.

Both edu-ID providers set `idToken: true`, which makes NextAuth build the profile from the ID token alone and never call the UserInfo endpoint. Whether a given attribute reaches the ID token is a per-claim setting in the AAI Resource Registry, not something this repository controls, and edu-ID does not advertise `claims_parameter_supported`, so the `claims` request parameter in the provider config is not honoured — the requested scopes plus the Resource Registry settings decide everything. Set `EDUID_FETCH_USERINFO=true` to additionally call UserInfo and merge its claims over the ID token ones, which makes the Resource Registry's ID-token settings irrelevant; the flag defaults to off.

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

## Participant account completion

A valid participant JWT establishes identity, but does not establish that the
account has completed the current data-use disclosure. The shared
`isParticipantDataUseComplete` predicate requires the current acknowledgement
version and separately recorded research and Learning Analytics choices.
The registered `participantAccountGate` Pothos plugin checks persisted state
before protected GraphQL root fields and runs after the scope-auth plugin, so a
field's own authorization error always wins. Its explicit support-field list
keeps login, self-state, completion and account support accessible while locked.
Lecturer and temporary-participant roles retain their separate authorization.
The PWA redirects incomplete participants to `/account/data-use` when an API
call answers with `PARTICIPANT_DATA_USE_COMPLETION_REQUIRED`, storing the return
destination through `participantDataUseReturn`, which accepts local destinations
and removes launch credentials.

Account creation and completion record the acknowledgement and independent
choices through the revisioned data-use service. Creation, completion, and
settings all submit the disclosure version bundled with the displayed
disclosure text together with the expected revision; a page whose bundled
version no longer matches the server-required version must reload before it
can save. Research starts allowed on the creation form, whereas Learning
Analytics requires an explicit answer. These UI defaults do not backfill legacy
accounts. Analytics withdrawal atomically records the new choice, its audit
event, and a durable cleanup request in one transaction. Executing that
cleanup as an ongoing consent-aware processing workflow is a later layer. The
first release therefore blocks legacy analytics derivation and reads, and its
launch requires stopping in-flight old collectors and completing any necessary
retained-data reconciliation. A successful settings response confirms the
persisted choice and cleanup request, not completed deletion. The canonical
writer is available through the server-only GraphQL package entry
`dist/participant-data-use`; its context contains only Prisma and verified
participant identity/role, so chat can reuse the same transactions without
constructing a GraphQL request context.

Assessment completion uses the same four disclosure sections with additional
identity, answer, audit-log, access and retention information. In the assessment
backend (`ASSESSMENT_MODE=true`), `deleteParticipantAccount` rejects self-deletion
before reading or deleting records or clearing the login cookie. The profile UI
also hides the action, but that is not the enforcement boundary. This restriction
does not implement expiry of retention periods or an operator deletion workflow.

## Login return targets

Manage and PWA login pages treat return targets as untrusted input:

- Manage preserves the current path when an authenticated query fails (`apps/frontend-manage/src/components/Layout.tsx:Layout`). Its login page resolves `redirect_to` against `NEXT_PUBLIC_MANAGE_URL` and accepts only that exact origin. External or malformed targets fall back to the manage root before the page redirects to the auth app (`apps/frontend-manage/src/pages/login.tsx:getServerSideProps`).
- PWA login accepts paths on the exact origin the build is served from and normalizes them to relative navigation. It also accepts the exact `NEXT_PUBLIC_CHAT_URL` origin because chat login must return to a different app. Every other origin and malformed value falls back to the app root (`apps/frontend-pwa/src/pages/login.tsx:getSafeRedirectPath`). Local PWA targets use the Next router; chat targets use a full browser navigation after password login (`apps/frontend-pwa/src/pages/login.tsx:Login`).

**The anchoring origin is build-specific.** The regular build anchors on `NEXT_PUBLIC_PWA_URL`, the assessment build on `NEXT_PUBLIC_ASSESSMENT_URL`, and either falls back to the request `Host` when its variable is unset (`apps/frontend-pwa/src/pages/login.tsx:getServerSideProps`). Anchoring assessment mode on `NEXT_PUBLIC_PWA_URL` is a regression, not a shortcut: the two builds run on separate origins with separate sessions, and the regular PWA offers no Edu-ID login, so students sent there after Edu-ID cannot sign in at all. The Next.js 16 upgrade (#5166) introduced exactly that regression on `v3`; production never shipped it, because prd stayed pinned to a pre-#5166 tag while staging floats `v3`.

The chat login-required page validates its own return target against `NEXT_PUBLIC_CHAT_URL` before passing an absolute URL to the PWA (`apps/chat/src/app/noLogin/page.tsx:getChatRedirectUrl`). That page always routes through `NEXT_PUBLIC_PWA_URL/login`, so a chat target never reaches the assessment build.

**The PWA-side sanitizer is not the only gate.** The auth app independently validates the `/student` `redirectTo` against `AUTH_STUDENT_ALLOWED_HOSTS` and returns `400 Invalid redirect URL` for anything outside it (the auth proxy at `apps/auth/src/proxy.ts` — Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`). Targets must additionally be free of embedded URL credentials. The proxy, server-rendered student page and NextAuth handler share the secure-cookie deployment policy: HTTPS `NEXTAUTH_URL` requires HTTPS targets, with `AUTH_SECURE_COOKIES` as the explicit override. A production-compiled HTTP test deployment therefore follows its configured transport rather than the compiler's `NODE_ENV`. That second gate keeps the request-`Host` fallback above safe; a `400` from `/student` can mean the target host is missing from the allowlist (`assessment.klicker.stg.df-app.ch` on stg, `assessment.klicker.uzh.ch` on prd). The student page resolves its destination on the server using the same configured hosts, preserving allowed paths and queries through sign-in and existing-session navigation.

The auth app's NextAuth redirect callbacks accept relative paths and absolute URLs on the auth app's own origin. Cross-origin targets remain restricted to the configured student and lecturer hosts. This preserves internal handoffs such as `/discourse_handoff` when NextAuth supplies the callback as an absolute URL (`apps/auth/src/pages/api/auth/[...nextauth].ts`).

## Audience dispatch in the auth service

**The invariant: a login attempt's intended account audience cannot change between initiation and callback.** The auth service serves two audiences (participant, lecturer) through one NextAuth catch-all route, and which configuration handles a request is decided strictly, not heuristically (`apps/auth/src/lib/dispatch.ts`):

- **OAuth callbacks** resolve their audience only from the audience-namespaced state cookies. NextAuth signs every temporary OAuth cookie (state, PKCE verifier, nonce) as an A256GCM JWE whose HKDF key is derived from `(APP_SECRET, cookie name)`; the auth app delegates salt-bearing JWT calls to that library implementation and keeps the salt-free HS256 session contract for the backend (`apps/auth/src/lib/jwt.ts`). Because the salt is the cookie name, a participant-issued state cookie is undecryptable under the lecturer cookie name. A callback resolves only when exactly one candidate cookie decrypts, names the expected provider, and equals the single returned `state` parameter; anything else — missing, expired, duplicated, malformed, ambiguous — redirects to the neutral `/restart` page with no account handling. There is no lecturer default.
- **Initiation** (sign-in/sign-out) reads the explicit `participant=true` query parameter; delegated credentials sign-in is a fixed lecturer route, and contradictory inputs are rejected. Generic actions (`session`, `csrf`, `providers`) keep the lecturer configuration.
- **Callback-supplied audience/target query parameters are stripped** before NextAuth runs, so a query can never replace verified transaction context.

The temporary OAuth cookies are namespaced per audience (`__Secure-next-auth.participant.state`, `__Secure-next-auth.lecturer.state`, …) via `apps/auth/src/lib/authCookies.ts`, so overlapping participant and lecturer attempts in one browser cannot overwrite each other's state, PKCE verifier, or return destination (each audience also has its own `callback-url` cookie). The persistent session cookies keep their contract names (`next-auth.session-token`, `next-auth.participant-session-token`); the former short-lived `klicker_student_redirect_to` / `klicker_lecturer_redirect_to` proxy cookies are gone and carry no authority.

A verified participant callback resolves its destination from that stored `callback-url` value before NextAuth initializes the callback, with the assessment root as the server-selected default, so a missing or invalid stored destination cannot silently continue to the auth homepage. A failure inside NextAuth after the audience is verified (token-exchange error, invalid PKCE material) is answered with a redirect to `/restart?audience=participant`, which offers only the student entry point so the retry cannot drift into lecturer account handling (`apps/auth/src/lib/errorRecovery.ts`).

Provider-returned errors also resolve state before choosing recovery. Verified participants retain participant recovery; unverified attempts and lecturer errors use the neutral restart page, without token exchange or account handling. Only bounded error codes enter participant recovery URLs; provider error text is excluded from telemetry. The restart page resolves its audience on the server, so participant recovery never includes a lecturer button in its initial HTML, even before JavaScript hydrates.

This is the Phase 1 boundary: failures cannot silently switch account audience, but temporary cookies still hold one attempt per audience. Concurrent attempts for the same audience can supersede state or return destinations and require a restart. Phase 2 adds per-attempt storage, destination binding and atomic consumption for independently completing concurrent attempts; it is not needed to remove the ten-second routing-cookie failure.

**Participant session lookup has a fixed endpoint**: `GET /api/student-session` always interprets the request with the participant configuration, requires a valid `PARTICIPANT` principal, never accepts a manager session, and responds `Cache-Control: no-store` (`apps/auth/src/pages/api/student-session.ts`). Expected invalidity — no cookie, an unverifiable or expired token, no matching participant row — answers `200` with `participant: null`; a lookup that fails for infrastructure reasons answers `503` with `session_lookup_unavailable` and `Retry-After`, which the assessment login UI turns into a retry action instead of presenting a student with a valid session as signed out. The assessment login UI uses the matching `useStudentSession()` hook instead of the generic `useSession()`, whose configuration depends on dispatch. Participant-scoped logout posts to `/api/auth/signout?participant=true`; a lecturer logout never clears the participant session and vice versa. A failed participant redirect falls back to the assessment root, never to manage or the auth homepage; unknown-context failures land on `/restart`, which offers explicit student and lecturer restart choices.

Auth telemetry (`apps/auth/src/lib/telemetry.ts`) emits one JSON line per auth event with request id, action, resolved audience and outcome category — never state, code, token or cookie values, and destinations reduced to their host.

## Where authorization happens

Authentication (this page) only puts a verified `user` on the GraphQL context. All authorization — role gates, scope ladder, object-level permissions, sharing grants — is enforced per-field in the API layer; see [GraphQL API Layer](./graphql-api-layer.md).
