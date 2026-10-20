# Final review for stacks rooted on consolidation branches - plan

Date: 2026-09-06. Branch: rs/final-review-consolidation-stack-roots from origin/v3 (19f2cac7ea).

## Problem

PR #5674 made individual final reviews accept pull requests that target the
consolidation branch `v3-ai`, but left native-stack root validation bound to
the default branch. A native stack whose root targets `v3-ai` therefore still
fails both review gates: `final-ai-stack-review` reports "Stack review
unavailable: stack root does not target the default branch" and the member
status falls back to "Final review requires the default branch, a designated
consolidation branch, or a verified native stack member". Stack 5686
(PR #5491 and PR #5492, KEDA foundation) hits exactly this.

The hardcoded allowlist also covers only `v3-ai`, while `v3-course-qa` and
`v3-polls` are consolidation branches of the same kind.

## Decision

Consolidation branches are the branches named `<default branch>-<suffix>`
(today `v3-ai`, `v3-course-qa`, `v3-polls`). One shared predicate in
`final-ai-review-shared.js` replaces the `v3-ai` allowlist and is used by
individual eligibility, native-stack root validation, and the two stack-review
base-advance checks. The suffix must be non-empty, start with a letter or
digit, and contain only letters, digits, `.`, `_`, or `-`; a slash or a bare
`v3-` never matches, and the default branch itself is not a consolidation
branch.

Not touched: the workflow-run provenance checks that compare
`workflow.head_branch` to the default branch (issue-comment runs always
execute on the default branch, see the #5674 plan), promotion validation, and
the human-readable rejection messages for individual reviews.

## Do

1. `final-ai-review-shared.js`: add `isConsolidationBaseBranch` and
   `isEligibleBaseBranch`; export both.
2. `final-ai-review.js`: drop `CONSOLIDATION_BASE_BRANCHES` and the local
   predicate; import the shared one.
3. `native-stack.js`: root check uses the shared predicate; reason text names
   both accepted base kinds.
4. `final-ai-stack-review.js`: both root checks in the base-advance paths use
   the shared predicate.
5. Tests: predicate contract (accepted and rejected shapes, default-branch
   derivation), a native stack rooted on `v3-ai` authorizes as
   `native-stack`, a root on `feature/v3-ai` is denied, and stack membership
   resolution accepts a consolidation root.
6. Checks: `node --check`, `node --test` on both policy suites, Biome format,
   `git diff --check`.

## Boundaries

- Authorized: implement, test, commit, push the branch, open a draft PR to `v3`.
- Withheld: merge, enable or activate on any branch, post `/final-review` on
  the KEDA stack before this policy lands on `v3`.

## Progress

- Status: implemented and tested locally (119/119 policy tests, including base-advance preservation for a consolidation root after slice review); draft PR pending.
