import { ElementBlockStatus } from '@klicker-uzh/prisma/client'
import { updateLiveQuizBlockResultsFromCache } from '@klicker-uzh/util'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleStandardLiveQuizBlockClosureAggregation } from '../src/services/liveQuizzes.js'

vi.mock('@klicker-uzh/util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@klicker-uzh/util')>()
  return { ...actual, updateLiveQuizBlockResultsFromCache: vi.fn() }
})

const aggregate = vi.mocked(updateLiveQuizBlockResultsFromCache)

function fixture(
  status: ElementBlockStatus = ElementBlockStatus.EXECUTED,
  activeBlockId: number | null = null
) {
  const block = { id: 7, status, elements: [{ id: 1 }] }
  const expire = vi.fn()
  const keys = vi.fn().mockResolvedValue(['lq:quiz-1:i:1:results'])
  const context = {
    prisma: {
      liveQuiz: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ activeBlockId, blocks: [block] }),
      },
    },
    redisExec: {
      keys,
      pipeline: () => ({ expire, exec: vi.fn().mockResolvedValue([]) }),
    },
    redisAssessmentExec: {},
  }
  const execution = { logger: { info: vi.fn(), error: vi.fn() } }

  return {
    keys,
    expire,
    run: () =>
      handleStandardLiveQuizBlockClosureAggregation(
        { liveQuizId: 'quiz-1', blockId: block.id },
        context as unknown as Parameters<
          typeof handleStandardLiveQuizBlockClosureAggregation
        >[1],
        execution as unknown as Parameters<
          typeof handleStandardLiveQuizBlockClosureAggregation
        >[2]
      ),
  }
}

describe('delayed live quiz block aggregation', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects failed persistence before expiring the cached results', async () => {
    const { run, keys, expire } = fixture()
    aggregate.mockResolvedValue(null)

    await expect(run()).rejects.toThrow()
    expect(keys).not.toHaveBeenCalled()
    expect(expire).not.toHaveBeenCalled()
  })

  it.each([
    [ElementBlockStatus.ACTIVE, 7],
    [ElementBlockStatus.EXECUTED, 7],
    [ElementBlockStatus.SCHEDULED, null],
  ])('skips a block in state %s with active block %s', async (status, active) => {
    const { run, keys } = fixture(status, active)

    await expect(run()).resolves.toBe(true)
    expect(aggregate).not.toHaveBeenCalled()
    expect(keys).not.toHaveBeenCalled()
  })

  it('expires cached results only after successful persistence', async () => {
    const { run, keys, expire } = fixture()
    aggregate.mockResolvedValue({} as never)

    await expect(run()).resolves.toBe(true)
    expect(aggregate.mock.invocationCallOrder[0]).toBeLessThan(
      keys.mock.invocationCallOrder[0]!
    )
    expect(expire).toHaveBeenCalledWith('lq:quiz-1:i:1:results', 60 * 60 * 24)
  })
})
