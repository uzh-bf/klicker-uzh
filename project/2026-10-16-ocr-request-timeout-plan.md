# OCR request deadlines and sanitized CLI failures

## Approved outcome

Fix the unintended five-minute manual OCR HTTP deadline and expose safe CLI
failure diagnostics. The user authorizes investigation, bounded source fixes,
commits, ordinary pushes and a draft PR against `v3`. Preserve model/reasoning,
prompt/completion/aggregate token limits, accounting, concurrency, per-task and
job deadlines, provider responses and retry/resume behavior. No additional paid
manual OCR run, readiness change, merge or deployment is included.

Repository: `trees/ocr-timeout-errors`; branch: `rs/ocr-timeout-errors`.
Target baseline: `7f2722ddec45e7510ec8782b81361379f5c304c6` (`v3`).
Execution mode: standard. One cohesive defect-repair package; full-path review
because diagnostic output must preserve the existing privacy boundary.

## Diagnosis and approach

Released OCR 1.13.0 defaults an absent per-request HTTP timeout to five minutes.
Its independent task timeout is set to 45 minutes for individual reviews and
30 minutes for stack ranges. A synthetic provider delay reproduces timeout
classification and exit 1 with one request; a longer HTTP timeout completes the
same request without changing wire reasoning, completion limit or affinity.
The full default-five-minute reproduction and a response delayed beyond five
minutes with the aligned setting are required acceptance evidence.

Set `OCR_LLM_TIMEOUT` in the existing manual review job environments to 2700
and 1800 seconds respectively. This follows the existing task deadlines; the
task, adapter, cleanup and job ceilings remain binding. Draft OCR already has
an explicit 480-second request timeout and remains untouched. No new retry or
resume path and no changed OCR binary or SDK version.

Extend the existing bounded progress filter to reconstruct fixed CLI failure
codes from recognized error prefixes and known timeout or adapter markers.
Never print a raw error substring, provider body, URL, path, argument, credential,
reasoning trace or unknown token. Unknown fatal errors get a fixed fallback.
Deduplicate bounded categories; retain existing chunk/line limits and best-effort
sink behavior. Preserve private stderr, stdout, exit status and process cleanup.

On nonzero OCR exit, emit a bounded outcome diagnostic from any existing result
JSON before returning that same status. A new diagnostic-only helper command
must not run validation, resume, merge or publication and must never change the
attempt result. Missing/malformed output has fixed reasons and no raw file path.
A failed result can report observed `failed` and allowlisted coverage classes.
This closes the observability gap where `set -e` skips all result helpers after
CLI failure. Keep two-line resume-plan and JSON merge stdout protocols intact.

## Owners and slices

- Main owns reproduction, HTTP timeout wiring, helper CLI diagnostic command,
  workflow integration, docs, final proof and all forge effects.
- One bounded executor may own adapter progress filter and its tests only.
  An existing read-only exploration supplies exact upstream failure grammar.
- Planner hardens this derived approved plan; simplifier and scoped reviewer
  inspect committed changes; integrated Claude final review follows verification.

1. **Honor existing manual task deadlines.** Extend the workflow's job environment
   and existing extracted-shell tests to prove initial and resumed individual and
   stack attempts receive the correct HTTP timeout. Use the released unmodified
   binary and synthetic delayed provider for end-to-end proof. Commit the small
   timeout correction with this approved plan after planner hardening.
2. **Expose sanitized CLI failure causes.** Extend existing adapter filter/test,
   helper/test and both attempt functions. Reconstruct only fixed categories and
   safe coverage counters; document timeout layers and diagnostic limits. Verify
   privacy and unchanged process/retry behavior. Commit the coherent reporting fix.
3. **Deliver.** Run applicable focused checks, simplify/review, push the branch,
   open the draft and settle automatic CI/actionable feedback. New target drift
   alone does not require integration; resolve a concrete readiness blocker only.

## Files and tests

Allowed tracked writes: this plan; `.github/workflows/check-ocr-final-review.yml`;
`.github/scripts/final-ai-review.js` and `.test.js`;
`.github/scripts/ocr-mistral-adapter.cjs` and `.test.cjs`;
`docs/ci-and-deployment.md` and its existing
`docs/solutions/integration/opencodereview-publisher-rejection-payloads.md`
process-failure guidance. The latter needs a small update because the old
stage-and-size-only description becomes inaccurate. No other new tracked files,
dependencies or modules.

Existing workflow shell tests are the stable seam for initial/resume timeout
propagation and unchanged argv, preview, budgets, status and output protocols.
Extend existing adapter progress tests with split UTF-8/chunks, overlong records,
unknown fatal errors and private sentinels. Extend an existing CLI failure test
for structured failed coverage and unreadable/malformed fallback, independent of
prose. No exact prose or fixture-content assertions.

Acceptance requires pinned Node 24 focused helper, stack, adapter, self-update
and offline qualification suites; installed formatters; scope/secrets/data review;
required focused static checks with baseline limitations reported. No application
runtime or database work. Repository hooks may skip full install-dependent checks
in this dependency-free task checkout; hosted CI remains required.

Released-binary reproduction stays outside tracked source and never uses a live
key. Verify official release checksum/version. Original five-minute default fails
on a delayed response; aligned HTTP setting completes a response beyond five
minutes. Exactly one synthetic provider call in each experiment proves no retry
change; wire reasoning, completion tokens and affinity match. Existing task/job
limits and SDK retry settings are source-verified unchanged.

## Safety and review

Sanitized CLI diagnostics are fixed classifications, not raw excerpts. Treat
provider-controlled error text as untrusted even when it contains a known marker.
The exposure boundary is narrow and reviewed; no broad security scan. Optional
backup/recovery mechanisms and unrelated refactors stay outside this package.
Use private local evidence only in chat; public docs and PR text describe source
behavior and synthetic tests without real-environment observations.

Terminal condition: pushed branch, draft PR against `v3`, required reviews and
all applicable automatic CI settled; live trusted-default-branch proof remains a
separate later run. Stop only on a material scope/authority change or concrete
unrecoverable capability blocker.

## Progress

- Investigation: unmodified release fails at 300 seconds with the default HTTP
  timeout; the aligned setting completes a 301-second synthetic response. Both
  make exactly one request with unchanged wire reasoning, completion cap and
  affinity. No live provider was used.
- Source: individual/stack jobs set request timeouts to 2700/1800 seconds;
  extracted-shell verification covers initial and resumed attempts. Helper and
  stack suites pass 128 tests on pinned Node 24.
- Documentation lookup: Context7 has no OpenCodeReview entry; pinned official
  v1.13.0 source is the authoritative configuration evidence.
- Planning: configured planner APPROVED; proceed within the user-authorized batch.
- Timeout slice committed; simplifier removed one redundant assertion. Its
  command-boundary coverage remains intact.
- Diagnostics: diagnostic-only helper preserves original nonzero exits and
  reports failed coverage; focused suites pass 221 tests before adapter changes.
- Local static evidence: YAML parses and all 25 shell steps pass `bash -n`.
  Actionlint 1.7.12 reports the same six pre-existing `concurrency.queue` schema
  limitations on baseline and branch. Scoped Opengrep reports no findings with
  the existing helper partial-parse limitation.
- Next: integrate the bounded adapter filter, inspect and review the committed
  package, then push and open the draft for hosted CI.
- PR: none yet.
