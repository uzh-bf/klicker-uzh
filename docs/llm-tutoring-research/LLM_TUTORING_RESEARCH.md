# LLM Tutoring Research Pass

Date: 2026-06-17

Purpose: summarize current research on LLM tutoring, especially math/STEM tutoring, tested tutoring skills, published prompt patterns, and concrete implications for evaluating and improving the KlickerUZH tutor.

## Scope And Caveat

This pass focused on public research papers, benchmark repositories, benchmark leaderboards, and the local KlickerUZH chat/tutor implementation.

Scite caveat: I could not access Scite directly from this Codex environment. No Scite connector or install candidate was available. Several arXiv pages expose Scite links externally, but I could not query Scite citation classifications here. I re-checked tool discovery and available plugin install candidates on 2026-06-17; Scite was still unavailable. Evidence below is therefore grounded in public paper pages, benchmark repos, leaderboards, paper-search tools, and local code.

Local implementation checked:

- Current Benibot tutor seed prompt: `packages/prisma-data/src/data/data/tutorMode.txt`
- Default fallback tutor prompt: `apps/chat/src/lib/config/prompts.ts`
- Prompt storage: `packages/prisma/src/prisma/schema/chat.prisma`, `Chatbot.systemPrompts Json?`
- Runtime prompt use: `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`, `streamText({ system: systemPrompt, ... })`

## Executive Takeaways

1. Solver ability is not tutor ability. Multiple benchmarks show strong LLMs solve problems better than they tutor, diagnose misconceptions, or choose pedagogical moves.

2. Best published tutoring systems decompose tutoring into hidden steps: understand student state, diagnose error or misconception, choose a pedagogical move, then generate a short student-facing response.

3. Prompt-only skills are worth building first. Several studies show behavior improves by making pedagogy explicit in system prompts, rubrics, and examples, without immediate model training.

4. Multi-turn tutoring is the main risk surface. Answer leakage, scaffold collapse, over-direct feedback, and failure to adapt become much worse over longer dialogs.

5. Evaluation must be multi-axis. MathTutorBench-style task scores should be combined with leakage/safety, student understanding, feedback uptake, and course-grounding checks.

6. KlickerUZH can start simply. The current `systemPrompts` JSON path can load a versioned tutor skill pack before building a larger skill-loader architecture.

## Benchmark Landscape

### MathTutorBench

Sources: [paper](https://arxiv.org/abs/2502.18940), [HTML](https://ar5iv.labs.arxiv.org/html/2502.18940), [repo](https://github.com/eth-lre/mathtutorbench)

MathTutorBench is the most immediately relevant benchmark for this work. It decomposes tutoring into three broad skill families:

- Mathematical expertise
- Student understanding
- Pedagogical ability

It evaluates seven core task types, with hard variants for some:

- Problem solving
- Student solution correctness
- Mistake location
- Mistake correction
- Socratic questioning
- Scaffolding generation
- Pedagogy following
- Hard scaffolding generation
- Hard pedagogy following

Datasets include GSM8k, StepVerify, and MathDialBridge-derived tasks. The key result is that models can often solve math problems while still failing at student mistake detection and pedagogy. Subject expertise does not reliably transfer to tutoring.

Important prompt/rubric patterns:

- Keep responses short, often one or two sentences.
- Ask one guiding question per turn.
- Scaffold instead of revealing the full answer.
- Encourage self-correction.
- Avoid cognitive overload.
- Separate private reasoning/evaluation from student-facing response.

Repo/runtime notes:

- Supports an OpenAI-compatible `completion_api` provider.
- Default benchmark settings include `temperature=0` and `max_tokens=2048`.
- Full GPT-4o-mini benchmark was reported as inexpensive in the repo README.
- Example style:
  `python main.py --tasks mistake_correction.yaml --provider completion_api --model_args model=gpt-4o-mini-2024-07-18,api_key=<API_KEY>`

Implication for KlickerUZH:

Use MathTutorBench as the first offline benchmark for current Benibot prompt versus a versioned skill-pack prompt. Do not only score final correctness. Track tutor behavior separately: diagnosis, scaffold quality, question quality, answer leakage, and concision.

### TutorBench

Sources: [paper](https://arxiv.org/abs/2510.02663), [OpenReview](https://openreview.net/forum?id=NIhIpxykLK), [leaderboard](https://labs.scale.com/leaderboard/tutorbench)

TutorBench evaluates AI tutoring across high-school and AP STEM. It is broader than MathTutorBench and includes multimodal inputs.

Reported benchmark characteristics:

- 1,490 expert-curated samples
- Six STEM subjects
- 828 multimodal samples, around 56%
- 15,220 rubric criteria

Task families:

- Adaptive explanations
- Assessment and feedback
- Active learning and hints

Rubric dimensions include:

- Instruction following
- Truthfulness
- Style and tone
- Visual reasoning/perception
- Calibration
- Conciseness
- Emotional component

Tutoring-specific skills include:

- Identify misconceptions
- Ask guiding questions
- Use examples and analogies
- Offer alternative solutions
- Scaffold step by step
- Recall relevant knowledge
- Identify correct and incorrect student steps

The paper reports that frontier models stay below strong tutoring performance, with no model clearing the 56% mark in the original publication context. The live leaderboard can change and should be treated as current-state operational data, not a fixed paper result.

Implication for KlickerUZH:

TutorBench's rubric taxonomy is useful for grading real chat logs. Its multimodal slice is relevant because KlickerUZH already converts uploaded images into textual descriptions for the model.

### MRBench

Source: [paper](https://arxiv.org/abs/2412.09416)

MRBench focuses on mistakes and remediation in math tutoring. It compares 1,596 responses from LLMs and human tutors across 192 conversations.

Evaluation dimensions:

- Mistake identification
- Mistake location
- Revealing answer
- Providing guidance
- Actionability
- Coherence
- Tutor tone
- Humanness

Implication for KlickerUZH:

MRBench gives a practical rubric for conversation-level review. The "revealing answer" axis should become an explicit metric for every tutor skill-pack evaluation.

### SafeTutors

Source: [paper](https://arxiv.org/abs/2603.17373)

SafeTutors argues that educational safety is different from generic model safety. A tutor can be harmless by standard policy while still causing pedagogical harm.

Pedagogical harms include:

- Revealing answers too early
- Reinforcing misconceptions
- Failing to scaffold
- Abdicating instruction
- Giving misleading confidence

The paper reports 11 harm dimensions and 48 sub-risks across math, physics, and chemistry. The most important operational result is that multi-turn tutoring sharply increases pedagogical harm; the paper reports harm rising from 17.7% to 77.8% in multi-turn settings.

Implication for KlickerUZH:

Multi-turn transcript evaluation matters more than single-response evaluation. Add a "pedagogical safety" gate before shipping tutor prompt changes.

### TutorGym

Source: [paper](https://arxiv.org/abs/2505.01563)

TutorGym evaluates LLM agents inside existing intelligent tutoring systems. It uses 223 tutor domains derived from CTAT, Apprentice, and OATutors.

The paper's key result is negative: current LLMs perform poorly as tutors in established ITS environments. No evaluated LLM was better than chance at labeling incorrect actions, and next-step action accuracy remained limited.

Implication for KlickerUZH:

Do not assume a general chat tutor can replace domain-specific instructional logic. For high-value exercises, use LLMs to assist within structured task models and rubric checks.

### KMP-Bench

Source: [paper](https://arxiv.org/abs/2603.02775)

KMP-Bench targets K-8 math pedagogy. It includes dialogue and skills evaluations.

KMP-Dialogue evaluates principles such as:

- Challenge
- Explanation
- Feedback

KMP-Skills evaluates:

- Multi-turn problem solving
- Error detection and correction
- Problem generation

The paper reports that models handle verifiable tasks better than nuanced pedagogy. It also introduces KMP-Pile, a 150K-dialogue dataset used for fine-tuning.

Implication for KlickerUZH:

Even if UZH finance is not K-8 math, the skill split is reusable: challenge level, explanation quality, feedback quality, error correction, and problem generation.

### GuideEval

Source: [paper](https://arxiv.org/abs/2508.06583)

GuideEval evaluates Socratic tutoring through three phases:

- Perception: infer learner state
- Orchestration: choose adaptive strategy
- Elicitation: stimulate learner reflection

The paper finds that models fail under learner confusion and redirection, even when they appear good in static examples.

Implication for KlickerUZH:

A Socratic prompt is not enough. The tutor needs a private loop that first estimates learner state and then chooses a move.

### Missing Evaluation Axis

Source: [paper](https://arxiv.org/abs/2605.05648)

This paper studies AI tutor feedback on 10,235 code submissions. It argues that pedagogy-only evaluation is insufficient because tutor feedback must also be measured by student uptake and downstream success.

It compares a baseline tutor with a misconception-aware tutor. The misconception-aware tutor first identifies likely misconceptions from an instructor-authored list, then generates targeted feedback. Internally, it uses structured outputs, but only the feedback is shown to the student.

Evaluation dimensions:

- Relevance of feedback
- Whether the student used feedback
- Whether the next attempt succeeds
- Engagement with feedback

Implication for KlickerUZH:

When possible, evaluate tutor changes against actual course behavior: whether students revise answers, whether quiz/exercise performance improves, and whether they continue productively after tutor feedback.

## Empirical Intervention Evidence

### LearnLM

Sources: [LearnLM paper](https://arxiv.org/abs/2412.16429), [responsible development paper](https://arxiv.org/abs/2407.12687)

LearnLM is the strongest example of a model family explicitly optimized for learning. It uses pedagogical instruction following: system instructions describe desired pedagogy, and the model is evaluated against learning-specific principles.

Reported expert preference margins in the LearnLM paper:

- 31% over GPT-4o
- 11% over Claude 3.5
- 13% over Gemini 1.5 Pro

The responsible development paper gives useful learner/educator principles:

- Do not give away solutions prematurely.
- Make explanations easy and connected to real-world examples.
- Be encouraging and treat mistakes as learning opportunities.
- Recognize struggle and check in.
- Ask questions to determine understanding and misunderstanding.
- Explain step by step and deconstruct thought processes.

Students wanted:

- Alignment with course materials
- Short communication
- Small-step guidance
- Frequent knowledge checks
- Encouraging and constructive tone
- Less information overload

Implication for KlickerUZH:

The Benibot prompt already contains several of these principles. It lacks explicit hidden diagnosis and structured move selection, which LearnLM-style instruction following suggests adding.

### LearnLM In Eedi Math

Source: [paper](https://arxiv.org/abs/2512.23633)

This randomized controlled trial integrated LearnLM into Eedi's math platform with expert tutors supervising and revising drafts.

Reported design:

- 165 students
- Five UK secondary schools
- Human tutors supervise or revise AI drafts

Reported findings:

- 76.4% of messages needed zero or minimal edits.
- Students guided by LearnLM performed at least as well as students guided by human tutors.
- On novel problems, the LearnLM-supported condition scored 66.2% versus 60.7%.
- Tutors highlighted Socratic question drafting as useful.

Implication for KlickerUZH:

Near-term value may be strongest as AI-assisted tutoring under course control, not fully autonomous tutoring. For Klicker, the first-class inputs should be the generated LightRAG knowledge graph and Milvus chunks. Misconception lists, hint ladders, and examples should be optional generated guidance distilled from course data, chats, and evals, with lecturer review only for high-impact exceptions.

### GPT-4 Homework Tutor

Source: [paper](https://arxiv.org/abs/2409.15981)

This classroom RCT used GPT-4 as a homework tutor in Italian high-school English learning.

Design:

- Four classes
- 76 students
- Teacher provided exercise purpose, description, and examples
- GPT generated a step-by-step tutoring strategy and then a tutoring prompt

Reported outcome:

- Significant improvements in grammar learning and engagement
- Students wanted continued access

Implication for KlickerUZH:

Teacher-provided task intent and examples are high-leverage. A tutor skill pack should accept exercise intent, expected solution path, common mistakes, and allowed hint depth.

### ChatGPT Algebra Hint Studies

Sources: [early study](https://arxiv.org/abs/2302.06871), [later open-access article](https://pmc.ncbi.nlm.nih.gov/articles/PMC11125466/)

The early study evaluated ChatGPT-generated algebra hints with 77 participants. Around 70% of hints passed manual quality checks, but human-authored hints produced higher learning gains than ChatGPT hints.

A later open-access study reports stronger evidence that GPT-4 style help can approach human tutor-authored help in some algebra settings. Treat this as context-dependent: quality depends on task design, prompt design, and evaluation setup.

Implication for KlickerUZH:

Generated hints need quality gates. Do not assume all plausible hints are instructionally good.

### Overreliance And Unreflected Acceptance

Source: [paper](https://arxiv.org/abs/2309.03087)

This study compared search-engine and ChatGPT support for physics problem solving.

Reported findings:

- Many students accepted ChatGPT responses uncritically.
- Nearly half of ChatGPT-supported solutions were mistakenly assumed correct.
- ChatGPT use led to more copy/paste-style querying than search use.

Implication for KlickerUZH:

Tutor skills should explicitly prompt students to explain, verify, or apply ideas rather than just accept a generated answer.

## Tested Skill Patterns

### 1. Socratic Step Decomposition

Evidence:

- MathTutorBench Socratic questioning and scaffolding tasks
- TreeInstruct for debugging
- LearnLM tutoring principles

Skill behavior:

- Privately decompose the target problem into steps.
- Identify the first unresolved step.
- Ask one open-ended question about that step.
- Avoid yes/no questions unless checking a precise claim.
- Stop after one question.

Klicker skill module:

```text
Private: identify the smallest next conceptual step the student can attempt.
Student-facing: ask exactly one open-ended question about that step.
Do not solve later steps unless the student has already solved the current one.
```

Evaluation signals:

- One question per turn
- No full solution leakage
- Question targets next unresolved step
- Student can act on the question

### 2. Error And Misconception Diagnosis

Evidence:

- MathTutorBench mistake location/correction
- MRBench mistake identification/location
- ReMath/Bridge error categories
- Missing Evaluation Axis misconception-aware tutor

Skill behavior:

- Detect whether the student answer is correct, partially correct, incorrect, or unclear.
- Locate the first incorrect step.
- Classify likely error type or misconception.
- Avoid exposing the full classification to the student unless useful.

Reusable error categories from ReMath/Bridge:

- Guess
- Misinterpretation
- Careless error
- Right idea but wrong execution
- Imprecise answer
- Not sure/unclear
- No error

Klicker skill module:

```text
Private: classify the student's state as correct, partially correct, incorrect, unclear, or off-task.
Private: identify the first mistake and likely misconception.
Student-facing: acknowledge the useful part, then guide the student to inspect the first problematic step.
```

Evaluation signals:

- Correct mistake location
- Correct error type
- Does not invent a misconception
- Student-facing response targets first error, not all errors at once

### 3. Remediation Strategy Selection

Evidence:

- ReMath/Bridge decomposition
- CLASS response-state templates
- TutorBench assessment/feedback criteria

ReMath/Bridge decomposes expert remediation into:

- Error type
- Response strategy
- Response intention
- Student-facing response

Reusable strategies:

- Explain concept
- Ask question
- Provide hint
- Provide strategy
- Worked example
- Minor correction
- Similar problem
- Simplify question
- Affirm correct answer
- Encourage

Reusable intentions:

- Motivate
- Elaborate
- Correct mistake
- Hint at mistake
- Clarify misunderstanding
- Help understand topic or solution strategy
- Diagnose
- Support thinking/problem solving
- Explain mistake
- Signal solved or not solved

Klicker skill module:

```text
Private: choose one strategy and one intention before writing.
Prefer question, hint, or simplified subproblem before explanation.
Use worked examples only when the student is stuck after prior scaffolding or explicitly asks.
```

Evaluation signals:

- Strategy fits student state
- Response intention is clear
- No strategy pile-up
- Response remains concise

### 4. Hint Ladder And Productive Struggle

Evidence:

- MathTutorBench scaffolding generation
- LEAP formative feedback scaffolds
- GPT-4 homework tutor strategy generation
- Training-free prompt optimization work

Skill behavior:

- Use progressive hints.
- Start with conceptual cue.
- Then point to relevant formula/concept.
- Then give a partial setup.
- Only after repeated struggle, show a worked micro-step.
- Preserve student agency.

Klicker skill module:

```text
Use a hint ladder:
Level 1: ask what concept applies.
Level 2: name the relevant concept or formula.
Level 3: help set up the first line.
Level 4: show one micro-step and ask the student to continue.
Never jump to final answer unless the mode explicitly allows solutions.
```

Evaluation signals:

- Hint depth matches conversation state
- No premature final answer
- Response gives enough help to continue
- Student action is clear

### 5. Answer Leakage Control

Evidence:

- MRBench revealing-answer axis
- SafeTutors pedagogical safety
- Training-free prompt optimization work
- MathTutorBench pedagogy following

Skill behavior:

- Treat answer leakage as a measured failure mode, not a style issue.
- Separate "can solve privately" from "should reveal publicly."
- Use solve internally only to diagnose and scaffold.

Klicker skill module:

```text
Private solving is allowed for diagnosis.
Student-facing final answers are withheld during tutoring unless:
1. the student has completed the reasoning,
2. the teacher-provided task policy allows full solutions, or
3. the student asks for a summary after learning has been attempted.
```

Evaluation signals:

- Final answer not revealed too early
- No hidden answer embedded in hints
- No "just plug in" shortcut that bypasses reasoning
- Summary only after sufficient student effort

### 6. Metacognitive Coaching

Evidence:

- MetaCLASS
- LEAP
- LearnLM principles

Skill behavior:

- Prompt planning, monitoring, debugging, and evaluation.
- Do not over-intervene.
- Sometimes the best move is to let the student continue.

MetaCLASS finding:

- Effective no-intervention is common, but models tend to over-intervene.

Klicker skill module:

```text
When the student is making progress, do not interrupt with a long explanation.
Ask brief planning or checking prompts:
- What is your next step?
- Which assumption are you using?
- How can you check this result?
```

Evaluation signals:

- Does not over-explain during productive work
- Promotes self-checking
- Helps student plan next step
- Uses metacognitive prompt only when useful

### 7. Course-Grounded Tutoring

Evidence:

- LearnLM responsible development findings
- GPT-4 homework tutor RCT
- CLASS retrieval-grounded generation
- Local Benibot requirement to cite course context

Skill behavior:

- Prefer course material over generic explanations.
- Cite provided context.
- Use source-backed examples, definitions, and generated misconception candidates
  when available.
- Say when the context is insufficient.

Klicker skill module:

```text
When context is available, ground definitions, formulas, examples, and references in that context.
If course context conflicts with general knowledge, ask for clarification or follow the course framing.
If context is insufficient, say what is missing and provide a general explanation only as clearly marked background.
```

Evaluation signals:

- Uses relevant retrieved material
- Does not cite irrelevant sources
- Does not hallucinate course references
- Maintains course terminology

### 8. Feedback Uptake Measurement

Evidence:

- Missing Evaluation Axis
- TutorBench assessment/feedback tasks
- ITS/TutorGym evaluation framing

Skill behavior:

- Make feedback actionable.
- Ask for a next attempt.
- Measure whether the next attempt uses the feedback.

Klicker product implication:

Add analytics fields or offline log classifiers for:

- Tutor move type
- Hint depth
- Student state
- Whether tutor asked for a next attempt
- Whether the next student message used the feedback
- Whether the next answer improved

Evaluation signals:

- Student responds with attempted reasoning
- Student applies hinted concept
- Student corrects the targeted mistake
- Conversation progresses without tutor giving full answer

## Prompt Archetypes From The Literature

These are distilled patterns, not long copied prompts.

### MathTutorBench Style

Useful elements:

- Experienced teacher persona
- Caring and useful tone
- Maximum one or two sentences
- One guiding question
- Problem-specific next step

Avoid copying the benchmark prompt wholesale into production. It is designed for evaluation tasks, not for all chat contexts.

Klicker adaptation:

```text
You are a concise, supportive university tutor.
Privately solve only enough to diagnose the student's current state.
Respond with at most two short paragraphs or one guiding question.
Ask one open-ended question unless the student explicitly requests a summary.
```

### ReMath/Bridge Style

Useful elements:

- Hidden error classification
- Hidden strategy and intention
- One-sentence tutor response
- Caring tone

Klicker adaptation:

```text
Before responding, choose:
error_type = ...
strategy = ...
intention = ...

Then write only the student-facing response.
Do not reveal these labels.
```

### CLASS Style

Useful elements:

- Decompose problem into subproblems.
- Store answer, hint, likely incorrect response, feedback, facts, and solution.
- Use conversation-state templates for correct, incorrect, partial, unclear, off-topic, and student inquiry cases.

Klicker adaptation:

```json
{
  "subproblem": "...",
  "expected_answer": "...",
  "hint_1": "...",
  "likely_mistake": "...",
  "feedback": "...",
  "next_question": "..."
}
```

This structure is useful for AI-prepared exercise tutor plans and high-value reviewed guidance, not necessarily for every open chat.

### TreeInstruct Style

Useful elements:

- Instructor agent writes student-facing Socratic turns.
- Verifier agent estimates student understanding.
- State tree tracks unresolved tasks.
- Correct-but-incomplete answers move deeper.
- Wrong answers trigger sibling questions.
- After max attempts, tutor teaches the missing gap.

Klicker adaptation without multi-agent complexity:

```text
Private state:
- target_tasks
- resolved_tasks
- current_task
- student_status
- max_hint_depth

If wrong: ask a nearby simpler question.
If right but incomplete: ask the next child question.
If repeated failure: explain one missing micro-concept, then ask the student to apply it.
```

### LearnLM Style

Useful elements:

- Pedagogical principles are explicit.
- Tutor follows learner state.
- Mistakes are treated as learning opportunities.
- Responses stay aligned with course materials.
- Student thinking is elicited frequently.

Klicker adaptation:

```text
Your goal is learning progress, not answer delivery.
Prefer eliciting the student's reasoning over explaining everything.
When the student struggles, reduce the step size before increasing directness.
```

## Local Gap Analysis

The current Benibot prompt already has useful foundations:

- Socratic orientation
- Supportive tone
- Concision instruction
- German-by-default behavior
- Citation requirement when using context
- One open-ended question guidance
- Formula formatting rules
- Privacy/safety note

Main gaps against the research:

1. No explicit hidden student-state classification.

2. No explicit first-error location process.

3. No strategy/intention selection before response generation.

4. No hint-depth or answer-leakage policy beyond general "do not directly provide full answer."

5. No separate policy for different student states: correct, partial, incorrect, unclear, off-task, repeated stuckness.

6. No misconception-list integration from lecturer/course data.

7. No evaluation harness wired to the prompt version.

8. No feedback-uptake metric in logs.

9. No multi-turn pedagogical safety check.

10. No explicit "do not over-intervene" rule when the student is already progressing.

## Broader Research Consolidation

This section consolidates the 15 topic notes in `docs/llm-tutoring-research/`. Each note has its own sources and Scite-unavailable caveat.

### 1. Tutor Policy Should Come From ITS, Not Chat Personality

Classic intelligent tutoring systems converge on one practical pattern: define the skill, observe the learner's step, update a learner model, and intervene with the smallest useful next move. Cognitive Tutor, Andes, ASSISTments, CTAT, Apprentice Tutors, and AutoTutor differ in implementation, but they all separate content, student model, and intervention policy.

Klicker implication:

- Treat an LLM as a wording and adaptation engine, not as the whole tutor.
- Represent skills or knowledge components explicitly.
- Attach hint ladders, expected solution paths, and mastery rules to those skills.
- Version policy separately from model choice.
- Evaluate local skill gains and transfer, not just chat quality.

Relevant topic note: `docs/llm-tutoring-research/01-classic-its.md`

### 2. Learning Science Adds Routing Rules

Learning science gives concrete routing rules for tutor skills:

- Novice or high-load learner: use worked examples or one worked micro-step.
- Repeated procedural error: reduce step size and increase directness.
- Stable accuracy: fade scaffolds.
- Solves but cannot justify: ask for self-explanation.
- Retention goal: use retrieval practice instead of re-explaining.
- Advancement decision: use mastery gate, not one correct answer.

Klicker implication:

The tutor should not expose "Socratic mode" as a fixed personality. It should route between `socratic_question`, `hint`, `worked_micro_step`, `self_explain`, `retrieval_probe`, `fading`, and `mastery_gate`.

Relevant topic note: `docs/llm-tutoring-research/02-learning-science.md`

### 3. Feedback Needs Feed-Up, Feed-Back, Feed-Forward

Formative feedback theory maps cleanly to tutor response structure:

- Feed-up: clarify target or success criterion.
- Feed-back: say where the current attempt stands.
- Feed-forward: give next action.

The tutor should avoid self-level praise and generic encouragement. Useful feedback is task/process/self-regulation oriented, specific, and actionable. For LLM tutors, the weak point is often feed-back: identifying and explaining the actual error in context.

Klicker implication:

Add a feedback rubric with independent scores for goal clarity, error diagnosis, next action, specificity, tone, and concision.

Relevant topic note: `docs/llm-tutoring-research/03-formative-feedback.md`

### 4. Learner State Should Drive Skill Loading

Knowledge tracing research suggests a practical first stack:

- Start with a transparent per-skill mastery estimate.
- Use prerequisite graphs for sequencing.
- Use item difficulty separately from skill mastery.
- Keep deep sequence models optional until richer data exists.

Minimal private state:

```json
{
  "current_skill": "wacc-tax-shield",
  "mastery_by_skill": {
    "wacc-definition": 0.82,
    "capital-structure-weights": 0.54,
    "tax-adjusted-debt-cost": 0.31
  },
  "prerequisite_gaps": ["tax-adjusted-debt-cost"],
  "last_mistake_type": "right_idea_wrong_execution",
  "hint_depth": 2
}
```

Klicker implication:

Do not build one giant tutor prompt. Load one small skill pack based on mastery, prerequisite gap, mistake type, and hint depth.

Relevant topic note: `docs/llm-tutoring-research/04-knowledge-tracing.md`

### 5. Misconception Libraries Are High Leverage

Misconceptions should be represented as structured records, not buried in prose. A useful record includes:

- concept
- misconception label
- symptoms
- near-miss answer patterns
- diagnostic question
- allowed hint ladder
- corrective micro-explanation
- source/evidence level
- review status

Finance mappings such as WACC, CAPM, NPV, duration, risk/return, leverage, and option pricing are plausible starting points, but they should be treated as generated candidates until they are supported by course sources, chat patterns, or targeted review. The evidence supports the workflow; the exact finance misconception list should be course-owned and telemetry-informed.

Klicker implication:

Do not require manually authored misconception records at launch. Start from LightRAG/Milvus retrieval, then infer recurring misconception candidates asynchronously from chat/eval telemetry and surface only compact review queues when confidence or impact is high.

Relevant topic note: `docs/llm-tutoring-research/05-misconception-libraries.md`

### 6. Feedback Uptake Is A Product Metric

Offline rubrics do not prove learning. Tutor feedback should also be judged by whether students use it.

Minimal event set:

- `feedback_delivered`
- `feedback_viewed`
- `student_submission_received`
- `answer_regraded`
- `post_test_completed`

Richer event set:

- tutor move type
- target skill
- hint depth
- misconception hypothesis
- student next-attempt delta
- whether feedback was applied
- delayed transfer result

Klicker implication:

Keep privacy-aware logging minimal first. The core question is not "was the feedback nice?" but "did the student act on it and improve?"

Relevant topic note: `docs/llm-tutoring-research/06-feedback-uptake.md`

### 7. Pedagogical Safety Needs Its Own Gate

Educational harm is not only generic safety harm. Key failure modes:

- answer leakage
- over-helping
- hallucinated citation
- false confidence
- dependency
- academic-integrity bypass
- privacy leakage
- multi-turn policy drift

Klicker pass rule:

- no zero score on answer leakage, citation fidelity, integrity boundary, or privacy protection
- average pedagogical safety score at least 1.5 on a 0-2 rubric
- pass multi-turn pressure cases, not only one-turn examples

Relevant topic note: `docs/llm-tutoring-research/07-pedagogical-safety.md`

### 8. Hints Need A Ladder And A Directness Policy

Adaptive hints should be a policy over levels:

1. orientation
2. concept cue
3. formula or representation cue
4. setup help
5. worked micro-step
6. bottom-out explanation only when allowed

The tutor should increase directness when there is repeated stuckness, low prior mastery, or unproductive help-seeking. It should fade support when the learner succeeds.

Klicker implication:

Track hint depth per skill and make it visible to evaluation. Do not let the model choose arbitrary directness each turn.

Relevant topic note: `docs/llm-tutoring-research/08-adaptive-hints.md`

### 9. Socratic Tutoring Is One Move, Not The Whole Tutor

Socratic questioning works best when the learner has enough prior knowledge to reason productively. It breaks down with novices, high cognitive load, repeated errors, time pressure, or unclear task goals.

Switch away from Socratic prompting when:

- learner has failed same substep twice
- learner asks for an explanation after a real attempt
- misconception blocks progress
- task is procedural and learner lacks prerequisite
- student shows frustration or off-task drift

Klicker implication:

Start Socratic near the answer, but switch quickly on stall or high error entropy. Fade guidance as mastery rises.

Relevant topic note: `docs/llm-tutoring-research/09-socratic-limits.md`

### 10. Metacognition Should Be Sparse And Timed

Metacognitive tutoring supports planning, monitoring, debugging, reflection, and exam strategy. But over-intervention is a real failure. The tutor should sometimes stay quiet or give only a short nudge.

Useful prompt skills:

- "What is your plan?"
- "Which assumption are you using?"
- "How can you check this result?"
- "What changed between your first and revised answer?"
- "What will you look for next time?"

Klicker implication:

Use metacognitive prompts after solution attempts, repeated mistakes, or before advancing. Do not interrupt productive work.

Relevant topic note: `docs/llm-tutoring-research/10-metacognition.md`

### 11. Motivation And Affect Should Stay Process-Oriented

Affective support should preserve productive struggle. Good support narrows the next step, validates effort, and keeps agency with the learner. Bad support overpraises, manipulates, or treats any discomfort as failure.

Klicker tone policy:

- praise strategy, effort, or correction, not fixed ability
- avoid fake enthusiasm
- acknowledge frustration briefly
- offer choice when possible
- keep the learner active

Relevant topic note: `docs/llm-tutoring-research/11-motivation-affect.md`

### 12. Course-Grounded RAG Needs Citation Fidelity

Course grounding must be evaluated separately from answer correctness. A tutor can be correct and still cite unsupported material. Retrieval should be conditional, evidence should be ranked/compressed, and weak retrieval should trigger clarify, abstain, or general-background fallback.

Klicker policy:

- cite only retrieved sources
- paraphrase by default
- quote sparingly and only when wording matters
- keep course metadata attached to chunks
- surface conflict or uncertainty
- never invent lecture references

Relevant topic note: `docs/llm-tutoring-research/12-course-grounded-rag.md`

### 13. Multimodal Tutoring Needs Structured Extraction

Image descriptions are not enough unless they preserve the instructional signal. Failure modes:

- OCR drift
- lost layout
- wrong chart/table reading
- hallucinated visual detail
- multi-image order confusion
- formula transcription error

Klicker implication:

Treat image processing as structured extraction before tutoring. Extract visible text, symbols, graph axes, table headers, student markings, and uncertainty flags. If extraction is uncertain, ask the student to confirm before tutoring.

Relevant topic note: `docs/llm-tutoring-research/13-multimodal-tutoring.md`

### 14. Best Architecture Is Retriever -> Hidden Planner/Verifier -> Presenter

Recommended first architecture:

1. Retriever gets course evidence and metadata.
2. Hidden planner creates structured state: student state, current skill, misconception, hint depth, allowed move, citation ids.
3. Verifier rejects leakage, unsupported claims, wrong directness, and policy violations.
4. Presenter writes concise student-facing text.

This avoids a giant monolithic prompt while staying simpler than a full multi-agent tutor.

Relevant topic note: `docs/llm-tutoring-research/14-prompt-program-architectures.md`

### 15. Human-In-The-Loop Review Should Be Exception-Based

The system should generate optional tutor guidance from the knowledge graph, chunks, chats, and eval results:

- recurring misconception candidates
- hint ladder candidates
- exercise/task policies
- rubric candidates
- source-backed explanation examples
- weak-source or conflicting-source alerts

Lecturer review should be lightweight and exception-based: approve, suppress, or correct high-impact guidance proposals rather than authoring large libraries by hand. Every promoted guidance item needs provenance, version metadata, and evaluation telemetry.

Relevant topic note: `docs/llm-tutoring-research/15-human-in-loop-authoring.md`

## Consolidated Tutor Architecture

The research points to a small, testable tutor program:

```text
course evidence retrieval
  -> hidden learner-state planner
  -> pedagogical move selector
  -> safety/grounding verifier
  -> concise presenter
  -> feedback uptake logger
```

Private state should include:

- current skill
- prerequisite gaps
- mastery estimate
- student state
- first-error hypothesis
- misconception hypothesis
- selected tutor move
- hint depth
- answer-leakage allowance
- retrieved evidence ids
- affect/frustration signal
- multimodal extraction uncertainty

Student-facing output should include only:

- concise explanation, hint, or question
- one next action
- citation when based on course context
- uncertainty/clarification request when needed

## Consolidated Tutor Skills V1

Use these as first skill-pack modules:

1. `state_classify`: classify asking, attempting, correct, partial, incorrect, unclear, stuck, off-task.

2. `first_error_diagnose`: locate first important error and likely misconception.

3. `mastery_route`: choose remedial, practice, fading, retrieval probe, or advance path.

4. `move_select`: choose exactly one tutor move: ask, hint, simplify, explain, worked micro-step, self-explain, reflect, summarize.

5. `hint_ladder`: enforce directness levels and bottom-out limits.

6. `socratic_switch`: start Socratic only when learner can reason; switch on repeated stall or novice load.

7. `leakage_gate`: prevent final-answer disclosure unless policy allows.

8. `course_ground`: cite only retrieved evidence and abstain or clarify on weak retrieval.

9. `metacognitive_nudge`: prompt planning/checking/reflection at the right time.

10. `affect_support`: process-oriented support without fake praise.

11. `multimodal_confirm`: ask for confirmation when image extraction is uncertain.

12. `uptake_log`: make the next action measurable.

## Consolidated Evaluation V1

Evaluation should combine five layers:

1. Benchmark layer:

- MathTutorBench
- TutorBench/MRBench-style rubric
- pedagogy following
- mistake location/correction
- Socratic/scaffolding quality

2. Pedagogical safety layer:

- answer leakage
- over-helping
- academic-integrity bypass
- hallucinated citation
- privacy leakage
- multi-turn drift

3. Grounding layer:

- citation fidelity
- retrieved evidence support
- abstention on weak retrieval
- course terminology alignment
- quote/paraphrase discipline

4. Behavioral layer:

- student next attempt
- feedback uptake
- correction of targeted misconception
- delayed post-test or transfer item
- help-seeking pattern

5. Product layer:

- generated guidance coverage and review burden
- prompt/skill version tracking
- model version tracking
- telemetry completeness
- regression suite pass rate

## Recommended First Build

Build a minimal tutor skill pack first, loaded through the existing `systemPrompts` path. Defer a larger database-backed modular skill-loader until evaluation proves value.

### Skill Pack Shape

Store one composed prompt per mode/version:

```json
{
  "tutor": {
    "prompt": "...base tutor prompt + skill pack...",
    "description": "Tutor v1 with diagnosis, scaffolding, and leakage control",
    "version": "tutor-skills-2026-06-17"
  }
}
```

The current Prisma field is JSON, so the `version` key can be added without schema change if the frontend/server tolerate unknown keys. If stricter typing is added later, promote it into a typed prompt-version model.

### Skill Pack Modules

1. Student state classifier

Purpose:

- Classify each turn as asking, attempting, correct, partially correct, incorrect, unclear, off-task, or stuck.

Prompt module:

```text
Privately classify the student's state before answering.
Use the classification only to choose the next tutor move.
Do not reveal internal labels.
```

2. Error diagnosis

Purpose:

- Identify first incorrect step and likely misconception.

Prompt module:

```text
If the student attempts a solution, identify the first incorrect or unsupported step.
Address that step first.
Do not list every possible error unless the student asks for a full review.
```

3. Strategy and intention selector

Purpose:

- Force one pedagogical move per response.

Prompt module:

```text
Choose exactly one main move: ask, hint, explain, simplify, affirm, correct, worked-example, summarize.
Prefer ask, hint, or simplify during active problem solving.
```

4. Hint ladder

Purpose:

- Control directness.

Prompt module:

```text
Use progressive hint depth.
Start conceptual, then formula cue, then setup help, then one micro-step.
Only provide the final answer after the student has attempted the reasoning or the task policy allows it.
```

5. Socratic one-question rule

Purpose:

- Prevent question dumping and cognitive overload.

Prompt module:

```text
Ask at most one open-ended question per turn.
Do not ask yes/no questions when an explanatory question would work.
```

6. Productive struggle and no-overintervention

Purpose:

- Avoid over-teaching when the student is on track.

Prompt module:

```text
If the student is making progress, respond briefly and let them continue.
Do not replace their reasoning with your own.
```

7. Course grounding

Purpose:

- Keep tutor aligned with Klicker course material.

Prompt module:

```text
Use retrieved course context when available.
Cite relevant context.
If context is insufficient, state the limitation before giving general background.
```

8. Feedback uptake prompt

Purpose:

- Make each feedback turn measurable.

Prompt module:

```text
End feedback with a concrete next action for the student, usually a revised attempt or one focused explanation in their own words.
```

## Evaluation Plan

### Phase 1: Offline Prompt Evaluation

Run MathTutorBench against:

- Current Benibot prompt
- Benibot plus skill pack
- A concise MathTutorBench-aligned prompt
- Optional model variants if configured through an OpenAI-compatible endpoint

Use fixed settings:

- Temperature 0
- Same model across prompt variants
- Same token limit
- Same task subset first, full pass second

Initial task subset:

- `student_solution_correctness.yaml`
- `mistake_location.yaml`
- `mistake_correction.yaml`
- `socratic_questioning.yaml`
- `scaffolding_generation.yaml`
- `pedagogy_following.yaml`

Metrics to track:

- Accuracy on correctness/location tasks
- Rubric score on scaffolding/pedagogy
- Answer leakage rate
- Average response length
- One-question compliance
- First-error targeting

### Phase 2: Local Transcript Rubric Eval

Create a small anonymized evaluation set from real or synthetic Klicker finance chats.

Rubric axes:

- Correctness
- Course grounding
- Student-state diagnosis
- First-error targeting
- Hint depth
- Answer leakage
- Actionability
- Tone
- Concision
- Formula formatting
- Citation behavior

Use MRBench/TutorBench-style rubrics. Keep each axis independent so a response can be mathematically correct but pedagogically poor.

### Phase 3: Multi-Turn Safety Eval

Construct stress cases:

- Student asks for final answer immediately.
- Student gives a plausible but wrong solution.
- Student is repeatedly stuck.
- Student changes topic.
- Student uploads image-derived problem text.
- Student asks for a summary after attempting.
- Student asks in English.
- Student uses German with finance terminology.

Failure conditions:

- Gives final answer too early.
- Invents course references.
- Asks multiple questions.
- Ignores student mistake.
- Over-explains while student is progressing.
- Fails language/formatting constraints.

### Phase 4: Feedback Uptake

When product analytics permit, evaluate whether tutor feedback changes behavior.

Possible measures:

- Student sends a revised attempt after feedback.
- Revised attempt addresses target misconception.
- Exercise answer improves.
- Student continues conversation productively.
- Student reports confusion or asks for clarification.

Do not claim learning gains from offline rubric scores. Learning claims require a controlled pilot or at least careful before/after course data.

## Implementation Implications For KlickerUZH

### Minimal Version

Add a new seed prompt file:

- `packages/prisma-data/src/data/data/tutorModeSkillsV1.txt`

Then seed a new mode or replace the existing tutor prompt in a controlled branch.

Advantages:

- No schema change
- Fast MathTutorBench comparison
- Easy rollback
- Uses existing runtime path

Risks:

- Long prompt may become brittle
- Hard to compare modules independently
- No structured telemetry

### Better Second Version

Add prompt versioning and skill metadata without a broad first-pass schema:

```ts
type TutorPromptPackage = {
  version: string
  basePrompt: string
  skills: Array<{
    id: string
    version: string
    prompt: string
    enabled: boolean
  }>
}
```

Compose at runtime into the final system prompt. Store the active version on chat sessions or event logs for evaluation. Defer dedicated Prisma tables until generated guidance candidates and lecturer review queues have real usage data.

### Avoid For First Iteration

Do not start with:

- Fine-tuning
- Complex multi-agent tutor architecture
- New database schema for every skill
- Full ITS replacement
- Claims about learning outcomes

Research supports a simpler first iteration: explicit prompt skills plus benchmark and transcript evaluation.

## Candidate Tutor Skill Pack V1

This is a draft system-prompt insert, not final production copy.

```text
Tutoring process:

Before each response, reason privately about:
1. What is the student's current state?
2. What is the smallest useful next learning step?
3. Is there a first mistake or misconception to address?
4. What one tutor move should be used now?
5. How direct may the hint be without giving away the answer?

Student states:
- asking for explanation
- attempting a solution
- correct
- partially correct
- incorrect
- unclear
- stuck
- off-task

Tutor moves:
- ask a guiding question
- give a small hint
- simplify the problem
- point to a relevant concept or formula
- affirm correct reasoning
- correct one mistake
- show one worked micro-step
- summarize after the student has attempted the work

Rules:
- Ask at most one open-ended question per turn.
- During active problem solving, do not reveal the final answer prematurely.
- Address the first important mistake before later mistakes.
- If the student is making progress, keep the response short and let them continue.
- If the student is stuck after multiple attempts, explain one missing micro-concept, then ask them to apply it.
- Use retrieved course context and cite it when available.
- If course context is insufficient, say so briefly.
- End feedback with a concrete next action.
```

## Research-To-Feature Map

| Research finding                            | Product feature                                          | Eval signal                 |
| ------------------------------------------- | -------------------------------------------------------- | --------------------------- |
| Solver ability does not imply tutor quality | Prompt variants benchmarked separately from model choice | MathTutorBench skill scores |
| Mistake diagnosis is weak                   | Hidden first-error classifier                            | Mistake location accuracy   |
| LLMs over-disclose answers                  | Answer-leakage policy                                    | Leakage rate                |
| Multi-turn harm rises sharply               | Multi-turn stress suite                                  | Pedagogical safety failures |
| Students need small steps                   | Hint ladder                                              | Hint depth appropriateness  |
| Course grounding matters                    | Retrieval/citation policy                                | Relevant citation rate      |
| Feedback must be used                       | Ask for revised attempt                                  | Feedback uptake             |
| Models over-intervene                       | Productive-struggle rule                                 | No-overintervention score   |
| Pedagogy requires strategy choice           | Strategy/intention selector                              | Rubric alignment            |

## Open Questions

1. Which model/provider should be the first benchmark target? MathTutorBench supports OpenAI-compatible APIs, so an internal OpenRouter/OpenAI-compatible endpoint should work if exposed.

2. Should the first experiment replace Benibot's tutor prompt or add a separate `tutor_skills_v1` mode?

3. Can we create a small finance-specific evaluation set from existing course material without private student data?

4. Which recurring finance misconceptions can we infer from chats, evals, and LightRAG/Milvus context for topics such as WACC, CAPM, NPV, duration, option pricing, or portfolio theory?

5. Which product metrics can safely approximate feedback uptake without storing sensitive content?

## Recommended Next Slice

1. Vendor MathTutorBench locally and run a smoke test with a cheap OpenAI-compatible model.

2. Export current Benibot prompt into a benchmark-compatible system prompt.

3. Create `tutor-skills-v1` prompt insert from the candidate above.

4. Run a small task subset:

- Socratic questioning
- Scaffolding generation
- Pedagogy following
- Mistake location
- Mistake correction

5. Compare:

- Current prompt
- Current prompt plus skill insert
- Concise benchmark-aligned prompt

6. Write a short scorecard and decide whether to integrate the skill pack into seeds/UI.

## Source Index

Benchmarks and evaluation:

- MathTutorBench paper: https://arxiv.org/abs/2502.18940
- MathTutorBench HTML: https://ar5iv.labs.arxiv.org/html/2502.18940
- MathTutorBench repo: https://github.com/eth-lre/mathtutorbench
- MathTutorBench scaffolding config: https://raw.githubusercontent.com/eth-lre/mathtutorbench/main/configs/scaffolding_generation.yaml
- MathTutorBench pedagogy config: https://raw.githubusercontent.com/eth-lre/mathtutorbench/main/configs/pedagogy_following.yaml
- MathTutorBench mistake location config: https://raw.githubusercontent.com/eth-lre/mathtutorbench/main/configs/mistake_location.yaml
- MathTutorBench Socratic config: https://raw.githubusercontent.com/eth-lre/mathtutorbench/main/configs/socratic_questioning.yaml
- MathTutorBench mistake correction config: https://raw.githubusercontent.com/eth-lre/mathtutorbench/main/configs/mistake_correction.yaml
- MathTutorBench solution correctness config: https://raw.githubusercontent.com/eth-lre/mathtutorbench/main/configs/student_solution_correctness.yaml
- TutorBench paper: https://arxiv.org/abs/2510.02663
- TutorBench OpenReview: https://openreview.net/forum?id=NIhIpxykLK
- TutorBench leaderboard: https://labs.scale.com/leaderboard/tutorbench
- MRBench: https://arxiv.org/abs/2412.09416
- SafeTutors: https://arxiv.org/abs/2603.17373
- TutorGym: https://arxiv.org/abs/2505.01563
- KMP-Bench: https://arxiv.org/abs/2603.02775
- GuideEval: https://arxiv.org/abs/2508.06583
- Missing Evaluation Axis: https://arxiv.org/abs/2605.05648

Systems, interventions, and prompts:

- LearnLM: https://arxiv.org/abs/2412.16429
- Responsible development of LearnLM-Tutor: https://arxiv.org/abs/2407.12687
- LearnLM in Eedi: https://arxiv.org/abs/2512.23633
- GPT-4 homework tutor RCT: https://arxiv.org/abs/2409.15981
- ChatGPT algebra hints early study: https://arxiv.org/abs/2302.06871
- ChatGPT/human algebra help open-access article: https://pmc.ncbi.nlm.nih.gov/articles/PMC11125466/
- Unreflected acceptance with ChatGPT: https://arxiv.org/abs/2309.03087
- CLASS: https://arxiv.org/abs/2305.13272
- TreeInstruct: https://arxiv.org/abs/2406.11709
- TreeInstruct HTML: https://ar5iv.org/html/2406.11709v4
- ReMath/Bridge: https://arxiv.org/abs/2310.10648
- ReMath/Bridge HTML: https://ar5iv.org/html/2310.10648v3
- MetaCLASS: https://arxiv.org/abs/2602.02457
- LEAP formative feedback: https://arxiv.org/abs/2311.13984
- ITS adaptivity comparison: https://arxiv.org/abs/2504.05570
- Training-free prompt optimization for tutoring: https://arxiv.org/abs/2605.27088

Broader second-pass topic notes:

- Classic ITS: `docs/llm-tutoring-research/01-classic-its.md`
- Learning science: `docs/llm-tutoring-research/02-learning-science.md`
- Formative feedback: `docs/llm-tutoring-research/03-formative-feedback.md`
- Knowledge tracing: `docs/llm-tutoring-research/04-knowledge-tracing.md`
- Misconception libraries: `docs/llm-tutoring-research/05-misconception-libraries.md`
- Feedback uptake: `docs/llm-tutoring-research/06-feedback-uptake.md`
- Pedagogical safety: `docs/llm-tutoring-research/07-pedagogical-safety.md`
- Adaptive hints: `docs/llm-tutoring-research/08-adaptive-hints.md`
- Socratic limits: `docs/llm-tutoring-research/09-socratic-limits.md`
- Metacognition: `docs/llm-tutoring-research/10-metacognition.md`
- Motivation and affect: `docs/llm-tutoring-research/11-motivation-affect.md`
- Course-grounded RAG: `docs/llm-tutoring-research/12-course-grounded-rag.md`
- Multimodal tutoring: `docs/llm-tutoring-research/13-multimodal-tutoring.md`
- Prompt/program architecture: `docs/llm-tutoring-research/14-prompt-program-architectures.md`
- Human-in-the-loop authoring: `docs/llm-tutoring-research/15-human-in-loop-authoring.md`
- Topic index: `docs/llm-tutoring-research/README.md`

Representative broader sources:

- ASSISTments evidence: https://www.assistments.org/evidence-of-impact
- AutoTutor meets LLMs: https://arxiv.org/abs/2402.09216
- CTAT/TutorShop: https://pslcdatashop.web.cmu.edu/about/learnlab.html
- Cognitive architecture and instructional design: https://doi.org/10.1023/A:1022193728205
- Worked examples in algebra: https://doi.org/10.1207/s1532690xci0201_3
- Retrieval practice review: https://doi.org/10.1111/j.1467-9280.2006.01693.x
- Effective learning techniques: https://doi.org/10.1177/1529100612453266
- Power of Feedback: https://doi.org/10.3102/003465430298487
- Focus on Formative Feedback: https://doi.org/10.3102/0034654307313795
- Deep Knowledge Tracing: https://arxiv.org/abs/1506.05908
- pyBKT: https://arxiv.org/abs/2105.00385
- Knowledge tracing survey: https://arxiv.org/abs/2105.15106
- CodeHelp: https://arxiv.org/abs/2308.06921
- StAP-tutor: https://arxiv.org/abs/2312.10055
- LLM Hint Factory: https://arxiv.org/abs/2404.02213
- Self-RAG: https://arxiv.org/abs/2310.11511
- Corrective RAG: https://arxiv.org/abs/2401.15884
- Lost in the Middle: https://arxiv.org/abs/2307.03172
- Attributed QA: https://arxiv.org/abs/2212.08037
- RAGTruth: https://arxiv.org/abs/2401.00396
- MathVista: https://arxiv.org/abs/2310.02255
- OCRBench: https://arxiv.org/abs/2305.07895
- ChartQA: https://arxiv.org/abs/2203.10244
- Self-Refine: https://arxiv.org/abs/2303.17651
- Reflexion: https://arxiv.org/abs/2303.11366
- ReAct: https://arxiv.org/abs/2210.03629
- Constitutional AI: https://arxiv.org/abs/2212.08073
- DSPy: https://arxiv.org/abs/2310.03714
- Human-centered AI in education: https://arxiv.org/abs/2312.12751
