import { ElementBlockStatus } from '@klicker-uzh/prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'

const mocks = vi.hoisted(() => ({
  updateLiveQuizBlockResultsFromCache: vi.fn(),
  scheduleJob: vi.fn(),
  sendTeamsNotification: vi.fn(),
}))

vi.mock('@klicker-uzh/util', async (importOriginal) => {
  const original = await importOriginal<typeof import('@klicker-uzh/util')>()

  return {
    ...original,
    updateLiveQuizBlockResultsFromCache:
      mocks.updateLiveQuizBlockResultsFromCache,
  }
})

vi.mock('node-schedule', () => ({
  default: { scheduleJob: mocks.scheduleJob },
}))

vi.mock('../src/services/notifications.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../src/services/notifications.js')>()

  return { ...original, sendTeamsNotification: mocks.sendTeamsNotification }
})

import {
  activateLiveQuizBlock,
  handleCloseExpiredLiveQuizBlock,
} from '../src/services/liveQuizzes.js'

const quizId = 'live-quiz-id'
const blockId = 7
const expiresAt = new Date('2026-11-10T10:00:30.000Z')

const executionCtx = { logger: { info: vi.fn() } } as never

function closeContext(quiz: unknown) {
  return {
    prisma: { liveQuiz: { findUnique: vi.fn().mockResolvedValue(quiz) } },
  } as never
}

function activeQuiz(overrides: {
  activeBlockId?: number | null
  status?: ElementBlockStatus
  expiresAt?: Date | null
}) {
  return {
    activeBlockId:
      'activeBlockId' in overrides ? overrides.activeBlockId : blockId,
    blocks: [
      {
        status: overrides.status ?? ElementBlockStatus.ACTIVE,
        expiresAt:
          'expiresAt' in overrides ? overrides.expiresAt : new Date(expiresAt),
      },
    ],
  }
}

describe('handleCloseExpiredLiveQuizBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateLiveQuizBlockResultsFromCache.mockResolvedValue(null)
  })

  it('closes the block its schedule was created for', async () => {
    await handleCloseExpiredLiveQuizBlock(
      { liveQuizId: quizId, blockId, expiresAt: expiresAt.toISOString() },
      closeContext(activeQuiz({})),
      executionCtx
    )

    expect(mocks.updateLiveQuizBlockResultsFromCache).toHaveBeenCalledWith(
      expect.objectContaining({ quizId, blockId })
    )
  })

  it.each([
    ['another block is active', { activeBlockId: blockId + 1 }],
    ['the block was already closed', { status: ElementBlockStatus.EXECUTED }],
    [
      'the quiz was reset',
      { status: ElementBlockStatus.SCHEDULED, expiresAt: null },
    ],
    [
      'the block was activated again',
      { expiresAt: new Date(expiresAt.getTime() + 60_000) },
    ],
  ])('leaves the quiz unchanged when %s', async (_case, overrides) => {
    const result = await handleCloseExpiredLiveQuizBlock(
      { liveQuizId: quizId, blockId, expiresAt: expiresAt.toISOString() },
      closeContext(activeQuiz(overrides)),
      executionCtx
    )

    expect(result).toBe(false)
    expect(mocks.updateLiveQuizBlockResultsFromCache).not.toHaveBeenCalled()
  })
})

describe('activateLiveQuizBlock', () => {
  function activationContext(schedule: ReturnType<typeof vi.fn>) {
    const block = { id: blockId, timeLimit: 20, elements: [] }
    const pipeline = { exec: vi.fn() }

    return {
      prisma: {
        liveQuiz: {
          findUnique: vi.fn().mockResolvedValue({
            id: quizId,
            activeBlockId: null,
            isAssessmentEnabled: false,
            blocks: [block],
          }),
          update: vi.fn().mockResolvedValue({
            id: quizId,
            isAssessmentEnabled: false,
            activeBlock: { ...block, expiresAt, execution: 0 },
            blocks: [{ ...block, status: ElementBlockStatus.ACTIVE }],
          }),
        },
      },
      pubSub: { publish: vi.fn() },
      redisExec: { pipeline: () => pipeline },
      redisAssessmentExec: { pipeline: () => pipeline },
      tasks: { closeExpiredLiveQuizBlock: { schedule } },
    } as unknown as ContextWithUser
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('schedules the durable close ten seconds after the block expires', async () => {
    const schedule = vi.fn().mockResolvedValue({})

    await activateLiveQuizBlock(
      { quizId, blockId },
      activationContext(schedule)
    )

    expect(schedule).toHaveBeenCalledWith(
      new Date(expiresAt.getTime() + 10_000),
      { liveQuizId: quizId, blockId, expiresAt: expiresAt.toISOString() }
    )
    expect(mocks.scheduleJob).not.toHaveBeenCalled()
  })

  it('falls back to an in-process timer when scheduling fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: expiresAt })
    const schedule = vi.fn().mockRejectedValue(new Error('Hatchet unavailable'))

    await activateLiveQuizBlock(
      { quizId, blockId },
      activationContext(schedule)
    )
    vi.useRealTimers()

    expect(mocks.scheduleJob).toHaveBeenCalledWith(
      new Date(expiresAt.getTime() + 10_000),
      expect.any(Function)
    )
    expect(mocks.sendTeamsNotification).toHaveBeenCalled()
  })

  it('closes an overdue block shortly after a late scheduling failure', async () => {
    const now = new Date(expiresAt.getTime() + 60_000)
    vi.useFakeTimers({ toFake: ['Date'], now })
    const schedule = vi.fn().mockRejectedValue(new Error('Hatchet timeout'))

    await activateLiveQuizBlock(
      { quizId, blockId },
      activationContext(schedule)
    )
    vi.useRealTimers()

    expect(mocks.scheduleJob).toHaveBeenCalledWith(
      new Date(now.getTime() + 1000),
      expect.any(Function)
    )
  })
})
