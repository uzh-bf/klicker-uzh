# Learning Analytics Production Plan

## Goal

Preserve the existing learning-analytics stack, merge current `v3` through it,
and make the pipeline reviewable and deployable. Replace only the
TypeScript-to-Python subprocess bridge with a native Python Hatchet worker on
the existing Hatchet control plane.

## Identity

- Plan: `project/2026-07-23-learning-analytics-production-plan.md`
- Phase 1 branch: `chat-analytics`
- Phase 1 target: `v3`
- Phase 1 PR: none yet
- Phase 1 worktree:
  `trees/chat-analytics-integration`
- Phase 2 branch: `analytics-phase-a`
- Phase 2 current target: `chat-analytics`
- Phase 2 eventual target: `v3` after the Phase 1 PR merges
- Phase 2 PR:
  [#5073](https://github.com/uzh-bf/klicker-uzh/pull/5073)
- History:
  `project/ANALYTICS_IMPROVEMENTS.md` and
  `project/2026-07-07-analytics-phase-a-pr5073-review.md`

## Approved decisions

- Keep every analytics capability already present in the two stacked branches.
- Merge `v3` into the stack; do not reconstruct or cherry-pick a subset.
- Keep the current GraphQL API. tRPC is outside this work.
- Reuse the existing staging and production Hatchet control planes.
- Move the analytics DAG and task execution into Python. Keep TypeScript event
  producers and the course scanner where they already fit.
- Keep both PRs draft until the finish gates pass. Do not merge or deploy.

## Non-goals

- Student-facing analytics dashboards.
- A second Hatchet control plane.
- tRPC migration.
- Removing chat, live-quiz, platform, clustering, or correlation analytics.
- Production or staging deployment.
- Unrelated dependency or architecture changes.

## Research

### Repository evidence

- `chat-analytics` contains 13 commits over its common base with `v3`.
- `analytics-phase-a` adds the Phase A implementation and design/review
  artifacts.
- Only three `v3` commits touched `apps/analytics` after the common base.
  Their changes are mainly uv migration, generated schema sync, Ruff
  formatting, and assessment-export schema additions.
- A read-only merge simulation reports 11 conflicts for
  `v3` into `chat-analytics` and 32 conflicts for
  `v3` into `analytics-phase-a`. This supports updating the stack in order.
- Local Hatchet uses `hatchet-lite:v0.73.1`; TypeScript currently pins
  `@hatchet-dev/typescript-sdk` `1.9.4`.

### Hatchet evidence

- Native Python workflows support declared DAG parents, task retries and task
  timeouts:
  <https://docs.hatchet.run/v1/directed-acyclic-graphs>
- Workflow concurrency supports queue, cancel-in-progress, and cancel-newest
  strategies:
  <https://docs.hatchet.run/v1/concurrency>
- Python cancellation is cooperative; long-running loops must observe the task
  context cancellation state:
  <https://docs.hatchet.run/v1/cancellation>
- Python workers can expose health and metrics endpoints:
  <https://docs.hatchet.run/v1/worker-healthchecks>
- Context7 was unavailable. Use official Hatchet documentation plus inspection
  and runtime tests of the pinned Python SDK before relying on an API.

### Open research gates

- Select and pin a Python SDK version proven compatible with local
  `hatchet-lite:v0.73.1` and the deployed control-plane version.
- Measure a representative incremental run before choosing worker slots and
  Kubernetes resources. Start correctness tests with one pod and one slot;
  increase slots only from measured evidence.
- Verify the existing analytics image repositories and secret mappings before
  changing Helm values.

### Independent plan review

- Review commit: `3af49c843`
- Review agents: native plan reviewer and separate simplification reviewer.
- Accepted:
  split correctness, native-worker, and deployment work into smaller tracer
  bullets; use one verification matrix; pin a compatible SDK rather than the
  newest SDK; start at one worker slot; make eventual PR retargeting explicit;
  pass immutable per-run configuration instead of mutating `os.environ`; and
  preserve retry, timeout, special `s10`, and producer-contract behavior.
- Rejected: none.

## Slices

### Slice 0 — Commit and review the production plan

**Do**

- Commit this plan on `chat-analytics`.
- Have a separate reviewer check preservation, branch order, verification, and
  authority boundaries.
- Integrate accepted plan findings.

**Check**

- `git diff --check`
- Review exact plan commit.

**Commit**

- `docs(project): add learning analytics production plan`

### Slice 1 — Bring the base analytics branch onto current v3

**Do**

- Merge `origin/v3` into `chat-analytics`.
- Preserve both intents in all conflicts:
  current uv/Node/schema/export/tooling state from `v3`, and all analytics
  behavior from `chat-analytics`.
- Regenerate lock/schema outputs instead of hand-merging generated content
  where repository tools provide a source of truth.
- Fix merge-only regressions; do not redesign analytics.

**Check**

- Analytics Python format/type/test commands available after the merge.
- Relevant package checks for analytics, GraphQL, Hatchet, Prisma data, and
  schema sync.
- `git diff --check`.

**Commit**

- Merge commit retaining both histories.

### Slice 2 — Bring Phase A onto the refreshed base

**Do**

- Create `trees/analytics-phase-a-integration`.
- Fast-forward local `analytics-phase-a` to its remote tip.
- Merge refreshed `chat-analytics`.
- Preserve the full Phase A implementation and existing review/design docs.
- Reconcile generated files from their source definitions.

**Check**

- Syncpack, TypeScript checks, GraphQL tests, Python tests, schema generation,
  and migration validation that do not require production credentials.

**Commit**

- Merge commit retaining both histories.

### Slice 3A — Close reproduced correctness and CI gaps

**Do**

- Make the existing PR checks green.
- Reproduce and fix late-arriving chat data handling for participant and
  aggregate course, daily, weekly, and monthly upserts.
- Verify `s13` ordering, full fan-in before `s99`, homogeneous bulk-upsert
  rows, and UTC timestamps.
- Reproduce failure propagation through the current Hatchet bridge. A failed
  handler must fail the task, and partial `s10` failures must not allow `s99`
  to mark the run valid.
- Fix only findings reproduced against the integrated branch.

**Check**

- Focused unit/integration tests for each accepted fix.
- Seeded analytics run and row-level assertions where feasible.
- Failed-script smoke tests report a failed Hatchet task and leave analytics
  invalid.

**Commit**

- One focused commit per independent behavior when needed.

### Slice 3B — Prove grading parity

**Do**

- Compare numerical correctness behavior with `packages/grading`.
- Add representative seeded numerical responses.
- Fix only verified semantic differences.

**Check**

- Focused Python tests for bounded, one-sided, and exact numerical solutions.
- Seeded script-0 row assertions.

**Commit**

- `fix(analytics): align numerical correctness with grading`

### Slice 3C — Prove index needs and refresh operational docs

**Do**

- Run representative query plans for the designed analytics access paths.
- Add or change indexes only for demonstrated gaps.
- Update stale comments and dry-run limitations with the owning change.

**Check**

- Migration validation.
- Recorded `EXPLAIN ANALYZE` evidence on representative seeded data.

**Commit**

- Keep schema/index work separate from documentation-only corrections.

### Slice 4A — Register a native Python worker and one proof task

**Do**

- Add a pinned, compatibility-tested `hatchet-sdk` dependency.
- Register one non-mutating proof task against local Hatchet.
- Call one Python analytics entry point directly in a focused test path; do not
  spawn `uv`.
- Pass mode, course scope, and window as immutable task/run input. Do not mutate
  process-global `os.environ` per task.
- Keep the TypeScript worker intact as rollback.

**Check**

- SDK import and worker-registration tests.
- Register the worker against local `hatchet-lite:v0.73.1`.
- Run the proof task and observe its result.

**Commit**

- `feat(analytics): add native Python Hatchet worker`

### Slice 4B — Port the full analytics DAG with parity

**Do**

- Define the existing 15-task DAG in Python with the same names, triggers,
  dependencies, modes, per-task retries/timeouts, special `s10` retry behavior,
  and full-run guard.
- Keep the TypeScript course scanner and event producers.
- Add cooperative cancellation checks at bounded course/window steps.
- Separate protected full rebuild concurrency from freshness-first incremental
  and finalize runs.
- Keep the TypeScript worker available until parity passes.

**Check**

- Unit tests for input/mode resolution, DAG dependencies, guard rails, and
  cancellation.
- Trigger a small workflow and confirm parent/fan-in behavior.
- Trigger a superseding run and confirm cancellation stops Python work.
- Compare outputs with the TypeScript-orchestrated path.
- Verify GraphQL/manual and scanner events reach the Python workflow with the
  expected input contract.

**Commit**

- `feat(analytics): port analytics DAG to Python Hatchet`

### Slice 4C — Cut over and remove the subprocess bridge

**Do**

- Make the Python worker the sole owner of the analytics DAG.
- Remove only the TypeScript bridge, worker entrypoint, and configuration made
  obsolete by the cutover.
- Preserve TypeScript event producers and the course scanner.

**Check**

- No remaining analytics subprocess path.
- Registration, trigger, DAG, guard, and cancellation tests pass.

**Commit**

- `refactor(analytics): cut over to native Python Hatchet`

### Slice 5A — Build and render the minimal Python worker

**Do**

- Convert the dedicated image to a Python worker image while preserving all
  analytics dependencies.
- Remove the transitional Node 20/pnpm 10 image assumptions. Align uv/Python
  and any remaining build tooling with current repository pins, and use a
  base that demonstrably provides Python 3.12 rather than assuming the Debian
  Node image contains `python3.12`.
- Fix architecture-specific image repository/tag wiring.
- Use the Hatchet SDK health/metrics server; do not add a custom health service.

**Check**

- Build the image locally.
- Render Helm for staging and production values.
- Run container health and worker-registration smoke checks.

**Commit**

- Separate image and Helm changes if each is independently valid.

### Slice 5B — Harden runtime and document operations

**Do**

- Add non-root runtime, health/metrics probes, graceful termination, one initial
  slot, explicit resources, and immutable image behavior.
- Verify Infisical/ExternalSecret mappings without reading or exposing secret
  values.
- Tune slots and resources only from measured evidence.
- Add an operator runbook for trigger, status, logs, failure, retry, and
  rollback.

**Check**

- Validate probes, command, environment names, image references, resource
  values, and secret references.
- Rebuild and rerun container registration/health smoke checks.

**Commit**

- Keep deployment hardening and runbook evidence together.

### Slice 6 — Finish verification and draft PRs

**Do**

- Run the full relevant local verification suite.
- Record runtime and row-parity evidence; state unavailable environment checks
  explicitly.
- Run final security, maintainability, simplification, and branch reviews.
- Create the missing draft PR from `chat-analytics` to `v3`.
- Refresh [#5073](https://github.com/uzh-bf/klicker-uzh/pull/5073)
  from the complete branch diff and current plan.
- Keep #5073 stacked on `chat-analytics` until the Phase 1 PR merges; then
  retarget it to `v3` and recheck its complete diff.
- Read back CI. Do not mark ready or merge.

**Check**

- Both draft PRs describe the whole branch, evidence, remaining manual checks,
  rollout order, and rollback.
- Required CI is green or has an exact external blocker.

## Verification matrix

Focused slices run the relevant subset. Slice 6 reruns the complete matrix:

| Area | Command | Pass criterion |
|---|---|---|
| Diff hygiene | `git diff --check` | No errors |
| Dependency policy | `volta run --node 24.16.0 pnpm run check:syncpack` | Exit 0 |
| Analytics format | `cd apps/analytics && uv run ruff format --check . && uv run ruff check .` | Exit 0 |
| Analytics types | `cd apps/analytics && uv run pyright` | Exit 0 |
| Analytics tests | `cd apps/analytics && uv run pytest` | All tests pass |
| Hatchet packages | `volta run --node 24.16.0 pnpm exec turbo run check --filter=@klicker-uzh/hatchet --filter=@klicker-uzh/hatchet-worker-analytics --filter=@klicker-uzh/hatchet-worker-general` | Exit 0 |
| GraphQL package | `volta run --node 24.16.0 pnpm exec turbo run check --filter=@klicker-uzh/graphql` | Exit 0 |
| GraphQL tests | `volta run --node 24.16.0 pnpm --filter @klicker-uzh/graphql test` | All tests pass |
| Schema mirror | `volta run --node 24.16.0 pnpm run prisma:sync` then `git diff --exit-code -- apps/analytics/prisma` | Mirror is current |
| Worker image | `docker build -f apps/hatchet-worker-analytics/Dockerfile .` | Image builds |
| Helm staging | `helm template klicker-uzh deploy/charts/klicker-uzh-v3 -f deploy/env-uzh-stg/values.yaml` | Render succeeds |
| Helm production | `helm template klicker-uzh deploy/charts/klicker-uzh-v3 -f deploy/env-uzh-prd/values.yaml` | Render succeeds |
| Hatchet runtime | Local worker registration, proof run, DAG run, and cancellation smoke | Expected task states and no surviving work |

If an integrated command differs after the `v3` merge, update this table from
the repository script that replaces it before continuing.

## Progress

- 2026-07-23: User approved preserving the existing stack and pulling in
  `v3`. tRPC was explicitly removed from scope.
- 2026-07-23: Live branch, PR, ClickUp, deployment, and Hatchet documentation
  review completed.
- 2026-07-23: Phase 1 worktree created at
  `trees/chat-analytics-integration`; branch is clean at `99c77b1480`.
- 2026-07-23: Slice 0 plan committed as `3af49c843`.
- 2026-07-23: Independent review and simplification completed; accepted
  findings split oversized slices, made cutover rollback explicit, added a
  command matrix, and tightened configuration/parity/retargeting requirements.
- 2026-07-23: Slice 0 complete at `f150b33f2`.
- 2026-07-23: Merged `origin/v3` at `c8de9c8978` into `chat-analytics` and
  resolved all 11 conflicts. The resolution keeps the `v3` Node 24,
  TypeScript 6, uv/Ruff, split-schema, and export additions while preserving
  every analytics model, script, scoped run mode, deterministic interaction
  fixture, and the 15-step analytics workflow.
- 2026-07-23: Regenerated the uv and pnpm locks from resolved manifests,
  aligned the dedicated analytics worker with the Node 24/TypeScript 6
  toolchain, and regenerated the Python Prisma schema mirror from the canonical
  schema.
- 2026-07-23: Slice 1 checks pass for Ruff format/lint, Pyright, 22 Python unit
  tests, syncpack, the Hatchet package and both workers through the Turbo
  dependency graph, GraphQL typecheck, schema sync, and a focused strict
  TypeScript check of the analytics interaction seeder.
- 2026-07-23: The full repository typecheck passes 25/25 runnable workspace
  checks under Node 24 and pnpm 11.5 after building the `v3` Markdown and
  word-cloud artifacts required by the repository's parallel check.
- 2026-07-23: The whole `prisma-data` TypeScript surface remains
  non-typecheckable because legacy migration scripts reference removed schema
  fields; the new analytics seeder passes a focused strict check. Wiki
  validation reaches the imported `v3` baseline and fails only on the
  pre-existing missing frontmatter type in
  `docs/solutions/best-practice/repeat-production-seeds-use-prior-state.md`;
  the analytics wiki changes introduce no validator error.
- 2026-07-23: Slice 1 merge committed as `02e0f16c`. The commit hook passed
  repository checks, staged formatting, lint, syncpack, AGENTS validation, and
  Prisma schema sync.
- 2026-07-23: Independent review and simplification of
  `origin/v3...02e0f16c` found no lost analytics capability. Accepted
  production-readiness findings were assigned to Slice 3A (late-data upserts
  and failure propagation) and Slice 5A (replace the transitional mixed
  Node/Python image); stale README commands and scanner status were corrected
  immediately. Dependency pruning and small SQL-loading/query-shape cleanups
  were rejected for Slice 1 because they are unrelated to the merge and lack
  runtime value or build evidence.
- 2026-07-23: Slice 1 review adjustments committed as `35a9f97`.
- 2026-07-23: Created the Phase A integration worktree at
  `trees/analytics-phase-a-integration`, fast-forwarded `analytics-phase-a` to
  remote tip `18d0bb8c03`, and merged the refreshed `chat-analytics` history.
  All 33 conflicts are resolved without discarding Phase A behavior. The
  resolution keeps Phase A SQLAlchemy models, dry-run support, tests, and
  scripts while adopting the refreshed Node 24, uv/Ruff, generated GraphQL,
  and canonical Prisma-schema tooling.
- 2026-07-23: Slice 2 analytics verification passes Ruff format/lint and
  `pytest` with 103 passed and 3 skipped. The Phase A Pyright baseline reports
  2,078 errors across generated SQLAlchemy models, missing third-party stubs,
  and broadly untyped existing code; making this gate actionable remains
  production-readiness work rather than a merge-only rewrite.
- 2026-07-23: Slice 2 TypeScript and schema verification passes GraphQL
  generation/build/typecheck, Prisma generation/typecheck/namespace tests,
  Syncpack, all three Hatchet package checks, and the canonical-to-analytics
  schema-mirror check.
- 2026-07-23: The GraphQL test suite cannot currently complete against the
  local test database. A sandboxed run was denied with `EPERM`; an allowed run
  reached PostgreSQL but the connection terminated and successive tests timed
  out. No assertion failure was observed before the run was stopped.
- 2026-07-23: Independent Slice 2 review found no source-level feature loss.
  It identified one merge-created image regression: the resolved analytics
  image still invoked the removed Prisma-Python generator. The review
  adjustment removes that obsolete build step. Verified cleanup also removes
  nested Infisical execution and a double-import in the dry-run runner. Dormant
  Phase A helpers were preserved because they are not a production blocker and
  this integration must not discard intended follow-up surfaces.
- 2026-07-23: A local analytics-image build passed the removed Prisma-generation
  stage but was stopped when Linux dependency resolution began downloading
  several gigabytes of CUDA/Torch artifacts. CPU-only/minimal ML dependency
  resolution and the 918 MB root build context remain explicit Slice 5A image
  work; the interrupted build is not recorded as a passing image gate.
- 2026-07-23: Confirmed correctness findings remain assigned to Slice 3A:
  partial script-10 clustering failures can still resolve successfully, and
  script 13 races the script-2 rows it updates. Cooperative cancellation of
  the transitional subprocess remains assigned to the native-worker cutover
  slices.
- 2026-07-23: Slice 2 integration committed as `cc69458b7`; its independently
  reviewed runtime corrections committed as `97986835d`.
- 2026-07-23: Slice 3A now refreshes late-arriving participant and aggregate
  chat rows for daily, weekly, monthly, and course grains; validates
  homogeneous bulk-upsert row shapes; and writes participant and aggregate
  timestamps from one UTC clock value per save.
- 2026-07-23: Script 10 now rolls back failed chatbot work and fails the
  overall task after processing the remaining chatbots. The transitional
  subprocess handler's non-zero exit propagation remains covered by six
  focused GraphQL tests. Script 13 now waits for script 2, and an isolated
  Hatchet task-registration test verifies that dependency plus the complete
  script-99 fan-in.
- 2026-07-23: Slice 3A verification passes Ruff format/lint, 116 Python tests
  with 3 integration skips, 6 focused GraphQL handler tests, the Hatchet
  build/typecheck/DAG test, Syncpack, Prisma schema sync, Prettier, and diff
  hygiene. A seeded database run and live Hatchet failed-task smoke still need
  a stable local runtime and are not represented by these unit-level gates.
- 2026-07-23: Slice 3A correctness committed as `6a8a81609`.
  Independent correctness and simplification reviews found no source-level
  regression. The accepted review findings remove a test-only Rollup entry and
  make the new Python correctness and Hatchet DAG tests run in CI.
- 2026-07-23: The Python CI gate uses an isolated, pinned 15-package test
  environment and passes all 23 focused correctness tests. This protects the
  reproduced Slice 3A fixes without downloading the multi-gigabyte ML/CUDA
  dependency set; the full 116-test suite remains a local/final gate until
  Slice 5A establishes the CPU-only worker dependency set.
- Active: Slice 3A, commit the independently reviewed CI adjustment.
- Next: Prove grading parity in Slice 3B.

## Finish evidence

- Exact local commands and results.
- Merge-conflict decisions that were not mechanical.
- Analytics row-parity and late-data evidence.
- Hatchet registration, DAG, concurrency, and cancellation evidence.
- Image build and Helm render evidence.
- Independent review findings and dispositions.
- Draft PR links and CI readback.

## Next Steps

1. Commit and independently review Slice 3A.
2. Prove numerical grading parity in Slice 3B.
3. Continue one verified slice at a time until both draft PRs are current.
