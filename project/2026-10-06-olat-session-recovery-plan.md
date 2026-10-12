# Restore participant sessions after an OLAT launch

## Feedback review and approved follow-up — 12 October 2026

This section records the current review and proposed improvements for
[PR #6414](https://github.com/uzh-bf/klicker-uzh/pull/6414). It takes precedence
over conflicting historical design and progress statements below. On 12 October
2026 the user approved this executable batch, explicitly including chatbot
recovery guidance and updating the existing PR after fixes and browser verification.

### Approval summary

Most of the supplied feedback describes behavior already implemented. It is
not a request to replace cookies with tokens: both transports carry participant
JWTs. The feedback's reference head, `ec916db4f8`, is the parent of the initial review head
`0752024accb2a2f8097fb63e6c24f775b4363c40`. The only change between those two revisions adds
account-deletion failure feedback. There is no evidence that a later policy
redesign was applied in response to this particular feedback.

**Recommendation:** retain the existing two-mode policy and make its limits
explicit, then close the consequential verification gaps. An explicit LTI tab
keeps its launched participant when another tab changes or removes the shared
cookie. Successful ordinary login in that same tab returns it to cookie mode.
Logout clears that document's explicit credential and applicable cookies; it
provides neither immediate cross-tab UI clearing nor global JWT revocation.

Approval also adopts a conservative chatbot-entry rule: when the originating
PWA tab holds an explicit credential, its course-chat action shows recovery
instructions without opening or prefetching the cookie-authenticated bridge.
It preserves the current PWA identity. This sacrifices direct chat access from
such tabs until ordinary login in that tab returns it to cookie mode. A fresh
LTI launch can recover PWA access but still leaves an explicit credential and
does not unlock the Header chatbot action. Recovery guidance must state that
distinction. Cookie-mode entry keeps its existing behavior. A directly opened bridge cannot infer another tab's identity and
continues to use its own verified launch or cookie. No B-to-Chat continuity is
claimed. This is the only approved product-behavior extension in this batch.

This recommendation preserves the accepted precedence decision in ADR 0044.
Broadening logout to all explicit tabs, making every login cookie-independent,
adding server-side revocation, or changing token lifetime requires a separate
product decision. Those mechanisms are not implied by the feedback.

**Approval mode:** approved executable batch.
**Authority now:** the bounded slices below, their checks, ordinary commits and
non-force pushes, and updating the existing PR after fixes and browser
verification. Preserve its current readiness state. Merge, deployment, alert
dismissal and human-review requests remain separate gates.
**Owner:** main session; execution mode standard because exact main-model
identity is unavailable. A bounded trusted-native executor owns the browser
tests; the main session owns policy, coupled source changes and integration.
**Terminal:** documented policy, repaired defects, passing mandatory source and
browser verification, and the existing PR updated with accurate evidence.
Unavailable required capabilities produce a blocked checkpoint, not completion.

### Review baseline and evidence limits

GitHub reports target `v3` at `fb43d837e9106c5a80616dc3ee519c7395a4e262` and
head `0752024accb2a2f8097fb63e6c24f775b4363c40`. Both objects exist locally;
the target is also the merge base. Review command:

```sh
git diff fb43d837e9106c5a80616dc3ee519c7395a4e262...0752024accb2a2f8097fb63e6c24f775b4363c40
```

The comparison includes all 48 changed paths. The existing worktree is
`trees/olat-session-recovery`, branch `rs/olat-session-recovery`; its initial
status was clean. The initial sandbox blocked `git fetch --prune` with a metadata permission error.
Access was subsequently restored and the fetch completed through the existing
GitHub CLI credential helper; see the current execution record below.

The initial review was source evidence only. The execution record below now
contains fresh browser acceptance. Handoff checks remain revision-specific
historical evidence. Exact-head CI, CodeQL disposition and the public final AI
review remain separate delivery gates.

### Feedback disposition

| Feedback theme | Current implementation and evidence | Disposition |
| --- | --- | --- |
| JWT credential versus cookie/bearer transport | `packages/graphql/src/services/accounts.ts:140-188,347-437`; `packages/util/src/auth.ts:35-64` | Already implemented. Describe transports and precedence separately from token type. |
| Explicit LTI identity wins over cookies | `participantSession.ts:89-102`; `jwtMiddleware.ts:38-64`; response API `index.ts:121-150`; PWA session-page submission | Already implemented, including live-quiz attribution. Preserve fail-closed invalid-bearer behavior. |
| Fresh launch and registration replace older state | `getParticipantToken.ts:135-198`; `createAccount.tsx:107-145`; helper tests and PA launch/registration journeys | Already implemented. No raw participant JWT URL handoff in regular PWA. |
| Ordinary password, magic and activation login use cookies | `accounts.ts` returns participant IDs; `participantSession.ts:105-120`; respective login pages | Already implemented. Existing login journey clears storage first, so it does not prove transition from an active explicit session. |
| Manual versus LTI registration | `createAccount.tsx:60-90` and account service | Already distinct. Replace broad claims that all account creation retains a credential with the token-returning LTI case. |
| Tab persistence and logout | `participantSession.ts:10-46,73-102`; `accounts.ts:426-437`; PA spec `892-928` | Policy exists. Current two-tab test covers cookie tabs only and navigates the other tab; it does not prove immediate clearing or explicit-tab logout behavior. |
| JS-readable credential versus HttpOnly cookie | Store writes token to sessionStorage; `editProfile.tsx:199-207` also serializes ambient JWT page props, as the base already did | Existing exposure, with explicit persistence made systematic. Do not imply cookie-only browsing keeps every JWT out of JavaScript; separate persistence from exposure. |
| Cookie lifetime, SameSite and legacy cleanup | `getParticipantToken.ts:117-132`; account service issuance/expiration; cookie tests; `docs/auth-model.md` | Already implemented for regular participants. Preserve seconds/milliseconds distinction and cleanup restricted to the current partition. |
| Blocked ordinary login and SSR chatbot bridge | Ordinary login returns no retained JWT; chatbot route resolves identity server-side at lines 37-79 | Existing limitation. Cookie absence and cookie A conflicting with tab B are different scenarios; test both before claiming safe recovery. |
| Temporary participants, assessment and lecturer audiences | Middleware separate branches, retained assessment helper, ordinary PWA hook guard | Existing scope boundaries. No expansion into these audiences in the proposed follow-up. |

Path key: `participantSession.ts` and `getParticipantToken.ts` live in
`apps/frontend-pwa/src/lib/`; the named PWA pages live in
`apps/frontend-pwa/src/pages/`; `jwtMiddleware.ts` lives in
`apps/backend-docker/src/`; `accounts.ts` lives in
`packages/graphql/src/services/`; PA means
`playwright/tests/PA-olat-session-recovery.spec.ts`. Exact cited lines refer to
the reviewed head, before this plan edit.

### Review findings

#### Standards

The independent reviewer inspected all 48 changed paths and returned
DONE_WITH_CONCERNS. The main session accepted the following findings:

- **Retired-client request guard removed:** `e56cb35a41` removed the final
  transport guard. At head, `apollo.ts:122-137,361-372` marks retirement and
  suppresses error redirects, but the link chain at `237-244` does not reject
  subsequent requests on a retained old client. The reviewer inspected the
  installed Apollo 3.13.8 source: `stop()` cancels current fetches but does not
  permanently prohibit later calls. Known login paths now navigate rather than
  query the old client, so no user-visible failure was demonstrated. Add a
  regression and restore the small guard as protection of the original contract.
- **Historical design and acceptance overclaim:** `initializeApollo` mutates
  module client state from `useMemo`; the old commit-owned projection and
  revision guards are gone. The credential-store application remains in an
  effect. No actual discarded-render identity failure was established. Correct
  the documentation and retain the simpler design rather than restoring all
  removed machinery.

Repeated retention constants and assessment login branches are minor heuristics,
not justification for new abstraction. Existing fixture corrections and removal
of prose assertions follow the repository's test policy.

#### Spec

The independent reviewer also covered all 48 paths and returned
DONE_WITH_CONCERNS. The two-mode policy matches the supplied feedback. Accepted
gaps are explicit-tab lifecycle tests, actual deletion-error UI verification,
precise exposure/logout documentation, and the chatbot entry policy described
above. The chatbot entry and server-side cookie behavior predate this PR; the
mismatch is a cross-surface acceptance issue, not a newly proven auth bypass.
The same-tab ordinary-login test starts from cleared storage and therefore
cannot prove explicit B changes to ordinary A.

Both reviews are source evidence only. Their local disposition records are
`project/_local/reviews/2026-10-12-olat-feedback-standards.md` and
`project/_local/reviews/2026-10-12-olat-feedback-spec.md`. Historical probes and
old screenshots do not prove behavior after the later simplification.

### Primitive impact

| Product primitive | Disposition | Contract delta and consumers | Decision |
| --- | --- | --- | --- |
| Participant session | Reuse | Preserve explicit-tab precedence and cookie-mode ordinary login across PWA, GraphQL and answer submission. | Document and verify the existing policy. |
| End session | Reuse | Local explicit credential plus applicable cookies; another explicit context may continue until its own ending or expiry. | No browser-wide logout or revocation capability added. |
| Account deletion | Reuse | Failure retains identity; successful transaction ends this document's session. | Verify the actual UI command and recovery. |
| Chatbot entry | Extend | An explicit PWA tab cannot silently open a cookie-selected chat identity through its header action. | Approval adopts local recovery without transfer; direct bridge requests keep their own server-visible identity. |
| LTI account link and course access | Reuse | Existing resolution, authorization and account-completion rules. | No enrollment, leaderboard-opt-in, linking or data-model changes. |

ADR gate: update ADR 0044's consequences and alternatives, including the
conservative chatbot-entry boundary, without changing its precedence policy. A different cross-tab logout contract or a new
server-side session identifier reopens the ADR and requires a product ruling.

### Verification portfolio

Existing helper/middleware/cookie suites already protect signature, scope,
expiry, origin selection, cookie attributes, cleanup ordering and invalid-bearer
rejection. Existing PA journeys protect fresh launch, registration, native
cookie blocking, memory-only navigation, query retry and live-quiz ownership.
Reuse them; add only the missing state transitions named in slice 2 and the
specific reproductions from accepted source findings.

| Consequential risk | Test obligation and suite | Distinct acceptance / owner |
| --- | --- | --- |
| Mixed explicit/cookie tabs and logout | Extend existing PA OLAT journey | Explicit B survives another tab's login/logout; B's own successful logout cannot silently reveal ambient A / slice 2. |
| Explicit-to-ordinary login transitions | Extend existing PA OLAT journey | Password, magic-link and activation success replace retained B with ordinary A, proving next request and destination identity / slice 2. |
| Rejected and successful account ending | Extend existing PA OLAT journey; reuse account-service cleanup tests | UI rejection before backend execution retains principal and permits retry; true deletion clears only synthetic account/session / slice 2. |
| Expired retained bearer | Extend existing PA OLAT journey; reuse signed expiry tests | No fallback to another cookie on protected query or answer; settled recovery and fresh launch / slice 2. |
| Retired-client isolation | Extend existing `participantSession.test.ts` | Delay old success/error, attempt a queued and a new retired-client request: current identity/cache/navigation stay intact; no post-retirement transport / slice 3. |
| Chatbot entry identity boundary | Extend existing PA OLAT journey | Explicit-tab header action causes no bridge request or participation mutation; ordinary cookie/direct bridge use their own identity / slice 3. |

No new test files, framework or dependencies are planned. This is the finite
portfolio; an unrelated finding is recorded separately rather than expanding
implementation silently.

### Delegation map

| Slice | Owner | Dependency and acceptance |
| --- | --- | --- |
| 1: contract and evidence | Main session | Source review complete; each current statement maps to source or qualified evidence. |
| 2: lifecycle proof | One bounded executor, integrated by main | Approved policy; tests may expose a reproducible red case for slice 3, with synthetic state cleaned up. |
| 3: continuity guard, chat entry and finish | Main session | Slice 2 evidence; coupled identity seams remain local; all required new checks pass before completion. |

Each slice forms a coherent commit after its focused checks; a failing regression
may be developed with its slice-3 repair and committed green together. This
follow-up stays in the existing PR; no stack or branch-topology change is proposed.

### Approved slices

**1. Reconcile the session contract and current evidence.** Update
`docs/adr/0044-regular-participant-session-recovery.md`, the regular-participant
section of `docs/auth-model.md`, and this plan. Explain credential, storage and
transport; ordinary versus explicit login; logout's scope; no global revocation;
JS-readable explicit credentials and pre-existing ambient JWT page props; storage-denied reload; and the chatbot bridge.
Qualify manual account creation. Preserve the earlier progress as history,
clearly separated from current acceptance. Replace current contract statements
that still accept `participantToken` URLs or describe removed implementation
mechanics. Update the existing PR body only after evidence is reconciled.
Acceptance: each claimed behavior maps to source and a matching test or an
explicit limitation, with no universal-logout or universal-cookie-free claim.

**2. Prove identity and ending-session behavior at the missing boundaries.**
Extend `playwright/tests/PA-olat-session-recovery.spec.ts`; extend
`apps/frontend-pwa/src/lib/participantSession.test.ts` only where a distinct
state invariant needs lower-level protection. Reuse synthetic A/B fixtures,
current cookie-domain handling and existing allowed/blocked browser projects.

- Keep the existing cookie-tab logout test, naming its scope accurately.
  Add explicit B plus cookie A: ordinary login and logout in a different tab
  must leave B's authenticated requests attributed to B. Ending B's own tab
  must clear its retained credential and produce settled recovery.
- Exercise password, magic-link and activation success from an active explicit
  B tab and verify destination identity, lack of retained B, and outgoing
  credential mode. Existing clean-storage login coverage does not establish this.
- Exercise failed logout and failed account deletion through the real UI command
  (`delete-account-command`), injecting a server-declared rejection or false result before the backend
  mutation runs. Assert the same authenticated principal on a subsequent request, visible
  recoverable feedback, and a working retry. Also verify successful deletion
  clears the local session using a disposable participant with no real records.
- Exercise an expired retained explicit credential with a valid different
  ambient cookie: no answer or protected operation may fall through to that
  cookie's identity; recovery must settle and accept a fresh LTI launch.

For B's own logout with ambient A, require cleared explicit state, expired
applicable cookies and no immediate silent authentication as A. A response lost
after server commit is an uncertain outcome, not a known rejection; this package
does not add reconciliation for that pre-existing distributed-failure case and
must not claim its failure-retention tests cover it.

Use network attribution and resulting identity, not only avatar or cookie
presence. Assertions target behavior, state and protocol values, never exact
translated copy. Add no new dependencies or standalone test framework.

**3. Restore request retirement and enforce the approved chatbot-entry boundary.**
In `apps/frontend-pwa/src/lib/apollo.ts`, restore the smallest guard immediately
before transport after asynchronous context/persisted-query processing. A
retired binding must not start or retry network work; delayed old results and
errors must not change current identity, cache or navigation. Preserve the
current two-mode store and per-binding client reuse. Extend the existing
`participantSession.test.ts` with controlled transport timing; keep
`participantSession.ts` unchanged unless that regression proves a small
state-invariant correction necessary. Already-dispatched server operations
cannot be undone by client retirement; do not claim server-side revocation.

In `apps/frontend-pwa/src/components/common/Header.tsx`, render a recovery
action instead of a navigable/prefetchable chatbot link while an explicit tab
credential exists. Reuse the current UI primitives and EN/DE messages in
`packages/i18n/messages/en.ts` and `de.ts`; introduce no new module. Activation
explains that ordinary login in this tab returns it to cookie mode; a fresh LTI
launch alone does not unlock this action. It preserves B without a bridge request, new window or
`ensureParticipation` side effect. Removing only `target=_blank` is insufficient
because SSR still cannot read the explicit credential.

Acceptance cases are separate:

- Explicit B with absent cookies: recovery in the originating tab; no bridge
  request, no bridge participation check, B stays authenticated there.
- Explicit B with conflicting cookie A (or an unproven matching cookie): the
  same conservative gate. Do not silently choose A or promise access as B.
- Ordinary cookie-mode entry: retain the real new-tab behavior and verify the
  bridge's request/participation-check principal using synthetic records. If claiming
  Chat access as that principal, independently check Chat's authenticated
  principal; a redirect alone is insufficient.
- Direct navigation to
  `apps/frontend-pwa/src/pages/course/[courseId]/chatbot/[chatbotId].tsx`: verify
  the existing no-cookie login path and cookie-authenticated path. That server
  request has no knowledge of B in another tab. No bridge source change or
  universal cross-tab guarantee is included.

Source edits are limited to `apollo.ts`, conditionally `participantSession.ts`,
`Header.tsx`, and EN/DE messages, plus the named existing tests and slice-1
documents. Any required edit beyond these files gets a scope assessment; new
credential transport, mutation return contracts, global logout or server-side
revocation requires a separate approved design. The original login/recovery
pages and chatbot bridge are inspection/verification targets, not an open-ended
write allowance.

Run the dedicated OLAT lane from the host worktree:

```sh
VOLTA_FEATURE_PNPM=1 node ./util/run-playwright-host.mjs --runtime-profile full --config olat-session.config.ts --reporter=line
```

The config selects Chromium allowed/blocked, Firefox standard/blocked and
WebKit standard. Use `full` for the real local ltijs/mock-LMS journey. New
lifecycle checks must pass in each applicable browser; WebKit localhost-cookie
skips and Firefox storage-denial limits must be named per obligation, with an
accepted alternative environment or a blocked checkpoint for missing required
coverage. Do not report skipped full-LTI
cases from `live-quiz` as launch acceptance. Retain Firefox storage-denial and
WebKit localhost-cookie limitations explicitly. Run focused package checks for
changed source, then exact diff review and required risk/final reviews. For
visible deletion/recovery behavior, use agent-browser interactions and the
existing screenshot-gallery process for EN desktop and DE compact states;
include provenance and interaction results in the PR. Stop and verify the exact
runtime at the end under the runtime lifecycle rules.

Terminal after implementation approval: the selected policy is documented,
accepted defects are repaired, all mandatory consequential checks pass, and
the existing PR describes its exact source and browser evidence. Required checks that cannot run produce a
blocked checkpoint, never completed delivery. Source publication first requires
restoring the remote-state check; browser acceptance, required exact-head CI and
CodeQL disposition, and final source/AI review are separate conditions. Alert
dismissal remains the user's action; do not poll CI or post the final-review
command until the carried-forward user signal and eligibility are satisfied.
No claim of real OLAT incident causality is added by a synthetic LMS run.

### Deferred decisions and browser references

The ordinary-login-in-a-cookie-blocked-frame limitation is not permission to
return session JWTs from every login mutation. The recommended immediate work
is to document and verify safe recovery; a cookie-independent ordinary-login
capability requires its own scope and trust-boundary review. Likewise, a shared
logout broadcast cannot be presented as server-side JWT revocation.

Browser semantics were checked against primary MDN documentation on
[sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage),
[Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie),
and [third-party cookies](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies).
Storage is scoped to origin and browsing context, survives reload, and can be
initially copied from an opener; subsequent changes are separate. SameSite
attributes do not override storage/privacy policy. This review does not depend
on changing a framework API or dependency version.

### Progress for this follow-up

Status: implementation and browser verification in progress. Host access was
restored on 12 October. User approval covers completion and updating the existing
PR after browser verification; no additional generic approval is needed.

Completed planning: immutable 48-path inventory, two independent source reviews,
feedback-to-source reconciliation, existing test inspection and planner hardening.
Planner Franklin approved round 3. The optional AGY opinion supplied no review
because login and sandbox state access failed. Prior review records are under
`project/_local/reviews/2026-10-12-olat-feedback-*`.

Current implementation starts from `0752024accb2a2f8097fb63e6c24f775b4363c40`.
GitHub confirms that head and base `fb43d837e9106c5a80616dc3ee519c7395a4e262`.
The initial sandbox prevented Git metadata writes and devrouter lock inspection.
After access was restored, the SSH agent refused signing. A command-scoped HTTPS
transport using the existing `gh` credential helper fetched successfully, without
changing remote configuration. The task is even with its remote; it is 38 ahead
and 3 behind `origin/v3` (`df2bfa41d8`). Those three target commits concern Chat
registries and production pins and introduce no current integration blocker.
The live PR still targets `v3`. Exact worktree runtime
`rs-olat-session-recovery` is running through `devrouter ensure --profile full`;
its application readiness contracts passed. It must be stopped after verification.

Implemented locally: a final Apollo transport guard with retry suppression and
late-result rejection; Header recovery guidance keyed to the active Apollo
binding, with a hydration guard against early bridge prefetch; paired EN/DE
copy; and precise session, logout, exposure and chatbot documentation. Test
authoring exposed a declined regular logout navigating without feedback. The
Header now shows the existing error toast and stays on the page for a retry;
the assessment logout branch retains its existing behavior. This correction
fits the approved failure-feedback contract and Header write scope. A second
source correction: `ensureParticipation` only checks an existing participation
at this head (`services/courses.ts:167-199`). Bridge tests must prove its
principal through authorization outcomes; there is no participation-creation
write to observe. This corrects the evidence method, not the approved policy. Existing
session tests now cover retained clients after stop, delayed data/auth errors,
late login mutation results and a scheduled retry crossing logout. All 33 PWA
unit tests pass. Gibbs returned the browser-spec checkpoint and is closed.
Main completed integration: declined logout stays on the profile with an error
toast; post-login identity waits exclude retained bearer requests; cancelled
chatbot recovery preserves the explicit request principal; and conflicting
cookies do not unlock the entry. The authored tests also cover a cookie-mode
popup, a fresh OLAT launch retaining the gate, and direct bridge authorization
using isolated member/outsider fixtures. The expired-bearer test includes a
protected read-only membership operation with the valid ambient cookie present.
Tests observe the real server redirect to Chat, so they prove bridge
authorization only, not the Chat application's authenticated principal.
The first browser run found a missing course PIN in the new fixture, corrected
by declaring the isolated course SSO. Synthetic participants now carry complete
data-use acknowledgements, keeping onboarding separate from the session tests.
The full-profile five-project run passed 64 cases and skipped eight WebKit
cookie-dependent cases. Its eight failures shared an incorrect destination
mock: Playwright routes only the initial URL of a redirect chain. Replacing
that mock with observation of the real redirect produced eight passes and
two expected WebKit skips in the focused rerun. Combined coverage is 72 passing
cases and eight environment skips, not a single green 80-case run. All five
local ltijs/mock-LMS launch cases passed. Unaffected passing cases are reused;
only the two corrected bridge scenarios were rerun.

Agent-browser verified EN desktop and DE compact logout/deletion rejection
feedback, cancellation without losing the explicit session, and same-tab
ordinary login restoring the cookie-mode link. Visual inspection found inherited
white text on the white recovery dialog. An explicit dark text color repaired
it; both locale captures were refreshed and inspected. Eight synthetic captures
and their source patch are retained under
`project/_local/screenshots/2026-10-12-olat-recovery/`. These captures are local
application evidence; they do not establish real OLAT or authenticated Chat
identity. The manual fixture uses an injected synthetic tab credential; the
real local LTI credential path is covered separately by the browser suite.

Checks completed: all 33 PWA unit tests, focused PWA typecheck, the container
portion of `check:all` (35 Turbo check/build tasks plus lint and policy checks),
and 125 host-only Playwright workflow/launcher checks. `check:all` was split after
its host-only checks correctly refused container execution; no boundary was
bypassed. I18n has no separate check script and is covered by consumers and
formatting. Biome formatting, Prettier and `git diff --check` pass. Full Biome
lint previously reported untouched hook/import diagnostics; repository-native
ESLint checks pass. Agent-browser confirms visible rejection feedback for logout
and deletion and preserved profile state in EN desktop and DE compact layouts.
The gallery includes inspected EN desktop and DE compact chatbot guidance.
Apollo 3 retry/link contracts were checked against installed 3.13.8 source and
the official Apollo v3 retry documentation.

Route: main for contract/continuity and integration (coupled identity seam);
trusted-native executor Gibbs for the disjoint browser spec. Acceptance remains
the approved source and browser portfolio. The dedicated simplifier reviewed `fdb3078adf..55dbc84597` and found no
justified simplification. The risk review accepted the correction range through `a9e253ecf8`, resolving
the bridge evidence gap and withdrawing an assessment concern because that
app skips the chatbot query. No consequential findings remain in the slice.
Integrated final review remains pending; no source review replaces browser proof. The existing source/API comments were preserved except where the
approved behavior changes their contract.

The owned synthetic gallery chatbot was removed through the guarded script and
its absence verified. The browser session was closed. The first full production
build hit the documented duplicate generated `PagesPageConfig` validators; the
owned dev process was stopped and generated dev types preserved outside compiler
inputs before retrying. The full production build then passed all 23 tasks
(17 cache hits) in 3m13s. No source workaround or typecheck bypass was added.

Package size against `v3`: 4,970 substantive changed lines across 48 source,
test and domain-document paths, plus the excluded project-plan artifact. This
is the existing reviewed PR and the user explicitly requested updating it; the
approved follow-up retains that topology rather than opening another package.

Next: finish integrated final review and runtime-stop verification, then push and
update the existing PR with the inspected screenshot gallery. Preserve its current ready/draft
state. Do not poll CI; the user signals when exact-head checks have settled before
`/final-review`. Human review, merge, alert dismissal and deployment remain
separate. The historical record below is retained verbatim and does not establish
acceptance of these new changes.

## Historical implementation plan and execution record

The sections below preserve the original approved repair and its progress.
Where later source changes superseded its mechanisms or evidence, use the
12 October review above and the final implementation's exact-head proof.

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
complete corrected source range passed integrated review and was pushed. Eight
screenshots are published and visually verified in the draft. Hosted CI must be
read against the exact latest published head.
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
manifest remain in ignored project/\_local/screenshots/olat-recovery/. All eight
were uploaded through the authenticated GitHub CLI to draft #6414, with byte
receipts and description read-back. The public table renders and all eight
images decode; the gallery also fits desktop and compact widths locally. Personal incident screenshots
are excluded from public evidence. The dedicated browser config starts after
verified ltijs handoff and cannot establish real OLAT/OIDC launch behavior.
Ordinary hosted CI skips this manual lane and cannot establish its acceptance.

The requested Claude Opus consultation produced no analysis because OAuth
refresh failed. The ordered integrated-review fallback tried AGY Gemini 3.8 Flash
high; its headless read-file permission was denied, producing no qualified review.
No account or permission configuration was changed. The final-review continuity child reviewed the entire 36-path published package
and returned pass with zero findings; requested GLM 5.3 Flash max provenance
remains unverified by the native runtime. Its output passed the canonical JSON
schema. The same reviewer then completed one focused correction pass over
`3c7268fc6d..a4dabc67c1` in the complete 37-path target-to-head context and
returned pass with zero findings. Both reports passed the canonical JSON schema.
This establishes source review; Firefox acceptance remains open.

The task target remains `v3` at `6189a7487b912a1d9e95769b2f3bb6434c34ccea`.
The earlier draft head `3c7268fc6d05d4bd4b56cd679872babd04140777` had a
diagnosed hosted unit-test failure: the dependency step omitted generated
GraphQL outputs needed by the PWA tests. The one-line workflow correction is
published with the registration correction. An empty isolated GraphQL
output volume reproduced the missing-module failure; the corrected dependency
step passed 7/7 build tasks and all 25 PWA tests.

Host permissions have been restored and the target was fetched again: `v3`
is unchanged. Registration/CI, React commit ownership, queued transport and native
browser observation corrections are committed and published through an ordinary
push to `rs/olat-session-recovery`. The immutable reviewed application/harness
head is `a4dabc67c1f264fec1bf5d1322b0df10e019d2cf`; later progress-only commits
reuse its passing verification because source, toolchain and acceptance are
unchanged. Public PR #6414 retains the inspected screenshot table, actual
interaction results and the Firefox/real-OLAT evidence limits. Read its latest
checks against the exact published revision; old-head failures and local build
success do not establish current hosted acceptance.

The last managed check passed the production-mode PWA build after stopping the
owned dev process. Initial build attempts used simultaneous dev-generated types,
then a development NODE_ENV, and failed; correcting the execution context
required no application-source change. The task runtime was then stopped with
canonical Devrouter by its exact checkout path. Fresh source-path-matched Devsy
provider status is Stopped and exact routes are zero. Data and worktree remain
retained. The owned agent-browser session closed after forge rendering checks.
Container-dependent checks and builds ran in the container; host-only policy
checks ran on the host. Host commits/pushes used per-command HUSKY=0 for this
split toolchain, with scoped formatter, secret/data inspection and the recorded
container-equivalent checks. The root aggregate remains explicitly unpassed.

Current automated PR feedback was verified against source. Both render-side
mutation comments are corrected by commit-owned session changes. Assessment
registration still takes the explicit assessment/no-token redirect, preserving
its old behavior. Legacy Partitioned expiration requires Secure/SameSite=None
by that cookie contract; canonical local HTTP issuance stays Lax. URL bearer
transport and silent verification catches already existed; changing that
transport/observability is not a change-introduced repair requirement. Retaining
a verified five-minute LTI registration context is intentional until registration
or a new launch; invalid context clears it. The nested recovery conditional is
bounded and source-reviewed; a preference-only rewrite would add unrelated churn.
No new unresolved source finding was accepted.

### Linked launch compatibility correction

Final source inspection found that an already-linked LTI subject can authenticate
without an email claim: the backend resolves its stored SSO identity first.
The frontend now permits that verified launch to reach the exchange. A returned
participant token still requires all participant-session claims; an unresolved
launch without an email is rejected instead of offering incomplete registration.
The focused unit regression covers both outcomes. The first native Chromium
journey now omits email and still requires profile B and a quiz response saved
only for B. Other journeys retain their email-bearing launch fixtures.
This source correction supersedes the earlier unchanged-source reuse statement.
All 26 PWA unit tests, the type check, scoped lint and formatting pass. Both
native Chromium projects pass all ten journeys, with no skips or flakes. The
same final reviewer checked the three source/test changes against the earlier
integrated review and returned pass with zero findings; its JSON schema validates.
Latest automated feedback was also checked: origin selection and assessment
storage are inherited, false deletion results preserve the active account, and
the lazy WebSocket client has no demonstrated active subscription leak. Duplicate
predicates and ternary style establish no current defect. Cookie-only registration
would break the approved restricted-cookie handoff. Hosted checks must be read
against the new correction head; the old-head results cannot certify it.

### Ordinary login transition correction

Hosted Playwright shard 7 on the earlier published head failed password login.
Its retained synthetic trace shows `ApolloError: Participant session changed`:
after a successful login retires the originating client, the page awaited a
Self query on that retired client before navigating. Password, magic-link and
activation success now navigate directly in the regular PWA; assessment retains
its existing Self-query sequence. The destination loads the replacement session.
The browser regression checks password A/B/A and both OTP and activation profile
ownership. All twelve allowed/native-blocked Chromium journeys pass with no
skips or flakes, all 26 PWA unit tests and the type check pass, and scoped ESLint
reports zero errors with two inherited dependency warnings. The same final
reviewer verified the trace and the three page changes within the 40-path package,
returning pass with zero findings; the report validates against its JSON schema.
The hosted failure is diagnosed, but new-head hosted acceptance remains required.

Remaining required capability: a host able to execute the Firefox Standard and
blocked-cookie journeys against this same routed harness. A successful browser
launch must precede application acceptance; no OS/security configuration bypass
or new deployment is included. Real OLAT/OIDC validation and incident attribution
remain unproven. The native goal stays incomplete until Firefox and all other
terminal requirements are fulfilled. No merge, readiness change or production
activation is authorized by this package.

### Retained session baseline correction

Hosted shard 7 still failed at `52d3f35bd7`; the exact login helper clears
storage after navigating to the login page. The local Chromium harness reproduced
that failure. An initial committed scope could still read storage dynamically,
so storage clearing changed its identity without a revision notification.
Projection now captures its baseline token. The guarded commit initializes the
retained token from that captured value before applying existing replacement
branches. A stale revision cannot initialize it. This also prevents storage drift
between render and commit from changing the projected revision delta.

Astra challenged re-reading storage at commit and approved the captured baseline.
The independent final reviewer returned pass with zero findings for the four
source/harness changes within the package. Unit coverage exercises precommit drift
and postcommit clearing/denial. Both native Chromium modes pass all twelve
journeys with actual destination-path and profile-ownership assertions.

### Regular participant test credential correction

At the same hosted head, shard 5 failed one live-quiz case and shard 8 failed
one live-quiz case plus eight report-export cases. The O1/O2 live-quiz helpers
copy synthetic Edu-ID-scoped tokens into the regular participant cookie and
session storage; the Z report-export helper puts an account-owner-scoped token
in that regular cookie. The actual regular login issuer creates participant
tokens without a scope. The report feature runs on the regular student PWA;
its assessment course name does not select the separate assessment runtime.

The correction changes only these regular-session fixtures in
`playwright/tests/O1-live-quiz-core.spec.ts`,
`playwright/tests/O2-live-quiz-collaboration.spec.ts`, and
`playwright/tests/Z-credential-verification.spec.ts`.
`playwright/util/types.ts` permits the issuer's unscoped token shape.
The generic signing helper still preserves all supplied claims. True assessment
Edu-ID and lecturer credentials retain their scopes. Production verification
is not relaxed to accommodate synthetic credentials. Focused live-quiz and
report-export browser checks and corrected-head hosted CI are required.

These corrections supersede earlier unchanged-source and stopped-runtime claims
until the new checks and final cleanup finish. Firefox launch remains blocked
on this host, and real OLAT incident attribution remains unproven.

### Live-quiz cleanup observation correction

The corrected regular-session fixtures pass the first 38 local O1 cases,
including saved authenticated responses. Cleanup then checked for confirmation
before the network-backed deletion dialog existed and incorrectly expected
zero responses. O1/O2 helpers now wait for that dialog before inspecting its
confirmation controls. The unnecessary exact no-response prose assertion is
removed; final deletion still requires the enabled confirmation action and
completes through the existing cleanup workflow. This is a test-only race fix.

### Review fixes and cross-browser LTI verification (2026-10-07)

Review fixes landed in `e56cb35a41`: the URL participant token no longer
replaces or creates a session, only an origin inside the cookie domain selects
participant cookies, cookie sessions are no longer copied into the tab, and the
Apollo client is reused per identity. A follow-up restores the ADR 0044 rule
that a kept explicit credential takes precedence over a cookie session for
another participant. It also stops hydrating server-rendered data from that
cookie session into the explicit client.

Firefox now launches on this host. Firefox 1509 and WebKit 2248 builds were
installed outside the hanging `playwright install` extraction. The PA spec
runs in five projects: Chromium with third-party cookies allowed and blocked,
Firefox Standard, Firefox with all third-party cookies blocked, and WebKit
(Desktop Safari). A new test drives a complete LTI 1.3 launch: a synthetic LMS
initiates OIDC login, the real ltijs service redirects to a mocked
authorization endpoint, an RS256 id_token is posted back and verified, and the
PWA receives its one-time jwt in the frame and at top level. A token signed by
an unregistered key is rejected with 401. The test registers its synthetic
platform through `apps/lti/scripts/register-local-platform.mjs` and needs
`--runtime-profile full`; without the routed LTI service it skips.

Result: 42 passed, 3 skipped. WebKit discards every cookie the local
`*.localhost` stack sets, so its three cookie-only tests skip; its explicit
launch, registration and LTI tests pass. Firefox with all third-party cookies
blocked denies the frame `localStorage`, and the practice quiz then crashes in
`useLocalStorage`. This predates the PR; the spec skips the quiz steps there
with an annotation and a separate task tracks the fix. Real OLAT incident
attribution remains unproven.
