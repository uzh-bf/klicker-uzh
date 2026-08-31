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
    course: { isDeleted: true },
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

describe('scheduled activity handlers for soft-deleted courses', () => {
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
})
