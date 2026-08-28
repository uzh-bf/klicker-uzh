import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { preferLatestFreeTextPracticeState } from '../src/components/practiceQuiz/freeTextPracticeStateOrder.js'

type State = {
  instanceId: number
  cycleOrdinal: number
  stateVersion: number
  status: string
}

function state(
  overrides: Partial<State> & Pick<State, 'stateVersion' | 'status'>
): State {
  return {
    instanceId: 42,
    cycleOrdinal: 1,
    ...overrides,
  }
}

describe('free-text practice state ordering', () => {
  it('accepts only a newer version within the same cycle', () => {
    const revealed = state({ stateVersion: 4, status: 'SOLUTION_REVEALED' })
    const staleEvaluated = state({ stateVersion: 3, status: 'EVALUATED' })
    const newer = state({ stateVersion: 5, status: 'CORRECT' })

    assert.equal(
      preferLatestFreeTextPracticeState(42, revealed, staleEvaluated),
      revealed
    )
    assert.equal(
      preferLatestFreeTextPracticeState(42, revealed, { ...revealed }),
      revealed
    )
    assert.equal(preferLatestFreeTextPracticeState(42, revealed, newer), newer)
  })

  it('orders cycles before their state versions', () => {
    const oldCycle = state({
      cycleOrdinal: 1,
      stateVersion: 100,
      status: 'CORRECT',
    })
    const newCycle = state({
      cycleOrdinal: 2,
      stateVersion: 1,
      status: 'ACTIVE',
    })

    assert.equal(
      preferLatestFreeTextPracticeState(42, oldCycle, newCycle),
      newCycle
    )
    assert.equal(
      preferLatestFreeTextPracticeState(42, newCycle, oldCycle),
      newCycle
    )
  })

  it('rejects responses for another element instance', () => {
    const current = state({ stateVersion: 1, status: 'ACTIVE' })
    const otherInstance = state({
      instanceId: 7,
      stateVersion: 99,
      status: 'CORRECT',
    })

    assert.equal(
      preferLatestFreeTextPracticeState(42, current, otherInstance),
      current
    )
  })
})
