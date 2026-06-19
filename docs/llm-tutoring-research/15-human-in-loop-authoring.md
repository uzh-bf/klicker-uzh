# Human-in-the-Loop Review for Generated LLM Tutor Guidance

Date: 2026-06-17

## Scope and caveat

Scite was not available in this environment, so this note uses public arXiv papers and other public research sources instead.

This note focuses on:

1. Asynchronous generation of tutor guidance from course context and chats
2. Exception-based review workflows for AI-assisted tutor guidance
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

## What should be generated automatically

For Klicker tutoring, lecturers should not have to author large misconception,
hint, or rubric libraries by hand. The primary course substrate should be the
generated LightRAG knowledge graph plus Milvus chunks. Optional tutor guidance
should be generated asynchronously from course data, tutor chats, eval failures,
and repeated student misconceptions.

Recommended generated fields:

| Field                             | Why it matters                                                |
| --------------------------------- | ------------------------------------------------------------- |
| Knowledge graph concept           | Anchors guidance to generated course concepts                 |
| Source chunks                     | Keeps guidance auditable against Milvus-backed evidence       |
| Recurring misconception candidate | Captures patterns observed in chats/evals                     |
| Hint ladder candidate             | Suggests scaffold levels for repeated issues                  |
| Rubric candidate                  | Makes review and scoring repeatable for high-value tasks      |
| Forbidden shortcut candidate      | Prevents answer leakage and unsafe help                       |
| Evidence strength                 | Distinguishes validated content from tentative content        |
| Course scope                      | Marks whether the guidance is reusable or local to one course |
| Accessibility / locale notes      | Keeps the output usable across audiences                      |
| Review status                     | Makes optional promotion governance explicit                  |

This is an inference from the combined literature plus Klicker's product
constraints: human review is valuable, but only if the system keeps review
queues small and tied to clear impact.

## Review workflow

A practical review loop for tutor guidance is:

1. LightRAG and Milvus provide course-grounded concepts, relationships, and source chunks.
2. Tutor chats and eval failures are mined asynchronously for recurring issues.
3. The model proposes compact guidance candidates with source and telemetry evidence.
4. Only high-impact, low-confidence, or conflicting candidates enter a lecturer review queue.
5. The reviewer approves, suppresses, or edits the candidate.
6. Approved guidance is versioned and linked to source chunks and telemetry.
7. Student telemetry feeds the next revision cycle.

This workflow is supported by several lines of evidence:

- A question-generation study found that teachers prefer to work with AI-generated quiz drafts, especially when the drafts are grounded in explicit learning goals such as Bloom-aligned objectives ([Elkins et al. 2024](https://arxiv.org/abs/2401.05914)).
- A course-content framework for educators frames GenAI as an aid for instructional development, not a replacement for pedagogical design ([Dickey and Bejarano 2023](https://arxiv.org/abs/2308.12276)).
- A tutor-training lesson generation study found that task decomposition and human rubrics improved the quality of AI-generated learning lessons compared with single-step generation ([Lin et al. 2025](https://arxiv.org/abs/2506.17356)).
- A field study on AI-generated exams used repeated critique and revision to improve item quality across many classes ([Isley et al. 2025](https://arxiv.org/abs/2508.08314)).

## Rubrics and expected solutions

Rubrics should be first-class objects when they exist, but they should not block
initial tutor launch. Start with eval rubrics and generated candidates; promote
course/task rubrics only for high-value exercises.

Why:

- LLM-based scoring is much more stable when a manual rubric defines the dimensions of interest ([Hashemi et al. 2024](https://arxiv.org/abs/2501.00274)).
- Human-authored rubrics preserve the instructor's actual grading policy and can be calibrated against model scoring, rather than inferred ad hoc.
- For tutor content, rubric fields should separate correctness, partial credit, common wrong reasoning, and communication quality.

For expected solutions, the key design choice is to store both:

- the canonical solution the lecturer wants students to learn
- the acceptable alternative solution shapes that should still earn full credit

That separation matters because LLMs tend to anchor on a single exemplar unless the authoring workflow makes alternatives explicit.

## Misconceptions and hints

The research points toward storing misconceptions as structured diagnosis
objects rather than free-text notes. For this product, those objects should be
generated from LightRAG/Milvus context and repeated chat/eval patterns, then
optionally reviewed.

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

That ladder is not just a runtime policy. It should be visible when generated
guidance is reviewed so lecturers can quickly see how much help each stage would
reveal, without having to write the ladder from scratch.

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

- tutor can launch without promoted guidance items, using LightRAG/Milvus retrieval
- every promoted guidance item has provenance, version, and evidence level
- every promoted guidance item can be withdrawn or superseded
- any AI-generated suggestion remains distinct from reviewed content
- review queues stay compact and impact-ranked

## Klicker workflow proposal

Best fit for Klicker: an async guidance distillation pipeline attached to a
course, unit, or chatbot, with optional compact review queues for high-impact
misconceptions, hint ladders, and eval failures.

Suggested flow:

1. Course documents are ingested into LightRAG and Milvus.
2. Tutor runs from retrieved graph/chunk context plus generic tutor policy.
3. Klicker asynchronously mines chats, evals, and retrieval traces for:
   - recurring misconceptions
   - weak or missing sources
   - hint levels that fail repeatedly
   - answer-leakage risks
   - high-value exercise rubrics
4. Klicker shows only compact, impact-ranked proposals in a review queue.
5. Lecturer approves, suppresses, or edits proposals when useful.
6. Klicker stores promoted guidance with provenance, version, and review metadata.
7. Student attempts, hint requests, and common failure modes are logged back into the revision queue.

Minimal schema for the stored artifact:

- `course_scope`
- `objective`
- `source_chunk_ids`
- `kg_entity_ids`
- `kg_relationship_ids`
- `guidance_type`
- `guidance_payload`
- `confidence`
- `impact_score`
- `review_status`
- `version`
- `evidence_level`
- `provenance`

Why this fits the literature:

- It keeps handcrafted pedagogy in human control ([Chowdhury et al. 2024](https://arxiv.org/abs/2402.09216)).
- It uses AI for drafts and refinement, which is where the scale advantage is strongest ([Elkins et al. 2024](https://arxiv.org/abs/2401.05914), [Isley et al. 2025](https://arxiv.org/abs/2508.08314)).
- It makes the review loop visible, which is the main lesson from human-centered LA/AIED work ([Alfredo et al. 2023](https://arxiv.org/abs/2312.12751)).

## Practical takeaway

The safest and most useful first version is a retrieval-first tutor using
LightRAG/Milvus context. Generated tutor guidance should come later as an async
distillation layer, with lecturer review only for compact high-impact proposals.

If Klicker does that well, it gets:

- reusable generated misconception and hint guidance
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
