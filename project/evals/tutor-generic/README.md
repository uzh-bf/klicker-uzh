# Generic TutorBench

This folder contains domain-neutral tutor-quality cases. It complements
MathTutorBench:

- MathTutorBench compatibility stays in `project/evals/mathtutorbench/`.
- Generic TutorBench cases evaluate the deployed tutor runtime as a tutor, not
  just a model answering benchmark prompts.

## Run

Dry-run prompt and output layout:

```bash
pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_generic_tutorbench.ts \
  --dry-run \
  --run-id generic-tutorbench-dry
```

Runtime run against a local `apps/chat-api` server:

```bash
APP_SECRET=abcd \
TUTORBENCH_CHAT_API_BASE_URL=http://127.0.0.1:3315 \
TUTORBENCH_SELECTED_MODEL=deepseek-v4-pro \
TUTORBENCH_SELECTED_MODE=tutor \
pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_generic_tutorbench.ts \
  --run-id generic-tutorbench-smoke \
  --max-cases 3
```

Real RAG run against a chatbot with indexed course material:

```bash
APP_SECRET=abcd \
TUTORBENCH_CHAT_API_BASE_URL=http://127.0.0.1:3315 \
TUTORBENCH_CHATBOT_ID=<real-chatbot-id> \
TUTORBENCH_PARTICIPANT_ID=<participant-with-access> \
TUTORBENCH_SELECTED_MODEL=deepseek-v4-pro \
TUTORBENCH_SELECTED_MODE=tutor \
pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_generic_tutorbench.ts \
  --cases project/evals/tutor-rag/cases.json \
  --rag-mode real \
  --run-id rag-tutorbench-smoke \
  --max-cases 3
```

Outputs are written under
`project/evals/results/<run-id>/generic-tutorbench/`:

- `manifest.json`: runtime config and command metadata.
- `cases.jsonl`: prompt, response, finish metadata, and score breakdown per
  case.
- `summary.json`: aggregate deterministic scores by domain.

## Scoring

The runner intentionally separates deterministic checks from semantic review.
This first harness covers the student-facing tutor-runtime mode. Hidden
diagnostic probes and solver-competence probes should stay in separate eval
modes so they do not weaken the production answer-leakage policy.

`--rag-mode inline` injects `sourceMaterial` into the prompt for controlled
fixture runs. `--rag-mode real` omits source snippets and relies on the actual
chat-api retrieval path. Real mode requires explicit chatbot and participant
IDs for non-dry runs when cases define expected retrieval or citation keywords.

Deterministic checks include:

- question count;
- sentence count;
- final-answer leakage when forbidden;
- coarse language constraint;
- citation presence when required;
- optional expected/forbidden response keyword checks from case metadata.
- optional RAG evidence checks from `expectedRetrievalKeywords`,
  `expectedCitationKeywords`, and `forbiddenCitationMarkers` metadata.

Rubric criteria that cannot be scored robustly with rules are marked
`manual_review` and excluded from the deterministic aggregate. This keeps the
summary honest: a high deterministic score is not a full expert judgment.

## Case Format

The schema is defined in
`project/evals/mathtutorbench/generic_tutor_case.schema.json`.
