import { createHmac } from 'node:crypto'
import {
  ElementBlockStatus,
  ElementType,
  LiveQuizResponseCollectionMode,
  PublicationStatus,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { getCorrelatedLiveQuizResponseExport } from '../src/services/correlatedLiveQuizResponseExport.js'

interface LiveQuizFixture {
  displayName: string
  exportSalt: string
  isAssessmentEnabled: boolean
  responseCollectionMode: LiveQuizResponseCollectionMode
  status: PublicationStatus
}

const defaultLiveQuiz: LiveQuizFixture = {
  displayName: 'Correlated Quiz',
  exportSalt: 'quiz-salt',
  isAssessmentEnabled: false,
  responseCollectionMode: LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
  status: PublicationStatus.ENDED,
}

const defaultBlocks = [
  {
    execution: 0,
    order: 0,
    status: ElementBlockStatus.EXECUTED,
    elements: [{ id: 10, order: 0, elementType: ElementType.SC }],
  },
]

const defaultResponses = [
  {
    basePoints: 10,
    bonusPoints: 2,
    correctness: ResponseCorrectness.CORRECT,
    correctnessPoints: 5,
    elementBlockExecution: 0,
    instanceId: 10,
    participantId: 'participant-id',
    respondentId: null,
    response: { value: 'answer' },
  },
  {
    basePoints: 10,
    bonusPoints: 0,
    correctness: ResponseCorrectness.WRONG,
    correctnessPoints: 0,
    elementBlockExecution: 0,
    instanceId: 10,
    participantId: null,
    respondentId: 'respondent-id',
    response: { value: 'another answer' },
  },
]

function hashIdentity(identityKey: string) {
  return createHmac('sha256', defaultLiveQuiz.exportSalt)
    .update(identityKey)
    .digest('hex')
}

function createContext({
  liveQuiz = defaultLiveQuiz,
  blocks = defaultBlocks,
  responses = defaultResponses,
  labels = [],
  pendingResponseCount = 0,
  responseBytes,
  responseCount,
  respondentCount,
}: {
  liveQuiz?: typeof defaultLiveQuiz | null
  blocks?: any[]
  responses?: any[]
  labels?: { identityHash: string; label: number }[]
  pendingResponseCount?: number
  responseBytes?: bigint
  responseCount?: bigint
  respondentCount?: bigint
} = {}) {
  const queryRaw = vi
    .fn()
    .mockResolvedValueOnce(liveQuiz === null ? [] : [liveQuiz])
    .mockResolvedValueOnce([
      {
        responseBytes:
          responseBytes ??
          BigInt(
            responses.reduce(
              (total, response) =>
                total + JSON.stringify(response.response).length,
              0
            )
          ),
        responseCount: responseCount ?? BigInt(responses.length),
        respondentCount:
          respondentCount ??
          BigInt(
            new Set(
              responses.map((response) =>
                response.participantId
                  ? `participant:${response.participantId}`
                  : `respondent:${response.respondentId}`
              )
            ).size
          ),
      },
    ])
  const blockFindMany = vi.fn().mockResolvedValue(blocks)
  const responseFindMany = vi.fn().mockResolvedValue(responses)
  const labelFindMany = vi.fn().mockResolvedValue(labels)
  const labelCreateMany = vi.fn().mockResolvedValue({ count: 0 })
  const pendingResponseCountFn = vi.fn().mockResolvedValue(pendingResponseCount)
  const transactionPrisma = {
    $queryRaw: queryRaw,
    elementBlock: { findMany: blockFindMany },
    liveQuizResponse: { findMany: responseFindMany },
    liveQuizPendingResponse: { count: pendingResponseCountFn },
    liveQuizResponseExportLabel: {
      findMany: labelFindMany,
      createMany: labelCreateMany,
    },
  }
  const transaction = vi
    .fn()
    .mockImplementation(async (callback: (prisma: any) => Promise<unknown>) =>
      callback(transactionPrisma)
    )

  return {
    blockFindMany,
    labelCreateMany,
    responseFindMany,
    ctx: {
      user: { sub: 'lecturer-id' },
      prisma: { $transaction: transaction },
    } as unknown as ContextWithUser,
  }
}

describe('getCorrelatedLiveQuizResponseExport', () => {
  it('returns a respondent-row CSV without source identities', async () => {
    const { ctx, blockFindMany, labelCreateMany, responseFindMany } =
      createContext()

    const result = await getCorrelatedLiveQuizResponseExport(
      { id: 'quiz-id' },
      ctx
    )

    expect(result.filename).toBe('live-quiz-correlated-quiz-responses.csv')
    expect(result.content).toContain(
      'block_01_question_01_execution_01_response'
    )
    expect(result.content).not.toContain('participant-id')
    expect(result.content).not.toContain('respondent-id')
    expect(result.content.match(/^respondent_\d{3},/gm)).toHaveLength(2)
    expect(labelCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ label: 1, liveQuizId: 'quiz-id' }),
        expect.objectContaining({ label: 2, liveQuizId: 'quiz-id' }),
      ]),
    })
    expect(blockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [ElementBlockStatus.EXECUTED, ElementBlockStatus.ACTIVE],
          },
        }),
        select: expect.objectContaining({
          elements: expect.objectContaining({
            where: { elementType: { not: ElementType.FREE_TEXT } },
          }),
        }),
      })
    )
    expect(responseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          instance: expect.objectContaining({
            elementType: { not: ElementType.FREE_TEXT },
          }),
        }),
      })
    )
  })

  it('excludes free-text questions and answers from the CSV', async () => {
    const freeTextResponse = {
      ...defaultResponses[0]!,
      instanceId: 11,
      response: { value: 'private free-text answer' },
    }
    const { ctx } = createContext({
      blocks: [
        {
          ...defaultBlocks[0],
          elements: [
            { id: 10, order: 0, elementType: ElementType.SC },
            { id: 11, order: 1, elementType: ElementType.FREE_TEXT },
          ],
        },
      ],
      responses: [...defaultResponses, freeTextResponse],
    })

    const result = await getCorrelatedLiveQuizResponseExport(
      { id: 'quiz-id' },
      ctx
    )

    expect(result.content).toContain('block_01_question_01_execution_01')
    expect(result.content).not.toContain('block_01_question_02_execution_01')
    expect(result.content).not.toContain('private free-text answer')
  })

  it('keeps existing labels when a late response is added', async () => {
    const lateResponse = {
      ...defaultResponses[1]!,
      respondentId: 'late-respondent-id',
      response: { value: 'late answer' },
    }
    const { ctx, labelCreateMany } = createContext({
      responses: [...defaultResponses, lateResponse],
      labels: [
        {
          identityHash: hashIdentity('participant:participant-id'),
          label: 1,
        },
        {
          identityHash: hashIdentity('respondent:respondent-id'),
          label: 2,
        },
      ],
    })

    const result = await getCorrelatedLiveQuizResponseExport(
      { id: 'quiz-id' },
      ctx
    )
    const rows = result.content.split('\r\n')

    expect(rows.find((row) => row.includes(',answer,'))).toMatch(
      /^respondent_001,/
    )
    expect(rows.find((row) => row.includes(',another answer,'))).toMatch(
      /^respondent_002,/
    )
    expect(rows.find((row) => row.includes(',late answer,'))).toMatch(
      /^respondent_003,/
    )
    expect(labelCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          identityHash: hashIdentity('respondent:late-respondent-id'),
          label: 3,
        }),
      ],
    })
  })

  it.each([
    {
      name: 'quiz is still running',
      overrides: { status: PublicationStatus.PUBLISHED },
      error: 'LIVE_QUIZ_CORRELATED_EXPORT_NOT_READY',
    },
    {
      name: 'quiz uses aggregate collection',
      overrides: {
        responseCollectionMode:
          LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS,
      },
      error: 'LIVE_QUIZ_CORRELATED_EXPORT_UNAVAILABLE',
    },
    {
      name: 'quiz is an assessment',
      overrides: { isAssessmentEnabled: true },
      error: 'LIVE_QUIZ_CORRELATED_EXPORT_UNAVAILABLE',
    },
  ])('rejects the export when $name', async ({ overrides, error }) => {
    const { ctx, responseFindMany } = createContext({
      liveQuiz: { ...defaultLiveQuiz, ...overrides },
    })

    await expect(
      getCorrelatedLiveQuizResponseExport({ id: 'quiz-id' }, ctx)
    ).rejects.toThrow(error)
    expect(responseFindMany).not.toHaveBeenCalled()
  })

  it('returns a clear error when no responses were persisted', async () => {
    const { ctx } = createContext({ responses: [] })

    await expect(
      getCorrelatedLiveQuizResponseExport({ id: 'quiz-id' }, ctx)
    ).rejects.toThrow('LIVE_QUIZ_CORRELATED_EXPORT_EMPTY')
  })

  it('waits until all acknowledged responses have been processed', async () => {
    const { ctx, responseFindMany } = createContext({
      pendingResponseCount: 1,
    })

    await expect(
      getCorrelatedLiveQuizResponseExport({ id: 'quiz-id' }, ctx)
    ).rejects.toThrow('LIVE_QUIZ_CORRELATED_EXPORT_NOT_READY')
    expect(responseFindMany).not.toHaveBeenCalled()
  })

  it('rejects oversized response input before materializing response rows', async () => {
    const { ctx, responseFindMany } = createContext({
      responseBytes: BigInt(5 * 1024 * 1024 + 1),
    })

    await expect(
      getCorrelatedLiveQuizResponseExport({ id: 'quiz-id' }, ctx)
    ).rejects.toThrow('LIVE_QUIZ_CORRELATED_EXPORT_TOO_LARGE')
    expect(responseFindMany).not.toHaveBeenCalled()
  })

  it('rejects a sparse response matrix before materializing response rows', async () => {
    const { ctx, responseFindMany } = createContext({
      blocks: [
        {
          ...defaultBlocks[0],
          elements: Array.from({ length: 41 }, (_, index) => ({
            id: index + 10,
            order: index,
            elementType: ElementType.SC,
          })),
        },
      ],
      responseBytes: 1n,
      responseCount: 25_000n,
      respondentCount: 25_000n,
    })

    await expect(
      getCorrelatedLiveQuizResponseExport({ id: 'quiz-id' }, ctx)
    ).rejects.toThrow('LIVE_QUIZ_CORRELATED_EXPORT_TOO_LARGE')
    expect(responseFindMany).not.toHaveBeenCalled()
  })

  it('rejects oversized CSV headers before materializing response rows', async () => {
    const { ctx, responseFindMany } = createContext({
      blocks: [
        {
          ...defaultBlocks[0],
          elements: Array.from({ length: 50_000 }, (_, index) => ({
            id: index + 10,
            order: index,
            elementType: ElementType.SC,
          })),
        },
      ],
      responseBytes: 1n,
      responseCount: 1n,
      respondentCount: 1n,
    })

    await expect(
      getCorrelatedLiveQuizResponseExport({ id: 'quiz-id' }, ctx)
    ).rejects.toThrow('LIVE_QUIZ_CORRELATED_EXPORT_TOO_LARGE')
    expect(responseFindMany).not.toHaveBeenCalled()
  })

  it('rejects combined header and response output before materializing rows', async () => {
    const { ctx, responseFindMany } = createContext({
      blocks: [
        {
          ...defaultBlocks[0],
          elements: Array.from({ length: 25_000 }, (_, index) => ({
            id: index + 10,
            order: index,
            elementType: ElementType.SC,
          })),
        },
      ],
      responseBytes: 500_000n,
      responseCount: 1n,
      respondentCount: 1n,
    })

    await expect(
      getCorrelatedLiveQuizResponseExport({ id: 'quiz-id' }, ctx)
    ).rejects.toThrow('LIVE_QUIZ_CORRELATED_EXPORT_TOO_LARGE')
    expect(responseFindMany).not.toHaveBeenCalled()
  })
})
