# Real RAG TutorBench Validation

Date: 2026-06-19

Goal: validate the real RAG TutorBench path with required e2e checks.

## Implementation Validated

- `scripts/eval/run_generic_tutorbench.ts` supports `--rag-mode inline|real`.
- `--rag-mode real` omits `sourceMaterial` from prompts and relies on the
  chat-api retrieval path.
- Per-case JSONL rows include:
  - `ragMode`;
  - visible citation markers;
  - expected retrieval keyword coverage;
  - expected citation keyword coverage;
  - forbidden citation hits;
  - `retrievalTraceStatus`.
- Summary JSON includes separate RAG evidence aggregates.
- RAG case pack lives in `project/evals/tutor-rag/cases.json`.

## Dry-Run Command

```bash
pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_generic_tutorbench.ts \
  --cases project/evals/tutor-rag/cases.json \
  --rag-mode real \
  --dry-run \
  --run-id rag-tutorbench-dry \
  --max-cases 3
```

Result:

```text
runId: rag-tutorbench-dry
ragMode: real
caseCount: 3
retrievalTraceStatus: unavailable
averageRetrievalKeywordCoverage: 0
averageCitationKeywordCoverage: 0
forbiddenCitationHitCount: 0
```

Prompt inspection:

```text
rag-finance-wacc-001: sourceMaterial omitted, retrieval instruction present
rag-finance-capm-beta-001: sourceMaterial omitted, retrieval instruction present
rag-finance-bond-yield-001: sourceMaterial omitted, retrieval instruction present
```

Generated artifacts:

```text
project/evals/results/rag-tutorbench-dry/generic-tutorbench/
```

The result directory is gitignored.

## Local Service E2E Setup Attempt

Started local KB MCP stub:

```bash
PROTO_MCP_PORT=1417 pnpm --dir prototype/mastra-chat exec tsx src/stub-mcp.ts
```

Reachability check:

```text
GET http://127.0.0.1:1417/mcp -> JSON-RPC error for missing session id
```

This confirms the MCP HTTP endpoint was reachable. The stub logs also recorded
the request. Limitation: this prototype stub contains algorithm-course fixtures,
not finance-course fixtures, so it cannot validate the finance RAG cases for
grounding quality.

Started `apps/chat-api`:

```bash
PORT=3315 pnpm --dir apps/chat-api exec tsx src/index.ts
```

Configured runtime:

- `APP_SECRET=abcd`
- local PostgreSQL `DATABASE_URL`
- `OPENAI_BASE_URL=https://openrouter.ai/api/v1`
- `CHAT_MODEL_REGISTRY_JSON` with `deepseek-v4-pro`
- `CHAT_OPENAI_STORE_RESPONSES=false`
- `CHAT_TUTOR_EVENT_LOGGING_ENABLED=0`

Health check:

```text
GET http://127.0.0.1:3315/health -> {"ok":true}
```

## Real Model E2E

After explicit OpenRouter approval, ran one real chat-api case against
`deepseek-v4-pro`:

```bash
APP_SECRET=abcd \
TUTORBENCH_CHAT_API_BASE_URL=http://127.0.0.1:3315 \
TUTORBENCH_CHATBOT_ID=8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f \
TUTORBENCH_PARTICIPANT_ID=6f45065c-667f-4259-818c-c6f6b477eb48 \
TUTORBENCH_SELECTED_MODEL=deepseek-v4-pro \
TUTORBENCH_SELECTED_MODE=tutor \
pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_generic_tutorbench.ts \
  --cases project/evals/tutor-rag/cases.json \
  --rag-mode real \
  --run-id rag-tutorbench-deepseek-v4-pro-e2e \
  --max-cases 1 \
  --timeout-ms 180000
```

Local setup notes:

- Local DB did not have the temporary tutor chatbot fixture, so a minimal local
  fixture was seeded before the run.
- Local DB schema was stale for tutor tables, so `prisma db push` was applied
  against the local development database before restarting `apps/chat-api`.
- The MCP stub recorded multiple `/mcp` calls with the expected
  `chatbot-id=8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f` header.
- `apps/chat-api` logs recorded tutor state, verifier preflight, and retrieved
  evidence IDs.

Result:

```text
runId: rag-tutorbench-deepseek-v4-pro-e2e
ragMode: real
caseCount: 1
averageNormalizedScore: 0.5833333333333333
averageRetrievalKeywordCoverage: 0.6
averageCitationKeywordCoverage: 1
forbiddenCitationHitCount: 0
retrievalTraceStatus: unavailable
```

Generated artifacts:

```text
project/evals/results/rag-tutorbench-deepseek-v4-pro-e2e/generic-tutorbench/
```

Manual output inspection:

- Prompt contained no `Source material:` block.
- The tutor response explicitly said it could not retrieve finance course
  materials and that the available context covered algorithms/hash tables.
- The response diagnosed the WACC mistake and asked one follow-up question.
- No forbidden citation marker was used.
- Deterministic citation check failed because no visible course citation marker
  was emitted.

## Validation Status

Passed:

- JSON fixture parse.
- Focused TypeScript check for runner.
- Real-mode dry-run.
- Prompt inspection confirms no inline source snippets.
- Local KB MCP stub reachable.
- Local chat-api reachable.
- One-case real `apps/chat-api` plus OpenRouter `deepseek-v4-pro` e2e run.
- MCP plumbing reached the local KB stub with the expected chatbot header.

Blocked:

- True finance RAG grounding quality, because live finance `doc_query` was not
  available and the available stub has algorithm fixtures.
- Structured retrieval trace, because chat-api does not expose it in the eval
  response yet.

Required for full e2e completion:

1. Live finance-course `doc_query` MCP endpoint, or finance fixture data in a
   local-only MCP stub.
2. Re-run the command above for all three cases and inspect
   `project/evals/results/rag-tutorbench-deepseek-v4-pro-e2e/generic-tutorbench/cases.jsonl`.
3. Expose structured retrieval events from chat-api so the eval can verify
   retrieved document IDs, not only visible response text and logs.
