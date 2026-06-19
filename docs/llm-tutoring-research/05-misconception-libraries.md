# Misconception Libraries for Math and Finance Tutoring

Date: 2026-06-17

## Scope and caveat

Scite was not available in this environment, so this note uses public arXiv papers, benchmark pages, and public reference pages instead.

This file focuses on two questions:

1. What shape should a misconception library have for a math tutor?
2. How should lecturer-authored misconception lists feed an LLM tutor for finance topics such as WACC, CAPM, NPV, duration, risk/return, leverage, and option pricing?

## What the math literature implies

The strongest recent math tutoring work treats misconceptions as coherent wrong procedures, not random wrong answers. That matters for library design.

- `Novice Learner and Expert Tutor` shows that LLMs can solve math correctly while still struggling to identify which misconception produced a wrong answer.
- `MalruleLib` encodes misconceptions as executable malrules and shows that cross-template generalization is hard.
- `Can LLMs Model Incorrect Student Reasoning?` shows that useful distractor generation usually starts from the correct solution, then simulates candidate misconceptions.
- `DiVERT` and `LookAlike` show that high-quality distractors should be tied to interpretable error labels and student-error consistency.

Design implication: a misconception library should be granular, labeled, and tied to worked steps. A single label like "algebra error" is too coarse for a tutor to act on.

Useful library axes for math:

- Topic and subtopic
- Canonical misconception label
- Short plain-language description
- Example trigger step or answer pattern
- Near-miss sibling misconceptions
- Corrective move
- Evidence strength
- Whether the label is course-specific or broadly reusable

The tutor should use the library for private diagnosis first, then produce student-facing feedback. The student should see a hint or correction, not the internal misconception label.

This matches the broader tutoring research pattern in `MathTutorBench`, `GuideEval`, and `LearnLM`: infer learner state privately, choose a pedagogical move, then emit a short response that supports the next student attempt.

## Finance: evidence first, then topic mappings

### Evidence-backed from finance research

The finance-specific evidence I found is about correction strategy, not topic-by-topic misconception taxonomies.

- `Breaking Bad Financial Habits` reports that financial misconceptions are durable and that LLMs only help when the conversation has corrective intent and matches the recipient's sophistication.
- Undirected conversations can entrench the misconception rather than fix it.

Design implication: for finance tutoring, the misconception list should not be passive reference material. It should drive a targeted correction path with the right level of explanation.

### Speculative topic mappings to validate with lecturers

I did not find strong topic-specific misconception papers for every finance concept below. These mappings are plausible tutor-library entries, but they should be validated against lecturer-authored examples before being treated as canonical.

#### WACC

- Confusing WACC with a generic "cheap financing" number rather than a project discount rate.
- Using book-value weights instead of market-value weights.
- Forgetting the after-tax cost of debt.
- Applying one firm's WACC to a project with materially different risk.

#### CAPM

- Treating beta as total risk instead of systematic risk.
- Reading CAPM as a price predictor rather than a required-return model.
- Assuming the linear beta-return relation holds mechanically in all settings.
- Ignoring the diversification assumption behind the model.

#### NPV

- Mixing up cash flow signs and discounting direction.
- Using the wrong discount rate for the project's risk.
- Double-counting sunk costs or ignoring opportunity costs.
- Comparing projects with different lives without normalizing the comparison.

#### Duration

- Confusing duration with maturity.
- Treating duration as an exact price change rather than a local sensitivity.
- Ignoring convexity and non-parallel yield-curve moves.

#### Risk / return

- Assuming higher risk guarantees higher realized return, not just higher expected compensation.
- Confusing diversification with elimination of all risk.
- Treating historical return as the same thing as expected return.

#### Leverage

- Confusing operating leverage with financial leverage.
- Assuming leverage only amplifies upside.
- Ignoring insolvency risk, covenants, and the cost of debt.

#### Option pricing

- Confusing intrinsic value with fair value.
- Assuming an option is worth only its current in-the-money amount.
- Treating volatility as a one-directional bad thing rather than a price input.
- Ignoring time value, no-arbitrage, and risk-neutral valuation logic.

## How lecturer-authored misconception lists should feed an LLM tutor

The tutor should not consume a flat list of buzzwords. It should consume structured misconception records.

Recommended record shape:

- `id`
- `topic`
- `misconception`
- `diagnostic_cues`
- `student_facing_example`
- `corrective_hint`
- `near_misses`
- `strength_of_evidence`
- `course_scope`
- `linked_lecture_material`

Recommended runtime flow:

1. Retrieve candidate misconceptions from the student's current step, not only from the final answer.
2. Pick the most likely misconception privately.
3. Attach the relevant lecturer-authored example or definition.
4. Generate one short, targeted hint or question.
5. Keep the misconception label hidden unless the product explicitly wants to reveal it.
6. Ask for another student attempt before escalating the explanation.

The literature above supports this flow in three ways:

- Correct solution first, misconception simulation second.
- Intermediate reasoning is the bottleneck.
- Behavioral follow-through matters, not just pedagogical quality.

## Practical takeaway

For a finance tutor, the first useful misconception library is probably a hybrid:

- math-style malrules for algebraic and present-value mechanics
- lecturer-authored topic lists for course-specific finance language and examples
- private diagnosis rules that map a student step to the most likely misconception

That gives the LLM something concrete to retrieve, diagnose, and remediate without pretending that generic chat behavior is enough.

## Source URLs

- https://arxiv.org/abs/2310.02439
- https://arxiv.org/abs/2412.16429
- https://arxiv.org/abs/2406.19356
- https://arxiv.org/abs/2505.01903
- https://arxiv.org/abs/2508.06583
- https://arxiv.org/abs/2510.02663
- https://arxiv.org/abs/2601.03217
- https://arxiv.org/abs/2603.15547
- https://arxiv.org/abs/2603.17373
- https://arxiv.org/abs/2604.27022
- https://arxiv.org/abs/2605.05648
- https://arxiv.org/abs/2502.18940
