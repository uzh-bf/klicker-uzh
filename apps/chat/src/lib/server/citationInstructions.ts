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
 * The closing sentence keeps this from colliding with `DEFAULT_PROMPT`'s
 * "Never use angle brackets [] to enclose LaTeX" rule. It is phrased without
 * pointing at that rule, because a chatbot's own stored prompt replaces the
 * default entirely and may never mention LaTeX at all.
 */
const CITATION_CONTRACT =
  'Citation format: when a statement is grounded in retrieved course material, ' +
  'mark it with a bracketed source number such as [1] or [2], following the ' +
  'order the search results were returned in. Keep numbering continuous ' +
  'across multiple searches within the same answer instead of restarting at ' +
  '[1]. Only use numbers that a search actually returned - never invent a ' +
  'citation. Do not add a citation when you are not drawing on retrieved ' +
  'material. These bracketed numbers are citation markers and are never ' +
  'LaTeX, so any rule about brackets in formulas does not apply to them.'

/**
 * Appends the citation contract to `systemPrompt` when `toolNames` includes
 * a doc_query-style RAG tool, otherwise returns `systemPrompt` unchanged.
 *
 * Safe to call more than once with its own output: if the contract text is
 * already present, it is not appended again.
 */
export function withCitationContract(
  systemPrompt: string,
  toolNames: readonly string[]
): string {
  if (!toolNames.some(isDocQueryToolName)) return systemPrompt
  if (systemPrompt.includes(CITATION_CONTRACT)) return systemPrompt

  const trimmedBase = systemPrompt.trimEnd()
  return trimmedBase.length > 0
    ? `${trimmedBase}\n\n${CITATION_CONTRACT}`
    : CITATION_CONTRACT
}
