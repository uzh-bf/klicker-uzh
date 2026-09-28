# Tutor attribution evaluation and bounded prompt experiment

Status: approved scope and reviewed execution details. User approval: “proceed
accordingly” after the improvement map. Target `v3`; branch
`rs/tutor-e2e-validation`; baseline `cde7e4274757893a698a6c762a18e4e877a131c0`.
Draft [PR #6319](https://github.com/uzh-bf/klicker-uzh/pull/6319). Main session
owns integration and the terminal condition in standard execution mode.

## Outcome and boundary

Deliver a repeatable real multi-turn evaluation and compare one small feedback
procedure change against the current Tutor/Quizzer prompts. Retain a prompt
change only if it passes the predeclared local gate. Otherwise restore the
baseline prompts and deliver the reusable harness plus an honest rejection
report. Preserve explanations, hints/retries, alternative methods and user
control. No claims of learner mastery or general effectiveness follow from this
small synthetic experiment.

This approved package includes isolated synthetic runtime use, model calls
within the bounded run below, source/test changes, required reviews, ordinary
task-branch commits/pushes and draft PR delivery. It excludes merge, deployment,
production records, new credentials or audiences, new state/schema, and the
later grounding/checkpoint-state packages. Stop the exact runtime after final
verification, retain data and worktree, and report its final state.

## Evidence and design

The prior live run completed 15 behavioral turns through actual retrieval,
model streaming and persistence. German copied-answer feedback still credited
understanding, while Quizzer called a hinted answer independent. The earlier
[comparison](2026-09-28-tutor-prompt-feedback-comparison.md) also found inconsistent
checkpoint timing. Existing prompt prohibitions did not eliminate these errors.

Reuse conversation and parent-message identities; extend the existing test-side
evaluator. Correctness, visible assistance and missing evidence remain separate
feedback concepts. The application continues to own authentication, histories,
model selection and persistence. No new learner-state primitive or ADR is needed;
durable inferred state would require a separate design and data-protection pass.

Use the existing `KlickerEvaluationTarget` class and preserve the current
single-message HTTP completion contract. Add a distinct programmatic trajectory
operation, plus a bounded CLI runner, that chains actual persisted assistant
replies. Support literal learner turns and an explicit test operation that
repeats the previous visible assistant answer; never expose test-control
annotations in the learner message. Persist only sanitized visible output and
IDs, not cookies, credentials or reasoning. Validate the trajectory before any
network effect; fail on bad mode/model, missing parents, incomplete streams or
missing expected retrieval, rather than counting a partial run as a pass. Before advancing, verify persisted parent links for the entire active chain, equality between streamed visible text and persisted text, and a completed non-error `KB_doc_query` output on the first turn of each trajectory. Later turns may use the existing context without fresh retrieval; any emitted retrieval must still complete and agree between stream and persistence. Allowlist receipts to case/turn IDs, parent IDs, modes/models, timestamps, visible user/assistant text, tool completion status, source reference/title metadata and credit usage. Exclude reasoning, headers, raw tool arguments/results and raw error bodies.

The private evaluation framework is uninitialized in this checkout. The existing
public adapter is the smallest usable seam and stays compatible with it. No new
evaluation SDK, judge, reporting service or dependency is introduced.

## Experiment fixed before outputs

Use 12 short trajectories: six development regressions, four reserved scenarios
and two preserved-behavior controls. Cover both languages and modes, copied or
paraphrased explanations, partial hints, missing working, new transfer after help,
mixed assisted/unassisted criteria, correction/alternative methods, explanation
and pause. Cases are synthetic scenarios with behavioral rubrics, not expected
prose. The reserved cases are authored by a separate executor after the candidate file is frozen. Its author sees neither their inputs nor outputs before freezing; record candidate, corpus and rubric fingerprints before any run. Open reserved results only for the final comparison, and do not revise the candidate afterward. Once seen, they are no longer held out.

Run each trajectory twice per arm, at most three turns on average (a longer
Quizzer trajectory is balanced by shorter cases). The frozen corpus will contain exactly 32 turns per pass (128 comparison submissions across both repeats and arms). Hard cap: 160 model turns
including failed/incomplete submissions, warmup and at most 12 final Auto/browser turns; do not retry a failed
model request automatically. Track successful, incomplete and failed requests
separately. Stop new calls at 3 application credits; those are application usage
units, not a claimed dollar cost. Sum the recorded per-turn finish/persisted usage before each subsequent call; the last in-flight request can overshoot the soft credit ceiling. Missing accounting, budget exhaustion or incomplete comparable coverage makes the experiment inconclusive and retains baseline prompts. No expanding the budget to obtain a pass.

Both arms use the current allowlisted direct `gpt-5.6-luna` route, the same
reasoning effort and deterministic local finance material. Run baseline then
candidate against the exact isolated checkout, proving the compiled prompt
fingerprint for each arm. Treat time/order as a limitation. Require request-context evidence of the configured direct deployment, persisted model agreement, and no configured fallback for that direct alias. An unexpected or unresolvable route makes that pair non-comparable and the acceptance gate inconclusive; retain baseline prompts. The provider's internal model snapshot is not controlled; Auto runs are separate product checks. No direct comparison with the earlier Azure experiment is valid.

Candidate: replace the narrow feedback/assistance clauses with a short positive
procedure: inspect the shown work, identify help already supplied for that
task/criterion, then give accurate qualified feedback. Qualify the observation
at first mention. Retain nearby policies and comments. Do not add a second
candidate or example-tuning loop in this package.

Score the whole relevant response on unsupported understanding/independence,
incorrect assistance attribution, invented diagnostic causes, useful next step,
and preserved control flow. Main-session manual scoring covers all outputs;
a separate reviewer checks all failures, at least four apparent passing trajectories spanning both modes/languages, and the proposed pass/reject disposition.
Report counts/denominators by mode, language and support class. Agent judgment
is not calibrated teacher judgment; human review remains necessary before
pilot-readiness claims and no human is notified by this task.

Local gate: zero unsupported understanding/independence claims across all critical
development regressions in both repeats, fewer attribution failures than baseline
on reserved cases, and no newly introduced preserved-behavior failures. Baseline
zero on reserved cases cannot establish improvement: report inconclusive and
retain baseline prompts. If passing, verify the candidate through Auto with the
real browser, tool/citation display and reload persistence before retaining it.
For Auto, require both modes to qualify copied/hinted work, preserve explanation and pause behavior, and retain tool/citation/answer on reload. Any attribution/control failure rejects the candidate. Never weaken the rubric or discard failing cases after inspection.

Freeze case IDs, target assessment turns and rubric dimensions in the corpus. All six development cases are critical. A claim that credited understanding/independence beyond shown reasoning/help is a critical failure even if later qualified. Count a case-repeat failed if any target turn fails its relevant obligation; report turn-level evidence too. Prompt Quizzer for the specific scenario/values used by the literal learner reply. If it asks a different question, mark the trajectory invalid, preserve it in coverage denominators and retain baseline prompts rather than adapting learner answers after seeing outputs.

## Test portfolio

| Obligation                                                                               | Existing protection                                    | Change and primary seam                                                                                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Actual history/parent chain and persisted answers                                        | Single-turn adapter tests; mocked browser branch tests | extend existing: adapter tests with synthetic HTTP server and multi-turn ancestry checks; real trajectory run proves integration. |
| Fail closed on incomplete stream, wrong mode/model, invalid inputs and missing retrieval | Adapter validation and single-turn checks              | extend existing: only missing trajectory cases in existing test file.                                                             |
| Assistance attribution and preserved teaching behavior                                   | Exposed prompt comparison and manual live receipts     | add new: scenario corpus and manual per-output rubric; never assert prompt wording or seed prose.                                 |
| Auto interaction and reload                                                              | Prior live smoke, existing browser mechanics           | none for new automated UI tests: reuse unaffected mechanics; exercise accepted candidate in the actual browser.                   |

## Delegation map and slices

Each independently useful outcome has one owner. The commit packaging below does
not transfer ownership between these outcomes.

| Outcome                        | Sole owner                     | Dependency                                           | Acceptance                                                               |
| ------------------------------ | ------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Harness implementation         | Native executor, harness scope | Reviewed plan                                        | Focused Vitest contract checks pass                                      |
| Corpus authoring               | Native executor, corpus scope  | Frozen candidate                                     | 12 synthetic cases and 32 turns, fixed groups and rubrics                |
| Corpus validation/freeze       | Main                           | Corpus authoring                                     | Validate schema/counts and record hashes without reading reserved inputs |
| Experiment and prompt decision | Main                           | Harness plus corpus validation/freeze                | Comparable coverage and declared retain/reject gate                      |
| Delivery and runtime shutdown  | Main                           | Accepted experiment disposition, including rejection | Reviewed draft PR, reported CI, exact runtime stopped                    |

1. **Trajectory harness.** Native executor exclusively owns
   `apps/chat/scripts/klicker-evaluation-target.mjs`, existing
   `apps/chat/test/klicker-evaluation-target.test.mjs`, and the new
   `apps/chat/scripts/run-tutor-trajectories.mjs`. A separate native executor owns corpus authoring in
   `evaluation/data/trajectories/tutor-attribution.json` once the candidate is frozen; main owns this plan, corpus-schema validation and freeze hashes. Corpus acceptance is the declared 12 cases/32 turns, group and language coverage, and no data beyond synthetic finance scenarios. Harness and corpus are independent until the live-run step.
   Acceptance: container Vitest tests prove parent chaining, sanitized records,
   preserved single-message API and fail-closed boundaries. Focused command: `devrouter exec . -- pnpm --filter @klicker-uzh/chat exec vitest run test/klicker-evaluation-target.test.mjs`. One harness/corpus commit after both owners finish. Receipt tests cover ancestor mismatch, missing/error retrieval, incomplete stream, text mismatch and excluded-field leakage.
2. **Bounded experiment.** Main owns `apps/chat/src/prompts/mode-tutor.hbs`,
   `mode-quizzer.hbs`, run receipts under ignored `project/_local/`, and a new
   `project/2026-09-28-tutor-attribution-evaluation.md` report. Run frozen baseline
   and candidate, score, retain or reject under the gate, and browser-verify any
   retained candidate. One evidence/conditional-prompt commit.
3. **Delivery.** Main owns delivery. Update the existing evaluation section in `docs/chat-platform.md`
   for the new command and limits; keep public examples synthetic. Run applicable
   container checks, staged secret/data hygiene, simplification and final review.
   Push normally and open one cohesive draft PR against `v3`; no stack is needed
   for this one evaluation capability. Report exact-head CI and feedback state.

The harness slice crosses the test-client/application seam and gets simplifier
plus scoped slice review on its committed range. The integrated package gets
final review. Plan review is performed before implementation; its accepted
findings are recorded below. Browser captures are evidence of an experiment,
not a visible UI change; no screenshot-gallery product delta is introduced.

## Progress

- Complete: harness and frozen 12-case corpus; 128 comparison turns; baseline
  retained after candidate rejection; two extra protocol canaries within the
  160-turn ceiling. Total usage: 130 submissions, 0.248203 application credits.
- Verification: 26 focused tests pass; repository container typecheck/lint/policy
  checks pass; host Playwright infrastructure checks pass (39 and 84); focused
  Opengrep reports no findings. Root build passed 23/23 tasks after preserving generated dev types that
  collided with production types; no application source repair. Exact runtime
  stopped: seven containers exited, source mount matched, zero task routes.
- Review: planning approved after three rounds. Simplifier reductions integrated.
  Slice review's usage/identity fixes pass regression tests and a real canary;
  surgical recheck passed. Independent semantic assessment confirmed rejection. Integrated final review passed with no findings through the configured continuity
  fallback. Draft PR #6319 is published; remote
  automatic code review is blocked by provider authentication before reviewing
  any files. Exact-head CI and final-review status remain visible on the PR.
- Packaging: one coherent evaluation capability; substantive size is approximately 2,550 added/deleted lines, mostly
  protocol checks and test fixtures; project artifacts are excluded. The
  harness, corpus and runner are one independently usable and reviewable unit. No prompt delta, UI delta, new dependency,
  schema change, deployment or merge. Existing runtime runbook receives the
  cache/build lesson under the same package.
- Required terminal: reviewed draft PR with results and explicit limitations,
  reported exact-head CI, and exact task runtime stopped with data retained.
