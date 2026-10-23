# Source-grounded OCR stack review

## Approval summary

The user approved recording the full OCR review findings and executing the
recommended improvements on 2026-10-23. This first package supplies actual
immutable layer diffs to the independent stack topology pass and applies the
same evidence and confidence requirements used for ordinary final findings.
The cumulative code pass, model choices, maximum reasoning, token ceilings,
accounting, retry/resume behavior and publication authority remain unchanged.

The existing advisor plan gains the consolidated OCR improvement roadmap,
including the selected first adopter, `klicker-uzh-catalyst`. Catalyst adoption
is the next independent package. It is a private repository; source preparation
and synthetic qualification are authorized, while enabling external private
source review requires an explicit data-boundary decision. GitLab support and
application previews remain later roadmap work.

This is an approved executable batch, not a new approval request. Completion
means focused offline verification, committed-range review, ordinary task-branch
push and a draft PR against `v3`. Merge, ready-marking, live OCR replays, provider
settings and private-source activation remain separately gated. Missing or
oversized topology source must fail before a provider request rather than
produce a clean review from incomplete evidence.

## Execution details

### Working context and package

- Repository: public `uzh-bf/klicker-uzh`; target `v3`.
- Baseline: `4a9305739a516480e2b1e948a1eda8f61c974749`.
- Branch/worktree: `rs/ocr-stack-evidence`, `trees/rs/ocr-stack-evidence`.
- Artifacts root: existing `project/`; reports under ignored `_local/reviews/`.
- Execution mode: standard; full-path package. Main owns the roadmap, source
  evidence contract, integration and external effects. A bounded executor may
  implement settled changes; specialist reviews are read-only.
- One ordinary PR: a single stack-review correctness contract and its roadmap.
  The existing producer diagnostics [PR #6661](https://github.com/uzh-bf/klicker-uzh/pull/6661)
  stays independent. No product primitive or application runtime changes.

### Binding contract

1. Read source through host Git from each frozen manifest layer's exact base and
   head commits. Use `ultimate_base.sha/tree_sha` as the first layer's effective
   merge base; upper layers use their recorded base/head. Retain and verify the
   first layer's PR-base identity separately. Verify commit/tree identities against the manifest. Use
   fixed diff options disabling external diff and text conversion. Treat output
   as untrusted evidence, never executable instructions. Do not read the working
   tree or invoke candidate programs.
2. Include bounded unified layer diffs alongside the existing manifest and code
   summary. Keep the existing 1,000,000-byte complete topology request ceiling,
   65,536 output-token limit and 600-second provider timeout. Git read failures,
   unavailable commits, identity mismatch, binary source or oversized evidence
   fail closed before dispatch. Detect binary changes using NUL-delimited Git
   numstat, not patch text. Accept rename-only, mode-only, deletion and empty
   diffs. Bound each Git subprocess's output and reject overflow before request
   construction. No silent truncation or new provider retry.
3. Topology rules explain the evidence boundary: verify cross-layer mechanisms
   from supplied changes, retain exact layer ownership, and omit claims requiring
   unavailable context. Full and incremental requests both receive all current
   layer diffs; explicit mode/repair ranges define the narrower incremental
   finding-admission boundary. Keep `rangeAttestsFinding` enforcement. Complete
   coverage describes all supplied evidence, not unchanged source or executed tests.
4. Reuse the existing ordinary finding validator for topology content, confidence,
   category, severity and range validation. Preserve additional topology ownership
   and incremental-range checks. Require the same confidence/autofix/motivating
   line prefix in the model instructions/schema; no new score calibration.
5. Existing policy digests must invalidate obsolete review evidence through the
   already-listed changed helper/rules/schema paths. Preserve result publication,
   cost receipts, diagnostics retention and resume conditions.
6. Assemble source evidence only in the review job after its existing immutable
   range fetches. Snapshot creation remains metadata-only; no extra fetch or raw
   source artifact is introduced. Missing local objects fail closed. Git reads
   have a bounded subprocess timeout independent of the unchanged provider timeout.

### Ownership and slices

| Slice                                  | Owner                                                           | Paths and acceptance                                                                                                                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roadmap and plan                       | Main                                                            | This plan and `project/2026-10-18-ocr-review-advisor-plan.md`; every review finding has a status, next action and acceptance condition                                                                                                                   |
| Source evidence and finding acceptance | Native executor after the plan commit; main owns seam decisions | `.github/scripts/final-ai-stack-review.js`, `.github/scripts/final-ai-stack-review.test.js`, `.github/open-code-review/final-stack-topology-rules.json`, `.github/open-code-review/final-stack-topology-schema.json`; synthetic Git/model contract tests |
| Documentation and delivery             | Main                                                            | `docs/ci-and-deployment.md`; focused formatting, tests, secret scan, scope review, configured simplifier/risk/final reviews and draft PR                                                                                                                 |

The first commit records this plan and the roadmap. The implementation slice
is committed after focused checks, then reviewed by the simplifier and
slice-reviewer in parallel. Main accepts or rejects findings with evidence and
performs one correction round if needed. The integrated final reviewer checks
the complete committed range before completed delivery is claimed.

### Test portfolio

| Risk                                                      | Obligation      | Primary seam and acceptance                                                                                                                                                                                                     |
| --------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Topology receives no source for an unreported interaction | Extend existing | Capture the strict provider request from a synthetic two-layer Git repository with no prior findings; assert exact layer diffs, advanced-root merge-base exclusion, and unchanged lower-layer context during incremental repair |
| Mutable checkout or incomplete source is trusted          | Extend existing | Same Git/request seam rejects tree mismatch, absent commits, binary changes and oversized payload before dispatch; accepts rename/mode-only/deletion/empty changes and textual binary-marker content                            |
| Topology accepts unsupported confidence/evidence          | Extend existing | `validateTopologyResult` rejects missing prefix, below-threshold or above-100 confidence and preserves valid critical threshold, ownership and incremental range checks                                                         |
| Existing review policy changes incidentally               | None            | Individual/stack, adapter and invocation/workflow contract suites preserve reasoning, budgets, usage and retry semantics                                                                                                        |
| Roadmap prose drifts                                      | None            | Manual link/scope review and repository formatter; no prose-pinning assertions                                                                                                                                                  |

Use existing Node tests and available repository formatter, staged Gitleaks and
focused Opengrep. The pure Git/Node tests require no application environment.
Host hooks may report their existing dependency-install skip; required hosted CI
remains separate. No extra paid review is needed for local acceptance.

## Progress

- Scope and target refreshed; primary checkout clean and retained on `v3-ai`.
- Current baseline matches the reviewed source. New task worktree is clean.
- Planner round one corrections accepted: effective root merge base, binary
  classification and bounded reads, explicit incremental evidence, concrete ownership.
- Planner round two: APPROVED. Jev comparison skipped because the task summary
  includes unpublished planning without a TypeSafe data-boundary approval.
- Baseline: 128 individual/stack tests passed; implementation has not started.
- Main corrected the executor's initial source-read placement: source is read at
  topology dispatch rather than fetched and persisted during snapshot creation.
  The root-divergence fixture now excludes unrelated upstream changes. No model
  request is needed for these offline checks.
- Catalyst identified as first adopter, with activation pending a private-source
  data-boundary ruling. No Catalyst mutation or provider call has occurred.
