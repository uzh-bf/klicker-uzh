import * as DB from '@klicker-uzh/prisma/client'
import { StackFeedbackStatus, isEscapeRoomExpired } from '@klicker-uzh/types'
import type { GraphQLObjectType } from 'graphql'
import { describe, expect, it, vi } from 'vitest'
import {
  QR_SCAN_CODE,
  TEST_PREFIX,
  courseId,
  createCtx,
  createUserCtx,
  createdQuizIds,
  createdUserIds,
  getEscapeRoomExpiresInSeconds,
  getEscapeRoomRemainingSeconds,
  lecturerCtx,
  participantCtx,
  prisma,
  qrElement,
  qrResponse,
  respondToElementStack,
  scElement,
  scResponse,
  schema,
  seedEscapeRoomMicroLearning,
  seedEscapeRoomPracticeQuiz,
  seedEscapeRoomQuiz,
  seedParticipant,
  startEscapeRoomAttempt,
} from './escapeRoomTestHarness.js'

// ! B1: escape room integrity guard in respondToElementStack
// #region
describe('respondToElementStack - escape room integrity guard (B1)', () => {
  it('derives stack correctness from preloaded participant responses', async () => {
    const findMany = vi.fn()
    const stackType = schema.getType('ElementStack') as GraphQLObjectType
    const resolver = stackType.getFields().isCorrect!.resolve!

    const result = await resolver(
      {
        id: 1,
        elements: [
          {
            id: 11,
            responses: [
              {
                lastResponseCorrectness: DB.ResponseCorrectness.CORRECT,
              },
            ],
          },
        ],
      },
      {},
      {
        ...participantCtx('preloaded-participant'),
        prisma: { elementInstance: { findMany } },
      },
      {} as any
    )

    expect(result).toBe(true)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('rejects an anonymous caller that spoofs owner preview authority, and persists no response', async () => {
    const quiz = await seedEscapeRoomQuiz(1)
    const stack = quiz.stacks[0]!
    const instance = stack.elements[0]!
    const anonCtx = createCtx(undefined)

    await expect(
      respondToElementStack(
        {
          stackId: stack.id,
          courseId,
          responses: [scResponse(instance.id, 0)],
          stackAnswerTime: 10,
          // @ts-expect-error preview authority is no longer a public input
          isOwner: true,
        },
        anonCtx
      )
    ).rejects.toThrow(
      'Escape room activities can only be answered by an enrolled participant with an active attempt'
    )

    const responses = await prisma.questionResponse.findMany({
      where: { elementInstanceId: instance.id },
    })
    expect(responses).toHaveLength(0)
  })

  it('rejects a participant that spoofs owner preview authority', async () => {
    const participant = await seedParticipant('preview-spoof')
    const quiz = await seedEscapeRoomQuiz(1)
    const stack = quiz.stacks[0]!
    const instance = stack.elements[0]!

    await expect(
      respondToElementStack(
        {
          stackId: stack.id,
          courseId,
          responses: [scResponse(instance.id, 0)],
          stackAnswerTime: 10,
          // @ts-expect-error preview authority is no longer a public input
          isOwner: true,
        },
        participantCtx(participant.id)
      )
    ).rejects.toThrow('No active escape room attempt found')

    const responses = await prisma.questionResponse.findMany({
      where: { elementInstanceId: instance.id },
    })
    expect(responses).toHaveLength(0)
  })

  it('derives owner preview authority from the authenticated lecturer', async () => {
    const quiz = await seedEscapeRoomQuiz(1)
    const stack = quiz.stacks[0]!
    const instance = stack.elements[0]!

    const result = await respondToElementStack(
      {
        stackId: stack.id,
        courseId,
        responses: [scResponse(instance.id, 0)],
        stackAnswerTime: 10,
      },
      lecturerCtx
    )

    expect(result).not.toBeNull()
    expect(result!.id).toBe(stack.id)
    expect(result!.status).toBe(StackFeedbackStatus.CORRECT)
  })

  it('rejects an authenticated lecturer without owner permission', async () => {
    const quiz = await seedEscapeRoomQuiz(1)
    const stack = quiz.stacks[0]!
    const instance = stack.elements[0]!
    const lecturer = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}-unauthorized@example.com`,
        shortname: `${TEST_PREFIX}-unauthorized`,
        role: DB.UserRole.USER,
      },
    })
    createdUserIds.push(lecturer.id)

    await expect(
      respondToElementStack(
        {
          stackId: stack.id,
          courseId,
          responses: [scResponse(instance.id, 0)],
          stackAnswerTime: 10,
        },
        createUserCtx(lecturer.id)
      )
    ).rejects.toThrow(
      'Escape room activities can only be answered by an enrolled participant with an active attempt'
    )

    const responses = await prisma.questionResponse.findMany({
      where: { elementInstanceId: instance.id },
    })
    expect(responses).toHaveLength(0)
  })

  it('serializes concurrent submissions for one active attempt', async () => {
    const quiz = await seedEscapeRoomQuiz(1, { lockoutSeconds: 0 })
    const stack = quiz.stacks[0]!
    const instance = stack.elements[0]!
    const participant = await seedParticipant('concurrent-submissions')
    const context = participantCtx(participant.id)

    await startEscapeRoomAttempt({ practiceQuizId: quiz.id }, context)

    const submissions = await Promise.allSettled([
      respondToElementStack(
        {
          stackId: stack.id,
          courseId,
          responses: [scResponse(instance.id, 0)],
          stackAnswerTime: 10,
        },
        context
      ),
      respondToElementStack(
        {
          stackId: stack.id,
          courseId,
          responses: [scResponse(instance.id, 1)],
          stackAnswerTime: 10,
        },
        context
      ),
    ])

    const fulfilled = submissions.filter(
      (
        result
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof respondToElementStack>>
      > => result.status === 'fulfilled'
    )
    const rejected = submissions.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]!.reason).toMatchObject({
      extensions: { code: 'ESCAPE_ROOM_RESPONSE_PROCESSING' },
    })

    const responses = await prisma.questionResponse.findMany({
      where: {
        participantId: participant.id,
        elementInstanceId: instance.id,
      },
    })
    expect(responses).toHaveLength(1)
    expect(fulfilled[0]!.value?.status).toBe(
      responses[0]!.lastResponseCorrectness === DB.ResponseCorrectness.CORRECT
        ? StackFeedbackStatus.CORRECT
        : StackFeedbackStatus.INCORRECT
    )
  })

  it('rechecks lockout after claiming and releases the claim on rejection', async () => {
    const quiz = await seedEscapeRoomQuiz(1, { lockoutSeconds: 0 })
    const stack = quiz.stacks[0]!
    const instance = stack.elements[0]!
    const participant = await seedParticipant('post-claim-lockout')
    const participantContext = participantCtx(participant.id)
    const attempt = await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantContext
    )
    vi.mocked(participantContext.redisExec.eval).mockClear()
    let attemptReadCount = 0
    const findUnique = vi.fn(
      (args: DB.Prisma.EscapeRoomAttemptFindUniqueArgs) => {
        attemptReadCount += 1
        if (attemptReadCount === 1) return Promise.resolve(attempt)
        if (attemptReadCount === 2) {
          return Promise.resolve({
            ...attempt,
            lockoutUntil: new Date(Date.now() + 60_000),
          })
        }
        return prisma.escapeRoomAttempt.findUnique(args)
      }
    )
    const escapeRoomAttempt = new Proxy(prisma.escapeRoomAttempt, {
      get(target, property, receiver) {
        if (property === 'findUnique') return findUnique
        return Reflect.get(target, property, receiver)
      },
    })
    const context = {
      ...participantContext,
      prisma: new Proxy(prisma, {
        get(target, property, receiver) {
          if (property === 'escapeRoomAttempt') return escapeRoomAttempt
          return Reflect.get(target, property, receiver)
        },
      }),
    }

    await expect(
      respondToElementStack(
        {
          stackId: stack.id,
          courseId,
          responses: [scResponse(instance.id, 0)],
          stackAnswerTime: 10,
        },
        context
      )
    ).rejects.toMatchObject({
      extensions: { code: 'ESCAPE_ROOM_LOCKOUT' },
    })

    expect(context.redisExec.eval).toHaveBeenCalledOnce()
    expect(
      await prisma.questionResponse.count({
        where: {
          participantId: participant.id,
          elementInstanceId: instance.id,
        },
      })
    ).toBe(0)

    await expect(
      respondToElementStack(
        {
          stackId: stack.id,
          courseId,
          responses: [scResponse(instance.id, 0)],
          stackAnswerTime: 10,
        },
        context
      )
    ).resolves.toMatchObject({ status: StackFeedbackStatus.CORRECT })
  })
})
// #endregion

describe('respondToElementStack - QR scan grading', () => {
  async function seedQrQuiz() {
    const quiz = await seedEscapeRoomPracticeQuiz(
      {
        elements: [qrElement],
        courseId,
        status: DB.PublicationStatus.PUBLISHED,
        lockoutSeconds: 0,
      },
      lecturerCtx
    )
    createdQuizIds.push(quiz.id)
    return quiz
  }

  it('grades an exact code as correct and a decoy as incorrect', async () => {
    const correctQuiz = await seedQrQuiz()
    const correctParticipant = await seedParticipant('qr-correct')
    await startEscapeRoomAttempt(
      { practiceQuizId: correctQuiz.id },
      participantCtx(correctParticipant.id)
    )
    const correctInstance = correctQuiz.stacks[0]!.elements[0]!
    const correct = await respondToElementStack(
      {
        stackId: correctQuiz.stacks[0]!.id,
        courseId,
        responses: [qrResponse(correctInstance.id, QR_SCAN_CODE)],
        stackAnswerTime: 10,
      },
      participantCtx(correctParticipant.id)
    )
    expect(correct!.status).toBe(StackFeedbackStatus.CORRECT)

    const decoyQuiz = await seedQrQuiz()
    const decoyParticipant = await seedParticipant('qr-decoy')
    await startEscapeRoomAttempt(
      { practiceQuizId: decoyQuiz.id },
      participantCtx(decoyParticipant.id)
    )
    const decoyInstance = decoyQuiz.stacks[0]!.elements[0]!
    const decoy = await respondToElementStack(
      {
        stackId: decoyQuiz.stacks[0]!.id,
        courseId,
        responses: [qrResponse(decoyInstance.id, 'ZbCdEf12_-34')],
        stackAnswerTime: 10,
      },
      participantCtx(decoyParticipant.id)
    )
    expect(decoy!.status).toBe(StackFeedbackStatus.INCORRECT)
  })

  it('rejects malformed codes and replays after completion', async () => {
    const quiz = await seedQrQuiz()
    const participant = await seedParticipant('qr-replay')
    await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )
    const stack = quiz.stacks[0]!
    const instance = stack.elements[0]!

    await expect(
      respondToElementStack(
        {
          stackId: stack.id,
          courseId,
          responses: [qrResponse(instance.id, 'not-a-code')],
          stackAnswerTime: 10,
        },
        participantCtx(participant.id)
      )
    ).rejects.toThrow('Invalid QR scan response')

    await respondToElementStack(
      {
        stackId: stack.id,
        courseId,
        responses: [qrResponse(instance.id, QR_SCAN_CODE)],
        stackAnswerTime: 10,
      },
      participantCtx(participant.id)
    )
    await expect(
      respondToElementStack(
        {
          stackId: stack.id,
          courseId,
          responses: [qrResponse(instance.id, QR_SCAN_CODE)],
          stackAnswerTime: 10,
        },
        participantCtx(participant.id)
      )
    ).rejects.toThrow('No active escape room attempt found')
  })

  it('binds QR responses to the authorized stack and activity', async () => {
    const quiz = await seedEscapeRoomPracticeQuiz(
      {
        elements: [qrElement, qrElement],
        courseId,
        status: DB.PublicationStatus.PUBLISHED,
      },
      lecturerCtx
    )
    createdQuizIds.push(quiz.id)
    const participant = await seedParticipant('qr-boundary')
    await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )
    const first = quiz.stacks[0]!
    const future = quiz.stacks[1]!.elements[0]!

    await expect(
      respondToElementStack(
        {
          stackId: first.id,
          courseId,
          responses: [qrResponse(future.id, QR_SCAN_CODE)],
          stackAnswerTime: 10,
        },
        participantCtx(participant.id)
      )
    ).rejects.toThrow(
      'Escape room responses must exactly match the authorized stack'
    )

    const otherQuiz = await seedQrQuiz()
    const foreign = otherQuiz.stacks[0]!.elements[0]!
    await expect(
      respondToElementStack(
        {
          stackId: first.id,
          courseId,
          responses: [qrResponse(foreign.id, QR_SCAN_CODE)],
          stackAnswerTime: 10,
        },
        participantCtx(participant.id)
      )
    ).rejects.toThrow(
      'Escape room responses must exactly match the authorized stack'
    )
  })
})

// ! Sequential answer gating
// #region
describe('respondToElementStack - sequential answer gating', () => {
  it('blocks answering a later stack before the preceding stack is answered correctly', async () => {
    const quiz = await seedEscapeRoomQuiz(2)
    const stack1 = quiz.stacks[1]!
    const participant = await seedParticipant('gating-block')
    await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )

    await expect(
      respondToElementStack(
        {
          stackId: stack1.id,
          courseId,
          responses: [scResponse(stack1.elements[0]!.id, 0)],
          stackAnswerTime: 10,
        },
        participantCtx(participant.id)
      )
    ).rejects.toThrow(
      'You must answer all preceding questions correctly before attempting this step'
    )
  })

  it('allows answering the first stack of a fresh attempt', async () => {
    const quiz = await seedEscapeRoomQuiz(2)
    const stack0 = quiz.stacks[0]!
    const participant = await seedParticipant('gating-allow')
    await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )

    const result = await respondToElementStack(
      {
        stackId: stack0.id,
        courseId,
        responses: [scResponse(stack0.elements[0]!.id, 0)],
        stackAnswerTime: 10,
      },
      participantCtx(participant.id)
    )

    expect(result!.status).toBe(StackFeedbackStatus.CORRECT)
  })
})
// #endregion

// ! Lockout after an incorrect answer
// #region
describe('respondToElementStack - lockout after an incorrect answer', () => {
  it('locks out further submissions until lockoutUntil has passed, then allows submission again', async () => {
    const quiz = await seedEscapeRoomQuiz(1, { lockoutSeconds: 300 })
    const stack0 = quiz.stacks[0]!
    const instance = stack0.elements[0]!
    const participant = await seedParticipant('lockout')
    const attempt = await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )

    // a wrong answer sets lockoutUntil in the future
    const wrongResult = await respondToElementStack(
      {
        stackId: stack0.id,
        courseId,
        responses: [scResponse(instance.id, 1)],
        stackAnswerTime: 10,
      },
      participantCtx(participant.id)
    )
    expect(wrongResult!.status).toBe(StackFeedbackStatus.INCORRECT)

    const lockedAttempt = await prisma.escapeRoomAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    })
    expect(lockedAttempt.lockoutUntil).not.toBeNull()
    expect(new Date(lockedAttempt.lockoutUntil!).getTime()).toBeGreaterThan(
      Date.now()
    )

    // submitting again while still locked out is rejected
    await expect(
      respondToElementStack(
        {
          stackId: stack0.id,
          courseId,
          responses: [scResponse(instance.id, 0)],
          stackAnswerTime: 10,
        },
        participantCtx(participant.id)
      )
    ).rejects.toThrow(
      'You are locked out from submitting answers due to a recent incorrect attempt'
    )

    // simulate the lockout period having passed
    await prisma.escapeRoomAttempt.update({
      where: { id: lockedAttempt.id },
      data: { lockoutUntil: new Date(Date.now() - 1000) },
    })

    const allowedResult = await respondToElementStack(
      {
        stackId: stack0.id,
        courseId,
        responses: [scResponse(instance.id, 0)],
        stackAnswerTime: 10,
      },
      participantCtx(participant.id)
    )
    expect(allowedResult!.status).toBe(StackFeedbackStatus.CORRECT)
  })

  it('allows a microlearning escape room retry instead of silently ignoring the resubmission', async () => {
    const microLearning = await seedEscapeRoomMicroLearning(
      { elements: [scElement], courseId, lockoutSeconds: 300 },
      lecturerCtx
    )
    const stack0 = microLearning.stacks[0]!
    const instance = stack0.elements[0]!
    const participant = await seedParticipant('micro-lockout')
    const attempt = await startEscapeRoomAttempt(
      { microLearningId: microLearning.id },
      participantCtx(participant.id)
    )

    // the wrong answer grades INCORRECT and sets the lockout; the
    // microlearning single-submission rule must not swallow it
    const wrongResult = await respondToElementStack(
      {
        stackId: stack0.id,
        courseId,
        responses: [scResponse(instance.id, 1)],
        stackAnswerTime: 10,
      },
      participantCtx(participant.id)
    )
    expect(wrongResult!.status).toBe(StackFeedbackStatus.INCORRECT)

    // resubmitting during the lockout window surfaces the lockout error
    // instead of the single-submission null
    await expect(
      respondToElementStack(
        {
          stackId: stack0.id,
          courseId,
          responses: [scResponse(instance.id, 0)],
          stackAnswerTime: 10,
        },
        participantCtx(participant.id)
      )
    ).rejects.toThrow(
      'You are locked out from submitting answers due to a recent incorrect attempt'
    )

    // after the lockout passes, the retry grades and completes the stage
    await prisma.escapeRoomAttempt.update({
      where: { id: attempt.id },
      data: { lockoutUntil: new Date(Date.now() - 1000) },
    })
    const retryResult = await respondToElementStack(
      {
        stackId: stack0.id,
        courseId,
        responses: [scResponse(instance.id, 0)],
        stackAnswerTime: 10,
      },
      participantCtx(participant.id)
    )
    expect(retryResult!.status).toBe(StackFeedbackStatus.CORRECT)
  })
})
// #endregion

// ! Attempt expiry
// #region
describe('respondToElementStack - attempt expiry', () => {
  it('marks the attempt EXPIRED and rejects the submission once the time limit (plus grace) has elapsed', async () => {
    const quiz = await seedEscapeRoomQuiz(1, { timeLimit: 60 })
    const stack0 = quiz.stacks[0]!
    const instance = stack0.elements[0]!
    const participant = await seedParticipant('expiry')
    const attempt = await startEscapeRoomAttempt(
      { practiceQuizId: quiz.id },
      participantCtx(participant.id)
    )

    // back-date startedAt so elapsed (120s) > timeLimit (60s) + 5s grace
    await prisma.escapeRoomAttempt.update({
      where: { id: attempt.id },
      data: { startedAt: new Date(Date.now() - 120 * 1000) },
    })

    await expect(
      respondToElementStack(
        {
          stackId: stack0.id,
          courseId,
          responses: [scResponse(instance.id, 0)],
          stackAnswerTime: 10,
        },
        participantCtx(participant.id)
      )
    ).rejects.toMatchObject({
      message: 'Escape room time has expired',
      extensions: { code: 'ESCAPE_ROOM_EXPIRED' },
    })

    const expiredAttempt = await prisma.escapeRoomAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    })
    expect(expiredAttempt.status).toBe(DB.EscapeRoomStatus.EXPIRED)
  })
})
// #endregion

describe('server-authoritative remaining time', () => {
  it('calculates from server time, including penalties and boundary clamping', () => {
    const serverNow = Date.parse('2026-07-11T12:00:00.000Z')
    const attempt = {
      startedAt: new Date(serverNow - 10_250),
      timeLimit: 60,
      penaltySeconds: 5,
    }

    expect(getEscapeRoomRemainingSeconds(attempt, serverNow)).toBe(45)
    expect(getEscapeRoomExpiresInSeconds(attempt, serverNow)).toBe(50)
    expect(getEscapeRoomRemainingSeconds(attempt, serverNow + 44_749)).toBe(1)
    expect(getEscapeRoomRemainingSeconds(attempt, serverNow + 60_000)).toBe(0)
    expect(getEscapeRoomExpiresInSeconds(attempt, serverNow + 49_749)).toBe(1)
    expect(getEscapeRoomExpiresInSeconds(attempt, serverNow + 50_000)).toBe(0)
    expect(isEscapeRoomExpired(attempt, serverNow + 49_750)).toBe(false)
    expect(isEscapeRoomExpired(attempt, serverNow + 49_751)).toBe(true)
  })
})
