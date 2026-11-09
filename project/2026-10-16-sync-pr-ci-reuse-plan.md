# Sync PR CI reuse

## Approval summary

**Why and what changes?** The maintained sync PRs (`v3` -> `v3-ai`,
`v3-ai` -> `v3-audit`, `v3-ai` -> `v3-adaptive-learning`) run the full
Playwright suite on every draft head the controller advances to, and the merge
push into the integration branch runs it again. Two changes remove the
redundant runs:

1. A draft sync PR defers Playwright until it is marked ready. The trusted
   envelope selects a `skip` plan with reason `draft-sync-deferred`; cheap
   suites still run on every draft head.
2. A push to an integration branch other than `v3` and the staging source may
   reuse the Playwright validation of the pull request it merged, when the
   pushed merge commit's tree equals the tree that run tested.

**What stays unchanged?** `v3` pushes and pushes to the branch named by
`STG_SOURCE_BRANCH` always run independently, because the staging promoter
requires their own eight hosted shards. Feature PRs, ready sync PRs, image
builds, and the unit, GraphQL, OLAT and translation workflows keep their
current behavior.

**What could change the decision?**

- Reuse accepts a ready PR run on the `public-pr` (self-hosted arm64) route as
  proof for a hosted push. The justification is an identical full plan
  (`planMatches`) and an identical merge tree.
- Reuse still requires the same pinned `@v3` control revision, so it fires
  only when `v3` did not move between the PR run and the merge. Relaxing that
  binding is a separate trust decision.
- The other push suites are left out: they are small and
  `required-ci-status.cjs` fails closed on reuse.

**How will we know it is done?** The CI script tests cover the new route
state, selector skip, plan metadata, merged-PR reuse proof, staging-source
exclusion, and the opt-in status acceptance; `pnpm check:playwright-ci` and
the CI gate tests pass.

**What does approval authorize?** Local commits on `ci/sync-pr-ci-reuse`, a
push of that branch and a draft PR into `v3`. Marking ready and merging stay
with the maintainers.

## Execution details

### Binding contracts

- The envelope is pinned `@v3`, while `test-playwright.yml` is per branch.
  Push reuse is therefore gated by a new `allow_push_reuse` envelope input
  that only the updated caller passes, so an older caller on an integration
  branch never receives a push `duplicate_run_id` it would reject.
- The reuse proof binds: a two-parent pushed commit; the merged PR whose
  `merge_commit_sha` is that commit, with base the pushed branch and head the
  second parent from this repository; the latest successful attempt of that
  head's `pull_request` run; its receipt (`headSha`, `baseSha` = first
  parent, `treeSha` = pushed tree, `controlSha` = current control); complete
  coverage on the route that run used; and an identical full plan.
- Sync branches are recognized through `draft-sync-prs.cjs`, the single owner
  of the sync pairs.

### Sequence

1. Draft sync deferral: `draft-sync-prs.cjs` (branch predicate),
   `playwright-route.cjs` (`deferred` selector state),
   `playwright-selector.cjs` (`skip` plan), `playwright-plan-metadata.cjs`,
   and the envelope route step.
2. Merged-PR push reuse: `ci-equivalent-run.cjs`, the envelope reuse step and
   input, the `test-playwright.yml` status job, and the
   `ci-duplicate-audit.cjs` comment. The caller opt-in follows in a separate
   PR once the envelope input is live on `v3`.
3. `docs/ci-and-deployment.md` draft sync section.

### Verification

`node --test` over the touched `.github/scripts/*.test.cjs` files, then
`pnpm check:playwright-ci` equivalents and `ci-event-gates.test.cjs`.

## Progress

- Execution mode: solo.
- Status: both slices and docs committed; draft PR
  https://github.com/uzh-bf/klicker-uzh/pull/6572 open.
- Verification: `node --test .github/scripts/*.test.cjs` passes; the Sonar
  boundary CLI test needs to run outside the local sandbox.
- Test delta: added route, selector, metadata, merged-PR reuse and status
  reporter cases; changed none; removed none.
- Final review: delegated `final-reviewer` pass on the committed range. It
  found that the caller passed `allow_push_reuse` to the `@v3` envelope before
  `v3` declares it, which fails this PR's Playwright workflow at startup.
  Resolved by moving the caller opt-in to a follow-up PR after this one lands;
  push reuse stays inert until then. A stale runner-section docs sentence was
  corrected.
- Next: after merge, a one-line PR adds `allow_push_reuse: true` to the
  `test-playwright.yml` caller.
