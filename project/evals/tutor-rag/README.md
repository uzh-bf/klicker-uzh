# TutorBench Retrieval Cases

These cases evaluate the deployed tutor through `apps/chat-api` retrieval.
They intentionally do not include full source snippets in prompt-facing fields.
Expected concepts and citation terms live in metadata for scoring.

## Current Validation Path

Live LightRAG and Milvus integrations are not available in this branch yet. The
next valid step is fixture-backed retrieval that matches the contract in
`retrieval-contract.md`.

Fixture-backed runs should:

1. Start local `apps/chat-api`.
2. Start a local MCP fixture server that returns finance evidence matching
   `retrieval-contract.md`.
3. Run real mode dry-run and inspect prompts for absence of source snippets.
4. Run the three-case smoke against an approved model.
5. Store a run note in this folder with command, output path, model, fixture
   version, observed citations, and blockers.
6. Mark retrieval evidence as `retrievalTraceStatus: "fixture"`.

This validates tutor/RAG plumbing, policy behavior, and evaluation mechanics. It
does not validate live finance corpus grounding.

## Future Live E2E Validation

Before treating a run as valid:

1. Confirm the real retrieval integration is available to `apps/chat-api`.
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
runner. Until the runner or service emits trace data, it should distinguish
fixture-backed retrieval from missing live traces and record one of:

- `retrievalTraceStatus: "fixture"`
- `retrievalTraceStatus: "real"`
- `retrievalTraceStatus: "unavailable"`
