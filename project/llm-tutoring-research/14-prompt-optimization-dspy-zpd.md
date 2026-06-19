# 14. Prompt Optimization, DSPy, And ZPD Scaffolding

Date: 2026-06-19

## Scope and caveat

Scite was not available in this environment. Firecrawl search was also
unavailable with a `402` response, so this note uses arXiv, official DSPy docs,
and the existing local research notes.

This pass asks:

1. Can DSPy-style prompt optimization help this tutor?
2. What should we optimize first?
3. How should scaffolding and zone of proximal development behavior change?

## Findings

### DSPy is a good fit, but not as a serving dependency yet

DSPy treats an LLM system as typed modules plus metrics, then optimizes
instructions and demonstrations against train/dev examples. The DSPy paper
argues against hand-maintained prompt templates and frames LLM pipelines as
declarative modules optimized by a compiler against a metric.

That maps well to our tutor if we optimize offline:

- input: Generic TutorBench and real RAG TutorBench cases;
- program: hidden state planner, move selector, response generator, verifier;
- metric: tutor-quality rubric, leakage checks, citation checks, next-attempt
  uptake when available;
- output: versioned prompt/skill artifacts committed or stored in DB.

Do not put DSPy directly in the production request path for the first slice.
The runtime is TypeScript/Mastra, while DSPy is Python-first. The safe seam is
an offline optimizer that proposes prompt variants, runs our eval harness, and
exports accepted instructions into the existing skill-pack artifact path.

### Metric quality matters more than optimizer choice

DSPy docs are explicit that optimization starts with a metric and baseline.
The optimizer can select few-shot examples, rewrite instructions, or tune
weights, but it will reward whatever the metric encodes.

For this tutor, raw final-answer correctness is a bad metric for normal tutor
mode. It conflicts with answer-leakage control and can punish good scaffolds.
The first optimization metric should combine:

- one local issue addressed;
- correct move for student state;
- question count at most one;
- no final-answer leakage when `allowedDisclosure=hint_only`;
- useful scaffold level;
- grounding/citation correctness when retrieval is required;
- concise, specific, non-generic tone.

Later, add behavioral metrics:

- student acts on feedback;
- next attempt improves;
- same misconception recurrence decreases;
- time or turns to successful independent step.

### ZPD needs an explicit hint ladder

The strongest design pattern across the tutor literature is a ladder, not a
single "be Socratic" instruction:

1. Orientation: where to look or which concept matters.
2. Instrumental: one concrete next action in words.
3. Worked-example: analogous micro-example or pattern.
4. Bottom-out: exact next action for one step only.

LLM Hint Factory found that high-level natural-language hints can be unhelpful
or misleading for next-step or syntax requests, while lower-level examples or
concrete hints often support novices better. The assistance-dilemma work shows
that proactive hints based on predicted unproductive struggle can reduce help
avoidance and improve posttest behavior.

Product implication:

- start high only when the student has a plausible next step;
- become more concrete on repeated failures, repeated hint requests,
  frustration, or tiny edits after feedback;
- never jump to full solution in hint-only cases;
- fade support back upward when the learner shows understanding.

### Prompt modules should stay separate

The research and local architecture both point away from one giant tutor prompt.
Keep these as separate modules:

- state planner: classify learner state, first issue, hint depth, retrieval need;
- move policy: choose and constrain one tutor move;
- response generator: produce student-facing text;
- verifier: catch leakage, citation, too-many-questions, and format failures;
- evaluator: score tutor quality from cases and logged outcomes.

This matches our current Mastra/TutorBench direction and makes DSPy easier
later, because each module can become a DSPy signature or optimization target.

## What changed in this slice

- Runtime move policy now emits scaffold directives based on `hintDepth`.
- Seed tutor skill prompt now defines the four-rung ladder and ZPD escalation
  signals.
- State planner prompt now shares the same ladder vocabulary.

These are low-risk prompt improvements that do not add dependencies.

## DSPy adoption path

Slice 1: export eval data

- Convert `project/evals/tutor-generic/cases.json` and
  `project/evals/tutor-rag/cases.json` into a compact JSONL training/dev split.
- Include model output, deterministic scores, and human/LLM judge feedback when
  available.

Slice 2: offline optimizer prototype

- Add `scripts/eval/optimize_tutor_prompts.py`.
- Use DSPy signatures for:
  - `PlanTutorTurnState`;
  - `SelectTutorMove`;
  - `GenerateTutorResponse`.
- Start with `BootstrapFewShot` or `MIPROv2` for small eval sets.
- Try `GEPA` once the metric returns useful natural-language feedback.

Slice 3: artifact export

- Save optimized DSPy programs as JSON under gitignored eval results.
- Extract accepted instructions/demos into a reviewed skill-pack text or DB seed.
- Keep raw optimizer output out of production until reviewed.

Slice 4: promotion gate

- Compare baseline vs optimized prompt on:
  - deterministic TutorBench score;
  - semantic judge score;
  - leakage failures;
  - citation failures;
  - real RAG smoke.
- Promote only if score improves without increasing leakage or grounding risk.

## Source URLs

- DSPy docs, signatures and typed fields: https://dspy.ai/getting-started/expanding-signatures/
- DSPy docs, metrics and optimizers: https://dspy.ai/getting-started/metrics/
- DSPy docs, GEPA optimization: https://dspy.ai/getting-started/gepa-optimization/
- DSPy paper: https://arxiv.org/abs/2310.03714
- MIPRO paper: https://arxiv.org/abs/2406.11695
- LLM Hint Factory: https://arxiv.org/abs/2404.02213
- CodeHelp: https://arxiv.org/abs/2308.06921
- HelpNeed predictor: https://arxiv.org/abs/2010.04124
- MathTutorBench: https://arxiv.org/abs/2502.18940
- MRBench/tutor taxonomy: https://arxiv.org/abs/2412.09416
