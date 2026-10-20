import type { ModelMessage } from 'ai'
import { mapAssistantStepContent } from '@/src/lib/server/persistedAssistantContent'
import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'
import {
  isDocQueryToolName,
  MAX_SOURCES,
  normalizeSourcesFromParts,
  parseDocQueryPayload,
  sourceCitationIndices,
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
 * The model-facing projection below supplies those indices directly. Repeated
 * sources retain their number; invalid model markers still remain literal text.
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

/**
 * Projects current-generation tool results for the model only. Call positions,
 * rather than completion timing, determine the same indices used after reload.
 * Callers supply responseMessages only, so historical turns cannot be rewritten.
 */
export function withModelCitationIndices(
  messages: ModelMessage[],
  steps: Array<{ content?: unknown[] }>
): ModelMessage[] {
  const parts = mapAssistantStepContent(steps)
  const sources = normalizeSourcesFromParts(parts)
  const projections = new Map<string, string>()

  for (const part of parts) {
    if (part.type !== 'tool-call' || !isDocQueryToolName(part.toolName)) {
      continue
    }
    const payload = parseDocQueryPayload(part.result)
    if (part.isError || !payload || 'error' in payload) continue
    if (!Array.isArray(payload.sources)) continue
    const indices = sourceCitationIndices(payload, sources)
    projections.set(
      part.toolCallId,
      JSON.stringify({
        ...payload,
        sources: payload.sources.map((source, index) =>
          source && typeof source === 'object' && !Array.isArray(source)
            ? { ...source, citation_index: indices[index] }
            : source
        ),
      })
    )
  }

  return messages.map((message) => {
    if (message.role !== 'tool') return message
    return {
      ...message,
      content: message.content.map((part) => {
        if (part.type !== 'tool-result') return part
        const projection = projections.get(part.toolCallId)
        if (projection === undefined) return part
        // Keep supplementary and multimodal blocks, replacing the source JSON
        // even when MCP's text and structured representations disagree.
        const output =
          part.output.type === 'content'
            ? {
                ...part.output,
                value: [
                  { type: 'text' as const, text: projection },
                  ...part.output.value.filter((block) => {
                    if (block.type !== 'text') return true
                    const payload = parseDocQueryPayload(block.text)
                    return !payload || !('sources' in payload)
                  }),
                ],
              }
            : { type: 'text' as const, value: projection }
        return { ...part, output }
      }),
    }
  })
}
