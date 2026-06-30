import {
  ElementBlockStatus,
  ElementType,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  cancelLiveQuiz,
  type LiveQuizExecutionContext,
} from '../../services/liveQuizExecution.js'
import type { TRPCContext } from '../context.js'

const user = {
  sub: 'user-1',
  role: UserRole.USER,
  scope: UserLoginScope.ACCOUNT_OWNER,
  catalystInstitutional: false,
  catalystIndividual: true,
}

function createRedis() {
  const pipe = {
    unlink: vi.fn(),
    exec: vi.fn().mockResolvedValue([]),
  }

  return {
    keys: vi.fn().mockResolvedValue(['lq:quiz-1:meta', 'lq:quiz-1:block:1']),
    multi: vi.fn(() => pipe),
    pipe,
  }
}

function createContext(
  prisma: TRPCContext['prisma'],
  redisExec = createRedis(),
  redisAssessmentExec = createRedis()
): LiveQuizExecutionContext {
  return {
    prisma,
    redisExec,
    redisAssessmentExec,
    pubSub: { publish: vi.fn() },
    emitter: new EventEmitter(),
    user,
    hatchet: {
      scheduled: {
        delete: vi.fn(),
      },
    },
    tasks: {
      aggregateLiveQuizBlockResultsAssessment: { schedule: vi.fn() },
      aggregateLiveQuizBlockResultsStandard: { schedule: vi.fn() },
    },
  } as unknown as LiveQuizExecutionContext
}

describe('live quiz cancel service', () => {
  const teamsWebhookUrl = process.env.TEAMS_WEBHOOK_URL

  beforeEach(() => {
    delete process.env.TEAMS_WEBHOOK_URL
  })

  afterEach(() => {
    if (teamsWebhookUrl) {
      process.env.TEAMS_WEBHOOK_URL = teamsWebhookUrl
    } else {
      delete process.env.TEAMS_WEBHOOK_URL
    }
  })

  test('returns null when the live quiz does not exist', async () => {
    const transaction = vi.fn()
    const redis = createRedis()
    const prisma = {
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      elementInstance: {
        update: vi.fn(),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']

    await expect(
      cancelLiveQuiz({ id: 'quiz-1' }, createContext(prisma, redis))
    ).resolves.toBeNull()

    expect(transaction).not.toHaveBeenCalled()
    expect(redis.keys).not.toHaveBeenCalled()
  })

  test('rejects non-running live quizzes', async () => {
    const liveQuizUpdate = vi.fn()
    const prisma = {
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'quiz-1',
          name: 'Quiz 1',
          status: PublicationStatus.DRAFT,
          isAssessmentEnabled: false,
          activeBlock: null,
          blocks: [],
        }),
        update: liveQuizUpdate,
      },
      elementInstance: {
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    } as unknown as TRPCContext['prisma']

    await expect(
      cancelLiveQuiz({ id: 'quiz-1' }, createContext(prisma))
    ).rejects.toThrow('Live quiz is not running')

    expect(liveQuizUpdate).not.toHaveBeenCalled()
  })

  test('rejects assessment live quizzes after a block has been activated', async () => {
    const liveQuizUpdate = vi.fn()
    const prisma = {
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'quiz-1',
          name: 'Quiz 1',
          status: PublicationStatus.PUBLISHED,
          isAssessmentEnabled: true,
          activeBlock: null,
          blocks: [
            {
              id: 1,
              status: ElementBlockStatus.ACTIVE,
              elements: [],
            },
          ],
        }),
        update: liveQuizUpdate,
      },
      elementInstance: {
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    } as unknown as TRPCContext['prisma']

    await expect(
      cancelLiveQuiz({ id: 'quiz-1' }, createContext(prisma))
    ).rejects.toThrow(
      'Assessment quizzes can only be aborted before the first block is activated'
    )

    expect(liveQuizUpdate).not.toHaveBeenCalled()
  })

  test('resets a running live quiz and clears live quiz redis keys', async () => {
    const updatedQuiz = {
      id: 'quiz-1',
      status: PublicationStatus.DRAFT,
    }
    const liveQuizUpdate = vi.fn().mockReturnValue(updatedQuiz)
    const elementInstanceUpdate = vi
      .fn()
      .mockImplementation(({ where }) => ({ id: where.id }))
    const transaction = vi.fn().mockImplementation(async (operations) => {
      return operations
    })
    const redis = createRedis()
    const prisma = {
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'quiz-1',
          name: 'Quiz 1',
          status: PublicationStatus.PUBLISHED,
          isAssessmentEnabled: false,
          activeBlock: { id: 1 },
          blocks: [
            {
              id: 1,
              status: ElementBlockStatus.ACTIVE,
              elements: [
                {
                  id: 11,
                  elementData: {
                    type: ElementType.CONTENT,
                    content: 'Info',
                    options: {},
                  },
                },
              ],
            },
            {
              id: 2,
              status: ElementBlockStatus.EXECUTED,
              elements: [
                {
                  id: 12,
                  elementData: {
                    type: ElementType.CONTENT,
                    content: 'More info',
                    options: {},
                  },
                },
              ],
            },
          ],
        }),
        update: liveQuizUpdate,
      },
      elementInstance: {
        update: elementInstanceUpdate,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']

    await expect(
      cancelLiveQuiz({ id: 'quiz-1' }, createContext(prisma, redis))
    ).resolves.toEqual(updatedQuiz)

    expect(liveQuizUpdate).toHaveBeenCalledWith({
      where: { id: 'quiz-1' },
      data: expect.objectContaining({
        status: PublicationStatus.DRAFT,
        startedAt: null,
        activeBlock: { disconnect: true },
        leaderboard: { deleteMany: {} },
        temporaryLeaderboard: { deleteMany: {} },
        feedbacks: { deleteMany: {} },
        confusionFeedbacks: { deleteMany: {} },
        blocks: {
          updateMany: {
            where: {
              status: {
                in: [ElementBlockStatus.EXECUTED, ElementBlockStatus.ACTIVE],
              },
            },
            data: {
              status: ElementBlockStatus.SCHEDULED,
              startedAt: null,
              closedAt: null,
              expiresAt: null,
              execution: { increment: 1 },
            },
          },
        },
      }),
      include: {
        activeBlock: true,
        blocks: { include: { elements: true, activeInLiveQuiz: true } },
      },
    })
    expect(elementInstanceUpdate).toHaveBeenCalledTimes(2)
    expect(elementInstanceUpdate).toHaveBeenCalledWith({
      where: { id: 11 },
      data: {
        results: { total: 0 },
        anonymousResults: { total: 0 },
      },
    })
    expect(transaction).toHaveBeenCalledWith([
      updatedQuiz,
      { id: 11 },
      { id: 12 },
    ])
    expect(redis.keys).toHaveBeenCalledWith('lq:quiz-1:*')
    expect(redis.pipe.unlink).toHaveBeenCalledWith('lq:quiz-1:meta')
    expect(redis.pipe.unlink).toHaveBeenCalledWith('lq:quiz-1:block:1')
    expect(redis.pipe.exec).toHaveBeenCalled()
  })
})
