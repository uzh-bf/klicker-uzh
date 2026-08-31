# Bounded resume for partial final reviews

## Goal

Allow one OpenCodeReview 1.11.0 final-review job to recover from a partial
range review by resuming its manifest-backed session once. Preserve fail-closed
publication, exact-head review identity, and the existing aggregate token
budget.

## Evidence and constraints

- PR #5676 run `33318153424` reviewed the exact head with the merged workflow,
  reached the configured 30-minute OCR task timeout, emitted `status=partial`,
  and was correctly rejected before publication.
- OCR 1.11.0 includes `session_id` in JSON output. `ocr review --resume` accepts
  only a compatible range or commit review and reuses only checkpoints covered
  by the parent manifest.
- OCR applies `--max-tokens-budget` independently to each invocation. A resume
  therefore receives only the unused portion of the first attempt's budget.
  Individual and full-stack reviews have one ceiling for their single range.
  Incremental stack reviews retain the existing 750,000-token ceiling per
  layer range; a job-wide stack budget is a separate policy decision.
- The GitHub job must remain bounded. One review job may perform at most one
  resume, including an incremental stack review with several layer ranges.

## Intended behavior

1. Run OCR exactly as today and keep its JSON result.
2. Plan a resume only when the result is a structurally valid partial v1 run,
   has a safe session identifier equal to its manifest run ID, has no parent
   lineage, and carries none of OCR's three budget-exhaustion signals: summary
   flag, warning type, or budget-classified failed coverage.
3. Set the resume budget to the configured run budget minus the first
   attempt's reported token usage. If no positive budget remains, do not resume.
4. Re-run the exact same immutable range and review options with
   `--resume <session-id>`. No job performs a second resume.
5. Accept the resumed envelope only when its session and run IDs match, its
   resume and manifest lineage point to the first run, and its input,
   repository, rule, provider, and model identities are unchanged. Keep the
   resumed manifest, comments, coverage, comment count, reviewed-file count,
   and elapsed value. Sum only validated input, output, and total token counters
   from both attempts, and reject the result if their total exceeds the
   original range ceiling.
6. Publish only through the existing complete-result parser. A malformed,
   failed, or still-partial resumed result leaves the final status failed and
   publishes neither findings nor clean evidence.

Incremental ranges remain in declared order. The first eligible partial result
consumes the job's resume allowance and replaces only that range after strict
validation. Any ineligible partial, still-partial resume, or later partial
fails the code-review step immediately.

The individual review job gets a 75-minute ceiling. The stack review job gets
a 90-minute ceiling. Each job records its wall-clock origin in the first step
and checks a fixed inner deadline before starting an OCR attempt, reserving time
for cleanup, topology review, publication, and finalization. These bounds add at
most one 30-minute recovery window without allowing an open-ended retry loop.

## Scope

- Add pure resume-planning and result-combination helpers plus focused unit
  tests in `.github/scripts/final-ai-review.js` and
  `.github/scripts/final-ai-review.test.js`.
- Wire one shared resume allowance through individual, full-stack, and
  incremental-stack OCR invocations in
  `.github/workflows/check-ocr-final-review.yml`.
- Update `docs/ci-and-deployment.md` with the recovery, cost, timeout, and
  fail-closed contracts.
- Update this plan's `Progress` section with verification and delivery evidence.

Out of scope: changing the model, provider, review rules, finding parser,
publication format, stack topology pass, automatic trigger policy, or OCR
version.

## Verification

- Unit fixtures cover complete results, valid timeout-style partial results,
  missing or unsafe session IDs, all budget-exhaustion signals, zero remaining
  budget, identity and lineage mismatch, still-partial resumes, and combined
  usage accounting within the original ceiling.
- Workflow assertions prove exactly one job-level resume allowance, unchanged
  immutable ranges/options, deterministic incremental ordering, reduced resume
  budgets, inner cleanup reserves, and the 75/90-minute job ceilings.
- Stack tests prove that a validated resumed range remains compatible with the
  existing per-layer result combiner and complete-only publisher.
- Run both final-review test suites and repository formatting checks for every
  touched JavaScript, YAML, and Markdown file.
- Inspect the staged diff for unrelated changes, secrets, and personal data.
- After publication and merge are separately authorized, dogfood the individual
  path by retriggering PR #5676. Run the stack path on a current native stack
  only after the individual recovery proves the contract.

## Execution and authority

The main session owns this coupled workflow/helper slice because the budget,
lineage, and publication contracts must change together. A planner reviews this
draft before implementation. The committed slice then receives the required
simplification, risk, and integrated final reviews.

Local implementation, verification, review, and commits are authorized by the
approved goal. Push, PR creation, merge, and retriggering external reviews are
withheld until coordination with the PR #5676 task and explicit publication or
merge authority.

## Delegation map and slice boundary

| Slice | Route | Paths | Commit boundary | Acceptance |
| --- | --- | --- | --- | --- |
| Bounded resume across individual, full-stack, and incremental-stack paths | Main session; critical-path coupling | Plan, final-review workflow, individual and stack helpers/tests, CI documentation | One conventional `fix(ci)` commit after verification and slice reviews | Both final-review suites, scoped formatting, and `git diff --check` pass; resume eligibility, allowance sequencing, identity/lineage rejection, budget rejection, resumed stack consumption, and unchanged complete-only publication are covered |

The local terminal condition is one reviewed, verified commit with this
`Progress` section current. Pause only for a material contract change, a failed
required independent review with no valid fallback, or a verification failure
that requires broader scope. Push, PR creation, merge, and live retriggers are
not part of this terminal condition.

## Progress

- [x] Reproduced and classified the live failure as incomplete OCR coverage,
  not a code finding or publication defect.
- [x] Verified the OCR 1.11.0 resume, manifest, timeout, and per-invocation
  budget contracts against the pinned upstream source.
- [x] Planner review completed and dispositioned. The plan now freezes strict
  identity and budget validation, deterministic stack sequencing, stack-test
  compatibility, and an inner wall-clock reserve.
- [x] Implementation and focused verification completed. Both final-review test
  suites pass all 100 tests; the workflow parses as YAML, both changed run
  blocks pass `bash -n`, scoped Biome and Prettier checks pass, and
  `git diff --check` is clean. The offline qualification suite also passes all
  20 tests and all eight fixtures.
- [x] Slice simplification and risk review completed and dispositioned. The
  Gemini slice reviewer returned `DONE_NO_FINDINGS`. The configured Qwen
  simplifier failed before work with `404 Unknown combo`; its single allowed
  GPT-5.6 Luna generic-continuity replacement returned `DONE_NO_FINDINGS`.
- [x] Integrated final review completed and dispositioned. The Sol reviewer
  found that step-local timers excluded setup time from the cleanup reserve.
  Both jobs now record their origin in the first step and enforce every OCR
  deadline against that timestamp; the same reviewer accepted the correction
  with `DONE` and no remaining findings.
- [ ] Publication and live individual and stack evidence remain explicitly
  withheld for the coordinating task.
