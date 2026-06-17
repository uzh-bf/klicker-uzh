# Human-in-the-Loop Authoring for LLM Tutors

Date: 2026-06-17

## Scope and caveat

Scite was not available in this environment, so this note uses public arXiv papers and other public research sources instead.

This note focuses on:

1. Lecturer authoring of misconceptions, hints, rubrics, and expected solutions
2. Review workflows for AI-assisted item and tutor authoring
3. Learning engineering as an iterative design-and-measure loop
4. Governance, provenance, and human control
5. A Klicker-specific workflow proposal

## Core claim

The strongest pattern in the literature is not "let the model author the tutor."
It is "let the model draft, but keep the pedagogical spec, review, and release decision human-owned."

That shows up in several places:

- Teachers can benefit from LLM-assisted quiz generation, and the resulting quizzes are not worse than hand-written ones in the studied setting ([Elkins et al. 2024](https://arxiv.org/abs/2401.05914)).
- AI-generated learning resources can be comparable to peer-generated resources, but they tend to mirror the provided exemplars closely, which makes human review and course-specific adaptation important ([Denny et al. 2023](https://arxiv.org/abs/2306.10509)).
- End-to-end tutoring systems still need handcrafted pedagogy and guardrails; LLMs can fill a predefined tutoring structure, but they should not improvise the whole interaction ([Chowdhury et al. 2024](https://arxiv.org/abs/2402.09216)).
- AI-generated exams improve when generation is followed by critique and revision cycles, which is exactly the kind of workflow a lecturer-facing authoring tool should expose ([Isley et al. 2025](https://arxiv.org/abs/2508.08314)).

## What lecturers should author explicitly

For LLM tutoring, the lecturer should author the stable pedagogical facts and policy constraints, not just the final prompt text.

Recommended authored fields:

| Field | Why it matters |
| --- | --- |
| Learning objective | Anchors the item to the course goal |
| Expected solution | Gives the tutor a reference answer and scoring anchor |
| Allowed solution variants | Prevents overfitting to one path |
| Common misconceptions | Enables targeted hints and distractors |
| Hint ladder | Controls how direct the tutor may be |
| Rubric dimensions | Makes review and scoring repeatable |
| Forbidden shortcuts | Prevents answer leakage and unsafe help |
| Evidence strength | Distinguishes validated content from tentative content |
| Course scope | Marks whether the artifact is reusable or local to one course |
| Accessibility / locale notes | Keeps the output usable across audiences |
| Review status | Makes release governance explicit |

This is an inference from the combined literature, not a direct claim from one paper: authoring works better when the human writes the pedagogical intent, while the model drafts the surface form.

## Review workflow

A practical review loop for tutor content is:

1. Lecturer creates a structured spec for the item, hint, rubric, or tutor dialogue.
2. The model drafts candidates from that spec.
3. A human reviewer checks correctness, pedagogical fit, answer leakage, and tone.
4. The reviewer either approves, edits, or sends the draft back for regeneration.
5. The released artifact is versioned and linked to the course context.
6. Student telemetry feeds the next revision cycle.

This workflow is supported by several lines of evidence:

- A question-generation study found that teachers prefer to work with AI-generated quiz drafts, especially when the drafts are grounded in explicit learning goals such as Bloom-aligned objectives ([Elkins et al. 2024](https://arxiv.org/abs/2401.05914)).
- A course-content framework for educators frames GenAI as an aid for instructional development, not a replacement for pedagogical design ([Dickey and Bejarano 2023](https://arxiv.org/abs/2308.12276)).
- A tutor-training lesson generation study found that task decomposition and human rubrics improved the quality of AI-generated learning lessons compared with single-step generation ([Lin et al. 2025](https://arxiv.org/abs/2506.17356)).
- A field study on AI-generated exams used repeated critique and revision to improve item quality across many classes ([Isley et al. 2025](https://arxiv.org/abs/2508.08314)).

## Rubrics and expected solutions

Rubrics should be first-class authored objects, not a hidden prompt fragment.

Why:

- LLM-based scoring is much more stable when a manual rubric defines the dimensions of interest ([Hashemi et al. 2024](https://arxiv.org/abs/2501.00274)).
- Human-authored rubrics preserve the instructor's actual grading policy and can be calibrated against model scoring, rather than inferred ad hoc.
- For tutor content, rubric fields should separate correctness, partial credit, common wrong reasoning, and communication quality.

For expected solutions, the key design choice is to store both:

- the canonical solution the lecturer wants students to learn
- the acceptable alternative solution shapes that should still earn full credit

That separation matters because LLMs tend to anchor on a single exemplar unless the authoring workflow makes alternatives explicit.

## Misconceptions and hints

The research points toward authoring misconceptions as structured diagnosis objects rather than free-text notes.

Useful fields for each misconception:

- short label
- plain-language description
- diagnostic cue
- example student move or wrong answer
- corrective hint
- related misconceptions
- confidence or evidence rating

This matches the broader pattern in LLM tutoring research: the tutor should infer the likely misconception privately, then choose a pedagogical move that fits the learner state.

For hints, the authoring tool should support a ladder:

1. orientation
2. instrumental hint
3. worked example
4. bottom-out hint

That ladder is not just a runtime policy. It should be visible during authoring so lecturers can decide how much help each stage is allowed to reveal.

## Learning engineering framing

Human-in-the-loop tutor authoring is a learning engineering problem:

- design the artifact
- instrument its use
- measure the outcome
- revise the artifact

The literature on human-centered AI in education emphasizes stakeholder involvement across design phases, plus explicit attention to safety, reliability, trustworthiness, and human control ([Alfredo et al. 2023](https://arxiv.org/abs/2312.12751)).

That is the right fit for a tutor authoring system because the system is not finished when the item is published. It is finished when:

- students can use it productively
- the lecturer can revise it cheaply
- the platform can show evidence that the content is working

## Governance

The governance problem is that educational AI systems exercise epistemic authority. If they are going to shape student understanding, the structure behind that output has to be inspectable and revisable.

Relevant governance signals from the literature:

- Human-centered reviews of AI in higher education warn that current systems often underuse stakeholder involvement and over-centralize automation ([McConvey et al. 2023](https://arxiv.org/abs/2302.05839)).
- Reviews of bias in educational LLMs argue for lifecycle thinking, since bias can enter at data, adaptation, evaluation, and deployment time ([Lee et al. 2024](https://arxiv.org/abs/2407.11203)).
- A 2026 governance paper on educational AI argues for structural transparency and explicit representations of concepts, prerequisite relations, misconceptions, and scaffolding ([Li et al. 2026](https://arxiv.org/abs/2602.16949)).

Practical governance rules for Klicker:

- no publish without human approval
- every artifact has an owner, version, and review date
- every artifact records source material and evidence level
- every artifact can be withdrawn or superseded
- any AI-generated suggestion remains distinct from human-approved content

## Klicker workflow proposal

Best fit for Klicker: a course-scoped authoring record attached to a unit or block, with separate tabs for item, hint, rubric, and solution.

Suggested flow:

1. Lecturer selects the course context and learning objective.
2. Lecturer enters the canonical solution, known misconceptions, and grading policy.
3. Klicker asks the model to draft:
   - the item stem
   - hint ladder variants
   - rubric dimensions
   - expected solution
   - distractors or wrong-answer examples
4. Klicker shows the draft in a review queue with diff view and accept/reject controls.
5. Lecturer edits the draft and approves the final version.
6. Klicker stores the published artifact with provenance, version, and review metadata.
7. Student attempts, hint requests, and common failure modes are logged back into the revision queue.

Minimal schema for the stored artifact:

- `course_scope`
- `objective`
- `prompt_or_item`
- `expected_solution`
- `allowed_variants`
- `misconceptions`
- `hint_ladder`
- `rubric`
- `review_status`
- `owner`
- `version`
- `evidence_level`
- `provenance`

Why this fits the literature:

- It keeps handcrafted pedagogy in human control ([Chowdhury et al. 2024](https://arxiv.org/abs/2402.09216)).
- It uses AI for drafts and refinement, which is where the scale advantage is strongest ([Elkins et al. 2024](https://arxiv.org/abs/2401.05914), [Isley et al. 2025](https://arxiv.org/abs/2508.08314)).
- It makes the review loop visible, which is the main lesson from human-centered LA/AIED work ([Alfredo et al. 2023](https://arxiv.org/abs/2312.12751)).

## Practical takeaway

The safest and most useful first version is a human-owned authoring pipeline where lecturers specify the pedagogy and the model fills in draft content.

If Klicker does that well, it gets:

- reusable lecturer-authored misconception and hint libraries
- rubric-backed review for items and tutor responses
- cheaper content iteration
- clearer governance
- better telemetry for learning engineering

## Source URLs

- https://arxiv.org/abs/2401.05914
- https://arxiv.org/abs/2306.10509
- https://arxiv.org/abs/2402.09216
- https://arxiv.org/abs/2508.08314
- https://arxiv.org/abs/2308.12276
- https://arxiv.org/abs/2506.17356
- https://arxiv.org/abs/2501.00274
- https://arxiv.org/abs/2312.12751
- https://arxiv.org/abs/2302.05839
- https://arxiv.org/abs/2407.11203
- https://arxiv.org/abs/2602.16949
