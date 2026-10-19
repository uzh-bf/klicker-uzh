# Course-chatbot learning roadmap

Updated 19 October 2026. The immediate focus is learner support in Explainer.
Existing private reviews and finite comparisons are complete for selecting the
first improvement hypothesis. Current course performance and learning gains
remain unverified. Historical Tutor experiments remain below for reference.

## Current evaluation direction

Help learners understand concepts, resolve misconceptions and apply concepts
independently. The first bounded outcome is faithful explanation and revision:
preserve meaning, state when a rule applies and make evidence limits clear.
Revision notes are the first task form; direct explanations and worked examples
remain appropriate in Explainer.

Historical review supplies hypotheses; synthetic comparisons supply regression
evidence. Neither establishes current course performance or learning. Keep
judgments and real-environment evidence in approved private custody.

### Manual acceptance checklist v1

Assess actual answers and supporting passages, accepting correct paraphrases:

- Complete the requested learning task directly at the requested depth.
- Explain the essential concepts correctly, preserving meaning when shortening.
- Retain the conditions and exceptions that determine when a rule applies.
- Attach citations only to claims the cited passage supports, including examples.
- Identify missing or partial coverage and distinguish source facts from inference
  or illustration, while still providing useful supported help.

Record meets, concern, fails or not assessed with a reason; required items must
meet for acceptance. This supplements existing criteria without rescoring past
runs. Answer checks do not establish understanding or transfer.

### Outcome milestones

| Priority | Outcome | Completion and next boundary |
| --- | --- | --- |
| 1 | Select one obstacle to useful understanding | Evidence synthesis and checklist preparation complete for this purpose; current performance and learning remain unassessed |
| 2 | Establish faithful, course-grounded explanation and revision | Pending a separately authorized finite diagnostic: assess the baseline first, then at most one justified candidate; manually check answers, passage support and the unchanged control |
| 3 | Make an evidence-backed improvement decision and inspect learner benefit | Propose rollout only after representative task and course-owner consumer acceptance; application and deployment need named authority; independent understanding and transfer need learner evidence |

Next action: use the existing private source cards to prepare the smallest
baseline decision under the
[real-course protocol](2026-10-18-explainer-assessment-readiness-plan.md#real-course-acceptance-preparation).
Prioritize meaning-preserving revision, multipart coverage and evidence limits.
Unrun unit-lookup and cross-source tasks remain unassessed for broader acceptance.

Reuse prepared guidance only if the baseline demonstrates its targeted obstacle;
stop tuning if the baseline passes. Reject critical candidate/control regressions
and redirect demonstrated content or retrieval failures to their owner. Synthetic
success cannot authorize promotion. Later authorized learner feedback,
explain-back or independent application may inform learning assessment; usage
and assisted performance do not establish learning gains.

### Parked work and authority

Park gateway reservation repair, further route/pricing qualification, startup
repairs, evaluator/framework expansion, automated judging, ranking changes and
Tutor/Quizzer work. Revisit only when evidence links a concrete blocker or need
to the selected learner outcome. A blocked paid route does not authorize an
upstream infrastructure project. Reuse existing capture/import and assessment.

The approved implementation adds one instruction to the source-managed standard
Explainer contract in this draft; its generated-answer effect is unassessed.
The [continuation](2026-10-18-explainer-assessment-readiness-plan.md#current-learner-improvement-continuation)
pins the pre-change baseline and one-instruction candidate for a later matched
check. Stored lecturer guidance remains unchanged. Further inference needs
named budget, provider, source-use and enforceable cost authority; prior capture
authority is consumed. Monitored spending is not a hard-cap substitute. Live
prompt/KB changes, promotion, merge and deployment remain separately gated.

## Existing foundations and deferred protocols

Recorded source foundations: [citation correction PR 6483](https://github.com/uzh-bf/klicker-uzh/pull/6483),
[app importer PR 6578](https://github.com/uzh-bf/klicker-uzh/pull/6578),
[generic contract MR 57](https://gitlab.uzh.ch/ai-infrastructure/evaluation/-/merge_requests/57),
[judge admission MR 61](https://gitlab.uzh.ch/ai-infrastructure/evaluation/-/merge_requests/61)
and [gateway retry correction PR 6603](https://github.com/uzh-bf/klicker-uzh/pull/6603).
Source delivery does not establish deployment, judge accuracy or student benefit.
The app owns capture, experiment data and receipt translation; the Python
framework owns generic assessment and reporting, independent of any application.

The private decision index retains the completed
[preservation](2026-10-18-explainer-assessment-readiness-plan.md#approved-preservation-execution)
and [attribution](2026-10-18-explainer-assessment-readiness-plan.md#approved-attribution-execution)
comparisons and [separate guidance preparation](2026-10-18-explainer-assessment-readiness-plan.md#approved-prompt-preparation).
The [preflight](2026-10-18-explainer-assessment-readiness-plan.md#zero-spend-source-and-route-preflight)
and [quality-decision batch](2026-10-18-explainer-assessment-readiness-plan.md#current-quality-decision-batch)
remain conditional reference protocols, not an instruction to resume technical
work. This direction continues the
[course-quality plan](2026-10-12-chatbot-learning-quality-plan.md) and supersedes
the earlier judge-first sequence in the
[evaluation consolidation plan](2026-10-12-chatbot-evaluator-plan.md#evaluation-consolidation--2026-10-17).

Reuse the [existing comparison corpus](../evaluation/data/explainer-compression/README.md).
Inspected authored cases are regression/transfer examples, not blind holdouts.
The existing
[US$55/48-turn initializer option](https://github.com/uzh-bf/klicker-uzh/pull/6576)
supported the finite protocols without another source change. The follow-up
protocols used the same cumulative ledger, not a renewed allowance.
Each finite protocol stops at its own planned turn count within the ledger's
48-turn ceiling. The default US$5 cap and earlier ledgers remain unchanged.
The [initial](2026-10-18-explainer-assessment-readiness-plan.md#approved-comparison-execution),
[preservation](2026-10-18-explainer-assessment-readiness-plan.md#approved-preservation-execution)
and [attribution](2026-10-18-explainer-assessment-readiness-plan.md#approved-attribution-execution)
execution authority is consumed. Judge calls, further captures, shared prompt
changes, merge and deployment remain separate.

## Historical Tutor iteration

This roadmap follows the rejected attribution candidate recorded in
[the v2 evaluation](2026-09-28-tutor-attribution-evaluation-v2.md). It reuses
the protocol in
[the evaluation plan](2026-09-28-tutor-attribution-evaluation-plan.md),
including the gate, the blind reserved-case author and the frozen corpus.

## Problems

1. **Copied work is credited as the learner's own.** In the baseline, a
   learner pastes the Tutor's explanation back and says so. The Tutor still
   praises "your clear and correct application".
2. **Supplied worked examples blur into new steps.** When the learner reuses
   values the Tutor computed earlier, feedback treats them as independent
   work.
3. **Numeric answers drift by rounding.** The Tutor rounds intermediate
   values and reports 1,027.80 where the exact result is 1,027.75.

## Phases

| Phase | Outcome                                                       | Status |
| ----- | ------------------------------------------------------------- | ------ |
| 1     | Reclaim the earlier evaluation worktree, keep local receipts  | Done   |
| 2     | Attribution candidate: copied-content evidence + feedback check | Candidate 4 passed     |
| 3     | Numeric precision rule; calculator tool only if the rule fails | Calculator required, no errors in round 3 |

Phases 2 and 3 share one evaluation run because both change the same trailing
step messages.

## Candidate design

The earlier rejected candidate only edited the mode prompts. A rule at the top
of the system prompt loses to the most recent material, as the reply-language
work showed. This candidate therefore adds messages at the end of each step,
before the reply-language reminder, which stays last.

- **A. Copied-content evidence (server, deterministic).** For the latest user
  message, the server measures how much of its wording repeats runs of six or
  more words from earlier assistant messages. It also lists numbers that the
  learner repeats from earlier assistant messages and that no earlier user
  message contained. When either signal fires, a system note states these
  facts and tells the model to treat the repeated material as supplied help.
  The check uses no language-specific word lists.
- **B. Feedback check (Tutor and Quizzer).** A short trailing reminder asks
  the model to credit only steps the learner visibly produced, and to say
  plainly when work repeats earlier help.
- **C. Numeric precision.** The same reminder asks the model to carry full
  precision through intermediate steps, round only the final result, and
  recompute any learner number before confirming or correcting it.

## Evaluation

- **Arms:** baseline (`v3`), A+B, and A+B+C. Each arm needs a runtime restart,
  and dev logs must show the expected `systemPromptHash`.
- **Corpus:** the frozen development and control cases of
  `tutor-attribution-v2.json`. The earlier reserved cases are spent. A separate
  author writes four fresh reserved cases after the candidate is frozen.
- **Gate:** complete valid coverage, zero development overclaims, fewer
  reserved failures than baseline, zero incorrect numeric claims, and no new
  control failures.
- **Budget:** a fresh ledger with two repeats per arm, capped at 200 turns.
- **Receipts:** raw transcripts and scores stay in the gitignored local
  receipts folder. Only aggregate outcomes are recorded here.

## Historical next steps before candidate 1

1. Implement A, B and C with unit tests for the evidence detector.
2. Freeze the candidate and record template hashes.
3. Have the separate author write the fresh reserved cases.
4. Run the three arms, score them, and get an independent score review.
5. If the candidate passes, verify chat in the browser and open a draft PR.
   Otherwise record the outcome here and in the v2 evaluation.

## Outcome

Candidate 1 (commit `28c27cc9ef`, evidence note + feedback check + precision
rule) ran against `v3` on the frozen development and control cases plus four
fresh reserved cases, two repeats per arm. The A+B arm was not run. The run
used 120 of 200 turns and about 0.26 of 0.5 credits.

| Criterion                          | Baseline  | Candidate 1 |
| ---------------------------------- | --------- | ----------- |
| Complete valid quiz coverage       | 3 invalid | 4 invalid   |
| Development overclaims             | 3         | 0           |
| Reserved failures                  | 6 of 8    | 4 to 6 of 8 |
| Runs with numeric errors           | 2         | 1           |
| New control failures               | —         | 0           |
| English turns answered in German   | 2 of 32   | 5 of 32     |

A quiz run counts as invalid when the reply states the correct option's
content before the learner asks for a hint. Under the looser rule, where only
naming the option letter counts, the counts are 1 and 2. The reserved range
depends on whether the price-below-par reason must appear in the assessed
turn itself.

The candidate removes every development overclaim, and it names pasted-back
work plainly. It still fails the gate:

- The bare-answer sentence makes the Quizzer reveal the answer after the first
  wrong attempt, so the hinted German bond quiz was invalid in both repeats.
- The precision rule did not stop one wrong exponent result (1.043^7), and
  that run then rejected the learner's correct value.
- The reused-factor case still confirms the learner's values without saying
  which part came from the earlier worked example.
- Reserved failures did not clearly fall below baseline.
- English quiz turns switched to German more often. The sample is small, but
  the trailing messages may weaken the reply-language reminder.

The main session scored the arms, and an independent review corrected the
scores above.

## Next candidate

1. Limit the bare-answer rule so it never overrides the Quizzer's hint and
   retry rules.
2. Investigate the language drift before adding more trailing messages, for
   example by merging the feedback check into the language reminder step.
3. Add a calculator tool for exponents and discounting; the prompt rule alone
   is not enough.
4. Repeat the protocol with fresh reserved cases and a new ledger.

## Candidate 2 outcome

Candidate 2 (commit `fb072b5d41`) addressed the list above:

- The bare-answer rule now defers to the quiz hint and retry rules.
- The evidence note, the feedback check and the language reminder form one
  trailing message, with the language reminder last.
- Tutor and Quizzer get a `calculate` tool.

It ran against `v3` with four new reserved cases written blind after the
freeze, two repeats per arm. The baseline reused its development and control
runs from the first round. One candidate request stalled upstream and stopped
the run with an uncertain ledger. With approval, the three missing cases then
ran on a new ledger with a longer request timeout. In total the round used 77
turns and about 0.23 credits.

| Criterion                        | Baseline  | Candidate 2 |
| -------------------------------- | --------- | ----------- |
| Invalid quiz runs                | 5 of 8    | 1 of 8      |
| Development overclaims           | 3         | 0           |
| Reserved failures                | 5 of 8    | 4 of 8      |
| Runs with numeric errors         | 1         | 1           |
| New control failures             | —         | 0           |
| English turns answered in German | 2 of 32   | 3 of 32     |

The candidate no longer reveals quiz answers after a bare answer and confirms
correct learner values that the baseline once "corrected". It still fails the
gate:

- One diversification quiz run states the correct option's content in its
  feedback on the wrong first answer.
- One run states a rounded comparison value as 15,287.61 where the exact
  value is 15,287.60. The model did not use the calculator for that value.
- One annuity run calls the pasted-back text the learner's "summary".
- The reused-factor case still confirms the learner's values without naming
  which factor came from the earlier example.
- All three German replies to English learners come at the final feedback
  turn of a quiz.

The main session scored the arms, and an independent review corrected the
scores above.

## Candidate 3 plan

1. Make the reuse evidence also fire when the learner says they reused a
   value from the earlier example, even when that exact number was not shown.
2. Pin the reply language at the quiz feedback turn, where all remaining
   drift occurs.
3. Require the calculator for every number the reply states, not only for
   learner numbers. Allow several expressions per call so that longer
   calculations stay within the step limit.
4. Have the runner record calculator calls next to the doc-query tool.

## Candidate 3 outcome

Candidate 3 (commit `9df2b8d4c5`) applied items 1 to 3 of the plan above:

- The feedback check treats a value the learner says they took from earlier
  help as supplied, even when the exact number differs.
- The language reminder keeps short replies, such as an option letter, in the
  language of the learner's earlier messages.
- The calculator takes several expressions per call, and the feedback check
  requires it for every number the reply states.

Item 4 was dropped. The runner test file contains synthetic credentials that
the data-hygiene commit hook flags, so calculator calls were counted from the
dev log instead. The log shows 24 steps that called the calculator.

The round used four new blind reserved cases, two repeats per arm, and a new
ledger with a 150-second request timeout. It used 76 turns and about 0.19
credits. The baseline reused its development and control runs from round 1.

| Criterion                        | Baseline | Candidate 3   |
| -------------------------------- | -------- | ------------- |
| Invalid quiz runs                | 5 of 6   | 3 of 6        |
| Development overclaims           | 3        | 2             |
| Reserved failures                | 8 of 8   | 4 to 5 of 8   |
| Runs with numeric errors         | 2        | 0             |
| New control failures             | —        | 0             |
| English turns answered in German | 1 of 32  | 4 of 32       |

Earlier rounds counted 8 quiz runs. There are 3 quiz cases with 2 repeats, so
the correct count is 6.

What improved:

- No numeric errors. The baseline twice called a rounded value exact.
- The reused-factor case now names the factor taken from the example and
  credits only the new step.
- Reserved failures fell clearly below the baseline for the first time.

It still fails the gate:

- Two diversification runs and one bond run state the correct option's
  content in feedback on the wrong first answer.
- One copied-bond run credits a pasted sentence as the learner's own
  conclusion, and another endorses the learner's confidence.
- German replies to English learners rose. One quiz run switched to German
  from its second turn. The local course passages are bilingual, which may
  pull the reply language.
- The bare-answer case still does not ask for the learner's working.
- The reused-factor case is weak: no arm printed the reused factor before the
  learner claimed to reuse it.

The main session scored the arms, and an independent review corrected the
scores above.

## Next candidate (proposed)

1. Test the language drift against English-only retrieval passages, to
   separate the bilingual corpus from the prompt.
2. Move the quiz hint rule into the Quizzer's own trailing step, so that
   feedback on a wrong first answer cannot state the correct option's
   content.
3. Tell the Tutor that a pasted sentence counts as supplied help even when
   the learner presents it as a conclusion.
4. Rewrite the reused-factor reserved case so that the factor appears in an
   earlier assistant turn.

## Calculator split

The calculator now ships alone as draft PR #6364 (commit `ed06e96fdd`, based
on `v3`). It adds the `calculate` tool to the Tutor and Quizzer and a
precision reminder before the language reminder at the end of every step.
The reminder must not override the quiz hint rules. Without that guard, both
bond-quiz runs revealed the answer after a wrong first attempt. In one run the
model still stated a wrong quotient after calling the tool, so the calculator
reduces numeric errors without eliminating them.

## Candidate 4 outcome

Candidate 4 (commit `9c96369644`) builds on the calculator and applies items
2 and 3 of the proposal above:

- The Quizzer gets its own trailing feedback check. Feedback on a wrong first
  attempt must not state the correct option or its content.
- The Tutor check treats pasted text as supplied help even when the learner
  presents it as a conclusion. It no longer endorses stated confidence, and
  it asks for working when only a bare answer is given.

A blind author wrote four new reserved cases after the candidate was frozen.
In one of them, the reused factor appears in an earlier assistant turn
(item 4). The round used 100 turns and about 0.25 credits. The baseline
reused its development and control runs from round 1.

| Criterion                        | Baseline | Candidate 4 |
| -------------------------------- | -------- | ----------- |
| Invalid quiz runs                | 4 of 6   | 0 of 6      |
| Development overclaims           | 3        | 0           |
| Reserved failures                | 7 of 8   | 2 of 8      |
| Runs with numeric errors         | 2        | 0           |
| New control failures             | —        | 0           |
| English turns answered in German | 2 of 32  | 3 of 32     |

Numeric errors use the established 0.01 tolerance. One candidate run stated an
intermediate product 0.0016 CHF off, with the rounded result correct.

The remaining candidate failures are one German reply to an English learner
and one reply that does not confirm the learner's first value.

Language diagnostic (item 1): the same candidate with English-only course
passages produced 3 German turns of 24, the same as the bilingual passages on
those cases. The bilingual corpus is therefore not necessary for the drift.
Across both arms, 5 of 8 copied-content Tutor feedback turns were answered in
German, against 1 of 48 other English turns and 0 of 4 for the baseline on the
same turns. The candidate's trailing feedback text likely causes this drift,
but the transcripts cannot show the mechanism.

The main session scored the arms, and an independent review corrected the
scores above.

## Language drift fix

The evidence note now says that repeated material still shows the learner's
language. When the message has no clearer language signal, the reply follows
the repeated material or the learner's earlier messages, never the course
material. The note appears only when the server detects reuse, so other turns
are unchanged.

A rerun of the two affected English cases, with two repeats each, answered all
4 feedback turns in English, against 5 of 8 before. Attribution stayed
correct: each reply names the restated help, declines to record mastery from
a confidence statement, and sets a task. The rerun used 8 turns.

## Historical next steps after the language fix

1. Review the stacked draft PR on top of the calculator PR #6364.
2. Watch production transcripts for German replies after pasted help, since
   the rerun covered only two cases.
