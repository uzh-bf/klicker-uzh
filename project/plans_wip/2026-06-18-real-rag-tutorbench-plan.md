# TutorBench Retrieval Plan

Date: 2026-06-18

Status: implementation complete, one-case tutor/RAG plumbing e2e passed; live
LightRAG and Milvus integrations are not available in this branch, so the next
slice is contract-first and fixture-backed

Branch: `codex/tutor-research-mastra-plan`

Base branch: `codex/mastra-chat-openrouter-smoke`

## Goal

Run TutorBench against real Klicker tutor behavior:

- real `apps/chat-api` tutor runtime;
- real Mastra tutor path;
- real course-grounded RAG once the retrieval integrations are available;
- fixture-backed retrieval validation until those integrations are available;
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
- Finance retrieval case pack added under `project/evals/tutor-rag/`.
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
- Direct LightRAG / Milvus access in this worktree.
- Executable handoff from the retrieval contract to the service owner who will
  expose the real course retrieval path.
- Finance fixture MCP responses that match the future retrieval trace contract.
- Structured retrieval trace exposed by `apps/chat-api`.
- Semantic judging for diagnosis, hint quality, grounding, and leakage.
- Multi-turn TutorBench cases.
- Full three-case e2e against live finance retrieval; current local MCP stub
  contains algorithm fixtures, so it validates plumbing but not finance
  grounding.

## Future Live Run Requirements

These requirements apply after the retrieval integrations are exposed to this
branch or to a shared validation environment. They are not the next local slice.

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

Current constraint:

- LightRAG and Milvus integrations are not available to this branch/agent yet.
- Do not block the next slice on provisioning real finance KB data.
- Do not claim final finance grounding quality from the current local MCP stub.
- Use fixture-backed MCP responses to validate tutor behavior, trace handling,
  and evaluation mechanics until the real retrieval service is reachable.

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

## Slice 6: Retrieval Contract And Fixture Validation

Define the boundary the future retrieval integration must satisfy without
requiring the integration to exist locally.

Add contract note:

```text
project/evals/tutor-rag/retrieval-contract.md
```

Minimum contract:

- request fields: chatbot ID, participant/course scope if available, query,
  top-k, and selected mode;
- response fields: evidence IDs, source/chunk titles, source URI or stable
  source label, text snippet, score if available, citation marker, and retrieval
  trace ID;
- privacy fields: whether retrieved content can be sent to the selected model;
- eval fields: expected concept tags and citation labels needed for scoring;
- failure states: no results, weak retrieval, unauthorized, timeout, malformed
  response.

Fixture behavior:

- create finance fixture responses for WACC, CAPM, and bond yield cases;
- make the local MCP stub emit the same fields the contract requires;
- record `retrievalTraceStatus: "fixture"` rather than pretending traces are
  from live LightRAG/Milvus;
- run all three cases against the real tutor/model path using fixture-backed
  retrieval.

Acceptance:

- eval output distinguishes `inline`, `fixture`, and future `real` retrieval;
- per-case JSONL captures the fixture evidence IDs and citation labels;
- tutor does not receive inline `sourceMaterial` in fixture mode;
- result notes clearly say the run validates tutor/RAG plumbing and pedagogy,
  not live finance corpus grounding.

## Slice 7: Retrieval Integration Handoff

Prepare a concise handoff for the LightRAG/Milvus integration owner.

Handoff content:

- expected MCP endpoint shape and auth/header requirements;
- request/response examples from the fixture server;
- trace fields TutorBench will consume;
- required stable IDs for chatbot, course, participant, and model;
- egress and privacy assumptions for retrieved course context;
- smoke command to run once a real endpoint exists;
- expected artifacts to return: JSONL, service logs, and one human run note.

Acceptance:

- integration owner can implement or expose the service without reading the full
  tutor plan;
- when a real endpoint exists, the only expected evaluator change is switching
  retrieval mode/configuration from fixture to real.

## Slice 8: Future Full E2E Validation

Run sequence:

1. Confirm the real retrieval service is reachable from `apps/chat-api`.
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
- Root hooks can still be noisy on generated-output drift; use focused checks
  plus PR CI for this branch.

## Next Steps

1. Land or keep stacking on the Mastra baseline branch until PR #5129 is green
   against `codex/mastra-chat-openrouter-smoke`.
2. Use `project/evals/tutor-rag/retrieval-contract.md` as the fixture and
   integration boundary for request, response, trace, privacy, and failure-state
   fields.
3. Upgrade the local MCP stub from generic algorithm fixtures to finance
   fixtures for WACC, CAPM, and bond/yield cases that match the contract.
4. Extend the generic TutorBench runner/result rows to distinguish
   `retrievalTraceStatus: "inline" | "fixture" | "real" | "unavailable"`.
5. Run the three-case fixture-backed TutorBench smoke against the real
   `apps/chat-api` tutor path and an approved model, then save JSONL plus a run
   note that clearly scopes the result to tutor/RAG plumbing and pedagogy.
6. Add semantic judging on fixture-backed outputs if useful, but keep scores
   separate from any future live-retrieval claims.
7. Prepare the retrieval integration handoff for whoever can expose the real
   LightRAG/Milvus path: endpoint shape, auth/header needs, trace fields,
   stable fixture IDs, smoke command, and expected artifacts.
8. Only after a reachable real retrieval endpoint exists, switch the same cases
   from fixture to real mode and evaluate finance grounding quality.
