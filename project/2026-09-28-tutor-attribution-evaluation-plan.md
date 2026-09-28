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


## Iteration 2: approved continuation

### Approval summary

Executable batch approved by the user's instruction “work through 2”. Build and run one better-controlled experiment on the existing task branch and draft PR. First remove the known local bilingual retrieval blind spot and add independent numerical reference checks, then freeze one feedback-procedure candidate and ask a separate author for fresh reserved cases. Compare baseline and candidate under the same application, model, effort, material and accounting controls. Keep the baseline unless every declared gate passes; a failed candidate is a useful completed experiment.

Retain existing conversation history and mode ownership. No durable learner profile, database schema, production retrieval, judge service, SDK dependency, production access, review-secret repair, marking ready, merge or deployment. Synthetic local OpenRouter use stays within the existing boundary. A new ledger permits at most 160 submitted turns and a soft ceiling of 3 application credits (the final in-flight request may overshoot) for this experiment; this is a new bounded experiment, not a replay of the exhausted prior ledger. Never retry an uncertain model request or expand the budget after outputs. Stop the exact runtime when finished.

### Execution details

#### Baseline, authority and environment

Current task checkout: trees/tutor-e2e-validation, branch rs/tutor-e2e-validation, HEAD 597e05fc251811bce8d14bc4ad0e06f8d5720c8f. Target v3 at cde7e4274757893a698a6c762a18e4e877a131c0, verified through host gh. Draft https://github.com/uzh-bf/klicker-uzh/pull/6319 remains open at the expected head. Reuse this coherent evaluation package and active project/ artifacts root. Standard execution mode. No iteration-2 report existed at planning time.

The initial restricted session denied Git metadata writes and process inspection. The user restored host permissions and requested a retry. Host fetch now succeeds: task upstream is unchanged (0 ahead/0 behind), and the task is 6 commits ahead/0 behind v3. Managed runtime startup succeeded through the canonical command for the exact task path.

#### Primitive impact

Reuse the chat branch and visible learner attempt as evidence. Extend the existing mode's feedback procedure only; it must preserve direct explanations, hints/retries, optional transfer, alternative methods, pause and uncertainty. Compose visible help with the relevant criterion before describing a strength. No new learner state, mastery inference, hidden reasoning exposure or API contract.

#### Design and files

1. Local retrieval fixtures: extend the existing four synthetic documents in apps/chat/scripts/local-mcp-server.mjs with English/German terminology and bilingual conceptual content, preserving the current local integration contract. Keep the matcher in local-mcp-documents.mjs unchanged unless an observed query proves a matcher defect. Do not add a match-all fallback or silently turn empty retrieval into evidence. Existing evaluation scenario topics must all have material; unrelated queries must remain empty. Verify actual query coverage with a separate synthetic query matrix rather than assertions pinning seed text or incidental record counts. Record fixture hash before both arms and verify real first-turn citations and usable grounding.
2. Numerical checks: add apps/chat/scripts/tutor-numeric-reference.mjs and extend apps/chat/test/klicker-evaluation-target.test.mjs with synthetic calculation contracts. The reference module evaluates explicit structured PV/FV, coupon-bond and CAPM inputs and compares finite claimed numbers with declared absolute tolerances. No parsing free-form prose or treating an answer absent from text as correct. Keep annotated numerical claims in ignored score artifacts with response/turn anchors; semantic assessment determines which numbers are claims, whether the student result is correct, and whether feedback invents an error. Name the frozen sidecar evaluation/data/trajectories/tutor-attribution-v2-numeric.json; do not extend the strict trajectory schema. Each item binds caseId, assessment turn, formula, explicit inputs, output unit, absolute tolerance, expected student-answer correctness and required-answer status. Annual compounding only; rates are decimal fractions, periods are whole years, currency results use the stated currency unit. Currency tolerance is 0.01 and decimal-return tolerance is 0.0001. Every numerical assessment turn in the corpus gets an entry; verify full coverage after authorship and before calls. The sidecar contains expected inputs and assessment requirements only, never generated outputs. During manual scoring, record each explicit numerical claim with its response/turn anchor and converted unit, invoke the reference module, and store the machine comparison separately from semantic judgments. Missing required numerical evidence makes that numerical obligation unassessed, not successful. Use direct cash-flow sums plus a separately derived closed-form bond check; cross-check simple cases by hand. Existing case answers must be audited before use; ambiguous/invalid scenario premises do not pass.
3. Candidate: replace only the existing feedback/assistance clauses of mode-tutor.hbs and mode-quizzer.hbs. Specify an observable comparison procedure: check the relevant result against given inputs, compare each claimed strength with the learner's visible work and earlier assistance, distinguish matched supplied reasoning from a new independently shown step, then give one proportionate next step. Keep natural language; never demand hidden chain-of-thought or insert test-control instructions into learner messages. Freeze full baseline and candidate files plus hashes before reserved-case authoring; do not read fresh reserved content until all candidate edits are frozen. No second candidate in this package.
4. Corpus: new evaluation/data/trajectories/tutor-attribution-v2.json, exactly 12 cases/32 turns: six exposed development regressions, four freshly authored reserved cases, two control cases; both modes and English/German. Reuse the valid development/control contracts and repair false hint premises before freezing. The separate author sees the previous corpus for non-duplication and behavioral requirements, never the new candidate. Reserved scenarios must be meaningfully new contexts/criterion combinations, not just changed numbers. Fix literal Quizzer tasks and help histories without assuming the model emitted a hint. If a required question/help premise does not occur, mark invalid and retain baseline; no adapting turns after outputs. Freeze corpus, rubric, numerical oracle, materials and model settings.
5. Report in project/2026-09-28-tutor-attribution-evaluation-v2.md; extend the existing plan with iteration-2 execution/progress once reviewed. Add the new numerical-check workflow to the existing docs/chat-platform.md evaluation section only if needed for rerunning. Never overwrite prior receipts, scores or reports.

#### Owners and ordering

Main owns plan, candidate, integration, numeric reference implementation and real runs. A configured executor owns bilingual fixtures and a separate later executor owns the fresh corpus after candidate freeze. Main retains numerical semantics because they are coupled to scoring and candidate acceptance. Planner reviews this entire derived plan before implementation. Simplifier and scoped slice reviewer cover committed executable changes; independent semantic reviewer checks every failure/invalid trajectory and at least four passes spanning modes/languages; final reviewer covers the complete integrated package. Prior authentication/permission failures on Claude/AGY remain usable route evidence unless changed; use the configured continuity ladder.

#### Slice and delegation map

| Slice                                  | Owner and paths                                                                                    | Dependency                                                          | Acceptance and commit                                                                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1: valid fixture and numeric reference | executor: local-mcp-server.mjs; main: tutor-numeric-reference.mjs and existing evaluator test file | reviewed derived plan                                               | focused container tests plus language query-coverage artifact and independent numerical cross-check; one coherent commit before slice review/simplification |
| 2: freeze one comparison               | main: two prompt files and ignored frozen files; separate executor: v2 corpus and numeric sidecar  | slice 1 passes; candidate hash recorded before corpus author starts | schema/count/premise/numerical audit and all hashes recorded; one corpus/contract commit before paid comparison                                             |
| 3: run, score and decide               | main: ignored receipts/scores, public v2 report; independent semantic reviewer                     | valid frozen slice 2, exact runtime proof, full ledger coverage     | compare both arms, apply fixed gate, restore or retain prompts; commit report and only accepted candidate changes                                           |
| 4: verify and deliver                  | main: existing plan and docs/chat-platform.md if needed                                            | disposition complete                                                | final review, checks, normal task-branch delivery, draft update and exact stopped-runtime proof; metadata belongs in final report commit                    |

The existing plan receives this reviewed continuation before implementation. If Git metadata writes remain denied, retain the reviewed draft and prepare permitted source changes without claiming committed review or delivery; never use another transport to bypass the denial. Runtime/model calls cannot start until fixture, schema, arithmetic and accounting prerequisites pass. Later slices consume this fixed portfolio rather than adding tests per helper.

| Risk                               | Test obligation                     | Primary seam and distinct failure                                                                                                                                                           |
| ---------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Numerical reference and comparison | extend existing                     | synthetic formula/input/tolerance checks in existing evaluator test file catch wrong sign, period handling or unsupported/missing numbers                                                   |
| Retrieval fixture relevance        | none for new maintained tests       | existing matcher contracts plus a recorded English/German positive-query and unrelated-negative-query matrix; real retrieval validity assessed for both arms, without pinning fixture prose |
| Protocol/accounting                | none unless modified                | reuse current 26 adapter contracts and strict real canary; uncertain/submission accounting stops further calls                                                                              |
| Attribution and scenario validity  | add new corpus, no prose assertions | frozen trajectories, case-level validity and rubric evidence, separate failure/invalid denominators                                                                                         |
| Auto/browser acceptance            | none for new maintained tests       | if candidate passes, actual browser interactions/reload/persistence with a recorded shared-ledger reservation and reconciliation per submit                                                 |

#### Acceptance and test portfolio

Use existing installed tools; no DeepEval installation or private submodule initialization. Reuse the established manual multi-turn assessment boundary and public adapter. Container focused Vitest protects numerical input validation and formula/tolerance behavior, and reruns the 26 adapter contracts if touched. Host static syntax and schema checks are supplemental, never replacements for required container checks. Existing matcher contract tests remain the primary behavior seam; fixture coverage evidence is a finite test-run artifact, not prose-pinning maintained tests.

Run two repeats per arm (128 comparison submissions), then at most 16 preparation/protocol canary turns and at most 16 Auto/browser acceptance turns, sharing one sequential 160-turn/soft-3-credit ledger. Before every browser submit, the main session writes the same ledger reservation (increment submittedTurns, uncertain=true); after matching that exact persisted user/assistant turn and finite usage, add credits and clear uncertainty. Never overlap CLI and browser writers. Aborted, failed or unreconciled browser submits leave uncertainty set and stop all further calls. The in-flight request can overshoot the soft credit ceiling; no new submit starts at or above it. Run the fixed gpt-5.6-luna low route, same exact material and runtime for both arms; record effective application model/effort/compiled prompt hashes. Tool identity, completed non-error retrieval, persisted ancestor/text/usage equality must pass with the current stricter harness on every comparison turn. Missing/irrelevant grounding, invalid scenario premises or uncertain accounting cannot count as behavioral success. Retain all planned denominator entries and report invalids separately.

Gate: complete comparable valid coverage; zero unsupported understanding/independence claims in all critical development cases; fewer attribution failures on fresh reserved cases than baseline (baseline zero is inconclusive); zero unsupported numerical corrections or incorrect numerical claims on every designated numerical assessment in the frozen sidecar, with no baseline grandfathering; no new control-flow failures. Report attribution and numeric dimensions separately, by mode/language/support class, without averaging critical failures away. Main scores all visible output. Independent assessment reviews all failures/invalids plus at least four passes. Scoring remains unblinded, agent-based and uncalibrated; no teacher or learning-effectiveness claim.

If the direct-route candidate passes, perform real Auto/browser checks for both modes, copied/hinted attribution, direct explanation, pause, citations and reload persistence within the remaining budget; retain prompt changes only if those pass too. Otherwise restore baseline byte-for-byte and report rejection/inconclusive honestly. Prompt comparisons are file-managed source experiments, not shared-database applies. Stop exact runtime, retain volumes and worktree. Required checks/reviews, normal task-branch push and draft update finish delivery if available; report exact-head CI and concrete capability blockers. Step 1's review authentication repair, ready transition and merge remain outside this instruction.

### Progress

Planner approved round 2 after corrections to soft-credit/browser accounting, the frozen numerical sidecar and zero-failure gate, and slice/test ownership. Slice 1 source preparation is complete: bilingual fixtures, a numerical reference and four added contract tests are written. Static fixture coverage passes 21 positive queries, eight unrelated negative queries and all 12 prior corpus openers; source/matcher hashes match the recorded artifact. This proves finite keyword coverage only, not live model retrieval or citations. Node syntax and Biome checks pass for the numerical files (seven pre-existing informational findings in the test file). Required container tests have not run. No candidate, fresh reserved inputs or model calls have been generated. Git metadata writes are denied. Managed startup failed with `Could not prove lifecycle worker incarnation`; route inspection explicitly reports `ps spawn failed (EPERM)`. All seven exact task containers remain stopped; fresh route verification is unavailable. Resume with container checks, then slice review/commit, candidate freeze and separate reserved authorship before comparison. Required reviews, commits, experiment and draft update remain pending.
