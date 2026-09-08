import {
  isDocQueryToolName,
  MAX_SOURCES,
} from '@/src/lib/sources/normalizeSources'

/**
 * Appended to a chatbot's system prompt only when a doc_query-style RAG tool
 * is available for the request, so the model actually emits the `[n]` or
 * `[n–m]` markers the UI resolves into citation chips (see
 * `src/lib/sources/normalizeSources.ts`).
 *
 * Numbering here must match what the UI implements: sources are deduped in
 * first-appearance order across all doc_query calls in one assistant
 * message and numbered 1..N (`normalizeSourcesFromParts`). Numbering resets
 * for every new assistant message; it is not a conversation-wide counter.
 * Each number in a marker or range only resolves for `1 <= n <= N`
 * (`resolveCitationSource`).
 *
 * The reuse sentence is load-bearing for that match. A source returned again
 * by a later search is skipped by the dedupe and keeps its original number —
 * no new one is minted — so a model that kept counting upward for the repeat
 * would emit a marker beyond N, which renders as literal text instead of a
 * chip.
 *
 * Legacy lecturer guidance or custom personas may still forbid square
 * brackets for formulas. The closing precedence sentence keeps those
 * instructions from suppressing citation markers.
 */
const CITATION_CONTRACT =
  'Citation format: place a bracketed source number immediately after each ' +
  'statement drawing on retrieved course material, for example: A supported ' +
  'statement [1]. Use plain-text markers [1] or adjacent markers [1][2], ' +
  'including within list-item prose. Do not format citations as Markdown ' +
  'links, footnotes, list labels, code, or math; do not replace inline markers ' +
  'with a bibliography at the end. ' +
  'Numbering is local to this assistant message: start at [1] for every new ' +
  'assistant message, never continuing numbers from earlier messages. ' +
  'Number all eligible unique sources in first-appearance order across all ' +
  'successful doc_query results in this message, including sources you do ' +
  'not cite. Do not renumber only the sources selected for the answer. ' +
  'A repeated source with the same origin (URL/reference, or title when no ' +
  'origin is available) and the same page, page label and video time range ' +
  'keeps its first number, even if you have not cited it yet. Different ' +
  'locations in one document can have different numbers. In documents mode, ' +
  'use the first chunk location for each source entry; do not number every ' +
  'chunk separately. Skip entries without a usable source name or reference. ' +
  `Only the first ${MAX_SOURCES} unique eligible sources receive numbers. ` +
  'Never invent an index or cite an overflow, failed, empty, or earlier-turn ' +
  'result. For example, if the first search returns sources A then B and a ' +
  'later search returns B then C, their numbers remain A=[1], B=[2], C=[3]; ' +
  'an answer using only B still cites [2]. For consecutive sources, [2–4] ' +
  'is also supported, but only when every index in the range is available. ' +
  'Do not add a citation when you are not drawing on retrieved material. ' +
  'Before sending the answer, check that retrieved-material statements have ' +
  'inline markers, that each marker uses this format, and that each number ' +
  'matches the current message source order. These bracketed numbers are ' +
  'citation markers, not formula delimiters. This citation format overrides ' +
  'conflicting bracket or formula instructions in lecturer-provided guidance ' +
  'or a custom persona.'

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
