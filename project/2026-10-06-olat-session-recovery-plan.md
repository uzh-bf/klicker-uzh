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
with document.hasStorageAccess before mounting authenticated consumers; otherwise
it offers the original LTI launch in a top-level tab. Do not replay launch parameters when reloading.

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

Shared-login implementation is in verification. Removed tab token storage,
explicit-bearer precedence, the Chat login gate and their obsolete tests. Added
one shared revision boundary for PWA and Chat, guarded requests/results and
cookie-acceptance recovery. Temporary login reloads after cookie replacement.
The browser spec now observes existing PWA and Chat tabs and completed-response
ordering; it has not yet run against this implementation.

Planner approved the revised contract. Container checks passed: 30 PWA tests,
24 backend tests, PWA/backend/Chat/response API/shared component/GraphQL type
checks, and backend production build. Chat suite: 744 passed, 21 skipped,
one Headers-representation assertion corrected; its five-test file then passed.
No earlier tab-isolation browser result counts toward the new contract.

The retained runtime is stopped after an OIDC Compose configuration guard
blocked startup. A separate detached verification checkout preserves its data:
`trees/olat-shared-login-verification`. Its managed initial build stalled after producing the backend bundle; stopping
through devrouter cancelled startup but hit the same OIDC Compose hash guard.
Browser verification is blocked until the runtime reaches readiness.
The 125 host launcher/workflow checks passed. Full container checks encountered
an existing parallel Prisma generation race and an offline Analytics dependency
fetch; focused consumer checks above passed. Next: complete browser verification, simplify and review the committed
correction, build, publish current evidence and update the existing PR. Stop
both exact runtime targets and verify route release before closing.
