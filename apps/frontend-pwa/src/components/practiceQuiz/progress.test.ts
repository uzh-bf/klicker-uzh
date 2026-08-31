import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { StackFeedbackStatus } from '@klicker-uzh/graphql/dist/ops'

const feedbackStatus = (value: string) => value as StackFeedbackStatus
import {
  findFirstUnansweredStack,
  type PracticeQuizProgressState,
  summarizePracticeQuizCompletion,
} from './progress'

describe('practice quiz progress', () => {
  it('derives the first unanswered stack for resume and navigation', () => {
    const progressState: PracticeQuizProgressState = {
      first: { status: feedbackStatus('correct') },
      second: { status: feedbackStatus('unanswered') },
      third: { status: feedbackStatus('correct') },
    }

    assert.equal(
      findFirstUnansweredStack(progressState, ['first', 'second', 'third']),
      1
    )
    assert.equal(
      findFirstUnansweredStack(
        {
          first: { status: feedbackStatus('correct') },
          second: { status: feedbackStatus('partial') },
        },
        ['first', 'second']
      ),
      2
    )
  })

  it('summarizes the stored completion result', () => {
    assert.deepEqual(
      summarizePracticeQuizCompletion(
        {
          first: {
            status: feedbackStatus('correct'),
            score: 8,
          },
          second: {
            status: feedbackStatus('incorrect'),
            score: 0,
          },
          third: {
            status: feedbackStatus('manuallyGraded'),
            score: null,
          },
        },
        ['first', 'second', 'third']
      ),
      { score: 8, answeredCount: 3 }
    )
  })
})
