import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isLiveQuizQuestionType,
  queueAggregateQuestionResponseEffects,
  queueCorrelatedQuestionResponseEffects,
  RedisHashMutationBuffer,
} from '../src/processors/responseEffects.js'

const instanceInfo = {
  defaultPoints: '10',
  defaultCorrectPoints: '5',
  maxBonusPoints: '45',
  timeToZeroBonus: '20',
}

describe('live quiz response effects', () => {
  it('recognizes every supported live quiz question type', () => {
    for (const type of [
      'SC',
      'MC',
      'KPRIM',
      'NUMERICAL',
      'FREE_TEXT',
      'SELECTION',
      'CASE_STUDY',
      'CONTENT',
    ]) {
      assert.equal(isLiveQuizQuestionType(type), true)
    }
    assert.equal(isLiveQuizQuestionType('UNKNOWN'), false)
  })

  it('plans correlated grading and aggregate mutations together', () => {
    const redisMulti = new RedisHashMutationBuffer()
    const grading = queueCorrelatedQuestionResponseEffects({
      type: 'SC',
      choiceCount: '2',
      response: {
        choices: [
          { ix: 0, selected: false },
          { ix: 1, selected: true },
        ],
      },
      instanceInfo,
      instanceKey: 'lq:quiz:i:1',
      responseTimestamp: 1_000,
      basePoints: 'true',
      defaultPoints: '10',
      parsedSolutions: [1],
      redisMulti,
    })

    assert.deepEqual(grading, {
      basePoints: 10,
      correctnessPoints: 5,
      bonusPoints: 45,
      correctnessPercentage: 1,
      pointsAwarded: 60,
      xpAwarded: 10,
    })
    assert.deepEqual(redisMulti.mutations, [
      {
        command: 'hincrby',
        key: 'lq:quiz:i:1:results',
        field: '1',
        value: '1',
      },
      {
        command: 'hincrby',
        key: 'lq:quiz:i:1:results',
        field: 'participants',
        value: '1',
      },
      {
        command: 'hsetnx',
        key: 'lq:quiz:i:1:info',
        field: 'firstResponseReceivedAt',
        value: '1000',
      },
    ])
  })

  it('queues participant response and leaderboard effects in aggregate mode', () => {
    const redisMulti = new RedisHashMutationBuffer()
    const grading = queueAggregateQuestionResponseEffects({
      type: 'FREE_TEXT',
      response: { value: '  correct  ' },
      instanceInfo,
      instanceKey: 'lq:quiz:i:2',
      liveQuizKey: 'lq:quiz',
      sessionBlockId: 'block',
      responseTimestamp: 2_000,
      basePoints: 'true',
      defaultPoints: '10',
      parsedSolutions: ['correct'],
      participantData: {
        sub: 'participant',
        role: 'PARTICIPANT',
      },
      redisMulti,
    })

    assert.equal(grading?.pointsAwarded, 60)
    assert.ok(
      redisMulti.mutations.some(
        (mutation) =>
          mutation.command === 'hset' &&
          mutation.key === 'lq:quiz:i:2:responses' &&
          mutation.field === 'participant' &&
          mutation.value === 'correct'
      )
    )
    assert.ok(
      redisMulti.mutations.some(
        (mutation) =>
          mutation.command === 'hincrby' &&
          mutation.key === 'lq:quiz:lb' &&
          mutation.field === 'participant' &&
          mutation.value === '60'
      )
    )
  })

  it('does not queue identity-keyed effects for correlated participants', () => {
    const redisMulti = new RedisHashMutationBuffer()
    const grading = queueCorrelatedQuestionResponseEffects({
      type: 'SC',
      choiceCount: '2',
      response: {
        choices: [
          { ix: 0, selected: false },
          { ix: 1, selected: true },
        ],
      },
      instanceInfo,
      instanceKey: 'lq:quiz:i:correlated',
      responseTimestamp: 2_500,
      basePoints: 'true',
      defaultPoints: '10',
      parsedSolutions: [1],
      redisMulti,
    })

    assert.equal(grading?.pointsAwarded, 60)
    assert.equal(
      redisMulti.mutations.some(
        (mutation) =>
          mutation.key.endsWith(':responses') ||
          mutation.key.includes(':lb') ||
          mutation.key.endsWith(':xp')
      ),
      false
    )
  })

  it('does not award base points for content views', () => {
    const redisMulti = new RedisHashMutationBuffer()
    const grading = queueCorrelatedQuestionResponseEffects({
      type: 'CONTENT',
      response: { viewed: true },
      instanceInfo,
      instanceKey: 'lq:quiz:i:3',
      responseTimestamp: 3_000,
      basePoints: 'true',
      defaultPoints: '10',
      parsedSolutions: undefined,
      redisMulti,
    })

    assert.deepEqual(grading, {
      basePoints: 0,
      correctnessPoints: 0,
      bonusPoints: 0,
      correctnessPercentage: null,
      pointsAwarded: 0,
      xpAwarded: 0,
    })
    assert.deepEqual(redisMulti.mutations, [
      {
        command: 'hincrby',
        key: 'lq:quiz:i:3:results',
        field: 'participants',
        value: '1',
      },
    ])
  })

  it('does not create leaderboard entries for participant content views', () => {
    for (const participantData of [
      { sub: 'participant', role: 'PARTICIPANT' },
      { sub: 'temporary', role: 'TEMPORARY_PARTICIPANT' },
    ]) {
      const redisMulti = new RedisHashMutationBuffer()
      queueAggregateQuestionResponseEffects({
        type: 'CONTENT',
        response: { viewed: true },
        instanceInfo,
        instanceKey: 'lq:quiz:i:4',
        liveQuizKey: 'lq:quiz',
        sessionBlockId: 'block',
        responseTimestamp: 4_000,
        basePoints: 'true',
        defaultPoints: '10',
        parsedSolutions: undefined,
        participantData,
        redisMulti,
      })

      assert.deepEqual(redisMulti.mutations, [
        {
          command: 'hincrby',
          key: 'lq:quiz:i:4:results',
          field: 'participants',
          value: '1',
        },
      ])
    }
  })
})
