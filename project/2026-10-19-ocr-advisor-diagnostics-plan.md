# Explain OCR advisor outcomes

## Approval summary

The approved package makes failed draft-review consultations diagnosable,
supports valid Next.js bracket paths, and advertises the existing request
bounds during tool discovery. A failed consultation currently consumes its
shared allowance without retaining a sanitized cause. Legitimate route files
containing brackets are rejected before dispatch.

Extend the existing broker receipt with local dispatch counts and at most two
attempt outcomes. Print those fields in job logs and summaries. Keep only fixed
stages and reasons, never request identifiers, source, questions or raw errors.
Permit bracket characters while preserving existing path and blob validation.
Describe the complete request, file and range limits in runner-owned metadata;
the portable reviewer skill remains generic.

Models, max reasoning, input/output limits, deadlines, shared quotas, usage and
cost accounting, retries, draft publication and final-review authority remain
unchanged. Diagnostic deadline labels preserve the existing cancellation error
and counter behavior. Dispatch means a local broker request, not proof of a
provider request. Compact questions cannot guarantee avoidance of output limits.

Approval authorizes implementation, offline verification, configured reviews,
ordinary task-branch commits and push, and one draft PR against `v3`. Completion
requires passing focused checks, resolved review findings and a reviewable draft.
Ready transitions, merge, secret/settings changes, deployment and paid OCR replays
are outside this package. Automatic CI may run when the draft is published.

## Execution details

Approval mode: executable batch; user approved the reviewed three-change proposal.
Execution mode: standard; exact main-model identity is unavailable. Full path
because the existing path-validation and public diagnostic contracts change.
One cohesive package, one implementation slice, no dependency or new code module.
The existing `project/` artifacts root is authoritative.

Baseline: `2feb421788a2b6e1acca91f343563edcd12aa3fe` on `v3`.
Worktree: `trees/ocr-context7`; branch: `rs/ocr-advisor-diagnostics`.
The older canary branch remains separate and is excluded from this PR.

### Contracts and ownership

- Additive `ocr-review-tools/v1` fields: `dispatched` and bounded
  `attempt_outcomes`, with runner-generated attempt ordinal, stage, outcome,
  reason and dispatch flag. Reserve ordinals at the existing attempt increment;
  concurrent completion must not reorder attribution. Return defensive snapshots.
- Use fixed failure codes and stages for unavailable capability, question/source
  validation, request size, dispatch/transport, response parsing, length finish,
  invalid advice/evidence and cancellation/deadline. Preserve existing safe client
  errors and all legacy counters. Old/missing diagnostic details remain unknown.
- Each existing consumed attempt can dispatch at most once. Quota rejection and
  duplicate active RPC identifiers retain their current behavior. Diagnostics
  cannot change tool outcomes, publication, cost calculations or cleanup.
- Allow `[` and `]` only through the existing relative-path validator. Retain
  traversal, secret-file, symlink, immutable revision, byte and line bounds.
- Runner metadata explains two shared attempts, 16 KiB complete serialized body
  including overhead, 256 KiB source files, and 120 lines/8 KiB per range.

Delegation map: the executor owns broker changes and broker regression tests.
Main owns the runner/log integration, its tests, CI guide, plan, Git delivery and
verification. Writers have disjoint paths and share the agreed receipt fields.

### Test portfolio

| Risk | Obligation and primary seam | Observable acceptance |
| --- | --- | --- |
| Failed attempts conceal dispatch or cause | Extend broker failure/concurrency tests | Two consumed failures, one dispatch, distinct fixed reasons, no retry or content leakage |
| Successful or cancelled calls corrupt diagnostics | Extend existing broker tests | Bounded snapshots, stable ordinals, success/cancellation labels, unchanged counters and response validation |
| Valid bracket paths are inaccessible | Add synthetic immutable Git fixture case | Route source succeeds; traversal, secret paths, symlinks and absent blobs remain rejected |
| Individually valid ranges overflow the whole request | Add broker boundary case | One consumed attempt, zero dispatch, existing safe error |
| Logs disagree with receipts or imply missing details are zero | Extend runner integration tests | Logs/summary match retained receipt; missing fields read as unknown; cost tests unchanged |

### Slice: diagnose bounded consultations

Route: executor for `.github/scripts/ocr-review-tools.cjs` and its existing test;
main for `.github/scripts/ocr-draft-review.cjs`, its existing test and
`docs/ci-and-deployment.md`. Main retains trust-boundary decisions and integration.

Acceptance: dependency-free `node --test` broker, runner and adapter suites;
relevant policy/helper suites; `node --check`, native formatting where available,
`git diff --check`, staged secret and data inspection. Workflow-only changes do
not require an application runtime or screenshots. Preserve the repository hook
behavior and report checks delegated to required CI when host dependencies are
absent. No new installs or application services are needed.

Commit the integrated slice, then run simplification and scoped risk review on
the immutable range. Correct accepted findings and run configured integrated
final review before claiming completed delivery. Publish one draft with accurate
verification and remaining hosted-CI limitations; do not request human reviewers.

## Progress

- Approval: granted for the three-change package and standing draft delivery.
- Planning: planner Epicurus approved the frozen implementation contract.
- Baseline verification: 14 passed, zero failed; optional pinned-CLI test skipped.
- Implementation: integrated broker/runner/guide changes complete. Executor Aquinas
  owns the accepted broker patch; main owns runner integration and delivery.
- Verification: 19 broker/runner tests and 224 adapter/policy tests passed;
  optional pinned-CLI case skipped because OCR 1.13.0 is unavailable locally.
  Biome has zero errors and existing warnings; Prettier, syntax and diff checks
  pass. Scoped Opengrep: 200 rules, zero findings.
- Test delta: five broker cases added, existing concurrency/failure/cancellation
  and runner receipt tests extended; no tests removed.
- Reviews: simplifier and scoped risk review completed without findings;
  integrated final review passed on implementation commit `d55de89cd0`.
- Delivery: committed and pushed; [draft PR #6617](https://github.com/uzh-bf/klicker-uzh/pull/6617)
  targets `v3`. Hosted CI remains pending. Trusted-policy live qualification
  remains a separate post-merge step; no live replay was triggered.
- Packaging: one coherent PR; six total changed paths. Substantive size: 555 lines added and
  25 removed, excluding documentation and plan artifacts. Immutable review range
  and reports are recorded in private review evidence.
