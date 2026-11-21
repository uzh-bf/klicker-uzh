import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { deactivateLiveQuizBlock } from '../src/services/liveQuizzes.js'
import {
  getEscapeRoomProgress,
  lecturerCtx,
  prisma,
  seedEscapeRoomLiveQuiz,
  seedParticipant,
} from './escapeRoomTestHarness.js'

// The cache drain is replaced so a test can choose whether the close
// succeeds; every other caller keeps the real implementation.
const drain = vi.hoisted(() => ({ result: undefined as unknown }))
vi.mock('@klicker-uzh/util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@klicker-uzh/util')>()
  return {
    ...actual,
    updateLiveQuizBlockResultsFromCache: vi.fn(async () => drain.result),
  }
})

function closeCtx() {
  return {
    ...lecturerCtx,
    pubSub: { publish: vi.fn() },
    tasks: {
      aggregateLiveQuizBlockResultsStandard: { schedule: vi.fn() },
      aggregateLiveQuizBlockResultsAssessment: { schedule: vi.fn() },
    },
  } as any
}

function progressCtx() {
  const pipeline = {
    smembers: vi.fn().mockReturnThis(),
    exec: vi.fn(async () => pipeline.smembers.mock.calls.map(() => [null, []])),
  }
  return {
    ...lecturerCtx,
    redisExec: { ...lecturerCtx.redisExec, pipeline: () => pipeline },
  } as any
}

async function seedAttempt(
  blockId: number,
  name: string,
  data: Partial<DB.Prisma.EscapeRoomAttemptUncheckedCreateInput> = {}
) {
  const participant = await seedParticipant(name)
  return prisma.escapeRoomAttempt.create({
    data: {
      participantId: participant.id,
      elementBlockId: blockId,
      status: DB.EscapeRoomStatus.IN_PROGRESS,
      timeLimit: 300,
      startedAt: new Date(),
      ...data,
    },
  })
}

describe('LiveQuiz escape-room results after the block closes', () => {
  it('finishes running attempts on close and keeps their cleared stages', async () => {
    const { liveQuiz, block } = await seedEscapeRoomLiveQuiz({
      includeSecondInstance: true,
    })
    const firstStage = String(block.elements[0]!.id)
    const running = await seedAttempt(block.id, 'close-running', {
      stageOutcomes: [
        {
          stageKey: firstStage,
          wrongAttempts: 1,
          outcome: 'SOLVED',
          at: new Date().toISOString(),
        },
      ] as any,
    })
    const completed = await seedAttempt(block.id, 'close-completed', {
      status: DB.EscapeRoomStatus.COMPLETED,
      completedAt: new Date(),
    })

    drain.result = {
      updatedQuiz: { id: liveQuiz.id, isAssessmentEnabled: false, blocks: [] },
      activeInstanceIds: [],
    }
    await expect(
      deactivateLiveQuizBlock(
        { quizId: liveQuiz.id, blockId: block.id },
        closeCtx()
      )
    ).resolves.toBe(true)

    const statuses = await prisma.escapeRoomAttempt.findMany({
      where: { id: { in: [running.id, completed.id] } },
      select: { id: true, status: true },
    })
    expect(Object.fromEntries(statuses.map((a) => [a.id, a.status]))).toEqual({
      [running.id]: DB.EscapeRoomStatus.EXPIRED,
      [completed.id]: DB.EscapeRoomStatus.COMPLETED,
    })

    const progress = await getEscapeRoomProgress(
      { liveQuizId: liveQuiz.id, elementBlockId: block.id },
      progressCtx()
    )
    expect(
      progress?.attempts.find((entry) => entry.id === running.id)
    ).toMatchObject({ status: DB.EscapeRoomStatus.EXPIRED, clearedStacks: 1 })
  })

  it('leaves attempts running when the close fails', async () => {
    const { liveQuiz, block } = await seedEscapeRoomLiveQuiz()
    const running = await seedAttempt(block.id, 'close-failed')

    drain.result = null
    await expect(
      deactivateLiveQuizBlock(
        { quizId: liveQuiz.id, blockId: block.id },
        closeCtx()
      )
    ).resolves.toBe(false)

    await expect(
      prisma.escapeRoomAttempt.findUniqueOrThrow({ where: { id: running.id } })
    ).resolves.toMatchObject({ status: DB.EscapeRoomStatus.IN_PROGRESS })
  })

  it('finishes an attempt left running on an already closed block', async () => {
    const { liveQuiz, block } = await seedEscapeRoomLiveQuiz({ active: false })
    await prisma.elementBlock.update({
      where: { id: block.id },
      data: { status: DB.ElementBlockStatus.EXECUTED },
    })
    const running = await seedAttempt(block.id, 'close-late-start')

    const progress = await getEscapeRoomProgress(
      { liveQuizId: liveQuiz.id, elementBlockId: block.id },
      progressCtx()
    )

    expect(
      progress?.attempts.find((entry) => entry.id === running.id)?.status
    ).toBe(DB.EscapeRoomStatus.EXPIRED)
    await expect(
      prisma.escapeRoomAttempt.findUniqueOrThrow({ where: { id: running.id } })
    ).resolves.toMatchObject({ status: DB.EscapeRoomStatus.EXPIRED })
  })
})
