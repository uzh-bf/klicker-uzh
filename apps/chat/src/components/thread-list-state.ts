// Split out from thread-list.tsx (mirrors message-parts-state.ts): a plain
// .ts module with no component/UI-library imports, so the delete-confirm
// state machine can be unit-tested without dragging in `@uzh-bf/design-system`
// (and its CSS) through vitest's node environment.

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
