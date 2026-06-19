# Tutor Prompt Optimization Plan

Date: 2026-06-19

Status: first prompt/ZPD slice implemented; DSPy deferred to offline optimizer

Branch: `codex/tutor-research-mastra-plan`

## Goal

Improve tutor prompts and scaffolding without weakening answer-leakage,
grounding, or privacy constraints.

## Research Summary

Key findings from `project/llm-tutoring-research/14-prompt-optimization-dspy-zpd.md`:

- DSPy is useful for offline optimization once we have stable TutorBench metrics.
- Metric design is the main risk: optimize for pedagogy, leakage control,
  grounding, and student uptake, not final-answer accuracy.
- Scaffolding should use an explicit ladder: orientation, instrumental,
  worked-example, bottom-out.
- ZPD behavior means selecting the hardest next step the student can attempt
  with help, then fading or escalating support based on evidence.
- Prompt modules should stay separate: planner, move policy, response generator,
  verifier, evaluator.

## Slice 1: Runtime Scaffolding Prompt Delta

Implemented:

- `packages/chat-engine/src/tutor/policy.ts` now emits scaffold directives from
  `hintDepth`.
- `packages/prisma-data/src/data/data/tutorModeSkillsV1.txt` now defines the
  four-rung hint ladder and ZPD escalation signals.
- `apps/chat-api/src/lib/tutorState.ts` planner prompt now uses the same
  ladder vocabulary.
- `packages/chat-engine/tests/tutorPolicy.test.ts` covers ladder directives.

Acceptance:

- Policy tests pass.
- Existing TutorBench dry-run still works.
- No production dependency added.

## Slice 2: Prompt Optimization Dataset

Build a compact dataset from:

- generic tutor cases;
- real RAG tutor cases;
- MathTutorBench-derived cases;
- selected real logs once privacy-reviewed.

Each row should contain:

- case input;
- expected diagnosis and next move;
- allowed disclosure;
- response;
- deterministic score;
- semantic judge score when available;
- optional human feedback.

Acceptance:

- JSONL train/dev split exists under `project/evals/tutor-optimization/`.
- No private course text leaves repo unless explicitly approved.

## Slice 3: DSPy Offline Prototype

Add a Python optimizer script behind explicit opt-in:

```bash
uv run scripts/eval/optimize_tutor_prompts.py \
  --cases project/evals/tutor-optimization/train.jsonl \
  --dev project/evals/tutor-optimization/dev.jsonl \
  --optimizer mipro-v2 \
  --dry-run
```

Start with:

- `BootstrapFewShot` for demonstration selection;
- `MIPROv2` for instruction plus demo optimization;
- `GEPA` only once metrics return useful textual feedback.

Acceptance:

- Optimizer output is saved under gitignored eval results.
- Accepted prompt deltas are exported into reviewable skill-pack text, not
  auto-promoted.

## Slice 4: Promotion Gate

Compare baseline vs optimized prompt:

- deterministic TutorBench score;
- semantic judge score;
- leakage failures;
- citation failures;
- real RAG smoke;
- latency/cost.

Promote only if optimized prompt improves tutor quality without increasing
leakage or grounding failures.

## Risks

- Optimizer overfits to weak TutorBench metrics.
- DSPy adds Python dependency and cross-runtime complexity.
- LLM judge can reward answer delivery instead of tutoring unless the rubric is
  explicit.
- Prompt deltas can improve English cases while hurting German responses.

## Next Steps

1. Run policy tests and focused formatting.
2. Re-run Generic TutorBench dry-run.
3. Add optimizer dataset export as next implementation slice.
4. Add semantic judge feedback before GEPA.
