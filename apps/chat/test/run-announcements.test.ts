import { describe, expect, test } from 'vitest'
import { getAssistantRuntimeRunOutcome } from '../src/lib/runAnnouncements'

describe('assistant runtime run announcements', () => {
  test.each([
    [{ type: 'complete', reason: 'stop' } as const, 'completed'],
    [{ type: 'incomplete', reason: 'cancelled' } as const, 'stopped'],
    [{ type: 'incomplete', reason: 'error' } as const, 'error'],
  ])('maps a terminal message status to %s', (status, outcome) => {
    expect(getAssistantRuntimeRunOutcome(status)).toBe(outcome)
  })

  test('waits while the assistant is still running', () => {
    expect(getAssistantRuntimeRunOutcome({ type: 'running' })).toBeNull()
  })
})
