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
- Phase 2 target: `chat-analytics`
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

- Select and pin the newest Python SDK version proven compatible with local
  `hatchet-lite:v0.73.1` and the deployed control-plane version.
- Measure a representative incremental run before choosing worker slots and
  Kubernetes resources. Start with one pod and two slots unless evidence
  requires less.
- Verify the existing analytics image repositories and secret mappings before
  changing Helm values.

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

### Slice 3 — Close known correctness and CI gaps

**Do**

- Make the existing PR checks green.
- Verify late-data upserts, `s13` ordering, full fan-in before `s99`, index
  coverage, homogeneous bulk-upsert rows, UTC timestamps, and numerical grading
  parity against `packages/grading`.
- Fix only findings reproduced against the integrated branch.
- Update stale comments and dry-run limitations.

**Check**

- Focused unit/integration tests for each accepted fix.
- Seeded analytics run and row-level assertions where feasible.
- Migration and `EXPLAIN ANALYZE` evidence on representative data.

**Commit**

- Split correctness, schema/index, and test changes when one commit would hide
  independent behavior.

### Slice 4 — Replace the Node subprocess bridge with native Python Hatchet

**Do**

- Add a pinned, compatibility-tested `hatchet-sdk` dependency.
- Define the existing 15-task DAG in Python with the same names, triggers,
  dependencies, modes, and full-run guard.
- Call Python analytics entry points directly; do not spawn `uv` subprocesses.
- Keep the TypeScript course scanner and event producers.
- Add cooperative cancellation checks at bounded course/window steps.
- Separate protected full rebuild concurrency from freshness-first incremental
  and finalize runs.
- Remove only bridge code and image layers made obsolete by the Python worker.

**Check**

- Unit tests for input/mode resolution, DAG dependencies, guard rails, and
  cancellation.
- Register the worker against local `hatchet-lite:v0.73.1`.
- Trigger a small workflow and confirm parent/fan-in behavior.
- Trigger a superseding run and confirm cancellation stops Python work.

**Commit**

- `refactor(analytics): run pipeline on native Python Hatchet worker`

### Slice 5 — Make the worker deployable and observable

**Do**

- Convert the dedicated image to a Python worker image while preserving all
  analytics dependencies.
- Align Node/uv/Python versions with current repository pins where still
  applicable.
- Fix architecture-specific image repository/tag wiring.
- Add non-root runtime, health/metrics probes, graceful termination, low initial
  slots, explicit resources, and immutable image behavior.
- Verify Infisical/ExternalSecret mappings without reading or exposing secret
  values.
- Add an operator runbook for trigger, status, logs, failure, retry, and
  rollback.

**Check**

- Build the image locally.
- Render Helm for staging and production values.
- Validate probes, command, environment names, image references, and secret
  references.
- Run container health and worker-registration smoke checks.

**Commit**

- Separate build and deployment commits if each is independently valid.

### Slice 6 — Finish verification and draft PRs

**Do**

- Run the full relevant local verification suite.
- Record runtime and row-parity evidence; state unavailable environment checks
  explicitly.
- Run final security, maintainability, simplification, and branch reviews.
- Create the missing draft PR from `chat-analytics` to `v3`.
- Refresh [#5073](https://github.com/uzh-bf/klicker-uzh/pull/5073)
  from the complete branch diff and current plan.
- Read back CI. Do not mark ready or merge.

**Check**

- Both draft PRs describe the whole branch, evidence, remaining manual checks,
  rollout order, and rollback.
- Required CI is green or has an exact external blocker.

## Progress

- 2026-07-23: User approved preserving the existing stack and pulling in
  `v3`. tRPC was explicitly removed from scope.
- 2026-07-23: Live branch, PR, ClickUp, deployment, and Hatchet documentation
  review completed.
- 2026-07-23: Phase 1 worktree created at
  `trees/chat-analytics-integration`; branch is clean at `99c77b1480`.
- Active: Slice 0, plan commit and independent review.
- Next: Merge `origin/v3` into `chat-analytics`.

## Finish evidence

- Exact local commands and results.
- Merge-conflict decisions that were not mechanical.
- Analytics row-parity and late-data evidence.
- Hatchet registration, DAG, concurrency, and cancellation evidence.
- Image build and Helm render evidence.
- Independent review findings and dispositions.
- Draft PR links and CI readback.

## Next Steps

1. Review and commit this plan.
2. Merge current `v3` into `chat-analytics`.
3. Continue one verified slice at a time until both draft PRs are current.
