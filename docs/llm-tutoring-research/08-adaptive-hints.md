# 08. Adaptive Hint Sequencing

Date: 2026-06-17

## Scope and caveat

Scite was not available in this environment, so this note uses arXiv papers, DOI landing pages, and official project pages instead.

This note focuses on:

1. Hint ladders and bottom-out hints
2. Stuck detection and help-seeking behavior
3. Directness policies for LLM tutors
4. Worked-example transition and fading
5. Prompt modules and evaluation metrics for LLM tutors

## Core claim

Adaptive hints should be treated as a policy over a ladder, not as a single generated response. The tutor should move between rungs based on learner state, request type, and evidence of productive or unproductive struggle.

## Hint ladder

The strongest practical pattern I found is a four-rung ladder:

| Rung | What it contains | When it helps | Main risk |
| --- | --- | --- | --- |
| Orientation | General direction, concept focus, where to look next | Early attempts, unclear strategy | Too vague if used alone |
| Instrumental hint | One concrete next move, still in natural language | Learner knows the task but not the next step | Can still be too abstract for syntax or mechanics |
| Worked-example hint | Similar example, partial code, or analogous step | Novices, structural confusion, syntax-heavy requests | Can over-teach if it becomes a full solution |
| Bottom-out hint | The exact next action or code fragment needed to proceed | Repeated failure, end of ladder, high confidence in stuck state | Can collapse learning if overused |

The LLM Hint Factory study makes this ladder explicit: orientation, instrumental, worked-example, and bottom-out, with `Be More General` and `Be More Specific` controls for moving between levels ([Xiao et al. 2024](https://arxiv.org/abs/2404.02213)). The authors found that high-level natural-language hints alone can be unhelpful or misleading for next-step and syntax requests, while lower-level hints with code examples or inline comments worked better in those cases.

## Stuck detection

The literature points to two different ways to detect that a student needs stronger help:

1. Reactive detection from the current request or failed attempt.
2. Proactive detection from behavior that predicts unproductive struggle.

The help-need work around the assistance dilemma is the clearest signal here: it classifies steps as productive vs. unproductive and uses that to trigger proactive hints, reducing help avoidance and improving posttest outcomes ([Maniktala et al. 2020](https://arxiv.org/abs/2010.04124), [Maniktala et al. 2022](https://arxiv.org/abs/2207.03025)).

CodeHelp adds a useful operational version of stuck detection: a sufficiency check decides whether the student has provided enough context for a meaningful reply. If not, the system asks for clarification but still gives an attempted response so the student does not get trapped in a clarification loop ([Liffiton et al. 2023](https://arxiv.org/abs/2308.06921)).

Practical stuck signals to log:

- repeated failed submissions
- repeated hint requests
- long inactivity after feedback
- very small edits between attempts
- same error recurring across attempts

That last list is an inference from the assistance-dilemma and tutoring literature, not a single published formula.

## Directness policy

The directness of a hint should match the request:

- concept confusion: orientation first
- next-step confusion: instrumental hint
- syntax or structural blockage: worked-example hint or bottom-out hint
- repeated failure: move down the ladder faster

The StAP-tutor paper is useful because it shows how prompt wording changes the level of directness. `Give a hint for the next step` and `Give this student a short hint for the next step` produced better nudge-like responses than `What is the next step?`, which often elicited code or blunt directions ([Roest et al. 2023/2024](https://arxiv.org/abs/2312.10055)). The same paper also found that including a model solution pushed the model to anchor on that solution, even for valid alternative approaches, so model-solution context is a liability unless the tutor can reason about multiple correct paths.

Rule of thumb:

- use `hint` and `student` when you want a short pedagogical nudge
- avoid `explain` when you want a concise next step
- avoid including the model solution unless the tutor can judge path validity

## Worked-example transition

Adaptive hinting should not stop at "more or less detail". It should also support a transition from hints to examples and then back to problem solving as the learner gains skill.

The strongest direct evidence I found is the LLM Hint Factory, which explicitly includes a worked-example hint level between instrumental and bottom-out, and the adaptive scaffolding work that dynamically selects guided examples and buggy examples based on learner state ([Xiao et al. 2024](https://arxiv.org/abs/2404.02213), [Tithi et al. 2026](https://arxiv.org/abs/2602.07308)).

The design implication is simple: novices often need an example-shaped rung, but that rung should fade as the learner stops needing structural support. This is an inference from the example-scaffolding literature, not a claim that every tutor should always show worked examples.

## LLM tutor prompt modules

The papers point to a small set of reusable prompt modules:

| Module | Role | Evidence |
| --- | --- | --- |
| Request schema | Capture language, code, error message, and issue in separate fields | CodeHelp structured input ([Liffiton et al. 2023](https://arxiv.org/abs/2308.06921)) |
| Sufficiency check | Decide whether enough context exists to help; ask for missing info if needed | CodeHelp clarification prompt ([Liffiton et al. 2023](https://arxiv.org/abs/2308.06921)) |
| Main pedagogical response | Explain the issue, guide the next step, stay encouraging, avoid full solutions | CodeHelp main-response prompt ([Liffiton et al. 2023](https://arxiv.org/abs/2308.06921)) |
| Output guardrails | Remove code blocks, avoid off-topic answers, honor instructor avoid-lists | CodeHelp code-removal and guardrails ([Liffiton et al. 2023](https://arxiv.org/abs/2308.06921)) |
| Ladder generator | Produce orientation, instrumental, worked-example, and bottom-out variants for the same state | LLM Hint Factory ([Xiao et al. 2024](https://arxiv.org/abs/2404.02213)) |
| Prompt phrasing selector | Tune tone and directness with words like `hint`, `student`, `short`, or `one or two sentences` | StAP-tutor prompt engineering ([Roest et al. 2023/2024](https://arxiv.org/abs/2312.10055)) |

The main architectural lesson is that a single prompt is usually not enough. CodeHelp ended up with separate prompts for sufficiency checking, main response generation, and code removal because one completion could not reliably satisfy all goals at once ([Liffiton et al. 2023](https://arxiv.org/abs/2308.06921)).

## Evaluation metrics

LLM tutor evaluation is moving in two directions: pedagogical quality and behavioral uptake.

| Metric family | Concrete metrics | Source signal |
| --- | --- | --- |
| Student perception | clear, fits my work, helpful | StAP-tutor student ratings ([Roest et al. 2023/2024](https://arxiv.org/abs/2312.10055)) |
| Expert rubric | feedback type, information, level-of-detail, personalized, appropriate, specific, misleading info, tone, length | StAP-tutor expert rubric ([Roest et al. 2023/2024](https://arxiv.org/abs/2312.10055)) |
| Help-seeking behavior | help avoidance, help appropriateness, request frequency, clarification loops | HelpNeed / assistance-dilemma studies ([Maniktala et al. 2020](https://arxiv.org/abs/2010.04124), [Maniktala et al. 2022](https://arxiv.org/abs/2207.03025)) |
| Hint-level behavior | use of general, instrumental, worked-example, and bottom-out levels | LLM Hint Factory ([Xiao et al. 2024](https://arxiv.org/abs/2404.02213)) |
| Dialogue quality | speak like a teacher, understand a student, help a student | AI Teacher Test ([Tack and Piech 2022](https://arxiv.org/abs/2205.07540)) |
| Pedagogical benchmarking | eight pedagogical dimensions; mistake identification, location, guidance, actionability | MRBench / BEA 2025 follow-on ([Maurya et al. 2024](https://arxiv.org/abs/2412.09416), [BEA 2025 findings](https://arxiv.org/abs/2507.10579)) |
| Behavioral axis | whether students act on feedback, and whether the action is correct | AI tutor behavioral evaluation ([Niousha et al. 2026](https://arxiv.org/abs/2605.05648)) |
| Learning outcome | next-attempt correctness, posttest gain, delayed gain, shorter/optimal solutions | HelpNeed studies and CodeHelp deployment ([Maniktala et al. 2020](https://arxiv.org/abs/2010.04124), [Liffiton et al. 2023](https://arxiv.org/abs/2308.06921)) |

If I had to pick a minimal first-pass metric set for Klicker, it would be:

- next-attempt correctness
- act-on-feedback rate
- correct-action rate
- help-avoidance rate
- posttest or delayed gain

## Practical synthesis

For an LLM tutor, the safest default is:

1. Detect whether the learner is actually stuck.
2. Start as high-level as the request allows.
3. Move down the ladder quickly for syntax or repeated failure.
4. Stop before giving away full solutions unless the learner has already failed at the lower rungs.
5. Measure both pedagogical quality and whether the student actually used the hint.

That is the main lesson from the hint, help-seeking, and evaluation literature combined.

## Source URLs

- [Liffiton et al. 2023, CodeHelp](https://arxiv.org/abs/2308.06921)
- [Roest et al. 2023/2024, StAP-tutor](https://arxiv.org/abs/2312.10055)
- [Xiao et al. 2024, LLM Hint Factory](https://arxiv.org/abs/2404.02213)
- [Maniktala et al. 2020, HelpNeed predictor](https://arxiv.org/abs/2010.04124)
- [Maniktala et al. 2022, productivity model for adaptive assistance](https://arxiv.org/abs/2207.03025)
- [Tack and Piech 2022, AI Teacher Test](https://arxiv.org/abs/2205.07540)
- [Maurya et al. 2024, MRBench taxonomy](https://arxiv.org/abs/2412.09416)
- [BEA 2025 findings on pedagogical ability assessment](https://arxiv.org/abs/2507.10579)
- [Niousha et al. 2026, behavioral evaluation axis](https://arxiv.org/abs/2605.05648)
- [Tithi et al. 2026, adaptive scaffolding with guided and buggy examples](https://arxiv.org/abs/2602.07308)
