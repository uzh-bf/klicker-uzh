# Final review for consolidation-branch pull requests - plan

Date: 2026-08-29. Branch: rs/final-review-consolidation-eligibility from origin/v3 (bb495a1b).

## Problem

PR #5650 (feat/chatbot-response-example-runtime -> v3-ai) is fully green on application CI, but its final-ai-review commit status is permanently red: "Final review requires the default branch or a verified native stack member". The trusted policy in .github/scripts/final-ai-review.js accepts only a base equal to the repository default branch (v3) or a verified native stack whose root also targets v3. v3-ai is the long-lived AI consolidation branch that PRs target for staging deployment, so PRs into it can never pass the review gate, and the standing-authorized /final-review command is refused for them.

## Evidence (verified 2026-08-29)

- isEligibleDefaultPull compares pull.base.ref to default_branch (final-ai-review.js:806); resolvePullEligibility falls through to native-stack membership, whose root check (native-stack.js:263) also requires the default branch.
- initializeFinalReview (2129) and authorizeFinalReview (2177) surface that rejection; buildReviewPlan and finalizeFinalReview re-verify the same predicate.
- Provenance checks compare workflow.head_branch to the default branch (1005, 1137, 1533, 1694). Live GitHub data: every completed issue_comment run of check-ocr-final-review.yml has head_branch v3 regardless of which base the addressed PR targets (verified against runs for v3-ai-based PRs), so these checks already pass for consolidation PRs once eligibility is granted. The pull_request_target comparison at 1137 is only on the promotion path and is untouched.
- No branch protection requires the context on v3 or v3-ai; the gate is repository policy, so this change is an allowlist extension, not a weakening: unlisted integration bases stay ineligible.

## Decision

Extend individual final-review eligibility with an explicit allowlist of designated consolidation base branches, hardcoded in the trusted policy as CONSOLIDATION_BASE_BRANCHES = ['v3-ai'] (the policy file lives on v3, so changing the list is a normal PR). Eligible consolidation PRs keep scopeKind 'default' so digests, plan matching, and finalization stay compatible. Stack review, native-stack root validation, and promotion validation are not touched. The v3-ai retirement (ADR 0007) removes the constant in a later cleanup PR.

Rejected alternatives: a new repository variable (more moving parts, silent runtime dependency); reusing STG_SOURCE_BRANCH (conflates promotion semantics with review eligibility, needs async reads in three call paths).

## Do

1. final-ai-review.js: add the frozen constant plus a short comment; accept listed bases in isEligibleDefaultPull; update the two human-readable rejection messages.
2. final-ai-review.test.js: extend the existing suite - consolidation base authorizes through authorizeFinalReview with scope_kind default; initializeFinalReview keeps a pending status for a v3-ai base; an unlisted base still terminates in the rejection error.
3. Checks: node --check, node --test on the .github/scripts tests, git diff --check.

## Boundaries

- Authorized delivery: integrate the current `v3` head once, record progress, rerun affected checks, push the exact branch, and settle PR #5674's exact-head CI and final review.
- Withheld: merge PR #5674, deploy or activate the policy, and post `/final-review` on PR #5650 before the policy has landed on `v3`.
- Terminal condition: PR #5674 is merge-ready at its exact published head, with the remaining merge boundary reported to the user.

## Progress

- Status: delivery revalidation is in progress after the approved one-time integration of `v3` at `6135b55c5`.
- Completed: the consolidation-base eligibility policy and its regression tests were implemented, corrected after review, published as PR #5674, and passed exact-head CI and final review at `64988b899` before integration.
- Current evidence layer: `delivery_pending` until the integrated head is pushed and its CI and final review settle; the required terminal layer is `pr_ready`.
- Next: verify the integrated source, publish it once, settle exact-head CI and final review, then stop at the explicit PR merge boundary.
- Withheld actions remain unchanged: no PR merge, deployment, activation, or early `/final-review` on PR #5650.
