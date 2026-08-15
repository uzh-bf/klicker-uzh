# Learning analytics engine contract

Status: approved; planning-stage review complete; implementation not started.

## Goal

Publish the inert, versioned public contract that lets KlickerUZH dispatch course and
platform learning-analytics workflows to the Catalyst Hatchet runtime without exposing
Catalyst implementation details or coupling this package to Hatchet.

This is the public LA-P1 layer. It defines protocol only. It does not register or run a
workflow.

## Work package

- Branch: `rs/learning-analytics-contract`
- Base: `origin/v3` at `2bcaddabe3bf3b39e23e71e7cf3eda7179f6291f`
- Worktree: `trees/learning-analytics-contract`
- Ceremony: full path because this is a cross-repository public contract.
- Target: one independently reviewable, green, inert draft PR.
- Expected substantive size: 300-500 lines across at most ten substantive files,
  excluding this plan, wiki/log documentation, generated lockfile changes, and CI.
- Complexity stop: pause above roughly 600 substantive lines or ten substantive files
  and recheck the package boundary.

## Evidence

- `packages/*` is already included by the pnpm workspace; no workspace or Turbo change
  is needed.
- The repository uses Node 24, pnpm 11, TypeScript 6, Rollup, Vitest, and Zod 3.25.76.
- KlickerUZH currently has no analytics engine contract package or analytics Hatchet
  workflow registration.
- Public course identifiers are UUIDs.
- The accepted architecture has one active contract generation and two Catalyst-owned
  Hatchet workflows: one course workflow and one platform workflow.
- Catalyst PR #11, the framework-neutral learning-analytics pipeline, is merged. This
  contract is the next dependency; its immutable public commit and digest must be read
  back before Catalyst conformance work starts.
- A separate planning-stage specialist reviewed this plan on 2026-08-15 and resolved
  the data formats, identity echo, framework-neutral invocation seam, digest approach,
  tests, documentation, and review gates.

## Contract decisions

### Generation and workflow identity

- The contract generation is the literal `v1`; package semantic versioning does not
  replace or negotiate the contract generation.
- Exactly one generation is active. There is no negotiation, fallback, or dual run.
- Course workflow name: `learning-analytics-course-v1`.
- Platform workflow name: `learning-analytics-platform-v1`.

### Course workflow

The strict input contains:

- `contractVersion`: literal `v1`
- `runId`: UUID string
- `courseId`: UUID string
- `mode`: `incremental`, `finalize`, or `full`
- `windowSince`: optional valid calendar date in `YYYY-MM-DD` form

The strict success result repeats every immutable input field, including the exact
presence and value of `windowSince`, and adds `completedAt`. The timestamp must be an
RFC 3339 datetime with `Z` or an explicit offset; a timezone-naive value is invalid.

### Platform workflow

The strict input contains `contractVersion` and `runId`. The strict success result
repeats both fields and adds a timezone-qualified `completedAt` value.

### Failure semantics

Workflow failures and cancellations remain rejected child runs. The contract has no
successful failure envelope, status field, error field, or cancellation result schema.

### Framework boundary

- Public consumers receive SDK-free typed stubs backed by an injected asynchronous
  invoker.
- Stubs validate input before dispatch and validate successful output before returning.
- A callback rejection remains a rejection; the package never converts it to success.
- Hatchet registration, clients, task types, schedules, worker code, and credentials
  stay outside this package.

### Immutable digest

The package exports a canonical readonly tuple tree covering workflow names,
strictness, field order, requiredness, formats, literals, and mode values. It exports
the SHA-256 digest of `JSON.stringify` on that tree using `node:crypto`. Tests pin the
expected digest. No generated schema file is committed.

## Scope

Add the package under `packages/analytics-engine-contract` with:

- package, TypeScript, Rollup, and Vitest configuration;
- strict Zod schemas and inferred public types;
- workflow and generation constants;
- synthetic course and platform fixtures;
- SDK-free injected workflow stubs;
- a black-box callback conformance runner;
- contract tests;
- a path-filtered CI workflow;
- public architecture, asynchronous-worker, testing, skill, and dated-log updates.

## Exclusions

This work package does not change:

- Prisma models, migrations, database grants, or product state;
- GraphQL schema, operations, resolvers, or generated artifacts;
- `packages/types`, `packages/hatchet`, or existing workers;
- Hatchet workflow registration, scheduling, batching, retries, queues, or deployment;
- runtime configuration, secrets, images, Helm, ArgoCD, or production services;
- the existing analytics UI, API read models, or legacy analytics application;
- Catalyst code, source PR retirement, branch deletion, merge readiness, or activation.

Any need to enter an excluded surface stops implementation for scope review.

## Test portfolio

| Risk | Primary seam | Required proof |
| --- | --- | --- |
| Invalid generation or shape is accepted | Zod schemas | Reject wrong version, unknown fields, invalid UUID, date, datetime, and mode |
| A success belongs to another run | Conformance success probes | Require an exact course/platform identity echo, including optional-window presence |
| The public package becomes Hatchet-specific | Injected invoker stubs | Dispatch exact workflow names with no Hatchet imports in source or declarations |
| Failure becomes a success envelope | Conformance failure probes | Preserve failure and cancellation rejections unchanged |
| Repositories drift silently | Canonical tuple tree | Pin and reproduce the exported SHA-256 digest |

Equivalent malformed cases are parameterized. Each named test protects a distinct
observable behavior rather than implementation details.

## Slices

### S0 — Persist this execution contract

**Do**

- Add only this reviewed plan.
- Record the exact branch, base, approved decisions, boundaries, tests, gates, and
  progress.

**Check**

- Reconfirm the branch and base.
- Review staged content for secrets and personal data.
- Run `git diff --cached --check`.

**Commit**

- `docs(project): add learning analytics contract plan`

### S1 — Add the complete inert contract package

**Do**

- Add the package configuration, schema, fixtures, stubs, conformance runner, tests,
  lockfile importer, and path-filtered CI workflow.
- Keep scenario controls such as `success`, `invalid-input`, `failure`, and `cancelled`
  outside workflow JSON.
- Validate both successful workflows, exact identity, malformed input, malformed
  output, failure rejection, and cancellation rejection.

**Check**

- `pnpm --filter @klicker-uzh/analytics-engine-contract test`
- `pnpm --filter @klicker-uzh/analytics-engine-contract check`
- `pnpm --filter @klicker-uzh/analytics-engine-contract build`
- Inspect built declarations for Hatchet SDK imports or types.
- Confirm the lockfile adds only the new workspace importer and existing resolutions.
- Review staged content for secrets and personal data.

**Commit**

- `build(analytics): add engine v1 contract package`

**Review**

Run one risk-selected read-only intermediate review on the exact commit, focused on
schema strictness, identity, rejection propagation, digest reproducibility, and
framework independence.

### S2 — Document and finish the public boundary

**Do**

- Update `docs/architecture-overview.md`, `docs/async-and-workers.md`, and
  `docs/testing.md`.
- Update `.agents/skills/klicker-testing-verification/SKILL.md` so pure analytics
  contract changes route to the package checks.
- Add `docs/log/2026-08-15-learning-analytics-contract.md`.
- Update this progress ledger with exact verification and review evidence.

**Check**

- Validate the wiki with its repository script.
- Run the package tests, type check, and build again.
- Run `pnpm run check:all`, `pnpm run build`, and `pnpm run knip`; classify advisory
  output instead of hiding it.
- Run `git diff --check` and review staged data hygiene.
- Browser, Prisma, GraphQL code generation, service, and end-to-end checks are outside
  this inert package's proof boundary.

**Commit**

- `docs(analytics): document engine contract boundary`

## Final gates

On the exact final range:

1. Run the bounded code-level security review.
2. Run the mandatory maintainability review.
3. Run the integrated capable-model review.
4. Verify the four work-package tests: independently functional, reviewable, green,
   and safe to land.
5. Compute substantive size and update the complete draft PR description.

Push and draft-PR creation require a separate approval. After publication, read back
the immutable public commit and digest before any Catalyst branch pins it. The public
PR stays inert and draft until private conformance and contract-authority checks pass.
Merge, readiness, deployment, activation, and source retirement are separate gates.

## Progress

- [x] Public branch and base verified at `2bcaddabe3bf3b39e23e71e7cf3eda7179f6291f`.
- [x] Catalyst framework-neutral pipeline PR #11 merged.
- [x] Public codebase and package patterns mapped.
- [x] Planning-stage specialist review completed with no unresolved owner decision.
- [x] Plan approved through the existing LA-P1 topology and the instruction to proceed.
- [x] S0 plan commit complete.
- [ ] S1 contract package complete and reviewed.
- [ ] S2 documentation and final verification complete.
- [ ] Final gates complete.
- [ ] Branch pushed and draft PR published.
- [ ] Immutable public commit and digest read back for Catalyst.
