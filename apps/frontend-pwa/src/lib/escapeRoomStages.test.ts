import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getEscapeRankedSeconds,
  getGroupEscapeRoomStages,
  getIndividualEscapeRoomStages,
  getLiveEscapeRoomStages,
} from './escapeRoomStages'

const states = (result: { stages: Array<{ state: string }> }) =>
  result.stages.map((stage) => stage.state)

describe('individual escape room stages', () => {
  const stacks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

  it('marks every state and the first uncleared regular stage as current', () => {
    const result = getIndividualEscapeRoomStages({
      stacks,
      hasBonus: true,
      stageOutcomes: [
        { stageKey: 'a', outcome: 'SOLVED', wrongAttempts: 2 },
        { stageKey: 'b', outcome: 'REVEALED' },
        { stageKey: 'c', outcome: 'SKIPPED' },
      ],
    })
    assert.deepEqual(states(result), [
      'solved',
      'revealed',
      'skipped',
      'current',
    ])
    assert.equal(result.stages[0]?.wrongAttempts, 2)
    assert.equal(result.requiredCount, 3)
    assert.equal(result.bonusCount, 1)
    assert.equal(result.clearedCount, 3)
  })

  it('keeps later stages open and the bonus stage not current', () => {
    const result = getIndividualEscapeRoomStages({
      stacks,
      hasBonus: true,
      stageOutcomes: [{ stageKey: 'a', outcome: 'SOLVED' }],
    })
    assert.deepEqual(states(result), ['solved', 'current', 'open', 'open'])
    assert.equal(result.stages[3]?.kind, 'bonus')
  })

  it('makes the bonus stage current once all regular stages are cleared', () => {
    const result = getIndividualEscapeRoomStages({
      stacks,
      hasBonus: true,
      stageOutcomes: ['a', 'b', 'c'].map((stageKey) => ({
        stageKey,
        outcome: 'SOLVED',
      })),
    })
    assert.deepEqual(states(result).slice(2), ['solved', 'current'])
    assert.equal(result.clearedCount, 3)
  })

  it('records a correct and a wrong bonus answer', () => {
    const base = ['a', 'b', 'c'].map((stageKey) => ({
      stageKey,
      outcome: 'SOLVED',
    }))
    const right = getIndividualEscapeRoomStages({
      stacks,
      hasBonus: true,
      stageOutcomes: [...base, { stageKey: 'd', outcome: 'BONUS_CORRECT' }],
    })
    const wrong = getIndividualEscapeRoomStages({
      stacks,
      hasBonus: true,
      stageOutcomes: [...base, { stageKey: 'd', outcome: 'BONUS_WRONG' }],
    })
    assert.equal(right.stages[3]?.state, 'bonusCorrect')
    assert.equal(wrong.stages[3]?.state, 'bonusWrong')
    assert.equal(right.clearedCount, 3)
  })

  it('handles a single-stage room without bonus and withheld stacks', () => {
    const single = getIndividualEscapeRoomStages({
      stacks: [{ id: 'a' }],
      hasBonus: false,
      stageOutcomes: [],
    })
    assert.deepEqual(states(single), ['current'])
    assert.equal(single.requiredCount, 1)
    assert.equal(single.bonusCount, 0)

    const withheld = getIndividualEscapeRoomStages({
      stacks: [],
      totalStages: 3,
      hasBonus: true,
    })
    assert.equal(withheld.requiredCount, 2)
    assert.equal(withheld.bonusCount, 1)
    assert.equal(withheld.clearedCount, 0)
  })

  it('counts an already correct stack as solved', () => {
    const result = getIndividualEscapeRoomStages({
      stacks: [{ id: 'a', isCorrect: true }, { id: 'b' }],
      hasBonus: false,
    })
    assert.deepEqual(states(result), ['solved', 'current'])
  })

  it('keeps the cleared stages of an expired attempt without stacks', () => {
    const result = getIndividualEscapeRoomStages({
      stacks: [],
      totalStages: 4,
      hasBonus: false,
      stageOutcomes: [
        { stageKey: 'a', outcome: 'SOLVED' },
        { stageKey: 'b', outcome: 'REVEALED', wrongAttempts: 3 },
        { stageKey: 'c', wrongAttempts: 1 },
      ],
    })
    assert.deepEqual(states(result), ['solved', 'revealed', 'current', 'open'])
    assert.equal(result.clearedCount, 2)
  })
})

describe('group escape room stages', () => {
  const ids = ['1', '2', '3']

  it('reads solved from decisions and the rest from outcomes', () => {
    const result = getGroupEscapeRoomStages({
      stageInstanceIds: ids,
      hasBonus: true,
      stageDecisions: [{ instanceId: '1' }],
      stageOutcomes: [{ stageKey: '2', outcome: 'SKIPPED' }],
    })
    assert.deepEqual(states(result), ['solved', 'skipped', 'current'])
    assert.equal(result.requiredCount, 2)
    assert.equal(result.clearedCount, 2)
  })

  it('shows reveal, open and bonus results', () => {
    const revealed = getGroupEscapeRoomStages({
      stageInstanceIds: ids,
      hasBonus: true,
      stageOutcomes: [{ stageKey: '1', outcome: 'REVEALED' }],
    })
    assert.deepEqual(states(revealed), ['revealed', 'current', 'open'])

    const done = getGroupEscapeRoomStages({
      stageInstanceIds: ids,
      hasBonus: true,
      stageDecisions: [
        { instanceId: 1 },
        { instanceId: '2' },
        { instanceId: '3' },
      ],
      stageOutcomes: [{ stageKey: '3', outcome: 'BONUS_WRONG' }],
    })
    assert.deepEqual(states(done), ['solved', 'solved', 'bonusWrong'])
  })

  it('does not treat a bonus decision without outcome as solved', () => {
    const result = getGroupEscapeRoomStages({
      stageInstanceIds: ids,
      hasBonus: true,
      stageDecisions: [{ instanceId: '1' }, { instanceId: '2' }],
    })
    assert.deepEqual(states(result), ['solved', 'solved', 'current'])
  })

  it('handles a single-stage room without bonus', () => {
    const result = getGroupEscapeRoomStages({
      stageInstanceIds: ['1'],
      hasBonus: false,
      stageDecisions: [{ instanceId: '1' }],
    })
    assert.deepEqual(states(result), ['solved'])
    assert.equal(result.clearedCount, 1)
  })
})

describe('live escape room stages', () => {
  it('derives a cleared prefix and the current stage', () => {
    const result = getLiveEscapeRoomStages({ clearedCount: 1, totalCount: 3 })
    assert.deepEqual(states(result), ['solved', 'current', 'open'])
    assert.equal(result.requiredCount, 3)
    assert.equal(result.bonusCount, 0)
  })

  it('has no current stage when all are cleared or the room is empty', () => {
    const all = getLiveEscapeRoomStages({ clearedCount: 2, totalCount: 2 })
    assert.deepEqual(states(all), ['solved', 'solved'])
    assert.equal(all.clearedCount, 2)
    assert.equal(
      getLiveEscapeRoomStages({ clearedCount: 0, totalCount: 0 }).stages.length,
      0
    )
  })
})

describe('escape ranked seconds', () => {
  const base = {
    startedAt: '2026-01-01T10:00:00.000Z',
    completedAt: '2026-01-01T10:10:00.000Z',
    penaltySeconds: 30,
  }

  it('adds penalties and subtracts the bonus only when correct', () => {
    assert.equal(getEscapeRankedSeconds(base), 630)
    assert.equal(
      getEscapeRankedSeconds({
        ...base,
        bonusSeconds: 60,
        bonusOutcome: 'BONUS_CORRECT',
      }),
      570
    )
    assert.equal(
      getEscapeRankedSeconds({
        ...base,
        bonusSeconds: 60,
        bonusOutcome: 'BONUS_WRONG',
      }),
      630
    )
  })

  it('is null when the attempt is not completed', () => {
    assert.equal(getEscapeRankedSeconds({ ...base, completedAt: null }), null)
  })

  it('rounds elapsed time to whole seconds like the lecturer view', () => {
    assert.equal(
      getEscapeRankedSeconds({
        startedAt: '2026-01-01T10:00:00.000Z',
        completedAt: '2026-01-01T10:00:01.600Z',
        penaltySeconds: 0,
      }),
      2
    )
  })
})
