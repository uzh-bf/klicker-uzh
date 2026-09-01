import { isDocQueryToolName } from '@/src/lib/sources/normalizeSources'

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
 * Legacy stored personas may still forbid square brackets for formulas. The
 * closing precedence sentence keeps those instructions from suppressing
 * citation markers.
 */
const CITATION_CONTRACT =
  'Citation format: when a statement is grounded in retrieved course material, ' +
  'mark it with a bracketed source number such as [1] or [2]. Citation ' +
  'numbering is local to this assistant message: start at [1] in every new ' +
  'assistant message and never continue numbering from an earlier message. ' +
  'Within this message, number unique sources in first-appearance order ' +
  'across all doc_query calls. If a later search returns a source you have ' +
  'already cited in this message, reuse the ' +
  'number you gave it the first time instead of assigning a new one. Only ' +
  'use numbers returned for this message - never invent or carry over a ' +
  'citation. For multiple consecutive sources, a compact range such as ' +
  '[2–4] is allowed only when every number in the range was returned. ' +
  'Do not add a citation when you are not drawing on retrieved ' +
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
