import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  TEST_PREFIX,
  courseId,
  createdParticipantIds,
  createdStandaloneAttemptIds,
  getEscapeRoomProgress,
  handlePruneEscapeRooms,
  lecturerCtx,
  participantCtx,
  prisma,
  respondToElementStack,
  scResponse,
  seedEscapeRoomQuiz,
  seedParticipant,
  startEscapeRoomAttempt,
} from './escapeRoomTestHarness.js'

// ! B4: prune retention window
// #region
describe('handlePruneEscapeRooms - retention window (B4)', () => {
  it('marks finished attempts and only deletes ones older than the retention window', async () => {
    const now = new Date()
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)

    const recentAttempt = await prisma.escapeRoomAttempt.create({
      data: {
        startedAt: now,
        timeLimit: 3600,
        status: DB.EscapeRoomStatus.COMPLETED,
        completedAt: now,
        statsAggregatedAt: null,
      },
    })
    createdStandaloneAttemptIds.push(recentAttempt.id)

    const oldAttempt = await prisma.escapeRoomAttempt.create({
      data: {
        startedAt: oldDate,
        timeLimit: 3600,
        status: DB.EscapeRoomStatus.COMPLETED,
        completedAt: oldDate,
        statsAggregatedAt: null,
      },
    })
    createdStandaloneAttemptIds.push(oldAttempt.id)

    const recentlyCompletedLongRunningAttempt =
      await prisma.escapeRoomAttempt.create({
        data: {
          startedAt: oldDate,
          timeLimit: 3600,
          status: DB.EscapeRoomStatus.COMPLETED,
          completedAt: now,
          statsAggregatedAt: null,
        },
      })
    createdStandaloneAttemptIds.push(recentlyCompletedLongRunningAttempt.id)

    const logger = { info: vi.fn(), error: vi.fn() }
    const result = await handlePruneEscapeRooms({ prisma }, { logger })
    expect(result).toBe(true)

    const recentAfter = await prisma.escapeRoomAttempt.findUnique({
      where: { id: recentAttempt.id },
    })
    expect(recentAfter).not.toBeNull()
    expect(recentAfter!.statsAggregatedAt).not.toBeNull()

    const oldAfter = await prisma.escapeRoomAttempt.findUnique({
      where: { id: oldAttempt.id },
    })
    expect(oldAfter).toBeNull()
    await expect(
      prisma.escapeRoomAttempt.findUnique({
        where: { id: recentlyCompletedLongRunningAttempt.id },
      })
    ).resolves.not.toBeNull()
  })

  it('is idempotent and does not count PracticeQuiz submissions twice', async () => {
    const quiz = await seedEscapeRoomQuiz(1)
    const instance = quiz.stacks[0]!.elements[0]!
    const participant = await seedParticipant('prune-idempotent')
    await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )
    await respondToElementStack(
      {
        stackId: quiz.stacks[0]!.id,
        courseId,
        responses: [scResponse(instance.id, 0)],
        stackAnswerTime: 12,
      },
      participantCtx(participant.id)
    )
    const before = await prisma.instanceStatistics.findUniqueOrThrow({
      where: { elementInstanceId: instance.id },
    })
    const logger = { info: vi.fn(), error: vi.fn() }

    await expect(handlePruneEscapeRooms({ prisma }, { logger })).resolves.toBe(
      true
    )
    await expect(handlePruneEscapeRooms({ prisma }, { logger })).resolves.toBe(
      true
    )

    const after = await prisma.instanceStatistics.findUniqueOrThrow({
      where: { elementInstanceId: instance.id },
    })
    expect(after).toEqual(before)
    const attempt = await prisma.escapeRoomAttempt.findUniqueOrThrow({
      where: {
        participantId_practiceQuizId: {
          participantId: participant.id,
          practiceQuizId: quiz.id,
        },
      },
    })
    expect(attempt.statsAggregatedAt).not.toBeNull()
  })

  it('leaves the marker untouched on transaction failure and retries safely', async () => {
    const attempt = await prisma.escapeRoomAttempt.create({
      data: {
        timeLimit: 60,
        status: DB.EscapeRoomStatus.COMPLETED,
        completedAt: new Date(),
      },
    })
    createdStandaloneAttemptIds.push(attempt.id)
    const logger = { info: vi.fn(), error: vi.fn() }
    const failingTransaction = vi.fn().mockRejectedValue(new Error('fail'))
    const failingPrisma = new Proxy(prisma, {
      get(target, property, receiver) {
        return property === '$transaction'
          ? failingTransaction
          : Reflect.get(target, property, receiver)
      },
    })

    await expect(
      handlePruneEscapeRooms({ prisma: failingPrisma }, { logger })
    ).resolves.toBe(false)
    expect(failingTransaction).toHaveBeenCalledOnce()
    expect(
      (
        await prisma.escapeRoomAttempt.findUniqueOrThrow({
          where: { id: attempt.id },
        })
      ).statsAggregatedAt
    ).toBeNull()

    await expect(handlePruneEscapeRooms({ prisma }, { logger })).resolves.toBe(
      true
    )
    expect(
      (
        await prisma.escapeRoomAttempt.findUniqueOrThrow({
          where: { id: attempt.id },
        })
      ).statsAggregatedAt
    ).not.toBeNull()
  })
})
// #endregion

// ! Lecturer progress dashboard query
// #region
describe('getEscapeRoomProgress - lecturer progress aggregation', () => {
  it('expires an elapsed attempt when the lecturer reads progress', async () => {
    const quiz = await seedEscapeRoomQuiz(1, { timeLimit: 1 })
    const participant = await seedParticipant('progress-passive-expiry')
    const attempt = await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )
    await prisma.escapeRoomAttempt.update({
      where: { id: attempt.id },
      data: { startedAt: new Date(Date.now() - 10_000) },
    })

    const progress = await getEscapeRoomProgress(
      { practiceQuizId: quiz.id },
      lecturerCtx
    )

    expect(
      progress?.attempts.find((entry) => entry.id === attempt.id)?.status
    ).toBe(DB.EscapeRoomStatus.EXPIRED)
    expect(
      (
        await prisma.escapeRoomAttempt.findUniqueOrThrow({
          where: { id: attempt.id },
        })
      ).status
    ).toBe(DB.EscapeRoomStatus.EXPIRED)
  })

  it('reports a concurrent completion instead of stale passive expiry', async () => {
    const quiz = await seedEscapeRoomQuiz(1, { timeLimit: 1 })
    const participant = await seedParticipant('progress-expiry-race')
    const attempt = await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )
    await prisma.escapeRoomAttempt.update({
      where: { id: attempt.id },
      data: { startedAt: new Date(Date.now() - 10_000) },
    })

    const escapeRoomAttempt = new Proxy(prisma.escapeRoomAttempt, {
      get(target, property, receiver) {
        if (property !== 'updateMany') {
          return Reflect.get(target, property, receiver)
        }

        return async () => {
          await prisma.escapeRoomAttempt.update({
            where: { id: attempt.id },
            data: {
              status: DB.EscapeRoomStatus.COMPLETED,
              completedAt: new Date(),
            },
          })
          return { count: 0 }
        }
      },
    })
    const concurrentPrisma = new Proxy(prisma, {
      get(target, property, receiver) {
        return property === 'escapeRoomAttempt'
          ? escapeRoomAttempt
          : Reflect.get(target, property, receiver)
      },
    })

    const progress = await getEscapeRoomProgress(
      { practiceQuizId: quiz.id },
      { ...lecturerCtx, prisma: concurrentPrisma }
    )

    expect(
      progress?.attempts.find((entry) => entry.id === attempt.id)?.status
    ).toBe(DB.EscapeRoomStatus.COMPLETED)
    expect(
      (
        await prisma.escapeRoomAttempt.findUniqueOrThrow({
          where: { id: attempt.id },
        })
      ).status
    ).toBe(DB.EscapeRoomStatus.COMPLETED)
  })

  it('reports per-participant cleared stacks, total stacks and attempt metadata', async () => {
    const quiz = await seedEscapeRoomQuiz(2, { timeLimit: 1800 })
    const stack0 = quiz.stacks[0]!
    const participant = await seedParticipant('progress')
    const notStartedParticipant = await seedParticipant('progress-not-started')
    const outsideParticipant = await prisma.participant.create({
      data: {
        username: `${TEST_PREFIX}-progress-outside`,
        password: TEST_PREFIX,
      },
    })
    createdParticipantIds.push(outsideParticipant.id)
    const inactiveParticipant = await prisma.participant.create({
      data: {
        username: `${TEST_PREFIX}-progress-inactive`,
        password: TEST_PREFIX,
        participations: { create: [{ courseId, isActive: false }] },
      },
    })
    createdParticipantIds.push(inactiveParticipant.id)
    const attempt = await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )

    // clear only the first of two stacks
    await respondToElementStack(
      {
        stackId: stack0.id,
        courseId,
        responses: [scResponse(stack0.elements[0]!.id, 0)],
        stackAnswerTime: 10,
      },
      participantCtx(participant.id)
    )
    await prisma.escapeRoomAttempt.update({
      where: { id: attempt.id },
      data: { lockoutUntil: new Date(Date.now() + 60_000) },
    })

    const progress = await getEscapeRoomProgress(
      { practiceQuizId: quiz.id },
      lecturerCtx
    )

    expect(progress).not.toBeNull()
    expect(progress!.totalStacks).toBe(2)
    expect(progress!.timeLimit).toBe(1800)
    const entry = progress!.attempts.find(
      (attempt) => attempt.participantId === participant.id
    )!
    expect(entry.participantId).toBe(participant.id)
    expect(entry.displayName).toBe(`${TEST_PREFIX}-progress`)
    expect(entry.status).toBe(DB.EscapeRoomStatus.IN_PROGRESS)
    expect(entry.clearedStacks).toBe(1)
    expect(entry.hintsUsedCount).toBe(0)
    expect(entry.penaltySeconds).toBe(0)
    expect(entry.lockoutUntil).not.toBeNull()
    expect(entry.completedAt).toBeNull()
    expect(entry.timeSpentSeconds).toBeNull()

    await prisma.escapeRoomAttempt.update({
      where: { id: attempt.id },
      data: { lockoutUntil: new Date(Date.now() - 1_000) },
    })
    const refreshedProgress = await getEscapeRoomProgress(
      { practiceQuizId: quiz.id },
      lecturerCtx
    )
    expect(
      refreshedProgress!.attempts.find(
        (refreshedAttempt) => refreshedAttempt.participantId === participant.id
      )!.lockoutUntil
    ).toBeNull()

    const notStarted = progress!.attempts.find(
      (attempt) => attempt.participantId === notStartedParticipant.id
    )!
    expect(notStarted).toMatchObject({
      id: null,
      status: 'NOT_STARTED',
      clearedStacks: 0,
      hintsUsedCount: 0,
      penaltySeconds: 0,
      startedAt: null,
    })
    // participants not enrolled in the course are never listed
    expect(
      progress!.attempts.some(
        (attempt) => attempt.participantId === outsideParticipant.id
      )
    ).toBe(false)
    // enrolled-but-inactive participants (not on the leaderboard) still appear
    // as NOT_STARTED: enrollment drives the progress roster, not leaderboard
    // membership (isActive)
    expect(
      progress!.attempts.some(
        (attempt) => attempt.participantId === inactiveParticipant.id
      )
    ).toBe(true)
    const inactiveEntry = progress!.attempts.find(
      (attempt) => attempt.participantId === inactiveParticipant.id
    )!
    expect(inactiveEntry).toMatchObject({
      id: null,
      status: 'NOT_STARTED',
    })
  })

  it('returns null for a non-existent / non-escape-room activity', async () => {
    // valid UUID format that does not correspond to any escape-room config
    const progress = await getEscapeRoomProgress(
      { practiceQuizId: '00000000-0000-0000-0000-000000000000' },
      lecturerCtx
    )
    expect(progress).toBeNull()
  })
})
// #endregion
