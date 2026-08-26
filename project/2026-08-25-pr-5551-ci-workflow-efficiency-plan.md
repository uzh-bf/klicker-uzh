# CI workflow efficiency consolidation

## Goal and non-goals

- Reduce pull-request queue pressure by removing duplicated code-quality runs
  and combining four lightweight unit-test workflows into one install and one
  dependency-build chain.
- Preserve the existing check commands, advisory checks, package test commands,
  GraphQL required-status behavior, OLAT Docker boundary, and image-build and
  staging-promotion contracts.
- Correct the documented branch-protection mismatch by requiring both `check`
  and `check-gitleaks` after they pass on the draft pull-request head.
- Non-goals: merge, deploy, change image build or promotion behavior, enable
  Docker layer caching, extract reusable image workflows, change Playwright
  sharding, or delete the worktree or runtime data.

## Execution contract

- Authority: the user authorized the branch update, implementation,
  repository-native verification, conventional commits, normal pushes, PR
  updates, and marking the PR ready when reviewable.
- Branch-protection authority was granted explicitly after replacement proof;
  the incremental migration completed with exact app-bound readback. Merge,
  deployment, force push, and cleanup remain withheld.
- Execution owner and boundary owner: main session. The workflow definitions,
  hosted proof, and required-context migration remain coupled in one owner.
- Terminal: the follow-up PR is pushed against the current `v3` baseline, its
  exact-head required checks and reviews are resolved, and it is ready for
  human review; no merge or deployment occurs.
- Pause: stop on a missing or skipped replacement context, incomplete unit-test
  diagnostics, a protection readback mismatch, a concurrent workflow/protection
  edit that cannot be preserved, a required force push, or a new credential.

## Plan identity

- Plan: `project/2026-08-25-pr-5551-ci-workflow-efficiency-plan.md`.
- Branch: `rs/ci-workflow-efficiency-cleanup` for the follow-up cutover.
- Worktree: `trees/ci-workflow-efficiency`.
- Target: current `origin/v3` at
  `a36c2162631792eecd23388d13aa6cc83fb3ffea`, including merged [PR
  #5446](https://github.com/uzh-bf/klicker-uzh/pull/5446)'s Playwright timing and
  eight-shard changes, [PR #5567](https://github.com/uzh-bf/klicker-uzh/pull/5567)'s
  generated-client handoff, [PR #5565](https://github.com/uzh-bf/klicker-uzh/pull/5565)'s
  latest shard timings, [PR #5568](https://github.com/uzh-bf/klicker-uzh/pull/5568)'s
  worker limit, [PR #5570](https://github.com/uzh-bf/klicker-uzh/pull/5570)'s
  redirect fix, the `3.4.0-alpha.73` release commit, and [PR
  #5572](https://github.com/uzh-bf/klicker-uzh/pull/5572)'s staging-promotion
  annotation write-back, [PR #5575](https://github.com/uzh-bf/klicker-uzh/pull/5575)'s
  subsequent staging promotion, and [PR #5578](https://github.com/uzh-bf/klicker-uzh/pull/5578)'s
  latest staging promotion.
- Pull request: [#5551](https://github.com/uzh-bf/klicker-uzh/pull/5551) was
  squash-merged externally before the planned cleanup; follow-up draft
  [#5553](https://github.com/uzh-bf/klicker-uzh/pull/5553) contains the cutover.
- Package: the intended single cutover was split by that external merge. The
  follow-up contains only the now-unblocked workflow deletions, documentation,
  and final evidence; the branch sync is a normal merge commit, not a history
  rewrite.

## Current evidence and decisions

- Current branch protection uses strict mode and requires `check`,
  `check-gitleaks`, `test-graphql-status`, `test-playwright-status`, `build-amd`,
  and `build-arm`, all bound to GitHub Actions app ID 15368. The four former
  split contexts were removed only after both replacements passed and were
  added with successful readback.
- [PR #5304](https://github.com/uzh-bf/klicker-uzh/pull/5304) added `check.yml`
  beside the five old check workflows so an administrator could migrate
  required contexts safely. That migration and cleanup never happened.
- On one same-commit hosted sample, `check` used 245 seconds while the five
  split check jobs used 871 seconds in aggregate. The consolidated job had a
  warm Turbo cache, so this is evidence of duplicated work and queue pressure,
  not a standalone runtime forecast.
- `check.yml` preserves all old commands and uniquely enforces
  `check:removed-doc-artifacts`; it remains unconditional so required checks do
  not get stuck pending through workflow-level path filters. Its pull-request
  trigger covers every target branch so stacked PRs retain the quality gate;
  only its push trigger remains limited to `v3` and `v3*`.
- `test-chat`, `test-grading`, `test-markdown`, and `test-util` each check out,
  install, and partially rebuild the same workspace. Their contexts are not
  required, so one path-filtered `test-unit` workflow can safely replace them.
- OLAT stays separate because its test script owns a Docker test boundary.
  GraphQL keeps its filter and always-reporting status job because that status
  is required.
- The new unit workflow uses one frozen install, builds Prisma, types, grading,
  and util once in that order, then runs four separately visible test steps.
  Later suites run after an earlier suite failure but not after setup or build
  failure, preserving useful diagnostics.
- Draft pull requests retain the existing unit-suite skip behavior. A manual
  dispatch trigger provides exact-head hosted proof without marking the draft
  ready or running the suite automatically on every draft update.
- The consolidated check and unit workflows receive `contents: read` only.
  Unused `packages: write` permissions are removed from GraphQL and OLAT.
- The current wiki skill reserves `docs/log.md` and `docs/log/` as absent.
  Durable updates go to `docs/ci-and-deployment.md`, `docs/testing.md`, the
  directly affected `docs/chat-platform.md`, and
  `.agents/skills/klicker-testing-verification/SKILL.md`.
- No `docs/log` or `docs/index` update is required: the authoritative `v3`
  instructions explicitly reserve those paths as absent, and the merged
  baseline keeps them absent.
- No new ADR is needed: this is a reversible CI-configuration consolidation
  that preserves product, data, deployment, and public contracts. The existing
  ADR-0003 count is updated only to keep its current branch-protection
  description accurate. Reusable image workflow extraction or
  promotion-contract changes would reopen the ADR gate.

## Planner disposition and delegation

The required planner returned `DONE_WITH_CONCERNS`. Accepted corrections:

- require `check` and the documented blocking `check-gitleaks` only after both
  pass on one exact draft PR head;
- preserve later unit-suite diagnostics after an earlier suite failure;
- keep OLAT and GraphQL separate, use least permissions, and limit new pnpm
  caching to `test-unit`;
- defer all Docker/image optimizations;
- perform the protection migration incrementally and preserve every concurrent
  context and app binding.

The planner's dated CI-log suggestion is rejected because the current
repository wiki procedure explicitly forbids creating that reserved path.

| Workstream | Owner | Acceptance boundary |
| --- | --- | --- |
| Plan, workflows, docs, integration | main | Critical-path coupling across local and hosted state |
| Planning challenge | planner | Completed; concerns dispositioned above |
| Slice simplification and risk review | specialists | Review immutable substantive commits |
| Integrated readiness review | final reviewer | Review the verified final committed package |

Execution-tier implementation delegation is skipped because one writer must
preserve the required-check and workflow-deletion ordering. Read-only specialist
review gates remain required.

## Test portfolio

| Consequential behavior | Obligation | Evidence |
| --- | --- | --- |
| Consolidated checks preserve all blocking and advisory commands | static equivalence plus hosted run | workflow diff, Actions validation, successful `check` |
| Four lightweight suites share setup without losing diagnostics | local command proof plus hosted run | exact dependency builds and four test steps; successful `test-unit` |
| Irrelevant OLAT changes create no checkout-only job | trigger review | workflow-level path union and Actions validation |
| GraphQL keeps required fail-open/fail-closed semantics | static review | unchanged filter and status jobs; successful required context |
| Required contexts migrate without a merge deadlock | hosted and admin proof | same-head replacement checks plus exact before/after protection readback |
| Documentation matches delivered CI behavior | wiki validation | OKF validator, Prettier, direct-link inspection |

## Slice 0: freeze the plan

- Commit this reviewed execution contract before implementation.
- Refresh `origin/v3` immediately afterward. Re-baseline if it moved; stop if a
  concurrent change overlaps the planned workflows.
- Commit: `docs(project): add CI workflow efficiency plan`.

## Slice 1: add replacement workflows without removing safety nets

- Add least permissions to `check.yml` without changing its command order or
  unconditional execution.
- Add `test-unit.yml` with the old source/manifest path union, one cached frozen
  install, one dependency-build chain, and four separately visible test steps.
- Move OLAT filtering to workflow triggers and remove its package-write token.
- Remove only GraphQL's unused package-write token.
- Keep all superseded workflows in place.
- Verify Actions structure, the exact dependency builds and unit commands, wiki
  formatting, and repository gates in the isolated devcontainer.
- Commit: `ci: consolidate lightweight unit workflows`.
- Run the simplifier and a required-context/security slice review on the
  immutable commit range; correct and re-review material findings.

## Slice 2: establish hosted replacement proof

- Push normally and open a draft PR against `v3`.
- Rename this plan to include the assigned PR number, update its identity,
  commit, and push normally.
- Obtain successful `check` and `check-gitleaks` PR runs plus a manually
  dispatched `test-unit` run on one exact PR head. Confirm the unit log contains
  one install, the dependency-build chain, and all four test steps. `test-unit`
  remains path-filtered and is not added to branch protection.

## Slice 3: migrate branch protection — completed

The user granted explicit repository-admin approval. The completed sequence:

1. Read the current strict setting and complete app-bound context set.
2. Add `check`, then read back its GitHub Actions binding.
3. Add `check-gitleaks`, then read back again.
4. Remove only `check-format`, `check-lint`, `check-syncpack`, and `check-types`.
5. Verify the final set equals the fresh starting set minus those four plus the
   two replacements. Preserve strict mode, `test-graphql-status`,
   `test-playwright-status`, `build-amd`, `build-arm`, and every concurrent
   context such as `final-ai-review`.

Do not delete a workflow if any readback differs from the expected set.

## Slice 4: complete the cutover in a follow-up PR

- Delete `check-format.yml`, `check-lint.yml`, `check-syncpack.yml`,
  `check-types.yml`, `check-knip.yml`, `test-chat.yml`, `test-grading.yml`,
  `test-markdown.yml`, and `test-util.yml` only after the protection migration.
- Update the CI guide, testing guide, testing-verification skill, and plan
  progress to describe the delivered state and measured follow-ups.
- Run Actions validation, repository-native checks, the required slice review,
  and one integrated final reviewer. Update the follow-up PR and mark it ready
  after the final exact-head checks pass; do not merge, deploy, or clean up the
  branch/worktree.
- Commit: `ci: complete workflow efficiency consolidation`.

## Deferred efficiency packages

- Remove unnecessary QEMU setup from native AMD and ARM image jobs only after a
  separate hosted image-build proof.
- Guard registry login on PR image builds that use `push: false`.
- Pilot BuildKit/GitHub Actions layer caching separately; Dockerfiles run
  unpinned `apk update`, so cache freshness and security policy need a decision.
- Extract reusable image workflows only with explicit promotion-name,
  required-context, backend-migrator, PR no-push, release-tag, and build-argument
  contract tests.
- Reassess Playwright shard count and PR image-build scope after this job-count
  reduction is measured in hosted CI.

## Progress

- Status: branch is synced with current `origin/v3` through normal merge commit
  `e9db72078`; the latest published PR head and exact-head checks are recorded
  in the PR description as the branch advances.
- Completed: plan commit and post-commit freshness check; replacement workflow
  implementation; Actions audit, validation, and discovery; exact Node 24
  dependency builds; all four unit suites; Prettier and diff checks; and the
  full monorepo build. The specialist review accepted the consolidation and
  identified one least-privilege gap: GraphQL's filter and status jobs now
  receive workflow-level `contents: read`. On exact PR head `e15bd081a`,
  `check`, `check-gitleaks`, and manually dispatched `test-unit` passed; hosted
  logs confirmed one install, the ordered dependency-build chain, and all four
  suites. [PR #5551](https://github.com/uzh-bf/klicker-uzh/pull/5551) was then
  squash-merged externally as `e4ef09e5b`. After explicit approval, branch
  protection was migrated and read back after each step with strict mode and
  app ID 15368 preserved. The current baseline additionally contains merged
  [PR #5446](https://github.com/uzh-bf/klicker-uzh/pull/5446) at `cd5cfd574`;
  its exact-head Playwright run `32919404126` passed the filter, build, all
  eight shards, and `test-playwright-status`. While hosted verification was in
  flight, merged [PR #5567](https://github.com/uzh-bf/klicker-uzh/pull/5567)
  added the generated-client restore step to `v3`; the branch preserves that
  step through normal merge commit `e90a39619` and adds an explicit non-empty
  artifact assertion while keeping the ignored source copy out of the upload
  list. Current exact synced-head local verification passes `check:all`
  (7/7 orchestration tasks, 25/25 checks) under the pinned Node 24 and pnpm
  11.5 toolchain. The latest normal push hook also passed the full build with
  23/23 tasks. An earlier standalone full-build repeat was stopped after
  GraphQL Rollup remained idle for over 13 minutes. The first fresh post-sync
  Playwright run passed seven shards, while shard 8 exposed that a Turbo cache
  hit restored `packages/graphql/dist/client.json` but not the ignored source
  copy consumed by three course-sharing specs. The workflow now asserts the
  built map exists and restores it in each shard without regenerating the
  package eight times. The corrective hosted run at the pre-merge head
  `96ec9e41d` passed all eight shards and `test-playwright-status`; it is
  historical evidence and must be repeated for the final merged head.
- Remaining: publish the post-merge head, finish its exact-head hosted checks,
  record the final review, and refresh the PR description. [PR
  #5553](https://github.com/uzh-bf/klicker-uzh/pull/5553) is already ready for
  review; merge remains withheld.
- Follow-up verification: the safe Actions audit, syntax validation, and job
  discovery pass with only `check`, `check-gitleaks`, and `test-unit` present for
  the consolidated scope. Prettier passes under the repository-pinned Node 24
  runtime. The repository-wide wiki validator still reports 19 pre-existing
  frontmatter errors, all outside the edited pages. The former task DevPod was
  removed externally after [PR #5551](https://github.com/uzh-bf/klicker-uzh/pull/5551)
  merged, and the installed devrouter rejects
  the repository's current `profiles` configuration, so this cleanup uses the
  narrow pinned-toolchain fallback rather than modifying host tooling.
- The full `pnpm run check:all` hook passes under Node 24 and pnpm 11.5 after
  restoring dependencies from the unchanged frozen lockfile. The latest normal
  push hook passed the pre-push build with 23/23 tasks. An earlier standalone
  repeat was stopped after GraphQL Rollup remained idle for over 13 minutes;
  this is retained as diagnostic history, not as the current build result. The
  integrated final reviewer found no change-introduced issue and confirmed
  that `test-unit` should not trigger on changes to the composite changed-path
  action it no longer consumes.
- The integrated final review found that a target-branch filter would have
  dropped the replacement quality gate from stacked PRs. The filter was removed
  from the pull-request trigger, the push filter was retained, and the CI guide
  now records the supported stacked-PR behavior.
- Delivery boundary: ready transition is authorized after the final checks;
  follow-up merge, deployment, and cleanup remain withheld.

## Next Steps

- Publish the post-merge head, finish its exact-head checks, record the final
  review, and refresh the PR description against `origin/v3`.
- Keep [PR #5553](https://github.com/uzh-bf/klicker-uzh/pull/5553) ready once the
  final hosted checks and review state remain green.
- Keep the deferred image-workflow optimizations as separate packages with
  their own hosted proof and contract review.
