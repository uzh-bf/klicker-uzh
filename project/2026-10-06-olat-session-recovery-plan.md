# Shared participant login across tabs

## Approval summary

Approval mode: executable batch. On 12 October 2026 the user replaced the
previous tab-specific identity policy: there is one regular participant login
per browser cookie context; a successful LTI launch overrides an existing login.
The user authorized updating this plan and existing PR, removing the Chat gate
and obsolete implementation, simplification, tests and browser verification.
This section supersedes the previous execution plan, whose record is in Git.

Use the shared HttpOnly participant cookie as the sole regular browser
credential. Remove retained tab tokens and explicit-versus-cookie modes. All
PWA and Chat tabs discard old identity state on login, LTI replacement, logout
or successful account deletion. Chat opens directly. Rejected commands retain
the current session. If cookies cannot be shared, fail closed with guidance to
open Klicker outside the LMS frame rather than retaining another identity.

No account schema, database migration, new dependency or global JWT revocation
is required. Assessment authentication and lecturer authentication remain
separate existing domains. This changes regular participant browser sessions.
No merge, deployment, alert dismissal or reviewer notification is authorized.
Terminal condition: tested and reviewed task branch pushed to existing
[PR #6414](https://github.com/uzh-bf/klicker-uzh/pull/6414), accurate evidence and
screenshots published, exact local runtime stopped.

## Execution details

### Product contract and implementation

The product primitives are participant identity, shared browser session and
course access. A successful login replaces the shared session; LTI is a login,
not a tab-owned session. Course and Chat permissions continue to be evaluated
for the current participant. Cancelled or rejected logout/deletion does not
replace the session. Separate browser profiles are distinct contexts; blocked or partition-only
third-party cookies require top-level recovery.

A non-secret session revision cookie accompanies the HttpOnly credential and
is rotated by successful authentication and session-ending operations. It
contains no token or personal data. Shared browser code binds rendered state
to that revision, checks before authenticated work and on results, and reloads
on change; focus/visibility and a bounded periodic check update idle tabs across
PWA and Chat origins without storing credentials. Requests carry their expected
revision so servers can reject a request whose cookies changed after the UI's
check. Already committed server operations cannot be undone by a later login.
LTI SSR publishes the expected revision so refused cookies cannot silently
continue using the former login. Embedded UI also confirms unpartitioned access
with document.hasStorageAccess before mounting any regular PWA or Chat page,
including anonymous entry points whose layout can query participant identity.
Content waits for the client context check; server-fetched data remains available
for matching-revision hydration. Without shared access, the boundary
offers the original LTI launch in a top-level tab. Do not replay launch parameters when reloading.

Replace the regular PWA session module and simplify Apollo lifecycle management;
retain only old-request/result suppression needed for shared identity changes.
Remove the Chat recovery dialog, translations, explicit-session accessor and
obsolete bearer-priority branches/tests added for tab isolation. Preserve
existing non-browser/assessment authentication contracts. Share the browser
revision helper between PWA and Chat; guard Chat API calls/streams and the
response submission path. Update ADR 0044 and authentication guidance to the
new policy, with superseded behavior available from Git rather than legacy code.

### Revision protocol and failure semantics

`participant_session` is a random, non-secret revision with the same Domain,
Path=/, SameSite, Secure and expiry as the participant cookie, but readable by
JavaScript. Login rotates it; logout/deletion rotates it for the anonymous
state. Existing cookies without a revision bind to the empty revision until
replaced; no credential fallback or legacy code path is introduced.
Browser requests send `x-participant-session` (empty state encoded as `none`).
GraphQL middleware, Chat API guards and response submission return HTTP 409
before execution when a supplied revision differs from the cookie. Missing
headers preserve existing non-browser callers; assessment uses its existing
cookie/bearer path. Response API CORS explicitly permits the new header.
The marker is a consistency check, never an authentication credential.

All LTI consumers, including the redirecting Chat bridge and registration,
confirm the expected revision before exposing protected data or following a
handoff. Ordinary SSR and Chat hydration bind to the originating revision.
An unsuccessful LTI launch blocks its own view and clears the regular session,
as the existing recovery behavior does; it never silently falls back to A.
Rejected logout/deletion retain the session. Concurrent cookie-changing commands
are ordered by their completed Set-Cookie responses: the last completed login
wins, including LTI. Already-dispatched requests and their Set-Cookie effects
cannot be undone by suppressing JavaScript results. Tests cover this ordering
explicitly; no global server revocation or cross-profile guarantee is claimed.
Existing assessment fallback in useParticipantToken and middleware remains;
regular logout retains its existing assessment-cookie expiration behavior.

### Ownership and sequence

Execution mode: standard (runtime model identity is not more specifically
reported than GPT-6). Main owns architecture, cookie/server/client integration,
plan, runtime, delivery and final proof (coupled authentication seam). A bounded
executor owns removal of Chat gate and obsolete copy/domain-document changes.
A second bounded executor revises the existing browser spec after the
contract is frozen. One writer per path; no parallel runtime mutations.

1. Main: cookie revision + cookie-only PWA/Chat session replacement, cleanup of
   obsolete client token code and server bearer precedence; consequential unit
   tests. New shared files only: packages/shared-components/src/utils/participantSession.ts
   and packages/shared-components/src/ParticipantSessionBoundary.tsx, consumed by both
   apps; server revision helpers extend util/src/auth.ts. Tests extend existing
   suites. Commit as one coherent authentication correction.
2. Browser executor: replace tab-isolation browser assertions with shared-identity
   assertions in PA-olat-session-recovery.spec.ts; retain valid launch, rejected
   command and malformed-credential protections. Run targeted units, native
   type/lint/format checks and host browser suite; fix observed failures.
3. Main: simplify entire PR, independent risk/final review, production build,
   real browser EN desktop/DE mobile captures, PR body update and runtime close.

### Delegation map

| Workstream | Owner | Dependencies and acceptance |
| --- | --- | --- |
| Plan, shared session protocol and authentication source | main | Frozen protocol; PWA/middleware/account tests and consumer checks |
| Header gate and translations removal | Aristotle executor | Approved shared-login decision; focused diff, parent checks |
| OLAT browser spec replacement | Zeno executor | Frozen protocol; parent runs browser suite, worker handles test corrections |
| Domain docs, simplification, reviews and delivery | main | Integrated source and browser results; reviewed full PR, updated body, stopped runtime |

Transport seams include Apollo, Chat lib/api/types.ts, components/assistant.tsx,
hooks/useChatResponse.ts and stores/settingsStore.ts, and PWA pages/session/[id].tsx.

### Test portfolio

| Consequential behavior | Obligation | Primary seam / failure |
| --- | --- | --- |
| LTI overrides A with B everywhere | replace/consolidate | Real ltijs + mocked LMS browser launch, two PWA tabs and Chat; stale A UI or requests |
| Ordinary login/logout/deletion shared | extend existing | Browser tabs + GraphQL; rejected command wrongly discards session |
| Old work cannot affect new identity | replace/consolidate | Apollo/fetch unit + browser delayed result; cache/stream leakage or request race |
| Cookies refused | replace/consolidate | Restricted browser context; former identity or tab bearer silently survives |
| Existing auth domains | extend existing | Middleware/account/token suites; assessment or lecturer isolation and non-browser bearer regressions |
| Normal Chat navigation | replace/consolidate | Browser new-tab Chat opens as current participant without dialog |

Run container-native units/typecheck/lint/build; host-only tooling checks and
host Playwright wrapper. Use synthetic fixtures only. Dedicated OLAT configuration
and real OLAT verification limitations remain explicit; hosted CI is separate.
Reuse unaffected evidence only where source and contract have not changed.

## Progress

The shared-login implementation is committed through `00fbf1b11a`. Regular
per-tab token storage, explicit-bearer precedence, the Chat login gate and its
translations/tests are removed. Shared revision checks protect PWA, Chat and
response requests. The direct Chat link is restored. Embedded pages require
unpartitioned cookie access; otherwise the original LTI activity can open in a
normal tab. Assessment and non-browser authentication keep their own contracts.

Planner, simplification, focused risk and integrated source reviews completed.
Accepted corrections bind live-quiz SSR data to the revision, remove redundant
post-deletion logout, reject foreign-origin cookie writes, and declare the Chat
cookie domain in its ConfigMap. Default/staging/production chart rendering
passed. The conservative whole-page mounting boundary also protects anonymous
layouts that query participant identity.

Browser verification found two further application corrections. Rejected-launch
recovery now wins over the revision reload and preserves the locale. Successful
deletion reloads a credential-stripped URL rather than replaying the deleted
account's LTI launch. Both received scoped independent review without blocking
findings. The browser tests observe signed-out state rather than competing with
application redirects; deletion starts in a fresh tab after the logout scenario.
The optional suggestion to strip every successful launch URL immediately remains
outside this correction; deletion and revision reloads already strip credentials.

### Verification

- All 31 PWA unit tests and 15 database-backed GraphQL login/cookie/deletion
  tests passed. PWA type/lint and Playwright type checks passed; lint has thirteen
  existing warnings and no errors. Container formatter and secret checks passed.
- Unchanged-source evidence remains valid: 24 backend tests, 17 Chat guard tests,
  35 repository type-check tasks, lint/dependency/policy checks, and 125 host
  launcher/workflow tests. Chat has 745 combined passing cases and 21 skips after
  a corrected Headers assertion; this is not one clean full-suite run.
- Browser acceptance totals 33 passing cases and seven environment skips
  across five projects. This is combined evidence: the latest full run had
  30 passes, seven skips and three failures; the affected two journeys then
  passed all eight applicable Chromium/Firefox cases (two WebKit skips).
  All four real ltijs launches against the mock LMS passed in the focused run.
- Final PWA production build passed against application source `00fbf1b11a`.
  Its first attempt found duplicate development/production generated types;
  the owned dev process was stopped and generated dev output was moved aside
  before the successful build. No source configuration changed. An earlier
  monorepo build passed 23 tasks. Corrected app bundles plus sequential LTI and
  response-API builds provide the remaining combined build evidence; the
  earlier combined Rollup invocation did not exit and is not claimed as green.
- Real agent-browser captures cover EN desktop and DE mobile signed-out/profile
  states, embedded recovery, malformed launch recovery, refused cookies and the
  restored course Chat link. Login replacement and logout were observed across
  tabs; the direct Chat link opened Chat without a recovery dialog. Synthetic
  screenshots retain their capture revisions and reuse rationale.

The initial five-project matrix had 28 passes, six skips and six failures.
Corrections addressed competing test navigations, deletion replay and WebKit's
local cookie limitation. A subsequent matrix had 30 passes, seven skips and
three failures: one transient devrouter container-inventory error during local
LTI registration and two deletion-scenario navigations racing the preceding
logout redirect. The affected journeys passed their focused rerun after isolating deletion
in a fresh tab. Earlier tab-isolation browser results do not count toward the
shared-login contract.

The seven WebKit cookie-dependent journeys cannot be completed on this local
`.localhost` stack: the shared revision is not consistently readable although
the API may receive cookies, resulting in HTTP 409. Its remaining quiz journey
checks refusal and records skipped submission steps. Other restricted contexts
also record refused-cookie steps without claiming quiz attribution there.
The four Chromium/Firefox projects exercise the real ltijs service against a
synthetic LMS. Real OLAT and production acceptance remain unverified.

### Runtime and delivery

Git and host process access are restored. Startup was blocked by a devrouter
Compose hash mismatch: Compose resolves `network_mode: service:app` to the exact
container identity before hashing. A narrowly reviewed local repair preserves
full hash validation and passed 177 tests plus native checks. Canonical stop
cleared the uncertain lifecycle state. The guarded bootstrap helper verified
marked disposable databases, prepared dependencies and seeded synthetic data.
The full routed runtime now passes app and route readiness checks. No global
CLI/configuration replacement or retained volume/container deletion was needed.

Runtime release uses canonical stop on the exact implementation and verification
checkouts, followed by provider-state and route readback. The local runtime
report records the final state; retained data and worktrees remain preserved.

The existing PR remains the delivery target, as explicitly requested. The
cohesive authentication contract crosses PWA, Chat and API boundaries; no new
stack topology is introduced. Packaging remains approximately 62 files against
v3, dominated by authentication regression coverage. Obsolete tab-session code
and its tests were removed rather than retained as a second login mode. Hosted CI, CodeQL disposition and
the required public final review remain outstanding merge gates. Do not poll
CI or trigger the final review before the user reports the required conditions.
No merge, deployment, human review request or CodeQL state change is included.

## Review corrections — 2026-10-13

The follow-up review of `9cc4bd996e` identifies two accepted recovery defects.
This correction keeps the approved shared-cookie policy and existing PR.
Execution mode remains standard. The main session owns the accepted-launch
boundary, browser verification and integration; a bounded executor owns the
Chat bridge's participation-error metadata.

1. After the boundary confirms the expected replacement revision and shared,
   unpartitioned cookies, use a shallow Pages Router replacement to remove
   launch parameters without a second exchange. Refused-cookie recovery retains
   the original handoff. Verify a real expired handoff followed by refresh,
   unchanged B identity/revision, and a second open tab.
2. Preserve `sessionRevision` and `sessionEstablished` on the Chat bridge's
   participation-error props. Verify an actual failed participation check after
   a valid exchange with replacement Set-Cookie headers withheld, while A's
   cookie remains readable. Only cookie recovery may mount.
3. Repair the translation probe's assumption that protected page children
   render on the server. Its disposable production build mounts the same
   shared hook directly under the existing intl provider, outside the cookie
   boundary; production application behavior remains gated.
4. Harden the cookie parser's dictionary against prototype-shaped property
   names, addressing the two concrete property-injection annotations. Keep
   JWT verification and strict explicit-launch validation unchanged.

The new browser regressions cover the page/boundary seam directly. An attempted
unit test importing the full page graph required unsupported design-system
CommonJS exports and duplicated those regressions with an HTTP stub; it was
removed instead of expanding the test harness.

A one-time inspection of the reported terminal CI runs confirms failed browser,
translation and deployment-parity checks. Further polling remains withheld.
The Chat ConfigMap's `COOKIE_DOMAIN` is required by the shared-cookie origin
check; removing it or weakening deployment parity is not a resolution. Aligning
release branches requires the normal authorized integration sequence.
CodeQL reports the missing historical `language:javascript` category while the
current workflow publishes `language:javascript-typescript`; its source is
identical to current `origin/v3`. Alert 1091 is the
existing backend rate-limit finding from 2025; alert 3499 concerns the bearer
selection branch, after which every selected credential still passes JWT
verification. Neither is dismissed by this change. No CodeQL alert state or
required public final-review state is changed.

### Browser and CI follow-up

Firefox exposed an old-document reload racing the incoming LTI navigation after
its response had replaced the cookie. The boundary now suppresses that redirect
once `beforeunload` starts and resets on `pageshow`; request guards still reject
stale work. Both Firefox expiry-refresh regressions pass. The full matrix then
passed 41 cases with nine WebKit environment skips and no failures; the later
Chat layout correction requires its own focused re-verification.

The hosted live-quiz tests replaced the response API's Cookie header with only
the participant JWT, losing the session revision sent by the page. Their
interceptors now preserve that revision as well. The affected serial suites
remain required verification. No server revision guard is weakened.

Focused source review of the first correction commit found no blocking issue;
its simplification pass found no justified reduction. The final review must
include the browser-discovered navigation correction and test interceptors.

The hosted Chat status failures identify another affected seam: the root session
boundary withholds server-rendered children, including the segment that throws
`notFound()`. Move the same boundary and expected revision to the authenticated
chatbot layout after its authorization/not-found checks. All current protected
Chat pages remain guarded; public error pages retain their HTTP status. Verify
the existing unknown/malformed chatbot assertions and cross-tab Chat switches.
