---
name: klicker-test-hygiene
description: Audit KlickerUZH test value, reliability, layering, and maintenance cost before a test cleanup. Use for periodic hygiene reviews, oversized or flaky suites, duplicate or implementation-coupled assertions, and proposals to move, merge, or retire tests. Produce an evidence-backed plan before changing tests; use klicker-testing-verification and klicker-playwright-e2e for execution.
---

# KlickerUZH Test Hygiene

Protect meaningful behavior, not test counts. A passing retry, unchanged coverage,
or shorter file is not evidence that a cleanup preserves regression detection.
This skill owns audit decisions; existing testing skills own runtime setup and
verification. Read [testing facts](../../../docs/testing.md) and the
[hygiene contract](../../../docs/test-hygiene.md) first. The
[initial audit](../../../project/2026-10-14-test-hygiene-review.md) is a dated
baseline, not a live backlog.

## 1. Bound the review and gather evidence

- Choose one feature/risk slice and record its base/head SHA, intended behavior,
  incident or ClickUp references, touched packages, and accountable reviewer.
- Inspect source, tests, configs, package scripts, CI selectors, and relevant Git
  history. Do not infer coverage from filenames, `test:run`, or a green status.
- Run `node util/test-hygiene-inventory.mjs --json` from the checkout. This only
  reads tracked files; it does not start services, discover runner cases, or
  execute tests. Review its warnings and `unreadable` list. New files appear
  after staging. Pattern hits include fixture strings and justified contracts.
- For runtime evidence use actual test discovery through the approved launcher,
  exact-head CI jobs/receipts, first-attempt results, retries, traces and reports.
  The launcher can start/reconcile services even for `--list`; it is not the
  read-only inventory. Respect the disposable-database and host-only boundaries.
- Separate observed facts from hypotheses. If logs or runtime are unavailable,
  say so and propose the smallest proof needed; do not manufacture a flake rate.

## 2. Map risks to the cheapest adequate layer

For each outcome, list the current tests and what would go wrong without them:

- Pure logic: scoring, normalization, parsing, validation, state transitions,
  bounds, error cases, and time calculations. Prefer input/output table cases.
- Service/GraphQL/HTTP contracts: identity, roles/ownership, tenant isolation,
  persistence, idempotency, concurrency, failure responses, and side-effect
  absence. Use real PostgreSQL where query semantics or transactions are the
  risk; a mocked `where` object does not prove row isolation.
- Browser: lecturer creates/publishes, participant joins/answers, results persist;
  cross-app cookies/redirects; keyboard/focus, loading/error recovery, navigation,
  responsive reachability, streaming/cancel/reload. Keep these observable outcomes.
- Rendering/structural tests: justify a specific contract such as valid Markdown
  DOM or safe links. They cannot prove hydration, focus, layout, or interaction.
  Do not add a new component-test framework merely to satisfy a pyramid.
- Provider/model evaluations: deterministic fixtures prove transport contracts;
  live model quality and deployed provider compatibility are separate evidence.

Mocks are useful at external boundaries and for controlled error/stream states.
Do not mock the behavior under test, or treat mocked persistence as authorization
proof. Internal call assertions can be justified for non-execution, ordering,
exact external requests, or cost/security boundaries; explain the contract.

## 3. Review each test with this rubric

Record a concise row: `risk / test path and title / assertion / dependency or
mock boundary / evidence / decision / replacement proof / owner / next review`.

1. **Purpose:** Which user, business, security, or operational failure does it catch?
2. **Oracle:** Is the expected result independent of implementation and explicit?
   Would a realistic wrong result, missing side effect, or forbidden access fail?
3. **Layer:** Does a browser add needed confidence, or repeat a logic matrix better
   covered below? Keep at least the integration journey when moving edge cases.
4. **Resilience:** Could harmless refactoring break it? Prefer role/name/label or
   the repo's deliberate `data-cy` contract. Scope to a row/entity rather than
   unexplained `.nth()`, CSS ancestry, or class strings. Ordinal semantics,
   valid DOM, focus, and a known remount regression can justify structural checks.
5. **Determinism:** Is state isolated and cleanup guarded? Await observable state,
   relevant responses and web-first assertions rather than sleeps/network idle.
   A real time-based requirement needs a controlled clock or explicit rationale.
6. **Diagnosis/cost:** Can its failure identify the broken contract? Use first-run
   evidence before changing waits. Review serial setup and long workflow coupling
   before splitting; file size alone is not a defect.

Choose **keep**, **strengthen**, **move lower**, **merge**, **retire**, or
**investigate**. A pattern hit alone only supports investigate. Keep hypotheses
out of the confirmed findings list.

## 4. Diagnose flakiness before changing expectations

- Preserve the first failure, trace/report, exact revision, browser/runtime,
  selected profile, shard, attempt, data setup and error. Successful retry is
  still a flake; cancellation or a server that never booted is not a test flake.
- Classify product race, test synchronization, state leakage, fixture ambiguity,
  or infrastructure. Use a targeted counterexample to distinguish hypotheses.
  See the corrected diagnosis in `project/plans/PLAN-playwright-flakiness.md`.
- Reproduce in an isolated runtime, then repeat the focused case with retries
  disabled. Choose and record repeats from observed frequency/cost, not a universal
  count. Test intended concurrency only with independent complete runtimes;
  current shared-data specs must not gain browser workers casually.
- Fix the cause and run the affected slice plus integration journey. Do not
  increase retries/timeouts, force clicks, weaken expectations, or add `fixme` to
  obtain green. An intermittent product bug remains a product bug.
- Quarantine needs explicit approval, a ClickUp task, owner, review/expiry date,
  stated residual risk, and a continuing execution/repair path. Never silently
  withdraw authorization, data-integrity, or other critical coverage.

## 5. Require proof before removal or rewriting

Before retiring/merging an assertion or moving coverage to another layer:

- Name the original failure and check incident/commit history.
- Map each distinct contract to a replacement path/title, or cite the approved
  product decision that makes it obsolete. Shared setup is not duplication proof.
- For material replacement or reduced coverage, show the replacement fails for
  the relevant defect (reverted historical fix, bounded local fault injection,
  mutation, or explicit negative control) and passes when restored. For exact
  duplicate removal, identical retained inputs/assertions/execution paths plus
  existing red/green evidence may suffice; do not invent fresh fault injection
  for each incidental assertion. Keep diagnostic mutations out of the final diff.
- Preserve security negatives with valid positive controls, permission matrices,
  accessibility/focus and consequential loading/error/navigation behavior.
- Obtain reviewer approval for the equivalence/retirement decision. Passing
  current tests or unchanged line coverage alone is insufficient.

Do one behavior-preserving slice per PR. The default audit deliverable is a plan;
only execute cleanup that the task authorizes. Never mass-delete, rename, or
merge suites based on counts, grep scores, or an agent's aesthetic preference.

## 6. Validate and hand off

Use `klicker-testing-verification` and `klicker-playwright-e2e`. Report commands,
SHA, passes, failures, skips, and never-run stages separately. Verify exact-head
CI and the selected execution plan; reused/skipped checks are not fresh browser
proof. Preserve manifests/profile assignments, database guards, CI gates and
reports. Include before/after risk mapping and defect-detection evidence for any
cleanup. Update the relevant guide/skill only when the contract changes.

Use [the review template](../../../docs/test-hygiene.md#review-record) and the
proposed cadence there. Follow the repository's ClickUp workflow; this skill
never schedules an automation or assigns a teammate without authorization.
