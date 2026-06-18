# MathTutorBench Harness

This folder wires Klicker tutor prompt variants into [MathTutorBench](https://eth-lre.github.io/mathtutorbench/) without vendoring the benchmark. MathTutorBench evaluates open-ended math tutor behavior across three high-level skills and concrete tasks such as mistake location, mistake correction, Socratic questioning, scaffolding generation, and pedagogy following.

Upstream sources:

- Benchmark site: <https://eth-lre.github.io/mathtutorbench/>
- Benchmark repo: <https://github.com/eth-lre/mathtutorbench>
- Paper: <https://arxiv.org/abs/2502.18940>

## Prompt Variants

- `current`: `packages/prisma-data/src/data/data/tutorMode.txt`
- `tutor-skills-v1`: `packages/prisma-data/src/data/data/tutorModeSkillsV1.txt`

The runner copies a local MathTutorBench checkout into a run folder, prepends the selected Klicker prompt to each task config, adds a short benchmark bridge instruction, then calls upstream `main.py`. This keeps upstream files unchanged and makes each prompt version visible in `project/evals/results/<run>/<variant>/manifest.json`.

## Smoke Run

```bash
pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_mathtutorbench.ts --dry-run --run-id smoke
```

This creates manifests only. It verifies prompt paths, task selection, output layout, and command generation without requiring Python packages, Hugging Face access, or model API credentials.

## Real Run

```bash
git clone https://github.com/eth-lre/mathtutorbench /tmp/mathtutorbench
cd /tmp/mathtutorbench
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cd /path/to/klicker-uzh
MATHTUTORBENCH_DIR=/tmp/mathtutorbench pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_mathtutorbench.ts \
  --model-args "model=gpt-4o-mini-2024-07-18,is_chat=true,api_key=$OPENAI_API_KEY,temperature=0,max_tokens=2048"
```

## Full Tutor Runtime Run

To evaluate the new Klicker/Mastra tutor runtime instead of prompt files only,
run MathTutorBench through the local OpenAI-compatible proxy in
`scripts/eval/chat_api_openai_proxy.ts`.

1. Start `apps/chat-api` with the desired model/provider configuration.
2. Start the proxy:

```bash
APP_SECRET=abcd \
MATHTUTORBENCH_CHAT_API_BASE_URL=http://127.0.0.1:3305 \
MATHTUTORBENCH_SELECTED_MODEL=<chat-api model id> \
pnpm --dir apps/chat-api exec tsx ../../scripts/eval/chat_api_openai_proxy.ts
```

3. Run MathTutorBench against the proxy. Omit `api_key`; upstream only applies
   `base_url` in that mode.

```bash
MATHTUTORBENCH_DIR=/tmp/mathtutorbench pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_mathtutorbench.ts \
  --variants chat-api-runtime \
  --provider completion_api \
  --model-args "base_url=http://127.0.0.1:43124/v1,is_chat=true,temperature=0,max_tokens=2048"
```

For a smoke subset, pass one or two tasks:

```bash
MATHTUTORBENCH_DIR=/tmp/mathtutorbench pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_mathtutorbench.ts \
  --variants chat-api-runtime \
  --tasks scaffolding_generation.yaml,pedagogy_following.yaml \
  --max-examples 3 \
  --provider completion_api \
  --model-args "base_url=http://127.0.0.1:43124/v1,is_chat=true,temperature=0,max_tokens=512"
```

This path exercises `chat-api` tutor state planning, policy suffixes,
lecturer-authored artifacts, verifier hooks, event logging, and Mastra agent
streaming. Use a local model endpoint for privacy-safe benchmark runs. Running
against an external model endpoint sends the benchmark prompts plus private tutor
instructions/artifacts to that provider and needs explicit approval.

Use `--tasks` to run a subset:

```bash
pnpm --dir apps/chat-api exec tsx ../../scripts/eval/run_mathtutorbench.ts \
  --dry-run \
  --tasks mistake_location.yaml,scaffolding_generation.yaml
```

## Outputs

- `manifest.json`: prompt hash, selected tasks, redacted model args, command, and source URLs.
- `upstream-results/`: files emitted by MathTutorBench `main.py`.
- `mathtutorbench/`: temporary copied benchmark checkout for reproducibility of generated task configs.

Generated outputs under `project/evals/results/` are ignored by git except `.gitkeep`.

## Generic TutorBench Adaptation

MathTutorBench is useful as a starting point, but its default prompts evaluate a
model as a math teacher, not a deployed tutor runtime. The adaptation notes in
`2026-06-18-generic-tutorbench-adaptation.md` split the benchmark into
student-facing tutor mode, hidden diagnostic probe mode, and solver competence
mode.

The generic target case format lives in `generic_tutor_case.schema.json`, with a
MathTutorBench-derived example in `generic_tutor_case.example.json`.

The first runnable generic harness is
`scripts/eval/run_generic_tutorbench.ts`; its sample cross-domain cases live in
`project/evals/tutor-generic/`.
