import type { ChatSource } from './types'

/**
 * Resolves a `[n]` citation marker against the message's normalized sources.
 * Valid only when `1 <= n <= sources.length` — sources are always 1-based
 * and contiguous in first-appearance order (see `normalizeSourcesFromParts`),
 * so a simple bounds check is enough; no separate lookup by `.index` is
 * needed.
 *
 * Returns `undefined` for an out-of-range marker or when the message has no
 * sources at all, in which case the caller (`CitationChip`) renders the
 * original `[n]` text instead of a citation chip.
 */
export function resolveCitationSource(
  index: number,
  sources: readonly ChatSource[]
): ChatSource | undefined {
  if (!Number.isInteger(index) || index < 1 || index > sources.length) {
    return undefined
  }
  return sources[index - 1]
}
