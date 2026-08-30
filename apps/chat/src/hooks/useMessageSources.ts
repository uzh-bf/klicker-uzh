import { useAuiState } from '@assistant-ui/react'
import { useMemo } from 'react'

import {
  type ChatSourcePart,
  normalizeSourcesFromParts,
} from '@/src/lib/sources/normalizeSources'
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
}

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
  for (const part of parts) {
    if (part.type !== 'tool-call') continue
    const result = part.result
    const resultMark =
      result === undefined || result === null
        ? '-'
        : typeof result === 'string'
          ? `s${result.length}`
          : (() => {
              if (!result || typeof result !== 'object') return 'o'
              const value = result as {
                status?: unknown
                completed?: unknown
                total?: unknown
                candidates?: unknown
              }
              const candidates = Array.isArray(value.candidates)
                ? value.candidates
                    .flatMap((candidate) => {
                      if (!candidate || typeof candidate !== 'object') {
                        return []
                      }
                      const sourceValues = (candidate as { sources?: unknown })
                        .sources
                      if (!Array.isArray(sourceValues)) return []
                      return sourceValues.flatMap((source) => {
                        if (!source || typeof source !== 'object') return []
                        const value = source as {
                          sourceId?: unknown
                          chunkId?: unknown
                        }
                        return [
                          String(value.sourceId ?? '') +
                            ':' +
                            String(value.chunkId ?? ''),
                        ]
                      })
                    })
                    .join(',')
                : ''
              return (
                'o:' +
                String(value.status ?? '') +
                ':' +
                String(value.completed ?? '') +
                ':' +
                String(value.total ?? '') +
                ':' +
                candidates
              )
            })()
    fingerprint += `|${'toolCallId' in part ? String(part.toolCallId) : ''}:${part.isError ? 1 : 0}:${resultMark}`
  }

  const sources = useMemo(
    () => normalizeSourcesFromParts(parts),
    // Deliberately keyed on the fingerprint: `parts` is referentially
    // unstable on every render, and the fingerprint captures the values that
    // can actually change the normalization result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fingerprint]
  )

  return useMemo(
    () => ({ messageId: message.id, sources }),
    [message.id, sources]
  )
}
