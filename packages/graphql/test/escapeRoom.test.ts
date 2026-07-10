import { prisma as prismaClient } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import { StackFeedbackStatus } from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Context, ContextWithUser } from '../src/lib/context.js'
import {
  resetEscapeRoomAttempt,
  startEscapeRoomAttempt,
} from '../src/services/practiceQuizzes.js'
import { handlePruneEscapeRooms } from '../src/services/pruneEscapeRooms.js'
import { respondToElementStack } from '../src/services/stacks.js'
import { seedCourse, seedEscapeRoomPracticeQuiz } from './helpers.js'

const TEST_PREFIX = `escape-${Date.now()}`

let prisma: PrismaClient
let lecturerCtx: ContextWithUser
let courseId: string
let scElement: DB.Element

// every record created below is tracked here and deleted by id (in FK order)
// in the final afterAll - the shared helpers (seedCourse / seedEscapeRoomPracticeQuiz)
// generate uuidv4() names rather than TEST_PREFIX-based ones, so id-tracking is used
// instead of prefix-scanning for those records
const createdUserIds: string[] = []
const createdParticipantIds: string[] = []
const createdQuizIds: string[] = []
const createdElementIds: number[] = []
const createdStandaloneAttemptIds: string[] = []
let createdCourseId: string | undefined

function createCtx(user?: Context['user']): Context {
  return {
    prisma: prisma as any,
    req: { locals: {} } as any,
    res: { cookie: vi.fn() } as any,
    redisExec: {} as any,
    redisAssessmentExec: {} as any,
    pubSub: {} as any,
    emitter: new EventEmitter(),
    hatchet: {} as any,
    tasks: {} as any,
    user,
  } as Context
}

function createUserCtx(
  sub: string,
  role: DB.UserRole = DB.UserRole.USER
): ContextWithUser {
  return createCtx({
    sub,
    role,
    scope: DB.UserLoginScope.ACCOUNT_OWNER,
    catalystInstitutional: false,
    catalystIndividual: false,
  }) as ContextWithUser
}

function participantCtx(participantId: string): ContextWithUser {
  return createUserCtx(participantId, DB.UserRole.PARTICIPANT)
}

// ix 0 is the correct choice on `scElement` (see beforeAll) - selectedIx 0
// yields a CORRECT response, any other value yields INCORRECT
function scResponse(instanceId: number, selectedIx: 0 | 1) {
  return {
    instanceId,
    type: DB.ElementType.SC,
    choicesResponse: [
      { ix: 0, selected: selectedIx === 0 },
      { ix: 1, selected: selectedIx === 1 },
    ],
  }
}

async function seedEscapeRoomQuiz(
  numStacks: number,
  opts?: { timeLimit?: number; lockoutSeconds?: number }
) {
  const quiz = await seedEscapeRoomPracticeQuiz(
    {
      elements: Array.from({ length: numStacks }, () => scElement),
      courseId,
      status: DB.PublicationStatus.PUBLISHED,
      timeLimit: opts?.timeLimit,
      lockoutSeconds: opts?.lockoutSeconds,
    },
    lecturerCtx
  )
  createdQuizIds.push(quiz.id)
  return quiz
}

async function seedParticipant(label: string) {
  const participant = await prisma.participant.create({
    data: {
      username: `${TEST_PREFIX}-${label}`,
      password: 'test-password',
      participations: { create: [{ courseId }] },
    },
  })
  createdParticipantIds.push(participant.id)
  return participant
}

async function cleanupTestData() {
  if (createdQuizIds.length > 0) {
    await prisma.escapeRoomAttempt.deleteMany({
      where: { practiceQuizId: { in: createdQuizIds } },
    })
    await prisma.escapeRoomConfig.deleteMany({
      where: { practiceQuizId: { in: createdQuizIds } },
    })
    await prisma.questionResponse.deleteMany({
      where: { practiceQuizId: { in: createdQuizIds } },
    })
    await prisma.elementInstance.deleteMany({
      where: { elementStack: { practiceQuizId: { in: createdQuizIds } } },
    })
    await prisma.elementStack.deleteMany({
      where: { practiceQuizId: { in: createdQuizIds } },
    })
    await prisma.practiceQuiz.deleteMany({
      where: { id: { in: createdQuizIds } },
    })
  }

  if (createdStandaloneAttemptIds.length > 0) {
    await prisma.escapeRoomAttempt.deleteMany({
      where: { id: { in: createdStandaloneAttemptIds } },
    })
  }

  if (createdParticipantIds.length > 0) {
    await prisma.participation.deleteMany({
      where: { participantId: { in: createdParticipantIds } },
    })
    await prisma.participant.deleteMany({
      where: { id: { in: createdParticipantIds } },
    })
  }

  if (createdElementIds.length > 0) {
    await prisma.element.deleteMany({
      where: { id: { in: createdElementIds } },
    })
  }

  if (createdCourseId) {
    await prisma.course.deleteMany({ where: { id: createdCourseId } })
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  }
}

describe('Escape room integration tests', () => {
  beforeAll(async () => {
    prisma = prismaClient
    await prisma.$connect()

    const lecturer = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}-lecturer@example.com`,
        shortname: `${TEST_PREFIX}-lecturer`,
        role: DB.UserRole.USER,
      },
    })
    createdUserIds.push(lecturer.id)
    lecturerCtx = createUserCtx(lecturer.id, DB.UserRole.USER)

    const course = await seedCourse({}, lecturerCtx)
    courseId = course.id
    createdCourseId = course.id

    scElement = await prisma.element.create({
      data: {
        type: DB.ElementType.SC,
        name: `${TEST_PREFIX}-sc-element`,
        content: 'Escape room SC content',
        explanation: 'Escape room SC explanation',
        options: {
          hasSampleSolution: true,
          hasAnswerFeedbacks: true,
          displayMode: 'LIST',
          choices: [
            { ix: 0, value: 'Correct', correct: true, feedback: '' },
            { ix: 1, value: 'Wrong', correct: false, feedback: '' },
          ],
        },
        ownerId: lecturer.id,
      },
    })
    createdElementIds.push(scElement.id)
  }, 60000)

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  }, 60000)

  // ! B1: escape room integrity guard in respondToElementStack
  // #region
  describe('respondToElementStack - escape room integrity guard (B1)', () => {
    it('rejects a non-owner caller that is not an authenticated participant, and persists no response', async () => {
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

    it('allows the owner (isOwner: true) to bypass the guard for a preview submission', async () => {
      const quiz = await seedEscapeRoomQuiz(1)
      const stack = quiz.stacks[0]!
      const instance = stack.elements[0]!
      const anonCtx = createCtx(undefined)

      const result = await respondToElementStack(
        {
          stackId: stack.id,
          courseId,
          responses: [scResponse(instance.id, 0)],
          stackAnswerTime: 10,
          isOwner: true,
        },
        anonCtx
      )

      expect(result).not.toBeNull()
      expect(result!.id).toBe(stack.id)
      expect(result!.status).toBe(StackFeedbackStatus.CORRECT)
    })
  })
  // #endregion

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
      ).rejects.toThrow('Escape room time has expired')

      const expiredAttempt = await prisma.escapeRoomAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      })
      expect(expiredAttempt.status).toBe(DB.EscapeRoomStatus.EXPIRED)
    })
  })
  // #endregion

  // ! B2: lecturer-only reset
  // #region
  describe('resetEscapeRoomAttempt - lecturer-only reset (B2)', () => {
    it('allows the owning lecturer (with write access) to reset a participant attempt, deleting it', async () => {
      const quiz = await seedEscapeRoomQuiz(1)
      await recomputeDerivedPermissions(
        { practiceQuizId: quiz.id, userId: lecturerCtx.user.sub },
        prisma
      )
      const participant = await seedParticipant('reset-owner')
      await startEscapeRoomAttempt(
        { practiceQuizId: quiz.id },
        participantCtx(participant.id)
      )

      const result = await resetEscapeRoomAttempt(
        { practiceQuizId: quiz.id, participantId: participant.id },
        lecturerCtx
      )
      expect(result).toBe(true)

      const attemptAfter = await prisma.escapeRoomAttempt.findUnique({
        where: {
          participantId_practiceQuizId: {
            participantId: participant.id,
            practiceQuizId: quiz.id,
          },
        },
      })
      expect(attemptAfter).toBeNull()
    })

    it('rejects a participant caller with the lecturer-only error', async () => {
      const quiz = await seedEscapeRoomQuiz(1)
      const participant = await seedParticipant('reset-participant')
      await startEscapeRoomAttempt(
        { practiceQuizId: quiz.id },
        participantCtx(participant.id)
      )

      await expect(
        resetEscapeRoomAttempt(
          { practiceQuizId: quiz.id, participantId: participant.id },
          participantCtx(participant.id)
        )
      ).rejects.toThrow('Only lecturers can reset escape room attempts')
    })

    it('rejects a lecturer without write access to the quiz', async () => {
      const quiz = await seedEscapeRoomQuiz(1)
      const participant = await seedParticipant('reset-no-access')
      await startEscapeRoomAttempt(
        { practiceQuizId: quiz.id },
        participantCtx(participant.id)
      )

      const otherLecturer = await prisma.user.create({
        data: {
          email: `${TEST_PREFIX}-other-lecturer@example.com`,
          shortname: `${TEST_PREFIX}-other-lecturer`,
          role: DB.UserRole.USER,
        },
      })
      createdUserIds.push(otherLecturer.id)
      const otherLecturerCtx = createUserCtx(otherLecturer.id, DB.UserRole.USER)

      await expect(
        resetEscapeRoomAttempt(
          { practiceQuizId: quiz.id, participantId: participant.id },
          otherLecturerCtx
        )
      ).rejects.toThrow('You do not have write access to this activity')
    })
  })
  // #endregion

  // ! Escape room completion
  // #region
  describe('respondToElementStack - escape room completion', () => {
    it('completes the attempt exactly once when the last remaining stack is answered correctly', async () => {
      const quiz = await seedEscapeRoomQuiz(2)
      const stack0 = quiz.stacks[0]!
      const stack1 = quiz.stacks[1]!
      const participant = await seedParticipant('completion')
      await startEscapeRoomAttempt(
        { practiceQuizId: quiz.id },
        participantCtx(participant.id)
      )

      // answer stack 0 correctly first (required by sequential gating)
      await respondToElementStack(
        {
          stackId: stack0.id,
          courseId,
          responses: [scResponse(stack0.elements[0]!.id, 0)],
          stackAnswerTime: 10,
        },
        participantCtx(participant.id)
      )

      // answer stack 1 (the last remaining stack) correctly -> completes the attempt
      const result = await respondToElementStack(
        {
          stackId: stack1.id,
          courseId,
          responses: [scResponse(stack1.elements[0]!.id, 0)],
          stackAnswerTime: 10,
        },
        participantCtx(participant.id)
      )
      expect(result!.status).toBe(StackFeedbackStatus.CORRECT)

      const attemptWhere = {
        participantId_practiceQuizId: {
          participantId: participant.id,
          practiceQuizId: quiz.id,
        },
      }
      const completedAttempt = await prisma.escapeRoomAttempt.findUniqueOrThrow(
        {
          where: attemptWhere,
        }
      )
      expect(completedAttempt.status).toBe(DB.EscapeRoomStatus.COMPLETED)
      expect(completedAttempt.completedAt).not.toBeNull()

      // A second correct submit to the (now completed) last stack does not
      // silently re-run the completion update. The attempt is no longer
      // IN_PROGRESS, so respondToElementStack rejects it via the same guard
      // that normally requires an active attempt for a participant - this
      // proves the completion update above fired exactly once, since
      // completedAt is unchanged afterwards.
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
      ).rejects.toThrow('No active escape room attempt found for this activity')

      const attemptAfterSecondSubmit =
        await prisma.escapeRoomAttempt.findUniqueOrThrow({
          where: attemptWhere,
        })
      expect(attemptAfterSecondSubmit.completedAt?.getTime()).toBe(
        completedAttempt.completedAt?.getTime()
      )
    })
  })
  // #endregion

  // ! B4: prune retention window
  // #region
  describe('handlePruneEscapeRooms - retention window (B4)', () => {
    it('aggregates finished attempts and only deletes ones older than the retention window', async () => {
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
    })
  })
  // #endregion
})
