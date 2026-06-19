# Knowledge Tracing And Mastery Models For Tutor Skill Loading

Date: 2026-06-17

## Scope And Caveat

This memo focuses on how knowledge tracing and mastery models can drive tutor skill loading, prompt selection, and evaluation for an LLM tutor.

Scite caveat: I could not access Scite directly from this Codex environment. I did not find a usable Scite connector or install path, so the evidence below is grounded in public arXiv papers, open survey papers, and other primary sources.

## Executive Takeaways

1. Bayesian Knowledge Tracing is the clearest fit for production tutor routing because it gives a simple per-skill mastery probability and is easy to turn into gating rules.
2. Deep Knowledge Tracing is useful when the interaction history is rich and sequence effects matter, but it should be treated as a predictive layer, not the main source of tutor policy, because interpretability is weaker.
3. Item Response Theory is the best fit for item and exercise calibration. It gives a common scale for learner ability and item difficulty, which is useful for matching hints and checks to the current task.
4. Prerequisite graphs add the missing structure that pure mastery scores do not capture. They explain why a learner should not be advanced, and they help choose the next skill or hint.
5. Mastery learning turns these estimates into a concrete teaching rule: keep practicing, re-explaining, and reassessing until the learner crosses a threshold.
6. For an LLM tutor, the right pattern is private learner-state estimation plus small prompt-pack selection, followed by a short student-facing response and a separate evaluation pass.

## Model Summary

| Model | What it estimates | Strength | Main limitation | Best tutor use |
| --- | --- | --- | --- | --- |
| Bayesian Knowledge Tracing | Per-skill mastery probability over time | Transparent, simple, easy to gate on | Binary skill view can be coarse | Route between drill, hint, and advance |
| Deep Knowledge Tracing | Latent learner state from response sequences | Captures richer history and sequence effects | Harder to interpret and debug | Predictive feature layer and offline baseline |
| Item Response Theory | Learner ability and item difficulty on a shared scale | Calibrates items and assessments | Not a full curriculum model by itself | Match task difficulty and compare item banks |
| Prerequisite graph | Directed skill dependencies | Explains ordering and missing foundations | Needs a good domain map | Choose the next skill and justify sequencing |
| Mastery learning | Criterion-based progression | Gives a concrete stop/go rule | Can cause overpractice if naive | Keep tutoring until evidence of mastery |

## Bayesian Knowledge Tracing

BKT models each skill as a hidden mastery state that updates after each observed correct or incorrect response. The classical appeal is operational simplicity: the tutor can maintain a mastery probability per skill and update it after every step.

That simplicity is why BKT still matters in tutoring systems. A recent open-source implementation paper, `pyBKT`, describes BKT as a hallmark of adaptive learning and emphasizes its usefulness for cognitive mastery estimation. A 2026 paper on StanBKT pushes the same idea further by adding Bayesian inference and uncertainty quantification, which is valuable when you want to know not only the point estimate of mastery but also how confident the system should be in that estimate.

For tutor skill loading, BKT is the most practical first layer:

- load a remedial skill pack when mastery is low
- load a guided-practice pack when mastery is uncertain
- load an advancement pack when mastery is high
- keep the student-facing explanation short and task-specific

Useful sources:

- `pyBKT`: https://arxiv.org/abs/2105.00385
- StanBKT: https://arxiv.org/abs/2605.23048
- Knowledge tracing survey: https://arxiv.org/abs/2105.15106

## Deep Knowledge Tracing

DKT models student history with a recurrent sequence model instead of an explicit hidden-state update rule. The original paper showed that sequence models can improve next-response prediction and can be used for curriculum design. Later work also showed why DKT is attractive and why it is controversial: the model can look strong on prediction while becoming hard to interpret as a skill-by-skill learner model.

For tutor loading, the right use of DKT is not to let it directly author pedagogy. It is better as:

- a feature extractor for recent interaction patterns
- a comparison baseline against simpler KT models
- a signal for when BKT-style mastery is missing sequence context

Two cautionary papers are useful here. `How deep is knowledge tracing?` argues that deep models can overstate the value of recurrence. `Back to the Basics` reports that Bayesian extensions of IRT can match or outperform DKT on several data sets. The practical read is that the more opaque model should earn its place by adding predictive value that simpler models cannot match.

Useful sources:

- Deep Knowledge Tracing: https://arxiv.org/abs/1506.05908
- How deep is knowledge tracing?: https://arxiv.org/abs/1604.02416
- Back to the Basics: https://arxiv.org/abs/1604.02336
- Deep-IRT: https://arxiv.org/abs/1904.11738
- DKT2: https://arxiv.org/abs/2501.14256

## Item Response Theory

IRT is the right abstraction when the main question is not just "what does the learner know?" but also "how hard is this item, and how informative is it?" That makes it a strong fit for exercise banks, quizzes, and adaptive checks inside an LLM tutor flow.

The BKT/IRT bridge paper is especially relevant for tutor systems because it shows that these families are closer than they first appear: BKT is longitudinal and IRT is cross-sectional, but both are trying to recover latent proficiency. Deep-IRT then uses IRT to make a deep KT model more explainable by exposing learner ability and item difficulty in the output.

For tutor skill loading, IRT helps with:

- choosing a next item at the right difficulty band
- balancing review items against stretch items
- comparing item banks across courses or semesters
- calibrating evaluation sets so that tutor quality is not measured only on easy prompts

Useful sources:

- IRT review: https://arxiv.org/abs/2108.08604
- Learning meets Assessment: https://arxiv.org/abs/1803.05926
- Deep-IRT: https://arxiv.org/abs/1904.11738
- Back to the Basics: https://arxiv.org/abs/1604.02336

## Prerequisite Graphs

Prerequisite graphs supply the structure that single-skill mastery estimates cannot express. A learner can look strong on one item and still be blocked by a missing prerequisite that the item happened not to expose.

Recent work on prerequisite structure discovery in intelligent tutoring systems explicitly frames knowledge structure and knowledge tracing as complementary. Another line of work, PSI-KT, models both learner progress and prerequisite structure in one hierarchical generative approach. That is the cleanest technical signal for tutor skill loading: the next tutor move should depend on both mastery and dependency order.

For prompt loading, the prerequisite graph should drive:

- which prerequisite to remediate first
- which concept name to use in the hint
- whether to ask a diagnostic question or give a worked micro-example
- whether the current exercise is even admissible yet

Useful sources:

- Prerequisite structure discovery: https://arxiv.org/abs/2402.01672
- PSI-KT: https://arxiv.org/abs/2403.13179
- Concept prerequisite prediction: https://arxiv.org/abs/2312.09802
- Inferring prerequisite relations: https://arxiv.org/abs/1811.12640

## Mastery Learning

Mastery learning is the instructional rule that matters most for tutor operation: do not move on until the learner shows mastery. In practice, that means more than one correct answer. It means repeated evidence, targeted feedback, and the avoidance of premature advancement.

`Mastery Learning in Practice` is a good reminder that real systems often violate the theory. Students do move on without full mastery, and overpractice can become wasteful if the system keeps drilling already-mastered steps. The more recent work on fast-forwarding over-practice steps makes the same point from the other direction: mastery systems should minimize redundant practice once a path is already mastered.

For an LLM tutor, mastery learning implies:

- keep asking until the learner can explain or solve the step
- stop revealing the full answer too early
- switch from guidance to challenge once mastery is high
- reduce unnecessary repetition once a skill path is already secure

Useful sources:

- Mastery Learning in Practice: https://arxiv.org/abs/1802.08616
- Fast-forwarding over-practice: https://arxiv.org/abs/2506.17577
- Mastery learning-like teaching with achievements: https://arxiv.org/abs/1906.03510

## How To Use Learner State In LLM Tutor Prompts

The safest pattern is to keep learner state internal and only expose a compact summary to the generator.

Recommended private state fields:

```json
{
  "mastery_by_skill": {
    "fractions.addition": 0.82,
    "fractions.common_denominator": 0.41
  },
  "prerequisite_gaps": ["fractions.common_denominator"],
  "item_difficulty_band": "medium",
  "recent_misconception": "adds denominators directly",
  "recommended_move": "guided_question",
  "confidence": 0.74
}
```

Prompt loading should then select one small skill pack, not a huge monolithic tutor prompt:

- `diagnostic_repair` when mastery is low and the prereq graph shows a missing foundation
- `guided_practice` when mastery is partial
- `challenge_extension` when mastery is high and the item is too easy
- `review_recap` when confidence is low or history is sparse

Inference from the literature: the learner-state estimate should steer tutor behavior, but the raw probability values should stay private. The student-facing message should speak in pedagogical language, not model jargon.

## How To Evaluate The Tutor

Evaluation should be layered.

Offline KT metrics:

- next-step prediction accuracy
- calibration
- log loss or Brier score
- stability under sparse history

Tutor-quality metrics:

- answer leakage
- quality of the hint or question
- whether the tutor targets the right prerequisite
- concision and turn efficiency
- whether the tutor moves the learner forward without overexplaining

Curriculum metrics:

- time to mastery
- amount of overpractice
- prerequisite violations
- number of turns needed to advance

Outcome metrics:

- performance on a delayed follow-up item
- transfer to a related item
- reduced need for human correction

The most important point is that model accuracy is not tutor quality. A model can predict responses well and still make poor pedagogical decisions.

## Practical Starting Stack

If the goal is to load tutor skills for KlickerUZH with minimal complexity, the best first stack is:

1. BKT or hierarchical BKT for mastery state.
2. A prerequisite graph from course metadata or curated author input.
3. IRT calibration for item difficulty and assessment selection.
4. A small versioned tutor prompt pack selected from that state.
5. A separate evaluation harness that checks pedagogy, not only correctness.

That stack is simple enough to ship, but it already gives the tutor a real student model instead of a generic chat prompt.

## Sources

- https://arxiv.org/abs/2105.00385
- https://arxiv.org/abs/2605.23048
- https://arxiv.org/abs/2105.15106
- https://arxiv.org/abs/1506.05908
- https://arxiv.org/abs/1604.02416
- https://arxiv.org/abs/1604.02336
- https://arxiv.org/abs/1904.11738
- https://arxiv.org/abs/1803.05926
- https://arxiv.org/abs/2108.08604
- https://arxiv.org/abs/2402.01672
- https://arxiv.org/abs/2403.13179
- https://arxiv.org/abs/1811.12640
- https://arxiv.org/abs/1802.08616
- https://arxiv.org/abs/2506.17577
- https://arxiv.org/abs/1906.03510
