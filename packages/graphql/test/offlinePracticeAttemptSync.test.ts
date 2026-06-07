import {
  ElementType,
  OfflinePracticeAttemptSyncStatus,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { StackFeedbackStatus } from '@klicker-uzh/types'
import { syncOfflinePracticeAttempts } from '../src/services/stacks.js'

const scElementData = {
  id: 'element-34-v1',
  elementId: 34,
  type: ElementType.SC,
  name: 'SC',
  content: 'Question',
  explanation: null,
  pointsMultiplier: 1,
  options: {
    hasSampleSolution: true,
    hasAnswerFeedbacks: false,
    displayMode: 'LIST',
    choices: [
      { ix: 0, value: 'Correct', correct: true },
      { ix: 1, value: 'Wrong', correct: false },
    ],
  },
}

function createScResults() {
  return {
    choices: { 0: 0, 1: 0 },
    total: 0,
  }
}

const baseAttempt = {
  clientAttemptId: ' attempt-1 ',
  quizId: 'quiz-id',
  quizRevision: 'quiz-id:2026-06-01T12:00:00.000Z',
  stackId: 12,
  stackAnswerTime: 42,
  responses: [
    {
      instanceId: 34,
      type: ElementType.SC,
      choicesResponse: [{ ix: 0, selected: true }],
    },
  ],
}

function createContext() {
  const offlinePracticeAttemptSync = {
    create: vi.fn().mockResolvedValue({ id: 1 }),
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({ id: 1 }),
  }
  const participation = {
    id: 'participation-id',
    courseId: 'course-id',
    participantId: 'participant-id',
    isActive: true,
    participant: {
      id: 'participant-id',
      xp: 0,
    },
  }
  const practiceQuiz = {
    findFirst: vi.fn().mockResolvedValue({
      id: 'quiz-id',
      courseId: 'course-id',
      updatedAt: new Date('2026-06-01T12:00:00.000Z'),
      stacks: [
        {
          id: 12,
          elements: [
            {
              id: 34,
              elementType: ElementType.SC,
              elementData: scElementData,
            },
          ],
        },
      ],
    }),
  }
  const elementStack = {
    findUnique: vi.fn().mockResolvedValue({
      id: 12,
      microLearning: null,
      elements: [{ id: 34, responses: [] }],
    }),
  }
  const participationStore = {
    findUnique: vi.fn().mockResolvedValue(participation),
  }
  const elementInstanceRecord = {
    id: 34,
    elementType: ElementType.SC,
    elementData: scElementData,
    results: createScResults(),
    anonymousResults: createScResults(),
    options: { pointsMultiplier: 1 },
    instanceStatistics: {
      uniqueParticipantCount: 0,
      averageTimeSpent: 0,
    },
    responses: [],
    elementStack: {
      practiceQuizId: 'quiz-id',
      microLearningId: null,
    },
  }
  const elementInstance = {
    findUnique: vi.fn().mockResolvedValue(elementInstanceRecord),
    update: vi.fn().mockResolvedValue({
      ...elementInstanceRecord,
      results: {
        choices: { 0: 1, 1: 0 },
        total: 1,
      },
    }),
  }
  const questionResponseDetail = {
    create: vi.fn().mockResolvedValue({ id: 1 }),
  }
  const questionResponse = {
    upsert: vi.fn().mockResolvedValue({ id: 1 }),
  }
  const participant = {
    update: vi.fn().mockResolvedValue({ id: 'participant-id' }),
  }
  const leaderboardEntry = {
    upsert: vi.fn().mockResolvedValue({ id: 1 }),
  }
  const timelineEntry = {
    upsert: vi.fn().mockResolvedValue({ id: 1 }),
  }
  const transactionPrisma = {
    offlinePracticeAttemptSync,
    practiceQuiz,
    elementStack,
    participation: participationStore,
    elementInstance,
    questionResponseDetail,
    questionResponse,
    participant,
    leaderboardEntry,
    timelineEntry,
  }

  return {
    ctx: {
      user: {
        sub: 'participant-id',
        role: UserRole.PARTICIPANT,
      },
      prisma: {
        $transaction: vi.fn(async (callback) => callback(transactionPrisma)),
        offlinePracticeAttemptSync,
        practiceQuiz,
      },
    } as any,
    offlinePracticeAttemptSync,
    practiceQuiz,
    elementStack,
    participation: participationStore,
    elementInstance,
    questionResponseDetail,
    questionResponse,
    participant,
    leaderboardEntry,
    timelineEntry,
  }
}

describe('offline practice attempt sync', () => {
  it('applies accepted attempts through the official response path and stores sanitized replay feedback', async () => {
    const { ctx, offlinePracticeAttemptSync, questionResponseDetail } =
      createContext()

    const result = await syncOfflinePracticeAttempts(
      { attempts: [baseAttempt] },
      ctx
    )

    expect(result).toEqual([
      {
        clientAttemptId: 'attempt-1',
        status: OfflinePracticeAttemptSyncStatus.ACCEPTED,
        feedback: expect.objectContaining({
          id: 12,
          status: StackFeedbackStatus.CORRECT,
          score: 10,
          evaluations: expect.arrayContaining([
            expect.objectContaining({ instanceId: 34 }),
          ]),
        }),
      },
    ])
    expect(questionResponseDetail.create).toHaveBeenCalled()
    expect(offlinePracticeAttemptSync.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          status: OfflinePracticeAttemptSyncStatus.ACCEPTED,
          serverFeedback: {
            id: 12,
            status: StackFeedbackStatus.CORRECT,
            score: 10,
          },
          errorMessage: null,
        }),
      })
    )
    expect(
      offlinePracticeAttemptSync.update.mock.calls.at(-1)![0].data
        .serverFeedback
    ).not.toHaveProperty('evaluations')
  })

  it('returns already synced for a duplicate accepted attempt without applying it again', async () => {
    const { ctx, offlinePracticeAttemptSync, practiceQuiz } = createContext()
    offlinePracticeAttemptSync.create.mockRejectedValueOnce({ code: 'P2002' })
    offlinePracticeAttemptSync.findUnique.mockImplementationOnce(async () => ({
      clientAttemptId: 'attempt-1',
      attemptHash:
        offlinePracticeAttemptSync.create.mock.calls[0]![0].data.attemptHash,
      status: OfflinePracticeAttemptSyncStatus.ACCEPTED,
      serverFeedback: {
        id: 12,
        status: StackFeedbackStatus.CORRECT,
        score: 1,
      },
      errorMessage: null,
    }))

    const result = await syncOfflinePracticeAttempts(
      { attempts: [baseAttempt] },
      ctx
    )

    expect(result).toEqual([
      {
        clientAttemptId: 'attempt-1',
        status: 'ALREADY_SYNCED',
        feedback: {
          id: 12,
          status: StackFeedbackStatus.CORRECT,
          score: 1,
        },
        message: null,
      },
    ])
    expect(offlinePracticeAttemptSync.findUnique).toHaveBeenCalledWith({
      where: {
        participantId_clientAttemptId: {
          participantId: 'participant-id',
          clientAttemptId: 'attempt-1',
        },
      },
    })
    expect(practiceQuiz.findFirst).not.toHaveBeenCalled()
    expect(offlinePracticeAttemptSync.update).not.toHaveBeenCalled()
  })

  it('rejects idempotency key reuse with a different payload', async () => {
    const { ctx, offlinePracticeAttemptSync, practiceQuiz } = createContext()
    offlinePracticeAttemptSync.create.mockRejectedValueOnce({ code: 'P2002' })
    offlinePracticeAttemptSync.findUnique.mockResolvedValueOnce({
      clientAttemptId: 'attempt-1',
      attemptHash: 'different-payload-hash',
      status: OfflinePracticeAttemptSyncStatus.ACCEPTED,
      serverFeedback: null,
      errorMessage: null,
    })

    const result = await syncOfflinePracticeAttempts(
      { attempts: [baseAttempt] },
      ctx
    )

    expect(result).toEqual([
      {
        clientAttemptId: 'attempt-1',
        status: OfflinePracticeAttemptSyncStatus.SERVER_ERROR,
        message: 'Offline practice attempt id was reused with different data.',
      },
    ])
    expect(practiceQuiz.findFirst).not.toHaveBeenCalled()
    expect(offlinePracticeAttemptSync.update).not.toHaveBeenCalled()
  })

  it('persists and returns stale revision conflicts before applying an attempt', async () => {
    const { ctx, offlinePracticeAttemptSync, practiceQuiz } = createContext()
    practiceQuiz.findFirst.mockResolvedValueOnce({
      id: 'quiz-id',
      courseId: 'course-id',
      updatedAt: new Date('2026-06-02T12:00:00.000Z'),
      stacks: [
        {
          id: 12,
          elements: [{ id: 34, elementType: ElementType.SC }],
        },
      ],
    })

    const result = await syncOfflinePracticeAttempts(
      { attempts: [baseAttempt] },
      ctx
    )

    expect(result).toEqual([
      {
        clientAttemptId: 'attempt-1',
        status: OfflinePracticeAttemptSyncStatus.STALE_REVISION,
        message: 'Downloaded practice quiz revision is stale.',
      },
    ])
    expect(offlinePracticeAttemptSync.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientAttemptId: 'attempt-1',
        attemptHash: expect.any(String),
        participantId: 'participant-id',
        practiceQuizId: 'quiz-id',
        quizRevision: 'quiz-id:2026-06-01T12:00:00.000Z',
        stackId: 12,
        status: OfflinePracticeAttemptSyncStatus.SERVER_ERROR,
        errorMessage: null,
      }),
    })
    expect(practiceQuiz.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'quiz-id' }),
      })
    )
    expect(offlinePracticeAttemptSync.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          status: OfflinePracticeAttemptSyncStatus.STALE_REVISION,
          errorMessage: 'Downloaded practice quiz revision is stale.',
        }),
      })
    )
  })

  it('rejects attempts that contain responses outside the downloaded stack', async () => {
    const { ctx, offlinePracticeAttemptSync } = createContext()

    const result = await syncOfflinePracticeAttempts(
      {
        attempts: [
          {
            ...baseAttempt,
            responses: [
              {
                instanceId: 99,
                type: ElementType.SC,
                choicesResponse: [{ ix: 0, selected: true }],
              },
            ],
          },
        ],
      },
      ctx
    )

    expect(result).toEqual([
      {
        clientAttemptId: 'attempt-1',
        status: OfflinePracticeAttemptSyncStatus.NO_LONGER_AUTHORIZED,
        message: 'Offline practice attempt payload is invalid.',
      },
    ])
    expect(offlinePracticeAttemptSync.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          status: OfflinePracticeAttemptSyncStatus.NO_LONGER_AUTHORIZED,
          errorMessage: 'Offline practice attempt payload is invalid.',
        }),
      })
    )
  })

  it('rejects duplicate responses for the same stack instance', async () => {
    const { ctx, offlinePracticeAttemptSync } = createContext()

    const result = await syncOfflinePracticeAttempts(
      {
        attempts: [
          {
            ...baseAttempt,
            responses: [
              baseAttempt.responses[0]!,
              {
                ...baseAttempt.responses[0]!,
                choicesResponse: [{ ix: 1, selected: true }],
              },
            ],
          },
        ],
      },
      ctx
    )

    expect(result).toEqual([
      {
        clientAttemptId: 'attempt-1',
        status: OfflinePracticeAttemptSyncStatus.NO_LONGER_AUTHORIZED,
        message: 'Offline practice attempt payload is invalid.',
      },
    ])
    expect(offlinePracticeAttemptSync.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          status: OfflinePracticeAttemptSyncStatus.NO_LONGER_AUTHORIZED,
          errorMessage: 'Offline practice attempt payload is invalid.',
        }),
      })
    )
  })

  it('rejects malformed nested response payloads before applying an attempt', async () => {
    const { ctx, offlinePracticeAttemptSync, elementInstance } = createContext()

    const result = await syncOfflinePracticeAttempts(
      {
        attempts: [
          {
            ...baseAttempt,
            responses: [
              {
                instanceId: 34,
                type: ElementType.SC,
                choicesResponse: [{ ix: 99, selected: true }],
              },
            ],
          },
        ],
      },
      ctx
    )

    expect(result).toEqual([
      {
        clientAttemptId: 'attempt-1',
        status: OfflinePracticeAttemptSyncStatus.NO_LONGER_AUTHORIZED,
        message: 'Offline practice attempt payload is invalid.',
      },
    ])
    expect(elementInstance.findUnique).not.toHaveBeenCalled()
    expect(offlinePracticeAttemptSync.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          status: OfflinePracticeAttemptSyncStatus.NO_LONGER_AUTHORIZED,
          errorMessage: 'Offline practice attempt payload is invalid.',
        }),
      })
    )
  })
})
