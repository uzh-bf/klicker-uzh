import { prisma as prismaClient } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import { StackFeedbackStatus } from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Context, ContextWithUser } from '../src/lib/context.js'
import { getEscapeRoomProgress } from '../src/services/escapeRooms.js'
import {
  requestEscapeRoomHint,
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

  // ! requestEscapeRoomHint - time-penalty hints
  // #region
  describe('requestEscapeRoomHint - time-penalty hints', () => {
    // The seed helper does not author per-instance hints, so patch the
    // instance options directly to simulate a lecturer-authored hint.
    async function seedQuizWithHint(hint: string) {
      const quiz = await seedEscapeRoomQuiz(2)
      const instance = quiz.stacks[0]!.elements[0]!
      await prisma.elementInstance.update({
        where: { id: instance.id },
        data: { options: { ...instance.options, escapeRoomHint: hint } },
      })
      return { quiz, instanceId: instance.id }
    }

    it('reveals the hint and charges the penalty once, idempotently', async () => {
      const { quiz, instanceId } = await seedQuizWithHint('look under the mat')
      const participant = await seedParticipant('hint-reveal')
      const attempt = await startEscapeRoomAttempt(
        { practiceQuizId: quiz.id },
        participantCtx(participant.id)
      )
      expect(attempt.penaltySeconds).toBe(0)

      // first request: reveals hint, applies the 30s default penalty
      const first = await requestEscapeRoomHint(
        { practiceQuizId: quiz.id, instanceId },
        participantCtx(participant.id)
      )
      expect(first.hint).toBe('look under the mat')
      expect(first.attempt.penaltySeconds).toBe(30)
      expect(first.attempt.hintsUsed).toEqual([String(instanceId)])

      // second request for the same instance: same hint, no extra penalty
      const second = await requestEscapeRoomHint(
        { practiceQuizId: quiz.id, instanceId },
        participantCtx(participant.id)
      )
      expect(second.hint).toBe('look under the mat')
      expect(second.attempt.penaltySeconds).toBe(30)

      const persisted = await prisma.escapeRoomAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      })
      expect(persisted.penaltySeconds).toBe(30)
    })

    it('rejects a hint request for an element that has no hint', async () => {
      const quiz = await seedEscapeRoomQuiz(2)
      const instanceId = quiz.stacks[0]!.elements[0]!.id
      const participant = await seedParticipant('hint-none')
      await startEscapeRoomAttempt(
        { practiceQuizId: quiz.id },
        participantCtx(participant.id)
      )

      await expect(
        requestEscapeRoomHint(
          { practiceQuizId: quiz.id, instanceId },
          participantCtx(participant.id)
        )
      ).rejects.toThrow('No hint available for this element')
    })

    it('rejects a hint request without a running attempt', async () => {
      const { quiz, instanceId } = await seedQuizWithHint('secret')
      const participant = await seedParticipant('hint-no-attempt')

      await expect(
        requestEscapeRoomHint(
          { practiceQuizId: quiz.id, instanceId },
          participantCtx(participant.id)
        )
      ).rejects.toThrow('No active escape room attempt found for this activity')
    })

    it('rejects a hint request for an instance that belongs to another activity', async () => {
      const { instanceId: foreignInstanceId } =
        await seedQuizWithHint('foreign hint')
      const { quiz } = await seedQuizWithHint('own hint')
      const participant = await seedParticipant('hint-cross-activity')
      await startEscapeRoomAttempt(
        { practiceQuizId: quiz.id },
        participantCtx(participant.id)
      )

      // pairing a valid attempt with an instanceId from a different quiz must
      // not leak that quiz's hint text
      await expect(
        requestEscapeRoomHint(
          { practiceQuizId: quiz.id, instanceId: foreignInstanceId },
          participantCtx(participant.id)
        )
      ).rejects.toThrow('Element does not belong to this activity')
    })

    it('rejects a hint request from a non-participant', async () => {
      const { quiz, instanceId } = await seedQuizWithHint('secret')

      await expect(
        requestEscapeRoomHint(
          { practiceQuizId: quiz.id, instanceId },
          lecturerCtx as unknown as ContextWithUser
        )
      ).rejects.toThrow('Only participants can request escape room hints')
    })

    it('rejects a request that supplies more than one activity ID', async () => {
      // guards against the priority-mismatch leak: a valid attempt on one
      // activity must not gate a hint read against a second activity's instance
      const { quiz, instanceId } = await seedQuizWithHint('own hint')
      const participant = await seedParticipant('hint-multi-id')
      await startEscapeRoomAttempt(
        { practiceQuizId: quiz.id },
        participantCtx(participant.id)
      )

      await expect(
        requestEscapeRoomHint(
          { practiceQuizId: quiz.id, elementBlockId: 999999, instanceId },
          participantCtx(participant.id)
        )
      ).rejects.toThrow('Exactly one activity ID must be specified')
    })

    it('accumulates the penalty across two distinct hints', async () => {
      const quiz = await seedEscapeRoomQuiz(2)
      const i0 = quiz.stacks[0]!.elements[0]!
      const i1 = quiz.stacks[1]!.elements[0]!
      await prisma.elementInstance.update({
        where: { id: i0.id },
        data: { options: { ...i0.options, escapeRoomHint: 'hint zero' } },
      })
      await prisma.elementInstance.update({
        where: { id: i1.id },
        data: { options: { ...i1.options, escapeRoomHint: 'hint one' } },
      })
      const participant = await seedParticipant('hint-accumulate')
      const attempt = await startEscapeRoomAttempt(
        { practiceQuizId: quiz.id },
        participantCtx(participant.id)
      )

      await requestEscapeRoomHint(
        { practiceQuizId: quiz.id, instanceId: i0.id },
        participantCtx(participant.id)
      )
      const second = await requestEscapeRoomHint(
        { practiceQuizId: quiz.id, instanceId: i1.id },
        participantCtx(participant.id)
      )

      expect(second.attempt.penaltySeconds).toBe(60)
      expect((second.attempt.hintsUsed as string[]).sort()).toEqual(
        [String(i0.id), String(i1.id)].sort()
      )

      const persisted = await prisma.escapeRoomAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      })
      expect(persisted.penaltySeconds).toBe(60)
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

  // ! Lecturer progress dashboard query
  // #region
  describe('getEscapeRoomProgress - lecturer progress aggregation', () => {
    it('reports per-participant cleared stacks, total stacks and attempt metadata', async () => {
      const quiz = await seedEscapeRoomQuiz(2, { timeLimit: 1800 })
      const stack0 = quiz.stacks[0]!
      const participant = await seedParticipant('progress')
      await startEscapeRoomAttempt(
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

      const progress = await getEscapeRoomProgress(
        { practiceQuizId: quiz.id },
        lecturerCtx
      )

      expect(progress).not.toBeNull()
      expect(progress!.totalStacks).toBe(2)
      expect(progress!.timeLimit).toBe(1800)
      expect(progress!.attempts).toHaveLength(1)

      const entry = progress!.attempts[0]!
      expect(entry.participantId).toBe(participant.id)
      expect(entry.displayName).toBe(`${TEST_PREFIX}-progress`)
      expect(entry.status).toBe(DB.EscapeRoomStatus.IN_PROGRESS)
      expect(entry.clearedStacks).toBe(1)
      expect(entry.hintsUsedCount).toBe(0)
      expect(entry.penaltySeconds).toBe(0)
      expect(entry.completedAt).toBeNull()
      expect(entry.timeSpentSeconds).toBeNull()
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
})
