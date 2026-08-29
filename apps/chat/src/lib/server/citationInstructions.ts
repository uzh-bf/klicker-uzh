import { isDocQueryToolName } from '@/src/lib/sources/normalizeSources'

/**
 * Appended to a chatbot's system prompt only when a doc_query-style RAG tool
 * is available for the request, so the model actually emits the `[n]`
 * markers the UI resolves into citation chips (see
 * `src/lib/sources/normalizeSources.ts`).
 *
 * Numbering here must match what the UI implements: sources are deduped in
 * first-appearance order across all doc_query calls in one assistant
 * message and numbered 1..N (`normalizeSourcesFromParts`), and `[n]` only
 * resolves for `1 <= n <= N` (`resolveCitationSource`).
 *
 * The reuse sentence is load-bearing for that match. A source returned again
 * by a later search is skipped by the dedupe and keeps its original number —
 * no new one is minted — so a model that kept counting upward for the repeat
 * would emit a marker beyond N, which renders as literal text instead of a
 * chip.
 *
 * Legacy stored personas may still forbid square brackets for formulas. The
 * closing precedence sentence keeps those instructions from suppressing
 * citation markers.
 */
const CITATION_CONTRACT =
  'Course-grounding policy: for every substantive student request, call the ' +
  'named course retrieval tool before answering, even if you know a plausible ' +
  'answer from general knowledge. Base factual claims on the returned course ' +
  'material. If retrieval returns no usable course material, say that the ' +
  'course sources do not provide enough information and do not fill the gap ' +
  'with uncited general knowledge. Citation format: when a statement is ' +
  'grounded in retrieved course material, ' +
  'mark it with a bracketed source number such as [1] or [2], following the ' +
  'order the search results were returned in. Keep numbering continuous ' +
  'across multiple searches within the same answer instead of restarting at ' +
  '[1]. If a later search returns a source you have already cited, reuse the ' +
  'number you gave it the first time instead of assigning a new one. Only ' +
  'use numbers that a search actually returned - never invent a ' +
  'citation. Do not add a citation when you are not drawing on retrieved ' +
  'material. These bracketed numbers are citation markers, not formula ' +
  'delimiters. This citation format overrides conflicting bracket or formula ' +
  'instructions in the base persona.'

/**
 * Appends the citation contract to `systemPrompt` when `toolNames` includes
 * a doc_query-style RAG tool, otherwise returns `systemPrompt` unchanged.
 */
export function withCitationContract(
  systemPrompt: string,
  toolNames: readonly string[]
): string {
  if (!toolNames.some(isDocQueryToolName)) return systemPrompt

  const trimmedBase = systemPrompt.trimEnd()
  return trimmedBase.length > 0
    ? `${trimmedBase}\n\n${CITATION_CONTRACT}`
    : CITATION_CONTRACT
}
