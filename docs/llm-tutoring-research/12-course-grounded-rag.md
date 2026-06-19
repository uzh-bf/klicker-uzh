# Course-Grounded RAG for Tutoring

Date: 2026-06-17

## Scope and caveat

Scite was not available in this environment, so this note uses primary papers and official repository / paper pages instead of Scite citation summaries.

Course-grounded RAG for tutoring is not just "answer with lecture notes attached". The retrieval layer has to decide whether the question is answerable from course material, select the smallest useful evidence set, and keep the generation layer inside that evidence boundary. For tutoring, the real target is not fluent completion; it is faithful, course-aligned support that helps the student make the next move.

## What the research says

The original RAG paper is still the core baseline: combine parametric memory with explicit non-parametric memory so answers can be grounded in external evidence and updated without retraining the whole model. That is the right abstraction for course material because lecture content changes, and provenance matters. Source: [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401)

But fixed retrieve-on-every-turn pipelines are too blunt. Self-RAG shows that retrieval should be conditional and that the model should critique its own output and the retrieved passages rather than blindly consuming a fixed top-k set. This is especially relevant for tutoring because many student questions are answerable from prior context, while others need a follow-up question or a different retrieval query. Source: [Self-RAG](https://arxiv.org/abs/2310.11511)

Retrieval failure is a first-class problem, not an edge case. CRAG explicitly asks what happens when retrieval is weak or wrong, and its answer is to evaluate retrieved documents, trigger corrective actions, and decompose/recompose the evidence before generation. For tutoring, that maps cleanly to an abstain / re-retrieve / clarify / general-explanation fallback ladder. Source: [Corrective Retrieval Augmented Generation](https://arxiv.org/abs/2401.15884)

Context selection matters more than raw context size. Lost-in-the-middle results show that relevant evidence in long contexts is often underused, and LongLLMLingua shows that prompt compression can improve both cost and quality by keeping the key information dense. The implication for a course tutor is that "more chunks" is not a strategy; rerank, compress, and keep the evidence close to the question. Sources: [Lost in the Middle](https://arxiv.org/abs/2307.03172), [LongLLMLingua](https://arxiv.org/abs/2310.06839)

Citation quality must be evaluated separately from answer quality. Attributed QA work makes attribution a distinct evaluation problem, and attributed information-seeking work shows that generation architecture affects both correctness and attributability. In other words, a tutor can give a correct answer and still fail if the cited lecture chunk does not support the claim. Sources: [Attributed Question Answering](https://arxiv.org/abs/2212.08037), [An Evaluation Framework for Attributed Information Retrieval using Large Language Models](https://arxiv.org/abs/2409.08014)

Groundedness research makes the same point from another angle: even when a long-form answer is correct, sentences can still be ungrounded in the retrieved evidence. RAGTruth provides a hallucination corpus for exactly this failure mode. For tutoring, this means we should score claim support, not just final correctness. Sources: [Groundedness in Retrieval-augmented Long-form Generation](https://arxiv.org/abs/2404.07060), [RAGTruth](https://arxiv.org/abs/2401.00396)

The closest tutoring-specific precedent I found is KITE, a retrieval-augmented tutoring system for algorithm tracing and problem solving in AI education. Its design is useful because it combines intent-aware Socratic responses, course-material retrieval, and evaluation with grounding metrics, pedagogical review, and simulated student follow-up. Source: [Retrieval-Augmented Tutoring for Algorithm Tracing and Problem-Solving in AI Education](https://arxiv.org/abs/2605.12988)

## Course alignment policy

For Klicker, course alignment should be explicit in the retrieval layer, not implied by the prompt.

- Filter by course and teaching unit before broad semantic search.
- Prefer generated course-grounded context first: LightRAG knowledge graph nodes/relationships plus Milvus chunks from slides, exercises, solution snippets, definitions, formulas, and worked examples.
- Keep course metadata attached to every chunk: course, lecture, week, language, topic, source type, and version.
- If multiple course sources conflict, do not synthesize silently. Surface the conflict or ask for clarification.
- If retrieval finds only weakly related material, say so and switch to a general explanation that is clearly labeled as background, not course-grounded fact.

This is partly an inference from the literature and partly a product constraint: tutoring is trustworthy only when the student can tell whether the answer came from the course or from general model knowledge.

## Citation, quote, and paraphrase policy

The safe default is paraphrase plus citation.

- Quote only when exact wording matters, such as definitions, theorem statements, formulas, or lecturer-specific phrasing that the student needs to see verbatim.
- Keep quotes short and tie them to one retrieved chunk.
- Prefer paraphrase for explanations, summaries, and comparisons.
- Do not stitch together long verbatim passages from lecture notes.
- Do not cite course material that was not actually retrieved.

This policy is an inference from the attribution / groundedness papers above and from Klicker’s need to avoid false authority. It is not a universal copyright rule, but it is the right operational default for a tutoring product.

## How the tutor should fail

When the retrieved evidence is insufficient, the tutor should fail in a controlled way:

1. State that the course material does not yet support a confident answer.
2. Ask one clarifying question if the issue is ambiguity.
3. Offer a general explanation only if it can be clearly labeled as background.
4. Avoid inventing lecture references, page numbers, or "as discussed in class" claims.
5. Keep the response short so the student can continue the search or provide more context.

That failure mode is better than overconfident guessing because it preserves trust in the course boundary.

## Klicker-specific skill recommendations

For the tutor itself, the useful skill pack is small and explicit:

- retrieve_course_context
- check_answerability
- cite_supported_claims
- abstain_or_clarify
- paraphrase_with_source
- conflict_detection

The current Klicker chat stack already exposes a lecture-content search tool (`KB.doc_query` in the chat UI), so the first iteration should improve retrieval policy and grounding discipline before adding more complex agent behavior. The goal is to make the tutor choose evidence better, not to make it speak longer.

## Klicker-specific eval recommendations

Benchmark the tutor on a small course-grounded set before shipping prompt changes.

- Direct answerable question: the course has one clear supporting chunk.
- Missing context: no chunk supports the claim, so the tutor should abstain or clarify.
- Wrong but plausible chunk: retrieval returns a semantically similar lecture passage that does not support the answer.
- Conflict case: two course chunks disagree or come from different lecture versions.
- Quote trap: the student asks for exact wording; the tutor should quote sparingly and cite the source.
- Paraphrase trap: the student asks for a "summary"; the tutor should not copy long passages.
- Hallucination pressure: the student asks for a lecture citation that was not retrieved.

Score each case on:

- support precision
- citation fidelity
- abstention accuracy
- irrelevant retrieval rate
- terminology alignment
- quote / paraphrase discipline
- student next-step usefulness

For UI-facing changes, verify the provenance display with `agent-browser` so the student can actually see which retrieved sources supported the answer.

## Source URLs

- https://arxiv.org/abs/2005.11401
- https://arxiv.org/abs/2310.11511
- https://arxiv.org/abs/2401.15884
- https://arxiv.org/abs/2307.03172
- https://arxiv.org/abs/2310.06839
- https://arxiv.org/abs/2212.08037
- https://arxiv.org/abs/2409.08014
- https://arxiv.org/abs/2404.07060
- https://arxiv.org/abs/2401.00396
- https://arxiv.org/abs/2605.12988
