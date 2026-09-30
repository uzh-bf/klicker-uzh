# CHIPS + sessionStorage iframe-auth rollout (chat → PWA → shared)

## Overview

Make Klicker tools (chat first, PWA second) reliably authenticate inside third-party iframe contexts (LMS launches into an iframe), and consolidate the duplicated logic that grew in chat and PWA into a small shared surface in `@klicker-uzh/util`.

Scope is bounded to authentication carriers (`chat_participant_token`, `participant_token`) and the iframe-aware fallback used when third-party cookies are blocked. No changes to LTI launch protocol, LMS configuration, or token contents.

## Context

Three converging facts force this work:

1. Modern browsers increasingly block third-party cookies in iframe contexts. Safari ITP (since 13.1) blocks all third-party cookies; Firefox Total Cookie Protection partitions them; Chrome rolls out Tracking Protection to user cohorts; Brave blocks by default. `SameSite=Lax` cookies are never sent in iframe contexts at all; `SameSite=None; Secure` is sent only when the browser permits third-party cookies for the partition.
2. The CHIPS (`Partitioned`) cookie attribute lets a browser keep the cookie keyed by the top-level site, so LMS-A and LMS-B see independent cookie jars for the same Klicker subdomain. Supported in Chrome 114+, Edge 114+, Firefox 141+, Safari 26.2+. Pre-CHIPS browsers still need a fallback.
3. UZH's primary LMS (OpenOLAT) does not implement the LTI 1.3 Platform Storage spec (`lti_storage_target` postMessage), confirmed by source-tree search of `OpenOLAT/OpenOLAT`. The cookieless-OIDC route is therefore unavailable; we must rely on cookies + a sessionStorage fallback.

The chat app shipped a CHIPS-plus-sessionStorage path in commit `41dc58e76` on the LTI Phase A branch. PWA already has an analogous (older) sessionStorage path used by practice-quiz iframe embeds; PWA's cookie still uses `SameSite=None` without `Partitioned`. The shapes drifted because each app evolved independently.

## Progress (claude/condescending-swartz-993a42)

**Done**
- Chat: `chat_participant_token` set with `Partitioned; Secure; SameSite=None` in production.
- Chat: `lti-token` probe in `/auth/lti` → if probe cookie was stripped by the LMS iframe, redirect target gets `?_t=<chatGuestToken>` appended.
- Chat: `useChatGuestTokenBootstrap` stuffs the URL token into sessionStorage and removes the query via `router.replace`.
- Chat: `authedFetch` wrapper attaches `Authorization: Bearer` from sessionStorage to all internal `/api` calls (settingsStore, useChatResponse, assistant disclaimer, apiCall).
- Chat: middleware + `apiGuards.getParticipantId` accept `Authorization: Bearer` and `?_t=` for both guest and account paths.
- Chat: `/noLogin` self-heals on full reloads via `NoLoginSelfHeal` client component.
- Vitest coverage for `authedFetch` header attachment + pass-through.
- Verified locally: `Partitioned` flag is accepted by Next 15.3 `cookies.set` typings (`@edge-runtime/cookies` `CookieListItem` includes `partitioned`).

**Remaining (this plan)**
- Validate chat CHIPS path in real browsers (staging deploy + Chrome Tracking Protection, Safari ITP, Firefox 141+).
- Apply CHIPS to PWA's `participant_token`.
- Consolidate the duplicated helpers into `@klicker-uzh/util` so the next embed never reimplements them.

## Goals

1. PWA's `participant_token` works reliably in third-party iframe contexts on the same browser matrix as chat (Chrome 114+, Edge 114+, Firefox 141+, Safari 26.2+).
2. PWA's existing sessionStorage fallback path survives unchanged for the long tail of older browsers.
3. `extractBearerToken`, the `lti-token` probe semantics, and the cookie-security-options shape are imported from `@klicker-uzh/util` rather than duplicated in chat and PWA.
4. The browser-side primitive that turns a sessionStorage entry into an `Authorization` header is a single function; chat continues to use it via `authedFetch` and PWA's Apollo `authLink` calls into the same primitive.
5. No behavioral change for users on cookie-friendly first-party flows.

## Non-goals

- LTI 1.3 Platform Storage / cookieless-OIDC implementation. Out of scope until OpenOLAT ships the platform iframe; tracked only as a watch-item against `track.frentix.com/issue/OO-5204`.
- Storage Access API (`document.requestStorageAccess`). Not viable for LMS-only users with no prior first-party visit.
- Unifying the URL handoff query key between chat (`_t`) and PWA (`participantToken`). Different existing surfaces; PWA's key may appear in LMS deep-links and bookmarks. Each app keeps its own query-key constant.
- Sharing the React hooks themselves. Chat is App Router (`next/navigation`), PWA is Pages Router (`next/router`). Pure helpers shared; framework integration stays per-app.
- Any change to the LTI launch redirect flow in `apps/lti`. The `lti-token` probe cookie remains the signal both apps already rely on.
- Migrating chat's `_t` query key to the shared `participantToken` name. Risk of breaking the JWT-handoff that just landed.

## Current state (relevant code)

### Chat (just landed)

- `apps/chat/src/app/auth/lti/route.ts` — sets `chat_participant_token` with `partitioned: isProduction; sameSite: isProduction ? 'none' : 'lax'`, probes `lti-token`, conditionally appends `?_t=` to redirect target.
- `apps/chat/src/middleware.ts` — accepts cookie, `?_t=` query, or `Authorization: Bearer`. Inline `extractBearerToken` regex helper.
- `apps/chat/src/lib/server/apiGuards.ts` — same triple-source `getParticipantId`. Inline copy of `extractBearerToken`. Fails closed when `APP_SECRET` is missing.
- `apps/chat/src/hooks/useChatGuestTokenBootstrap.ts` — App Router hook reading `useSearchParams()`, writing sessionStorage, calling `router.replace` to strip `_t`.
- `apps/chat/src/lib/client/authedFetch.ts` — gates on `typeof sessionStorage !== 'undefined'`, attaches `Authorization` if a token is stored, never overwrites a caller-provided header.
- `apps/chat/src/components/NoLoginSelfHeal.tsx` — runs on `/noLogin`, reads sessionStorage, redirects to original page with `?_t=` appended when applicable.
- Sites wired through `authedFetch`: `apiCall` (`lib/api/types.ts`), `settingsStore.loadModeOptions`, `settingsStore.loadCredits`, `useChatResponse` POST, `assistant.tsx` disclaimer GET/POST.

### PWA (existing baseline)

- `apps/frontend-pwa/src/lib/getParticipantToken.ts` — server-side getServerSideProps helper. Sets `participant_token` cookie with `secure: isProduction; sameSite: isProduction ? 'none' : 'lax'` (no `Partitioned`). Probes `lti-token` via `nookies` to derive `cookiesAvailable`. Passes the participant token as a prop when cookies failed.
- `apps/frontend-pwa/src/lib/useParticipantToken.ts` — Pages Router client hook. Uses sessionStorage `'participant_token'`. On fallback path appends `?participantToken=` to subsequent navigations.
- `apps/frontend-pwa/src/lib/apollo.ts` — Apollo `authLink` set via `setContext`, reads `sessionStorage.getItem('participant_token')`, attaches `Authorization: Bearer ${token}` header. Server-side: forwards `req.headers.cookie`.
- `apps/frontend-pwa/src/pages/course/[courseId]/practiceQuizzes/[id].tsx` — embedded quiz, reads `participantToken` via `getParticipantToken`, uses `useParticipantToken`. PostMessage logic exists for parent-iframe quiz state telemetry only (not auth).
- Several pages call `useParticipantToken({ participantToken, cookiesAvailable })` with the same shape.

### Shared today

- `@klicker-uzh/util/src/jwt.ts` — `signJWT`, `verifyJWT`, `decodeJWT`. Used by chat `verifyLtiToken` and PWA inline.
- `@klicker-uzh/util/src/auth.ts` — `parseCookiesHeader`, `parseCsvHosts`, `deriveCookieDomainFromURL`, `extractProviderFromAffiliationId`, `reduceCatalyst`, `generateRandomString`.

## Plan

The work splits into three tiers. Tier 1 is required and lands first. Tier 2 lands together with the PWA CHIPS migration. Tier 3 is a follow-up cleanup with no blocking dependency.

### Tier 1 — pure helpers in `@klicker-uzh/util`

Adds to `packages/util/src/auth.ts` and re-exports through `index.ts`:

| Symbol | Shape |
|--------|-------|
| `extractBearerToken(headerValue: string \| null): string \| null` | Trims, matches `^Bearer\s+(.+)$/i`, returns the captured group or `null`. Identical to the regex currently inlined in chat. |
| `LTI_PROBE_COOKIE_NAME` constant | Value `'lti-token'`. The cookie set by `apps/lti/src/index.ts` to detect whether the LMS iframe permits third-party cookies. |
| `cookiesAvailableViaLtiProbe(cookies: Record<string, string \| undefined>): boolean` | Returns `!!cookies[LTI_PROBE_COOKIE_NAME]`. Mirrors PWA's existing predicate at `getParticipantToken.ts:46` and chat's inline check in `/auth/lti`. |
| `cookieSecurityOptions({ isProduction })` | Returns `{ secure: boolean, sameSite: 'lax' \| 'none', partitioned: boolean }`. Production maps to `{ secure: true, sameSite: 'none', partitioned: true }`; dev maps to `{ secure: false, sameSite: 'lax', partitioned: false }`. The boolean inputs match how chat and PWA both currently derive these values from `NODE_ENV` and `COOKIE_DOMAIN === '127.0.0.1'`. |

Chat refactor under Tier 1:
- Replace the two inline `extractBearerToken` helpers in `middleware.ts` and `apiGuards.ts` with the imported one.
- Replace the inline `req.cookies.get('lti-token')` check in `/auth/lti` with `cookiesAvailableViaLtiProbe`.
- Optionally collapse the inline `isProduction` plus `secure/sameSite/partitioned` literals at the cookie-set site into `cookieSecurityOptions`.

PWA refactor under Tier 1:
- Replace `!!cookies['lti-token']` at `getParticipantToken.ts:46` with `cookiesAvailableViaLtiProbe(cookies)`.
- Replace the manual `secure: ... && ...; sameSite: ... ? 'lax' : 'none'` literals at `getParticipantToken.ts:140-148` with `cookieSecurityOptions({ isProduction })`. This is also the moment to add `partitioned: true` for production — see Tier 2.

Both refactors are mechanical, behavior-preserving, and verifiable with vitest + typecheck.

### Tier 2 — PWA CHIPS migration + browser-side primitives

Lands together with Tier 1's PWA refactor. Goal: PWA's `participant_token` becomes `Partitioned` in production, and the duplicated sessionStorage-to-Authorization-header pattern is consolidated.

Adds to `packages/util/src/clientAuth.ts` (new file, browser-only):

| Symbol | Shape |
|--------|-------|
| `getStoredAuthToken(key: string): string \| null` | Safe read from `globalThis.sessionStorage` with a `try/catch` for environments that throw on access (private mode, sandboxed contexts). |
| `createAuthedFetch(key: string): typeof fetch` | Factory returning a fetch wrapper. Chat's existing `authedFetch` becomes a thin re-export that calls the factory with `'chat_participant_token'`. |
| `bootstrapTokenFromUrl(searchParams: URLSearchParams, opts: { storageKey: string, queryKey: string }): URLSearchParams \| null` | Pure function. Returns the stripped `URLSearchParams` if the query parameter was present and the token was stored, else `null`. The framework hook (chat App Router or PWA Pages Router) is responsible for calling `router.replace` with the stripped params. |

Chat refactor under Tier 2:
- `apps/chat/src/lib/client/authedFetch.ts` becomes `export const authedFetch = createAuthedFetch('chat_participant_token')`.
- `useChatGuestTokenBootstrap` keeps its hook shell but delegates the work to `bootstrapTokenFromUrl`.

PWA refactor under Tier 2:
- `getParticipantToken.ts` cookie-set call: add `partitioned: true` for production via `cookieSecurityOptions`. Document the change in the PWA changelog so deployments know to expect a `Partitioned` cookie in `Set-Cookie` headers (some logging/CDN configurations strip unknown attributes).
- `apollo.ts` `authLink`: replace the inline `sessionStorage.getItem('participant_token')` with `getStoredAuthToken('participant_token')`. Behavior-preserving on browsers; cleaner SSR boundary because the helper handles the `typeof sessionStorage` gate uniformly.
- `useParticipantToken.ts` (Pages Router hook): retains its shape but uses `bootstrapTokenFromUrl` for the URL→sessionStorage step. The Pages Router redirect-with-query-param logic stays per-app because PWA chains `router.push` with a different ergonomics than chat's `router.replace`.

Validation surface for Tier 2 grows: must verify both chat (already partial) and PWA flows on the same browser matrix.

### Tier 3 — `verifyLtiToken` consolidation (deferred)

Move chat's `verifyLtiToken` from `apps/chat/src/lib/server/ltiGuest.ts` into `packages/util/src/lti.ts`. Export `LtiTokenPayload`, `LtiScope`, and the `APP_ORIGIN_LTI` production-guard. PWA's inline `verifyJWT(token, APP_SECRET)` at `getParticipantToken.ts:60` migrates to call the typed helper, gaining issuer enforcement automatically.

Why deferred: only two consumers today, and they have subtly different needs (PWA accepts both `LTI1.1` and `LTI1.3` in different code branches; chat is `LTI1.3` only). Designing the right API requires a third caller's pressure or a forced refactor. Move-when-it-stops-changing.

If a third LTI-consuming app is introduced (e.g., a new tool sitting alongside chat and PWA), Tier 3 becomes the natural place to centralize JWT contract.

## Validation strategy

Tier 1 is mechanical and validated by vitest + typecheck only. No behavioral change.

Tier 2 requires browser validation across the iframe matrix.

### Browser matrix

| Browser | First-party | Iframe (third-party blocked) | Iframe (third-party allowed) |
|---------|-------------|-------------------------------|------------------------------|
| Chrome 114+ | cookie | `Partitioned` cookie | `Partitioned` cookie (browser will pick the partition) |
| Edge 114+ | cookie | `Partitioned` cookie | `Partitioned` cookie |
| Firefox 141+ | cookie | `Partitioned` cookie (Total Cookie Protection partitions automatically) | same |
| Firefox <141 | cookie | sessionStorage fallback (`?_t=` for chat, `?participantToken=` for PWA) | depends on user permission |
| Safari 26.2+ | cookie | `Partitioned` cookie | `Partitioned` cookie (ITP partitions) |
| Safari <26.2 | cookie | sessionStorage fallback | depends on user permission |
| Brave / lock-down | cookie | sessionStorage fallback | sessionStorage fallback |

### Test scenarios (chat first, then PWA)

- LTI launch in same-tab top-level (`OpenOlat: Open in new window`): cookie path; verify `Partitioned` flag present in `Set-Cookie`; no `?_t=` query ever appended.
- LTI launch in iframe with third-party cookies allowed: same as above.
- LTI launch in iframe with third-party cookies blocked (Chrome Tracking Protection on, Safari ITP, Firefox <141 strict mode): `lti-token` probe missing → fallback path; `?_t=` (or `?participantToken=` for PWA) appears in the redirect target; bootstrap stuffs sessionStorage and replaces URL; `Authorization: Bearer` shows on subsequent fetches; reload triggers `/noLogin` → self-heal returns to chatbot.
- API-only flow with no cookie and no sessionStorage: middleware redirects to `/noLogin`; user must re-launch from LMS.
- Cross-LMS isolation: launching the same chatbot from two different LMS top-level sites with `Partitioned` cookies produces two distinct browser cookie jars; the per-`(ltiSub, courseId)` HMAC already produces distinct guest personas in DB; observe both partitions in DevTools.

### Tooling

`agent-browser` exercises Scenarios 1, 4, 5 in headless Chrome with Tracking Protection toggled on. Use `--storage-state` to seed iframe contexts. For Safari and Firefox, manual smoke tests in real browsers.

For automated CI: extend the chat vitest suite with a fake-cookie / fake-sessionStorage pair to cover middleware → API guard → fetch wrapper round-trip without an actual browser.

## PR breakdown

Three PRs, sequenced.

### PR-A: Tier 1 helpers + chat refactor (no PWA changes)

Smallest risk. Changes confined to `packages/util` and `apps/chat`. Behavior-preserving.

Files touched:
- `packages/util/src/auth.ts` — adds the four Tier 1 symbols.
- `packages/util/src/index.ts` — re-exports.
- `packages/util/src/auth.test.ts` (new) — vitest for `extractBearerToken` and `cookieSecurityOptions`.
- `apps/chat/src/middleware.ts` — imports `extractBearerToken`.
- `apps/chat/src/lib/server/apiGuards.ts` — imports `extractBearerToken`.
- `apps/chat/src/app/auth/lti/route.ts` — imports `cookiesAvailableViaLtiProbe`, optionally `cookieSecurityOptions`.

Verification: chat vitest passes, repository typecheck passes, no functional change in agent-browser walkthrough.

### PR-B: PWA CHIPS migration + Tier 2 helpers

Files touched:
- `packages/util/src/clientAuth.ts` (new) — Tier 2 symbols.
- `packages/util/src/index.ts` — re-exports.
- `packages/util/test/clientAuth.test.ts` (new) — vitest for `getStoredAuthToken`, `createAuthedFetch`, `bootstrapTokenFromUrl`.
- `apps/chat/src/lib/client/authedFetch.ts` — becomes a re-export.
- `apps/chat/src/hooks/useChatGuestTokenBootstrap.ts` — uses `bootstrapTokenFromUrl`.
- `apps/frontend-pwa/src/lib/getParticipantToken.ts` — adopts `cookieSecurityOptions`, sets `partitioned: true` for production.
- `apps/frontend-pwa/src/lib/apollo.ts` — `authLink` uses `getStoredAuthToken`.
- `apps/frontend-pwa/src/lib/useParticipantToken.ts` — uses `bootstrapTokenFromUrl`.

Verification: chat vitest, PWA cypress smoke tests, browser-matrix walkthrough on staging.

A non-blocking concern is reverse-proxy / CDN handling of the `Partitioned` attribute. Some older intermediaries strip unknown cookie attributes. Test against the actual deployment topology (HAProxy ingress in K8s, Traefik in dev) before promoting to production — verify the `Set-Cookie` header arriving in the browser still carries `Partitioned`.

### PR-C: Tier 3 verifyLtiToken consolidation

Optional. Lands when a third LTI consumer materializes or when chat+PWA drift again. No deadline.

## Risks and mitigations

The risks below are ordered by likelihood-times-impact, not by severity alone.

1. **Reverse-proxy strips `Partitioned`.** Some HAProxy and CDN configurations rewrite `Set-Cookie` and drop unknown attributes. If this happens, the cookie still works in non-iframe contexts but silently degrades to non-partitioned in iframes. Mitigation: smoke-test the deployed `Set-Cookie` header (`curl -i ... | grep -i partitioned`) on staging before merging PR-B; document the deployment requirement. The K8s HAProxy ingress and Traefik dev proxy should both pass through unmodified by default; verify.
2. **Browser quirks in Safari 26.2 transition.** Safari just added `Partitioned` support in 26.2. Older patch revisions in 26.0–26.1 may misinterpret it. Mitigation: keep the sessionStorage fallback path live for one full release cycle; do not rely on `Partitioned` being honored as a security boundary on Safari until 26.3+ is in user majority.
3. **Logging surface for `?_t=` query.** Token in URL is captured by Next.js access logs and any reverse-proxy logs at the moment of the redirect. Tokens are 14-day chat-guest JWTs; a leaked token is a session takeover for that guest persona within the partition. Mitigation: confirm log scrubbing rules exclude query parameters named `_t` and `participantToken` (or implement scrubbing if missing); shorten the chat-guest token TTL only after Phase A guest-claim flow lands (Phase C) so we don't cause spurious re-logins now.
4. **PWA query-key collision.** `?participantToken=` is already present in PWA URLs and may appear in LMS deep-links. Changing the key would break those. Mitigation: keep PWA's existing query-key constant; only the implementation moves to `bootstrapTokenFromUrl` (which is parameterized).
5. **Tier 2 hook regressions in PWA.** PWA's `useParticipantToken` interacts with subsequent navigation by appending the query parameter on `router.push`. Refactoring its internals risks breaking that navigation chain. Mitigation: keep the hook's external API unchanged; only swap internals; cypress E2E run before merge.
6. **`@klicker-uzh/util` becoming a kitchen sink.** Adding browser-only code to a util package that already exports server-side primitives invites accidental imports of browser code on the server (and vice versa). Mitigation: split via subpath exports — `@klicker-uzh/util/auth` (universal), `@klicker-uzh/util/client-auth` (browser-only). Configure `package.json` `exports` field accordingly.
7. **CHIPS partition limits.** Chrome enforces 180 cookies per partition / 10 KB total. Klicker only sets one cookie per partition, so the limit is irrelevant today, but worth a comment in the PWA cookie-set site so future maintainers don't add many partitioned cookies without checking.
8. **Cookieless OIDC arrives unexpectedly.** If frentix ships LTI Platform Storage in a future OpenOLAT release, the right path is to migrate to the spec rather than maintain CHIPS + sessionStorage. Mitigation: leave a watch-item link to OO-5204 in this plan; revisit on every OpenOLAT major version.

## Open questions

1. Should PWA's `useParticipantToken` hook also gain a self-heal-on-`/noLogin` companion, or does the existing `participantToken=` chain on every navigation make it unnecessary? Likely unnecessary, but verify by reproducing the chat self-heal scenario in PWA.
2. Should the `cookieSecurityOptions` helper accept a `localhost` override flag, or read `COOKIE_DOMAIN === '127.0.0.1'` itself? Both apps currently derive `isProduction` independently; passing the boolean keeps the helper environment-agnostic. Lean toward boolean parameter.
3. Should chat's `_t` query key be exported as a constant from `@klicker-uzh/util` for cross-tool consistency, or stay app-local? Keeping it app-local prevents accidental cross-coupling; only the helper that consumes the key (`bootstrapTokenFromUrl`) needs to be parameterized.
4. Do we want a runtime-warning hook that logs once when CHIPS is unsupported and the fallback path is taken, so we can measure how many users still need the fallback? Useful telemetry but adds a log line on every fallback launch; revisit after one production cycle.

## Future work

- Detection-driven UX: render a one-time "Continue" prompt before chat loads when `requestStorageAccess()` is available (Storage Access API is unreliable for first-time LMS-only users, but useful for returning users who have visited Klicker first-party). Optional.
- Deprecation watch: when Chrome's Tracking Protection moves from cohort rollout to all-users, update internal docs and re-test the browser matrix. Tracking via `developer.chrome.com/docs/privacy-sandbox/third-party-cookie-phase-out/`.
- LTI 1.3 Platform Storage: revisit when OpenOLAT (`OO-5204` or successor) ships `lti_storage_target`. Replace the cookie-and-sessionStorage path with platform postMessage state to eliminate query-string token handoff entirely.
