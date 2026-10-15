# OCR completion integrity and useful review diagnostics

## Approval summary

The user approved rejecting truncated completion claims, retaining useful safe
usage diagnostics, and providing draft reviews with bounded PR-description
context. Deliver these changes in a new draft PR against `v3`, with commits and
an ordinary task-branch push. Keep OCR 1.13.0, the fixed provider/model, existing
reasoning settings, all prompt/output/aggregate budgets, concurrency, coverage,
filtering, resume and publication gates unchanged. No engine patch or manual
paid review is included. Opening the requested draft triggers its existing
automatic review.

Reject a main review response that ends at the output limit while claiming
completion through `task_done`. Account for the response's usage and refusal,
but do not retain it as replayable history. Retain bounded aggregate counters by
request type and opaque conversation ID, and persist them for both manual and
draft adapter lifecycles. Never retain raw routing keys, paths, source, prompts,
arguments, reasoning or provider errors in diagnostics. Draft context uses the
existing untrusted-metadata sanitizer and description limit.

Authority: executable batch, already approved. Terminal: verified source,
reviewed commits, ordinary push and a new draft PR against `v3`. Merge, marking
ready, releases, infrastructure changes, new manual paid runs and notifications
remain separately gated. More visible truncation failures are intentional;
neither diagnostics nor a green job prove complete review coverage or savings.

## Execution details

Repository `uzh-bf/klicker-uzh`; worktree `trees/ocr-review-diagnostics`; branch
`rs/ocr-review-diagnostics`; target `v3`, baseline
`8757713aaf8d93b4c67a64909a2074e965202f33`. Existing artifacts root: `project/`.
This extends the merged cache configuration without reusing its branch or plan.
Execution mode: standard; runtime model identity is not independently available.

### Contracts and sequence

1. **Main: completion guard and bounded diagnostics.** Extend
   `.github/scripts/ocr-mistral-adapter.cjs` and its existing tests. Refuse only
   `finish_reason: length` paired with `task_done` in a main review request,
   using a non-retryable HTTP 422 refusal.
   Preserve response usage before refusal, and exclude the rejected response
   from native-history replay. Existing main responses without tools retain
   their refusal contract. Other response types are unchanged.

   Preserve existing top-level counters. Add main/auxiliary usage buckets and
   at most 256 per-conversation buckets, identified by a process-local keyed
   digest of the validated cache key and request type. The digest key stays in
   memory; IDs cannot be correlated across adapter lifetimes. Count unattributed
   requests and requests beyond the bucket cap explicitly. Record only bounded
   numeric usage, cache-report availability, output-limit/refusal, byte and
   accumulated monotonic request-duration counters. Missing cache data remains
   distinct from reported zero; cached input is never subtracted from budgets.

   Reuse one diagnostics writer for the `run` and `serve` paths through the
   adapter's single close path. During shutdown refuse new work, abort active
   requests and settle their accounting before writing. Keep the listener bound
   until the single write attempt finishes, then close it so the existing
   `stop` receipt cannot race the upload. Bound draining to one second; a drain
   timeout explicitly records unfinished requests, rather than claiming complete
   accounting. The existing five-second stop bound remains. Normal shutdown,
   repeated shutdown, termination and lifetime closure use the same path.
   Write failures emit only the existing safe warning, preserve exit semantics
   and still allow cleanup. Commit this slice separately.
2. **Executor: useful draft context and artifact wiring.** Own
   `.github/workflows/check-ocr-review.yml` and
   `.github/scripts/final-ai-review.test.js`. Pass the event body through a
   scoped environment variable to `buildReviewBackground`, preserving the
   existing multiline output writer. Reuse its 8,000-code-point bound, absent-body
   fallback, sanitization and untrusted boundary. Do not fetch links or add
   trusted instructions from PR content.

   Configure the existing diagnostics-path variable for the draft job, and
   upload only that fixed safe JSONL file after cleanup, with one-day retention
   and the repository's pinned upload action. No raw result, stderr, capability
   state or wildcard artifact paths. Extend executed workflow/context tests and
   focused artifact-wiring checks. The executor does not commit or push. Main
   verifies and commits the integrated slice, then updates the existing
   `docs/ci-and-deployment.md` for the diagnostics contract and context behavior.

Delegation: main owns adapter, lifecycle, integration, documentation, Git and
external actions; executor owns only the two draft-wiring paths. Planner is
read-only. No new tracked implementation modules, dependencies or test suites.
No application runtime, browser or database is needed. No product primitive or
ADR changes: this preserves the existing review/provider architecture.

### Verification and gates

| Consequential obligation | Existing protection | Test change |
| --- | --- | --- |
| Truncated `task_done` cannot finish a review or enter replay history | Adapter loopback/history tests | Extend existing synthetic provider tests, including valid completion control and preserved usage |
| Diagnostic attribution reconciles and remains bounded and content-free | Aggregate usage/cache/redaction tests | Extend existing tests for main/auxiliary, stable and separated opaque IDs, cap/unattributed counters, and cache availability |
| Detached and manual lifecycles persist once and clean up | CLI run/start/serve/stop and signal tests | Extend existing tests for safe JSONL output, shutdown and termination, warning-only write failures |
| Draft requirements and artifacts preserve the existing data boundary | Executed context step and workflow contract tests | Extend existing round-trip tests for body sanitization/bounds, missing-body fallback and exact artifact path/retention |

Run the five existing OCR Node suites. Reuse the prior binary qualification for
unchanged engine/concurrency/budgets; synthetic provider fixtures cover the new
adapter refusal and telemetry. Use installed formatting, syntax, Gitleaks, diff
checks and focused Opengrep; distinguish inherited errors and partial parsing.
Normal hooks retain their dependency guards. Do not start an application just
to run repository-wide checks. Inspect staged data before each commit.

Required standard-mode gates: one planner check before implementation;
simplification and risk review for substantive committed slices, and one final
review of the complete committed package after focused verification. Use the
existing role/continuity policy, reuse valid reports, and preserve privacy.
Pause only for a material scope/privacy/cost change or a genuine unavailable
required capability; continue independent authorized work. The user has already
approved execution and delivery, so no second generic approval is needed.

## Progress

- Approved scope: items 1, 2 and 3; reasoning and budgets fixed.
- Completed: live target and branch resolution; isolated worktree created.
- Baseline: all 184 existing tests pass. Planner approved after accepting the
  shutdown/write-order finding and defining the bounded drain receipt.
- Slice 1: adapter guard, bounded opaque attribution and ordered diagnostics
  persistence implemented. All 52 adapter tests pass, including incomplete-drain,
  signal, lifetime, single-write, redaction and attribution cases.
- Slice 2: delegated draft wiring implemented; one simplification correction is
  active with the same executor. Main owns integration and all external actions.
- Next: commit and review slice 1; integrate and verify the draft slice.
- Delivery target: new draft PR; none exists yet.
