# Diagnose rejected OCR advisor answers

## Approval summary

The approved investigation found that retained advisor receipts cannot identify
which validation check rejected an answer. Envelope, tool and answer-field
failures share `invalid_advice`; provider answers are intentionally discarded.
Changing the parser or prompt without more evidence would be speculative.

Refine the existing diagnostic reasons, carry them through the existing job
logs and summaries, and extend synthetic tests. Keep the client error
`invalid_advice`, the accepted advice contract and all existing limits. Classify
a null tool call safely rather than losing its cause to a JavaScript exception.
Diagnostics contain fixed codes only, with no provider content or raw errors.

Models, reasoning, prompts, schemas, budgets, accounting, deadlines, shared
quotas, retries, publication and final-review authority remain unchanged. This
package makes the next natural advisor failure actionable; it cannot recover
discarded answers or claim to fix their unknown underlying defect.

The user's instruction to proceed authorizes offline implementation, configured
reviews, ordinary task-branch commits and push, and a draft PR against `v3`.
Completion means a verified, reviewed draft with live qualification explicitly
pending. Marking ready, merge, settings or credential changes, and paid replays
remain outside this package.

## Execution details

Approval mode: executable batch, already authorized by the user.
Execution mode: standard; exact main-model identity is unavailable.
Ceremony: full path because fixed diagnostic codes consumed by the runner change.
One cohesive slice; no dependency, new executable module or application runtime.
No product primitive, source-access or provider trust boundary changes.

Baseline: `c58e111ea3d606b3a99dd0664351b5df97fd90c8` on `v3`.
Worktree: `trees/ocr-advisor-validation`; branch: `rs/ocr-advisor-validation`.
The existing `project/` artifacts root remains authoritative.

### Validation contract

Preserve rejection precedence: truncated completion (`length`), finish reason
(`invalid_finish_reason`), tool count (`invalid_tool_call_count`), tool name or
missing/null call (`invalid_tool_name`), argument JSON (`invalid_response`),
top-level keys/shape (`invalid_advice_shape`), assessment (`invalid_assessment`),
answer type (`invalid_answer_type`), answer length (`invalid_answer_length`),
evidence array (`invalid_evidence_type`), evidence count
(`invalid_evidence_count`), then individual evidence (`invalid_evidence`).

The 4,000-character answer, four evidence items and 500-character evidence detail
bounds retain their existing JavaScript string-length semantics. All existing
immutable source-range checks remain. Failed calls consume one attempt with at
most one dispatch; no retry is added. The public validation error remains
`invalid_advice`. Retain the old generic diagnostic reason for older receipts.
Unknown diagnostic values remain unavailable and never pass through to logs.

### Ownership and verification

Delegation map: main owns broker/runner implementation, guide, plan, integration
and delivery. One executor owns the two existing test files with disjoint writes.
The test owner uses these fixed codes and runs the focused suites after the main
implementation is available. Main verifies the integrated diff and results.

| Risk | Test obligation and seam | Acceptance |
| --- | --- | --- |
| Rejections conceal the failed check | Extend existing broker cases | Every fixed code and null call has an isolated synthetic failure |
| Diagnostics alter acceptance | Extend existing broker cases | Existing successful calls and exact answer/evidence limits still succeed; over-limit or bad evidence remains rejected |
| Sensitive values reach reporting | Extend existing broker and runner cases | Fixed codes propagate to logs/summary; sentinels and unknown values do not |
| Reclassification causes retries or counter drift | Extend existing broker cases | One failed attempt and one dispatch per synthetic response; quota behavior retained |
| Guide explains diagnostic limits | None | Source/diff inspection; no tests pin documentation wording |

### Slice: expose advisor validation checks

Main edits `.github/scripts/ocr-review-tools.cjs` and
`.github/scripts/ocr-draft-review.cjs`; executor edits their existing `.test.cjs`
files. Main updates only the matching paragraph in `docs/ci-and-deployment.md`.
This plan is the only new tracked file.

Run dependency-free broker, runner, adapter and relevant policy tests, syntax,
the installed formatter, diff inspection and staged secret/data checks. Preserve
repository hooks; required CI covers monorepo checks absent from the task's host
dependency tree. No application runtime or screenshots apply.

Commit the integrated slice. Run simplification and bounded correctness/privacy
review on that immutable range, disposition findings, then run one configured
integrated final review before claiming completed draft delivery. Push normally
and publish one draft against `v3`; no human review requests or extra paid runs.

## Progress

- Baseline: 19 focused tests passed; optional pinned-CLI case skipped.
- Planning: initial planner requested explicit codes, null-call handling and a
  definite test owner. Those findings are incorporated; the second pass approved the plan.
- Implementation: fixed reasons flow through existing broker receipts and runner
  output. Null calls now fail with the same safe validation error.
- Verification: 19 broker/runner tests and 100 adapter/policy tests passed; optional
  pinned-CLI integration skipped. Syntax, Biome (existing warnings), Prettier,
  diff checks and scoped Opengrep (200 rules, no findings) passed. No task host
  dependency install exists, so the native hook wrapper leaves full monorepo
  checks/build to required CI. No runtime was started.
- Test delta: two existing cases expanded; no new test module or test case.
- Packaging: one package; 396 substantive added/deleted lines before review,
  excluding this plan. Simplifier found no justified reductions; bounded
  correctness/privacy review found no actionable issues.
- Draft delivery: [PR #6650](https://github.com/uzh-bf/klicker-uzh/pull/6650)
  is open with the implementation committed and pushed. Integrated final review
  passed without findings; focused verification is complete. Hosted CI remains
  pending and is separate from completed draft delivery.
- Knowledge capture: the existing CI guide owns the diagnostic distinction and
  legacy-receipt caveat; no duplicate solution document or ADR is needed.
- Live cause: remains unknown until a natural advisor consultation uses the
  merged diagnostics. This delivery does not claim a functional advisor fix.
