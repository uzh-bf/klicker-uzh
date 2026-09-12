# Auth Library Evaluation — next-auth v4 → better-auth (and alternatives)

- Date: 2026-08-10
- Scope: full evaluation of migrating `apps/auth` off `next-auth@4.24.14`, with better-auth as the candidate named in the request, plus the realistic alternatives (stay-and-patch, Auth.js v5, direct `openid-client`).
- Verdict up front: **do not migrate to better-auth now.** Patch to `next-auth@4.24.15` immediately, fix the custom-layer defects listed in this document (they dominate the actual risk), and if/when leaving next-auth is desired, replace it with `openid-client` rather than better-auth. Better-auth remains the right candidate only for a future platform-level decision to consolidate all nine login flows and rework the session model.
- Method: two survey agents (repo auth surface; Prisma auth schema), two research agents (better-auth capabilities; next-auth status/alternatives), then two independent adversarial verification agents that re-read every material claim against source files and primary sources (official docs, GitHub API, npm registry). The main session additionally verified the decisive claims first-hand (npm packuments, GitHub security advisories API, better-auth JWT plugin docs, release notes). Verification outcome: 30/33 repo claims confirmed, 3 corrected in detail; 9/13 external claims confirmed, 4 corrected in detail; zero refutations of load-bearing findings. Corrections are incorporated below and listed in Appendix B.

## 1. Executive summary

next-auth's footprint in KlickerUZH is far smaller than the dependency suggests. The session cookie value is **not** a next-auth token: `apps/auth/src/lib/helpers.ts:50-64` overrides `jwt.encode`/`jwt.decode` and delegates to the repo's own `signJWT`/`verifyJWT` (`packages/util/src/jwt.ts`) — plain jose HS256 over the shared `APP_SECRET`, with the repo's own claim shape (`sub`, `role`, `scope`, `shortname`, `catalystInstitutional`, `catalystIndividual`, `email`). Seven services verify that JWT independently and offline. next-auth covers only three of nine user-facing login flows; the other six mint the same JWT shape through the GraphQL layer or the LTI service without touching next-auth at all.

Better-auth's core session model is the inverse of this architecture: its primary session cookie is an opaque, database-backed token whose verification requires calling better-auth. There is no equivalent of next-auth's `jwt: { encode, decode }` override. A migration would therefore not be a library swap but a session-architecture change rippling through seven consumer services, the Prisma schema, and both E2E suites — for wins (rate limiting, admin/impersonation, 2FA, passkeys) that do not require replacing the session mechanism in the first place.

Separately, and more urgently than any migration question: the pinned `next-auth@4.24.14` is affected by two applicable security advisories published 2026-07-20 and fixed in 4.24.15, and the custom auth layer has a set of real defects (most notably: next-auth-minted session JWTs appear to carry **no `exp` claim at all**) that exist regardless of which library is used.

## 2. Findings that require action regardless of any migration

### 2.1 Security patch: 4.24.14 → 4.24.15 (verified first-hand against GitHub advisory API and npm)

| Advisory | Severity | Applies here | Evidence |
| --- | --- | --- | --- |
| GHSA-xmf8-cvqr-rfgj — `getToken()` throws an uncaught exception on malformed `Authorization: Bearer` headers (unauthenticated DoS), affects ≥4.0.6 ≤4.24.14 | High | **Yes.** `getToken` is called on a reachable endpoint at `apps/auth/src/pages/api/discourse.ts:16` | Advisory published 2026-07-20; fixed in 4.24.15 |
| GHSA-x445-f3h2-j279 — OAuth `state`/`nonce`/PKCE cookies not bound to the provider that created them, affects ≤4.24.14 | Moderate | **Yes, amplified.** Two providers plus two entire configs are served from one route with one cookie namespace (`[...nextauth].ts:537-549`) | Advisory published 2026-07-20; fixed in 4.24.15 |
| GHSA-7rqj-j65f-68wh — homoglyph email normalization bypass in the Email provider | High | **No.** KlickerUZH magic links are custom-built in the GraphQL layer and never use next-auth's Email provider | — |

The 4.24.15 release notes (fetched from the GitHub releases API) describe a pure security patch: no changes to `jwt.encode`/`decode`, cookie config, or the Credentials provider. One behavioural note: PKCE/state cookies become provider-bound, and sign-ins in flight across the upgrade fail once and succeed on retry. Both KlickerUZH configs use the same provider id (`NEXT_PUBLIC_EDUID_ID` or `eduid`), so the dynamic dispatch is not expected to be affected — verify with one Edu-ID login on staging after bumping.

### 2.2 New finding: next-auth-minted session JWTs appear to have no expiry claim

Derived from verified code reading during this review; not previously documented anywhere in the repo.

- The custom `encode` (`apps/auth/src/lib/helpers.ts:58-64`) calls `signJWT(token, secret, { issuer })` and **ignores next-auth's `maxAge`**. `signJWT` (`packages/util/src/jwt.ts:19-43`) only sets an `exp` claim when `options.expiresIn` is provided — and it is not provided on this path.
- next-auth v4 does not inject `exp` into the token object before calling a custom `encode`; its own default encoder is what normally sets expiry. On refresh, the token round-trips through the custom `decode` → `jwt` callback → custom `encode`, and no step introduces `exp`.
- All downstream verifiers use `jose.jwtVerify`, which validates `exp` only if present. `apps/backend-docker/src/app.ts:110` verifies with no issuer and no max-age option; `apps/response-api/src/index.ts:244-261` checks issuer but not token age.
- Consequence, if confirmed: `next-auth.session-token` and `next-auth.participant-session-token` are cryptographically valid **forever** (until `APP_SECRET` rotation). The only expiry is the browser-side cookie `expires` (~30 days, client-enforced), which does not protect against token exfiltration. The GraphQL-minted `participant_token` is *not* affected (it signs with a 2-week expiry, `packages/graphql/src/services/accounts.ts:49`).
- Confirmation step (5 minutes): log in on staging, base64-decode the JWT payload from the cookie, check for `exp`. If absent, the minimal fix is a one-line change passing an `expiresIn` in the custom `encode`; existing sessions remain valid and gain expiry on their next rolling re-encode.
- Both E2E suites are unaffected by a fix: their forged tokens already set a 2-hour expiry explicitly (`cypress/cypress/support/commands.ts:159`, `playwright/util/authSession.ts`).

### 2.3 Custom-layer defects (all verified with file:line evidence)

These exist independently of next-auth and would be carried into any migration unchanged. They constitute most of the real-world auth risk surface.

| # | Defect | Evidence |
| --- | --- | --- |
| 1 | Three different lifetimes for `participant_token`: 30-day cookie (`accounts.ts:23`), 14-day JWT (`accounts.ts:49,65`), and a 13-day cookie on the LTI path (`apps/frontend-pwa/src/lib/getParticipantToken.ts:135-148`). The cookie outlives its JWT by 16 days on the main path | Confirmed by adversarial re-read |
| 2 | Three divergent cookie-attribute policies for the same cookie name: `COOKIE_SETTINGS` in `accounts.ts:19-28`, the nookies write in `getParticipantToken.ts:135-148` (sameSite `lax` vs `none` decided by `NODE_ENV`/`COOKIE_DOMAIN==='127.0.0.1'`), and the next-auth cookie blocks in `[...nextauth].ts:113-125,368-380` | Confirmed |
| 3 | Four independently implemented redirect/host validators sharing no code: `middleware.ts:27-36` (suffix match), `helpers.ts:79-85` (exact match), the two `redirect` callbacks (`[...nextauth].ts:218-221,502-505`, exact match), `apps/lti/src/launchTarget.ts:119-132,162-168` (suffix match against a different host list) | Confirmed |
| 4 | Two divergent context-detection heuristics for the lecturer/participant split: `middleware.ts` (suffix match) vs `helpers.ts:87-154` (exact match) — same decision, different logic, maintained separately | Confirmed |
| 5 | Inconsistent verification strictness: response-api checks issuer and requires role+scope (`index.ts:244-261`); backend-docker checks neither issuer nor scope (`app.ts:110`); chat checks neither (`apps/chat/src/middleware.ts:49-52`, `apiGuards.ts:21-25`) | Confirmed |
| 6 | The `isPrimary` "one primary per user" invariant exists only as a comment. Migration `20250907162320_participant_sso` *says* a `[userId, isPrimary]` unique constraint "will be added" but its SQL never creates it; neither `Account` nor `ParticipantAccount` enforces it | Confirmed, incl. migration SQL |
| 7 | Two cookie-domain sources that must agree but are never cross-validated: `deriveCookieDomainFromURL(NEXTAUTH_URL)` for next-auth cookies vs the independent `COOKIE_DOMAIN` env var for all other cookies (`packages/util/src/auth.ts:97-112`) | Confirmed |
| 8 | `turbo.json` `globalEnv` is missing seven auth-relevant vars that app code genuinely reads: `NEXTAUTH_URL`, `EDUID_CLIENT_ID`, `EDUID_WELL_KNOWN`, `NEXT_PUBLIC_EDUID_ID`, `AUTH_STUDENT_ALLOWED_HOSTS`, `AUTH_LECTURER_ALLOWED_HOSTS`, `AUTH_PWA_HOSTS` (no `passThroughEnv` compensates) — cache-invalidation gap per the repo's own convention | Confirmed |
| 9 | Dead dependencies: `next-auth@4.24.14` in `apps/backend-docker/package.json:43` (nothing imports it; only cookie-name strings appear) and the legacy `@next-auth/prisma-adapter@1.0.7` in `apps/auth/package.json:14` (only `@auth/prisma-adapter` is imported) | Confirmed |
| 10 | Dead Prisma tables: `Session` and `VerificationToken` have zero non-generated references anywhere; they exist only to satisfy the adapter's type contract under `session.strategy='jwt'` | Confirmed by fresh grep |
| 11 | Orphaned build artifact `packages/util/dist/clientAuth.d.ts`/`.js` with no `src/` counterpart on `v3` (source exists only on other branches; `dist/` is gitignored so stale output survives branch switches) | Confirmed incl. git history |
| 12 | Magic-link rate limiting is an in-memory per-process object (5/hour/identifier, `accounts.ts:207-242`) — resets on restart, not shared across replicas | Confirmed |

## 3. What next-auth actually does in this codebase

### 3.1 The token contract (the thing any migration must preserve)

- One shared HS256 secret (`APP_SECRET`) is distributed to ~12 workloads via Helm (`deploy/charts/klicker-uzh-v2/templates/secret-*.yaml`).
- JWT claim shape: `sub`, `role`, `scope`, `email`, `catalystInstitutional`, `catalystIndividual` (+ `shortname` for lecturers), defined at `packages/util/src/jwt.ts:3-12`.
- Independent verifiers of this JWT, none of which call the auth service: backend-docker (`app.ts:62-119`, the GraphQL chokepoint feeding the Pothos `authScopes` layer in `packages/graphql/src/builder.ts:56-111`), response-api (`index.ts:244-261`), chat (`middleware.ts`, `apiGuards.ts`), hatchet-worker-response-processor (`processor.ts:99-114`), frontend-pwa SSR (`getParticipantToken.ts`, `session/[id].tsx:552-557`), lti (mints), olat-api (static API key instead — no JWT).
- Dual transport: httpOnly cookies plus an `Authorization: Bearer` fallback that live-quiz/LTI-iframe contexts depend on (`app.ts:103-105` carries a "DO NOT TOUCH" comment; browser side mirrors `participant_token` into sessionStorage via `useParticipantToken.ts:20-21` and reads it in `apollo.ts:49-58`).

### 3.2 Login flows: nine flows, three via next-auth

| Flow | Via next-auth? | Where |
| --- | --- | --- |
| Lecturer Edu-ID OIDC | Yes (generic OAuth provider, PKCE+state, `claims` request param) | `[...nextauth].ts:242-521` |
| Delegated login (shortname + per-login bcrypt password with scope) | Yes (Credentials provider over the `UserLogin` table) | `[...nextauth].ts:300-358` |
| Participant Edu-ID OIDC | Yes (second config, no adapter, custom linking) | `[...nextauth].ts:49-240`, `helpers.ts:369-521` |
| Participant username/password | No — GraphQL mutation mints JWT directly | `accounts.ts:95-147` |
| Magic link (rate-limited, OTP-scoped 15-min JWT) | No | `accounts.ts:216-338` |
| Account activation (ACTIVATION-scoped 60-min JWT) | No | `accounts.ts:340-379,804-966` |
| Temporary/anonymous participant (2-week JWT, leaderboard row) | No | `accounts.ts:149-205` |
| LTI 1.1 (5-min bridge JWT → GraphQL exchange) | No | `getParticipantToken.ts:76-125` |
| LTI 1.3 (`ltijs` service → 5-min JWT → cookie/query handoff) | No | `apps/lti/src/index.ts:62-119` |

Plus the Discourse SSO handoff, which piggybacks on the lecturer session via `getToken` (`discourse.ts`), and the OLAT API (static `x-api-key`, no user auth).

What next-auth actually provides, then: the Edu-ID OIDC dance twice, CSRF/cookie plumbing for the credentials form, `signIn`/`signOut`/`useSession` on four pages, and one `getToken` call. All the domain-critical logic — participant/user linking, affiliation upserts, invitation auto-accept, catalyst flag computation, context detection, redirect validation, participant liveness invalidation (`[...nextauth].ts:175-188`, participant config only; the lecturer config has no equivalent check) — is repo-owned callback code, portable to any framework or to none.

### 3.3 Schema reality

- `Session` and `VerificationToken` are dead weight (§2.3 #10).
- `Account` is a repurposed adapter table: originally a bespoke SSO-link table, converted to the NextAuth shape in migration `20230726183803_next_auth_users`, then extended with `isPrimary`/`isVerified`/`type` in `20250907162320_participant_sso`. `createUserAffiliations` (`helpers.ts:276-313`) writes non-OAuth rows (`type='affiliation'`, no tokens) into it via plain Prisma upserts, bypassing the adapter. These rows are load-bearing outside auth: `apps/olat-api/src/services.ts` resolves course permissions against them at three call sites (L15, L80, L201).
- `UserLogin` is multi-row-per-user, one bcrypt password and one `UserLoginScope` per row — no equivalent concept in any auth library's schema.
- `Participant`/`ParticipantAccount`/`ParticipantInvitation` are an entirely parallel identity system with its own uniqueness semantics (`@@unique([email, isSSOAccount])` allows the same email to exist as both an SSO and a manual account; SSO participants receive an unguessable random bcrypt password, `helpers.ts:453-467`).

### 3.4 Test coupling

Both E2E suites authenticate primarily by **forging** an HS256 JWT with `APP_SECRET` and planting it as a cookie — they exercise the real login UI only for student password login. Cypress: `loginFactory` plus ~8 persona commands (`commands.ts:132-293`). Playwright: `authSession.ts`, `fixtures.ts:138-342`, plus `O-live-quiz.spec.ts` forging all four cookie types and `chat.ts` minting a bare-`sub` participant token. This seam works only because the session cookie value is a self-contained JWT verifiable with a known secret. Any migration that changes the cookie's encoding rewrites ~10 fixture functions and touches every spec that uses them.

## 4. Better-auth evaluation

### 4.1 Vitals (verified against npm/GitHub, 2026-08-10)

MIT license. Stable 1.x since 2024-11-23; `latest` 1.6.25 (2026-07-23); 1.7 at rc.2. ~29.4k stars, 641 open issues, actively maintained (pushed same day as this review). Strategically ascendant: since 2025-09-26, Auth.js/next-auth is officially maintained by the better-auth team, receives security/critical fixes only, and the team recommends better-auth "as the best way forward for most teams" (nextauthjs discussion #13252 — verified verbatim).

### 4.2 Requirement fit (corrected after adversarial verification)

| Requirement (current mechanic) | Better-auth verdict | Notes |
| --- | --- | --- |
| OIDC from `wellKnown` URL, PKCE+state | Supported (genericOAuth plugin: `discoveryUrl`, `pkce`) | Solid |
| `claims` authorization request parameter (Edu-ID's `swissEduPersonUniqueID` etc.) | Possible via generic `authorizationUrlParams` — no dedicated `claims` option | Historical reliability caveat: the function form silently didn't fire in v1.4.5; both issues (#4453, #6486) are now **closed** (fix shipped via PRs #4919/#4925), but a user still reported interference with the userinfo call in 2026-03. Needs a spike against real Edu-ID, not blind trust |
| Reading non-standard id_token claims | Possible: custom `getUserInfo(tokens)` decoding `tokens.idToken` yourself | Documented escape hatch |
| **Session cookie = own HS256 JWT, own claims/issuer, verified offline by 7 services** | **Not supported.** Primary session token is an opaque DB/secondary-storage-backed string; no `jwt:{encode,decode}` equivalent exists | The decisive collision. Verified against docs first-hand |
| Third-party-verifiable JWT at all | Partially: (a) the `jwt` plugin issues a separate JWT (custom `sign` function allowed, JWKS endpoint) but is explicitly "not meant as a replacement for the session" and is delivered via endpoint/header, not as the session cookie; (b) `cookieCache` with strategy `jwt` writes a *second* `session_data` cookie that the docs mark interoperable/third-party-verifiable | **Correction over the initial research**: the docs do endorse the cookieCache JWT for external verification. However it is a *cache cookie alongside* the opaque token (not the session), has a better-auth-internal claim shape without documented claim/issuer remapping, and would still require rewriting the middleware of all seven consumers plus both test seams to a new cookie name and claim shape. It narrows the gap; it does not close it |
| Custom cookie names + cross-subdomain domain | Supported (`advanced.cookies`, `crossSubDomainCookies`) | — |
| Two user types, two session cookies, two user tables in one app | Undocumented; would be two `betterAuth()` instances with distinct `basePath`/`cookiePrefix`/`modelName` | No validated recipe found anywhere; per-request instantiation safety (module-level caches) unverified |
| Credentials against multi-row `UserLogin` with per-row scope | Not natively (assumes one password in one `account` row); possible via a custom plugin endpoint that creates the session manually | The magic-link plugin demonstrates the internal pattern |
| Map to existing Prisma schema | Renaming/extending supported (`modelName`, `fields`, `additionalFields`); a *structurally different* model is not | Issue #1435 (pluggable adapter for non-1:1 schemas) closed unresolved (`not_planned`, bot-staled). The affiliation rows inside `Account` would collide with better-auth's account queries — it would need its own account table, splitting `Account` in two |
| Pages Router + Express | Supported (`toNodeHandler`, documented for both) | — |
| Client `useSession`/`signIn`/`signOut` | Supported (`createAuthClient`, no provider needed) | — |

### 4.3 What better-auth would add

Fairly stated: an actively developed core instead of a maintenance-mode one; built-in rate limiting (replacing the in-process object in `accounts.ts`); admin plugin with impersonation and session revocation (replacing the hand-rolled `impersonateAssessmentParticipant.ts` script); server-side session revocation generally (impossible with pure stateless JWTs today); 2FA, passkeys, organizations, OIDC-provider mode, multi-session. None of these require replacing the session mechanism; revocation is the only one that inherently implies stateful sessions.

### 4.4 Migration shape and cost, if it were done

1. Schema phase: introduce better-auth's `session`/`verification` tables (or Redis secondary storage), split OAuth accounts from affiliation rows (new table or `modelName` remap), map `User` fields, decide participant-side modelling (better-auth has no participant concept — either a second instance over `Participant` or keep participants fully custom, which re-creates today's asymmetry).
2. Dual-run phase: mount better-auth alongside next-auth; teach all seven consumers to accept both the legacy JWT and the new session mechanism (either better-auth's `session_data` JWT cookie with new claim mapping, or a shim writing the legacy JWT alongside — the latter means running two session systems indefinitely).
3. Flow migration: Edu-ID lecturer, Edu-ID participant (custom linking logic ports into hooks/`getUserInfo`), delegation login as a custom plugin endpoint; the six non-next-auth flows either stay as-is (perpetuating the split) or also move (much larger scope).
4. Test migration: rewrite ~10 forging fixtures across both suites plus dependent specs, or build a test-only session-minting seam against better-auth's DB.
5. Cutover: session invalidation for all active users unless the dual-accept shim is kept through a full session-lifetime window.

Realistic effort: 3–6 weeks with the highest-blast-radius regression profile in the codebase (auth has had 91 non-release commits in 18 months — an actively moving target), plus permanent divergence risk while flows 4–9 remain outside the framework. Unknowns that would each need a spike first: two-instance recipe, cookieCache claim customization, `authorizationUrlParams` against real Edu-ID.

## 5. Alternatives

### 5.1 Stay on v4, patched (baseline)

Cost: one dependency bump now, plus vigilance. Residual risk: maintenance-mode project (security fixes are still shipping — four advisories patched 2025-10 through 2026-07); the open, maintainer-untouched React 19 `SessionProvider` crash (#12757) is a latent constraint on future React upgrades in `apps/auth`; each future advisory is a manual patch cycle. Verified: v4 declares `next ^15` (since ≤4.24.9) and `react ^19` (since 4.24.11) peer support.

### 5.2 Auth.js v5

Still beta after 3+ years (5.0.0-beta.32, 2026-07-20; never tagged `latest`; no committed timeline — discussion #13382 has zero maintainer replies). It *does* still support custom `jwt.encode`/`decode` and the Pages Router (verified against authjs.dev reference docs), so the KlickerUZH architecture would port. But it is the sunset branch of a project whose own maintainers now recommend their other product, and the migration touches every `getToken`/session call for near-zero functional win. Not recommended.

### 5.3 Replace next-auth with `openid-client` (recommended path off next-auth, when desired)

`openid-client@6.8.4` (2026-04-27, panva — same author as the `jose` already in `packages/util`). Verified API: `discovery()`, PKCE helpers, `buildAuthorizationUrl()` (accepts arbitrary parameters, so the Edu-ID `claims` parameter passes through generically), `authorizationCodeGrant()` with internal state/PKCE/id_token validation, and a `claims()` reader exposing arbitrary id_token claims — every Edu-ID requirement, first-class.

What would be built (all in `apps/auth`, nothing outside it changes):

| Piece | Replaces | Size |
| --- | --- | --- |
| Two explicit route pairs (lecturer signin/callback, participant signin/callback) doing the OIDC dance and short-lived state/PKCE cookies | The `[...nextauth]` catch-all, the per-request config dispatch, `getAuthContext`, and most of the middleware's redirect-cookie machinery — separate callback paths make context detection structural instead of heuristic | ~150–250 lines total |
| Credentials POST endpoint with CSRF protection, reusing the existing `UserLogin` bcrypt loop verbatim | next-auth Credentials provider + its CSRF plumbing | ~50 lines |
| Session read endpoint + tiny client hook for the four auth pages | `SessionProvider`/`useSession`/`signIn`/`signOut` | ~50 lines |
| Logout route clearing cookies | `signOut` | trivial; GraphQL logout already writes cookie-clearing values (`accounts.ts:31,389`) |
| Discourse: verify the cookie with `verifyJWT` directly | `getToken` | one-line change |

What stays byte-identical: the JWT contract, both cookie names, all seven consumer services, both E2E test seams, the Prisma schema (with the option to *drop* `Session`/`VerificationToken` and the adapter later), and all domain callback logic (`createOrLinkParticipant`, `createUserAffiliations`, invitation auto-accept move from callbacks into the new callback routes unchanged). Cutover invalidates zero sessions. It also removes the two dead next-auth-shaped risks (provider-unbound PKCE cookies, `getToken` DoS class) rather than patching them.

Effort: ~3–5 focused days plus staging validation of both Edu-ID contexts. Risk: the team owns the OIDC dance's security (state/PKCE storage, redirect validation) — mitigated by the fact that the team already owns redirect validation in four places today, and `openid-client` is the reference implementation for exactly this dance. Trade-off to name honestly: this is the "own more, depend less" direction; it removes framework updates as a safety net for the login flow itself.

## 6. Comparison

| | Stay v4 (patched) | Auth.js v5 | openid-client | better-auth |
| --- | --- | --- | --- | --- |
| Effort | ~1 h | days, low value | ~1 week | 3–6 weeks + spikes |
| Session invalidation at cutover | none | none | none | yes, unless dual-run shim |
| Downstream services touched | 0 | 0 | 0 | 7 |
| Test suites touched | 0 | 0 | 0 | both, ~10 fixtures + specs |
| Schema changes | 0 (may drop 2 dead tables anytime) | 0 | 0 (may drop 2 dead tables + adapter) | substantial |
| Library trajectory | maintenance-only | beta, sunset branch | reference impl., active | active, growing |
| New capabilities | none | none | none | rate limiting, revocation, admin, 2FA, passkeys… |
| Fit with existing token architecture | native | native | native | inverted |

## 7. Recommendation and sequencing

1. **Now:** bump `next-auth` to 4.24.15 in `apps/auth`; remove the dead `next-auth` dep from `apps/backend-docker` and the legacy `@next-auth/prisma-adapter` from `apps/auth`. Smoke-test one Edu-ID login on staging.
2. **Now (verification):** confirm the missing-`exp` finding (§2.2) against a staging-minted cookie; if confirmed, ship the one-line `expiresIn` fix and decide a rotation-friendly window.
3. **Soon (1–2 days):** the custom-layer cleanup backlog (§2.3): unify the four host validators and two context heuristics, align the three `participant_token` lifetimes/policies, add issuer checks to backend-docker/chat, add the missing `turbo.json` `globalEnv` entries, delete the orphaned `dist/clientAuth.*`, optionally drop `Session`/`VerificationToken`.
4. **When leaving next-auth is wanted:** the `openid-client` replacement (§5.3) as a normal planned change with staging validation.
5. **Better-auth:** revisit only as a deliberate platform decision to consolidate all nine flows and adopt stateful, revocable sessions — a real project with a real payoff, contingent on spiking the two-instance pattern, the Edu-ID `claims` parameter, and the schema split first.

## 8. Open questions for the maintainer

1. Is server-side session revocation (the one capability that genuinely requires a stateful session model) a roadmap need? If yes, the better-auth calculus improves and the spike list in §7.5 becomes worth funding.
2. Are 2FA/passkeys for delegated (non-Edu-ID) lecturer logins on the roadmap? Same effect.
3. Should the §2.3 cleanup land as one hygiene PR or be folded into ongoing auth work?

## Appendix A — Verification levels

- **Level 1 (first-hand, main session):** npm packuments (next-auth, better-auth, openid-client, oauth4webapi), GitHub security advisories API, next-auth 4.24.15 release notes, better-auth JWT plugin docs, repo files `[...nextauth].ts`, `helpers.ts`, `jwt.ts`, `middleware.ts` (partial), package.json/turbo/Helm greps.
- **Level 2 (adversarially verified):** all 33 repo claims re-read against source by an independent agent (30 confirmed, 3 corrected); 13 external claims re-checked against primary sources by a second independent agent (9 confirmed, 4 corrected).
- **Level 3 (reported, plausible, unverified):** community migration anecdotes; better-auth two-instance production viability; per-request `betterAuth()` instantiation safety; the "two engineer-weeks typical migration" figure circulating in secondary sources (explicitly unconfirmed — its purported source does not contain it).

## Appendix B — Corrections produced by the verification pass

| Original claim | Correction |
| --- | --- |
| `apollo.ts:49-58` "mirrors" the participant token into sessionStorage | It only reads; the write lives in `useParticipantToken.ts:20-21` |
| LTI cookie policy differs in `sameSite` only | It also sets a 13-day `maxAge` — a third distinct lifetime for the same cookie |
| Magic-link rate limiter is an in-memory `Map` | Plain object literal; behaviour as described |
| better-auth cookieCache JWT "not intended for third-party verification" | Docs mark the `jwt` strategy interoperable and recommend it for external verification; the narrower caveat (no standard `iss`/`aud`, internal shape) comes from a support-bot comment, not the docs. Session cookie remains opaque regardless |
| genericOAuth `authorizationUrlParams` issues #4453/#6486 "open historical bugs" | Both closed — #4453 fixed via PRs #4919/#4925, #6486 bot-staled; one post-fix user report (2026-03) of residual interference |
| Issue #1435 "closed as stale" | `state_reason: not_planned`; the bot's comment says "stale". Closed without resolution either way |
| next-auth v4 declared `next ^15` + `react ^19` "since 4.24.11" | `next ^15` was already declared by 4.24.9; 4.24.11 added `react ^19` |

## Appendix C — Primary sources

- GitHub advisories API for nextauthjs/next-auth (GHSA-xmf8-cvqr-rfgj, GHSA-x445-f3h2-j279, GHSA-7rqj-j65f-68wh, GHSA-5jpx-9hw9-2fx4); next-auth 4.24.15 release notes; npm packuments for next-auth (dist-tags, 4.24.x timeline), better-auth (1.6.25, MIT), openid-client (6.8.4), oauth4webapi (3.8.6).
- nextauthjs discussions #13252 (Auth.js joins Better Auth), #13382 (v5 timeline); issue #12757 (React 19 SessionProvider, open).
- better-auth docs: session-management, cookies, database, generic-oauth, jwt, admin, oidc-provider, rate-limit; issues #1435, #4453, #6486; discussion #7672.
- authjs.dev: migrating-to-v5, reference/core/jwt (encode/decode overrides).
- openid-client docs: buildAuthorizationUrl, authorizationCodeGrant, TokenEndpointResponseHelpers.claims.
