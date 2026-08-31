import { describe, expect, it, vi } from 'vitest'
import {
  handleEndExpiredGroupActivity,
  handlePublishScheduledGroupActivity,
} from '../src/services/groups.js'
import { handlePublishScheduledLiveQuiz } from '../src/services/liveQuizzes.js'
import {
  handleEndExpiredMicroLearning,
  handlePublishScheduledMicroLearning,
} from '../src/services/microLearning.js'
import { handlePublishScheduledPracticeQuiz } from '../src/services/practiceQuizzes.js'

function createExecutionContext() {
  return {
    logger: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  }
}

function createGlobalContext(modelName: string) {
  const update = vi.fn()
  const findUnique = vi.fn().mockResolvedValue({
    course: { isDeleted: false, isDeletionPending: true },
  })
  const prisma = {
    [modelName]: { findUnique, update },
  }

  return {
    ctx: {
      prisma,
      emitter: { emit: vi.fn() },
      pubSub: { publish: vi.fn() },
    },
    findUnique,
    update,
  }
}

function createLeaseBlockedGlobalContext(
  modelName: string,
  activity: Record<string, unknown>
) {
  const update = vi.fn()
  const updateMany = vi.fn()
  const findUnique = vi.fn().mockResolvedValue({
    ...activity,
    course: { isDeleted: false, isDeletionPending: false },
    courseId: 'course-id',
    isDeleted: false,
  })
  const transaction = vi.fn()
  const evalMutationFence = vi.fn().mockResolvedValue(0)

  return {
    ctx: {
      prisma: {
        [modelName]: { findUnique, update, updateMany },
        $transaction: transaction,
      },
      redisExec: { eval: evalMutationFence },
      emitter: { emit: vi.fn() },
      pubSub: { publish: vi.fn() },
    },
    evalMutationFence,
    transaction,
    update,
    updateMany,
  }
}

describe('scheduled activity handlers for courses pending deletion', () => {
  it('does not publish a scheduled live quiz', async () => {
    const { ctx, update } = createGlobalContext('liveQuiz')

    await expect(
      handlePublishScheduledLiveQuiz(
        { liveQuizId: 'live-quiz-id' },
        ctx as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)
    expect(update).not.toHaveBeenCalled()
  })

  it('does not publish a scheduled practice quiz', async () => {
    const { ctx, update } = createGlobalContext('practiceQuiz')

    await expect(
      handlePublishScheduledPracticeQuiz(
        { practiceQuizId: 'practice-quiz-id' },
        ctx as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)
    expect(update).not.toHaveBeenCalled()
  })

  it.each([
    ['publish', handlePublishScheduledMicroLearning],
    ['end', handleEndExpiredMicroLearning],
  ] as const)('does not %s a microlearning', async (_, handler) => {
    const { ctx, update } = createGlobalContext('microLearning')

    await expect(
      handler(
        { microLearningId: 'micro-learning-id' },
        ctx as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)
    expect(update).not.toHaveBeenCalled()
  })

  it.each([
    ['publish', handlePublishScheduledGroupActivity],
    ['end', handleEndExpiredGroupActivity],
  ] as const)('does not %s a group activity', async (_, handler) => {
    const { ctx, update } = createGlobalContext('groupActivity')

    await expect(
      handler(
        { groupActivityId: 'group-activity-id' },
        ctx as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)
    expect(update).not.toHaveBeenCalled()
  })

  it('does not publish a live quiz when deletion owns the mutation fence', async () => {
    const { ctx, evalMutationFence, transaction, updateMany } =
      createLeaseBlockedGlobalContext('liveQuiz', {
        availableFrom: new Date(0),
        isAssessmentEnabled: false,
        status: 'SCHEDULED',
      })

    await expect(
      handlePublishScheduledLiveQuiz(
        { liveQuizId: 'live-quiz-id' },
        ctx as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)
    expect(evalMutationFence).toHaveBeenCalledOnce()
    expect(transaction).not.toHaveBeenCalled()
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('retries a scheduled live quiz after advisory-lock contention', async () => {
    const { ctx, evalMutationFence, transaction, updateMany } =
      createLeaseBlockedGlobalContext('liveQuiz', {
        availableFrom: new Date(0),
        isAssessmentEnabled: false,
        status: 'SCHEDULED',
      })
    evalMutationFence.mockResolvedValue(1)
    transaction.mockImplementation(
      async (
        operation: (prisma: {
          $queryRaw: () => Promise<Array<{ acquired: boolean }>>
        }) => Promise<unknown>
      ) =>
        await operation({
          $queryRaw: vi.fn().mockResolvedValue([{ acquired: false }]),
        })
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await expect(
        handlePublishScheduledLiveQuiz(
          { liveQuizId: 'live-quiz-id' },
          ctx as never,
          createExecutionContext() as never
        )
      ).rejects.toThrow(
        'Course mutation lock unavailable for scheduled live quiz live-quiz-id'
      )
    } finally {
      consoleError.mockRestore()
    }
    expect(evalMutationFence).toHaveBeenCalledTimes(2)
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('does not publish a practice quiz when deletion owns the mutation fence', async () => {
    const { ctx, evalMutationFence, transaction, updateMany } =
      createLeaseBlockedGlobalContext('practiceQuiz', {
        availableFrom: new Date(0),
        status: 'SCHEDULED',
      })

    await expect(
      handlePublishScheduledPracticeQuiz(
        { practiceQuizId: 'practice-quiz-id' },
        ctx as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)
    expect(evalMutationFence).toHaveBeenCalledOnce()
    expect(transaction).not.toHaveBeenCalled()
    expect(updateMany).not.toHaveBeenCalled()
  })

  it.each([
    ['publish', handlePublishScheduledMicroLearning, 'SCHEDULED'],
    ['end', handleEndExpiredMicroLearning, 'PUBLISHED'],
  ] as const)('does not %s a microlearning when deletion owns the mutation fence', async (_, handler, status) => {
    const { ctx, evalMutationFence, transaction, updateMany } =
      createLeaseBlockedGlobalContext('microLearning', {
        scheduledEndAt: new Date(0),
        scheduledStartAt: new Date(0),
        status,
      })

    await expect(
      handler(
        { microLearningId: 'micro-learning-id' },
        ctx as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)
    expect(evalMutationFence).toHaveBeenCalledOnce()
    expect(transaction).not.toHaveBeenCalled()
    expect(updateMany).not.toHaveBeenCalled()
  })

  it.each([
    ['publish', handlePublishScheduledGroupActivity, 'SCHEDULED'],
    ['end', handleEndExpiredGroupActivity, 'PUBLISHED'],
  ] as const)('does not %s a group activity when deletion owns the mutation fence', async (_, handler, status) => {
    const { ctx, evalMutationFence, transaction, updateMany } =
      createLeaseBlockedGlobalContext('groupActivity', {
        scheduledEndAt: new Date(0),
        scheduledStartAt: new Date(0),
        status,
      })

    await expect(
      handler(
        { groupActivityId: 'group-activity-id' },
        ctx as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)
    expect(evalMutationFence).toHaveBeenCalledOnce()
    expect(transaction).not.toHaveBeenCalled()
    expect(updateMany).not.toHaveBeenCalled()
  })
})
