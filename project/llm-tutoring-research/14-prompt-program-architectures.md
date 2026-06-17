# Prompt / Program Architectures for LLM Tutors

Date: 2026-06-17

## Scope and caveat

Scite was not available in this environment, so this note uses arXiv papers and official docs instead.
This is a design note, not a claim that one architecture is universally best. The point is to isolate which control patterns seem worth keeping when tutoring must be grounded, safe, and cheap enough to run in a real course.

## Bottom line

The strongest pattern is not "one giant tutor prompt". It is a small program around the model:

1. decide what the student is trying to do,
2. retrieve only the evidence needed,
3. draft a hidden plan or rubric check,
4. verify the draft against tutoring rules,
5. then emit the student-facing hint or explanation.

That pattern shows up across reasoning, agent, and tutoring research: ReAct interleaves reasoning and tool use; Tree of Thoughts explores multiple candidate reasoning paths; Reflexion and Self-Refine use critique-and-revise loops; Constitutional AI uses rules and self-critique to regulate outputs; Toolformer and function-calling docs show how to make tool use explicit; DSPy and APE treat prompts as optimizable programs; and recent tutoring systems add specialist agents plus evaluators rather than relying on a single chat turn.

## Pattern notes

### Planner-verifier

Use a hidden planner to decide the tutoring move, then a verifier to check whether that move is pedagogically and factually acceptable before anything reaches the student.

This is the cleanest control split for tutoring because the planner can reason about the next move while the verifier enforces the boundary. In plan-verification work, a judge critiques a plan and a planner revises it iteratively; in tutoring, the same loop can reject over-helpful answers, wrong hints, or unsupported claims. Sources: [Plan Verification for LLM-Based Embodied Task Completion Agents](https://arxiv.org/abs/2509.02761), [Self-Refine](https://arxiv.org/abs/2303.17651), [Reflexion](https://arxiv.org/abs/2303.11366)

### Hidden JSON / rubric

The hidden layer should be structured, not free-form. Keep a machine-readable object for things like:

- current skill or misconception,
- whether the question is answerable from course evidence,
- hint stage,
- expected next action,
- policy flags such as "do not reveal full answer".

OpenAI’s structured-output docs show strict JSON-schema style control, and the prompting guide explicitly recommends treating prompts as application code rather than ad hoc text blobs. That makes a hidden rubric or state object a better fit than a long prompt suffix. Sources: [Structured model outputs](https://platform.openai.com/docs/guides/structured-outputs), [Function calling](https://platform.openai.com/docs/guides/function-calling), [Prompting](https://platform.openai.com/docs/guides/prompting)

### Multi-agent tutor / verifier

A second agent is useful when the tutor has to stay disciplined under student pressure or when content quality matters more than raw fluency.

The recent tutoring literature is moving in this direction. ITAS splits tutoring into multiple specialist agents plus a synthesizer and a separate autograder, while Dean of LLM Tutors uses LLM feedback evaluators to reject weak educational feedback before delivery. That suggests a practical tutoring stack with a generator, a verifier, and a policy gate rather than one monolithic assistant. Sources: [ITAS: A Multi-Agent Architecture for LLM-Based Intelligent Tutoring](https://arxiv.org/abs/2604.24808), [Dean of LLM Tutors](https://arxiv.org/abs/2508.05952)

### Prompt optimization

Prompt quality is worth optimizing, but only after the task is decomposed.

APE treats the instruction as the program and searches over candidate prompts. DSPy goes further by compiling declarative LM programs against a metric, which is a better mental model for tutoring than hand-tuning a giant prompt string. For Klicker, that means optimize the rubric, the hint policy, and the retrieval query template separately instead of trying to "make the prompt better" in one shot. Sources: [Large Language Models Are Human-Level Prompt Engineers](https://arxiv.org/abs/2211.01910), [DSPy](https://arxiv.org/abs/2310.03714), [Optimizing LLM Prompt Engineering with DSPy Based Declarative Learning](https://arxiv.org/abs/2604.04869)

### Constitutional / rule-based tutoring

The tutor should have an explicit constitution: no answer leakage when the student is supposed to think, no unsupported claims, no pretending to know the course if retrieval failed, and no bypassing of pedagogical policy.

Constitutional AI is the strongest general source for this idea: use a rule set to generate self-critiques and revisions, then train or prompt against those principles. In a tutoring product, this becomes a rule-based feedback policy rather than a generic safety layer. Sources: [Constitutional AI](https://arxiv.org/abs/2212.08073)

### Tool-using tutors

Tutors need tools for course retrieval, answer checking, mastery updates, and possibly calculation or code execution.

ReAct is the core pattern here because it interleaves reasoning and acting instead of pretending the model knows everything. Toolformer shows that model behavior can be organized around choosing when to call tools, while OpenAI’s function-calling docs make the operational shape explicit: define allowed tools, choose auto or required calling, and return tool results back into the model. For tutoring, the useful tools are narrow: retrieve course context, check an answer, fetch a rubric, update learner state, and maybe run a calculator or code cell. Sources: [ReAct](https://arxiv.org/abs/2210.03629), [Toolformer](https://arxiv.org/abs/2302.04761), [Function calling](https://platform.openai.com/docs/guides/function-calling)

### Structured state

The tutor should keep a small versioned state object per learner and per session.

That state should hold the skill being practiced, prior mistakes, hint level, retrieved evidence ids, and a short summary of what the learner has already tried. This is not just an implementation detail; it is what makes a tutor auditable, debuggable, and resumable. OpenAI’s docs now treat results and state as first-class agent concerns, which matches the practical need for a durable learner record. Source: [Function calling](https://platform.openai.com/docs/guides/function-calling)

## Recommended simple Klicker architecture

My recommendation for Klicker is a deliberately small 3-stage program:

1. Retriever
   Pull the smallest useful set of course chunks and the current learner state.
2. Hidden planner/verifier
   Produce a structured plan object, then score it against a rubric: answerability, grounding, pedagogy, and leakage.
3. Presenter
   Render the approved output as a hint, a question, a worked substep, or a short answer with citations.

That is the smallest architecture that still captures the main research lessons:

- planner-verifier keeps the tutor from rushing to the answer,
- hidden JSON makes the policy inspectable and testable,
- tool use makes retrieval and checking explicit,
- structured state makes sessions resumable,
- prompt optimization can be applied to the planner and verifier independently.

I would not start with a many-agent swarm. The course value is more likely to come from stable state, good retrieval, and a strict verifier than from adding more agents.

## What to measure

For Klicker, the useful metrics are:

- answer leakage rate,
- grounding precision,
- hint usefulness,
- clarification accuracy,
- verifier rejection rate,
- state update correctness,
- cost and latency per turn.

The verifier should be judged separately from the final response. A tutor can sound good and still fail if it leaks the solution or cites unsupported course material.

## Source URLs

- https://arxiv.org/abs/2210.03629
- https://arxiv.org/abs/2305.10601
- https://arxiv.org/abs/2303.11366
- https://arxiv.org/abs/2303.17651
- https://arxiv.org/abs/2212.08073
- https://arxiv.org/abs/2302.04761
- https://arxiv.org/abs/2211.01910
- https://arxiv.org/abs/2310.03714
- https://arxiv.org/abs/2604.04869
- https://arxiv.org/abs/2509.02761
- https://arxiv.org/abs/2604.24808
- https://arxiv.org/abs/2508.05952
- https://platform.openai.com/docs/guides/function-calling
- https://platform.openai.com/docs/guides/structured-outputs
- https://platform.openai.com/docs/guides/prompting
