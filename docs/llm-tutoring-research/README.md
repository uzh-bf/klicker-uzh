# LLM Tutoring Research Threads

Date: 2026-06-17

Purpose: shared topic-level research notes for a later consolidated tutoring/evaluation plan.

Scite status: Scite was requested, but no Scite connector/tool was available in this Codex environment at launch time. Each researcher should record whether Scite was available in its subagent environment. If not, findings should use web search, paper search, official project pages, and public paper repositories.

## Topic Files

- `01-classic-its.md` - classic tutoring systems and intelligent tutoring systems - complete
- `02-learning-science.md` - learning science foundations - complete
- `03-formative-feedback.md` - formative feedback theory - complete
- `04-knowledge-tracing.md` - knowledge tracing and mastery models - complete
- `05-misconception-libraries.md` - math and finance misconception libraries - complete
- `06-feedback-uptake.md` - feedback uptake and learning outcome measurement - complete
- `07-pedagogical-safety.md` - pedagogical safety - complete
- `08-adaptive-hints.md` - adaptive hint sequencing - complete
- `09-socratic-limits.md` - Socratic tutoring limits - complete
- `10-metacognition.md` - metacognitive tutoring and self-regulated learning - complete
- `11-motivation-affect.md` - motivation and affective support - complete
- `12-course-grounded-rag.md` - course-grounded RAG for tutoring - complete
- `13-multimodal-tutoring.md` - multimodal tutoring - complete
- `14-prompt-program-architectures.md` - prompt/program architectures for tutors - complete
- `15-human-in-loop-authoring.md` - human-in-the-loop tutor authoring - complete

## Cross-Cutting Themes

- Tutor should operate from structured state: learner state, current skill, misconception hypothesis, hint depth, retrieved evidence ids, and prior attempts.
- Pedagogy should be a policy, not only tone: choose one move, control answer leakage, avoid over-intervention, and shift between Socratic prompts, hints, explanation, and worked micro-steps.
- Evaluation must combine rubric quality with behavior: next-attempt uptake, improvement, delayed transfer, leakage rate, citation fidelity, and student effort.
- Lecturer-authored artifacts are high leverage: expected solution paths, misconception libraries, hint ladders, rubrics, source material, and task policies.
- Course-grounded retrieval must be audited separately: correct answer is not enough if citation support, abstention, or course terminology fails.
- Multimodal tutoring needs explicit failure handling: OCR drift, layout loss, chart/table misread, image-description ambiguity, and hallucinated visual details.
- Scite was unavailable in every subagent environment; all notes record this and use public paper/web sources.

## Consolidation Targets

- `tutor-skills-v1`: hidden state classifier, first-error diagnosis, move selector, hint ladder, leakage gate, metacognitive check, affect/tone policy, course-grounding policy.
- `tutor-eval-v1`: MathTutorBench plus local transcript rubric, pedagogical safety suite, feedback uptake events, citation-fidelity tests, multimodal stress cases.
- `authoring-v1`: lecturer workflow for misconception lists, solution paths, hint ladders, rubrics, review/approval, versioning, and telemetry-driven revision.
- `architecture-v1`: Retriever -> hidden planner/verifier -> presenter, with versioned state and auditable tutor moves.

## Consolidation Plan

After all topic files exist:

1. Check source coverage and citation quality.
2. Extract reusable tutor skills and evaluation metrics.
3. Merge findings into `docs/llm-tutoring-research/LLM_TUTORING_RESEARCH.md`.
4. Create an implementation slice for MathTutorBench plus `tutor-skills-v1`.
