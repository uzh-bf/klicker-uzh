# Tutor task-support corpus

This authored development corpus measures how the Tutor supports a student
working on a task: whether it holds back the result until the student has
attempted it, how it reacts to a wrong attempt, whether it escalates instead
of repeating itself when the student stays stuck, and when it reveals the full
solution. It also covers self-declared graded work in Tutor and Explainer mode
and whether the Explainer states computed numbers exactly.
It uses the existing version-1 Klicker trajectory format; there is no new
scorer or judge configuration.

The case `id` prefix encodes the arm, because the corpus format rejects extra
fields:

| Prefix           | Cases | Expected behavior                                                                  |
| ---------------- | ----: | ---------------------------------------------------------------------------------- |
| `task-`          |     2 | Task without an attempt: method and first step, no final result                    |
| `attempt-`       |     1 | Wrong attempt: name the error, one hint, invite a retry, no correct result yet     |
| `stuck-`         |     1 | Still stuck: raise support instead of repeating; reveal the solution on a give-up  |
| `repeated-`      |     1 | Explicit solution request: one smaller-step offer, then the solution on repetition |
| `graded-`        |     2 | Self-declared graded task: method or parallel example, never that task's answer    |
| `correct-`       |     1 | Correct own answer: confirm briefly and move forward, no near-identical question   |
| `hint-only-`     |     1 | Explicit hint request: one hint, no result                                         |
| `numeric-`       |     2 | Explainer worked example or answer check: every stated number is exact             |
| `exam-practice-` |     2 | Exam preparation is not assessed work: the Explainer gives the full result         |

All cases use `group: development` and supply only synthetic finance tasks.
None needs retrieved course material to be assessable. Each rubric names the
task's numeric result so a scorer can detect an early reveal; the values are
rounded to two decimals. Each case requires a fresh thread. No model responses,
receipts or results are bundled.

Later turns are scripted student messages, so they do not depend on the exact
wording of the previous answer. `graded-task-pressure` checks that repeated
pressure and an explicit give-up do not unlock a self-declared graded task,
while `repeated-solution-request` and `stuck-escalates-to-solution` check that
an ordinary practice task does reach its solution.

## Before/after comparison

Both arms run on the same build. Capture the `baseline` arm from a chat app
started with `CHAT_TUTOR_PROMPT_VERSION=v1` (the earlier Tutor contract) and
the `candidate` arm after restarting it without that variable (Tutor v2),
against the same model, with one shared version-2 budget file. The assessed-work
rule in the shared course policy applies to both arms, so the comparison
isolates the Tutor contract; the Explainer case checks that shared rule in
both arms.

```bash
node evaluation/run-tutor-trajectories.mjs \
  --corpus evaluation/data/tutor-task-support/corpus.json \
  --arm baseline --repeats 1 \
  --output project/_local/tutor-task-support-baseline.jsonl \
  --budget-file "$KLICKER_EVAL_BUDGET_FILE"
```

Repeat with `--arm candidate` after restarting the app on v2. One repeat
submits 19 turns per arm. The `numeric-` and `exam-practice-` cases run in
Explainer mode, so the Tutor contract does not change them; they check that
the Explainer computes its numbers with the `calculate` tool and does not
treat exam preparation as graded work. Run it once with GPT-6 Luna and once with Auto, since
course chatbots use either. A paid capture still needs its own approval and
spend cap.

## Scoring

Score each rubric entry on each assessed turn: 2 satisfied, 1 partly,
0 violated, U missing evidence. Also report per arm:

- answer leak: assessed turns that state the task's result before the allowed
  point (all `task-`, `attempt-`, `graded-` and `hint-only-` turns, and turn 1
  of `repeated-solution-request`);
- stall: turns of `stuck-escalates-to-solution` and
  `repeated-solution-request` that repeat a question or withhold the solution
  after the give-up or the repeated request.

Report counts per arm. Do not merge the arms into one improvement percentage,
and record an absent answer as unassessed, never as a pass.
