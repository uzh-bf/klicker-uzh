# Final review billable token budget

## Approval summary

The manual `/final-review` of a large pull request stops before it covers every
selected file. The last individual run spent its whole 6,000,000-token budget
after 17 of 48 files. About 96% of those tokens were prompt input, and about 91%
of all prompt input was a provider cache read. Cache reads cost a tenth of
uncached input, yet OCR 1.13.0 counts them at full weight against
`--max-tokens-budget`. Output tokens, including max reasoning, were about 4%.

The maintainer chose four changes:

1. The Mistral adapter reports billable usage to OCR: uncached prompt tokens plus
   completion tokens. OCR's budget gate, summary and resume accounting then work
   on billable tokens. The adapter's own diagnostics keep the raw provider
   totals, including cached reads.
2. The individual review ceiling rises from 6,000,000 to 10,000,000 billable
   tokens. The stack ceilings stay as they are.
3. The review rules explicitly exclude tests and documentation. OCR's default
   filters already drop most test and Markdown files; the explicit list also
   covers test support code such as `playwright/**` and test directories.
4. The individual review receives the pull request's plan documents
   (`project/**/*-plan.md` changed in the range) as bounded, untrusted
   background context. The plan is context for the reviewer, not a reviewed
   change.

Max reasoning, the model, concurrency, prompt limits, timeouts, incremental
eligibility and full-coverage requirements stay unchanged. The maintainer's
instruction supersedes the earlier handoff restriction against raising the
budget. No OCR engine source is patched.

Risk: with cheaper accounting, wall time becomes the next limit. The failed run
used about 15 minutes of model time for 17 files at concurrency two; full
coverage of 48 files needs roughly 45 minutes against the existing 46-minute
attempt window. This package records that risk and does not change timeouts.

Option 2 (review only changes since the last successful review) needs no new
machinery. The workflow already attests a later head incrementally when every
change is a declared repair of a recorded finding, and otherwise requires a
complete review. OCR's per-file resume across heads would skip a file whose own
diff is unchanged while a dependency changed, so it is not adopted.

Done when the adapter and final-review TAP suites pass with tests for the
billable usage report and the plan context. A post-merge `/final-review` on a
large pull request is the live acceptance, because `pull_request_target` runs
the default-branch workflow.

Approval covers local commits, pushes to `ci/final-review-billable-budget` and a
draft PR into `v3`. Merge and the post-merge live run remain with the
maintainer.

## Execution details

### Evidence

- OCR `internal/llmloop/loop.go`: `TotalTokensUsed` is input plus output, both
  accumulated from reported usage. Compression decisions use local token
  estimates (`CountMessagesTokens`), so reported usage affects only accounting
  and telemetry.
- OCR reads cache reads from `usage.prompt_tokens_details.cached_tokens`.
- `final-ai-review.js` requires `total_tokens == input_tokens + output_tokens`,
  which the billable report keeps.
- `final-review-rules.json` is the custom OCR rule layer; its `exclude`
  patterns produce `user_exclude`, which the preview validation accepts.

### Changes

| Area | Change | Check |
| --- | --- | --- |
| `.github/scripts/ocr-mistral-adapter.cjs` | OCR-facing usage subtracts valid cached reads and drops cache details; missing or invalid cache reports keep full prompt counts | adapter TAP test |
| `.github/workflows/check-ocr-final-review.yml` | individual ceiling 10,000,000; plan context appended to the OCR background | workflow lint by existing CI |
| `.github/scripts/final-ai-review.js` | `plan-context` command builds bounded plan context from Git | final-review TAP test |
| `.github/open-code-review/final-review-rules.json` | explicit test and documentation excludes | existing preview validation |
| `docs/ci-and-deployment.md` | billable accounting, new ceiling, excludes, plan context | review |

### Test portfolio

- Billable usage report: add new; a regression would silently restore full-cost
  budgeting or corrupt OCR counters.
- Plan context selection and bounds: add new; a regression could send unbounded
  or wrong content to the provider.
- Excludes and ceiling: none; configuration covered by existing validation.

### Working context

- Execution mode: solo. Branch `ci/final-review-billable-budget` from `v3`
  `f38700446e`.
- Draft PR #6555 edits the same adapter counters; expect a merge conflict there.

## Progress

- [ ] Plan committed
- [ ] Adapter billable usage and test
- [ ] Ceiling, excludes, plan context and test
- [ ] Docs
- [ ] Final self-review and draft PR
