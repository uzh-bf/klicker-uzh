import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'
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
const CITATION_CONTRACT = renderPromptTemplate('citation-contract', {
  maxSources: MAX_SOURCES,
})

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
