import { describe, expect, test } from 'vitest'
import {
  transitionDeleteConfirm,
  type DeleteConfirmPhase,
} from '../src/components/thread-list-state'

// The chat app's test setup has no jsdom/testing-library, so ThreadListItem
// itself can't be rendered or clicked in a unit test. `transitionDeleteConfirm`
// is the extracted, side-effect-free state machine behind the T2.3 two-step
// delete confirm (split into thread-list-state.ts, mirroring
// message-parts-state.ts, so importing it doesn't drag in
// `@uzh-bf/design-system` and its CSS) — these tests cover it directly.
describe('transitionDeleteConfirm', () => {
  test('a first click arms the confirm state without deleting', () => {
    expect(transitionDeleteConfirm('idle', 'click')).toEqual({
      phase: 'confirming',
      shouldDelete: false,
    })
  })

  test('a second click while armed signals delete and reverts to idle', () => {
    expect(transitionDeleteConfirm('confirming', 'click')).toEqual({
      phase: 'idle',
      shouldDelete: true,
    })
  })

  test('a revert from the armed state clears it without deleting', () => {
    // Stands in for the timeout, Escape, and focus/pointer-leaves-the-row
    // triggers, which all dispatch the same 'revert' action.
    expect(transitionDeleteConfirm('confirming', 'revert')).toEqual({
      phase: 'idle',
      shouldDelete: false,
    })
  })

  test('a revert while already idle is a no-op', () => {
    expect(transitionDeleteConfirm('idle', 'revert')).toEqual({
      phase: 'idle',
      shouldDelete: false,
    })
  })

  test('supports a full arm -> cancel -> re-arm -> confirm sequence', () => {
    let phase: DeleteConfirmPhase = 'idle'

    let step = transitionDeleteConfirm(phase, 'click')
    phase = step.phase
    expect(phase).toBe('confirming')
    expect(step.shouldDelete).toBe(false)

    // e.g. the row's timeout fires, or the pointer/focus leaves the row
    step = transitionDeleteConfirm(phase, 'revert')
    phase = step.phase
    expect(phase).toBe('idle')
    expect(step.shouldDelete).toBe(false)

    // Arming again after a cancel must not carry over any stale "confirming"
    // state from the previous round.
    step = transitionDeleteConfirm(phase, 'click')
    phase = step.phase
    expect(phase).toBe('confirming')

    step = transitionDeleteConfirm(phase, 'click')
    expect(step).toEqual({ phase: 'idle', shouldDelete: true })
  })
})
