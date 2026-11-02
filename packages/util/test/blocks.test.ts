import { describe, expect, it, vi } from 'vitest'
import { updateLiveQuizBlockResultsFromCache } from '../src/blocks.js'

const QUIZ_ID = 'quiz-1'
const BLOCK_ID = 7

function instance(id: number) {
  return {
    id,
    elementType: 'SC',
    elementData: { type: 'SC', options: { choices: [] } },
  }
}

// minimal Redis stub: multi().hgetall(key)...exec() returns the hashes
function mockRedis(hashes: Record<string, Record<string, string>>) {
  return {
    multi: () => {
      const keys: string[] = []
      const pipeline = {
        hgetall: (key: string) => {
          keys.push(key)
          return pipeline
        },
        exec: async () => keys.map((key) => [null, hashes[key] ?? {}]),
      }
      return pipeline
    },
  }
}

function mockPrisma({
  activeBlockId,
  blockStatus,
}: {
  activeBlockId: number | null
  blockStatus: string
}) {
  const update = vi.fn(async () => ({ id: QUIZ_ID, blocks: [] }))
  const prisma = {
    liveQuiz: {
      findUnique: vi.fn(async () => ({
        id: QUIZ_ID,
        isAssessmentEnabled: false,
        isGamificationEnabled: false,
        courseId: null,
        course: null,
        activeBlockId,
        blocks: [
          {
            id: BLOCK_ID,
            liveQuizId: QUIZ_ID,
            status: blockStatus,
            elements: [instance(1), instance(2)],
          },
        ],
      })),
      update,
    },
  }
  return { prisma, update }
}

// instance 1 has (late) cached results, the cache of instance 2 is gone
const redis = mockRedis({
  [`lq:${QUIZ_ID}:i:1:results`]: { participants: '2', '0': '2', '1': '1' },
})

function run(
  prisma: ReturnType<typeof mockPrisma>['prisma'],
  closeBlock: boolean
) {
  return updateLiveQuizBlockResultsFromCache({
    quizId: QUIZ_ID,
    blockId: BLOCK_ID,
    prisma: prisma as never,
    redisExec: redis as never,
    redisAssessmentExec: redis as never,
    updateResults: true,
    updateLeaderboards: false,
    closeBlock,
  })
}

describe('updateLiveQuizBlockResultsFromCache', () => {
  it('re-aggregates a closed block without changing its status', async () => {
    const { prisma, update } = mockPrisma({
      activeBlockId: null,
      blockStatus: 'EXECUTED',
    })

    const result = await run(prisma, false)

    expect(result).not.toBeNull()
    const { data } = (update.mock.calls[0] as any)[0]
    expect(data.activeBlock).toBeUndefined()
    expect(data.blocks.update.data.status).toBeUndefined()
    expect(data.blocks.update.data.closedAt).toBeUndefined()
    // only the instance with cached results is written
    expect(data.blocks.update.data.elements.update).toEqual([
      {
        where: { id: 1 },
        data: {
          anonymousResults: { choices: { 0: 2, 1: 1 }, total: 2 },
          results: undefined,
        },
      },
    ])
  })

  it('re-aggregates while a later block is already running', async () => {
    const { prisma, update } = mockPrisma({
      activeBlockId: BLOCK_ID + 1,
      blockStatus: 'EXECUTED',
    })

    expect(await run(prisma, false)).not.toBeNull()
    const { data } = (update.mock.calls[0] as any)[0]
    // the running block must stay active
    expect(data.activeBlock).toBeUndefined()
  })

  it('does not re-aggregate a block that is not closed', async () => {
    const { prisma, update } = mockPrisma({
      activeBlockId: BLOCK_ID,
      blockStatus: 'ACTIVE',
    })

    expect(await run(prisma, false)).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })

  it('closes the active block and persists its results', async () => {
    const { prisma, update } = mockPrisma({
      activeBlockId: BLOCK_ID,
      blockStatus: 'ACTIVE',
    })

    expect(await run(prisma, true)).not.toBeNull()
    const { data } = (update.mock.calls[0] as any)[0]
    expect(data.activeBlock).toEqual({ disconnect: true })
    expect(data.blocks.update.data.status).toBe('EXECUTED')
    expect(data.blocks.update.data.closedAt).toBeInstanceOf(Date)
  })

  it('does not close a block that is not active', async () => {
    const { prisma, update } = mockPrisma({
      activeBlockId: null,
      blockStatus: 'EXECUTED',
    })

    expect(await run(prisma, true)).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })
})
