# Consolidate Control authentication around NextAuth

## Approval summary

The user approved replacing the custom persistent native Redis sessions with
shared NextAuth/JWT policy, a fixed 30-day native credential and local logout.
They explicitly require removal of obsolete Redis session code. This executable
batch implements that decision in the existing Control worktree. Reuse edu-ID,
delegated login, secure platform storage and the proof-bound one-use login
handoff. Its five-minute transaction/code state remains in Redis; persistent
native session records, opaque credentials and the revoke endpoint are removed.

Native Control keeps reduced lecturer permissions. Web keeps its NextAuth
cookies; issuance will correctly apply maxAge to JWT expiration. Existing web
credentials remain compatible until their normal reissue. Salt-bound temporary
OAuth cookies and participant/assessment audience boundaries retain their
contracts. No refresh service, database migration or auth library upgrade.

Local logout clears the device credential; it cannot revoke a copied JWT.
Cancellation prevents exchange or discards a late result, but cannot invalidate
an already issued token. These trade-offs and 30 days were disclosed and are
approved. Current database authority checks still reject changed/deleted
identities or reduce delegated scope. Native signing-key separation prevents
legacy web consumers accepting native credentials. No new secrets are needed.

Completion means focused auth/API/client checks, web/browser verification,
static/native build evidence, obsolete-code search, independent Opus review,
local commits and a reviewed delivery packet. The existing six-layer stack
prevents appending a seventh layer; publication waits for predecessor landing
or an approved supported topology. Existing manual-test
runtime is retained. No merge, readiness change, store release, production
access, signing-account or infrastructure change is authorized.

## Execution details

### Context and ownership

Repository/worktree: `trees/review-control-stack-6539`, branch
`enhance/control-native-login`, baseline `7f3dcd1ffb`. Remote default `origin/v3`
was fetched; its drift does not require unrelated integration. Preserve the
17 pre-existing manifest and personal Xcode changes. Existing research:
[session research](2026-10-25-cross-platform-login-session-research.md).

Execution mode: standard (main runtime model identity not exposed). Main owns
integration and auth policy. Planner challenges this bounded plan; Opus 5.5
provides periodic architecture/final feedback. A bounded worker owns the
settled native client change; no worker handles secrets, forge or runtime writes.

### Sequence and concrete seams

Delegation Map:

| Slice | Owner | Dependency / acceptance |
| --- | --- | --- |
| Shared JWT, restricted claims and principal validation | Main | Existing helpers; expiry and isolation checks |
| Handoff rename, persistent-store removal, API middleware | Main | Shared helpers; handoff concurrency and API tests |
| Native client/local logout and error UI | Native worker | Shared 30-day constant; client tests, main integration |
| Documentation, browser/native proof, review and delivery | Main | Integrated implementation; checks and exact diff review |

1. Extend existing util JWT helpers with explicit audience/type/required-claim
   verification. Reuse the current native protocol module for shared restricted
   claims, key derivation and principal checks, replacing its Redis record type.
   Both handoff and backend call one principal validator. Issuance uses the same
   JWT signer as NextAuth, explicit auth origin and absolute expiry. Web encode
   overwrites exp on every issuance/reissue with now + effective maxAge, even
   when the old payload already has exp; legacy decoding remains compatible. Never pass
   maxAge seconds as an absolute NumericDate. Native claims include USER role,
   reduced scope, source, purpose, audience, iat and exp. No identity secrets or
   broad browser token enter the native response or redirect.
2. Rename apps/auth/src/lib/nativeSessions.ts to nativeHandoff.ts, class
   NativeHandoff and factory nativeHandoff. Rename its existing integration test
   to native-handoff.integration.test.ts. Do not retain alias modules/classes. Remove every persistent
   session key, digest, write/read, revoke method/route and post-exchange
   revocation branch. Atomically consume the proof/code once with the existing
   transient transaction CAS; failed issuance never becomes replayable.
   Remove Redis dependency from backend native authentication entirely. Dispatch
   native-origin or native-typed credentials before legacy selection, validate
   derived-key signature/issuer/type/audience/expiry, then current DB authority.
   Native failure never falls back to cookies. Keep strict transport/assessment
   rejection and generic assessment bearer behavior.
3. Client accepts only the new JWT response, checks expiry metadata against its
   claims, restores after a day, and rejects at 30 days. Handle setTimeout's
   32-bit delay limit by bounded rearming. Remove revoke requests/results and
   obsolete revocation messages/query flags. Preserve storage failure handling,
   cancellation races, reinstall clearing and no mutation replay. Skip the
   redundant broker sign-in screen through a validated server redirect to the
   existing lecturer login when no browser evidence exists; retain account
   confirmation, terms and ephemeral mode. For a stale/ineligible browser session,
   keep explicit account-switch/sign-out recovery rather than redirecting in a
   loop. Preserve the transaction across that recovery.
4. Supersede ADR 0055 with the actual signed-session contract, update current
   native docs/privacy strings and roadmap status, and remove stale executable
   tests for record revocation. Preserve historical decisions as superseded,
   clearly distinguished from current behavior. No old-format compatibility
   issuer, feature flag or Redis session fallback survives.

### Acceptance

- Real transient Redis integration: proof/state/browser binding, expiry,
  concurrency, single use, cancellation; exchange creates no persistent session.
- JWT expiry maxAge, correct NumericDate, web reissue and legacy decode;
  temporary OAuth salt separation remains intact. Native signature is rejected
  by generic web verification; mandatory claims and lifetime validated.
- API: restricted scopes, current password/account/role changes, expiry and
  origin/path/assessment denial, no fallback, existing bearer compatibility.
- Client: next-day/cold restoration, 30-day deadline and timer overflow,
  local logout offline, cleanup/storage failures and late exchange discarded.
- Repo-native checks and targeted tests in retained container; host browser
  verification for delegated web login and broker redirect/confirmation in EN/DE.
  Bundled UI plus Simulator build verify installed assets; hardware requires
  available unlocked device and remains separately identified if unavailable.
- Search active code for old opaque format, persistent session keys, Redis
  backend dependency and revoke route; no retained dead branch or old tests.

Maintained test portfolio (no content-pinning assertions):

| Risk | Classification | Existing test path |
| --- | --- | --- |
| JWT expiry/reissue, legacy decode, salt separation | Extend existing | apps/auth/test/salted-jwt.test.ts; packages/util/test/jwt.test.ts |
| Transient handoff atomicity, no persistent records | Replace/consolidate | apps/auth/test/native-session.integration.test.ts renamed native-handoff.integration.test.ts |
| API signing isolation and current authority | Replace/consolidate | apps/backend-docker/test/controlNativeAuth.test.ts |
| Native storage/deadline/cancel/logout behavior | Extend existing | apps/auth/test/control-native-client.test.ts |
| Browser login, stale-session recovery, native bundle | Extend existing evidence | Existing auth/browser and Simulator harnesses, no production fixtures |

### Delivery and pause conditions

Reuse the current task branch and verify PR/stack topology through host gh before
ordinary non-force publication. Existing stack changes need no reordering.
Local device rebuild uses existing development signing only if qualified by
existing pilot authority; do not change account/profile/infrastructure. No
real-account automation. If native runtime/tool access is unavailable, complete
source/tests/review and report exactly which device evidence is missing.
Pause only for a material policy departure, unresolved independent-review issue
or missing mandatory capability; routine corrections remain authorized.

## Progress

- Approved executable batch: current user approval after NextAuth/Opus proposal.
- Plan challenge: APPROVED after three accepted corrections (stale browser
  recovery, explicit reissue expiry, concrete ownership/test portfolio).
  Implementation in progress; checks pending.
- Primary docs already retrieved through rs-find-docs: NextAuth 4.24.15 custom
  encode/decode, getToken and cookie session route; no native renewal assumed.

- Initial tests: auth109, API17 and util23 passed. Focused auth/util/backend
  checks passed after correcting an accidental import insertion. Web delegated
  login reached course list; native existing-account confirmation rendered;
  fresh native browser redirected directly to lecturer login.
- Runtime: source-path exec works; default ensure timed out on unrelated LTI and
  rolled back. Re-ensure selected profile reports generated-drifted baseline;
  routed Control/auth/API still serve successfully. Do not mutate global state.
- Scanner: one existing allowlisted-CORS reflection finding in renamed handoff,
  same exact allowlist/check as baseline; no introduced scanner finding.

- Opus midpoint completed; issuer normalization and bounded iat skew corrected,
  exchanged principal removed, browser-evidence age bounded. Real HTTP307 and
  browser return-to-confirmation verified. Dispositions in ignored review file.
- Added existing util workspace dependency to Control for shared pure lifetime
  constant; lockfile only three importer lines, unrelated metadata restored.
- Full auth regression found an expired-token test fixture re-encoded by the
  now-correct renewal encoder; generate that expired fixture directly with the
  shared signer. Production student-session behavior remains unchanged.

- Native worker delivered client/local-logout scope; focused22client and54unit
  tests passed. Main integrated source and corrected shared strict indexed access.
  Full auth181 passed, util24 passed; API17 passed. Static bundle compiled.
- Browser gallery captured EN/DE phone login and iPad confirmation; fresh
  browser returned successfully through delegated login with binding retained.
- Hardware pilot update not yet performed. Existing pilot binary contains old
  validator and must not be claimed compatible. Simulator build underway.

- Implementation committed at2b32536e72. Normalhooks42workspacechecks,7lint,
  formatting,syncpack,94hostcontracts passed. Test-onlydata-hygieneoverride used
  for generatedcredentialassignment in renamed synthetic test under prior user
  approval; mandatorygitleaksscanpassed.
- IntegratedOpusreview completed: no source correctness/security/plan defect;
  one low docs/auth-model.md stale-contract finding accepted and corrected.
  Simplifier's redundant evidence branch and obsolete test wrapper removed.
  Simulator currentbundlebuiltinstalledlaunchedandrenderedsignin.
- Runtime exactsource live-quiz,manage restored healthy with seven routes;
  retained under usermanualtesting request. Pilotupgradeinprogress.


### Final local completion

The approved source package is implemented. Commit `2b32536e72` removes the
persistent native Redis registry and revoke endpoint, shares JWT/current-account
policy, and adds fixed 30-day native restoration/local logout. A following
correction contains only the accepted wiki fix, redundant-branch removal and
obsolete test-wrapper removal; its existing 103 handoff checks passed.

Independent Opus final review of the full committed package found no reportable
source correctness, security or plan-compliance defect. Its one low stale-wiki
finding is corrected in `docs/auth-model.md`. Main verified the correction.
Independent simplification produced the two accepted mechanical reductions.
Review reports and screenshot provenance remain under
`project/_local/reviews/control-nextauth/`.

Verification: 181 auth unit/integration tests, 24 shared JWT tests and 17 API
contract tests passed. Focused auth/Control/backend/util type checks passed.
Normal first-commit hooks passed 42 workspace checks, 7 lint tasks, formatting,
syncpack and 94 host contracts. Gitleaks passed. The prior user-approved
synthetic-test data-hygiene false-positive override was used only for generated
credential values in the renamed integration test; ordinary hooks remained on.
Correction-hook retries were interrupted by overlapping Devrouter lifecycle
intents; retry them serially, without skipping required checks.

Production auth build excludes the deleted revoke route. Static Control export
and isolated iOS Simulator build/install/launch passed; native sign-in rendered.
An initial blank Simulator was an isolated generated plugin-registration typo,
corrected to match the existing Capacitor-generated class without source edits.
Real browser verification covers seeded web login and the shortened native
round trip, including cookie retention on the redirect, EN/DE phone captures,
and iPad-size account confirmation. No real account was automated.

The physical iPad development binary was rebuilt with the existing managed
profile and installed successfully. The owner confirmed that the updated app
opens, sign-in succeeds and courses load. They reported redundant confirmation
clicks after successful authentication; the follow-up below addresses that UX. Existing private
auth sidecar now runs current source. An isolated current backend build uses
only a different listening port and matching private auth issuer; the existing
two-port loopback forward points to it. No Tailscale route/access/signing resource
changed. Synthetic HTTPS end-to-end sign-in, proof approval/exchange and the
actual Control course query passed with the fixed 30-day token; no token or
account identifier was saved in evidence.

Runtime source `/Volumes/HOME/Git/klicker/klicker-uzh/trees/review-control-stack-6539`,
workspace `review-control-stack-6539`, profile `live-quiz,manage`: supported
ensure completed, seven exact-source routes restored. Retain this runtime,
Simulator, private auth/API test processes and two-port forward under the user's
manual-testing request until testing completes or the request changes. No
runtime/data/worktree deletion. All agent browser sessions closed.

No new PR was published: [PR #6539](https://github.com/uzh-bf/klicker-uzh/pull/6539)
remains in the existing six-layer stack; a seventh layer requires predecessor
landing or an explicitly approved supported topology. No ready/merge/deploy or
store-distribution action occurred. The 17 pre-existing manifest/personal Xcode
changes remain outside this package. Android/hardware institutional/store
qualification remains separate.

## Follow-up: automatic return after fresh sign-in

Approval mode: executable batch. The owner approved returning directly to Control
after fresh successful sign-in, retaining account confirmation for a reused
browser session. This follow-up keeps the existing transaction, account, terms,
ephemeral browser and 30-day credential policies. No session service or refresh
layer is introduced.

Execution mode remains standard. Main owns the coupled authentication seam; no
independent implementation item is available. Opus 5.5 advises on the design and
reviews the integrated result. A read-only planner challenges this addendum.

Compose the existing NextAuth sign-in and transient native handoff. At successful
lecturer sign-in only, sign a binding to the exact validated native callback
transaction and its host-only browser secret. The signed JWT binds the marker to its principal/source; another sign-in
replaces or clears it, sign-out removes the cookie, and reissue only preserves
it. The existing transaction deadline bounds its use to five minutes.
Ordinary cookie reissue cannot create or renew this binding. Completion renders an automatically submitted same-origin
CSRF form only when the signed binding matches this transaction and browser.
Retain the explicit form as fallback and for existing browser sessions.

Owned source paths: apps/auth/src/lib/nativeHandoff.ts,
apps/auth/src/pages/api/auth/[...nextauth].ts,
apps/auth/src/pages/native/complete.tsx, apps/auth/src/pages/index.tsx (existing
Control app name before provider choice), and the existing
apps/auth/test/native-handoff.integration.test.ts. Update ADR 0056's affected
confirmation contract and this plan. No new source file, dependency or migration.

Extend the existing real-NextAuth/Redis integration suite for fresh sign-in
automation, reused/reissued sessions, wrong transaction/browser, untrusted
callback targets, failed authentication and unchanged CSRF/one-use exchange.
Capture the library-validated destination through the lecturer redirect
callback closure, before its initial JWT callback. Require exact configured auth
origin, /native/complete or /de/native/complete, no fragment, and exactly one
valid transaction query parameter. Do not use request callback hints or JWT iat.
Extend real callback tests for credentials and local OIDC, conflicting callback
body/query/cookie inputs, expiry and principal changes between issuance and
completion. Browser acceptance includes successful one-use exchange after the
automatic POST, terms enforcement and account switching.
Browser verification must observe the automatic POST without a Continue click,
manual confirmation for a reused session, and EN/DE phone/iPad rendering.
Run auth tests, type/lint/format checks, staged data scanning and normal hooks.
Record inspected screenshots in the existing ignored evidence area.

Terminal: verified source commit plus current local auth server and private iPad
auth sidecar serving the improvement. The app binary need not change for this
server-rendered step. Retain the exact manual-test runtime. Reuse the current
branch/package; six-layer publication constraint remains. No new PR layer,
ready/merge, production deployment, signing or infrastructure changes.

Progress: planner APPROVED after callback/proof/verification clarifications.
Opus 5.5 advised HMAC account binding, explicit successful-callback trigger,
strict target parsing and duplicate-submit protection; accepted. Localized
completion paths remain accepted deliberately. Implementation in progress.

Product impact: compose lecturer sign-in with the existing native handoff.

| Product primitive | Owner and invariant | Disposition |
| --- | --- | --- |
| Lecturer sign-in | NextAuth authenticates the account; only successful callbacks create fresh proof | Reuse |
| Native handoff | Auth service owns the bounded browser-bound transaction and one-use exchange | Compose with fresh sign-in; confirmation remains for reused sessions |

Verification in progress: all 192 auth tests and focused type/lint/format checks
passed; production auth build passed with NODE_ENV=production. The first build
used the retained runtime's test NODE_ENV and failed at prerendering; rerunning
with the correct build environment fixed it without source changes. Focused
Opengrep reports only the pre-existing allowlisted CORS reflection finding.
Private auth sidecar restarted with its original environment and current build;
existing private routes and app binary retained.

Completion follow-up: implementation commit `11cb1f4fa3` passed normal hooks,
192 auth tests, auth type/lint/format checks and production build. Browser checks
observed an automatic completion POST on both the routed and private pilot auth
servers; reused-session confirmation, terms and account switching passed.
Private synthetic HTTPS approval, one-use exchange and authenticated course
query passed with the fixed 30-day credential.

Independent simplifier recommended no changes; bounded slice review passed.
Opus final review approved the auth design and identified older iOS WebKit
support for form.requestSubmit as a compatibility issue. Replaced it with
activation of the existing submit button, preserving its normal submit handler
and synchronous duplicate guard. Focused correction verification pending.
Evidence and inspected EN/DE phone and iPad screenshots are in
`project/_local/reviews/control-nextauth-auto-return/`.

The exact retained runtime has seven routes and no duplicate host. Private
auth uses its original environment and current build. No iPad reinstall, route
change, publication or stack mutation. All task browser sessions closed before
the correction check. Physical ASWebAuthenticationSession close/return for this
new automatic step remains unverified and should be checked at the next owner
sign-in; existing course-loading acceptance is recorded separately above.
