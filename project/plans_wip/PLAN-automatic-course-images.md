# Automatic helpful course-image selection

Goal: a Participant asking a conceptual course question can receive a relevant
original figure without explicitly requesting one. Preserve explicit requests
and honor requests for text only. Select only with support from retrieved
passages; skip weak associations and simple facts that need no illustration.

Scope: Chat system instructions and show_course_image tool contract. Require a
short selection reason, persist it with the tool result, and explain relevance
in the answer. Existing image cards, authenticated participant/message/KB checks,
three-image limit, and manifest validation remain unchanged. No schema, GraphQL,
i18n, points/XP, leaderboards, workers, or ingestion changes. No pixel inspection
or new generated captions. Existing passage context supplies selection evidence.

Verification: existing image and prompt tests, complete Chat suite, direct Chat
TypeScript check, and Azure browser cases: conceptual BFI question, factual
question, unrelated/no-relevant-figure question. User has authorized BFI excerpts
reaching this configured Azure provider. Keep private artifacts outside Git.

Baseline: codex/course-image-reference-baseline. Work branch:
codex/automatic-course-images. Implemented; verification results below.

Live trials showed prompt-only instructions could skip retrieval or ask permission.
Require course search followed by a select-or-skip tool decision whenever image
tools are enabled. A null asset_id records skipped and produces no image card.
This adds a search and decision round trip; later tool steps remain automatic.
The final schema asks for the rationale first and defaults simple definitions,
facts, text-only requests, and unsupported topics to no image.


Verification: 616 Chat tests pass (21 existing integration skips); direct Chat
TypeScript check passes. Browser Azure GPT-4.1 selected the original BFI page 9
figure for a relationship question without an explicit image request. A short
definition and an unrelated-topic question produced no new image. Earlier
prompt-only iterations skipped retrieval/selection or over-selected a figure;
these trials are development evidence, not a broad relevance evaluation.
The local BM25 component can return irrelevant candidates; the model decision
is still probabilistic and does not establish that all answer claims are correct.

Final browser check repeated the conceptual question under the stricter skip
criteria and again selected page 9. After reload, its original 587×186 PNG
loaded successfully. Evidence thread: 9f2e8d09-80cb-482b-9811-654265f9d4ff.

## Scope correction

Restore the existing mode-specific tool policy; image availability must not force
search or selection. Preserve all returned passages and ordering. Remove the
private local adapter's image-only filter for ordinary queries. Explicit page
requests use chunk page provenance, including text-only pages. Retain optional
image selection and all authorization checks. No ranking, embedding, reranker,
provider, or production retrieval changes. The local BM25 adapter remains a demo,
not evidence of production retrieval quality. Earlier forced-step trial results
above describe the superseded implementation.

Verify automatic tool choice, exact search-result preservation, explicit selection
and skip contracts with the Chat suite; check local retrieval against unfiltered
BM25 output. Production Milvus integration is a separate runtime verification gap.

Verification after scope correction: 617 Chat tests passed, 21 existing integration skips; TypeScript and diff checks passed. Explicit BFI physical page 9 request searched and displayed the figure voluntarily (thread 4942df9a-6520-4e70-8f24-aa06802e111d). The vague company-money question answered without search or image (thread 192a4602-859b-4e18-9525-831e9e9e0bd7). This proves the optional flow, not proactive-selection quality. Replaying the original vague search still returned pages 40, 169, 170 after removing image filtering; its relevance limitation remains in local keyword retrieval.

## Full retrieval runtime integration

Reuse ingestion embed_chunks + MilvusAdminStore/DocumentWriter and doc-query setup_pipeline/run_query. Keep BFI corpus and runner outside Git, use a new local collection, preserve metadata, and refuse reranker fallback as successful full retrieval. Runtime configuration: Azure text-embedding-3-small (1536 dimensions), hybrid Milvus retrieval top 100, existing GPT-4.1 LLM reranker top 20, documents response mode. No new query rewriting or search-forcing policy. Add an opt-in local embedding alias; existing OpenRouter alias stays unchanged. Dry run: 621 original chunks; synthetic direct/proxy embedding checks passed. Full BFI embedding awaits destination/payload-specific user approval after automatic approval review rejected reuse of the earlier GPT-4.1 excerpt permission.

Synthetic full-path verification passed: existing embed_chunks produced a 1536-dimensional vector; Milvus hybrid search plus the existing GPT-4.1 reranker returned the synthetic source and original figure reference on physical page 2, with no reranker fallback. The post-write count initially raced bounded consistency; the runner now flushes before verification. BFI cutover and vague-question browser comparison remain pending embedding approval. Prepared runner is stored with the private BFI artifacts, outside Git. The existing BM25 demo remains connected.

Full BFI integration completed after explicit embedding approval: 621 chunks indexed, metadata/text preserved, 1536-dimensional vectors, flush/count verification passed. Existing port 28518 now serves full retrieval; old BM25 process stopped. Three broad backend queries passed without reranker fallback; finance query includes page 9. Browser thread ef4de7dc-157a-483d-9562-b0e09f840062: vague initial prompt answered without search; course-grounding follow-up searched and proactively selected page 9, without an image request. Thus the initial search decision remains a separate behavior question. No forced calls or query rewrite changes added. Formatting/diff checks pass; existing Chat tests were not repeated because this slice changes only local provider configuration and private runtime wiring.

## Explicit grounding fix

User authorized this narrow chatbot behavior change after a fresh chat ignored an explicit grounding request. Add a bounded EN/DE phrase matcher on the latest user text, force first-step doc_query for a match, and return the existing required-tool 503 if unavailable. Image selection remains optional; vague questions alone are not classified. No schema, auth, ranking, ingestion, or UI changes. Tests cover positive requests, negative wording, ordinary questions, first-step-only routing without image tools, and missing tools. 633 Chat tests pass (21 existing integration skips).

Browser retry of the exact user prompt (including truncated course materia) in thread 9291a4cf-c788-4a95-80cb-9cd6d085a229 now calls course search successfully and cites retrieved BFI passages. It did not select an image; the search fix is verified independently of optional selection. TypeScript passes; Biome reports only the pre-existing StepResult<any> warning.

## Search by default trial

User authorized default retrieval after discussing the cost and ambiguity of
classifying substantive questions. Require an initial search whenever a search
tool is available, except exact standalone greetings/acknowledgments and explicit
course-search opt-outs. Preserve Quizzer policy and existing missing-tool handling.
Uncertain short follow-ups search; image selection remains optional. No schema,
ranking, auth, provider, or UI changes. Costs increase through more retrieval calls.
Regression evidence: 652 Chat tests passed with 21 existing integration skips.

Live verification in thread 7b8653aa-52f9-42fb-9b69-eb5e34519a7b: original vague company-money question searched BFI without an explicit grounding instruction; image selection was omitted. Follow-up Thanks! completed without a tool call. TypeScript and formatting/diff checks pass. No provider token-cost measurement is claimed by these checks.

## Conditional image decision

User authorized requiring show-or-skip after retrieval supplies images. The image wrapper signals pending only for validated, allowed-KB candidates it registers, without modifying search output. The route forces the next decision step; tool execution clears pending. New searches may require another decision. No-candidate results and histories do not force decisions. Existing storage/auth and optional-null contract stay intact. 654 Chat tests passed (21 existing skips), TypeScript passes. Browser retry in thread 79ea73dc-4e68-4c77-81d9-271995fb2482 searched and displayed page 105. This verifies execution, not optimal figure relevance.
