import {
  LiveQuizResponseCollectionMode,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import {
  assertLiveQuizResponseCollectionModeEditable,
  deriveCourseLiveQuizResponseCollectionTransition,
  deriveLiveQuizResponseCollectionMode,
} from '../src/services/liveQuizResponseCollection.js'

function courseState({
  isAssessmentEnabled = false,
  isGamificationEnabled = false,
  liveQuizMode = LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS,
  liveQuizStatus = PublicationStatus.DRAFT,
}: {
  isAssessmentEnabled?: boolean
  isGamificationEnabled?: boolean
  liveQuizMode?: LiveQuizResponseCollectionMode
  liveQuizStatus?: PublicationStatus
} = {}) {
  return {
    course: {
      id: 'course-id',
      isAssessmentEnabled,
      isGamificationEnabled,
    },
    liveQuizzes: [
      {
        id: 'live-quiz-id',
        isDeleted: false,
        pinCode: null,
        responseCollectionMode: liveQuizMode,
        status: liveQuizStatus,
      },
    ],
  }
}

describe('live quiz response collection policy', () => {
  it('forces assessment quizzes to aggregate-only mode', () => {
    expect(
      deriveLiveQuizResponseCollectionMode({
        isAssessmentEnabled: true,
        isGamificationEnabled: true,
        requestedMode: LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      })
    ).toBe(LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS)
  })

  it('rejects correlated collection with gamification using the public code', () => {
    expect(() =>
      deriveLiveQuizResponseCollectionMode({
        isAssessmentEnabled: false,
        isGamificationEnabled: true,
        requestedMode: LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      })
    ).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({
          code: 'LIVE_QUIZ_CORRELATED_GAMIFICATION_CONFLICT',
        }),
      })
    )
  })

  it('rejects response mode changes after publication', () => {
    expect(() =>
      assertLiveQuizResponseCollectionModeEditable({
        liveQuiz: {
          status: PublicationStatus.ENDED,
          responseCollectionMode:
            LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS,
        },
        responseCollectionMode:
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      })
    ).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({
          code: 'LIVE_QUIZ_RESPONSE_MODE_LOCKED',
        }),
      })
    )
  })

  it('preserves the generic published edit error when the mode is unchanged', () => {
    expect(() =>
      assertLiveQuizResponseCollectionModeEditable({
        liveQuiz: {
          status: PublicationStatus.PUBLISHED,
          responseCollectionMode:
            LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS,
        },
        responseCollectionMode:
          LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS,
      })
    ).toThrow('Cannot edit a published live quiz')
  })

  it('rejects assessment transitions while a live quiz is running', () => {
    expect(() =>
      deriveCourseLiveQuizResponseCollectionTransition({
        state: courseState({ liveQuizStatus: PublicationStatus.PUBLISHED }),
        isAssessmentEnabled: true,
        isGamificationEnabled: false,
      })
    ).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({
          code: 'LIVE_QUIZ_ASSESSMENT_TRANSITION_CONFLICT',
        }),
      })
    )
  })

  it('derives assessment conversion for every locked live quiz', () => {
    expect(
      deriveCourseLiveQuizResponseCollectionTransition({
        state: courseState({
          liveQuizMode: LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
        }),
        isAssessmentEnabled: true,
        isGamificationEnabled: false,
      })
    ).toEqual([
      {
        id: 'live-quiz-id',
        responseCollectionMode:
          LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS,
      },
    ])
  })

  it('preserves mixed locked modes when course settings do not change', () => {
    const state = courseState()
    state.liveQuizzes.push(
      {
        ...state.liveQuizzes[0]!,
        id: 'scheduled-live-quiz-id',
        responseCollectionMode:
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
        status: PublicationStatus.SCHEDULED,
      },
      {
        ...state.liveQuizzes[0]!,
        id: 'published-live-quiz-id',
        status: PublicationStatus.PUBLISHED,
      }
    )

    expect(
      deriveCourseLiveQuizResponseCollectionTransition({
        state,
        isAssessmentEnabled: false,
        isGamificationEnabled: false,
      })
    ).toEqual([
      {
        id: 'live-quiz-id',
        responseCollectionMode:
          LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS,
      },
      {
        id: 'scheduled-live-quiz-id',
        responseCollectionMode:
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      },
      {
        id: 'published-live-quiz-id',
        responseCollectionMode:
          LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS,
      },
    ])
  })
})
