# MathTutorBench Chat API Runtime Smoke

Date: 2026-06-18

Goal: validate that MathTutorBench can exercise the Klicker tutor runtime through
the chat API path, including the Mastra tutor agent, rather than only evaluating
static prompt files.

## What Was Added

- `scripts/eval/chat_api_openai_proxy.ts`: local OpenAI-compatible proxy for
  MathTutorBench `completion_api` requests.
- `scripts/eval/run_mathtutorbench.ts`: `chat-api-runtime` variant, optional
  `--max-examples`, and a compatibility patch for the upstream `gsm8k` dataset
  config.
- `project/evals/mathtutorbench/README.md`: runtime run instructions and privacy
  caveats.

## Local Setup Used

MathTutorBench was cloned outside the repository:

```bash
git clone https://github.com/eth-lre/mathtutorbench /private/tmp/mathtutorbench
```

A minimal Python environment was created under
`/private/tmp/mathtutorbench/.venv`. Reward-model dependencies were not installed
for this smoke pass.

The local chat runtime was started with an OpenAI-compatible Responses API stub
bound to `127.0.0.1`. No external model endpoint was used in this pass.

## Smoke Runs

Focused plumbing smoke:

```bash
MATHTUTORBENCH_DIR=/private/tmp/mathtutorbench pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_mathtutorbench.ts \
  --run-id chat-api-runtime-smoke \
  --variants chat-api-runtime \
  --tasks scaffolding_generation.yaml \
  --max-examples 2 \
  --provider completion_api \
  --model-args "base_url=http://127.0.0.1:43124/v1,is_chat=true,temperature=0,max_tokens=256" \
  --python /private/tmp/mathtutorbench/.venv/bin/python
```

Result:

```text
scaffolding_generation: { match: 1.0 }
```

Broad default-task smoke after applying the copied-checkout `gsm8k` compatibility
patch:

```bash
MATHTUTORBENCH_DIR=/private/tmp/mathtutorbench pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_mathtutorbench.ts \
  --run-id chat-api-runtime-default-max2b \
  --variants chat-api-runtime \
  --max-examples 2 \
  --provider completion_api \
  --model-args "base_url=http://127.0.0.1:43124/v1,is_chat=true,temperature=0,max_tokens=256" \
  --python /private/tmp/mathtutorbench/.venv/bin/python
```

Result:

```text
solution_correctness: { accuracy: 0.5, precision: 0.0, recall: 0.0, f1: 0.0 }
mistake_location: { f1_micro: 0.5, f1_macro: 0.3333333333333333, f1_weighted: 0.3333333333333333 }
mistake_correction: { accuracy: 0.0 }
socratic_questioning: { bleu: 0.03291891439037589, avg_questions: 1.0 }
scaffolding_generation: { match: 1.0 }
pedagogy_following: { match: 1.0 }
```

Generated result directories are intentionally gitignored under
`project/evals/results/`.

## Runtime Evidence

The smoke logs showed that the request path reached:

- tutor turn-state planning
- preflight verifier
- evidence extraction
- posthoc verifier
- observability event attributes
- Mastra agent streaming through `apps/chat-api`

The local knowledge-base MCP server was not running, so retrieval logged
connection failures and continued without KB context.

## Limitations

- Scores above are not tutor-quality results. They were produced with a local
  model stub to validate plumbing without data egress.
- The planner fell back to the heuristic path because the stub did not satisfy
  the structured JSON response expected by the AI SDK.
- Reward-model dependencies were not installed, so this pass focused on the
  default upstream task metrics that ran in the minimal environment.
- A real benchmark run against an external model provider would send benchmark
  prompts plus private tutor instructions/artifacts to that provider and needs
  explicit approval. A local OpenAI-compatible model endpoint is preferred for
  privacy-safe scoring.

## Next Real Run

1. Start a local OpenAI-compatible model endpoint with the selected tutor model.
2. Start `apps/chat-api` against that endpoint.
3. Start `scripts/eval/chat_api_openai_proxy.ts`.
4. Run MathTutorBench with `--variants chat-api-runtime`, first with
   `--max-examples`, then without it for the full benchmark.
