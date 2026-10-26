# Tutor feedback and Quizzer continuation comparison

Date: 28 September 2026. Status: source candidate; prompt-level comparison completed with unresolved behavior concerns. This is not deployment or learning-effectiveness evidence.

## Change and decision

Tutor feedback and progress summaries distinguish repeating a supplied solution from independently demonstrated reasoning. Requests about progress explicitly trigger the snapshot rule. The Quizzer distinguishes assisted work in snapshots and checkpoints, keeps a pending hint or retry on the current question, and honors an explicit stop, pause, or topic change before automatic continuation. The final implementation changes four existing bullets across two templates.

The existing direct-answer policy, adaptive support, explanation escape, one-hint-or-retry limit, course grounding, and checkpoint thresholds remain intact. Missing-diagram and transfer instructions were not expanded: the exercised missing-diagram behavior already worked, and this comparison did not establish a need for another transfer rule.

The strongest observed improvement is assistance attribution. Revision handling already worked, so its proposed extra instruction was removed after comparison. Stopping worked in both arms; its explicit precedence clarification is retained to resolve the competing automatic-continuation rule, without claiming a measured improvement. The candidate still has unresolved failures. Keep it as a draft for review; it does not satisfy an unconditional all-cases-pass acceptance gate.

## Method and evidence boundary

- Baseline: `85d03bb4880d7c62de9ffa128f863ad61baea793` on `v3`. Only `mode-tutor.hbs` and `mode-quizzer.hbs` differ in the candidate.
- Target: the existing Azure `gpt-5.6-luna` deployment, Responses API, medium reasoning, maximum 4,096 output tokens, provider-default sampling. Both arms use the same settings. No model fallback or automatic retries.
- Sixteen synthetic cases with acceptance and failure criteria written before generation, including English and German conversation histories. Four were initially reserved, then became regression cases after their first inspection. Four more cases became regressions after an intermediate candidate; two previously unused cases were fixed before evaluating the final simplified wording.
- Final validation: 22 paired cases, 44 completed responses, zero transport failures. Earlier candidates and repeated ambiguous cases were retained locally as investigation history. Repetitions of an earlier candidate are not counted as repetitions of the final wording.
- A fixed current-turn `doc_query` call/result was supplied to each request. Tool selection and live retrieval were not exercised. The synthetic course covered algebra, percentages, slope, mean and median. Each arm received the same course fixture and history.

The effective system prompt was projected from the repository templates in compiler order: course data, platform mode, attachment interpretation, course policy, grounding, output formatting, citation contract with the current maximum of 12 sources, and language policy. Lecturer guidance, custom modes, practice cards and persistent state were absent. This was an explicit prompt projection, not execution through the application compiler or chat route.

The pinned private evaluator was inspected at `2a75632a98a8f8e8382a7f7ecaa4fda9f715e12b`. Its conversational scoring support exists, but the inspected Chat Completions query client sends a single user message. A local, standard-library comparison driver supplied the required history. No evaluator, dependency, database or infrastructure changes were made.

An initial Chat Completions transport attempt failed because this deployment rejects function tools together with reasoning on that API. Those failed calls are excluded from behavioral judgments. Responses API calls succeeded; a separate instruction canary returned the requested marker, confirming that system instructions were applied. Generated hidden reasoning was not retained.

Judgments below are an agent inspection against the declared behaviors. They are not calibrated DeepEval scores, blinded human ratings, statistical effect estimates, or evidence of student learning. Sample sizes are too small to establish failure rates. Fixed histories test the next response, not an autonomous longitudinal learning trajectory.

## Final paired observations

“Meets” means the named behavior was observed in that response, not that every platform rule was satisfied. “Concern” means the response did not fully meet the intended behavior. Secondary issues are recorded below rather than hidden in an aggregate score.

| Synthetic case                                       | Baseline | Candidate | Observation                                                                                                               |
| ---------------------------------------------------- | -------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| Corrected algebra step, English                      | Meets    | Meets     | Both check the correction; no extra revision rule was needed.                                                             |
| Revision still subtracts instead of dividing, German | Meets    | Meets     | Both identify the new operation error.                                                                                    |
| Tutor solution copied verbatim, English              | Concern  | Meets     | Baseline credits the steps without acknowledging help. Candidate explicitly recognizes the supplied worked solution.      |
| Correct answer without visible method                | Concern  | Meets     | Baseline attributes solving ability; candidate limits its conclusion because working is absent.                           |
| Quizzer hint request                                 | Meets    | Meets     | Both stay on the same equation and wait for the retry.                                                                    |
| Quizzer explicit stop                                | Meets    | Meets     | Both stop. Candidate makes an unsupported method-specific praise claim from a bare answer; see below.                     |
| Quizzer explicit topic change, German                | Meets    | Meets     | Both switch to percentages.                                                                                               |
| Automatic checkpoint after assisted cycles           | Concern  | Concern   | Both continue with a new question. Earlier runs varied in both arms.                                                      |
| Simple definition                                    | Meets    | Meets     | Direct answers, without compulsory questioning.                                                                           |
| Requested full explanation, German                   | Meets    | Meets     | Both explain compounded percentage increases.                                                                             |
| Valid alternative algebra method                     | Meets    | Meets     | Both accept dividing first.                                                                                               |
| Missing diagram                                      | Meets    | Meets     | Both request the missing image or relevant details.                                                                       |
| Quizzer pause, German                                | Meets    | Meets     | Both pause.                                                                                                               |
| Retry exhausted; explanation requested               | Meets    | Meets     | Both explain and move on without another retry.                                                                           |
| Quizzer repeats a supplied median answer, German     | Concern  | Meets     | Candidate explicitly says repetition is not independent evidence.                                                         |
| Conflicting course notes                             | Meets    | Meets     | Both preserve uncertainty about the course requirement; earlier candidates and baselines sometimes exceeded the evidence. |
| Copied percentage calculation                        | Concern  | Meets     | Candidate identifies the method as supplied and proposes an independent check, without first crediting understanding.     |
| Partial percentage revision, German                  | Meets    | Meets     | Both correct the total to 121; the simplified candidate no longer asserts the earlier unobserved cause.                   |
| Fresh slope hint request                             | Meets    | Meets     | Both keep the same question open and do not reveal the final slope.                                                       |
| Fresh Tutor stop after correction, German            | Meets    | Meets     | Both acknowledge the correction and stop.                                                                                 |
| Previously unused Tutor median repetition, German    | Concern  | Concern   | Both infer understanding from a repeated supplied explanation.                                                            |
| Previously unused Quizzer mean snapshot, English     | Concern  | Meets     | Candidate explicitly qualifies the repeated worked solution as insufficient evidence of independent reasoning.            |

### Clear improvement: copied algebra solution

The student first requests a worked solution to `2x+3=11`. After the Tutor supplies `2x=8`, then `x=4`, the student repeats those steps and asks how they are doing.

The final baseline says: “You’re doing it correctly” and describes the algebra without identifying the supplied solution. The candidate says: “Since this matches the worked solution already shown, independent solving is not yet clear from the conversation.”

Earlier wording that placed the evidence rule only in the snapshot bullet did not reliably change this response. Adding it to the feedback rule and making the progress-request trigger explicit produced the observed difference. A further simplification directly excludes crediting understanding before qualifying that claim. The experiment changed these sentences together; it does not isolate their individual causal contributions.

### Clear improvement: Quizzer assistance attribution

After a learner gives up on a median question, the Quizzer supplies the answer. The learner repeats it and asks for progress feedback. The baseline credits identifying the median. The candidate explicitly describes the answer as repeated and says it is not independent evidence, while retaining the insufficient-evidence qualification.

### Remaining concerns

**Checkpoint timing remains unreliable.** Both final responses ask another question. Earlier paired samples alternated between emitting and skipping the checkpoint. Assistance and “completed cycle” interpretation remain ambiguous in practice. The final candidate leaves the existing checkpoint eligibility wording intact. Do not claim reliable counting from this change; this remains an unresolved review concern.

**Assistance attribution is improved, not reliable across all phrasing.** The simplified candidate fixes the contradictory praise observed in the percentage case. However, the previously unused German Tutor median case still begins by claiming that the copied explanation demonstrates understanding. The baseline makes the same error. This is a failed held-out behavior check, not evidence of generalization across languages and requests.

**Revision instructions were not retained without evidence of benefit.** An intermediate candidate inferred that a total of 111 came from `100+11`, although the student had not stated that operation. The final candidate restores the existing revision instruction and corrects the arithmetic without making that inference in the repeated case. That single corrected response does not establish that causal overdiagnosis is solved generally.

**Other policy failures remain.** The candidate stop response credits isolating the variable after seeing only `x=4`; earlier baselines also made that unsupported claim. A final candidate slope hint uses unsupported math delimiters. Earlier conflicting-source responses sometimes added general knowledge beyond the supplied course evidence. These observations prevent a blanket platform-compliance claim.

## Verification and follow-up

Both final templates compile with Handlebars 4.7.9 under `strict: true` in a disposable, network-disabled Node 24.21.0 container. Their rendered output equals their literal source with the existing final-newline handling. `git diff --check` passed. No tests were added that pin prompt wording. Monorepo typechecks and builds were not run for these literal-template edits; equivalent focused rendering, diff and staged-data checks were used instead of the broad Git hooks. No application runtime, live course, browser flow, database write, deployment, or student study was exercised. Browser screenshots do not apply to these server prompt assets; no browser interaction or rendering contract changed.

This package contains prompt policy refinements and their evidence, not reliable learner-state tracking. The failed German case and checkpoint counting remain explicit acceptance gaps. Further tuning needs new held-out cases and preferably teacher judgments, rather than repeatedly optimizing against this now-exposed set. Checkpoint reliability needs a separate decision about whether prompt clarification suffices or explicit task state is necessary. The larger Catalyst and learning-effectiveness work remains later in the roadmap.
