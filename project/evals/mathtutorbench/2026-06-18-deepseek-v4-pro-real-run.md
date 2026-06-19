# MathTutorBench DeepSeek V4 Pro Real Run

Date: 2026-06-18

Goal: run MathTutorBench through the real Klicker/Mastra tutor runtime with a
real external model provider instead of the local model stub.

## Provider

- Provider: OpenRouter
- Tutor model registry id: `deepseek-v4-pro`
- Deployment id: `deepseek/deepseek-v4-pro`
- Chat API base URL: `https://openrouter.ai/api/v1`
- `CHAT_OPENAI_STORE_RESPONSES=false`, matching the known OpenRouter runtime
  constraint.

The OpenRouter key came from the shared prototyping Infisical project. Dev
database and app secrets came from the Klicker dev Infisical project. No secret
values were printed or committed.

## Runtime Stack

The live route smoke ran first against `apps/chat-api` on port `3315`:

```text
ok: true
modelId: deepseek-v4-pro
modelDeploymentId: deepseek/deepseek-v4-pro
textDeltaParts: 25
creditsUsed: 0.00425604
```

Then MathTutorBench used the local OpenAI-compatible proxy on port `43124`:

```bash
MATHTUTORBENCH_DIR=/private/tmp/mathtutorbench pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_mathtutorbench.ts \
  --run-id deepseek-v4-pro-default-max2 \
  --variants chat-api-runtime \
  --max-examples 2 \
  --provider completion_api \
  --model-args "base_url=http://127.0.0.1:43124/v1,is_chat=true,temperature=0,max_tokens=512" \
  --python /private/tmp/mathtutorbench/.venv/bin/python
```

## Results

Focused smoke:

```text
run-id: deepseek-v4-pro-real-smoke
task: scaffolding_generation.yaml
maxExamples: 2
result: match 1.0
```

Broad capped run:

```text
run-id: deepseek-v4-pro-default-max2
tasks: default MathTutorBench task set
maxExamples: 2

solution_correctness:
  accuracy: 1.0
  precision: 1.0
  recall: 1.0
  f1: 1.0

mistake_location:
  f1_micro: 0.5
  f1_macro: 0.3333333333333333
  f1_weighted: 0.5

mistake_correction:
  accuracy: 0.5

socratic_questioning:
  bleu: 0.5055259836100189
  avg_questions: 1.0

scaffolding_generation:
  match: 1.0

pedagogy_following:
  match: 1.0
```

Generated artifacts are under:

- `project/evals/results/deepseek-v4-pro-real-smoke/`
- `project/evals/results/deepseek-v4-pro-default-max2/`

Those result directories are gitignored by design.

## Observed Runtime Behavior

The run exercised the real tutor stack:

- `apps/chat-api` participant auth
- seeded chatbot and participant credits
- tutor state planning
- tutor preflight verifier
- evidence extraction
- Mastra agent streaming
- credit accounting
- MathTutorBench scoring

Useful caveats from logs:

- The local KB MCP endpoint at `localhost:1417` was not running, so MCP tool
  loading failed repeatedly and the runtime continued without KB tools.
- Several tutor-state planner calls fell back to the heuristic state path with
  `No output generated.` from the structured planner output. The main tutor
  generation still completed.
- One assistant-message persistence callback hit a Prisma transaction timeout;
  the subsequent tutor-event write failed its message foreign key because the
  assistant message was not saved. The benchmark response still completed.
- The benchmark prompts are elementary school math while the seeded Klicker
  tutor persona/artifacts are finance-oriented, so language/style and task
  framing are not perfectly aligned with the benchmark domain.

## Recommended Next Run

Before running the uncapped benchmark:

1. Start or intentionally disable the local KB MCP configuration so missing MCP
   tools do not dominate logs.
2. Investigate the Prisma persistence timeout on longer external-model streams.
3. Consider disabling tutor event logging for benchmark-only runs if persistence
   of evaluation turns is not needed:

```bash
CHAT_TUTOR_EVENT_LOGGING_ENABLED=0
```

4. Keep `--max-examples` for sweep/debug runs; remove it only for an intentional
   full-cost benchmark.
