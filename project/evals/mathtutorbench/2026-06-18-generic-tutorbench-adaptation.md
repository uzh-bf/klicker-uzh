# Generic TutorBench Adaptation

Date: 2026-06-18

Goal: adapt MathTutorBench from "test a model with math-tutor prompts" into
"test a deployed tutor runtime for tutoring quality" and make the benchmark
domain-generic.

## MathTutorBench Prompt Review

MathTutorBench has two prompt families.

### Evaluator Probes

These prompts ask the model to produce a label or exact answer:

- `student_solution_correctness.yaml`: classify whether a student solution is
  incorrect with `Yes` or `No`.
- `mistake_location.yaml`: output the first wrong step number or `0`.
- `mistake_correction.yaml`: provide a complete corrected solution and final
  answer.
- `problem_solving.yaml`: solve the problem step by step and give the final
  answer.

These should not be copied into the student-facing tutor prompt. They are
hidden evaluator probes. If we route them through the real tutor runtime, they
will conflict with our answer-leakage policy and Socratic style.

Use them instead to test internal tutor capabilities:

- diagnosis: can the tutor detect whether the student's work is wrong?
- localization: can it find the first error?
- correction: can it generate or verify the corrected target answer?
- solver competence: can it solve the underlying task when permitted?

### Dialogue Tutor Prompts

These prompts are closer to product tutoring:

- `scaffolding_generation.yaml`: "respond to a student in a useful and caring
  way" with at most two sentences.
- `socratic_questioning.yaml`: generate step-by-step questions.
- `pedagogy_following.yaml`: friendly supportive tutor, nudge on task, ask
  guiding/probing questions, ask one question per turn, wrap up when the student
  shows understanding.

Safe prompt ideas to incorporate into our tutor policy:

- nudge gently back to the student's learning goal if they drift;
- ask guiding questions for incremental progress;
- ask probing questions only when useful for deeper understanding;
- pose one question per turn unless the user explicitly asks for a list;
- wrap up once the student shows evidence of understanding;
- cap normal feedback turns to one local issue plus one next action.

Do not incorporate these MTB-only instructions into the production prompt:

- "Generate only a list of questions on one line";
- "Write only the step number";
- "Provide a complete correct solution";
- fixed "maximum two sentences" for all contexts.

Those belong in eval adapters or task-specific benchmark prompts.

## Gap In Current MathTutorBench Metrics

The dialogue metrics are weak as tutor-quality metrics:

- `scaffolding_generation` and `pedagogy_following` only check whether the
  response contains a question.
- `socratic_questioning` uses BLEU against reference questions, which penalizes
  semantically good paraphrases and can treat multiple questions on one line as
  one item.
- `mistake_correction` extracts the last/final number, so a good pedagogical
  hint can score poorly when it intentionally avoids the final answer.

For our tutor runtime, MathTutorBench should be treated as a smoke benchmark
until we add richer scoring.

## Adaptation Design

Split the benchmark into three eval modes.

### 1. Tutor Runtime Mode

Purpose: test the deployed tutor exactly as a student experiences it.

Input shape:

- system: our tutor prompt, skill packs, memory, MCP tools, verifier policy;
- user: the student-facing problem, dialogue history, and current attempt;
- runtime: normal selected mode/model/credit/auth path.

Expected output:

- supportive tutor response;
- identifies the local learning issue;
- gives one scaffold or micro-step;
- asks at most one useful next-action question;
- avoids leaking final answer unless the case permits it.

Scoring should use a rubric, not exact answer parsing.

### 2. Hidden Diagnostic Probe Mode

Purpose: test non-student-facing tutor cognition.

Input shape:

- problem/context;
- student attempt;
- reference solution or rubric;
- requested structured output.

Expected output:

```json
{
  "is_correct": false,
  "first_error_step": 1,
  "misconception": "multiplied bikes instead of tires",
  "next_tutor_move": "ask"
}
```

This can be routed to `planTutorTurnState` or a dedicated eval-only diagnostic
agent. It should not be routed through the normal student chat response.

### 3. Solver Competence Mode

Purpose: test whether the model can solve the task when answer leakage is
permitted.

Input shape:

- problem/context;
- optional source material;
- explicit permission to produce a complete answer.

Expected output:

- complete answer;
- reasoning trace or concise derivation;
- final answer in structured form.

This should be separate from tutor-quality scoring.

## Generic Schema

Replace math-specific fields with domain-neutral ones:

- `question` -> `task`
- `problem` -> `task`
- `student_solution` -> `student_attempt`
- `reference_solution` -> `expert_solution`
- `error_step` -> `first_issue_step`
- `ground_truth_response` -> `gold_tutor_response`
- `answer` -> `expected_outcome`

Add fields that are useful across domains:

- `domain`: math, finance, programming, statistics, writing, medicine, law,
  chemistry, etc.
- `learning_objective`: what the learner should understand.
- `source_material`: optional retrieval context or authoritative excerpt.
- `student_state`: exploring, stuck, misconception, calculation error,
  verification request, final-answer request.
- `allowed_disclosure`: `hint_only`, `micro_step`, `full_solution_allowed`.
- `rubric`: criteria and weights.
- `gold_diagnosis`: first issue, misconception, missing concept.
- `gold_next_move`: ask, hint, simplify, explain, worked micro-step, summarize.

See `generic_tutor_case.schema.json` for a concrete case schema.

## Generic Scoring Rubric

For student-facing tutor responses, score:

1. **Issue diagnosis**: identifies the local issue or missing idea.
2. **Pedagogical move**: chosen move fits the student state.
3. **Scaffolding quality**: gives a minimal useful next step, not too much.
4. **Question quality**: asks one targeted, open-ended next-action question.
5. **Answer leakage control**: respects `allowed_disclosure`.
6. **Correctness**: does not introduce domain errors.
7. **Tone and clarity**: supportive, concise, not generic praise.
8. **Grounding/citation**: uses source material where provided; does not invent
   references.

Use rule-based checks where possible:

- number of questions;
- final-answer leakage;
- output format compliance;
- citation presence/absence;
- language constraints.

Use LLM or expert judging for semantic criteria:

- local issue diagnosis;
- quality of hint;
- appropriateness of next move;
- conceptual correctness in non-numeric domains.

## Recommended Prompt Delta For Klicker Tutor

Our `tutorModeSkillsV1` already contains most MTB pedagogy ideas. The safe
additions are small:

```text
When the learner drifts from the original task, gently restate the learning
goal and return to the next useful step.

Use probing "why/how" questions only after the immediate next step is clear;
otherwise prefer concrete next-action questions.

When the learner shows understanding, stop escalating hints: briefly summarize
the strategy and invite them to complete or verify the final step.
```

Do not add benchmark-output instructions to the production prompt. Instead, add
an eval adapter that tells the tutor runtime when a case permits a full solution
or requires a hidden diagnostic output.

## Implementation Plan

1. Add a generic case loader beside the MathTutorBench runner.
2. Add task templates for:
   - `diagnose_attempt`;
   - `locate_first_issue`;
   - `generate_tutor_response`;
   - `generate_socratic_questions`;
   - `solve_when_allowed`.
3. Add a runtime adapter that maps generic cases to the chat-api request shape:
   - `task` + `dialog_history` + `student_attempt` become the latest user
     message;
   - `allowed_disclosure` becomes an eval-only policy suffix;
   - `source_material` can be injected as retrieval context or disabled when
     testing no-KB behavior.
4. Add a scorer:
   - deterministic checks for question count, answer leakage, format, language;
   - optional LLM judge for semantic pedagogy criteria;
   - per-case JSONL outputs with response, score breakdown, and runtime logs.
5. Keep MathTutorBench compatibility:
   - import MTB math cases into the generic schema;
   - preserve MTB aggregate metrics for comparability;
   - add our richer rubric scores as a separate output.

## First Generic Domains

Start with three domains to avoid overfitting to math:

- math word problems: preserve MTB comparability;
- finance concepts/problems: matches Benibot's real domain;
- programming/debugging: tests hinting, misconception diagnosis, and code-safety
  without numeric-answer parsing.

Then add writing/statistics once the rubric is stable.
