# OCR cost summaries and draft progress

## Approval summary

Future OCR jobs should explain estimated provider cost and caching savings using
their existing sanitized diagnostics. Draft reviews should also expose the
pinned action's supported live progress display. The user directly authorized
these improvements while preserving reasoning and budgets. This executable batch
includes focused verification, commits, an ordinary task-branch push, and a draft
PR against `v3`, followed by automatic CI and actionable feedback handling.

The existing adapter will calculate USD estimates from aggregate counters once
per recorded lifetime. It will show the same-token cost without caching and the
absolute and percentage savings. Rates and their verification date come from the
provider's model page. Missing or inconsistent usage makes the estimate
unavailable. Missing whole receipts can omit spend, so summaries explicitly limit
coverage to recorded lifetimes. Reporting failures cannot fail the review.

Live draft progress uses the pinned action's `stream_progress` option. Final
findings remain one JSON document. Manual review stderr remains suppressed because
exposing it requires a separate filtered channel. No engine, model, reasoning,
token budget, timeout, concurrency, or validation setting changes. No paid OCR
reruns, merge, readiness, release, deployment, or reviewer notifications are
authorized here. Live proof of the changed trusted-default workflow follows merge.

## Execution details

- Repository: `uzh-bf/klicker-uzh`; target `v3` at
  `f38700446e361d04ae96af2613c0ac4ecc60253f`.
- Task branch/worktree: `rs/ocr-cost-summary`, `trees/ocr-cost-summary`.
- Execution mode: standard. This began as a micro reporting task and expanded
  beyond that tier through coverage tests and the requested progress display.
- Source scope: existing `.github/scripts/ocr-mistral-adapter.cjs` and its test,
  `.github/workflows/check-ocr-review.yml`,
  `.github/workflows/check-ocr-final-review.yml`, and `docs/ci-and-deployment.md`.
  No new runtime module or dependency is needed.
- Pricing: [Mistral model page](https://docs.mistral.ai/models/zai-glm-5-3), checked
  2026-10-16. Cached input stays within prompt totals and all OCR budgets.
- Draft action input and progress routing were verified against the pinned
  upstream action source. That action already exposes stderr at completion;
  enabling streaming changes when those existing logs appear.

### Ownership, sequence, and acceptance

1. Main owns accurate estimates and safe reporting: arithmetic reconciles across
   lifetimes, nested counters are excluded, incomplete usage is unavailable,
   legitimate zero is retained, and coverage limitations are explicit.
2. Main owns workflow integration after step 1: all three code-review modes write
   summaries after cleanup; summary steps continue on error. Draft progress keeps
   structured stdout intact. Manual stderr handling is preserved.
3. Main owns delivery after steps 1–2: focused checks, scoped static analysis,
   staged data hygiene, committed-range simplification and integrated final
   review, ordinary push, draft PR, and automatic CI/feedback resolution.

The read-only explore child answered only the pinned engine's streaming
feasibility. The planner reviews this batch; simplifier and final reviewer own
their configured committed-range passes. No application risk boundary arms an
additional slice review. Numerical accuracy and CI behavior remain final-review
lenses.

### Verification portfolio

Extend existing adapter tests for arithmetic, lifetime aggregation, incomplete and
partial usage, genuine zero, private-field exclusion, and non-fatal reporting.
Reuse the existing review-policy and self-update guard suites. Check workflow YAML
bindings, cleanup ordering, `continue-on-error`, and unchanged execution settings
using parsed source. Check syntax, formatting, diff scope, and scoped Opengrep.
No prose assertions, new content snapshots, application runtime, browser, or paid
model tests are needed. CI supplies the repository's broader required checks.

### Progress

- Implementation and synthetic checks are complete. The approved plan is committed.
- Planner approved after one focused correction covering recorded-lifetime
  labels, non-blocking steps, and matching verification.
- Verification: 56 adapter, 119 review-policy, and one self-update test pass;
  scoped Opengrep reports zero findings. Parsed workflows preserve every existing
  execution setting and place all three non-blocking summaries after cleanup.
- Substantive size before reviews: 304 added / 2 removed lines, excluding docs.
- Test delta: four added adapter tests; existing tests preserved.
- Implementation committed and pushed; draft PR
  [#6555](https://github.com/uzh-bf/klicker-uzh/pull/6555) targets `v3`.
- Simplifier completed; removed duplicated pricing values from documentation.
  Its report is retained under the ignored `project/_local/reviews/` directory.
- Next: integrated final review and automatic CI/feedback handling. Their latest
  receipts belong in the PR description and local review reports. Do not infer
  live trusted-default workflow acceptance from these source checks.
