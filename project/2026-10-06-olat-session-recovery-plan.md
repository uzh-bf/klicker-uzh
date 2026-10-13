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
with document.hasStorageAccess before mounting PWA pages or authenticated Chat content,
including anonymous PWA entry points whose layout can query participant identity.
Chat guards its authenticated chatbot segment; public login and error pages
remain outside the boundary so missing chatbots retain HTTP 404 responses.
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
The later accepted-launch correction below also strips a successful launch URL
after confirming replacement-cookie acceptance.

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

The Chat browser fixture now uses a distinct synthetic ID from the devcontainer
MCP fixture and restores its own seeded course when reused. Both previously
shared one ID, so running the preserved-database suite could move the local MCP
bot into the test course and make the next ownership-checked startup fail. The
exact synthetic fixture was restored; the runtime guard remains unchanged.
The five Chat authentication/access checks pass with the isolated fixture.

Running the two suites together also exposed course-level fixture interference:
the PWA header correctly chose another published chatbot on the shared seeded
course. The shared-login spec now owns one course and two memberships so its
header navigation and thread-identity assertions exercise the same chatbot.
The fixture is removed after the spec. The final full matrix passed 41 cases
with nine WebKit environment skips and zero failures (6.0 minutes). This run
includes the relocated Chat boundary, isolated course, both reported defects,
and all four real local ltijs launches against the synthetic LMS.

The integrated source review of corrections through `02118037ab` found no
blocking issue. It covers all fourteen changed paths and the necessary callers;
browser results and hosted merge gates remain separate. A focused final pass
on the subsequent login-test helper correction also found no blocking issue.

The first full live-quiz run passed 66 cases, including all 39 core scenarios,
then failed in the collaboration suite's obsolete login-cookie helper. Sixteen
serial dependents did not run. That helper now waits for the actual UI login
and accepted cookie names at the configured PWA origin instead of manufacturing
a retired cookie on a hard-coded domain. The temporary-login helper likewise
observes a newly accepted cookie and dialog dismissal instead of copying tokens
or racing the application's reload. Synthetic cookie resets first leave the
authenticated page to prevent its sign-out redirect interrupting the test.

The final collaboration suite passed all 44 cases (4.0 minutes), including
ordinary and temporary logins, reload persistence, leaderboard identity,
gamified answer submission and PIN access. Together with the unchanged core
suite's 39 passing cases, this covers all 83 quiz cases across two producing
runs. The focused seven-case login run also passed. These results follow
failed attempts; they are not one clean combined run. One intervening setup
attempt saw browser network suspension. Docker later temporarily timed out
before the queued runtime validation recovered without a host-wide restart.

Final source review and both focused follow-ups found no blocking issue.
Playwright types and scoped formatting passed after the test-helper cleanup.
The production PWA build and EN/DE probe result above comes from the first
feedback-correction tree; later navigation and Chat layout changes were checked
with types and the final browser runs. Hosted production builds remain a gate.
No authentication guard or browser assertion was weakened, no dependency was
added, and no CodeQL alert was dismissed. Remaining merge gates are hosted CI,
release-branch deployment parity, CodeQL disposition and the public final review.

### Accepted launch replaced before polling (2026-10-13)

The follow-up review examined `9cc4bd996e`; this correction started from
published head `54f4a6f8c3`. Consumed-handoff cleanup and Chat participation-error
metadata are already corrected there. Its additional late-response finding is valid:
an accepted launch can mistake a later shared login for initial cookie refusal
and remove the monitoring that would reload the page.

The local correction records the confirmed launch revision and resets that
confirmation when launch props change. After acceptance, a later revision
continues to withhold stale content and keeps normal reload monitoring active.
Initial cookie refusal still renders recovery. The added browser regression
holds a real Self response and releases it after another tab replaces the
shared cookie. It requires the mounted layout to disappear while polling is
paused, with no cookie-recovery UI, before resuming and requiring adoption of
the replacement identity. This prevents the test passing because polling won
the race. The regression passes in Chromium with the correction and fails
against the previous boundary because cookie recovery appears while polling
is paused. The old boundary was restored only in the verification snapshot
for that negative control and then replaced with the correction.

Host access is restored. The task branch integrates `origin/v3` at
`0a8d465291` to resolve the reported merge conflict. The only conflict was the
unit-test dependency build command; its resolution retains both GraphQL and
Markdown builds. The exact combined command passes all eight build tasks.
The implementation and retained verification snapshot match for every tracked
source file. PWA unit tests pass all 31 cases. PWA, Chat and Playwright types
pass; PWA lint has zero errors and 13 existing warnings. Scoped formatting
and `git diff --check` pass. The full matrix passes 45 cases with ten WebKit
localhost-cookie skips and zero failures in one run. All four Chromium/Firefox
configurations pass the new regression and the real local ltijs launch against
a synthetic LMS. Thirty-two auth/JWT tests and 118 focused Chat tests covering
the integrated upstream changes pass. Manual synthetic login, profile and
reload checks pass. The simplification, slice and integrated final source
reviews found no blocking issue through `060ee4e46c`. Earlier quiz evidence
above remains reused; no hosted production build or real OLAT result is claimed.

Canonical startup succeeds for verification workspace
`users-rschlae-git-klick-665e8559`. The absolute CLI
`/opt/homebrew/bin/devrouter` at 0.3.1 resolves one-shot exec correctly; the initial local repair CLI resolved a removed
container, so the first checks used the exact container from canonical
startup. The host hook also detected an old dependency
install and was stopped; relevant package checks run in the container, with
staged secret and Git-identity checks performed separately. Keep CI polling
and the public final review withheld under the existing user instruction.

The additional five-case Chat access rerun did not reach browser execution.
The selective-profile transition stalled after Rollup emitted its bundle and
was cancelled before stopping the exact runtime. Subsequent startup reported
generated-configuration drift: the generated full-profile service list differed
from the recorded selective profile. Restoring that generated file to the exact
recorded SHA-256 resolved that check, but supported repair then refused the
retained app container with `Managed Compose configuration changed for service
'app'`. No ownership guard was bypassed, data deleted or global tool installation
changed. These five Chat checks retain their earlier passing evidence; the
fresh shared-login matrix includes the changed Chat/session behavior. The extra
rerun remains blocked by runtime reconciliation, separate from source correctness.

The task runtime and verification runtime are stopped at publication, with
provider state and zero exact routes checked by source path. Their retained
containers and data remain available for a dedicated runtime repair. Hosted CI,
CodeQL disposition, release-branch deployment parity and public final review
remain open merge gates. CI polling and public review remain withheld under the
existing instruction.

### Chat runtime recovery and acceptance (2026-10-13)

The remaining runtime blocker is resolved. Integrating `v3` changed the local
`CHAT_FALLBACK_MODEL_ID` from `gpt-5.6-luna` to `gpt-6-luna`, while the retained
container still had the former environment. Substituting that single value in
an in-memory Compose render reproduced its recorded hash exactly. Temporarily
restoring the prior committed environment file allowed canonical devrouter
repair to complete; the current file was restored immediately afterward.
A subsequent managed stop/start recreated the app container with the current
setting. Its recorded Compose hash now matches the current rendered model.
No ownership guard or global devrouter installation was changed.

The final five Chat authentication/access checks pass in one Chromium run
(9.9 seconds, zero skips or failures) against the runtime source at
`5ed39205b7`. They cover unauthenticated redirection, the login-return surface,
unknown and malformed chatbot HTTP 404 responses, and authenticated participant
access. An intermediate run passed four cases and failed in fixture setup
because the preserved development database lacked the Playwright course ID.
The guarded local repair added only that synthetic course and its membership,
using an unused PIN because the development course already owned the normal
test PIN. Existing fixture identities were verified before writing. Product
source, test source and assertions are unchanged. Earlier verification remains
identified by its original producing run; these five passes replace the blocked
rerun recorded above.

The verification runtime is stopped after the final browser run, with provider
state and zero exact routes verified by source path. Runtime data is retained.
Hosted CI, CodeQL disposition, release-branch deployment parity and the required
public final review remain separate merge gates; CI polling and public review
remain withheld under the existing instruction.

### Current PR checks and feedback (2026-10-13, head e035522a26)

The user authorized checking CI/reviews, resolving blockers and requesting the
public final review after CI and CodeQL settle. This supersedes earlier polling
and final-review holds. The PR remains open and mergeable against `v3`; its live
head matches this checkout. Host `gh` works, but the Git fetch remote-state gate
fails with `Operation not permitted` writing this worktree's `FETCH_HEAD`.
No source edit or new commit was made during this inspection.

The fail-fast CI watcher terminated on the current-head `check-suite` failure.
Job 115430880885 proves deployment parity fails on the Chat ConfigMap against
`v3-ai`; preserve its required `COOKIE_DOMAIN` binding. Unit/GraphQL tests, the
Playwright public-PR build and all three CodeQL analyses were pending. OLAT API
tests, dependency review and secret scanning passed. Do not retry a deterministic
parity failure or weaken the check; release-branch coordination remains required.

The latest Greptile finding (discussion r4252297702) is valid by source tracing:
`sessionResultLink` retires its binding, accepts the new cookie revision and
clears the module singleton, but `useApollo` only changes on page props and the
accept function does not notify subscribers. `Header` then awaits navigation.
If navigation fails or is cancelled, the old provider and old page state remain,
and the boundary sees neither a stale flag nor a cookie mismatch. The next fix
must invalidate mounted old identity state and refresh the active provider after
a successful command independently of navigation, while preserving rejected
commands, late-result rejection, intended redirects and assessment behavior.
Add browser coverage that aborts or cancels the post-command navigation and
proves old participant content is removed and the new session remains usable.
Existing pure transport tests do not exercise this mounted-provider seam.

CodeQL's latest completed JavaScript analysis is 1944852029 for merge commit
`90774fdf4010` (parents `0a8d4652915c` and `5ed39205b733`), not this head. It still
reports alerts 3506/3507 on cookie-parser property assignment despite the
null-prototype dictionary, 3499 on bearer selection before JWT verification, and
1091 on missing rate limiting. Alert 1091 dates from 2025 and also appears on
base `v3`. No alert/analysis state was changed. Source hardening alone has not
settled the parser findings. Current-head analysis and the historical missing
`language:javascript` category require an explicit evidence-backed disposition.

Browser verification cannot start: canonical devrouter 0.3.1 ensure for the
existing verification snapshot fails with `Could not prove lifecycle worker
incarnation`. The route read reports `ps spawn failed (EPERM)` and a direct
`ps` probe confirms sandbox denial. Do not bypass the lifecycle ownership lock.
This attempt did not prove runtime startup or fresh stopped/route state; the
previous terminal stopped/zero-routes receipt is retained historical evidence.
The current sandbox therefore blocks both the Git workflow and required browser
verification. Restore permitted host Git metadata/process access before the
next implementation and verification pass. No final-review command was posted.


### Navigation correction and CI follow-up (2026-10-13)

Host Git and canonical devrouter access are restored. The task remains on
`rs/olat-session-recovery`, with `v3` as the PR target. Execution mode remains
standard. The existing verification checkout is reused with retained synthetic
data. A planner reviewed the correction before implementation.

A successful cookie-changing command now makes the initiating document stale
and immediately notifies the mounted boundary. The caller owns a full navigation
to its intended destination. The old document cannot silently accept a new
identity if that navigation is held or cancelled. This avoids rebuilding Apollo
around old SSR props or replaying activation effects. Assessment navigation
retains its existing behavior. Ordinary login preserves locale and return URLs;
temporary-session reloads strip consumed credentials. A browser regression holds
and cancels logout navigation with polling paused, then retries a fresh login.
The focused Chromium run passes. PWA unit tests pass all 33 cases; PWA lint has
zero errors and 13 existing warnings. PWA and Playwright types pass, as do the
11 focused auth helper tests and 14 backend JWT middleware tests. Broader browser
verification and source review are in progress.

The cookie parser now uses a Map for untrusted cookie names, eliminating the
property assignments reported by CodeQL while preserving decoding behavior.
The response API reads only the session revision it needs. A backend regression
confirms missing and forged credentials never authenticate a request across
regular PWA, lecturer and nonbrowser request origins.

Deployment parity needs the same Chat COOKIE_DOMAIN binding on `v3-ai`.
Draft companion PR [#6497](https://github.com/uzh-bf/klicker-uzh/pull/6497)
contains that one-line change; Helm rendering, diff inspection and staged
secret scanning pass. It needs a separately authorized merge before the main
PR's parity gate can pass. The gate is unchanged.

The completed CodeQL result at `e035522a26` still reports four high alerts and
the obsolete `language:javascript` configuration. Parser alerts 3506/3507 need
analysis of the new source. Alert 3499 guards JWT verification on token presence;
the new regression supports a false-positive disposition. Alert 1091 is the
pre-existing missing-rate-limit finding also present on `v3`. No alert state or
analysis records have been changed. Removing the obsolete category would delete
historical analysis data and requires named approval. Final review remains
withheld until current-head CI and CodeQL are settled, as requested.
