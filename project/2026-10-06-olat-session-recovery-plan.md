# Restore participant sessions after an OLAT launch

## Outcome and execution contract

A fresh, verified OLAT launch restores the intended participant's Klicker
session even when the browser retains expired cookies or an older bearer token.
The profile settles into authenticated, anonymous, or failed state. An expired
launch offers recovery rather than leaving a spinner or silently using another
account. Account links, quiz results, enrollment and data-use decisions retain
their existing meaning.

The user authorized persisting and improving this full plan with Astra, then
executing it under a native goal on 6 October 2026. The main session owns the
identity decisions, integration and final proof. Execution mode is standard;
the main model's routing identity is not available. The scope is one cohesive
authentication defect repair, delivered in one draft PR with reviewed commits.

**Authority:** task-worktree source and documentation edits, synthetic fixtures,
isolated local checks, configured independent reviews, ordinary task-branch
pushes and draft PR creation. No merge, release, deployment, live account repair,
production data changes, new cluster connectivity, global tool/configuration
repair, or changes to account linking and authorization are included.

**Terminal:** an Astra-approved persisted plan, all planned repair slices,
focused and browser verification, integrated review, and an accurate draft PR
against `v3`. Missing capability remains an explicit open gate, not completion.
**Boundary owner:** main session. Pause only the dependent action for a terminal
capability failure, an unresolved identity contract, or a necessary change to
the authority or data boundary. Continue independent approved work.

## Identity and evidence

- Repository: `uzh-bf/klicker-uzh`; artifacts root: `project/`.
- Worktree: `trees/rs/olat-session-recovery`; branch: `rs/olat-session-recovery`.
- Target: `v3`, baseline `6189a7487b912a1d9e95769b2f3bb6434c34ccea`.
- PR: [draft #6414](https://github.com/uzh-bf/klicker-uzh/pull/6414), target `v3`.
- Production evidence baseline: `v3.4.0-alpha.84`, peeled commit
  `2f8bead95ab47db65db898c0811451077dc187ab`. Production and current `v3`
  differ; this repair must be verified on its actual target.
- Related history: [the earlier stale-LTI-cookie repair](./2026-09-07-pr5807-pwa-lti-cookie-recovery.md)
  already clears pending LTI state after successful ordinary participant login
  and gives the launch cookie a five-minute lifetime. Preserve that protection.

The 6 October read-only production inspection found the same alpha.84 images,
ten ready API/PWA/LTI pods and no restarts. Retained installation-wide logs
contained 5,953 participant JWT expiry events, including 4,835 expired for more
than a day. These are request events, not student counts. Four Create Account
handoff-expiry events were observed on 1, 3 and 5 October. No logs correlate the
reported screenshots with a browser, course, account, or credential transport.

The deployed-source harness reproduced stale storage surviving fresh login,
expired cookies masking fresh credentials, a misleading cookie probe and the
wrong cookie Max-Age. Those are synthetic function tests, not browser proof.
Current `v3` retains the selection, storage-replacement and expiry defects but
does not include production's explicit partitioned-cookie issuance. Address
legacy variants deliberately rather than copying unrelated release changes.
Personal screenshots, raw logs, credentials, account identifiers and HAR files
stay outside the public repository and specialist scope.

## Product contracts and resolved design

| Product primitive   | Disposition     | Contract and consumers                                                                                                                                                                            |
| ------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Participant session | Extend recovery | A verified fresh login replaces prior browser session state; API identity follows the explicit current participant credential. PWA profile, courses, quizzes and existing login flows consume it. |
| OLAT account link   | Reuse           | Verified LTI 1.3 identity resolves the existing account through the existing resolver. No relinking, duplicate-account repair, schema change or relaxed verification.                             |
| Quiz participation  | Reuse           | Existing participant authorization, data-use gate and leaderboard opt-in remain authoritative. Successful relaunch restores authenticated access without changing results.                        |

1. Competing explicit `jwt` and `participantToken` handoffs are rejected. A
   verified explicit participant handoff supersedes retained LTI state. A
   single fresh `jwt` query handoff takes precedence over a retained LTI
   cookie, and is cryptographically verified for LTI 1.3 before exchange.
   Arrays, empty or malformed explicit credentials fail closed. Invalid
   launch context never falls back to another participant's session. Keep the
   five-minute handoff lifetime and provide a fresh-launch recovery action.
2. A fresh `participantToken` handoff must be verified as a participant session
   before replacing ambient cookies. Retained participant credentials are also
   verified before SSR treats them as authenticated. Validity is not inferred
   from cookie or query presence. The assessment path retains its established
   credential selection and cookies.
3. Regular-PWA requests with an explicit participant bearer use that verified
   identity before ambient cookies; this lets a newly completed login supersede
   stale or different prior cookie state. Invalid explicit credentials fail
   closed. Without a bearer, retain the existing regular-PWA cookie selection.
   Assessment, manager/controller, origin routing and field authorization keep
   their current contracts. Test those boundaries directly.
4. Keep the existing participant cookie name, domain and root path. Align its
   direct-login and SSR issuance attributes and expiry, retaining HttpOnly and
   secure cross-site transport where already required for embedded access.
   Registered-participant cookie retention is thirteen days, within the
   fourteen-day JWT lifetime. Canonical attributes are domain `COOKIE_DOMAIN`,
   path `/`, HttpOnly, unpartitioned; secure deployments use Secure and
   SameSite=None, local HTTP uses SameSite=Lax. Delete the legacy explicit
   partitioned variant before issuing the canonical cookie, preserving every
   other Set-Cookie header. This does not change the shared locale/lecturer/
   temporary settings constant. Cookie retention ends no later than the signed session. Express takes
   milliseconds; nookies/wire Max-Age takes seconds. Clear known legacy
   unpartitioned and explicit-partitioned variants in the current partition
   when replacing or ending a session. Do not claim cleanup across inaccessible
   partitions. Preserve lecturer and assessment issuance. Existing explicit participant
   logout continues expiring both regular and assessment participant cookies;
   this repair adds regular legacy-variant cleanup without removing that behavior.
5. A freshly verified token replaces stale browser fallback state, including
   when persistent browser storage is unavailable. A small browser-only
   in-memory fallback can serve the current page if storage is denied; it must
   never become shared server state. A cookie probe does not authorize removing
   a usable bearer. Retain the fallback until a real cookie-only authenticated
   request proves the same participant identity; retaining it for the active
   session is acceptable if that is the smaller correct implementation.
6. Logout and successful account deletion clear in-memory and stored bearer
   state as well as the existing cookies. Rejected mutations retain the active
   session. Before child queries or authenticated rendering, `_app.tsx` binds a
   private Apollo client/cache to the projected verified page credential. Render
   does not mutate retained credentials, notify subscribers or stop the committed
   client. Commit applies the session with a captured revision guard, then retires
   the previous client. Abandoned renders leave the active session unchanged.
   Client generations bind request credentials and gate session-changing results
   and error redirects; a retired client cannot issue a new authenticated request.
   Invalid launch state renders recovery with an empty private cache and clears
   retained bearer state on commit. Ordinary
   cookie-based password/magic/activation login success also clears old bearer
   state before Self refetch. Centralize successful mutation recognition using
   actual response fields, not operation names or HTTP status alone. Move
   account-deletion cookie expiration after the successful transaction. False
   or failed deletion preserves server and client session state.
7. Edit Profile separates pending queries from settled null/error results and
   offers retry or safe login recovery. An invalid or expired LTI launch directs
   the student to relaunch from the embedding platform without carrying an
   expired credential into a retry URL. Recovery targets use existing local
   destination validation. Regular direct registration remains available. The SSR helper exposes bounded
   states: no launch, authenticated, verified launch requiring registration,
   rejected launch/session, and exchange unavailable. Select the LTI credential
   once and return its verified registration context to Create Account. When Edit
   Profile redirects a verified registration-only launch, carry its signed `jwt`
   to Create Account so an old or missing LTI cookie cannot replace that context. Existing
   callers carry the rejected/unavailable state to the application boundary.
   Participant claims require nonempty subject, role PARTICIPANT and finite
   future expiry with HS256 verification. OTP, activation, lecturer and temporary
   tokens cannot become a regular participant handoff. The regular API accepts
   verified PARTICIPANT or TEMPORARY_PARTICIPANT bearers only in the existing
   regular-PWA origin branch; missing Origin and other audience branches retain
   existing selection. A present malformed or invalid explicit bearer in that
   branch fails closed. An explicit verified handoff replaces an active browser identity. An ambient
   SSR participant cookie seeds identity only when no browser session exists;
   it cannot supersede a different active bearer. Discard SSR cache hydration
   when its authenticated identity differs from the active browser identity.
   With no SSR credential, preserve an active bearer on client-renderable
   routes. Edit Profile becomes client-renderable for the no-launch case,
   avoiding a server redirect that cannot see browser memory. The SSR-required
   chatbot bridge retains fresh-launch/login recovery rather than claiming
   memory-only continuity. Memory-only authentication survives the active
   document and client-renderable navigation. With cookies and storage both
   blocked, a credential-free reload safely settles as anonymous with an
   available fresh-launch instruction. Frame detection may choose that guidance
   but establishes no identity. Clear known ambient participant cookies and
   browser state on rejected launch, and gate authenticated querying/rendering
   during that recovery so another account cannot reappear. Registration-only
   verified launch also clears prior participant state before showing its form.

Alternatives: globally disabling browser protection is excluded because no
trace establishes that requirement. Extending JWT lifetimes would hide stale
state rather than repair it. Blindly accepting the next credential after a
verification failure would risk switching identity. Reopen cookie naming only
if browser evidence proves consistent issuance and current-partition cleanup
cannot avoid same-name ambiguity.

## Research and documentation disposition

The main session owns current dependency and cookie documentation, exact
issuance/deletion semantics, and current-target test inspection. Astra owns the
frozen plan challenge. Consultation uses anonymous observations and bounded
source; it has no production access. MDN documents seconds-based Max-Age and
the Secure requirement for Partitioned cookies:
[Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie),
[CHIPS](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies/Partitioned_cookies).
The installed matching serializers remain the authority for version-specific
behavior. No browser-family cause or fix ETA is established.

Update `docs/auth-model.md` for the changed regular participant selection and
recovery contract. The cookie and credential-precedence decision meets the ADR
gate: it affects persistent sessions, is surprising without context, and trades
ambient-cookie compatibility against explicit-login identity. Record the final
decision in `docs/adr/0044-regular-participant-session-recovery.md`. Keep the
domain glossary and broad skills unchanged because their semantics do not
change. A concrete new runtime or verification contract would arm an update to
the corresponding repository skill instead.

Use `rs-sliced-development-workflow`, `rs-model-routing`, `writing-for-agents`,
`rs-product-primitives`, `rs-find-docs`, and the relevant repository auth/test
skills. For actual runtime work, use `rs-local-runtime-lifecycle` and devrouter.
Use `agent-browser` for interactive verification and
`rs-build-screenshot-gallery` for the changed recovery states; draft PR writing
uses `rs-mr-description-writer`.

## Feature-wide test portfolio

| Consequential behavior                                                                         | Existing protection and obligation                                                                                                                                                                                                 | Stable seam / owning slice                       |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Fresh verified launch replaces expired state without switching to an unrelated account         | Earlier accountLtiLinking/loginParticipant tests protect account resolution. `add new`: credential-order, expiry, wrong-role, invalid explicit handoff and repeated-query cases using actual signed synthetic JWTs.                | SSR helper contract / slice 1                    |
| Fresh participant bearer works despite an old ambient cookie; other audiences retain selection | No current middleware suite covers this outcome. `add new`: HTTP middleware contract coverage with signed synthetic principals; include assessment cookie and bearer, manager/controller, invalid bearer and cookie-only requests. | Backend request authentication / slice 2         |
| Session-cookie lifetime and legacy cleanup agree across login paths                            | `extend existing`: loginParticipant tests for TTL and cleanup; inspect actual Set-Cookie output for direct and SSR paths. No prose or source-string assertions.                                                                    | Login/cookie contract / slices 1–2               |
| Storage denial, stale token replacement and logout settle correctly                            | `add new`: browser-state contract tests; actual hook and Apollo integration need a small browser journey. Cover successful and rejected logout, cache identity changes and storage exceptions.                                     | Browser session state / slice 2                  |
| Profile null/error and expired handoff permit bounded recovery                                 | `add new`: journey assertions on state/actions and destination validation, not translated wording. No snapshots of prose.                                                                                                          | PWA interaction / slice 3                        |
| Returning student can relaunch and participate in the intended quiz                            | `add new`: one synthetic embedded journey per Chromium and Firefox, fresh and retained-state variants. Observe Self identity, avatar and authenticated quiz access.                                                                | Host Playwright against routed PWA/API / slice 4 |

Tests use synthetic identities and test-owned records only in a marked
disposable database. No real OLAT sessions, student data, production retries or
test-only production endpoints. Test controllers and browser fixtures stay in
the test harness. Extend existing suites before adding overlapping coverage.

## Slices and commit boundaries

**Plan commit:** after Astra approves the frozen plan, commit this file as
`docs(project): add OLAT session recovery implementation plan`. The user's
execution request already authorizes this bounded package; there is no new
approval checkpoint for its internal slices.

**Slice 1 — fresh launch establishes the intended participant.** Main session
owns `apps/frontend-pwa/src/lib/getParticipantToken.ts` and
`apps/frontend-pwa/src/pages/createAccount.tsx`. Extend the helper rather than
creating a parallel login service. New helper contract coverage lives at
`apps/frontend-pwa/src/lib/getParticipantToken.test.ts`. Preserve account
resolution, initial data-use disclosure, and direct registration. Verify signed
credentials, failure/recovery classification, seconds-based expiry and SSR
redirects. Commit the useful authentication tracer before moving on.

**Slice 2 — subsequent requests retain the fresh identity.** Main session owns
`apps/backend-docker/src/app.ts`, `packages/graphql/src/services/accounts.ts`,
`apps/frontend-pwa/src/lib/useParticipantToken.ts` and `apollo.ts`. Introduce
`apps/frontend-pwa/src/lib/participantSession.ts` only because the hook and Apollo
both need the same browser-only token state; name its tests
`participantSession.test.ts`. Extend existing account login/logout tests. Extract the existing middleware into `apps/backend-docker/src/jwtMiddleware.ts`
for its stable request seam; new coverage lives at `jwtMiddleware.test.ts`.
Centralize successful client logout/deletion handling in the Apollo boundary
using a shared result observer exported from the named browser-session module;
only `components/forms/AccountDeletionForm.tsx` additionally needs its explicit
false-result guard. Include `pages/_app.tsx` and each existing SSR helper caller
listed below for bounded recovery-state propagation. Verify expiry, cleanup, cache
identity, storage denial and preserved assessment behavior; commit together.

**Slice 3 — profile and launch failures offer recovery.** Delegate the settled
UI work after slices 1–2 fix the recovery contract, while the main session
prepares end-to-end fixtures. Owned paths are
`apps/frontend-pwa/src/pages/editProfile.tsx`,
`apps/frontend-pwa/src/pages/serverError.tsx`, and
`packages/i18n/messages/{en,de}.ts`. Extend existing surfaces; create no new
screen. Revise this plan before adding an unlisted consumer or module. Use relevant
translation keys and accessible controls. Commit with interactions and
synthetic desktop/mobile English/German screenshots where browser capability
permits. Add an explicit pending gate if unavailable. Include the frame-aware
fresh-launch instruction on the named existing recovery surfaces.

**Slice 4 — integrate and prove recovery.** Main session owns
`playwright/tests/PA-olat-session-recovery.spec.ts` and `playwright/olat-session.config.ts`, plus the existing `playwright/profiles.json`
and `playwright/relevance-manifest.json` entries required by the runtime selector. Extend the existing config with
Chromium and Firefox for this spec. Keep fixture and embedding code in the spec;
create no helper directory. Use host Playwright and the exact routed worktree
runtime, profile `pwa`; do not modify application code for fixtures. Update the
named auth doc and ADR. Refresh the existing overlapping lesson at
`docs/solutions/integration/stale-lti-cookie-login-loop.md` with the explicit
handoff precedence and evidence boundary, without creating another lesson.
Run affected package checks, formatter/linter and
required repository checks once against the integrated source. Independent
simplification and authentication reviews use exact committed slices;
integrated review covers correctness, maintainability, security and
architecture. Finish ordinary task-branch push and draft PR, attach it to this
chat, and report exact-head CI and any remaining gate honestly.

## Ownership, browser boundary and focused checks

| Slice | Owner               | Dependency / acceptance                                                                                                       |
| ----- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1     | main                | Approved plan; signed fresh handoff replaces retained state and rejected launch cannot reuse another identity.                |
| 2     | main                | Slice 1; first and subsequent API requests use intended identity; logout/deletion and audience checks pass.                   |
| 3     | configured executor | Recovery result contract settled by 1–2; null/error/retry interactions settle. Parent prepares disjoint fixtures in parallel. |
| 4     | main                | All source slices; complete browser journey, integrated checks/review and draft delivery.                                     |

The existing SSR consumers requiring the bounded state prop are
`pages/createAccount.tsx`, `editProfile.tsx`, `join/[shortname].tsx`,
`course/[courseId]/index.tsx`, `practice.tsx`, `practiceQuizzes/[id].tsx`,
`practiceQuizzes/overview.tsx`, `microLearnings/[id]/index.tsx`,
`microLearnings/overview.tsx`, `liveQuizzes/overview.tsx`, and the chatbot bridge
`course/[courseId]/chatbot/[chatbotId].tsx`. Prefix all with
`apps/frontend-pwa/src/`. Keep those propagation edits mechanical; do not alter
their quiz or course logic. Extend `packages/graphql/test/accounts.test.ts` for
successful, rejected and failed account deletion/logout. The existing
`loginParticipant.test.ts` owns ordinary login cookie and LTI cleanup coverage.

The cross-site host-browser harness serves an HTTPS synthetic top-level
`https://lms.example.invalid` document through Playwright request fulfillment,
embedding the actual HTTPS routed PWA. The distinct registrable site is explicit;
a sibling localhost frame is insufficient. Proof starts with the signed Klicker
LTI handoff, after ltijs verification, and does not claim real OLAT/OIDC launch
validation. Test-owned account/course/quiz fixtures use the existing guarded
local seed/data boundary. Configure browser-native cookie restrictions and
verify on requests that the participant cookie is absent; record an ignored
setting as a failed restriction check. Test Firefox Standard plus explicit
cookie blocking and Chromium allowed/blocked cookie contexts. Injected storage
exceptions are a separately labeled application-resilience check. Real privacy
settings, synthetic exceptions and engine versions remain distinct evidence.
The named spec explicitly covers memory-only B navigation to Edit Profile,
conflicting ambient A versus active B, credential-free reload, expired-handoff
reload and successful fresh relaunch. Assert no former-participant profile is
rendered, bounded recovery when persistence is unavailable, and identity B after
the fresh relaunch. No reload-persistence claim is made without an available
storage mechanism.

Focused checks run inside the Node 24 container toolchain: PWA and backend
`test:run`, selected GraphQL login/account suites, affected package type checks,
Biome/Prettier on touched files, then required root checks/build. No test uses
an unmarked retained database. Docker dependency installation and pure tests are
independent of managed app startup. Browser checks use host `pnpm playwright:host`
with `playwright/olat-session.config.ts` against the exact worktree runtime;
`agent-browser` exercises actual recovery controls. Capture authenticated,
anonymous and error/retry states in English/German at desktop/mobile sizes.
Missing checks stay pending. Stop and verify the exact managed runtime after
its final check; the isolated unit-check container exits and is removed.

The quiz fixture includes one synthetic question. The first journey submits an
answer and checks that only the freshly launched participant owns the saved
response. The harness captures authenticated, anonymous, retry and expired-launch
states; captures remain unproduced until the browser lane executes.

The existing `.github/workflows/test-unit.yml` dependency-build step must also
build `@klicker-uzh/graphql`. The added PWA contract tests import its generated
operations and persisted-query map. CI initially omitted that dependency and
failed with missing `dist/ops` and `dist/client.json`. Main session owns this
one-line verification correction; test it with GraphQL output initially absent.
Do not change application source solely to accommodate the test runner.

Each substantive committed slice receives the required simplifier and bounded
authentication risk review, with accepted corrections verified before its
successor. Final review covers the exact committed integrated range after local
checks. One draft PR is appropriate despite cross-layer edits: cookie issuance,
SSR/client state and API selection form one inseparable identity contract;
independent layers would expose inconsistent behavior. Reassess topology only
if an independently useful capability or unrelated concern appears.

## Planning review and progress

Astra plan hardening: round 1 returned REVISE; all seven findings were accepted
after verifying the affected callers, pre-query rendering, deletion transaction
ordering and shared cookie consumers. Round 2 returned REVISE on memory-only SSR continuity and credential-free
reload. Both were accepted: Edit Profile no-launch becomes client-renderable;
SSR-required chat retains explicit recovery; ambient versus explicit sources
are distinguished; incompatible SSR hydration is discarded; reload settles
anonymously with frame-aware relaunch guidance. Round 3 returned APPROVED. Record each finding and its verified disposition
in the gitignored `project/_local/reviews/2026-10-06-olat-session-plan-hardening.md`.
The earlier Astra investigation consultation remains evidence, not approval of
this new implementation plan. The optional opposing-provider CLI reported missing authentication; no
qualified opposing-provider opinion was obtained; unavailable optional consultation does not replace or
block the required Astra loop.

Status: all planned source slices and the registration, CI and React corrections
are committed. Host execution permissions were restored; the exact task runtime
started successfully with installed Devrouter 0.1.3 and Devsy 1.19.0. All ten
Chromium journeys pass, including observed native third-party-cookie blocking.
Firefox cannot launch on this host; its browser acceptance remains open. The
corrected-head integrated review, publication and exact-head CI remain pending.
Draft [PR #6414](https://github.com/uzh-bf/klicker-uzh/pull/6414) targets `v3`.
The native goal remains incomplete until every terminal gate is accounted for.

### Implemented slices and review disposition

- Plan commit `a8a1035` contains the Astra-approved contract. Slice 1 (`5176746`)
  and credential correction (`edf4eb2`) passed authentication review, including
  rejection of OTP/activation credentials and expired ambient-cookie coverage.
- Slice 2 (`bdd95c0`) passed authentication review across all 22 changed paths.
  Astra's middleware simplification is in `7c03f66`. Source and client session,
  cookie cleanup, cache isolation, logout and deletion contracts are implemented.
- Slice 3 (`09db305`) includes profile recovery. Astra removed redundant derived
  state in `cc04910`. The reviewer found a transient retry before route readiness;
  `2dce64a` gates settled recovery surfaces on `router.isReady`, and the same
  reviewer returned DONE for the correction.
- Slice 4 (`3cc565b`) adds the dedicated browser harness, documentation and ADR.
  Astra found no justified simplification. Authentication review returned
  DONE_WITH_CONCERNS solely because browser proof is absent. The profile
  assignment correction (`b5e6444`) passes exact-once inventory and selector checks.

Reports remain in gitignored `project/_local/reviews/`. Source review does not
establish browser acceptance or incident attribution.

### Source verification

The integrated production build passed 23/23 tasks. After the route-readiness
correction, the PWA production build passed independently; all 25 PWA and 31
backend unit tests passed. Backend tests include 20 signed-bearer/audience cases;
browser-session/cache coverage adds four contract tests.

The accounts, account-linking and login suites passed 33 tests with zero skips
in a fresh marked disposable database under the restricted role. Exact database,
Redis and network resources were removed and verified. No retained database or
production record was changed.

Serial package checks passed 34/35 tasks again after the React correction. The
remaining GraphQL schema diff command cannot run because the pure-check container
lacks Git. Git is required to run on the host by repository policy; the host
generated schema diff is empty, and standalone GraphQL TypeScript and element-import
checks pass.
Root lint passed 7/7 tasks. No schema, dependency or unrelated source change is
included.

The dedicated harness TypeScript check passes, as do all 18 shard/selector checks.
The complete CI/host policy selection now passes 125/125 tests using the existing
Volta-routed tools. The earlier version-selection failure is resolved without a
global tool change. Touched-file formatting, syncpack, agent links, retired-artifact
policy, Prisma sync, documentation links, diff checks and redacted secret scans
pass. The root `check:all` aggregate remains unpassed; these independent results
do not substitute for it.

### Open gates and next action

Automated review exposed a registration continuity gap. Edit Profile's bare
redirect discarded a fresh verified registration launch; Create Account could
then select an older LTI cookie or lose the LTI context entirely. The local
correction carries only the already verified signed handoff in the redirect.
The dedicated browser harness adds old-cookie and missing-cookie registration
coverage. This correction and the unit-CI dependency fix are committed in
`986d2d936c`. The render-phase correction now projects a private client/session
and applies retained state only on commit. A React 19.2.8 StrictMode prototype
using the actual hook passes fresh credential, cache isolation, late-result,
retired-request and truly abandoned-render checks. This is renderer-level
evidence, not browser acceptance. The corrected PWA production build, TypeScript
check, all 25 PWA tests and lint (zero errors, 12 existing warnings) pass. Pure
projection and guarded commit regression coverage extends an existing test.
Astra required reconciliation of a stale candidate even when its desired token
and revision are unchanged; the concurrent-commit prototype verifies that
accepted safeguard. React correction `6f048e96bc` passed simplification. The
independent authentication review found a queued request could pass an early
guard, then reach transport after retirement. `cc3d8a804f` moves the guard after
asynchronous auth and persisted-query processing. A frozen-source probe reproduces
the old request and proves the correction rejects it without fetch or navigation,
retaining the new identity. The same reviewer returned DONE for the correction.
Its actual runtime reports GPT-6 with effective provider unknown; no GLM provenance
is claimed for that pass.

The task uses the existing `/Users/roland/.volta/bin/devrouter` 0.1.3 through
per-command selection. No global tool configuration changed. Canonical startup
proved the `pwa` profile ready at the exact worktree. The host Playwright dependency
metadata was stale; the locked host-only test dependency set was refreshed after
stopping the managed runtime, which was then started canonically. Host launcher
policy tests pass 39/39. The root aggregate still cannot complete in the container:
its host-only launcher tests correctly reject that execution boundary. This is a
verification limitation, not an application failure.

The resumed browser harness exposed two fixture/setup defects: a host-only parent
domain cookie did not reach the PWA subdomain, and a synthetic practice-question
instance lacked its normal statistics record. Both are corrected in the harness.
Chromium's local-network gate also blocked the synthetic public LMS from reaching
localhost; only that local check is disabled in the test browser. Cookie policy
must still be observed on the actual launch request. No production source changed
to accommodate these fixtures.

The dedicated Chromium 145.0.7632.6 lane passes 10/10 journeys with no skips:
fresh launch replaces retained A with B, quiz submission saves only B's response,
registration retains the verified launch despite an older or missing LTI cookie,
injected storage denial supports navigation and anonymous reload, query retry
recovers B, and successful logout cannot restore the old identity. The blocked
project observes the exact launch through CDP's network extra-info event: the
participant cookie is absent and its native blocked-reason list is nonempty.
Playwright's earlier intercepted request headers retained the cookie before
policy was applied; the initial restriction failures were an observation defect.
A separate native network probe confirmed ThirdPartyPhaseout. Experimental CDP
policy overrides and persistent profiles were removed; the committed harness
uses the original phaseout flag with post-policy network evidence. Storage and
query faults remain explicit harness injections, separate from native proof.

Firefox 146.0.1 could not launch headless or headed. The bounded headed retry
ends after 30 seconds before reaching the application, reporting macOS sandbox
extension denial for its plugin container and GPU/framebuffer failures. Neither
Firefox Standard nor explicit blocking acceptance executed. No OS, browser
security or agent configuration was changed. This is a host capability gap,
not evidence of an application failure or Firefox-specific incident cause.

Actual agent-browser interactions passed synthetic password login, authenticated
profile, locale change, compact layout, logout and settled anonymous recovery.
Eight inspected English desktop/German compact screenshots cover authenticated,
anonymous, expired embedded launch and query-error states. Captures and their
manifest remain in ignored project/\_local/screenshots/olat-recovery/; native forge
publication and rendering verification are pending. Personal incident screenshots
are excluded from public evidence. The dedicated browser config starts after
verified ltijs handoff and cannot establish real OLAT/OIDC launch behavior.
Ordinary hosted CI skips this manual lane and cannot establish its acceptance.

The requested Claude Opus consultation produced no analysis because OAuth
refresh failed. The ordered integrated-review fallback tried AGY Gemini 3.8 Flash
high; its headless read-file permission was denied, producing no qualified review.
No account or permission configuration was changed. The final-review continuity child reviewed the entire 36-path published package
and returned pass with zero findings; requested GLM 5.3 Flash max provenance
remains unverified by the native runtime. Its output passed the canonical JSON
schema. That review covers the published head only; the committed corrections require
the integrated final correction pass. Browser acceptance remains open.

The task target remains `v3` at `6189a7487b912a1d9e95769b2f3bb6434c34ccea`.
The draft head `3c7268fc6d05d4bd4b56cd679872babd04140777` is published; its
hosted unit-test failure is diagnosed: the dependency step omitted generated
GraphQL outputs needed by the PWA tests. The one-line workflow correction is
committed locally with the registration correction. An empty isolated GraphQL
output volume reproduced the missing-module failure; the corrected dependency
step passed 7/7 build tasks and all 25 PWA tests.

Host permissions have been restored and the target was fetched again: `v3`
is unchanged. Registration/CI, React commit ownership and queued transport
corrections are committed. Commit the corrected browser harness and this evidence,
then resume the same integrated reviewer for its focused correction pass on the
complete immutable branch range. Publish through an ordinary task-branch push,
update the draft with the inspected screenshot gallery, and observe exact-head CI.
Stop and verify the exact managed runtime and owned browser session after the
last dependent check. Preserve the primary checkout and leave Firefox acceptance
as an explicit open gate. Hosted CI is not green merely because local checks pass.
No merge, production activation or deployment is included. The earlier host
permission blocker is historical; the native goal remains incomplete until
Firefox verification and all other terminal requirements are fulfilled.
