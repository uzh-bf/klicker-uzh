import {
  applyEscapeRoomWrongAnswer,
  areEscapeRoomRegularStagesCleared,
  getEscapeRoomRulesFromConfig,
  resolveEscapeRoomAnswerableStage,
  getEscapeRoomHintPenalty,
  isEscapeRoomBonusStage,
  rankEscapeRoomScores,
  scoreEscapeRoomAttempt,
  type EscapeRoomRules,
} from '../src/index.js'
import { ESCAPE_ROOM_CLASSROOM_PRESET } from '@klicker-uzh/types'

const defaults: EscapeRoomRules = {
  hintPenalty: 30,
  hintPenalties: [],
  wrongAnswerPenalty: 0,
  maxWrongAttempts: null,
  revealPenalty: 0,
  skipPenalty: null,
  bonusSeconds: null,
}

const classroom: EscapeRoomRules = { ...ESCAPE_ROOM_CLASSROOM_PRESET }

describe('escape room rules', () => {
  it('charges nothing and never reveals under the default rules', () => {
    expect(applyEscapeRoomWrongAnswer(defaults, 9)).toEqual({
      wrongAttempts: 10,
      penaltySeconds: 0,
      revealed: false,
      attemptsLeft: null,
    })
    expect(isEscapeRoomBonusStage(defaults, 2, 3)).toBe(false)
  })

  it('reveals the solution on the last allowed wrong answer', () => {
    expect(applyEscapeRoomWrongAnswer(classroom, 3)).toMatchObject({
      penaltySeconds: 30,
      revealed: false,
      attemptsLeft: 1,
    })
    expect(applyEscapeRoomWrongAnswer(classroom, 4)).toMatchObject({
      penaltySeconds: 30 + 480,
      revealed: true,
      attemptsLeft: 0,
    })
  })

  it('prefers a hint penalty of its own, then the indexed default', () => {
    expect(getEscapeRoomHintPenalty(classroom, 0)).toBe(120)
    expect(getEscapeRoomHintPenalty(classroom, 1)).toBe(240)
    expect(getEscapeRoomHintPenalty(classroom, 2)).toBe(120)
    expect(getEscapeRoomHintPenalty(classroom, 1, 0)).toBe(0)
    expect(getEscapeRoomHintPenalty(defaults, 0)).toBe(30)
  })

  it('scores solved stages and time without counting the bonus stage', () => {
    const startedAt = new Date('2026-11-08T10:00:00Z')
    expect(
      scoreEscapeRoomAttempt({
        startedAt,
        penaltySeconds: 600,
        stages: [
          { outcome: 'SOLVED', at: '2026-11-08T10:05:00Z' },
          { outcome: 'SKIPPED', at: '2026-11-08T10:06:00Z' },
          { outcome: 'REVEALED', at: '2026-11-08T10:10:00Z' },
          {
            outcome: 'BONUS_CORRECT',
            at: '2026-11-08T10:20:00Z',
            creditSeconds: 180,
          },
        ],
      })
    ).toEqual({
      solvedStages: 1,
      revealedStages: 1,
      skippedStages: 1,
      bonusCorrect: true,
      rankedSeconds: 600 + 600 - 180,
    })
  })

  it('ranks by solved stages, then time, sharing ranks on ties', () => {
    const ranked = rankEscapeRoomScores([
      { id: 'a', solvedStages: 2, rankedSeconds: 900 },
      { id: 'b', solvedStages: 3, rankedSeconds: 1500 },
      { id: 'c', solvedStages: 2, rankedSeconds: 900 },
      { id: 'd', solvedStages: 0, rankedSeconds: null },
      { id: 'e', solvedStages: 2, rankedSeconds: 1200 },
    ])
    expect(ranked.map(({ id, rank }) => [id, rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 2],
      ['e', 4],
      ['d', null],
    ])
  })
})

describe('escape room answerable stage', () => {
  const stages = ['a', 'b', 'c']
  const base = {
    stages,
    rules: { bonusSeconds: null },
    status: 'IN_PROGRESS',
    expired: false,
    outcomes: [],
    clearedKeys: new Set<string>(),
  }

  it('offers only the first uncleared stage', () => {
    expect(
      resolveEscapeRoomAnswerableStage({ ...base, stageKey: 'a' }).ok
    ).toBe(true)
    expect(
      resolveEscapeRoomAnswerableStage({ ...base, stageKey: 'b' })
    ).toEqual({ ok: false, reason: 'locked' })
  })

  it('treats a stored outcome as cleared even when the set misses it', () => {
    const outcomes = [
      {
        stageKey: 'a',
        wrongAttempts: 2,
        outcome: 'REVEALED' as const,
        at: 'x',
      },
    ]
    expect(
      resolveEscapeRoomAnswerableStage({ ...base, outcomes, stageKey: 'a' })
    ).toEqual({ ok: false, reason: 'cleared' })
    expect(
      resolveEscapeRoomAnswerableStage({ ...base, outcomes, stageKey: 'b' }).ok
    ).toBe(true)
  })

  it('offers the unanswered bonus stage of a completed attempt in time', () => {
    const bonus = {
      ...base,
      rules: { bonusSeconds: 30 },
      status: 'COMPLETED',
      clearedKeys: new Set(['a', 'b']),
      stageKey: 'c',
    }
    expect(resolveEscapeRoomAnswerableStage(bonus)).toEqual({
      ok: true,
      stageKey: 'c',
      isBonus: true,
    })
    expect(
      resolveEscapeRoomAnswerableStage({ ...bonus, expired: true })
    ).toEqual({ ok: false, reason: 'expired' })
    expect(
      resolveEscapeRoomAnswerableStage({
        ...bonus,
        outcomes: [
          {
            stageKey: 'c',
            wrongAttempts: 0,
            outcome: 'BONUS_WRONG' as const,
            at: 'x',
          },
        ],
      })
    ).toEqual({ ok: false, reason: 'bonus_answered' })
  })

  it('excludes the bonus from regular completion', () => {
    const args = {
      stages,
      rules: { bonusSeconds: 30 },
      outcomes: [],
      clearedKeys: new Set(['a', 'b']),
    }
    expect(areEscapeRoomRegularStagesCleared(args)).toBe(true)
    expect(
      areEscapeRoomRegularStagesCleared({
        ...args,
        rules: { bonusSeconds: null },
      })
    ).toBe(false)
  })

  it('maps a missing config to rules that are all off', () => {
    expect(getEscapeRoomRulesFromConfig(null).maxWrongAttempts).toBeNull()
  })
})
