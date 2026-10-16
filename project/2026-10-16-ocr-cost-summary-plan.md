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
findings remain one JSON document. The user subsequently authorized filtered live
progress for manual individual and stack reviews in this same PR. Raw manual
stderr stays private while reconstructed progress uses a separate descriptor.
No engine, model, reasoning,
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
  The manual-progress extension also updates the existing
  `.github/scripts/final-ai-review.test.js` shell integration tests.
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
   structured stdout intact. Manual stderr remains in its private file while
   filtered progress reaches the live log.
3. Main owns delivery after steps 1–2: focused checks, scoped static analysis,
   staged data hygiene, committed-range simplification and integrated final
   review, ordinary push, draft PR, and automatic CI/feedback resolution.

The read-only explore child answered only the pinned engine's streaming
feasibility. The planner reviews this batch; simplifier and final reviewer own
their configured committed-range passes. The manual-progress extension arms a
focused privacy slice review for the new public logging channel. Numerical
accuracy, subprocess behavior, and CI behavior remain final-review lenses.

### Verification portfolio

Extend existing adapter tests for arithmetic, lifetime aggregation, incomplete and
partial usage, genuine zero, private-field exclusion, and non-fatal reporting.
Reuse the existing review-policy and self-update guard suites. Check workflow YAML
bindings, cleanup ordering, `continue-on-error`, and unchanged execution settings
using parsed source. Check syntax, formatting, diff scope, and scoped Opengrep.
No prose assertions, new content snapshots, application runtime, browser, or paid
model tests are needed. CI supplies the repository's broader required checks.

### Authorized manual-progress extension

Keep the current branch and PR. In `run_ocr_attempt`, enable OCR's human audience
for actual reviews and bind descriptor 3 to the live log before redirecting raw
stderr to its existing private file. Previews remain silent. The adapter opts in
through `OCR_ADAPTER_PROGRESS_FD=3`, consumes child stderr without changing stdout,
and reconstructs only known event/tool/phase enums and bounded numeric counts.
Paths, arguments, group/session identities, provider errors, reasoning, unknown
lines, and workflow commands never pass through. Carry at most 4096 characters
of an incomplete line; discard overlong records until the next newline. Wait for
the child's streams to close, flush a bounded final fragment, and preserve its
exit code, signals, cleanup, and all existing review settings. A failed live-log
write is best-effort and never falls back to a private stream or result stdout.

Main owns the adapter, its tests, workflow integration, wiki, and plan. The
executor initially owned `final-ai-review.test.js`, then handed it back without
edits. Main completed the small harness update because delegation overhead
exceeded the work. Existing full, range, resume, and failure cases prove
descriptor routing and unchanged arguments. Test obligations extend suites for
redaction/framing and real subprocess delivery before exit, then check the parsed
workflow retains all reasoning, budget, timeout, concurrency, and validation
settings. No new module or dependency is required.

The planner approved this extension before implementation. Reuse prior package
reviews for unchanged cost/cleanup behavior. Review the committed extension with
the configured simplifier and privacy slice reviewer, then the integrated final
reviewer. Commit and push to PR #6555, update its complete description, and finish
automatic CI and actionable feedback. Merge, readiness, deployment, and paid
manual OCR reruns remain outside this authorization.

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
- Integrated review and automatic CI passed at `547d0ba418`. OCR feedback prompted
  a focused correction filtering invalid token values before diagnostics
  accumulation; the existing partial-usage test also protects OCR-facing usage.
  Optional suggestions to reject missing CLI arguments, change the internal parse
  boundary, or skip unavailable startup summaries were declined: reporting stays
  best-effort, parsing errors are caught by its sole CLI caller, and startup
  failures should still explain unavailable estimates.
- Manual-progress baseline: 176 existing focused tests pass at `579fa00424`.
  Extension planning is approved. Four adapter tests cover filtering/framing,
  live-before-exit delivery, exact raw bytes, and sink failures; the signal test
  now covers live mode. The existing mocked shell boundary tests check descriptor
  routing and arguments; the separate real adapter test proves actual filtering.
  All 180 focused tests pass, with unchanged execution settings verified by
  parsed-workflow comparison. Formatting, syntax, and scoped static analysis pass.
  Extension size: 290 added / 12 removed substantive lines, excluding docs.
  Next commit and run the configured committed-range reviews, then push to the
  existing draft and complete automatic CI/feedback handling.
