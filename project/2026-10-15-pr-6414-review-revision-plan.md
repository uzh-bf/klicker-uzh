# PR #6414 review revision: embedded sessions, launch safety, simplification

Branch `rs/olat-session-recovery`, [PR #6414](https://github.com/uzh-bf/klicker-uzh/pull/6414), target `v3`.
Continues [the original plan](2026-10-06-olat-session-recovery-plan.md); that file stays the history of the first package.
Execution mode: `solo` (main session implements, simplifies and self-reviews; independent review noted below).
Approval mode: `executable batch`.

## Approval summary

**Why and what changes.** A review of head `e3d00e19` found that the PR removes the
frame-scoped participant session. In v3, an LTI launch inside an OLAT iframe works even
when the browser blocks third-party cookies: the exchanged participant token lives in
the tab's sessionStorage and authenticates GraphQL as a bearer. The PR replaced this with
a "open in a new tab" recovery screen, which every embedded Safari user and every Firefox
user with default tracking protection would hit on every launch. This revision restores
embedded use as it worked in v3, while keeping the shared cross-tab login for top-level
tabs and for frames that have unpartitioned cookie access. It also stops invalid or
foreign-triggered launches from destroying an existing session, fixes four smaller
defects, and shrinks the diff so the PR is reviewable.

**What stays unchanged.** Top-level tabs keep one shared HttpOnly login with revision
sync. No participant JWT returns to URLs. Assessment mode and lecturer authentication
keep their contracts. Chat stays cookie-only and opens in a new tab, as in v3. Live-quiz
answers from a cookie-less frame stay anonymous, as in v3.

**What could change the decision.** Restoring the frame fallback puts a participant JWT
back into JavaScript-readable sessionStorage, but only in embedded contexts without
cookie access, which matches v3 exposure exactly. The alternatives do not deliver "works
as before": `requestStorageAccess` needs a click and, in Safari, a prior first-party visit;
partitioned cookies are not dependable in Safari. Correction to my earlier suggestion:
gating launches on `Sec-Fetch-Mode: navigate` alone does not stop an attacker from
framing the launch URL, because an iframe load is also a navigation and the browser stores
cookies even when `frame-ancestors` blocks rendering. The plan therefore makes rejected
launches write no cookies at all, plus the navigation gate. Pre-existing login CSRF with
a valid attacker-owned LTI token remains and is noted, not fixed. The repository asks for
stacked PRs on large branches; I recommend keeping this single PR, because the branch is
mature and CI-verified, and shrinking it instead. Splitting into a stack is the alternative.

**How we know it is done.** Embedded launches render the profile in-frame in the
blocked-cookie Chromium and Firefox projects. A forged launch leaves another tab's session
intact. Unit, type, lint and full hosted browser checks pass on the final head. The diff
is smaller than today's 4,984 substantive added lines.

**What approval authorizes.** Local commits, pushes to `rs/olat-session-recovery`, CI
runs, one integration of current `v3`, and an updated PR description. Withheld: merge,
deployment, replies to review threads, and any change to the PR's ready/draft state.
The hosted `/final-review` is standing-authorized by the repository, but its last three
runs failed on token budget; I will not re-trigger it without your go-ahead.

## Execution details

### Binding contracts

**Session contexts.** The browser context decides the session mode once per document:

| Context | Mode | Credential | Revision sync |
| --- | --- | --- | --- |
| Top-level tab | shared | HttpOnly `participant_token` cookie | yes |
| Frame with `document.hasStorageAccess()` true | shared | same cookie | yes |
| Frame without access | frame | tab sessionStorage token, sent as `Authorization: Bearer` | no; identity fixed for the tab until the next launch |

Frame mode is entered only from a fresh verified LTI exchange or LTI account creation in
that frame, or from a token already in that tab's sessionStorage. It never upgrades a
top-level tab. Frame-mode logout and deletion clear the stored token. Frame-mode requests
send no `x-participant-session` header.

**Backend selection (PWA origin inside `COOKIE_DOMAIN`).** A present participant or
temporary cookie wins and is the only credential considered, as today. Only when no
participant cookie is present does a bearer apply, and it must verify as a `PARTICIPANT`
token without scope. An invalid cookie never falls back to the bearer.

**Launch handling.** `?jwt` or `lti-token` counts as a launch only on navigation requests
(`Sec-Fetch-Mode: navigate`, or the header absent for old browsers). A valid launch
replaces the shared session and, in frame mode, also yields the frame token. A rejected
or unavailable exchange renders fresh-launch recovery and writes no cookies. An unusable
ambient cookie without a launch is still expired, since only the site itself can set it.

**Token exposure.** The exchanged JWT appears in server props only when the request is
not a top-level document (`Sec-Fetch-Dest` other than `document`). The client keeps it
only when frame mode applies, then strips launch parameters from the URL.

### Findings to slices

| Finding | Severity | Slice |
| --- | --- | --- |
| Embedded Safari/Firefox users lose in-frame use | critical (user ruling) | 1 |
| Forced logout via forged launch from any site | high | 2 |
| Backend outage during launch signs the student out | medium | 2 |
| Every PWA page ships empty HTML until hydration | medium | 3 |
| Refused-cookie login retries the mutation three times | medium | 4 |
| `/createAccount` double navigation leaves a spinner | medium | 5 |
| Stale Chat `?session=` dead-ends at `/noLogin` | low | 6 |
| Temporary login expires a regular login | low | 7 |
| Cookie lifetime drops from 30 to 13 days | low | 7 |

### Slices

Each slice is one commit, verified before the next starts. Routes are all `main`.

1. **Restore frame-scoped sessions.** Start by inventorying pages whose server props make
   identity decisions (`editProfile`, `createAccount`, course pages, chatbot bridge, join)
   and record the v3 behavior for each under a cookie-less frame. Then: `getParticipantToken`
   returns `frameToken` under the exposure rule; `ParticipantSessionBoundary` picks the
   mode; the Apollo auth link sends the bearer in frame mode; `jwtMiddleware` accepts the
   bearer only without participant cookies; `createAccount` stores the token returned by
   account creation in frame mode; logout and deletion clear it. Pages whose server props
   would redirect an anonymous frame request use client-side identity in frame mode,
   matching v3. Update ADR 0044 and the auth model to describe the two modes.
   Acceptance: middleware and resolver unit cases; PA spec blocked projects show the
   profile in-frame after launch and after reload, and a second tab's top-level session
   is unaffected.
2. **Make launches safe to trigger.** Navigation gate plus no cookie writes on `rejected`
   and `exchange_unavailable`. Removes `expireRetainedSession` from the reject path.
   Acceptance: resolver unit cases for subresource requests and rejected launches; PA spec
   invalid-launch case asserts the other tab keeps its identity.
3. **Render pages without waiting for hydration.** The boundary renders children on the
   server and first client render, and withholds them only on a positive stale, mismatch
   or refused signal. Server-rendered data already reflects the cookies that request
   carried, so no other identity can leak. Remove the `_app.tsx` patch from the intl
   smoke script. Acceptance: login and join pages contain their content in server HTML;
   intl smoke passes unpatched.
4. **Stop login retries on refused cookies.** One session link placed above the retry link
   asserts before forwarding, checks after the result, and marks its errors non-retryable.
   This replaces `sessionResultLink`, `sessionGuardLink` and the checks in the error and
   retry links. Acceptance: unit case shows one request and one recovery navigation.
5. **One navigation owner after account linking.** Reproduce first in the browser. Then
   pass the post-confirmation destination to the boundary so `onSessionEstablished`
   performs the only navigation, and drop the page's own effect. Acceptance: PA case
   reaching `/createAccount?jwt=` for a linked account ends on `/editProfile`.
6. **Drop the Chat `session` parameter.** The bridge already confirms the cookie before
   redirecting and Chat's boundary binds the revision its server read, so the parameter
   adds a failure mode without protection. Remove it from the bridge, `proxy.ts` and
   `participantReloadUrl`. Acceptance: Chat auth tests pass; a bookmarked old URL opens.
7. **Temporary login and release notes.** Confirm whether the account selector can appear
   while a regular participant is signed in. Expiring the regular cookie is required for
   the temporary login to take effect, because the backend prefers the regular cookie, so
   the expected outcome is a code comment and no behavior change. Record the 13-day
   cookie lifetime in the PR description.
8. **Simplify the whole diff.** See the next section. Behavior-preserving only.

### Simplification inventory

Applied in slice 8 after slices 1–7 settle, then rechecked with affected tests.

- **Import-order noise.** About 25 files carry reordered imports unrelated to their
  change. Restore base order wherever `biome check` accepts it.
- **Per-page session boilerplate.** Ten pages repeat `sessionState`, `sessionRevision`,
  `sessionEstablished` and the assessment-only `participantToken` ternary. One helper
  returning the props to spread replaces them.
- **Resolver.** After slice 2, collapse `clearParticipantCookie`, `setParticipantCookie`,
  `expirePartitionedParticipantCookie`, `base` and `reject` into one write path and one
  result builder. Drop `cookiesAvailable` from the regular branch where nothing reads it.
- **Boundary.** Keep the one-second check plus `focus`, `visibilitychange` and `pageshow`.
  Drop `pointerdown`, `click`, `keydown` and `submit`: every request already asserts the
  revision before it leaves.
- **Apollo.** Besides slice 4, drop the deferred `stop()` and cache restore of the retired
  client if the stale boundary and full navigation already make it unreachable.
- **Chat client.** Remove `assertParticipantSession` calls that directly follow a
  `participantFetch`, keeping the one in the streaming read loop.
- **Response API.** Remove `Authorization` from the CORS allow-list; the handler never
  reads it.
- **Tests.** Restore the live-quiz deletion-dialog assertion removed from O1/O2 if it is
  deterministic once the dialog wait remains. Fold PA spec cases now covered by unit tests
  and extract repeated launch/login helpers. The spec is 1,586 lines today.
- **Considered, not planned.** Sharing one participant-cookie options helper between the
  Express backend and the PWA's nookies: two cookie libraries make the shared shape
  barely smaller than the duplication.

### Test portfolio

| Risk | Obligation | Seam |
| --- | --- | --- |
| Frame launch without cookies cannot authenticate | add new | PA spec blocked projects |
| Bearer overrides or replaces a present cookie identity | extend existing | `jwtMiddleware.test.ts` |
| JWT exposed to a top-level document | extend existing | `getParticipantToken.test.ts` |
| Forged or subresource launch mutates cookies | replace/consolidate | `getParticipantToken.test.ts` plus one PA case |
| Refused cookie retries the login mutation | extend existing | `participantSession.test.ts` |
| createAccount double navigation | add new | PA spec |
| Server HTML empty for public pages | none | intl smoke and existing specs observe it |

### Verification

Container checks per slice: affected unit tests, PWA/backend/Chat type checks, scoped
Biome. The PA spec runs locally across all five projects at slices 1, 2, 3 and 5 and once
at the end. WebKit cookie journeys remain a local environment skip, so Safari frame
behavior gets one manual check in Safari against the synthetic LMS frame; real OLAT and
production stay unverified until a staging run, which needs deployment authority. Full
hosted CI runs on the final pushed head. Visible UI changes (frame mode replacing the
recovery screen) get refreshed gallery captures.

### Review and finish

Self-review of the integrated diff for correctness, security (auth selection, token
exposure, CSRF) and maintainability, labelled as self-review. I propose one native
`final-reviewer` pass on the exact final range as independent evidence; it is not the
repository's hosted AI review, which stays paused per the approval summary. Integrate current `v3` once near readiness.
Touched runtimes are stopped at the end under the runtime lifecycle rules.

## Progress

- Status: slices 1–8 committed and pushed with current `v3` integrated. Browser
  verification, the independent final review and its fixes are done. The PR
  description update and stopping the runtime are the remaining steps.
- Slice notes:
  - 1: frame sessions restored. Adoption is idempotent per launch token, so a
    re-render cannot revive an ended session.
  - 5: `/createAccount` has one navigation owner; the browser spec confirms a linked
    launch on the registration page ends on the profile.
  - 7: the account selector opens only without a signed-in participant, so the
    temporary login needs only a comment. The 13-day cookie lifetime is recorded in
    the PR description.
  - 8: base import order restored in 16 files, one resolver write path, one Apollo
    session link, fewer boundary events, redundant Chat assertions removed. The
    response API keeps `Authorization` in its CORS list for frame-mode requests.
- Browser verification found three issues, all fixed:
  - The spec mapped to a runtime profile without Chat once `v3` narrowed runtimes to
    mapped profiles; it now maps to `chat,live-quiz`.
  - A browser can grant a frame cookie access and still refuse the cross-site
    launch cookie. A frame now joins the shared login only when the shared cookie
    holds its launch session; otherwise it keeps its own session, also after account
    creation.
  - Browsers that block all third-party storage cannot keep practice quiz progress
    in a frame, as in v3; the spec skips that step there.
- Independent final review (native `final-reviewer`, commits through `4b4203ea99`)
  found no verified blocker and three issues, all addressed:
  - Frame requests could still carry a shared cookie that took precedence on the
    server; frame requests now omit cookies.
  - A forged URL launch still expired the retained launch cookie; it now writes no
    cookies.
  - Frame journeys were only exercised with development `SameSite=Lax` cookies. The
    host launcher runs dev servers only, so production cookie attributes in a frame
    remain unverified until staging; the PR description states this.
- Size (substantive, excluding docs and project files): PR head +4,984 / −553; the
  revision is slightly larger because of new frame, launch-safety and retry tests,
  while non-test code shrank. The "smaller diff" acceptance is not met.
- Verification: see the PR description for the current head.
- Open: CodeQL alert 3543 repeats dismissed false positive 3499 at the moved token
  check and needs a dismissal decision. Hosted final review stays paused.
