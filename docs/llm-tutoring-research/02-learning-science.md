# Learning Science Foundations For LLM Tutors

Date: 2026-06-17

## Scope And Caveat

Scite was not available in this environment, so this memo uses DOI/publisher pages and arXiv sources instead.

The focus here is not "what makes a good explanation in general" but what a tutor should do differently when the learner is a novice, partially fluent, or near mastery.

## Key Findings

1. Scaffolding is most useful when it prevents search before the learner has a usable schema. For LLM tutoring, that means showing structure first, not asking the learner to discover everything from scratch.
2. Worked examples are the cleanest novice strategy in algorithmic domains. They reduce cognitive load and give the learner a model of the target procedure.
3. Fading should be tied to learner state, not to a fixed number of turns. As expertise rises, the same level of guidance becomes redundant and can flip from helpful to harmful.
4. Retrieval practice is the strongest move for durable retention. If the goal is long-term learning, the tutor should ask for recall before giving the answer.
5. Self-explanation matters when the learner can already do part of the task but cannot yet explain the principle. The right prompt is usually "why does that step work?" or "what rule justifies this move?"
6. Desirable difficulties are useful when they are effortful but still solvable. Spacing, interleaving, and slightly harder retrieval are features, not bugs, when the target is retention and transfer.
7. Mastery learning should gate progression on repeated evidence, not one correct turn. Premature advancement weakens later performance and hides false confidence.

## Evidence Table

| Mechanism | What the literature says | Tutor move | Evaluation signals |
| --- | --- | --- | --- |
| Scaffolding | Novices learn more efficiently when the tutor reduces search and externalizes the solution structure. | Start with a solution skeleton, labeled steps, or a guided completion task. | Lower time-to-first-correct-step, fewer dead-end attempts, less hint thrashing. |
| Worked examples | Worked examples outperform pure problem solving early in acquisition because they reduce extraneous cognitive load. | Show a full solved example, then ask the learner to map each step back to the underlying rule. | Better near-transfer on first independent attempt, fewer procedural errors, lower response latency. |
| Fading | Guidance should shrink as mastery rises; fixed heavy scaffolds become redundant and can trigger expertise reversal. | Remove one step, clue, or hint at a time once success is stable. | Accuracy stays stable after scaffold removal, hint requests drop, no sharp regression when support is faded. |
| Cognitive load | Overloading working memory slows learning and increases brittle performance. | Keep each turn to one goal, one misconception, or one new move. Chunk long explanations. | Fewer clarifying questions, fewer restarts, lower latency spikes, better follow-through on the next step. |
| Retrieval practice | Practice testing beats restudy for long-term retention, especially when feedback follows the attempt. | Ask the learner to recall before revealing, then give corrective feedback and later revisit the same idea. | Delayed recall, delayed transfer, and reduced need for repeat explanation. |
| Self-explanation | Learning improves when the learner explains why a step works, not just what the step is. | Prompt for rationale, principle, or comparison to an alternative solution. | Explanation quality, principle use, and fewer surface-level parrots of example steps. |
| Desirable difficulties | Effortful but achievable practice supports durable learning better than easy repetition. | Space reviews, mix problem types, and vary examples once the learner has partial competence. | Long-delay retention, transfer to new contexts, and reduced dependence on immediate cues. |
| Mastery learning | Progression should wait until the learner repeatedly demonstrates competence. | Set a threshold, remediate gaps, and retest before advancing. | Time-to-mastery, premature advancement rate, and post-remediation score lift. |

## Tested Pedagogy

- `Worked example -> completion -> independent problem` is the best default sequence for a novice in a structured domain.
- `Attempt -> feedback -> delayed recheck` is the best default sequence when retention is the goal.
- `Solve -> explain why -> compare to a canonical solution` is the best default sequence when conceptual understanding matters.
- `Criterion check -> targeted repair -> retest` is the best default sequence when the course expects mastery before progression.
- `Spacing and interleaving` should be used after initial fluency appears, not during the first exposure to a concept.

## Prompt And Skill Implications

- Keep learner state private and use it only to choose the next tutor move.
- Route into a `worked_example` skill when the learner is new, stuck, or making repeated procedural errors.
- Route into a `fading` skill when accuracy is stable and the same scaffold is no longer needed.
- Route into a `retrieval_probe` skill when retention, not immediate success, is the desired outcome.
- Route into a `self_explain` skill when the learner can solve but cannot justify the step.
- Route into a `mastery_gate` skill when the curriculum should not advance without repeated evidence.
- Student-facing output should stay short, concrete, and task-bound; the pedagogical logic belongs in the tutor policy, not the visible answer.

## What To Log

- First-pass correctness.
- Hint count before success.
- Time-to-first-correct-step.
- Delayed recall after spacing.
- Near-transfer and far-transfer performance.
- Explanation quality, especially whether the learner names the rule or principle.
- Premature advancement rate relative to the mastery threshold.
- Regression after fading a scaffold.

## Source Index

- Sweller, van Merrienboer, and Paas, *Cognitive architecture and instructional design* - https://doi.org/10.1023/A:1022193728205
- Sweller and Cooper, *The use of worked examples as a substitute for problem solving in learning algebra* - https://doi.org/10.1207/s1532690xci0201_3
- Dunlosky et al., *Improving Students' Learning With Effective Learning Techniques* - https://doi.org/10.1177/1529100612453266
- Roediger and Karpicke, *Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention* - https://doi.org/10.1111/j.1467-9280.2006.01693.x
- Israni, Sales, and Pane, *Mastery Learning in Practice* - https://arxiv.org/abs/1802.08616
- Sales and Pane, *The Role of Mastery Learning in Intelligent Tutoring Systems* - https://arxiv.org/abs/1707.09308
