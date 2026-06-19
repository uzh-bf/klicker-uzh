# Real RAG TutorBench Plan

Date: 2026-06-18

Status: implementation complete, one-case real e2e passed; full finance RAG
grounding still needs live finance KB data

Branch: `codex/tutor-research-mastra-plan`

Base branch: `codex/mastra-chat-openrouter-smoke`

## Goal

Run TutorBench against real Klicker tutor behavior:

- real `apps/chat-api` tutor runtime;
- real Mastra tutor path;
- real course-grounded RAG;
- real model, first target `deepseek-v4-pro`;
- reproducible eval artifacts under `project/evals/results/`;
- scoring that separates deterministic guard checks from semantic tutor-quality
  review.

## Current State

Done:

- MathTutorBench prompt/runtime harness exists.
- OpenAI-compatible chat-api proxy exists for upstream MathTutorBench.
- Generic TutorBench schema and sample cases exist.
- Generic TutorBench runner can call `apps/chat-api` directly.
- Dry-run validates prompt, output, and scoring layout.
- Tutor prompt includes safe MathTutorBench pedagogy deltas.
- `--rag-mode inline|real` implemented in the generic runner.
- Real RAG finance case pack added under `project/evals/tutor-rag/`.
- RAG evidence capture added for visible citations and expected keyword
  coverage.
- Real-mode dry-run passed with no inline source snippets in prompts.
- Local chat-api and local KB MCP stub were started and reached for e2e setup
  validation.
- One-case real e2e ran through `apps/chat-api` plus OpenRouter
  `deepseek-v4-pro`.
- MCP stub logs confirmed chat-api called the RAG endpoint with the expected
  chatbot header.
- Validation note recorded in
  `project/evals/tutor-rag/2026-06-19-rag-tutorbench-validation.md`.

Missing:

- Real course/chatbot fixture IDs confirmed for repeatable local runs.
- Structured retrieval trace exposed by `apps/chat-api`.
- Semantic judging for diagnosis, hint quality, grounding, and leakage.
- Multi-turn TutorBench cases.
- Full three-case e2e against live finance RAG; current local MCP stub contains
  algorithm fixtures, so it validates plumbing but not finance grounding.

## Run Requirements

Runtime:

```bash
APP_SECRET=<chat-api app secret>
TUTORBENCH_CHAT_API_BASE_URL=http://127.0.0.1:<chat-api-port>
TUTORBENCH_CHATBOT_ID=<real chatbot id>
TUTORBENCH_PARTICIPANT_ID=<participant with access>
TUTORBENCH_SELECTED_MODEL=deepseek-v4-pro
TUTORBENCH_SELECTED_MODE=tutor
pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_generic_tutorbench.ts \
  --run-id rag-tutorbench-deepseek-v4-pro \
  --max-cases 3
```

Data:

- Chatbot has real course artifacts attached.
- Artifacts are indexed into the retrieval backend used by `apps/chat-api`.
- Participant can access the course/chatbot.
- Tutor mode uses retrieval path, not just base prompt.
- External model data egress is approved before `deepseek-v4-pro` run, or a
  local/private OpenAI-compatible model endpoint is configured.

## Slice 1: Real RAG Mode

Add runner option:

```bash
--rag-mode inline|real
```

Behavior:

- `inline`: keep current behavior; inject `sourceMaterial` into prompt.
- `real`: omit `sourceMaterial`; rely on real chat-api retrieval.
- Persist `ragMode` in manifest and per-case rows.
- Fail fast if `real` mode cases contain required source expectations but no
  chatbot/runtime IDs are configured.

Acceptance:

- Dry-run works for both modes.
- Runtime call in `real` mode sends no inline source snippets.
- JSONL records enough config to reproduce run.

## Slice 2: Real Course Cases

Add case pack:

```text
project/evals/tutor-rag/cases.json
```

Start with finance cases:

- WACC concept misconception.
- CAPM beta / expected-return misconception.
- Bond price / yield direction misconception.

Each case defines:

- learning objective;
- student attempt;
- expected retrieved concepts;
- expected citation keywords;
- forbidden hallucinated citation markers;
- leakage constraints;
- rubric weights.

Acceptance:

- Cases do not include full source text in prompt-facing fields.
- Cases name expected course concepts in metadata only.
- Cases run through generic runner with `--cases project/evals/tutor-rag/cases.json`.

## Slice 3: Evidence Capture

Persist evidence in per-case JSONL:

- response text;
- finish metadata;
- selected model;
- selected mode;
- citation markers found in response;
- expected retrieval keyword coverage;
- expected citation keyword coverage;
- optional runtime debug IDs if chat-api exposes them.

If chat-api does not expose retrieval trace yet:

- score visible citation/grounding markers only;
- record `retrievalTraceStatus: "unavailable"`;
- add follow-up to expose retrieval events from tutor runtime.

Acceptance:

- Summary reports deterministic RAG checks separately from tutor checks.
- Missing retrieval trace is explicit, not silent.

## Slice 4: Semantic Judge

Add optional judge mode after first real outputs:

```bash
TUTORBENCH_JUDGE_MODEL=<model>
TUTORBENCH_JUDGE_BASE_URL=<openai-compatible-url>
--judge semantic
```

Judge scores:

- issue diagnosis;
- pedagogical move fit;
- scaffold quality;
- correctness;
- grounding against expected concepts;
- answer leakage.

Rules:

- Judge receives case metadata and tutor response.
- Judge must not receive private course source unless data egress is approved.
- Deterministic scores remain separate from judge scores.

Acceptance:

- JSONL includes raw judge JSON.
- Summary includes deterministic average and semantic average separately.
- Invalid judge JSON marks case `manual_review`.

## Slice 5: Multi-Turn Cases

Extend runner input to support `turns`:

- first student turn;
- tutor response captured;
- follow-up student turn;
- final tutor response scored.

Use for:

- hint escalation;
- feedback uptake;
- final-answer requests after effort;
- correction after misconception repair.

Acceptance:

- Single-turn cases still work.
- Multi-turn run stores each turn and final aggregate score.

## Slice 6: Full E2E Validation

Run sequence:

1. Start local stack with real seeded data.
2. Verify chatbot/course/participant access.
3. Run `--rag-mode real --dry-run`.
4. Run one real case against local/private model if available.
5. Run three-case smoke against `deepseek-v4-pro` after egress approval.
6. Inspect JSONL responses manually.
7. Add run note under `project/evals/tutor-rag/<date>-run.md`.

Acceptance:

- At least one response cites or uses real course material.
- No inline source text is present in prompts for real RAG mode.
- No final-answer leakage on hint-only cases.
- Output path and command are documented.

## Risks

- Retrieval trace may not be exposed by chat-api stream.
- Seeded local artifacts may not match desired finance cases.
- External model run sends prompts, tutor policy, and retrieved context to
  provider.
- Keyword grounding can miss good paraphrases; semantic judge needed.
- Existing pre-commit syncpack mismatch can block normal commits.

## Next Steps

1. Land or keep stacking on the Mastra baseline branch until PR #5129 is green
   against `codex/mastra-chat-openrouter-smoke`.
2. Keep the current CI fixes narrow:
   - `check-types.yml` builds `packages/chat-engine` before checking
     `apps/chat-api`;
   - syncpack allows the intentional zod v3/v4 split between existing runtimes
     and the Mastra engine.
3. Provision real finance/course data through the production retrieval path:
   LightRAG knowledge graph plus Milvus chunks attached to a real chatbot and
   accessible participant.
4. Replace the local KB MCP stub with the real `doc_query` service and record
   stable chatbot, course, participant, and model configuration in the run note.
5. Expose structured retrieval traces from `apps/chat-api` / MCP / RAG into
   TutorBench result rows: retrieval backend, query, evidence IDs, chunk titles,
   citation IDs, and trace availability.
6. Run the full three-case real-RAG TutorBench smoke against an approved real
   model, then inspect and save JSONL plus a human run note under
   `project/evals/tutor-rag/`.
7. Add the semantic judge only after real retrieval traces exist, scoring
   diagnosis, scaffold fit, ZPD/directness, grounding, citation fidelity, and
   answer leakage separately from deterministic checks.
8. Use real chats, eval failures, LightRAG concepts, and Milvus chunks to
   generate optional guidance candidates asynchronously. Do not require
   lecturers to author upfront misconception lists, hint ladders, or seed tutor
   artifacts.
