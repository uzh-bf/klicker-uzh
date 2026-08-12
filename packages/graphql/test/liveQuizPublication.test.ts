import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { transitionLiveQuizToPublished } from '../src/services/liveQuizPublication.js'

function makePrisma({
  sourceStatus,
  availableFrom,
}: {
  sourceStatus: DB.PublicationStatus
  availableFrom: Date | null
}) {
  let state = {
    id: 'live-quiz-id',
    status: sourceStatus,
    responseCollectionMode: DB.LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
    availableFrom,
    scheduledPublicationTaskId: 'task-id',
    startedAt: null,
  }

  const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    state = { ...state, ...data }
    return state
  })

  const transaction = {
    $queryRaw: vi.fn(async () => [{ id: state.id }]),
    liveQuiz: {
      findUnique: vi.fn(async () => ({ ...state })),
      update,
    },
  }

  let transactionTail = Promise.resolve()
  const prisma = {
    $transaction: async (
      callback: (tx: typeof transaction) => Promise<unknown>
    ) => {
      const previous = transactionTail
      let release!: () => void
      transactionTail = new Promise<void>((resolve) => {
        release = resolve
      })
      await previous
      try {
        return await callback(transaction)
      } finally {
        release()
      }
    },
  } as unknown as DB.PrismaClient

  return { prisma, readState: () => state, update }
}

describe('live quiz publication gate', () => {
  it.each([
    {
      source: 'manual' as const,
      status: DB.PublicationStatus.DRAFT,
      availableFrom: null,
    },
    {
      source: 'scheduled' as const,
      status: DB.PublicationStatus.SCHEDULED,
      availableFrom: new Date('2026-08-11T09:59:00.000Z'),
    },
  ])('rejects $source publication while the gate is disabled', async (caseData) => {
    const fake = makePrisma({
      sourceStatus: caseData.status,
      availableFrom: caseData.availableFrom,
    })

    await expect(
      transitionLiveQuizToPublished({
        prisma: fake.prisma,
        liveQuizId: 'live-quiz-id',
        source: caseData.source,
        now: new Date('2026-08-11T10:00:00.000Z'),
        correlatedResponsesEnabled: false,
      })
    ).rejects.toThrow(
      'Correlated live quiz publication is not enabled on this deployment'
    )
    expect(fake.readState().status).toBe(caseData.status)
    expect(fake.update).not.toHaveBeenCalled()
  })

  it.each([
    {
      source: 'manual' as const,
      status: DB.PublicationStatus.DRAFT,
      availableFrom: null,
    },
    {
      source: 'scheduled' as const,
      status: DB.PublicationStatus.SCHEDULED,
      availableFrom: new Date('2026-08-11T09:59:00.000Z'),
    },
  ])('publishes $source correlated quizzes when the gate is enabled', async (caseData) => {
    const fake = makePrisma({
      sourceStatus: caseData.status,
      availableFrom: caseData.availableFrom,
    })

    const result = await transitionLiveQuizToPublished({
      prisma: fake.prisma,
      liveQuizId: 'live-quiz-id',
      source: caseData.source,
      now: new Date('2026-08-11T10:00:00.000Z'),
      correlatedResponsesEnabled: true,
    })

    expect(result?.didStart).toBe(true)
    expect(fake.readState().status).toBe(DB.PublicationStatus.PUBLISHED)
    expect(fake.update).toHaveBeenCalledTimes(1)
  })

  it('starts a concurrent publication only once', async () => {
    const fake = makePrisma({
      sourceStatus: DB.PublicationStatus.DRAFT,
      availableFrom: null,
    })
    const args = {
      prisma: fake.prisma,
      liveQuizId: 'live-quiz-id',
      source: 'manual' as const,
      now: new Date('2026-08-11T10:00:00.000Z'),
      correlatedResponsesEnabled: true,
    }

    const results = await Promise.all([
      transitionLiveQuizToPublished(args),
      transitionLiveQuizToPublished(args),
    ])

    expect(results.map((result) => result?.didStart).sort()).toEqual([
      false,
      true,
    ])
    expect(fake.update).toHaveBeenCalledTimes(1)
  })
})
