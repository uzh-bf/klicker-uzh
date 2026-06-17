# Classic ITS and Tutoring Systems

Scite was not available in this environment, so this note uses official project pages, arXiv abstracts, and indexed paper references instead.
For Andes and a few older Cognitive Tutor references, direct primary-text retrieval was thinner here, so those items are treated as lower-confidence signposts rather than full paper reads.

## Key Findings

Classic intelligent tutoring systems converged on the same core idea: make the learner work on a concrete skill, observe each step, update a skill model, and intervene with the smallest useful next move.

The main design split is between step-based tutors and dialogue-based tutors. Cognitive Tutor, Andes, ASSISTments, and CTAT-centered tutors focus on step tracing, skill components, and hint ladders. AutoTutor focuses on mixed-initiative dialogue, explanation, and Socratic prompting. The modern LLM lesson is that free chat is not enough; the pedagogy has to be wrapped in a control structure.

The strongest repeated pattern across the literature is not "give more text" but "give better control": explicit skills, immediate feedback, targeted hints, and mastery tracking. The latest AutoTutor/LLM paper makes the same point directly: LLMs can fill content gaps, but the pedagogical design still needs to be handcrafted for best results. Source: [AutoTutor meets Large Language Models](https://arxiv.org/abs/2402.09216)

Evaluation evidence is strongest when the tutor is embedded in a real course and the outcome is measured against a comparable control condition. ASSISTments is a good example: its official evidence page reports 2012-2015 Maine results of 46 schools and 2769 seventh graders with effect size .22, plus 2018-2021 North Carolina results of 63 schools and 5991 seventh graders with delayed effect size .10. Source: [ASSISTments Evidence of Impact](https://www.assistments.org/evidence-of-impact)

## Evidence Table

| System | Tested pedagogy or policy | Skill model or mastery logic | Evidence that matters | LLM tutor mapping |
| --- | --- | --- | --- | --- |
| AutoTutor | Mixed-initiative Socratic dialogue, open-ended questions, prompts, corrections, hints, and affect-aware adaptation | Dialogue state plus learner model; content is organized as a scripted tutor conversation | Indexed summary reports over a dozen experiments and mean effect size around 0.8 across studies | Use a dialogue policy, not a free-form chat loop; keep answer leakage blocked; route through prompt, hint, and bottom-out stages |
| Andes | Step-by-step procedural help in physics problem solving; immediate feedback when students deviate from a correct path | Procedural model tracing and hint generation; historically associated with Bayesian-network student modeling in indexed summaries | Good fit for expert-like problem solving in physics; the broader ITS review literature treats Andes as a canonical step-based tutor | Map each problem step to an explicit skill node and generate next-step hints from that node, not from the whole conversation |
| Cognitive Tutor | Worked examples, learning by doing, immediate step feedback, metacognitive help-seeking support | Production-rule model tracing plus knowledge tracing / mastery thresholds | Large-scale effectiveness trials and log analyses show gains, but also show that students and teachers often depart from the intended mastery path | Build a per-skill mastery tracker and record when the learner skips, guesses, or asks for help too early |
| ASSISTments | Homework-first formative assessment with immediate correctness feedback, hints, explanations, and teacher reports | Skill-aligned item and problem logs that support reporting and adaptive selection | Official evidence page reports 60% more learning in Maine and delayed gains in North Carolina; smaller studies on immediate feedback also show positive effects | Keep teacher dashboards and learner hints in the same system; log every intervention so teachers can see what was learned |
| CTAT / CTAT+TutorShop | Authoring and research workflow for building tutors, logging data, and running experiments | Lets authors create model-tracing or other tutor elements and export logs compatible with DataShop | CTAT+TutorShop paper says the platform has supported an estimated 147 studies and full research lifecycle workflows | Treat tutor content as authored skill modules with logging, replay, and experiment hooks, not as a single prompt |
| Apprentice Tutors | Adult learner support with adaptive selection, real-time correctness feedback, multi-layer hints, and progress bars | Knowledge components with progress tracking across tutors | 2025 observational study reports evidence of learning within tutors and higher course assessment scores after tutor use | The same skill-pack structure should work for adult re-skilling if the tutor keeps a stable skill map and progress UI |

## Tested Skills, Prompts, Policies

- Ask for an explanation before giving away the answer.
- Use a hint ladder: prompt, targeted hint, worked substep, bottom-out answer.
- Keep feedback local to the current skill or step, not global to the student.
- Track mastery per knowledge component and update it after each relevant attempt.
- Detect and discourage help-seeking shortcuts such as immediate hint surfing or bottoming out.
- Provide teacher-facing summaries when the system is used in a classroom or homework setting.
- Preserve the log of learner actions, hint requests, and overrides so the tutor can be evaluated and improved.
- Separate the content model from the control policy so the pedagogy can change without rewriting the whole tutor.

## Implications for Klicker Tutor

The most practical mapping for KlickerUZH is a skill-pack architecture:

1. Each tutoring unit should expose explicit skills or knowledge components.
2. Each skill should have a short prompt sequence, a hint ladder, and a mastery rule.
3. The LLM should generate wording, not policy. Policy should decide when to prompt, hint, explain, or stop.
4. Teacher visibility matters. A tutor that cannot show what a learner has practiced, missed, or mastered is weaker than the classic systems.
5. The evaluation target should be two-layered: local skill gains and transfer beyond the tutor.
6. For open-ended explanations, use AutoTutor-style dialogue. For procedural steps, use Cognitive Tutor / ASSISTments-style step checking.
7. For tutor authoring, borrow from CTAT: define reusable tutor modules, logs, and experiment hooks.

## Open Questions

- How large should one Klicker skill be: a single procedural step, a micro-concept, or a whole problem type?
- Which mastery rule is simplest enough to ship first but strong enough to avoid random hint spam?
- How much dialogue is worth keeping before the tutor becomes slower than a step-based scaffold?
- How should the tutor distinguish a productive struggle from a learner who is just stuck?
- What is the minimum teacher dashboard that still preserves the classroom value of ASSISTments-style reporting?
- Can an LLM tutor stay pedagogically stable if the underlying model changes, or must the policy be versioned separately?

## Source Index

- [AutoTutor home](https://start.autotutor.org/)
- [AutoTutor overview and indexed references](https://en.wikipedia.org/wiki/AutoTutor) - used only as a pointer to the older paper trail when the original site was not directly reachable here.
- [AutoTutor meets Large Language Models](https://arxiv.org/abs/2402.09216)
- [ASSISTments home](https://www.assistments.org/)
- [ASSISTments evidence of impact](https://www.assistments.org/evidence-of-impact)
- [CTAT+TutorShop](https://arxiv.org/abs/2502.10395)
- [Apprentice Tutors observational study](https://arxiv.org/abs/2502.16613)
- [Cognitive Tutor and KLI indexed references](https://en.wikipedia.org/wiki/Cognitive_tutor) - used only as an index into the classic citation trail when direct full text access was limited.
- [Cognitive Tutor mastery learning analysis](https://arxiv.org/abs/1802.08616)
- [Cognitive Tutor mastery learning and latent mastery model](https://arxiv.org/abs/1707.09308)
- [Physics education review that discusses Andes in context](https://arxiv.org/abs/physics/0703224)
