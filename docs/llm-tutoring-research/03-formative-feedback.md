# Formative Feedback Theory for LLM Tutors

Scite is not available in this environment, so this note uses publisher/DOI pages and arXiv sources instead.

## Core Theory

Hattie and Timperley frame effective feedback around three questions: where am I going, how am I going, and where to next. They also distinguish four levels of feedback: task, process, self-regulation, and self. For tutoring, the practical read is: start with the goal, diagnose the current error or gap, then give a next step that helps the learner improve future performance, not just finish the present item. Source: [Hattie & Timperley 2007](https://doi.org/10.3102/003465430298487)

Shute defines formative feedback as information intended to modify thinking or behavior to improve learning. Her review is explicit that formative feedback should be nonevaluative, supportive, timely, and specific. She also distinguishes feedback forms that matter for tutor design: correct response, error flagging, hints/prompts, worked examples, and more elaborated feedback that explains what is wrong, why it is wrong, and what to do next. Source: [Shute 2008](https://doi.org/10.3102/0034654307313795)

For LLM tutors, a recent comparative study operationalized the Hattie/Timperley model with six review criteria: Feed Up, Feed Back, Feed Forward, Constructive Tone, Linguistic Clarity, and Technical Terminology. Its main warning is relevant here: LLM feedback can be strong overall while still lagging on Feed Back, especially when it must identify and explain errors in context. Source: [Seßler et al. 2025](https://arxiv.org/abs/2502.12842)

## Tutor Move Rules

1. Open with feed-up when the goal or success criteria are not already explicit. State the target, the standard, or the expected outcome before giving correction.
2. Use feed-back to name the specific gap in the learner’s work. Prefer context-specific error diagnosis over generic praise or generic criticism.
3. Use feed-forward to give one concrete next move. A good next move is a hint, prompt, strategy, or worked example fragment that helps the learner repair the error.
4. Match timing to task difficulty and learning goal. Immediate feedback is usually better for difficult or novel tasks; delayed feedback can be better when the task is simple or when transfer is the main goal.
5. Keep feedback task-focused, not person-focused. Comment on the work, the step, or the misconception. Avoid identity-level judgments.
6. Keep feedback small enough to act on. If there are many issues, chunk them. One correction plus one next step is usually better than a dense wall of commentary.
7. Prefer error-focused feedback over answer-focused feedback when learning is the goal. Explain what is wrong and why, then help the learner repair it. Use answer-only feedback mainly as verification or when the learner needs a quick checkpoint.
8. Increase directness when the learner is blocked, the task is high stakes, or the concept is too difficult for hints alone. Decrease directness when the learner can still self-repair with a prompt.
9. Do not over-explain. If a shorter message can produce the same correction, use the shorter message.

## Evaluation Rubric

Use this as a 0-2 rubric for each dimension. It is a design synthesis from the sources above, not a validated measurement scale.

| Dimension | 2 = strong | 1 = partial | 0 = weak |
| --- | --- | --- | --- |
| Feed up | Goal and success criteria are explicit | Goal is hinted at but vague | No clear goal |
| Feed back | Specific current error is identified in context | Error is mentioned but not well localized | Only says right/wrong or gives vague praise |
| Feed forward | Gives a tailored next step the learner can use now | Gives a generic suggestion | No next step |
| Timing | Arrives when it can still change the learner’s action or support transfer | Timing is acceptable but not optimal | Arrives too late, too early, or is disruptive |
| Specificity | Concrete, bounded, and tied to the task | Somewhat specific but still broad | Vague or generic |
| Directness | Directness is calibrated to the learner’s need | Slightly over- or under-direct | Mismatch is obvious |
| Error focus | Explains the error and the repair path | Mentions the error without enough repair | Gives the answer with little diagnostic value |
| Manageability | One to three actionable points, easy to act on | A bit dense but usable | Overloaded or noisy |
| Tone | Supportive, neutral, nonjudgmental | Mostly fine, but a little evaluative | Discouraging, sarcastic, or person-focused |

## Practical LLM Tutor Heuristics

- If the learner answer is wrong, do not jump straight to the final answer. First localize the misconception or mistake.
- If the learner is stuck after a few attempts, give a more direct hint or worked example fragment instead of repeating the same prompt.
- If the learner is solving a simple drill, delayed feedback or batched feedback may work better than interrupting every step.
- If the learner is doing a complex or novel task, immediate feedback should be available early, then taper toward more independence.
- If the model cannot confidently diagnose the error, say what is uncertain and ask for the missing intermediate step or reasoning.

## Source URLs

- [Hattie & Timperley 2007, The Power of Feedback](https://doi.org/10.3102/003465430298487)
- [Shute 2008, Focus on Formative Feedback](https://doi.org/10.3102/0034654307313795)
- [Seßler et al. 2025, Towards Adaptive Feedback with AI](https://arxiv.org/abs/2502.12842)
