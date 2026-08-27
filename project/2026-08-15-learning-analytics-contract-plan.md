# Learning analytics engine contract

Status: approved; S0-S2 complete; intermediate findings closed; final gates in progress.

## Goal

Publish the inert, versioned public contract that lets KlickerUZH dispatch course and
platform learning-analytics workflows to the Catalyst Hatchet runtime without exposing
Catalyst implementation details or coupling this package to Hatchet.

This is the public LA-P1 layer. It defines protocol only. It does not register or run a
workflow.

## Work package

- Branch: `rs/learning-analytics-contract`
- Review base: `rs/participant-data-use-settings` at
  `a31d5cd6a760e5c6e34bc5c3fd170a4efffc16d5`.
- Provenance: the original LA-P1 head
  `10a4204e469f7801343299af362ec38c2ed8f3ec`, based at
  `2bcaddabe3bf3b39e23e71e7cf3eda7179f6291f`, was restacked by an explicit merge so
  the published branch can advance without rewriting history.
- Worktree: `trees/learning-analytics-contract`
- Ceremony: full path because this is a cross-repository public contract.
- Target: existing inert draft PR #5413, independently reviewable above the
  participant data-use settings layer.
- Expected substantive size: 300-500 lines across at most ten substantive files,
  excluding this plan, wiki documentation, generated lockfile changes, and CI.
- Complexity stop: pause above roughly 600 substantive lines or ten substantive files
  and recheck the package boundary.
- Actual repository-defined substantive size: `+850/-3` across 16 files, excluding
  only this project plan and the generated lockfile. The package exceeds the planning
  estimate because the repository size rule counts CI, wiki, skill, package
  configuration, and the complete test portfolio. It remains one work package: those
  files make the public contract independently testable, reviewable, and safe to land;
  splitting them would leave either the protocol or its verification incomplete.

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
- public architecture, asynchronous-worker, testing, and skill updates.

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
- Keep the contract history in this plan and Git; the retired `docs/log/` path must
  remain absent.
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

- [x] Original public branch and source base verified at
  `2bcaddabe3bf3b39e23e71e7cf3eda7179f6291f`.
- [x] Catalyst framework-neutral pipeline PR #11 merged.
- [x] Public codebase and package patterns mapped.
- [x] Planning-stage specialist review completed with no unresolved owner decision.
- [x] Plan approved through the existing LA-P1 topology and the instruction to proceed.
- [x] S0 plan commit complete.
- [x] S1 contract package complete and reviewed. The intermediate review of
  `b8679343b` found explicit-undefined and digest-authority gaps; both are closed in
  `63c2a6265` with 16 focused tests, typecheck, build, and frozen-lock verification.
- [x] S2 documentation and final verification complete. Package test/check/build and
  the root build passed under Node 24 on the original head, and scoped Knip passed.
  The restacked candidate passes the repository pre-commit `check:all`; the host emits
  only the expected Node 22 versus required Node 24 engine warning. Root Knip and the
  retired OKF validator were not rerun during the restack; their original unrelated
  advisory and wiki-conformance backlogs remain historical evidence.
- [x] Final bounded security review completed with no findings at confidence 75 or
  higher.
- [x] The first final maintainability review found that schema descriptions did not
  make the digest authoritative over validator construction. The descriptor now builds
  both the strict schemas and digest tree; focused tests, typecheck, and build pass.
- [x] Substantive size measured at `+850/-3` across 16 files and accepted as one
  coherent contract package rather than separating its verification or documentation.
- [x] Restacked without force-push by merging exact participant-settings head
  `a31d5cd6a760e5c6e34bc5c3fd170a4efffc16d5`; the pinned schemas and digest
  `b9a3f0e14c766c234aead4165e5250f75bf13d02f84f905baedbf6fb4c0d733c` remain
  unchanged from the original LA-P1 head. Final restack review closed mutable-input,
  mutable-canonical-tree, and incomplete rejection-matrix gaps; 18 focused tests now
  pass. The retired `docs/log/` path remains absent.
- [ ] Final gates complete.
- [x] Original branch published as draft PR #5413.
- [ ] Restacked exact head pushed and PR #5413 based on the participant-settings layer.
- [ ] Restacked immutable public commit and digest read back for Catalyst.
