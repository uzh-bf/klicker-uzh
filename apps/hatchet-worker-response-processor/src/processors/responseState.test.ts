import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getSampleSolutionAvailability,
  getResponseState,
  type PointCorrectionInstruction,
  replayPointCorrections,
  validateRedisCounterTransitions,
} from './responseState.js'

function correction(
  overrides: Partial<PointCorrectionInstruction>
): PointCorrectionInstruction {
  return {
    appliedCorrectionId: 1,
    pointCorrection: {
      basePoints: null,
      correctnessPoints: null,
      bonusPoints: null,
    },
    ...overrides,
  }
}

describe('assessment response state', () => {
  it('keeps sample-solution availability compatible with legacy cache entries', () => {
    assert.equal(
      getSampleSolutionAvailability({
        type: 'SC',
        solutions: '[]',
      }),
      true
    )
    assert.equal(
      getSampleSolutionAvailability({
        type: 'SELECTION',
        solutions: '[]',
      }),
      false
    )
    assert.equal(
      getSampleSolutionAvailability({
        type: 'SELECTION',
        solutions: '[1]',
      }),
      true
    )
    assert.equal(
      getSampleSolutionAvailability({
        type: 'SC',
        cachedFlag: 'false',
        solutions: '[1]',
      }),
      false
    )
  })

  it('distinguishes new, genuine, correction-only, and retried responses', () => {
    assert.equal(getResponseState(null, 'correlation-id'), 'create')
    assert.equal(
      getResponseState(
        { correctionOnly: false, correlationId: 'other' },
        'correlation-id'
      ),
      'duplicate'
    )
    assert.equal(
      getResponseState(
        { correctionOnly: true, correlationId: null },
        'correlation-id'
      ),
      'materialize'
    )
    assert.equal(
      getResponseState(
        { correctionOnly: true, correlationId: 'other' },
        'correlation-id'
      ),
      'duplicate'
    )
    assert.equal(
      getResponseState(
        { correctionOnly: true, correlationId: 'correlation-id' },
        'correlation-id'
      ),
      'materialize'
    )
    assert.equal(
      getResponseState(
        { correctionOnly: false, correlationId: 'correlation-id' },
        'correlation-id'
      ),
      'retry'
    )
  })

  it('replays corrections in application order and preserves untouched categories', () => {
    const earlier = correction({
      appliedCorrectionId: 10,
      pointCorrection: {
        basePoints: true,
        correctnessPoints: null,
        bonusPoints: null,
      },
    })
    const later = correction({
      appliedCorrectionId: 11,
      pointCorrection: {
        basePoints: false,
        correctnessPoints: true,
        bonusPoints: null,
      },
    })

    const result = replayPointCorrections({
      rawPoints: { basePoints: 5, correctnessPoints: 4, bonusPoints: 2 },
      availablePoints: {
        basePoints: 10,
        correctnessPoints: 8,
        bonusPoints: 6,
      },
      corrections: [later, earlier],
    })

    assert.deepEqual(result.points, {
      basePoints: 0,
      correctnessPoints: 8,
      bonusPoints: 2,
    })
    assert.deepEqual(result.appliedCorrections, [
      {
        appliedCorrectionId: 10,
        awardedBasePoints: 5,
        awardedCorrectnessPoints: 0,
        awardedBonusPoints: 0,
        deductedBasePoints: 0,
        deductedCorrectnessPoints: 0,
        deductedBonusPoints: 0,
      },
      {
        appliedCorrectionId: 11,
        awardedBasePoints: 0,
        awardedCorrectnessPoints: 4,
        awardedBonusPoints: 0,
        deductedBasePoints: 10,
        deductedCorrectnessPoints: 0,
        deductedBonusPoints: 0,
      },
    ])
  })

  it('replays repeated award and deduction actions without losing their deltas', () => {
    const corrections = [
      correction({
        appliedCorrectionId: 1,
        pointCorrection: {
          basePoints: true,
          correctnessPoints: null,
          bonusPoints: null,
        },
      }),
      correction({
        appliedCorrectionId: 2,
        pointCorrection: {
          basePoints: false,
          correctnessPoints: null,
          bonusPoints: null,
        },
      }),
      correction({
        appliedCorrectionId: 3,
        pointCorrection: {
          basePoints: true,
          correctnessPoints: null,
          bonusPoints: null,
        },
      }),
    ]

    const result = replayPointCorrections({
      rawPoints: { basePoints: 3, correctnessPoints: 0, bonusPoints: 0 },
      availablePoints: {
        basePoints: 10,
        correctnessPoints: 0,
        bonusPoints: 0,
      },
      corrections,
    })

    assert.equal(result.points.basePoints, 10)
    assert.deepEqual(
      result.appliedCorrections.map(
        ({ appliedCorrectionId, awardedBasePoints, deductedBasePoints }) => ({
          appliedCorrectionId,
          awardedBasePoints,
          deductedBasePoints,
        })
      ),
      [
        { appliedCorrectionId: 1, awardedBasePoints: 7, deductedBasePoints: 0 },
        {
          appliedCorrectionId: 2,
          awardedBasePoints: 0,
          deductedBasePoints: 10,
        },
        {
          appliedCorrectionId: 3,
          awardedBasePoints: 10,
          deductedBasePoints: 0,
        },
      ]
    )
  })

  it('rejects Redis counter overflow before writing the completion marker', () => {
    assert.equal(
      validateRedisCounterTransitions(
        [{ key: 'results', field: 'participants', amount: 1 }],
        new Map([['results\u0000participants', '9223372036854775807']])
      ),
      'results:participants would overflow Redis integer range'
    )
  })

  it('accepts counters within Redis signed 64-bit range', () => {
    assert.equal(
      validateRedisCounterTransitions(
        [{ key: 'results', field: 'participants', amount: 1 }],
        new Map([['results\u0000participants', '9223372036854775806']])
      ),
      null
    )
  })
})
