import { useAuiState } from '@assistant-ui/react'
import { useMemo } from 'react'

import { extractCitedPages } from '@/src/lib/markdown/remarkCitationMarkers'
import { courseImageSourceMap } from '@/src/lib/sources/courseImages'
import {
  type ChatSourcePart,
  normalizeSourcesFromParts,
} from '@/src/lib/sources/normalizeSources'
import { formatCitedPageRanges } from '@/src/lib/sources/sourceDisplay'
import type { ChatSource } from '@/src/lib/sources/types'

// Minimal shape this hook needs from the assistant message — kept local
// (rather than importing assistant-ui's ThreadAssistantMessage type) so this
// file only depends on what it actually reads, matching the
// `MessageWithCustomMetadata` pattern used elsewhere in thread.tsx.
type MessageWithSourceParts = {
  id: string
  content?: readonly ChatSourcePart[]
}

export interface MessageSources {
  messageId: string
  sources: ChatSource[]
  courseImageSourcesByAssetId: ReadonlyMap<string, ChatSource>
  /**
   * Source index -> the pages this answer cites for it, as the smallest
   * covering ranges (`6–7, 12`). A source the answer cites without a page
   * detail has no entry and keeps the retrieved range on its card.
   */
  citedPageRanges: ReadonlyMap<number, string>
}

const EMPTY_CITED_PAGE_RANGES: ReadonlyMap<number, string> = new Map()

/**
 * Normalizes the current assistant message's doc-query tool-call parts into
 * `ChatSource[]`, once per message, so the sources grid (`SourcesSection`)
 * and inline citation chips (`markdown-text.tsx`) can share a single
 * computation instead of each re-parsing the tool JSON. Intended to be
 * called exactly once per assistant message (in `AssistantMessage`) and
 * distributed via `MessageSourcesProvider`/`useMessageSourcesContext`.
 */
export function useMessageSources(): MessageSources {
  const message = useAuiState((s) => s.message) as MessageWithSourceParts
  const parts = message.content ?? []

  // The message store re-renders on every streamed token and rebuilds
  // `content` (so its reference is never stable). Tool results are set
  // exactly once, so a cheap fingerprint of the tool-call parts is enough to
  // skip re-parsing the tool JSON on unrelated re-renders.
  let fingerprint = message.id
  let answerText = ''
  for (const part of parts) {
    if (part.type === 'text') {
      const text = part.text ?? ''
      answerText += `${text}\n`
      fingerprint += `|t${text.length}`
      continue
    }

    if (part.type !== 'tool-call') continue
    const result = part.result
    const resultMark =
      result === undefined || result === null
        ? '-'
        : typeof result === 'string'
          ? `s${result.length}`
          : 'o'
    fingerprint += `|${'toolCallId' in part ? String(part.toolCallId) : ''}:${part.isError ? 1 : 0}:${resultMark}`
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: parts are intentionally keyed by a stable fingerprint.
  const sources = useMemo(
    () => normalizeSourcesFromParts(parts),
    // Deliberately keyed on the fingerprint: `parts` is referentially
    // unstable on every render, and the fingerprint captures the values that
    // can actually change the normalization result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fingerprint]
  )

  // Cited pages come from the answer Markdown, not from the retrieval payload:
  // the payload lists the chunks that came back, while only the answer's own
  // markers say which of them it used.
  // biome-ignore lint/correctness/useExhaustiveDependencies: answer text is intentionally keyed by the message fingerprint.
  const citedPageRanges = useMemo(() => {
    if (!answerText.includes(',')) return EMPTY_CITED_PAGE_RANGES

    const ranges = new Map<number, string>()
    for (const [index, pages] of extractCitedPages(answerText)) {
      const label = formatCitedPageRanges(pages)
      if (label) ranges.set(index, label)
    }

    return ranges.size > 0 ? ranges : EMPTY_CITED_PAGE_RANGES
    // Keyed on the fingerprint like `sources` above, for the same reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint])

  // biome-ignore lint/correctness/useExhaustiveDependencies: parts are intentionally keyed by the same stable fingerprint as sources.
  const courseImageSourcesByAssetId = useMemo(
    () => courseImageSourceMap(sources, parts),
    // Tool results use the same fingerprint and lifecycle as source
    // normalization above; `sources` changes whenever that fingerprint does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fingerprint, sources]
  )

  return useMemo(
    () => ({
      messageId: message.id,
      sources,
      citedPageRanges,
      courseImageSourcesByAssetId,
    }),
    [message.id, sources, citedPageRanges, courseImageSourcesByAssetId]
  )
}
