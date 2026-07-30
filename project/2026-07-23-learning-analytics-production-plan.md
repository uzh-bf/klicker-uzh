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
- Phase 1 PR:
  [#5199](https://github.com/uzh-bf/klicker-uzh/pull/5199)
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

- Confirm `hatchet-sdk[v0-sdk]==1.18.1`, now proven against local
  `hatchet-lite:v0.73.1`, against the deployed control-plane version before
  staging rollout.
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

This slice is executed as two tracer bullets: 4B.1 registers and verifies the
direct in-process 15-task DAG; 4B.2 adds bounded cooperative cancellation,
separates protected full runs from freshness-first incremental/finalize runs,
and proves runtime parity before cutover.

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
| Analytics types | Focused strict Pyright on changed typed boundaries; record the full Phase A baseline | No new findings in changed typed boundaries |
| Analytics tests | `cd apps/analytics && uv run pytest` | All tests pass |
| Hatchet packages | `volta run --node 24.16.0 pnpm exec turbo run check --filter=@klicker-uzh/hatchet --filter=@klicker-uzh/hatchet-worker-general` | Exit 0 |
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
- 2026-07-23: Slice 3A's independently reviewed CI adjustment committed as
  `80c9ae5cf`.
- 2026-07-23: Slice 3B reproduces and fixes numerical analytics differences
  from `packages/grading`: bounded and one-sided ranges, empty or undefined
  solutions, solution-range precedence with exact-solution fallback, and
  `Number.EPSILON` tolerance.
  Parity work also exposed and fixed the product grader's zero-bound truthiness
  defect, so a bound of exactly zero is no longer treated as absent.
- 2026-07-23: The deterministic interaction seeder now includes numerical
  element instances. The full analytics suite passes with 135 tests and 3
  integration skips; the isolated analytics CI subset passes 56 tests; all 10
  grading tests and the focused strict TypeScript check of the interaction
  response seeder pass.
- 2026-07-23: A seeded script-0 row diff could not run without borrowing
  another active worktree's database. Container labels confirmed that none of
  the running seeded environments belongs to this worktree, so no other
  agent's database was reused or reset. This remains a final runtime evidence
  item rather than being represented by unit parity tests.
- 2026-07-23: Slice 3B's independent review reproduced an ingestion and
  defense-in-depth defect where a partially parsed numerical response could
  become `NaN` and receive full range credit. The accepted adjustment requires
  a complete finite numeric string at ingestion, rejects non-finite values in
  the shared grader and Python analytics, and makes grading changes trigger the
  analytics parity workflow. A production-data audit for historical zero-bound
  responses remains a deployment gate because this worktree has no authorized
  production-data access.
- 2026-07-23: The accepted Slice 3B adjustments pass 139 analytics tests with
  3 integration skips, the exact isolated 60-test analytics CI command, all 10
  grading tests, 2 response-validation tests, both changed TypeScript package
  checks, Ruff lint/format, Prettier, and diff hygiene. The analytics process
  exits successfully despite the known sandbox-only `mirakuru` cleanup warning.
- Completed: Slice 3B numerical grading parity and review adjustments.
- 2026-07-23: Slice 3C uses a fresh isolated Postgres 15 database with repository
  seeds expanded to 252,170 `QuestionResponseDetail` and 2,047,528
  `LiveQuizResponse` rows. `EXPLAIN ANALYZE` disproves the designed detail
  composite: the real script-0 path supplied every participant and still
  fetched every row. Pushing the daily window into SQL uses the existing BRIN
  index and reduces the warm plan from about 27 ms to 0.44 ms.
- 2026-07-23: Slice 3C review found that the designed live-quiz query selected
  one first respondent per instance rather than one first attempt per
  participant and instance; the existing "last" metric also averaged every
  response instead of last attempts. The corrected window query now ranks both
  directions per `(participantId, instanceId)`, has a multi-participant
  database regression test, and uses
  `(instanceId, participantId, submittedAt)`. On the 2.0M-row fixture, the
  corrected full aggregation selects the 2,530 assessment responses for 30
  participants through that index and completes a warm run in about 4.1 ms
  with JIT disabled. The exact query-plan command prepended
  `EXPLAIN (ANALYZE, BUFFERS)` to
  `aggregated_live_quiz_analytics.sql` and executed it twice after
  `SET jit=off`; the warm run used
  `LiveQuizResponse_instanceId_participantId_submittedAt_idx` and completed in
  4.112 ms. The additional fixture expansion was local and ad hoc rather than
  committed, so this timing is directional; a staging-like representative
  rerun remains a production gate.
- 2026-07-23: A fresh migration-chain test reproduced PostgreSQL error `25001`
  when `CREATE INDEX CONCURRENTLY` was placed directly in Prisma 6.16's
  migration transaction. Review then found that a manual runbook could still
  be skipped and that editing a potentially applied migration was unsafe. The
  historical migration is restored byte-for-byte. Every repository Prisma
  deploy now runs an automated prebuild that checks migration history and
  invalid indexes, creates indexes concurrently, validates them, baselines the
  pending historical migration only when all earlier migrations are recorded,
  and then invokes Prisma. The guarded command succeeds both on a fresh
  181-migration database and on a disposable initialized-database simulation
  with the historical migration pending; both analytics migrations and the
  corrected index read back finished, valid, and ready.
- 2026-07-23: A live read-only shared-environment migration audit was attempted,
  but the Infisical endpoint `inf.prd.df-app.ch` timed out in DNS from this
  environment. Restoring the historical migration removes the checksum risk;
  the guarded deploy still verifies actual migration state before making any
  production change.
- 2026-07-23: Slice 3C also corrects scanner deduplication wording and records
  the dry-run buffer's downstream and incremental-union limitations. The
  window-query regression suite passes 38 tests.
- 2026-07-23: Final Slice 3C verification passes 141 analytics tests with 4
  integration skips, the exact isolated 62-test analytics CI command with 1
  database skip, and the new multi-participant database regression with both
  tests active. Prisma generation/typecheck, 4 namespace patch tests, 8 guarded
  deploy tests, schema-mirror validation, Hatchet DAG test/typecheck, Ruff,
  Prettier, and diff hygiene pass. A real scoped incremental script-0 run
  completed in 98.7 seconds against the enlarged fixture and wrote 94 DAILY,
  16 WEEKLY, 6 MONTHLY, and 34 COURSE rows. Both evidence-backed indexes report
  `indisvalid=true` and `indisready=true`.
- 2026-07-23: Follow-up Slice 3C review found that the guarded deploy could
  misclassify a partial schema as fresh and validated only index readiness.
  The accepted hardening now treats only zero required tables plus zero
  migration records as fresh; otherwise it fails closed with the missing table
  names. It also verifies the public-schema table, access method, ordered key
  columns, validity, and readiness of every same-name index; checks the SQL
  create-index inventory against the definitions; and holds one advisory lock
  across prebuild, optional historical baseline, and Prisma deploy.
- 2026-07-23: The hardened deploy passes 11 focused wrapper tests, a real run
  against an initialized disposable database, and a fresh locked 181-migration
  chain in `deploy_fresh_lock_review_20260723`.
- 2026-07-23: Final independent correctness review found no blocker. The
  simplification review's accepted follow-up makes the SQL inventory test
  compare table, access method, and ordered columns as well as names, and
  removes redundant validator state.
- Completed: Slice 3C query/index evidence, operational documentation, and
  guarded repository deploy path.
- 2026-07-23: Slice 4A pins `hatchet-sdk[v0-sdk]==1.18.1`, validates the
  existing camel-case producer contract into frozen per-run configuration,
  registers one one-slot non-mutating Python proof task, and preserves the
  TypeScript analytics worker as rollback. Script 14 now exposes an in-process
  entry point that receives the same immutable configuration; its CLI remains
  an environment adapter for existing callers.
- 2026-07-23: A dedicated disposable `hatchet-lite:v0.73.1` control plane
  accepted the Python worker over insecure local gRPC and completed
  `learning-analytics-native-proof` with
  `{native: true, mode: finalize, courseIds: [proof-course], windowSince: null}`.
  Focused configuration, registration, and direct-entry-point tests pass
  21/21 without analytics writes.
- 2026-07-23: Slice 4A verification passes Ruff format/lint across all 118
  analytics files, the full analytics suite with 147 passed and 4 integration
  skips, the exact isolated CI command with 83 passed and 1 database skip,
  focused strict Pyright with zero findings, uv lock validation, and diff
  hygiene. The known sandbox-only `mirakuru` cleanup warning occurs after
  successful pytest exit.
- 2026-07-23: Independent correctness and simplification reviews accepted the
  tracer without implementation blockers. The only accepted follow-ups make
  the new scope-isolation regression type-clean and advance this plan.
- Completed: Slice 4A native Python worker registration and compatibility
  tracer.
- 2026-07-23: Slice 4B.1 registers the existing 15-task analytics DAG in the
  Python worker with the same names, cron/events, parent fan-in, timeouts,
  retries, and guarded run-input contract. Every task imports its existing
  script module and calls `main()` in-process under task-local immutable
  configuration; no task mutates process-global environment state.
- 2026-07-23: The real Python worker registered the DAG against the dedicated
  disposable `hatchet-lite:v0.73.1` control plane. A finalize run against the
  empty, fully migrated synthetic database exercised the real in-process
  scripts and stopped at script 11's expected missing-data precondition rather
  than an SDK or graph error. A separate no-op runner using the exact same
  workflow definition then completed a fresh run through all 15 task nodes,
  including the three joins and final 14-parent `s99` fan-in.
- 2026-07-23: Slice 4B.1 verification passes focused Ruff and strict Pyright,
  24 focused runtime/configuration tests, the full analytics suite with 150
  passed and 4 integration skips, and the exact isolated CI command with 86
  passed and 1 database skip.
- 2026-07-23: Independent correctness review found two native-boundary
  blockers: script 11's `SystemExit` could bypass the pinned SDK's ordinary
  task-failure handler, and the SDK's implicit five-minute schedule timeout
  was unsafe with the conservative one-slot rollout. The accepted adjustment
  raises an ordinary analytics precondition error, normalizes any remaining
  script `SystemExit` at the direct-runner boundary, and applies an explicit
  168-hour schedule timeout to every DAG task. The control plane accepts hours
  but rejected the initial day-suffix spelling, which the runtime smoke caught
  before commit.
- 2026-07-23: A fresh deliberately delayed one-slot run completed all 15 nodes
  on the real disposable control plane in 17.8 seconds. Simplification review
  found no blocker; its only low-impact concern about an inert execution
  default is resolved because the workflow default now carries only the
  required schedule timeout.
- 2026-07-23: Post-review verification passes 26 focused tests, strict Pyright,
  the full analytics suite with 152 passed and 4 integration skips, and the
  exact isolated CI command with 88 passed and 1 database skip.
- Completed: Slice 4B.1 direct Python DAG registration and review.
- 2026-07-23: Slice 4B.2a adds task-local cooperative cancellation at every
  daily, weekly, monthly, course, activity, and chatbot outer work boundary in
  the long-running scripts. Direct CLI runs remain unaffected because no
  cancellation callback is bound outside the Hatchet task context.
- 2026-07-23: A dedicated local workflow using the production DAG and direct
  runner received a same-course superseding run. Hatchet delivered the cancel
  action, the running Python loop raised `AnalyticsRunCancelled`, the first
  workflow read back canceled, and the replacement completed. Verification
  also passes 26 focused tests, strict Pyright on the new typed boundary, the
  full analytics suite with 153 passed and 4 integration skips, and the exact
  isolated CI subset with 89 passed and 1 database skip. The broader
  script-level Pyright selection still reports ten pre-existing Pandas
  `Series`-to-string findings in scripts 3, 4, 6, and 7; no cancellation line
  introduces a new finding.
- 2026-07-23: Independent cancellation review found that one large course
  could still occupy the single worker slot while participant, week, or
  activity expansions ran, and simplification review found three separately
  committed phases without an intervening check. The accepted adjustment adds
  checks only at those safe compute/query and commit boundaries, never inside
  a database write. It also maps `AnalyticsRunCancelled` to Hatchet's
  non-retryable task exception so a superseded run cannot race a retry.
- 2026-07-23: Post-review cancellation verification passes 18 focused tests,
  strict Pyright on the typed worker/runtime/test boundary, the full analytics
  suite with 161 passed and 4 integration skips, and the exact isolated
  analytics CI subset with 97 passed and 1 database skip.
- Completed: Slice 4B.2a bounded cooperative cancellation.
- 2026-07-23: Slice 4B.2b keeps routing on the Hatchet control plane rather
  than adding a worker-side dispatcher. With one worker slot, a dispatcher
  could wait behind a long analytics task and delay a superseding freshness
  run. The existing `course-ended` and `admin-recompute-analytics` events now
  target the original freshness DAG directly; guarded full requests use
  `admin-recompute-analytics-full` and
  `recompute-learning-analytics-full`. GraphQL selects only the event key and
  preserves the existing payload contract. The transitional TypeScript worker
  also recognizes the full event so rollback remains functional until cutover.
- 2026-07-23: Both Python workflows register the same 15-task DAG. Freshness
  retains per-course/global `CANCEL_IN_PROGRESS`; full rebuilds use one global
  `CANCEL_NEWEST` group, reject non-full input, and continue to require
  `ANALYTICS_ALLOW_FULL=1`. The workflows have independent concurrency groups;
  this protects a running full rebuild from either a newer full request or a
  freshness cancellation, while the initial one-slot worker prevents
  simultaneous Python task execution.
- 2026-07-23: The dedicated local Hatchet control plane completed the
  concurrency matrix. Same-course freshness runs ended
  `CANCELLED` then `COMPLETED`; two full rebuilds ended `COMPLETED` then
  `CANCELLED`, proving that the running full rebuild wins. `course-ended`
  reached `recompute-learning-analytics`, and
  `admin-recompute-analytics-full` reached only
  `recompute-learning-analytics-full`. A historical cancellation-probe
  workflow still registered on the disposable control plane also observed
  `course-ended`; the production-named route remained unique and completed.
- 2026-07-23: Slice 4B.2b verification passes strict focused Pyright, Ruff,
  161 analytics tests with 4 integration skips, the exact isolated analytics
  CI subset with 97 passed and 1 database skip, the Hatchet DAG contract test,
  3 GraphQL event-routing tests, and TypeScript checks for types, Hatchet, and
  GraphQL.
- 2026-07-23: Exact-commit correctness review found no actionable issue and
  independently corroborated the persisted Hatchet concurrency/event states.
  Simplification review confirmed the dual-workflow design is the smallest
  safe control-plane implementation. Its deployment advisory is accepted:
  cutover and rollback are cold, and Slice 5 will enforce old-down-before-new-up
  so only one worker owns analytics events.
- Completed: Slice 4B native DAG parity, cooperative cancellation, and
  protected full-run concurrency.
- 2026-07-23: Slice 4C removes the TypeScript analytics workflow, injected
  script handler, subprocess implementation/tests, shared script map, and
  dedicated Node worker package. TypeScript still owns the unchanged
  `scan-ended-courses` cron and all GraphQL/manual event producers. A focused
  contract test proves `prepareHatchetTasks` registers no workflow while still
  returning the 01:00 UTC scanner.
- 2026-07-23: The image entrypoint moved in the same cutover slice so no commit
  leaves the dedicated deployable broken. Its multi-stage Python 3.12.11 image
  runs `src.hatchet_worker` directly as UID/GID 10001. The official uv
  CPU-only PyTorch index removes all CUDA/NVIDIA packages; ARM64 compiles
  `hdbscan` in the discarded builder and AMD64 uses its wheel. The resulting
  local images are 1.72 GB ARM64 and 1.80 GB AMD64.
- 2026-07-23: Native image builds pass for `linux/arm64` and `linux/amd64`.
  The AMD64 image imports `hdbscan` and reports `torch==2.11.0+cpu` with CUDA
  unavailable. The ARM64 image registers both 15-task workflows and the proof
  task against Hatchet v0.73.1, reports `HEALTHY` with one slot on SDK
  `/health`, exposes a healthy worker gauge on `/metrics`, executes the
  non-mutating proof task, and exits 0 after graceful SIGTERM shutdown.
- 2026-07-23: Staging and production Helm renders pass with the architecture
  repository corrected to `hatchet-worker-analytics-arm` and `Recreate`
  strategy. The scanner grace-period setting moved to the general-worker
  ConfigMap; obsolete subprocess settings were removed. `ANALYTICS_ALLOW_FULL`
  remains opt-in and is not enabled by chart defaults.
- Completed: Slice 4C cutover and Slice 5A minimal native image/render.
- 2026-07-23: Exact-commit review of the cutover found that the non-root image
  could not populate its runtime model cache. The accepted Slice 5B fix pins
  `intfloat/multilingual-e5-base` to revision
  `d128750597153bb5987e10b1c3493a34e5a4502a`, downloads it during the image
  build, and forces offline runtime loading. The exact upstream repository has
  no standalone license file; its immutable model card declares MIT and
  contains the citation, so the bundle retains that card as
  `UPSTREAM_MODEL_CARD.md`.
- 2026-07-23: The final digest-pinned images build natively for both target
  architectures. ARM64 is 2,848,584,888 bytes and AMD64 is 2,929,792,658
  bytes. Both load and encode German and English text with the bundled
  768-dimensional model under a non-root user, read-only root filesystem,
  dropped capabilities, and no network. AMD64 reports
  `torch==2.11.0+cpu` with CUDA unavailable.
- 2026-07-23: The analytics Deployment now has one pod and one worker slot,
  `Recreate`, a 3,660-second termination grace period, SDK-native
  `/health` probes and `/metrics` scraping, a writable `/tmp` `emptyDir`, a
  non-root RuntimeDefault security context, 200m/512 MiB requests, and a 4 GiB
  memory limit. Full rebuilds remain disabled unless a reviewed values
  override sets `allowFull=true`.
- 2026-07-23: Strict Helm lint and both environment renders pass. Fourteen
  deployment contracts pass for staging and production, including the
  architecture-specific image, secret reference, probes, resources, security
  context, and SDK-standard server URL. The guarded values override is the
  only render that emits `ANALYTICS_ALLOW_FULL=1`.
- 2026-07-23: The analytics image workflows now build ARM64 on the native
  GitHub ARM runner and AMD64 on `ubuntu-latest`, without QEMU. Draft PRs
  build but do not push, release builds push, and architecture-scoped GitHub
  Actions caches replace the previous forced no-cache builds. The public
  repository's configured Actions cache cap is 10 GB. `mode=min` retains the
  two final image chains (about 5.8 GB uncompressed total) without also caching
  discarded builder layers; GHCR container storage is currently free and
  standard GitHub-hosted runner usage is free for public repositories. Both
  workflow files parse and their matrix/action/push contracts pass.
- 2026-07-23: A final hardened ARM64 container registered the proof task and
  both 15-task workflows against disposable `hatchet-lite:v0.73.1`, reported
  `HEALTHY` with one slot, exposed a healthy Prometheus worker gauge,
  completed the non-mutating proof task, and exited 0 without OOM after a
  graceful SIGTERM.
- 2026-07-23: The operations runbook now covers compatibility and external
  secret prerequisites, cold deployment, proof and scoped staging checks,
  trigger modes, status, logs, retries, resources, full-run maintenance
  gating, and cold rollback. Live secret-key verification remains a
  pre-deployment gate: the configured staging/production Kubernetes contexts
  point to unavailable local endpoints, and no local Infisical profile for
  those environments exists. No secret values were read or exposed.
- 2026-07-23: Slice 5B local verification passes Ruff format/lint, 164 Python
  tests with 4 integration skips, focused strict Pyright for the new model and
  native-worker boundary, uv lock validation, Syncpack, nine TypeScript
  Hatchet/GraphQL checks, the TypeScript cutover test, three focused GraphQL
  routing tests, Prisma schema sync, Helm validation, and both image builds.
  Full analytics Pyright still reports the existing untyped Phase A baseline
  (2,300 findings across 112 files). The broad GraphQL suite again reaches the
  sandbox database boundary and fails with Prisma `EPERM` before database
  assertions; its database-free analytics routing tests pass 3/3.
- 2026-07-23: Exact-commit Slice 5B review found seven production issues. The
  full-run value is now schema-validated as a boolean and compared strictly;
  `--set-string ...allowFull=false` fails rendering instead of enabling the
  worker. The pod no longer mounts a service-account token.
- 2026-07-23: The model bundle now carries the complete Microsoft MIT notice,
  source, and pinned model revision alongside the exact model card. Debian
  package resolution uses the base image's dated 2025-09-29 Debian and
  security snapshots instead of live mirrors. Fresh ARM64 and AMD64 images
  build and pass the no-network, read-only model, license, snapshot, UID, and
  CPU-only runtime smoke.
- 2026-07-23: New analytics workflows pin every third-party action to an
  immutable commit. Pull requests build only the deployed ARM64 architecture;
  `v3` pushes and production tags build both ARM64 and AMD64. This keeps the
  full architecture gate off routine PR compute.
- 2026-07-23: The operations gate now requires the owning ExternalSecret or
  Infisical sync object to exist and report ready before checking generated
  Secret keys. Rollback restores one compatible image/chart/config generation,
  uses generation-specific verification, and allows 70 minutes for a draining
  worker.
- 2026-07-23: Focused Opengrep has no remaining mutable-action finding. Its
  five findings were reviewed: the configured 14-day uv cooldown is stricter
  than the suggested 7 days; the native worker imports only its fixed internal
  task map; the dry-run CLI now rejects modules outside discovered scripts;
  and both raw SQL warnings interpolate only UUID-validated values into static
  column templates. No installed image vulnerability scanner is available, so
  registry/image CVE scanning remains an explicit CI or pre-deployment gate.
- 2026-07-23: The final full Python rerun exposed an order-dependent
  table-existence test. Unbound sessions no longer use an object-ID cache key
  that Python can recycle; production sessions keep the stable database-bind
  cache, and a two-session regression proves uncached binds are queried
  independently. The full suite now passes 165 tests with 4 integration skips.
- 2026-07-23: Final simplification shares the immutable Debian snapshot setup
  between image stages. Fresh ARM64 and AMD64 builds retain their separate
  runtime packages and both pass the non-root, no-network, read-only model,
  license, snapshot, and CPU-only smoke.
- 2026-07-23: The refreshed Phase 1 base received three final correctness
  commits (`3ba307ccef`, `f6df11d3a9`, and `1da4c868ba`). They correct
  participant/instance first-and-last live-quiz attempts, require current
  non-declined chatbot-disclaimer consent, and make daily through monthly
  windows UTC-safe with exclusive next-midnight ends. Independent review found
  no remaining Phase 1 blocker.
- 2026-07-23: Merged final `chat-analytics` head `1da4c868ba` into Phase 2 as
  `a23627c147`. The commit hook passed all 24 runnable repository typechecks,
  lint, formatting, Syncpack, AGENTS validation, and Prisma schema sync.
- 2026-07-23: The final database-backed SQL checks pass for current consent,
  UTC window parameters, live-quiz first/last ranking, and clustering queries.
  The complete database-enabled analytics suite passes 178 tests in
  5 minutes 44 seconds. The run exposed and then verified a test-only
  isolation defect: runtime tests imported `src.db` under fake database URLs
  and retained those modules for later database tests. Autouse fixtures now
  restore the prior module state after those tests.
- 2026-07-23: Final local verification also passes Ruff formatting/lint across
  125 files, uv lock validation, focused strict Pyright on the changed native
  worker/runtime/model and SQL-test boundaries, Syncpack, GraphQL and Hatchet
  typechecks, three GraphQL event-routing tests, the TypeScript cutover test,
  Prisma schema-mirror validation, strict staging/production Helm lint and
  renders, guarded `allowFull` rendering, and immutable-action workflow
  validation. Full Phase A Pyright remains the recorded existing baseline of
  about 2,300 findings rather than a false all-green gate.
- 2026-07-23: Final ARM64 and AMD64 images rebuilt from the stacked head and
  passed non-root, no-network, read-only, capability-dropped model and license
  smoke. A final ARM64 worker registered the proof task and both 15-task DAGs
  against disposable Hatchet v0.73.1, completed the proof task with the
  expected immutable input, and exited gracefully.
- 2026-07-23: Final security review found no high-confidence exploitable
  vulnerability. Four focused Opengrep findings are allowlisted dynamic
  imports or UUID-validated values interpolated into static SQL templates.
  The GraphQL recompute mutation still requires full user access and course
  administration; full rebuilds additionally require the server-side
  `ANALYTICS_ALLOW_FULL` gate. Image CVE scanning and live
  ExternalSecret/Infisical readiness remain explicit pre-deployment gates
  because no scanner or live environment access is available here.
- 2026-07-24: Final Phase 1 review found four related privacy/correctness gaps:
  aggregate message metrics did not apply current consent, consent revocation
  retained participant/aggregate rows and downstream outcomes, a
  below-threshold recluster retained old topics, and scoped runs still read or
  timestamped courses outside the current scope. Commits `3510240467` and
  `f11b17c20` address those gaps while preserving the existing GraphQL and
  analytics stack.
- 2026-07-24: The corrections are translated into the Phase 2 SQLAlchemy path.
  Scoped chat windows now delete and rebuild atomically; empty valid results
  reconcile outcomes and activity flags; participant response reads and
  validity watermarks stay inside the current course scope; and aggregate
  messages require current, non-declined consent.
- 2026-07-24: Focused native-worker verification passes Ruff and 79 tests.
  Four new PostgreSQL regressions pass against the disposable migrated
  database: declined/stale consent exclusion, revocation cleanup, preservation
  of another course during scoped runs, empty downstream reconciliation,
  rollback after a failed rebuild, database-level participant-read scoping,
  and scoped validity marking.
- 2026-07-24: The complete database-enabled analytics suite passes 188 tests
  with 18 existing dependency/dataframe warnings in 5 minutes 49 seconds.
- 2026-07-24: Exact-merge review found one remaining release blocker:
  incremental consent revocation only reconciled the 14-day lookback and
  retained older participant and aggregate windows. Phase 2 now purges
  ineligible participant rows across retained history, splits consent-affected
  courses into targeted historical rebuilds from their earliest affected
  message or aggregate, and clears then refreshes the scoped chat watermark so
  participant and aggregate stages coordinate through a durable handoff.
  The new old-window PostgreSQL regression passes before and after the
  participant purge.
- 2026-07-24: The refreshed complete suite passes 189 tests with 18 existing
  dependency/dataframe warnings in 5 minutes 47 seconds; Ruff formatting and
  lint pass across 129 files. The accepted simplification avoids source-count
  queries when logging is disabled, and the strict maintainability follow-up
  centralizes test module restoration.
- 2026-07-24: The environment publication gate rejected the updated Phase 1
  push despite the approved draft-PR workflow. Both branches will remain local
  until the user explicitly reconfirms publication.
- 2026-07-24: Final sequencing review found that independent script-8 and
  script-9 roots could let the validity marker swallow a consent change.
  Script 9 now waits for script 8, preserving the watermark handoff. Dry runs
  bypass consent-history queries and purges while the capture buffer is active.
- 2026-07-24: The same review reproduced acceptance arriving after script 8
  but before the final marker. The native worker now binds Hatchet's immutable
  workflow-creation time into the final SQL instead of stamping completion
  time, leaving mid-run consent changes visible for the next rebuild.
- 2026-07-24: A disposable Hatchet v0.73.1 task using the pinned Python SDK
  read the workflow creation timestamp from its live task context and matched
  it exactly against REST readback. The six-case PostgreSQL privacy suite,
  including the acceptance-interleaving convergence regression, passes.
- 2026-07-24: Exact-commit review confirmed the incremental sequencing races
  are closed, then reproduced three remaining production boundaries:
  mid-run consent could be stranded by finalization, the supported shell
  launcher had no shared cutoff, and non-UTC sessions shifted a UTC cursor.
  Finalization now stays pending until a follow-up converges, the launcher
  exports one fail-closed cutoff, and SQL stores it explicitly as UTC-naive.
  Simplification review's accepted cleanup also makes the final marker read
  mode, scope, and cutoff from one immutable run-config snapshot.
- 2026-07-24: Nine PostgreSQL privacy cases now pass, including acceptance and
  revocation during finalize plus a Europe/Zurich session-timezone regression.
  A fake-pnpm launcher smoke observed one identical UTC cutoff across all 15
  scripts. Bash syntax, 47 focused unit tests, full Ruff, Prettier, diff
  hygiene, and a focused 293-rule Opengrep scan pass.
- 2026-07-24: The refreshed complete database-backed analytics suite passes
  192 tests with 18 existing dependency/dataframe warnings in 6 minutes.
- 2026-07-24: Final race review found that a consent change committing after
  the final-marker snapshot could leave an ended course finalized and outside
  the nightly scanner. The scanner now also requeues finalized courses whose
  chat cutoff is missing or older than current consent/disclaimer state, or
  whose participant chat rows are no longer eligible. Requeued finalized
  courses can pass through the final marker again and converge.
- 2026-07-24: Hatchet workflow creation times are normalized to the
  PostgreSQL `TIMESTAMP(3)` boundary and shifted back one millisecond before
  use. The supported shell launcher calls the same helper. A PostgreSQL
  regression proves a consent timestamp in the workflow's creation
  millisecond remains visible, and a direct scanner query selects late
  consent, never-finalized, and stale-row cases while excluding clean and
  active courses. The focused privacy/finalization suite passes 26 tests;
  Hatchet typecheck and both scanner tests pass.
- 2026-07-24: Review found that the first scanner query materialized dirty
  privacy state from all retained chat rows before applying the ended-course
  filter. A disposable benchmark with 1,000 courses, 10,000 chatbots, one
  million consent rows, and 500,000 participant-chat rows reduced the warm
  plan from about 382 ms to 99 ms by materializing the 50 ended courses first.
  A `ChatUsageCredits(chatbotId)` index reduced it further to about 46 ms, but
  that extra write/index cost is not justified for a once-daily 99 ms query
  without representative staging evidence, so no speculative index is added.
- 2026-07-24: The refreshed complete database-backed analytics suite passes
  199 tests with 18 existing dependency/dataframe warnings in 5 minutes
  57 seconds. The focused privacy/finalization suite passes 26 tests; Ruff
  formatting and lint pass across 130 files; the uv lock, Hatchet typecheck,
  scanner tests, direct PostgreSQL scanner semantics, launcher cutoff smoke,
  and diff hygiene all pass. A focused 452-rule Opengrep scan reports no
  findings.
- 2026-07-24: Independent correctness review of commits `871e7b8ce4` and
  `9e43cb9326` found no remaining correctness or performance finding at
  confidence 75 or higher. Independent simplification review found no safe
  smaller form for the cutoff helper, launcher, scanner query, or
  same-millisecond regression. The repeated privacy predicate across Python
  reconciliation and the TypeScript scanner remains a future data-model
  concern; centralizing it safely would require a database view or synchronous
  invalidation design rather than a local cleanup.
- 2026-07-24: Exact code head `9e43cb9326` produced fresh ARM64 and AMD64
  images with digests
  `sha256:15ffa6c1bfbcf55c591900b2ba879e9326b7a6400d9825e15f30cf673a31e45e`
  and
  `sha256:ae1a98a888b4f12be149e048f611736fb9692cc4064ffc76115c57dfcdac176f`.
  Both passed non-root UID 10001, no-network, read-only-root,
  capability-dropped, CPU-only model/license/embedding smoke. The ARM64 worker
  then registered the proof task and both complete 15-task DAGs against
  disposable Hatchet v0.73.1, reported healthy with one slot, completed the
  immutable-input proof workflow, and stopped cleanly.
- 2026-07-24: The final security gate found no high-confidence vulnerability
  in the cutoff or scanner change. The scanner uses static SQL identifiers and
  a parameterized server-generated `Date`; the worker and shell launcher use
  one server-controlled immutable cutoff. The full branch still requires image
  CVE scanning and live ExternalSecret/Infisical readiness verification before
  deployment because neither capability is available in this environment.
- 2026-07-24: The first maintainability decomposition preserved all 46
  production definitions exactly, but strict review correctly rejected its
  955-line mixed `workbook_sections.py` and 20-symbol private sibling import as
  threshold-only splitting. The accepted refinement leaves a 414-line write
  interceptor, 824-line workbook renderer, and 685-line domain-summary
  builder. Their sibling interface is explicit and public, the two module
  import orders pass, and focused Pyright reports no new cross-module private
  usage.
- 2026-07-24: The 807-line mixed interceptor/workbook test is also split into
  315-line interceptor and 478-line workbook modules with one workbook import.
  The 1,295-line privacy regression is split into shared fixtures plus scope,
  reconciliation, cutoff/finalization, and rollback modules; all 12
  helper/test function ASTs and decorators are preserved. The 10 PostgreSQL
  privacy cases and 55 tests across six focused dry-run/interceptor files pass,
  with three additional expected no-database skips in the latter group.
- 2026-07-24: The exact final maintainability cleanup localizes the generic
  diagnostic truncation helper in the workbook renderer and removes one unused
  JSON helper from the domain builder. Independent correctness re-review and
  the final strict maintainability/simplification gate both pass with no
  finding at confidence 75 or higher. The final modules are a 414-line write
  interceptor, 827-line workbook renderer, and 669-line domain-summary
  builder, with seven public sibling imports, no private sibling dependency,
  and no import cycle.
- 2026-07-24: The exact final code head `d7064ed7d` passes all 199
  database-enabled analytics tests with 18 existing dependency/dataframe
  warnings in 358.82 seconds. Ruff passes across all 137 analytics Python
  files; both module import orders, the focused 55-test dry-run suite, the 10
  PostgreSQL privacy cases, and the repository commit hook also pass.
- 2026-07-29: Live refresh found `origin/v3` advanced by the Prisma 7 upgrade
  and Office Add-in rewrite. Both stacked draft PRs now report conflicts.
  Phase 1 overlaps upstream in `docs/log.md`, `docs/testing.md`,
  `packages/prisma-data/package.json`, and `pnpm-lock.yaml`; the next slice is
  to merge current v3 into Phase 1, verify it, then merge the refreshed Phase 1
  into Phase 2 and rerun the affected analytics gates.
- 2026-07-29: Phase 1 now contains current `origin/v3` at merge commit
  `7350ad1c13`. Conflict resolution preserves both documentation histories,
  adopts the regenerated Prisma 7/pnpm lock state, and retains the Phase 1
  Python analytics runtime. Repository `check:all` passes, Prisma Client Python
  still generates for Phase 1, and all 36 Phase 1 Python tests pass.
- 2026-07-29: The refreshed Phase 1 is merged into Phase 2 without restoring
  the archived Prisma-Python runtime. The resolution keeps Prisma 7 for the
  TypeScript client and deployment tooling, SQLAlchemy 2.x for the Analytics
  runtime, and the guarded analytics-index deploy wrapper. Current
  schema-mirror documentation and checks now require the Analytics-owned
  datasource only; no current instruction references the deleted
  `py.prisma`.
- 2026-07-29: Phase 2 repository `check:all` passes all 25 runnable typechecks,
  seven lint tasks, Prisma generation, 11 guarded analytics-index deploy tests,
  formatting, Syncpack, AGENTS validation, and Prisma schema sync. Against a
  fresh PostgreSQL 15 database initialized with the Prisma 7 schema, repository
  seeds, and deterministic analytics interactions, the complete analytics
  suite passes 199 tests with nine dependency/dataframe warnings in 64.90
  seconds; Ruff reports no findings.
- 2026-07-29: The verified Phase 2 reconciliation is committed as
  `181c229cb2`. Independent spec review found no lost requirement, scope creep,
  tRPC addition, or incorrect merge behavior. Standards review found one
  contradictory model-ownership rule: current guidance could overwrite the
  curated SQLAlchemy runtime model with an unfiltered introspection result.
- 2026-07-29: The accepted review fix makes `src/models.py` explicitly curated
  and generates the ignored `src/models.generated.py` reference through a
  credential-safe Python wrapper. The wrapper selects the installed psycopg 3
  driver, succeeds against the disposable migrated database, does not print
  the connection string, and leaves the curated model hash unchanged. Ruff
  passes across 138 files.
- 2026-07-29: Standards re-review passes after separating the Analytics
  generation commands: `generate:raw` consumes the DevPod's injected
  `DATABASE_URL`, while `generate` remains the legacy Infisical wrapper. The
  raw path succeeds end to end against a second disposable migrated PostgreSQL
  15 database, and current documentation and skills consistently distinguish
  the two environments.
- 2026-07-29: The full production monorepo build passes all 22 runnable build
  tasks under Node 24 and pnpm 11.5.0. The first sandboxed attempt reached the
  frontend builds but could not resolve Google Fonts; the allowed rerun
  completed without a repository failure. Existing Rollup, page-size,
  translation, and cache warnings remain non-blocking.
- 2026-07-30: Publication was approved with an explicit request for clean
  stacked PRs. The 94 implementation commits were replayed onto current `v3`
  and split at 14 review boundaries. The original verified heads remain
  available as `backup/chat-analytics-pre-restack-20260730` and
  `backup/analytics-phase-a-pre-restack-20260730`.
- 2026-07-30: A final tree comparison against the verified Phase 2 safety ref
  found no implementation difference. After `v3` advanced once more, the
  stack rebased cleanly onto `f424f03a16`; the only resulting difference from
  the safety ref was the five-line upstream `AGENTS.md` change.
- 2026-07-30: The full draft stack was published and read back from GitHub:

  | Layer | Draft PR | Review scope |
  | --- | --- | --- |
  | 1 | [#5199](https://github.com/uzh-bf/klicker-uzh/pull/5199) | Chat, platform, live quiz, topic-cluster, and chat-to-quiz analytics domains |
  | 2 | [#5073](https://github.com/uzh-bf/klicker-uzh/pull/5073) | Transitional Hatchet orchestration and dedicated worker |
  | 3 | [#5230](https://github.com/uzh-bf/klicker-uzh/pull/5230) | Incremental recomputation and ended-course finalization |
  | 4 | [#5231](https://github.com/uzh-bf/klicker-uzh/pull/5231) | Deterministic verification, consent, and reporting correctness |
  | 5 | [#5232](https://github.com/uzh-bf/klicker-uzh/pull/5232) | Query indexes, late-data refresh, and decomposed DAG |
  | 6 | [#5233](https://github.com/uzh-bf/klicker-uzh/pull/5233) | SQLAlchemy 2.x runtime migration |
  | 7 | [#5234](https://github.com/uzh-bf/klicker-uzh/pull/5234) | Course scope, DAG hardening, and management API |
  | 8 | [#5235](https://github.com/uzh-bf/klicker-uzh/pull/5235) | Read-only dry-run workbook and diagnostics |
  | 9 | [#5236](https://github.com/uzh-bf/klicker-uzh/pull/5236) | Grading parity, query paths, and guarded index rollout |
  | 10 | [#5237](https://github.com/uzh-bf/klicker-uzh/pull/5237) | Native Python Hatchet cutover, cancellation, and concurrency |
  | 11 | [#5238](https://github.com/uzh-bf/klicker-uzh/pull/5238) | Consent reconciliation and finalization convergence |
  | 12 | [#5239](https://github.com/uzh-bf/klicker-uzh/pull/5239) | Dry-run decomposition and curated model ownership |
  | 13 | [#5240](https://github.com/uzh-bf/klicker-uzh/pull/5240) | Generated artifact reconciliation with current `v3` |
  | 14 | [#5241](https://github.com/uzh-bf/klicker-uzh/pull/5241) | Runtime and test reconciliation with current `v3` |

- 2026-07-30: Fresh stack-head Analytics verification passes Ruff format and
  lint across 138 files and 184 tests with 15 PostgreSQL-only skips. The
  database-enabled 199-test result, repository `check:all`, and 22-task Node 24
  production build remain earlier verification of the identical
  implementation tree. The fresh-worktree repository check ran before
  generated workspace artifacts existed, and the pre-push build later stopped
  on `ENOSPC`; both are recorded as warnings in the draft PR descriptions.
- Active: Read the 14 draft PR checks to a terminal result, update stale
  descriptions if GitHub reports a different branch range, and stop without
  merging or deploying.

## Finish evidence

- Exact local commands and results.
- Merge-conflict decisions that were not mechanical.
- Analytics row-parity and late-data evidence.
- Hatchet registration, DAG, concurrency, and cancellation evidence.
- Image build and Helm render evidence.
- Independent review findings and dispositions.
- Draft PR links and CI readback.

## Next Steps

1. Read every stacked draft PR check to a terminal result. Fix only failures
   caused by the stack; leave all PRs draft and do not merge or deploy.
2. Before staging, scan the exact image digest for CVEs, confirm the deployed
   Hatchet control-plane compatibility, and verify the owning
   ExternalSecret/Infisical sync is ready.
3. Cold-cut over in staging with one replica and one slot. Run the proof task
   and one scoped incremental/finalize course, compare rows and privacy
   convergence, and measure duration, query plans, memory, and CPU before
   changing resources or enabling the schedule.
