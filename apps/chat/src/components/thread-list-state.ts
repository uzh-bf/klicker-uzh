// Split out from thread-list.tsx (mirrors message-parts-state.ts): a plain
// .ts module with no component/UI-library imports, so the delete-confirm
// state machine and the title filter can be unit-tested without dragging in
// `@uzh-bf/design-system` (and its CSS) through vitest's node environment.

import type { Thread } from '../stores/chatStore'

export type DeleteConfirmPhase = 'idle' | 'confirming'

/**
 * Pure transition table for the inline two-step delete confirm on a thread
 * row: a first click arms it, a second click (while still armed) signals a
 * delete, and a `revert` (timeout, Escape, focus/pointer leaving the row, or
 * switching to title-edit) always falls back to idle regardless of the
 * current phase.
 */
export function transitionDeleteConfirm(
  phase: DeleteConfirmPhase,
  action: 'click' | 'revert'
): { phase: DeleteConfirmPhase; shouldDelete: boolean } {
  if (action === 'revert') {
    return { phase: 'idle', shouldDelete: false }
  }
  if (phase === 'confirming') {
    return { phase: 'idle', shouldDelete: true }
  }
  return { phase: 'confirming', shouldDelete: false }
}

/**
 * The title a thread row shows: the stored title, else the first 30
 * characters of the first user message. Returns undefined when neither
 * exists, so the caller supplies the localized "New Chat" fallback.
 */
export function resolveThreadTitle(thread: Thread): string | undefined {
  if (thread.title) return thread.title
  const firstUserMessage = thread.messages.find((m) => m.role === 'user')
  if (!firstUserMessage) return undefined
  const content = Array.isArray(firstUserMessage.content)
    ? firstUserMessage.content.find(
        (c: { type: string; text?: string }) => c.type === 'text'
      )?.text
    : firstUserMessage.content
  if (!content) return undefined
  return content.slice(0, 30) + (content.length > 30 ? '...' : '')
}

// Lowercases and strips combining accents, so "Übung" and "ubung" compare
// equal.
const normalizeForTitleFilter = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * Client-side conversation filter: keeps the threads whose displayed title
 * contains the query, ignoring case and accents. A blank query keeps all.
 */
export function filterThreadsByTitle<T extends Thread>(
  threads: readonly T[],
  query: string,
  fallbackTitle: string
): T[] {
  const needle = normalizeForTitleFilter(query.trim())
  if (!needle) return [...threads]
  return threads.filter((thread) =>
    normalizeForTitleFilter(
      resolveThreadTitle(thread) ?? fallbackTitle
    ).includes(needle)
  )
}
