import {
  ObjectType,
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { describe, expect, it, vi } from 'vitest'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import { assertElementInstanceMutationAllowed } from '../src/services/courseDeletionGuard.js'

function createContext() {
  const liveQuizUpdate = vi.fn()
  const activityLogEntryDelete = vi.fn()
  const ctx = {
    user: {
      sub: 'user-1',
      role: UserRole.USER,
      scope: UserLoginScope.FULL_ACCESS,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    prisma: {
      accessRequest: {
        findUnique: vi.fn().mockResolvedValue({
          courseId: 'course-id',
          liveQuizId: null,
          practiceQuizId: null,
          microLearningId: null,
          groupActivityId: null,
        }),
      },
      activityLogEntry: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          userId: 'user-1',
          courseId: 'course-id',
          liveQuizId: null,
          practiceQuizId: null,
          microLearningId: null,
          groupActivityId: null,
        }),
        delete: activityLogEntryDelete,
      },
      course: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'course-id',
          isDeleted: false,
        }),
      },
      feedback: {
        findUnique: vi.fn().mockResolvedValue({
          liveQuizId: 'live-quiz-id',
        }),
      },
      feedbackResponse: {
        findUnique: vi.fn().mockResolvedValue({
          feedback: { liveQuizId: 'live-quiz-id' },
        }),
      },
      elementInstance: {
        findUnique: vi.fn().mockResolvedValue({
          elementStack: {
            courseId: null,
            practiceQuiz: null,
            microLearning: { courseId: 'course-id' },
            groupActivity: null,
          },
          elementBlock: null,
        }),
      },
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({
          courseId: 'course-id',
          course: { isDeleted: false, isDeletionPending: false },
        }),
        update: liveQuizUpdate,
      },
    },
    redisExec: {
      get: vi.fn(async (key: string) => {
        if (key === 'course-deletion:course:course-id') return 'deletion-job-id'
        if (key === 'course-deletion:job:deletion-job-id') {
          return JSON.stringify({ status: 'PENDING' })
        }
        return null
      }),
    },
  } as unknown as ContextWithUser

  return { activityLogEntryDelete, ctx, liveQuizUpdate }
}

async function executeMutation(
  fieldName: string,
  args: Record<string, unknown>,
  ctx: ContextWithUser
) {
  const resolver = schema.getMutationType()?.getFields()[fieldName]?.resolve
  expect(resolver).toBeDefined()
  return resolver!({}, args, ctx, {} as never)
}

function expectDeletionInProgress(result: Promise<unknown>) {
  return expect(result).rejects.toMatchObject({
    extensions: { code: 'COURSE_DELETION_IN_PROGRESS' },
  })
}

describe('course deletion mutation guard', () => {
  it('keeps the legacy deleteCourse mutation as a deprecated adapter', () => {
    const deleteCourseField = schema.getMutationType()?.getFields().deleteCourse

    expect(deleteCourseField).toBeDefined()
    expect(deleteCourseField?.deprecationReason).toBe(
      'Use startCourseDeletion.'
    )
  })

  it('rejects direct course removal while deletion is active', async () => {
    const { ctx } = createContext()

    await expectDeletionInProgress(
      executeMutation(
        'removeObject',
        { objectId: 'course-id', objectType: ObjectType.COURSE },
        ctx
      )
    )
  })

  it('rejects direct activity review updates while deletion is active', async () => {
    const { ctx, liveQuizUpdate } = createContext()

    await expectDeletionInProgress(
      executeMutation(
        'setActivityReviewStatus',
        {
          activityId: 'live-quiz-id',
          activityType: ActivityType.LIVE_QUIZ,
          isReviewed: true,
        },
        ctx
      )
    )
    expect(liveQuizUpdate).not.toHaveBeenCalled()
  })

  it('rejects sharing-request approval while deletion is active', async () => {
    const { ctx } = createContext()

    await expectDeletionInProgress(
      executeMutation(
        'approveObjectSharingRequest',
        {
          requestId: 1,
          userId: 'user-2',
          permissionLevel: PermissionLevel.READ,
          propagation: false,
        },
        ctx
      )
    )
  })

  it('rejects activity-log deletion while course deletion is active', async () => {
    const { activityLogEntryDelete, ctx } = createContext()

    await expectDeletionInProgress(
      executeMutation('deleteActivityMessage', { id: 1 }, ctx)
    )
    expect(activityLogEntryDelete).not.toHaveBeenCalled()
  })

  it('rejects anonymous feedback writes while course deletion is active', async () => {
    const { ctx } = createContext()

    await expectDeletionInProgress(
      executeMutation(
        'createFeedback',
        { quizId: 'live-quiz-id', content: 'Question' },
        ctx
      )
    )
    await expectDeletionInProgress(
      executeMutation(
        'addConfusionTimestep',
        { quizId: 'live-quiz-id', difficulty: 1, speed: 1 },
        ctx
      )
    )
    await expectDeletionInProgress(
      executeMutation('upvoteFeedback', { feedbackId: 1, increment: 1 }, ctx)
    )
    await expectDeletionInProgress(
      executeMutation(
        'voteFeedbackResponse',
        { id: 1, incrementUpvote: 1, incrementDownvote: 0 },
        ctx
      )
    )
  })

  it('rejects anonymous stack responses while course deletion is active', async () => {
    const { ctx } = createContext()

    await expectDeletionInProgress(
      executeMutation(
        'respondToElementStack',
        {
          courseId: 'course-id',
          isOwner: false,
          responses: [],
          stackAnswerTime: 1,
          stackId: 1,
        },
        ctx
      )
    )
  })

  it('resolves deletion guards through activity-owned element stacks', async () => {
    const { ctx } = createContext()

    await expectDeletionInProgress(assertElementInstanceMutationAllowed(1, ctx))
  })
})
