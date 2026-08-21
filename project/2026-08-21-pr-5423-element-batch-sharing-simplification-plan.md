# PR #5423 — Element batch sharing readiness and simplification

## Problem

PR #5423 adds element batch sharing across the GraphQL API, Manage UI, tests,
and documentation. The current head is behind `v3`, conflicts with current
documentation and Manage code, and carries avoidable complexity. The prior
production-readiness audit also found authorization, capacity, and contract
gaps that must be closed before the feature can be considered ready.

## Evidence

- PR head: `54d0e395cd2eef692cb5dffdf9d1ace26a8d7e04` on
  `feat/element-batch-sharing`.
- Current base: `origin/v3` at
  `df10f524ecf453fe2f43a3b08797a590f962c191`.
- The PR is open, non-draft, and currently `DIRTY`/`CONFLICTING`.
- The branch changes 28 paths with approximately 4,154 added and 349 deleted
  lines.
- Historical CI failures were GitHub CodeQL download/SARIF service failures
  (503/429 and unavailable SARIF service), not source failures. Sonar reported
  actionable reliability and cognitive-complexity findings.
- The prior readiness report is
  `project/2026-08-20-pr5423-production-readiness.md` in this worktree.
- The planning review requires a raw input cap, current-state authorization
  checks inside each transaction, bounded concurrency-conflict handling, and a
  request deadline. It also identified the existing element-operations
  Playwright spec as the repository-format home for this journey.

## Decision

Retain PR #5423 as one local revision for this task. Use two implementation
layers internally—bounded API correctness, then simplified UI/tests/docs—but do
not create, reorder, or mutate a GitHub stack. The source PR remains untouched;
publishing, pushing, merging, and deployment are outside this plan.

Move the feature-specific superpowers plan and design documents into
`project/plans_wip/`, remove only the feature-specific `docs/log` entry, and
preserve unique decisions and progress in the project plan. Do not remove the
`docs/log` directory or unrelated history.

## Goal and non-goals

### Goal

Make batch sharing safe, bounded, understandable, and locally verifiable while
reducing the implementation footprint. The result must have visible recipient
validation, repository-format Playwright coverage, current documentation, and
no unresolved source-level CI findings within the changed scope.

### Non-goals

- No production or cluster access, migration, deployment, merge, push, or PR
  topology change.
- No new dependency or replacement quality tool.
- No broad security assessment beyond the named mutation and its direct UI/API
  boundary.
- No server-side private-preview policy redesign unless implementation exposes a
  concrete blocker that cannot be handled by the existing contract; record any
  remaining policy concern explicitly.
- No CodeQL workflow modernization based only on the historical GitHub service
  failures.

## Execution contract

| Item | Boundary |
| --- | --- |
| Execution owner | Main session in the existing `trees/pr5423-readiness` worktree |
| Worktree | `trees/pr5423-readiness` |
| Source | PR head `54d0e395…`; the remote source branch is not rewritten |
| Base | Fresh `origin/v3` `df10f524…` |
| Local authority | Approved plan permits local branch setup, edits, checks, and commits |
| Withheld authority | Push, PR update, stack mutation, merge, deployment, and runtime start unless separately named |
| Terminal condition | Local layers committed and verified; final review complete; exact publish action reported but not executed |
| Pause conditions | A required check needs external credentials/runtime, a design choice changes the public contract, or a destructive cleanup target is ambiguous |

## Research and routing

The existing worktree is reused rather than duplicated. The PR is not a native
GitHub stack, so stack commands and topology changes are out of scope. The
repository’s native specialist routes failed before task execution because the
provider could not read encrypted V2 messages; the main session therefore owns
the bounded implementation and will explicitly record any unavailable
simplifier, slice-reviewer, or final-reviewer route rather than claiming that
review occurred. The planner review was completed and its corrections are
incorporated here.

The prior production-readiness audit remains the evidence baseline. Runtime and
browser checks are not claimed until they actually run; no runtime is started
by this plan without the named authority.

## Slices

### S0 — Refresh source and establish the local revision

**Route:** main session.
**Work:** create a local branch from the PR head in the existing worktree, merge
the fresh `origin/v3`, and resolve the three known conflicts without losing
current-base changes. Keep the audit report and account for every changed path.

**Acceptance:** `git status` and `git diff` show only task-owned changes; the
source branch remains unchanged; the merge base and conflict resolutions are
recorded.
**Commit:** `docs(project): add PR 5423 simplification plan` is committed before
implementation; the source-refresh commit follows only if the merge produces a
meaningful task-owned change.

### S1 — Secure and bound the batch-sharing API

**Route:** main session; risk review and simplifier requested after the slice.
**Work:**

- Reject a raw `elementIds` list over 50 before target lookup or other database
  work. Preserve first-seen deduplication and existing partial-result order.
- Accept only `READ`, `WRITE`, and `ADMIN`; reject `OWNER` and `EXECUTE` before
  target resolution and before any permission, derived-permission, or audit
  write.
- Move `isDeleted` and caller `ADMIN`/`OWNER` checks into each per-element
  transaction. Use serializable isolation plus bounded `P2034` retry handling
  (or an equivalent lock strategy) so deletion or permission revocation cannot
  produce a successful result after authorization disappears.
- Add a bounded batch deadline so 50 sequential transactions cannot hold a
  request for an unbounded multiple of the per-element timeout. Preserve
  committed partial outcomes and stable failure reasons.
- Add deterministic integration tests for raw oversize input, invalid levels,
  deletion/revocation interleavings, deadline behavior, and existing success,
  skip, failure, invalidation, and direct-sharing compatibility.
- Update generated GraphQL artifacts only when the schema or operation contract
  actually changes, and update the API wiki/tutorial contract accordingly.

**Acceptance:** focused GraphQL tests, GraphQL package typecheck/build/codegen,
and the API documentation agree on limits, permission levels, transaction
semantics, and result behavior.
**Commit:** `fix(graphql): bound and authorize element batch sharing`.

### S2 — Simplify the Manage implementation

**Route:** main session; simplifier requested after the slice.
**Work:** remove the redundant `selectedElements` prop/state path, extract small
same-file eligibility and execution helpers, reduce modal/result cognitive
complexity without replacement abstractions, defer the user-group query until
sharing is enabled, and render recipient/group validation errors visibly.
Preserve update-before-share ordering, private-preview behavior, result
semantics, i18n, and existing component boundaries unless a smaller equivalent
is clearer.

**Acceptance:** affected Manage package checks and lint pass; the changed code
has fewer branches/duplicate state paths; validation is visible to keyboard and
screen-reader users; no unrelated UI files change.
**Commit:** `refactor(manage): simplify element batch operations`.

### S3 — Align Playwright coverage and project documentation

**Route:** main session; simplifier requested after the slice.
**Work:** fold the new batch-sharing journey into the existing
`MA-elements-operations.spec.ts` workflow, using its fixtures, cleanup hook,
helpers, and relative `.js` imports. Remove the standalone lowercase spec and
the now-unused `chooseActionByTestId` import from `X-review.spec.ts` if no
assertion needs it. Assert that the skipped element still receives the selected
status update. Run the repository Prettier format/check for touched Playwright,
Markdown, and MDX files.

Move the two feature-specific superpowers documents into
`project/plans_wip/`, update references and stale status/path text, preserve
unique decisions, retire the duplicate WIP plan after migration, and delete
only the feature-specific dated `docs/log` entry.

**Acceptance:** Playwright test listing and focused execution use the existing
element-operations format; Prettier check passes; `rg` finds no live reference
to the old feature-specific superpowers/log paths; project plans contain no
personal absolute workspace path.
**Commit:** `docs(project): relocate element batch sharing plans` (with the
Playwright test change included if it remains cohesive; otherwise use
`test(playwright): align element batch sharing coverage`).

### S4 — Integrate and prove local readiness

**Route:** main session; final-reviewer requested after all commits.
**Work:** run repository-native formatting, typecheck, lint, focused GraphQL
tests, generated-artifact checks, Playwright listing and focused browser tests
when an already-authorized runtime is available, and inspect the complete diff
for scope, secrets, and personal data. Reconcile any reviewer findings and
update the project progress section.

**Acceptance:** all available checks pass or carry an exact external blocker;
the final review covers the integrated range; no claim of fresh remote CI is
made while push is withheld.
**Commit:** only correction commits required by review; no merge or push.

## Test portfolio

| Behavior | Evidence |
| --- | --- |
| Raw input and permission contract | GraphQL integration tests before target lookup/writes |
| Concurrent deletion/revocation | Deterministic transaction interleaving tests |
| Deadline and partial outcomes | Focused service tests with bounded fake work |
| Existing sharing behavior | Existing direct/group/invalidation/compatibility tests |
| Manage simplification | Package typecheck, lint, and focused component tests if present |
| User-visible journey | Existing element-operations Playwright flow, including skipped-element status |
| Repository format | Prettier check for touched Playwright/Markdown/MDX and native format check |

## Delegation map

| Work | Owner | Status |
| --- | --- | --- |
| Repository and PR inventory | Main session | Complete; specialist route unavailable |
| Planning challenge | Native planner | Complete; corrections incorporated |
| API implementation and integration | Main session | Complete locally; focused Vitest is blocked by missing `HATCHET_CLIENT_TOKEN` |
| UI simplification | Main session | Complete locally; native specialist executor route unavailable |
| Simplifier and risk review | Native specialists with fallback reviewers | Native specialist routes failed with provider errors; fallback reviews completed and their accepted corrections are being integrated |
| Final package review | Native final reviewer with fallback | Run after the final commit; no completion claim without evidence |

## Progress

- [x] Fresh refs and current PR state recorded.
- [x] Prior production-readiness report retained in the task worktree.
- [x] Planning review completed and raw-cap/deadline/concurrency corrections
  incorporated.
- [x] User approval for local implementation and commits.
- [x] S0 source refresh and conflict resolution (`edc890b61` on current `origin/v3`).
- [x] S1 API correctness and tests (`5b21e8c46`, `84944f64e`); focused Vitest remains blocked by missing `HATCHET_CLIENT_TOKEN`.
- [x] S2 UI simplification (`5e357e6c8`); Manage typecheck passes after building existing workspace dependencies.
- [x] S3 Playwright and project-plan migration; Playwright typecheck and Prettier pass, browser execution remains pending runtime availability.
- [x] Fallback simplifier and risk-review corrections: removed dead recipient-alert state, made recipient updates atomic, passed only update IDs to the execution hook, simplified transaction test doubles, kept the batch-size constant private, and budgeted transaction wait plus timeout within the remaining deadline.
- [x] Final correction pass (`396069bcb`, `bddde399d`, `05edf4324`, `7f42dc5a6`): restored direct invalidation error compatibility, rechecked group target access inside each element transaction, hid target/object enumeration without an eligible element, surfaced the 50-element UI limit, added visible progress and result headers, and aligned the dependent-object documentation with derived permission behavior.
- [x] Available integrated checks: GraphQL typecheck/build/codegen, Manage typecheck/lint, Playwright typecheck/listing, Biome, Prettier, and `git diff --check` pass; focused Vitest collection is blocked by missing `HATCHET_CLIENT_TOKEN`.
- [ ] S4 final package review and readiness handoff; runtime/browser, fresh remote CI, staging, capacity, cancellation, and observability evidence remain outside the approved local boundary.
