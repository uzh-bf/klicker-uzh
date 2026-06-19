# Real RAG TutorBench Cases

These cases evaluate the deployed tutor through real `apps/chat-api` retrieval.
They intentionally do not include full source snippets in prompt-facing fields.
Expected concepts and citation terms live in metadata for scoring.

## Required E2E Validation

Before treating a run as valid:

1. Start local stack with real seeded or staging course data.
2. Confirm `TUTORBENCH_CHATBOT_ID` points to a chatbot with indexed course
   artifacts.
3. Confirm `TUTORBENCH_PARTICIPANT_ID` can access that chatbot.
4. Run real mode dry-run and inspect prompts for absence of source snippets.
5. Run at least one real case against the local chat-api runtime.
6. Run the three-case smoke against `deepseek-v4-pro` only after external model
   data egress approval.
7. Store a run note in this folder with command, output path, model, chatbot ID,
   participant ID, observed citations, and blockers.

## Commands

Dry-run:

```bash
pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_generic_tutorbench.ts \
  --cases project/evals/tutor-rag/cases.json \
  --rag-mode real \
  --dry-run \
  --run-id rag-tutorbench-dry
```

Runtime:

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
  --run-id rag-tutorbench-deepseek-v4-pro \
  --max-cases 3
```

## Current Limitation

The chat-api stream does not yet expose a structured retrieval trace to the eval
runner. The runner therefore records `retrievalTraceStatus: "unavailable"` and
scores visible response evidence only: citation markers plus expected retrieval
and citation keyword coverage.
