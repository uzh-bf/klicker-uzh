# OCR diagnostics clarity

## Approval summary

Make existing OCR runs easier to assess without changing how they review code.
The current adapter sums overlapping request durations, so a long job cannot
prove that one provider request survived five minutes. Its cost summary correctly
withholds a total when an attempt has no usage receipt, but that also hides the
estimated cost and cache savings of responses whose usage is known. Replay
misses are counted without explaining which existing lookup branch failed.

Deliver three improvements through the existing sanitized artifact and summary
paths: record maximum request and completed-response timing; show an explicitly
partial estimate for reported responses while the total remains unavailable;
and classify history lookup misses with fixed, content-free counters. Keep the
existing provider response, review validation, accounting, retries, reasoning,
budgets, deadlines, concurrency, cache keys, and history recovery rules intact.
No additional provider requests are needed to develop or verify these changes.

The main risks are misleading partial costs, timing failures mistaken for
successful long responses, and diagnostic leakage. Acceptance requires focused
synthetic tests at those seams, unchanged existing accounting/replay tests,
bounded allowlisted output, source review, and hosted CI. Older receipts must
remain readable without treating absent new measurements as zero.

The user approved this executable batch: implementation, local commits,
ordinary pushes to this task branch, one draft PR against `v3`, and
CI/actionable-feedback monitoring to completion.
Automatic draft CI is included. Marking ready, merge, manual paid OCR commands,
release, deployment, infrastructure changes, and cleanup remain separate gates.
No material design decisions remain open in this proposed scope.

## Execution details

### Identity, evidence, and boundaries

- Worktree: `trees/ocr-diagnostics-clarity`.
- Branch: `rs/ocr-diagnostics-clarity`; target: `v3`.
- Planning baseline: `0f222786e86c625c7bfbff594a952de770d15ac5`.
- Artifact root: the existing `project/`;
  [draft PR #6579](https://github.com/uzh-bf/klicker-uzh/pull/6579).
- Execution mode: standard; native planner route: GPT-6 Astra, medium.
- Ceremony: full path; approval mode: executable batch.
- Boundary owner: main session. Authority: the approved implementation and draft
  delivery sequence below. Terminal: verified draft delivery with settled CI and
  actionable review feedback.

Source evidence is in `.github/scripts/ocr-mistral-adapter.cjs`:
`createHistoryStore`, `createExecutionCounters`, `handleChat`, `assessCostRows`,
`buildCostReport`, and `commandSummary`. The existing adapter test suite covers
replay identity, compression, rejection, request timing/lifecycle, cost coverage,
stage reconciliation, output parity, and diagnostic privacy. Both OCR workflows
already upload the shared adapter receipt and call its summary command.

Use current source contracts from `docs/ci-and-deployment.md`. Earlier plans
`2026-10-16-ocr-affinity-reporting-plan.md` and
`2026-10-16-ocr-request-timeout-plan.md` are history, not active execution plans.
Private run analysis informs priorities; keep raw logs and run-derived contents
out of committed fixtures, plans, and PR text. Tests use synthetic receipts.

Research is source-based. These changes need no new library, provider API,
pricing lookup, or dependency. Retain the existing pinned pricing table and
verification date. A provider API or pricing change would require fresh official
documentation before changing that scope.

No application product primitive, database model, authorization, or external
data destination changes. No ADR is needed for additive internal diagnostics.
A new data destination, replay rule, billing/accounting rule, or public
application contract reopens planning. Update the existing OCR sections of
`docs/ci-and-deployment.md`; existing task skills remain accurate.

### Binding behavior

**Timing.** Preserve `request_duration_ms` as an overlapping sum. Add bounded
monotonic maxima for forwarded requests and for completed, accepted provider
responses, plus a count of those completed responses exceeding 300,000 ms.
The completed-response measurement spans dispatch through bounded response
reading and the existing acceptance checks. A timeout, disconnect, malformed
response, or rejected completion never establishes a successful long response.
Keep its accepted-response count separate from the existing usage-response
counter. An interrupted continuation accepted by current rules remains accepted.
Record each terminal request once, including concurrent and cancellation paths.
Expose the measurements through the existing aggregate, request-kind, and
bounded opaque-conversation counters and a fixed summary record. Labels must
distinguish request time, summed time, and job wall time. Incomplete shutdown
receipts cannot prove complete timing coverage.

**Reported-response cost.** Preserve the existing complete `estimate`, reason
codes, stage reconciliation, token counters, provider-facing `billableUsage`,
budget arithmetic, and retry/resume decisions. Add a separate estimate only when
the existing strict total is unavailable solely for `unaccounted_attempts` and
all expected receipts are present. Every included row must have valid safe
counters, complete response usage/cache coverage, consistent token identities,
no unfinished requests, and attempts greater than or equal to responses.
Use the existing pricing formula on aggregate reported-response counters once;
never add nested request-kind or conversation counters again.
Include rejected responses whose valid usage was already recorded; acceptance
timing and provider cost measure different events.

Label the new figures as estimated cost and caching savings **for reported
responses only**, with reported-response and unpriced-attempt counts. Keep
`OCR cost status=unavailable` and its existing reasons for the full invocation
total. Add a distinct allowlisted summary record for the partial estimate.
Do not price missing attempts, call them free, estimate their tokens, or label
the subtotal as a complete bill or guaranteed lower bound. Other invalidity,
receipt mismatch, unsupported schema, overflow, or missing cache data suppresses
the combined subtotal; existing independently complete stage estimates remain.
When the total is complete, retain the existing complete presentation without a
duplicate partial table.

**History misses.** Preserve exact-prefix restoration, exact reasoned-turn
fallback, ambiguity rejection, memory bounds, HTTP responses, and error codes.
An exact-prefix hit remains preferred even when a fallback would be ambiguous.
Add three fixed miss-reason counters at the existing rejection branches:
no usable reasoning for the fallback lookup, no matching reasoned turn, and
ambiguous reasoned turn. Every increment of the existing `history.misses` has
exactly one reason; preserve the original total's meaning. Report only counters,
with no message-derived identifiers, excerpts, hashes, tool arguments, cache
keys, paths, or reasoning. A missing reason diagnoses a lookup condition; it
does not prove which caller transformation caused it. Print the bounded
history breakdown in the existing summary and retain it in the artifact.

**Compatibility and privacy.** New diagnostic fields are additive. Existing
receipts without them retain their current cost interpretation; report new
timing/history detail as unavailable rather than inventing zero measurements.
Missing or invalid new diagnostics must not change cost eligibility, provider
responses, cleanup, child exit status, coverage validation, or publication.
Summary output remains identical in the job log and GitHub job summary.
Preserve current artifact retention and the filtered live progress interface.

### Delegation Map and sequence

One cohesive diagnostics package on one branch. Intended files are this plan,
the existing adapter, its existing test suite, and `docs/ci-and-deployment.md`.
No workflow edit, new module, dependency, schema migration, or runtime is needed.
Reassess the package if implementation requires another production file.

| Workstream and slice | Execution owner | Dependency and acceptance |
| --- | --- | --- |
| Request timing and history explanations, slice 1 | Main after bounded executor failed convergence | First; timing and replay tests preserve provider behavior and explain counters |
| Reported-response estimate and summary, slice 2 | Main owns the coupled adapter and accounting boundary | Serialized; complete totals and budget arithmetic remain unchanged |
| Integration, review, documentation, and delivery, slice 3 | Main | Focused checks, exact diff/privacy review, draft PR and settled CI/feedback |

1. **Explain timing and replay misses.** Route: main after executor convergence
   failure; no replacement attempt. Extend only the adapter
   and its test suite. Consume portfolio rows 1, 2, and 4. Main verifies that
   all existing HTTP/replay outcomes and timing deadlines are unchanged. Commit:
   `enhance(ci): explain OCR request timing and replay misses`.
2. **Retain useful reported-response estimates.** Route: main, serialized
   after slice 1 because the files overlap. Consume portfolio rows 3 and 4.
   Execution-tier skip reason: critical-path coupling after the failed executor;
   another dispatch has more overhead than this remaining bounded change.
   Main checks exact preservation of the complete-cost and budget contracts.
   Update the existing documentation for the final combined behavior. Commit:
   `enhance(ci): report OCR costs for known responses`.
3. **Review and deliver the package.** Route: main; external effects and final
   proof remain with the execution owner. Simplify, review the committed scope,
   run focused checks, push, create one draft PR against `v3`, and settle hosted
   CI and actionable review feedback. Compare target drift near readiness only
   when it materially affects mergeability, required freshness, or this scope.

After executable-batch approval, commit this plan first as
`docs(project): add OCR diagnostics clarity plan`. No planning-only PR is proposed.

### Feature-wide test portfolio and verification

| Consequential behavior | Existing protection | Test obligation and primary seam | Distinct failure; owning slice |
| --- | --- | --- | --- |
| Long completed requests are distinguishable from failures and concurrent sums | Transport, cancellation, drain, and request-counter tests | Extend existing adapter tests with controlled monotonic timing; no real five-minute wait | Failure counted as success, boundary error at 300,000 ms, or double settlement; slice 1 |
| Miss reasons explain existing rejection without weakening replay | Prefix, compression, missing-reasoning, collision, and bound tests | Extend existing history tests and one loopback rejection test | Reason totals diverge or a formerly rejected replay reaches upstream; slice 1 |
| Partial reporting preserves complete-cost and budget truth | Cost refusal, stages/resumes, billable usage, and output-parity tests | Extend cost/report CLI tests with synthetic complete, throttled, malformed, mismatched, and partial-cache receipts | Missing spend looks complete, valid counters double-count, or OCR budgets change; slice 2 |
| Diagnostics stay additive, bounded, and non-blocking | Privacy sentinels, conversation cap, sink-failure, lifecycle, and old-receipt tests | Extend the relevant existing cases; assert structured fields rather than prose | Private content leaks, old fields become zero, or a broken sink changes execution; both |

Keep existing consequential tests. Add no tests that pin explanatory wording.
Use existing synthetic providers and test harnesses; a controlled monotonic
clock may be a test seam, not a new runtime setting. Check below, exactly at,
and above the long-response threshold without wall-clock delays.

Run pinned Node 24.21.0 with `node --test` for:

- `.github/scripts/ocr-mistral-adapter.test.cjs`
- `.github/scripts/final-ai-review.test.js`
- `.github/scripts/final-ai-stack-review.test.js`
- `.github/scripts/ocr-self-update-guard.test.cjs`
- `.github/open-code-review/qualification/final-review-qualification.test.js`

Use installed repository format/lint tools for touched files, syntax checks,
and staged secret/data inspection. Report baseline tool limitations separately.
No install, application runtime, browser pass, database, or paid provider test is
required for this nonvisual adapter/reporting change. If a check actually needs
container dependencies, use the repository runtime policy rather than a host
install; that requirement would be explicit evidence, not a default escalation.

Full-path simplification and the configured final review cover correctness,
maintainability, diagnostic privacy, and plan compliance. A bounded slice review
covers numeric-reporting validity and privacy. Existing offline TLS proof is
reusable if transport remains untouched. A future ordinary run can demonstrate
nonzero long-response counters and partial/complete cost labels after merge;
that live command requires separate authority and is not a draft-delivery gate.

### Terminal, pause conditions, and rollback

Implementation terminal: complete source package, one draft PR into
`v3`, passing applicable hosted CI, and dispositioned actionable feedback.
Rollback is an ordinary source revert after the applicable source/merge gates.

Pause for a material accounting/replay-policy change, new data exposure or
destination, required extra provider spend, an unavailable mandatory review or
verification capability, or an unresolved behavior decision. Routine test
failures, review corrections, or source integration within this scope continue
under the approved batch. No change to reasoning, budgets, accounting, or
retry behavior is authorized by the diagnostics proposal.

## Planning review and progress

- Status: slices 1 and 2 implemented; active slice 3, reviews and draft delivery.
- Planner: native `planner`, GPT-6 Astra medium; approved in round 1 with no
  blocking findings. The local review transcript records the source checks.
- Accepted clarifications: distinguish accepted-response timing from usage;
  include rejected responses with valid usage in cost; preserve prefix priority;
  make slice ownership explicit. These clarify the reviewed scope without
  changing its behavior, authority, or test portfolio.
- Slice 1: committed at `a3c8c730d1`; 81 adapter tests pass on pinned Node 24.
  Astra simplification found no justified reduction. Independent risk review
  verified implementation/privacy and requested one usage-incomplete timing test;
  the existing test is extended with that assertion-only case.
- Ownership: the executor produced no patch after one narrowing instruction and
  was stopped. Main owns remaining coupled source work; no replacement worker.
- Slice 2: committed at `45ed0c0e55`; full five-suite verification passes all
  232 tests. Formatter, syntax, and focused Opengrep pass; lint retains the
  baseline warnings without errors. Slice simplification and independent risk
  review found no further issues. All slice gates are settled.
- Proposed package: adapter, adapter tests, existing OCR documentation, and plan.
  Source and tests extend one adapter/reporting capability on one branch.
  The substantive diff is 475 changed lines excluding this plan; one independently
  functional, reviewable, tested, and reversible diagnostics package.
- Runtime and CI: no application runtime or provider test started. Draft CI and
  integrated review are pending. The branch is pushed and
  [PR #6579](https://github.com/uzh-bf/klicker-uzh/pull/6579) remains draft.
- Next action: integrated review plus hosted CI/actionable feedback. A native goal tracks the
  approved terminal condition; no explicit token budget was requested.
