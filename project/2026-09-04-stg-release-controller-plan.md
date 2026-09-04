# Default-controller Phase 1 implementation

## Goal

Replace the generated staging-promotion commit and pull-request path with a
trusted default-branch `workflow_run` controller that advances
`refs/heads/stg-release` only after exact-SHA staging builds and registry
digest evidence pass. Remove the generated-promotion final-review exemption
and document the new release-ref contract.

## Scope

- `.github/workflows/deploy-stg-promote.yml`
- New focused promoter scripts, deterministic fixtures, and tests under
  `.github/scripts`
- Generated-promotion-specific code and tests in
  `.github/scripts/final-ai-review.js` and
  `.github/scripts/final-ai-review.test.js`
- Related inputs in `.github/workflows/check-ocr-final-review.yml`
- `docs/adr/0003-promote-stg-via-release-annotation-write-back.md`
- `docs/adr/0028-short-lived-qualified-rc-branch-for-ai-releases.md`
- `docs/ci-and-deployment.md`
- This branch-local plan under `project/`

## Non-goals

- No platform-helper, selected-source workflow, chart, runtime mirror, or
  production-values changes.
- No registry queries during this local task; tests use synthetic fixtures.
- No push, pull request creation or update, merge, rebase, deployment, ref
  movement, secret or repository-setting change, or live verification.
- No changes outside the named paths and no cleanup of unrelated work.

## Execution contract

- `Owner:` this session, in the assigned physical worktree only.
- `Baseline:` branch `rs/stg-release-controller` at
  `c5aeaee2fdc1bedc82d9080085a8d1aeba1c08b7`; do not integrate the later
  `origin/v3` movement observed during the required remote refresh.
- `Granted:` edit the named paths, use synthetic fixtures, run focused local
  Node/shell/workflow/format/diff checks, and make local conventional commits.
- `Withheld:` all external state changes and all credentials, private data,
  registry access, candidate-code execution, and worktree operations outside
  this worktree.
- `Terminal:` the controller, final-review policy, ADRs, CI guide, tests, and
  plan are committed locally with exact verification evidence and no staged
  unrelated changes.
- `Pause:` stop for credentials, secret-bearing configuration, private or
  production data, missing policy decisions, destructive actions, or a need to
  alter any path outside this assignment.

## Decisions and invariants

- The privileged workflow checks out only its own trusted default-branch
  `github.workflow_sha` and executes only that checked-out script. Candidate
  SHA, workflow definitions, API responses, and registry metadata are data;
  candidate code, actions, caches, and artifacts are never executed or used.
- Workflow permissions are only `actions: read` and `contents: write`.
- Automatic writes require `STG_RELEASE_PROMOTION_ENABLED=true`. Manual runs
  default to dry-run and require exact confirmation `stg-release` before a
  write.
- Candidate-scoped concurrency permits different candidates to race; remote
  compare-and-swap allows create or fast-forward only. Equal and stale
  candidates are no-ops. Divergence and races fail without force.
- The controller validates selected-source and candidate ancestry, candidate
  staging workflow triggers, required active ARM jobs including migrator,
  disabled AMD exclusions, exact-SHA successful runs/jobs, complete stable
  full-SHA registry digests, and a canonical receipt checksum before any ref
  write.
- Promotion never invokes commit, pull-request, merge, branch-delete, force,
  or unrelated GitHub mutation commands.
- The old generated-promotion status, parser, exporter, build verifier, and
  workflow input are removed. A legacy `chore/promote-stg-*` pull request
  follows ordinary final-review policy.

## Feature-wide test portfolio

| Risk or behavior | Existing evidence | Test obligation | Stable seam | Slice |
| --- | --- | --- | --- | --- |
| Trusted workflow execution and least privilege | Existing workflow only | Add | YAML and static workflow fixture assertions | Controller |
| Candidate/source ancestry and workflow inventory | Existing promoter shell is incomplete | Add | Synthetic candidate repository/API fixtures | Controller |
| Exact run/job evidence and bounded retries | Existing promoter checks runs only | Add | Deterministic delayed, missing, running, skipped, failed, cancelled, and wrong-evidence fixtures | Controller |
| Digest receipt completeness and immutability | No existing receipt contract | Add | Synthetic registry responses and canonical JSON/checksum | Controller |
| Compare-and-swap ref behavior | Existing local branch guard only | Add | Fake remote compare/update adapter covering create, fast-forward, equality, stale, divergence, and races | Controller |
| Manual/automatic gates and no mutation commands | Existing workflow token/manual path | Add | Entry-point fixture matrix and command recorder | Controller |
| Generated-promotion exemption removal | Existing exemption tests | Replace/consolidate | Final-review policy parser and legacy branch-name regression | Final review |
| Durable release policy documentation | Existing ADRs and CI guide | Extend | Markdown/ADR text and formatting checks | Documentation |

## Slices

### Controller: trusted exact-build promotion and remote ref CAS

- `Route:` main session; architecture, trust-boundary, and remote-write logic
  remain here.
- `Do:` replace the workflow, add the smallest repository script and synthetic
  fixtures/tests, and remove the old commit/PR path.
- `Check:` focused Node tests, workflow YAML/static assertions, shell syntax,
  shellcheck, formatting, and `git diff --check`.
- `Commit:` `ci: replace staging promotion with trusted release controller`.

### Final-review policy: remove generated-promotion bypass

- `Route:` main session; policy and generated-input coupling are critical-path
  seams in the assigned files.
- `Do:` remove generated-promotion-specific status/parser/build-verifier/
  exporter/workflow inputs and add the ordinary-policy regression.
- `Check:` focused final-review tests, workflow checks, formatting, and diff
  hygiene.
- `Commit:` `ci: remove generated staging promotion review bypass`.

### Documentation: record the release-ref controller contract

- `Route:` main session; docs are coupled to the implemented security and
  release behavior.
- `Do:` supersede ADR 0003, narrowly amend ADR 0028 while preserving its RC,
  clean-schema, merge-hold, and forward-only migration decisions, and update
  the CI guide.
- `Check:` Markdown formatting, targeted stale-term searches, and diff hygiene.
- `Commit:` `docs: document staging release-ref promotion`.

## Verification and delivery

- Run focused Node tests for the promoter and final-review policy.
- Run shell syntax checks, ShellCheck, workflow/config checks, formatter
  checks, and `git diff --check`.
- Inspect every changed hunk and staged content for secrets, credentials,
  personal data, unrelated changes, candidate-code execution, and forbidden
  mutation commands.
- Keep all commits local. Do not push, create or update a PR, merge, rebase,
  move refs, query a registry, or change external state.

## Progress

- `Current:` all assigned Phase 1 controller work is implemented, verified,
  and committed locally.
- `Completed:` `e7743d2c57` replaces the generated commit/pull-request promoter
  with the trusted exact-build release-ref controller; `2edaec3a37` removes the
  generated-promotion final-review bypass; `553b1f131a` supersedes ADR 0003,
  narrowly amends ADR 0028, and updates the CI guide.
- `Verification:` Node 24 syntax checks passed; promoter tests pass 14/14;
  final-review tests pass 56/56; the selected-source fixture commit validates
  15 workflow definitions and 16 runtime ARM jobs; workflow YAML parsing,
  extracted-shell `bash -n`, ShellCheck, Biome and Prettier formatting checks,
  and Git diff checks pass. Each staged slice passed Gitleaks and a focused
  personal-data scan.
- `Review:` the execution owner completed a bounded trust-boundary and diff
  review. The global integration owner still owns the independent cross-branch
  review and contract matrix after all Phase 1 worktrees are available.
- `Remaining:` no implementation remains in this assigned worktree. Activation
  still requires the separately owned selected-source SHA publishers, chart
  override and runtime mirror, the private platform change, a receipt-backed
  initial ref creation, runtime proof, and separate authorization of
  `STG_RELEASE_PROMOTION_ENABLED=true`.
- `External state:` unchanged.
