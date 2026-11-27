# Tutor first-turn explanation-check corpus

This authored development corpus measures how the Tutor responds when a student
asks it to explain a new concept without showing an attempt: whether it
explains first and ends with exactly one check question, what kind of check it
asks, when it leaves the check out, and how it responds when the student
answers one. It uses the existing version-1 Klicker trajectory format; there is
no new scorer or judge configuration.

The case `id` prefix encodes the arm, because the corpus format rejects extra
fields:

| Prefix           | Cases | Expected behavior                                                            |
| ---------------- | ----: | ---------------------------------------------------------------------------- |
| `skip-`          |     4 | Definition, listen-first request, follow-up or shown understanding: no check |
| `explain-`       |     2 | New-concept explanation: explain first, then one apply/predict/restate check |
| `attempt-`       |     1 | Student states a misconception: diagnose it from the student's reasoning     |
| `check-answered` |     1 | Student answers a check: brief, specific feedback first                      |

All cases use `group: development` and supply only synthetic finance prompts.
The `explain-diversification-variance-figure` case asks for a formula and a
figure from the course script. Its rubric accepts the formula and a figure only
from retrieved course material, or an open statement that the material lacks
them, and never a formula derived from general knowledge or an invented figure,
page or script reference. The other cases need no retrieved
course material to be assessable. Each case requires a fresh thread. No model
responses, receipts or results are bundled.

The cases `explain-diversification-variance-figure`,
`explain-capm-required-return`, `skip-lookup-present-value`,
`skip-listen-first-duration` and `attempt-perfect-correlation-misconception`
form a shared set with byte-identical messages, so that alternative Tutor
first-turn designs can be compared on the same prompts.

## Before/after comparison

The trajectory arm is a label only; it does not select a prompt. Capture the
`baseline` arm from a chat app running the base branch and the `candidate` arm
from a chat app running the change, against the same model, with one shared
version-2 budget file:

```bash
node apps/chat/scripts/run-tutor-trajectories.mjs \
  --corpus apps/chat/evaluation/tutor-first-turn-explain-check/corpus.json \
  --arm baseline --repeats 1 \
  --output project/_local/tutor-first-turn-explain-check-baseline.jsonl \
  --budget-file "$KLICKER_EVAL_BUDGET_FILE"
```

Repeat with `--arm candidate` after switching the running app. One repeat
submits 11 turns per arm. Each turn makes about two guarded model calls, and
the guard reserves the full context cost for each call, about US$0.107 for
GPT-6 Luna. One repeat of both arms therefore reserves about US$4.71, within
the default US$5 budget; further repeats need the extended budget option. A
paid capture still needs its own approval and spend cap.

## Scoring

For each assessed turn, record whether the answer ends with a check question,
whether it asks any question before explaining, and classify a check as recall
(asks for a fact the answer stated) or higher-order (apply to a new case,
predict, or explain in one's own words). Report per arm:

- check rate on `skip-` turns, which should fall to zero;
- check rate on `explain-` turns, which may stay below one;
- the share of higher-order checks among `explain-` checks;
- the `attempt-` and `check-answered` rubrics, scored 2 satisfied, 1 partly,
  0 violated, U missing evidence.

Report counts per arm. Do not merge the arms into one improvement percentage,
and record an absent answer as unassessed, never as a pass.
