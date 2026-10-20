# Explainer closing-check corpus

This authored development corpus measures when the Explainer ends an answer
with a check question, what kind of check it asks, and how it responds when the
student answers one. It uses the existing version-1 Klicker trajectory format;
there is no new scorer or judge configuration.

The case `id` prefix encodes the arm, because the corpus format rejects extra
fields:

| Prefix           | Cases | Expected behavior                                                           |
| ---------------- | ----: | --------------------------------------------------------------------------- |
| `skip-`          |     4 | Lookup, definition, short follow-up or revision: no closing check           |
| `explain-`       |     3 | Conceptual explanation: at most one check, preferably apply/predict/restate |
| `check-answered` |     1 | Student answers a check: brief, specific feedback first                     |

All cases use `group: development`, supply only synthetic finance prompts and
need no retrieved course material to be assessable. Each case requires a fresh
thread. No model responses, receipts or results are bundled.

## Before/after comparison

The trajectory arm is a label only; it does not select a prompt. Capture the
`baseline` arm from a chat app running the base branch and the `candidate` arm
from a chat app running the change, against the same model, with one shared
version-2 budget file:

```bash
node evaluation/run-tutor-trajectories.mjs \
  --corpus evaluation/data/explainer-check/corpus.json \
  --arm baseline --repeats 2 \
  --output project/_local/explainer-check-baseline.jsonl \
  --budget-file "$KLICKER_EVAL_BUDGET_FILE"
```

Repeat with `--arm candidate` after switching the running app. Two repeats
submit 22 turns per arm (44 in total), within the default 120-turn budget.
A paid capture still needs its own approval and spend cap.

## Scoring

For each assessed turn, record whether the answer ends with a check question
and classify it as recall (asks for a fact the answer stated) or higher-order
(apply to a new case, predict, or explain in one's own words). Report per arm:

- check rate on `skip-` turns, which should fall to zero;
- check rate on `explain-` turns, which may stay below one;
- the share of higher-order checks among `explain-` checks;
- the `check-answered` rubric, scored 2 satisfied, 1 partly, 0 violated,
  U missing evidence.

Report counts per arm. Do not merge the arms into one improvement percentage,
and record an absent answer as unassessed, never as a pass.
