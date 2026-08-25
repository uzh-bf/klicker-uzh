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
- Non-goals: merge or mark the pull request ready, deploy, change image build or
  promotion behavior, enable Docker layer caching, extract reusable image
  workflows, change Playwright sharding, or delete the worktree or runtime data.

## Execution contract

- Authority: the user authorized a new branch and pull request against `v3`,
  implementation, repository-native verification, conventional commits, and a
  normal push.
- Withheld: branch-protection mutation requires one explicit repository-admin
  approval after the replacement contexts pass on the same draft PR head.
  Merge, ready-for-review transition, deployment, force push, and cleanup also
  remain withheld.
- Execution owner and boundary owner: main session. The workflow definitions,
  hosted proof, and required-context migration remain coupled in one owner.
- Terminal: the draft PR contains the complete cutover; replacement checks pass
  on its exact final head; branch protection is migrated and read back; required
  reviews are resolved; no merge or deployment occurs.
- Pause: stop on a missing or skipped replacement context, incomplete unit-test
  diagnostics, a protection readback mismatch, a concurrent workflow/protection
  edit that cannot be preserved, a required force push, or a new credential.

## Plan identity

- Plan: `project/2026-08-25-pr-5551-ci-workflow-efficiency-plan.md`.
- Branch: `rs/ci-workflow-efficiency`.
- Worktree: `trees/ci-workflow-efficiency`.
- Target: `origin/v3` at `5ffc6a6d2bc4b12f6f38b5119718a7545e039256`.
- Pull request: draft PR #5551 against `v3`.
- Package: one ordinary PR because replacement proof, required-context
  migration, and deletion of superseded workflow files form one cutover.

## Current evidence and decisions

- Current branch protection requires `check-format`, `check-lint`,
  `check-syncpack`, `check-types`, `test-graphql-status`,
  `test-playwright-status`, `build-amd`, and `build-arm`. It does not currently
  require `check`, `check-gitleaks`, or advisory `check-knip`.
- PR #5304 added `check.yml` beside the five old check workflows so an
  administrator could migrate required contexts safely. That migration and
  cleanup never happened.
- On one same-commit hosted sample, `check` used 245 seconds while the five
  split check jobs used 871 seconds in aggregate. The consolidated job had a
  warm Turbo cache, so this is evidence of duplicated work and queue pressure,
  not a standalone runtime forecast.
- `check.yml` preserves all old commands and uniquely enforces
  `check:removed-doc-artifacts`; it remains unconditional so required checks do
  not get stuck pending through workflow-level path filters.
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
- The consolidated check and unit workflows receive `contents: read` only.
  Unused `packages: write` permissions are removed from GraphQL and OLAT.
- The current wiki skill reserves `docs/log.md` and `docs/log/` as absent.
  Durable updates go only to `docs/ci-and-deployment.md`, `docs/testing.md`, and
  `.agents/skills/klicker-testing-verification/SKILL.md`.
- No ADR is needed: this is a reversible CI-configuration consolidation that
  preserves product, data, deployment, and public contracts. Reusable image
  workflow extraction or promotion-contract changes would reopen the ADR gate.

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
- Obtain successful `check`, `check-gitleaks`, and `test-unit` runs on one exact
  PR head. Confirm the unit log contains one install, the dependency-build
  chain, and all four test steps. `test-unit` remains path-filtered and is not
  added to branch protection.

## Slice 3: migrate branch protection

Pause for explicit repository-admin approval. After approval:

1. Read the current strict setting and complete app-bound context set.
2. Add `check`, then read back its GitHub Actions binding.
3. Add `check-gitleaks`, then read back again.
4. Remove only `check-format`, `check-lint`, `check-syncpack`, and `check-types`.
5. Verify the final set equals the fresh starting set minus those four plus the
   two replacements. Preserve strict mode, `test-graphql-status`,
   `test-playwright-status`, `build-amd`, `build-arm`, and every concurrent
   context such as `final-ai-review`.

Do not delete a workflow if any readback differs from the expected set.

## Slice 4: complete the cutover

- Delete `check-format.yml`, `check-lint.yml`, `check-syncpack.yml`,
  `check-types.yml`, `check-knip.yml`, `test-chat.yml`, `test-grading.yml`,
  `test-markdown.yml`, and `test-util.yml` only after the protection migration.
- Update the CI guide, testing guide, testing-verification skill, and plan
  progress to describe the delivered state and measured follow-ups.
- Run Actions validation, repository-native checks, the required slice review,
  and one integrated final reviewer. Update the draft PR, but do not mark it
  ready, merge, deploy, or clean up the branch/worktree.
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

- Status: slice 1 published in draft PR #5551; hosted replacement proof pending.
- Completed: plan commit and post-commit freshness check; replacement workflow
  implementation; Actions audit, validation, and discovery; exact Node 24
  dependency builds; all four unit suites; Prettier and diff checks; and the
  full monorepo build. The root `check:all` gate reached 6 of 7 tasks but the
  analytics lint task could not build pandas because the devcontainer has no C
  compiler; this is unrelated to the workflow-only diff. The specialist review
  accepted the consolidation and identified one least-privilege gap: GraphQL's
  filter and status jobs now receive workflow-level `contents: read`. Draft PR
  #5551 is open against `v3`.
- Remaining: push this plan identity update, prove replacement contexts, request
  settings authority, complete the cutover, and run final review.
- Delivery boundary: branch-protection mutation, ready transition, merge,
  deployment, and cleanup remain withheld.
