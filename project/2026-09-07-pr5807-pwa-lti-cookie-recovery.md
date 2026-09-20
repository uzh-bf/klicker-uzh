# Restore participant login after stale LTI state — PR #5807

## Outcome and authority

Restore course-to-chatbot navigation after a stale LTI cookie survives normal
participant login. Successful authentication consumes pending LTI state, newly
issued LTI cookies expire after five minutes, and password submission settles
after successful, cancelled, or failed navigation.

The user approved the reviewed local implementation and then a separate branch
and draft PR. Publication targets origin/fix/pwa-lti-cookie-recovery with v3 as
the PR base. Merge and deployment require separate approval. Doc Query settings,
query-string JWT recovery, permissions, dependencies, and schemas are unchanged.

## Contracts and implementation

The shared successful participant-login helper expires the LTI cookie with the
configured domain and root path. Rejected authentication leaves it unchanged.
Valid LTI identity retains precedence; invalid LTI never silently falls back to
another participant session. Cookie-domain equivalence across deployed services
must be verified before rollout.

The LTI service sets a five-minute cookie lifetime matching its signed token.
The password form returns its authentication promise, awaits internal navigation,
and releases submitting state in finally. External navigation and magic-link
form behavior remain unchanged.

## Verification and reviews

The source was implemented and reviewed on an earlier task branch. All five
affected files at that baseline matched v3 before the fix. The source commit
was cherry-picked without conflicts; the complete changed source matches the
reviewed version. No prior Doc Query commits are included in this PR.

Earlier verification: 22 tests passed in the GraphQL loginParticipant and
accountLtiLinking suites. Affected GraphQL, PWA, and LTI type checks passed.
Four host browser checks passed: stale shared-domain cookie recovery through the
course bridge, same-page return, cancelled navigation, and rejected navigation.
Actual cookie serialization and unchanged LTI identity selection were checked.

The full check:all run failed in unchanged analytics lint because pandas required
a compiler unavailable in the container. The user accepted this limitation for
local completion. New-base verification is not implied: v3 now pins Next.js
16.2.11 instead of the previously tested 16.2.10. CI and current-base navigation
verification remain required before merge. No screenshots or authentication
traces are published.

The independent simplifier and authentication slice reviewer returned DONE with
no source findings. Integrated final review returned DONE_WITH_CONCERNS solely
for stale review-status documentation; that finding was corrected. Their source
review applies to the unchanged patch. The reviewed source commit is
fde089e7b119cb457b7eb3e4731b3b1dca539c34; the separate-branch source commit is
e6081a2d7f (authentication recovery).

## Progress

The separate branch contains only the fix, regression tests, the
[root-cause lesson](../docs/solutions/integration/stale-lti-cookie-login-loop.md),
and this publication record. The earlier task runtime is stopped with zero
routes; no runtime was started for this branch.
[Draft PR #5807 — stale LTI cookie recovery](https://github.com/uzh-bf/klicker-uzh/pull/5807)
is published against v3. The user approved deferring the local pre-push full
build to CI for draft publication only. Current-head checks and navigation
verification remain blocking before merge.
Production rollout and both requested test-account checks remain pending.
