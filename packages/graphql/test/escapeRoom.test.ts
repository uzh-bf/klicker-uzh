import { prisma as prismaClient } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import { StackFeedbackStatus } from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Context, ContextWithUser } from '../src/lib/context.js'
import {
  getEscapeRoomExpiresInSeconds,
  getEscapeRoomHints,
  getEscapeRoomProgress,
  getEscapeRoomRemainingSeconds,
} from '../src/services/escapeRooms.js'
import {
  getGradingGroupActivity,
  getGroupActivityDetails,
  manipulateGroupActivity,
  submitGroupActivityDecisions,
} from '../src/services/groups.js'
import {
  getCockpitQuiz,
  manipulateLiveQuiz,
} from '../src/services/liveQuizzes.js'
import { getMicroLearningData } from '../src/services/microLearning.js'
import {
  getPracticeQuizData,
  manipulatePracticeQuiz,
  requestEscapeRoomHint,
  resetEscapeRoomAttempt,
  startEscapeRoomAttempt,
} from '../src/services/practiceQuizzes.js'
import { handlePruneEscapeRooms } from '../src/services/pruneEscapeRooms.js'
import { respondToElementStack } from '../src/services/stacks.js'
import {
  seedCourse,
  seedEscapeRoomGroupActivity,
  seedEscapeRoomMicroLearning,
  seedEscapeRoomPracticeQuiz,
  seedLiveQuiz,
} from './helpers.js'

const TEST_PREFIX = `escape-${Date.now()}`

let prisma: PrismaClient
let lecturerCtx: ContextWithUser
let courseId: string
let scElement: DB.Element
let qrElement: DB.Element

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

function groupScResponse(instanceId: number, selectedIx: 0 | 1) {
  return {
    instanceId,
    type: DB.ElementType.SC,
    choicesResponse: [{ ix: selectedIx, selected: true }],
  }
}

function qrResponse(instanceId: number, code: string) {
  return {
    instanceId,
    type: DB.ElementType.QR_SCAN,
    qrScanResponse: code,
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
      participations: { create: [{ courseId, isActive: true }] },
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

    qrElement = await prisma.element.create({
      data: {
        type: DB.ElementType.QR_SCAN,
        name: `${TEST_PREFIX}-qr-element`,
        content: 'Find and scan the hidden code',
        explanation: 'QR explanation',
        options: {},
        // distinct from the Playwright spec's code: both may target the same
        // dev database and qrScanCode is globally unique
        qrScanCode: 'ItGrQr56_-78',
        ownerId: lecturer.id,
      },
    })
    createdElementIds.push(qrElement.id)
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
          responses: [qrResponse(correctInstance.id, 'ItGrQr56_-78')],
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
          responses: [qrResponse(instance.id, 'ItGrQr56_-78')],
          stackAnswerTime: 10,
        },
        participantCtx(participant.id)
      )
      await expect(
        respondToElementStack(
          {
            stackId: stack.id,
            courseId,
            responses: [qrResponse(instance.id, 'ItGrQr56_-78')],
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
            responses: [qrResponse(future.id, 'ItGrQr56_-78')],
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
            responses: [qrResponse(foreign.id, 'ItGrQr56_-78')],
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
    })
  })

  // ! Escape-room hint authoring round-trip
  // #region
  describe('escape-room hint authoring', () => {
    async function seedDraftQuizWithHint(hint: string) {
      const quiz = await seedEscapeRoomPracticeQuiz(
        {
          elements: [scElement],
          courseId,
          status: DB.PublicationStatus.DRAFT,
        },
        lecturerCtx
      )
      createdQuizIds.push(quiz.id)
      const instance = quiz.stacks[0]!.elements[0]!
      await prisma.elementInstance.update({
        where: { id: instance.id },
        data: { options: { ...instance.options, escapeRoomHint: hint } },
      })
      return { quiz, instance }
    }

    function editArgs(
      quiz: Awaited<ReturnType<typeof seedEscapeRoomPracticeQuiz>>,
      instance: DB.ElementInstance,
      escapeRoomHint?: string | null
    ) {
      return {
        id: quiz.id,
        name: quiz.name,
        displayName: quiz.displayName,
        description: quiz.description,
        stacks: [
          {
            order: 0,
            elements: [
              {
                elementId: instance.elementId,
                order: 0,
                existingInstanceId: instance.id,
                duplicateInstance: false,
                ...(typeof escapeRoomHint === 'undefined'
                  ? {}
                  : { escapeRoomHint }),
              },
            ],
          },
        ],
        courseId,
        multiplier: 1,
        order: DB.ElementOrderType.SEQUENTIAL,
        resetTimeDays: 1,
        isEscapeRoom: true,
      }
    }

    it('preserves an omitted hint, updates it, and explicitly clears it', async () => {
      const { quiz, instance } = await seedDraftQuizWithHint('original hint')

      await manipulatePracticeQuiz(editArgs(quiz, instance), lecturerCtx)
      expect(
        (
          await prisma.elementInstance.findUniqueOrThrow({
            where: { id: instance.id },
          })
        ).options.escapeRoomHint
      ).toBe('original hint')

      await manipulatePracticeQuiz(
        editArgs(quiz, instance, '  updated hint  '),
        lecturerCtx
      )
      expect(
        (
          await prisma.elementInstance.findUniqueOrThrow({
            where: { id: instance.id },
          })
        ).options.escapeRoomHint
      ).toBe('updated hint')

      await manipulatePracticeQuiz(editArgs(quiz, instance, ''), lecturerCtx)
      expect(
        (
          await prisma.elementInstance.findUniqueOrThrow({
            where: { id: instance.id },
          })
        ).options.escapeRoomHint
      ).toBeNull()
    })

    it('copies the existing hint when duplicating an instance with no override', async () => {
      const { quiz, instance } = await seedDraftQuizWithHint('copy me')
      await recomputeDerivedPermissions({ practiceQuizId: quiz.id }, prisma)
      const result = await manipulatePracticeQuiz(
        {
          name: `${TEST_PREFIX}-hint-copy`,
          displayName: 'Hint copy',
          stacks: [
            {
              order: 0,
              elements: [
                {
                  elementId: instance.elementId,
                  order: 0,
                  existingInstanceId: instance.id,
                  duplicateInstance: true,
                },
              ],
            },
          ],
          courseId,
          multiplier: 1,
          order: DB.ElementOrderType.SEQUENTIAL,
          resetTimeDays: 1,
          isEscapeRoom: true,
        },
        lecturerCtx
      )
      createdQuizIds.push(result.id)
      const duplicate = await prisma.elementInstance.findFirstOrThrow({
        where: { elementStack: { practiceQuizId: result.id } },
      })
      expect(duplicate.options.escapeRoomHint).toBe('copy me')
    })

    it('keeps a duplicate hint override isolated from the retained instance', async () => {
      const { quiz, instance } = await seedDraftQuizWithHint('original')
      await recomputeDerivedPermissions({ practiceQuizId: quiz.id }, prisma)
      const args = editArgs(quiz, instance)
      args.stacks[0]!.elements.push({
        elementId: instance.elementId,
        order: 1,
        existingInstanceId: instance.id,
        duplicateInstance: true,
        escapeRoomHint: 'duplicate only',
      })

      await manipulatePracticeQuiz(args, lecturerCtx)

      const instances = await prisma.elementInstance.findMany({
        where: { elementStack: { practiceQuizId: quiz.id } },
        orderBy: { order: 'asc' },
      })
      expect(instances).toHaveLength(2)
      expect(instances[0]!.options.escapeRoomHint).toBe('original')
      expect(instances[1]!.options.escapeRoomHint).toBe('duplicate only')
    })

    it('returns raw hints only to the activity owner', async () => {
      const { quiz, instance } = await seedDraftQuizWithHint('owner only')
      const otherLecturer = await prisma.user.create({
        data: {
          email: `${TEST_PREFIX}-hint-reader@example.com`,
          shortname: `${TEST_PREFIX}-hint-reader`,
          role: DB.UserRole.USER,
        },
      })
      createdUserIds.push(otherLecturer.id)
      await expect(
        getEscapeRoomHints(
          { practiceQuizId: quiz.id },
          createUserCtx(otherLecturer.id)
        )
      ).rejects.toThrow('Only the activity owner')
      await expect(
        getEscapeRoomHints({ practiceQuizId: quiz.id }, lecturerCtx)
      ).resolves.toEqual([{ instanceId: instance.id, hint: 'owner only' }])
    })

    it('creates, reads, preserves, updates, clears, and duplicates group hints', async () => {
      await recomputeDerivedPermissions(
        { elementId: scElement.id, userId: lecturerCtx.user.sub },
        prisma
      )
      const baseArgs = {
        name: `${TEST_PREFIX}-group-hint-authoring`,
        displayName: 'Group hint authoring',
        description: 'Group hint authoring test',
        courseId,
        multiplier: 1,
        startDate: new Date(Date.now() + 60_000),
        endDate: new Date(Date.now() + 3_600_000),
        clues: [],
        isEscapeRoom: true,
      }
      const created = await manipulateGroupActivity(
        {
          ...baseArgs,
          stack: {
            order: 0,
            elements: [
              {
                elementId: scElement.id,
                order: 0,
                existingInstanceId: null,
                duplicateInstance: false,
                escapeRoomHint: '  group original  ',
              },
            ],
          },
        },
        lecturerCtx
      )
      const instance = await prisma.elementInstance.findFirstOrThrow({
        where: { elementStack: { groupActivityId: created.id } },
      })
      expect(instance.options.escapeRoomHint).toBe('group original')
      await expect(
        getEscapeRoomHints({ groupActivityId: created.id }, lecturerCtx)
      ).resolves.toEqual([{ instanceId: instance.id, hint: 'group original' }])

      const edit = (escapeRoomHint?: string | null) =>
        manipulateGroupActivity(
          {
            ...baseArgs,
            id: created.id,
            stack: {
              order: 0,
              elements: [
                {
                  elementId: instance.elementId,
                  order: 0,
                  existingInstanceId: instance.id,
                  duplicateInstance: false,
                  ...(typeof escapeRoomHint === 'undefined'
                    ? {}
                    : { escapeRoomHint }),
                },
              ],
            },
          },
          lecturerCtx
        )

      await edit()
      expect(
        (
          await prisma.elementInstance.findUniqueOrThrow({
            where: { id: instance.id },
          })
        ).options.escapeRoomHint
      ).toBe('group original')
      await edit(' group updated ')
      expect(
        (
          await prisma.elementInstance.findUniqueOrThrow({
            where: { id: instance.id },
          })
        ).options.escapeRoomHint
      ).toBe('group updated')

      const duplicate = await manipulateGroupActivity(
        {
          ...baseArgs,
          name: `${baseArgs.name}-copy`,
          stack: {
            order: 0,
            elements: [
              {
                elementId: instance.elementId,
                order: 0,
                existingInstanceId: instance.id,
                duplicateInstance: true,
              },
            ],
          },
        },
        lecturerCtx
      )
      expect(
        (
          await prisma.elementInstance.findFirstOrThrow({
            where: { elementStack: { groupActivityId: duplicate.id } },
          })
        ).options.escapeRoomHint
      ).toBe('group updated')

      await edit(null)
      expect(
        (
          await prisma.elementInstance.findUniqueOrThrow({
            where: { id: instance.id },
          })
        ).options.escapeRoomHint
      ).toBeNull()

      const otherLecturer = await prisma.user.create({
        data: {
          email: `${TEST_PREFIX}-group-hint-reader@example.com`,
          shortname: `${TEST_PREFIX}-group-hint-reader`,
          role: DB.UserRole.USER,
        },
      })
      createdUserIds.push(otherLecturer.id)
      await expect(
        getEscapeRoomHints(
          { groupActivityId: duplicate.id },
          createUserCtx(otherLecturer.id)
        )
      ).rejects.toThrow('Only the activity owner')
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

    it('charges a concurrently requested hint only once', async () => {
      const { quiz, instanceId } = await seedQuizWithHint('concurrent hint')
      const participant = await seedParticipant('hint-concurrent')
      const attempt = await startEscapeRoomAttempt(
        { practiceQuizId: quiz.id },
        participantCtx(participant.id)
      )

      const results = await Promise.all(
        Array.from({ length: 2 }, () =>
          requestEscapeRoomHint(
            { practiceQuizId: quiz.id, instanceId },
            participantCtx(participant.id)
          )
        )
      )
      expect(results.map((result) => result.hint)).toEqual([
        'concurrent hint',
        'concurrent hint',
      ])
      const persisted = await prisma.escapeRoomAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      })
      expect(persisted.penaltySeconds).toBe(30)
      expect(persisted.hintsUsed).toEqual([String(instanceId)])
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

    it('rejects a hint for a future locked stack without charging it', async () => {
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
      await expect(
        requestEscapeRoomHint(
          { practiceQuizId: quiz.id, instanceId: i1.id },
          participantCtx(participant.id)
        )
      ).rejects.toThrow(
        'You must answer all preceding questions correctly before requesting this hint'
      )

      const persisted = await prisma.escapeRoomAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      })
      expect(persisted.penaltySeconds).toBe(30)
      expect(persisted.hintsUsed).toEqual([String(i0.id)])

      await respondToElementStack(
        {
          stackId: quiz.stacks[0]!.id,
          courseId,
          responses: [scResponse(i0.id, 0)],
          stackAnswerTime: 10,
        },
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
    })

    it('restores only an already-used hint for the owning participant', async () => {
      const { quiz, instanceId } = await seedQuizWithHint('persistent hint')
      const participant = await seedParticipant('hint-reload')
      await startEscapeRoomAttempt(
        { practiceQuizId: quiz.id },
        participantCtx(participant.id)
      )
      await requestEscapeRoomHint(
        { practiceQuizId: quiz.id, instanceId },
        participantCtx(participant.id)
      )

      const reloaded = await getPracticeQuizData(
        { id: quiz.id },
        participantCtx(participant.id)
      )
      const reloadedElement = reloaded!.stacks[0]!.elements[0]!
      expect(
        'revealedHint' in reloadedElement
          ? reloadedElement.revealedHint
          : undefined
      ).toBe('persistent hint')

      const otherParticipant = await seedParticipant('hint-reload-other')
      await startEscapeRoomAttempt(
        { practiceQuizId: quiz.id },
        participantCtx(otherParticipant.id)
      )
      const otherView = await getPracticeQuizData(
        { id: quiz.id },
        participantCtx(otherParticipant.id)
      )
      const otherElement = otherView!.stacks[0]!.elements[0]!
      expect(
        'revealedHint' in otherElement ? otherElement.revealedHint : undefined
      ).toBeNull()
    })

    it('gates and restores hints for MicroLearning without cross-participant leakage', async () => {
      const microLearning = await seedEscapeRoomMicroLearning(
        { elements: [scElement, scElement], courseId },
        lecturerCtx
      )
      const first = microLearning.stacks[0]!.elements[0]!
      const second = microLearning.stacks[1]!.elements[0]!
      await prisma.elementInstance.update({
        where: { id: first.id },
        data: { options: { ...first.options, escapeRoomHint: 'micro first' } },
      })
      await prisma.elementInstance.update({
        where: { id: second.id },
        data: {
          options: { ...second.options, escapeRoomHint: 'micro second' },
        },
      })
      const participant = await seedParticipant('micro-hint-owner')
      await startEscapeRoomAttempt(
        { microLearningId: microLearning.id },
        participantCtx(participant.id)
      )

      await expect(
        requestEscapeRoomHint(
          { microLearningId: microLearning.id, instanceId: second.id },
          participantCtx(participant.id)
        )
      ).rejects.toThrow(
        'You must answer all preceding questions correctly before requesting this hint'
      )
      await requestEscapeRoomHint(
        { microLearningId: microLearning.id, instanceId: first.id },
        participantCtx(participant.id)
      )
      const ownerView = await getMicroLearningData(
        { id: microLearning.id },
        participantCtx(participant.id)
      )
      const ownerElement = ownerView!.stacks[0]!.elements[0]!
      expect(
        'revealedHint' in ownerElement ? ownerElement.revealedHint : undefined
      ).toBe('micro first')

      const otherParticipant = await seedParticipant('micro-hint-other')
      await startEscapeRoomAttempt(
        { microLearningId: microLearning.id },
        participantCtx(otherParticipant.id)
      )
      const otherView = await getMicroLearningData(
        { id: microLearning.id },
        participantCtx(otherParticipant.id)
      )
      const otherElement = otherView!.stacks[0]!.elements[0]!
      expect(
        'revealedHint' in otherElement ? otherElement.revealedHint : undefined
      ).toBeNull()
    })

    it('shares distinct concurrent group hints and restores them for every member', async () => {
      const participantA = await seedParticipant('group-hint-a')
      const participantB = await seedParticipant('group-hint-b')
      const fixture = await seedEscapeRoomGroupActivity(
        {
          elements: [scElement, scElement],
          courseId,
          participantIds: [participantA.id, participantB.id],
        },
        lecturerCtx
      )
      const [instanceA, instanceB] = fixture.groupActivity.stacks[0]!.elements
      await Promise.all([
        prisma.elementInstance.update({
          where: { id: instanceA!.id },
          data: {
            options: { ...instanceA!.options, escapeRoomHint: 'group first' },
          },
        }),
        prisma.elementInstance.update({
          where: { id: instanceB!.id },
          data: {
            options: { ...instanceB!.options, escapeRoomHint: 'group second' },
          },
        }),
      ])

      await expect(
        getEscapeRoomHints(
          { groupActivityId: fixture.groupActivity.id },
          lecturerCtx
        )
      ).resolves.toHaveLength(2)

      const results = await Promise.all([
        requestEscapeRoomHint(
          {
            groupActivityId: fixture.groupActivity.id,
            instanceId: instanceA!.id,
          },
          participantCtx(participantA.id)
        ),
        requestEscapeRoomHint(
          {
            groupActivityId: fixture.groupActivity.id,
            instanceId: instanceB!.id,
          },
          participantCtx(participantB.id)
        ),
      ])
      expect(results.map((result) => result.hint).sort()).toEqual([
        'group first',
        'group second',
      ])

      const persisted = await prisma.escapeRoomAttempt.findUniqueOrThrow({
        where: { id: fixture.attempt.id },
      })
      expect(persisted.penaltySeconds).toBe(60)
      expect((persisted.hintsUsed as string[]).sort()).toEqual(
        [String(instanceA!.id), String(instanceB!.id)].sort()
      )

      for (const participant of [participantA, participantB]) {
        const details = await getGroupActivityDetails(
          {
            activityId: fixture.groupActivity.id,
            groupId: fixture.group.id,
          },
          participantCtx(participant.id)
        )
        expect(
          details!.stacks[0]!.elements.map((element) => element.revealedHint)
        ).toEqual(['group first', 'group second'])
      }
    })

    it('reuses one shared attempt when two group members start concurrently', async () => {
      const participantA = await seedParticipant('group-start-a')
      const participantB = await seedParticipant('group-start-b')
      const fixture = await seedEscapeRoomGroupActivity(
        {
          elements: [scElement],
          courseId,
          participantIds: [participantA.id, participantB.id],
        },
        lecturerCtx
      )
      await prisma.escapeRoomAttempt.delete({
        where: { id: fixture.attempt.id },
      })

      const starts = await Promise.all([
        startEscapeRoomAttempt(
          { groupActivityId: fixture.groupActivity.id },
          participantCtx(participantA.id)
        ),
        startEscapeRoomAttempt(
          { groupActivityId: fixture.groupActivity.id },
          participantCtx(participantB.id)
        ),
      ])

      expect(starts[0].id).toBe(starts[1].id)
      expect(
        await prisma.escapeRoomAttempt.count({
          where: {
            groupId: fixture.group.id,
            groupActivityId: fixture.groupActivity.id,
          },
        })
      ).toBe(1)
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

    it('resets only the authorized shared group state', async () => {
      const participantA = await seedParticipant('group-reset-a')
      const participantB = await seedParticipant('group-reset-b')
      const fixture = await seedEscapeRoomGroupActivity(
        {
          elements: [scElement],
          courseId,
          participantIds: [participantA.id, participantB.id],
        },
        lecturerCtx
      )
      await recomputeDerivedPermissions(
        {
          groupActivityId: fixture.groupActivity.id,
          userId: lecturerCtx.user.sub,
        },
        prisma
      )
      const otherLecturer = await prisma.user.create({
        data: {
          email: `${TEST_PREFIX}-group-reset-reader@example.com`,
          shortname: `${TEST_PREFIX}-group-reset-reader`,
          role: DB.UserRole.USER,
        },
      })
      createdUserIds.push(otherLecturer.id)

      expect(
        (
          await getGradingGroupActivity(
            { id: fixture.groupActivity.id },
            lecturerCtx
          )
        )?.canResetEscapeRoom
      ).toBe(true)
      expect(
        (
          await getGradingGroupActivity(
            { id: fixture.groupActivity.id },
            createUserCtx(otherLecturer.id)
          )
        )?.canResetEscapeRoom
      ).toBe(false)

      await expect(
        resetEscapeRoomAttempt(
          {
            groupActivityId: fixture.groupActivity.id,
            groupId: fixture.group.id,
          },
          createUserCtx(otherLecturer.id)
        )
      ).rejects.toThrow('You do not have write access')
      expect(
        await prisma.escapeRoomAttempt.findUnique({
          where: { id: fixture.attempt.id },
        })
      ).not.toBeNull()

      await expect(
        resetEscapeRoomAttempt(
          {
            groupActivityId: fixture.groupActivity.id,
            groupId: fixture.group.id,
          },
          lecturerCtx
        )
      ).resolves.toBe(true)
      expect(
        await prisma.escapeRoomAttempt.findUnique({
          where: { id: fixture.attempt.id },
        })
      ).toBeNull()
      expect(
        await prisma.groupActivityInstance.findUnique({
          where: { id: fixture.activityInstance.id },
        })
      ).toBeNull()
    })
  })
  // #endregion

  describe('LiveQuiz block attempt start/reset contract', () => {
    it('round-trips escape-room block configuration through create and edit', async () => {
      await recomputeDerivedPermissions(
        { elementId: scElement.id, userId: lecturerCtx.user.sub },
        prisma
      )
      const common = {
        name: `${TEST_PREFIX}-live-authoring`,
        displayName: 'Escape LiveQuiz',
        multiplier: 1,
        isGamificationEnabled: false,
        isPinProtected: false,
        isConfusionFeedbackEnabled: false,
        isLiveQAEnabled: false,
        isModerationEnabled: false,
        courseId: null,
      }
      const created = await manipulateLiveQuiz(
        {
          ...common,
          blocks: [
            {
              order: 0,
              isEscapeRoom: true,
              escapeRoomTimeLimit: 420,
              escapeRoomHintPenalty: 45,
              escapeRoomIntroText: 'Find the key.',
              elements: [
                {
                  elementId: scElement.id,
                  order: 0,
                  existingInstanceId: null,
                  duplicateInstance: false,
                  escapeRoomHint: 'Look closely.',
                },
              ],
            },
          ],
        },
        lecturerCtx
      )
      createdQuizIds.push(created.id)

      const createdBlock = await prisma.elementBlock.findFirstOrThrow({
        where: { liveQuizId: created.id },
        include: { escapeRoomConfig: true, elements: true },
      })
      expect(createdBlock.escapeRoomConfig).toMatchObject({
        timeLimit: 420,
        hintPenalty: 45,
        introText: 'Find the key.',
      })
      expect(createdBlock.elements[0]?.options.escapeRoomHint).toBe(
        'Look closely.'
      )

      await manipulateLiveQuiz(
        {
          ...common,
          id: created.id,
          displayName: 'Edited Escape LiveQuiz',
          blocks: [
            {
              order: 0,
              isEscapeRoom: true,
              escapeRoomTimeLimit: 600,
              escapeRoomHintPenalty: 30,
              escapeRoomIntroText: 'Open the vault.',
              elements: [
                {
                  elementId: scElement.id,
                  order: 0,
                  existingInstanceId: createdBlock.elements[0]!.id,
                  duplicateInstance: false,
                  escapeRoomHint: 'Try the first digit.',
                },
              ],
            },
          ],
        },
        lecturerCtx
      )

      const editedBlock = await prisma.elementBlock.findFirstOrThrow({
        where: { liveQuizId: created.id },
        include: { escapeRoomConfig: true, elements: true },
      })
      expect(editedBlock.escapeRoomConfig).toMatchObject({
        timeLimit: 600,
        hintPenalty: 30,
        introText: 'Open the vault.',
      })
      expect(editedBlock.elements[0]?.options.escapeRoomHint).toBe(
        'Try the first digit.'
      )
    })

    it('rejects empty and unsupported escape-room blocks', async () => {
      await recomputeDerivedPermissions(
        { elementId: scElement.id, userId: lecturerCtx.user.sub },
        prisma
      )
      const common = {
        name: `${TEST_PREFIX}-invalid-live-escape`,
        displayName: 'Invalid Escape LiveQuiz',
        multiplier: 1,
        isGamificationEnabled: false,
        isPinProtected: false,
        isConfusionFeedbackEnabled: false,
        isLiveQAEnabled: false,
        isModerationEnabled: false,
        courseId: null,
      }
      await expect(
        manipulateLiveQuiz(
          {
            ...common,
            blocks: [{ order: 0, isEscapeRoom: true, elements: [] }],
          },
          lecturerCtx
        )
      ).rejects.toThrow('at least one question')

      const content = await prisma.element.create({
        data: {
          type: DB.ElementType.CONTENT,
          name: `${TEST_PREFIX}-content-element`,
          content: 'Unsupported content',
          explanation: '',
          options: {},
          ownerId: lecturerCtx.user.sub,
        },
      })
      createdElementIds.push(content.id)
      await recomputeDerivedPermissions(
        { elementId: content.id, userId: lecturerCtx.user.sub },
        prisma
      )
      await expect(
        manipulateLiveQuiz(
          {
            ...common,
            blocks: [
              {
                order: 0,
                isEscapeRoom: true,
                elements: [
                  {
                    elementId: content.id,
                    order: 0,
                    existingInstanceId: null,
                    duplicateInstance: false,
                  },
                ],
              },
            ],
          },
          lecturerCtx
        )
      ).rejects.toThrow('only support')

      const originalCourseAuth = await prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: { authType: true, pinCode: true },
      })
      await prisma.course.update({
        where: { id: courseId },
        data: {
          isAssessmentEnabled: true,
          authType: DB.CourseAuthType.SSO,
          pinCode: null,
        },
      })
      try {
        await expect(
          manipulateLiveQuiz(
            {
              ...common,
              courseId,
              blocks: [
                {
                  order: 0,
                  isEscapeRoom: true,
                  elements: [
                    {
                      elementId: scElement.id,
                      order: 0,
                      existingInstanceId: null,
                      duplicateInstance: false,
                    },
                  ],
                },
              ],
            },
            lecturerCtx
          )
        ).rejects.toThrow('not supported in assessment')
      } finally {
        await prisma.course.update({
          where: { id: courseId },
          data: {
            isAssessmentEnabled: false,
            authType: originalCourseAuth.authType,
            pinCode: originalCourseAuth.pinCode,
          },
        })
      }
    })

    it('requires a regular participant start and permits only an authorized reset', async () => {
      const liveQuiz = await seedLiveQuiz(
        {
          elements: [{ id: scElement.id, type: scElement.type }],
          status: DB.PublicationStatus.PUBLISHED,
          courseId,
        },
        lecturerCtx
      )
      const block = liveQuiz.blocks[0]!
      await prisma.escapeRoomConfig.create({
        data: { elementBlockId: block.id, timeLimit: 300 },
      })
      await prisma.liveQuiz.update({
        where: { id: liveQuiz.id },
        data: {
          activeBlockId: block.id,
          blocks: {
            update: {
              where: { id: block.id },
              data: { status: DB.ElementBlockStatus.ACTIVE },
            },
          },
        },
      })
      await recomputeDerivedPermissions(
        { liveQuizId: liveQuiz.id, userId: lecturerCtx.user.sub },
        prisma
      )
      const redisPipeline = {
        hgetall: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, { participants: '0' }]]),
      }
      const cockpit = await getCockpitQuiz(
        { id: liveQuiz.id },
        {
          ...lecturerCtx,
          redisExec: { pipeline: () => redisPipeline } as any,
        }
      )
      expect(cockpit).toMatchObject({
        canResetEscapeRoom: true,
        activeBlock: {
          id: block.id,
          escapeRoomConfig: { timeLimit: 300 },
        },
      })
      const participant = await seedParticipant('live-block-start')

      await expect(
        startEscapeRoomAttempt(
          { elementBlockId: block.id },
          createUserCtx(participant.id, DB.UserRole.TEMPORARY_PARTICIPANT)
        )
      ).rejects.toThrow('Only participants can start escape room attempts')

      const started = await startEscapeRoomAttempt(
        { elementBlockId: block.id },
        participantCtx(participant.id)
      )
      expect(started).toMatchObject({
        participantId: participant.id,
        elementBlockId: block.id,
        status: DB.EscapeRoomStatus.IN_PROGRESS,
      })

      const progress = await getEscapeRoomProgress(
        { liveQuizId: liveQuiz.id, elementBlockId: block.id },
        lecturerCtx
      )
      expect(progress).toMatchObject({
        activityId: String(block.id),
        totalStacks: 1,
        attempts: [
          {
            id: started.id,
            participantId: participant.id,
            clearedStacks: 0,
          },
        ],
      })

      await prisma.escapeRoomAttempt.update({
        where: { id: started.id },
        data: {
          status: DB.EscapeRoomStatus.COMPLETED,
          completedAt: new Date(),
        },
      })
      const completedProgress = await getEscapeRoomProgress(
        { liveQuizId: liveQuiz.id, elementBlockId: block.id },
        lecturerCtx
      )
      expect(completedProgress?.attempts[0]?.clearedStacks).toBe(1)

      const foreignQuiz = await seedLiveQuiz(
        {
          elements: [{ id: scElement.id, type: scElement.type }],
          status: DB.PublicationStatus.PUBLISHED,
          courseId,
        },
        lecturerCtx
      )
      const foreignBlock = foreignQuiz.blocks[0]!
      await prisma.escapeRoomConfig.create({
        data: { elementBlockId: foreignBlock.id, timeLimit: 300 },
      })
      await expect(
        getEscapeRoomProgress(
          { liveQuizId: liveQuiz.id, elementBlockId: foreignBlock.id },
          lecturerCtx
        )
      ).resolves.toBeNull()

      await prisma.escapeRoomAttempt.update({
        where: { id: started.id },
        data: { status: DB.EscapeRoomStatus.IN_PROGRESS, completedAt: null },
      })

      await expect(
        resetEscapeRoomAttempt(
          { elementBlockId: block.id, participantId: participant.id },
          participantCtx(participant.id)
        )
      ).rejects.toThrow('Only lecturers can reset escape room attempts')

      await expect(
        resetEscapeRoomAttempt(
          { elementBlockId: block.id, participantId: participant.id },
          lecturerCtx
        )
      ).resolves.toBe(true)
      expect(
        await prisma.escapeRoomAttempt.findUnique({
          where: { id: started.id },
        })
      ).toBeNull()
    })
  })

  // ! SEC#1: status gate on escape attempt start/hint
  // #region
  describe('escape attempt status gate (SEC#1)', () => {
    it('rejects starting or hinting on an unpublished practice quiz for an enrolled participant', async () => {
      // an enrolled participant is authorized for the course but must still be
      // blocked from a scheduled (not-yet-published) escape room; the status
      // gate makes it indistinguishable from a missing quiz
      const quiz = await seedEscapeRoomPracticeQuiz(
        {
          elements: [scElement],
          courseId,
          status: DB.PublicationStatus.SCHEDULED,
        },
        lecturerCtx
      )
      createdQuizIds.push(quiz.id)
      const instanceId = quiz.stacks[0]!.elements[0]!.id
      const participant = await seedParticipant('gate-unpublished-pq')

      await expect(
        startEscapeRoomAttempt(
          { practiceQuizId: quiz.id },
          participantCtx(participant.id)
        )
      ).rejects.toThrow('Practice quiz not found')

      // the hint path carries the same gate, so no hint leaks before publish
      await expect(
        requestEscapeRoomHint(
          { practiceQuizId: quiz.id, instanceId },
          participantCtx(participant.id)
        )
      ).rejects.toThrow('Practice quiz not found')

      expect(
        await prisma.escapeRoomAttempt.count({
          where: { practiceQuizId: quiz.id },
        })
      ).toBe(0)
    })

    it('rejects starting an escape attempt on a LiveQuiz block that is not active', async () => {
      // ElementBlock.id is a globally sequential, guessable integer. A block
      // that carries an escapeRoomConfig but has not been activated must reject
      // an attempt - existence of the config alone must never open the timer.
      const liveQuiz = await seedLiveQuiz(
        {
          elements: [{ id: scElement.id, type: scElement.type }],
          status: DB.PublicationStatus.PUBLISHED,
          courseId,
        },
        lecturerCtx
      )
      const block = liveQuiz.blocks[0]!
      await prisma.escapeRoomConfig.create({
        data: { elementBlockId: block.id, timeLimit: 300 },
      })
      // deliberately leave the block in its default (non-ACTIVE) status
      const participant = await seedParticipant('gate-inactive-block')

      await expect(
        startEscapeRoomAttempt(
          { elementBlockId: block.id },
          participantCtx(participant.id)
        )
      ).rejects.toThrow('Block not found')

      expect(
        await prisma.escapeRoomAttempt.count({
          where: { elementBlockId: block.id },
        })
      ).toBe(0)
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

  describe('submitGroupActivityDecisions - exact atomic escape submission', () => {
    async function seedGroupEscapeRoom() {
      const participantA = await seedParticipant(
        `group-a-${createdParticipantIds.length}`
      )
      const participantB = await seedParticipant(
        `group-b-${createdParticipantIds.length}`
      )
      return seedEscapeRoomGroupActivity(
        {
          elements: [scElement, scElement],
          courseId,
          participantIds: [participantA.id, participantB.id],
        },
        lecturerCtx
      ).then((fixture) => ({ ...fixture, participantA }))
    }

    async function snapshotGroupEscapeRoom(
      fixture: Awaited<ReturnType<typeof seedGroupEscapeRoom>>
    ) {
      const instances = fixture.groupActivity.stacks[0]!.elements
      return {
        results: await prisma.elementInstance.findMany({
          where: { id: { in: instances.map((instance) => instance.id) } },
          orderBy: { id: 'asc' },
          select: { id: true, results: true },
        }),
        activityInstance: await prisma.groupActivityInstance.findUniqueOrThrow({
          where: { id: fixture.activityInstance.id },
          select: { decisions: true, decisionsSubmittedAt: true },
        }),
        attempt: await prisma.escapeRoomAttempt.findUniqueOrThrow({
          where: { id: fixture.attempt.id },
          select: { status: true, completedAt: true, lockoutUntil: true },
        }),
      }
    }

    it.each(['empty', 'partial', 'duplicate', 'foreign'] as const)(
      'rejects a %s response set without changing any escape-room state',
      async (kind) => {
        const fixture = await seedGroupEscapeRoom()
        const instances = fixture.groupActivity.stacks[0]!.elements
        const foreignFixture =
          kind === 'foreign' ? await seedGroupEscapeRoom() : null
        const responses =
          kind === 'empty'
            ? []
            : kind === 'partial'
              ? [groupScResponse(instances[0]!.id, 0)]
              : kind === 'duplicate'
                ? [
                    groupScResponse(instances[0]!.id, 0),
                    groupScResponse(instances[0]!.id, 0),
                  ]
                : [
                    groupScResponse(instances[0]!.id, 0),
                    groupScResponse(
                      foreignFixture!.groupActivity.stacks[0]!.elements[0]!.id,
                      0
                    ),
                  ]
        const before = await snapshotGroupEscapeRoom(fixture)

        await expect(
          submitGroupActivityDecisions(
            { activityId: fixture.activityInstance.id, responses },
            participantCtx(fixture.participantA.id)
          )
        ).rejects.toThrow(
          'Group activity responses must exactly match the required instances'
        )

        expect(await snapshotGroupEscapeRoom(fixture)).toEqual(before)
      }
    )

    it('rejects malformed response payloads before changing any state', async () => {
      const fixture = await seedGroupEscapeRoom()
      const instances = fixture.groupActivity.stacks[0]!.elements
      const malformed = instances.map((instance) =>
        groupScResponse(instance.id, 0)
      )
      const malformedChoice = malformed[1]!.choicesResponse[0] as { ix: number }
      malformedChoice.ix = 999
      const before = await snapshotGroupEscapeRoom(fixture)

      await expect(
        submitGroupActivityDecisions(
          { activityId: fixture.activityInstance.id, responses: malformed },
          participantCtx(fixture.participantA.id)
        )
      ).rejects.toThrow(
        'Group activity responses must exactly match the required instances'
      )

      expect(await snapshotGroupEscapeRoom(fixture)).toEqual(before)
    })

    it('fails closed when a required instance has no sample solution', async () => {
      const fixture = await seedGroupEscapeRoom()
      const instances = fixture.groupActivity.stacks[0]!.elements
      const elementData = instances[1]!.elementData as any
      elementData.options.hasSampleSolution = false
      await prisma.elementInstance.update({
        where: { id: instances[1]!.id },
        data: { elementData },
      })
      const before = await snapshotGroupEscapeRoom(fixture)

      await expect(
        submitGroupActivityDecisions(
          {
            activityId: fixture.activityInstance.id,
            responses: instances.map((instance) =>
              groupScResponse(instance.id, 0)
            ),
          },
          participantCtx(fixture.participantA.id)
        )
      ).rejects.toThrow(
        'Escape room group activity instances require sample solutions'
      )

      expect(await snapshotGroupEscapeRoom(fixture)).toEqual(before)
    })

    it('rolls back an earlier result update when a later instance update fails', async () => {
      const fixture = await seedGroupEscapeRoom()
      const instances = fixture.groupActivity.stacks[0]!.elements
      await prisma.elementInstance.update({
        where: { id: instances[1]!.id },
        data: { results: {} as any },
      })
      const before = await snapshotGroupEscapeRoom(fixture)

      await expect(
        submitGroupActivityDecisions(
          {
            activityId: fixture.activityInstance.id,
            responses: instances.map((instance) =>
              groupScResponse(instance.id, 0)
            ),
          },
          participantCtx(fixture.participantA.id)
        )
      ).rejects.toThrow('Group activity response type is not supported')

      expect(await snapshotGroupEscapeRoom(fixture)).toEqual(before)
    })

    it('commits only expiry when the attempt time has elapsed', async () => {
      const fixture = await seedGroupEscapeRoom()
      const instances = fixture.groupActivity.stacks[0]!.elements
      await prisma.escapeRoomAttempt.update({
        where: { id: fixture.attempt.id },
        data: { startedAt: new Date(Date.now() - 10_000), timeLimit: 1 },
      })
      const before = await snapshotGroupEscapeRoom(fixture)

      await expect(
        submitGroupActivityDecisions(
          {
            activityId: fixture.activityInstance.id,
            responses: instances.map((instance) =>
              groupScResponse(instance.id, 0)
            ),
          },
          participantCtx(fixture.participantA.id)
        )
      ).rejects.toThrow('Escape room time has expired')

      const after = await snapshotGroupEscapeRoom(fixture)
      expect(after.results).toEqual(before.results)
      expect(after.activityInstance).toEqual(before.activityInstance)
      expect(after.attempt).toEqual({
        ...before.attempt,
        status: DB.EscapeRoomStatus.EXPIRED,
      })
    })

    it('does not require content or flashcard instances in the answer set', async () => {
      const nonResponseElements = await Promise.all(
        [DB.ElementType.CONTENT, DB.ElementType.FLASHCARD].map((type) =>
          prisma.element.create({
            data: {
              type,
              name: `${TEST_PREFIX}-${type}-${createdElementIds.length}`,
              content: `${type} content`,
              options: {},
              ownerId: lecturerCtx.user.sub,
            },
          })
        )
      )
      createdElementIds.push(
        ...nonResponseElements.map((element) => element.id)
      )
      const participantA = await seedParticipant('mixed-group-a')
      const participantB = await seedParticipant('mixed-group-b')
      const fixture = await seedEscapeRoomGroupActivity(
        {
          elements: [
            nonResponseElements[0]!,
            scElement,
            nonResponseElements[1]!,
          ],
          courseId,
          participantIds: [participantA.id, participantB.id],
        },
        lecturerCtx
      )
      const scInstance = fixture.groupActivity.stacks[0]!.elements.find(
        (instance) => instance.elementType === DB.ElementType.SC
      )!

      await expect(
        submitGroupActivityDecisions(
          {
            activityId: fixture.activityInstance.id,
            responses: [groupScResponse(scInstance.id, 0)],
          },
          participantCtx(participantA.id)
        )
      ).resolves.toBe(fixture.activityInstance.id)
    })

    it('rejects an activity with no answerable instances', async () => {
      const nonResponseElements = await Promise.all(
        [DB.ElementType.CONTENT, DB.ElementType.FLASHCARD].map((type) =>
          prisma.element.create({
            data: {
              type,
              name: `${TEST_PREFIX}-empty-${type}-${createdElementIds.length}`,
              content: `${type} content`,
              options: {},
              ownerId: lecturerCtx.user.sub,
            },
          })
        )
      )
      createdElementIds.push(
        ...nonResponseElements.map((element) => element.id)
      )
      const participantA = await seedParticipant('empty-group-a')
      const participantB = await seedParticipant('empty-group-b')
      const fixture = await seedEscapeRoomGroupActivity(
        {
          elements: nonResponseElements,
          courseId,
          participantIds: [participantA.id, participantB.id],
        },
        lecturerCtx
      )
      const before = await snapshotGroupEscapeRoom({
        ...fixture,
        participantA,
      })

      await expect(
        submitGroupActivityDecisions(
          { activityId: fixture.activityInstance.id, responses: [] },
          participantCtx(participantA.id)
        )
      ).rejects.toThrow(
        'Group activity responses must exactly match the required instances'
      )

      expect(
        await snapshotGroupEscapeRoom({ ...fixture, participantA })
      ).toEqual(before)
    })

    it.each([
      { label: 'SC', type: DB.ElementType.SC, correctIds: [0] },
      { label: 'MC', type: DB.ElementType.MC, correctIds: [0, 2] },
      { label: 'KPRIM mixed', type: DB.ElementType.KPRIM, correctIds: [0, 2] },
      { label: 'KPRIM all false', type: DB.ElementType.KPRIM, correctIds: [] },
    ])(
      'accepts production-shaped selected-only $label responses',
      async ({ label, type, correctIds }) => {
        const choices = Array.from(
          { length: type === DB.ElementType.SC ? 2 : 4 },
          (_, ix) => ({
            ix,
            value: `Choice ${ix}`,
            correct: correctIds.includes(ix),
            feedback: '',
          })
        )
        const element = await prisma.element.create({
          data: {
            type,
            name: `${TEST_PREFIX}-${type}-${createdElementIds.length}`,
            content: `${type} content`,
            options: {
              hasSampleSolution: true,
              hasAnswerFeedbacks: true,
              displayMode: 'LIST',
              choices,
            },
            ownerId: lecturerCtx.user.sub,
          },
        })
        createdElementIds.push(element.id)
        const participantA = await seedParticipant(`${label}-group-a`)
        const participantB = await seedParticipant(`${label}-group-b`)
        const fixture = await seedEscapeRoomGroupActivity(
          {
            elements: [element],
            courseId,
            participantIds: [participantA.id, participantB.id],
          },
          lecturerCtx
        )
        const instance = fixture.groupActivity.stacks[0]!.elements[0]!

        await expect(
          submitGroupActivityDecisions(
            {
              activityId: fixture.activityInstance.id,
              responses: [
                {
                  instanceId: instance.id,
                  type,
                  choicesResponse: correctIds.map((ix) => ({
                    ix,
                    selected: true,
                  })),
                },
              ],
            },
            participantCtx(participantA.id)
          )
        ).resolves.toBe(fixture.activityInstance.id)
      }
    )

    it('completes once for a valid exact response set', async () => {
      const fixture = await seedGroupEscapeRoom()
      const instances = fixture.groupActivity.stacks[0]!.elements
      const responses = instances.map((instance) =>
        groupScResponse(instance.id, 0)
      )

      await expect(
        submitGroupActivityDecisions(
          { activityId: fixture.activityInstance.id, responses },
          participantCtx(fixture.participantA.id)
        )
      ).resolves.toBe(fixture.activityInstance.id)

      const state = await snapshotGroupEscapeRoom(fixture)
      expect(state.activityInstance.decisionsSubmittedAt).not.toBeNull()
      expect(state.attempt.status).toBe(DB.EscapeRoomStatus.COMPLETED)
      expect(state.attempt.completedAt).not.toBeNull()
    })

    it('grades QR scan decisions against the private source code', async () => {
      const participantA = await seedParticipant('qr-group-a')
      const participantB = await seedParticipant('qr-group-b')
      const fixture = await seedEscapeRoomGroupActivity(
        {
          elements: [qrElement],
          courseId,
          participantIds: [participantA.id, participantB.id],
        },
        lecturerCtx
      )
      const instance = fixture.groupActivity.stacks[0]!.elements[0]!

      await expect(
        submitGroupActivityDecisions(
          {
            activityId: fixture.activityInstance.id,
            responses: [qrResponse(instance.id, 'ItGrQr56_-78')],
          },
          participantCtx(participantA.id)
        )
      ).resolves.toBe(fixture.activityInstance.id)

      const saved = await prisma.groupActivityInstance.findUniqueOrThrow({
        where: { id: fixture.activityInstance.id },
        select: { decisions: true },
      })
      expect(saved.decisions).toEqual([
        expect.objectContaining({ qrScanResponse: null }),
      ])

      const decoyParticipantA = await seedParticipant('qr-group-decoy-a')
      const decoyParticipantB = await seedParticipant('qr-group-decoy-b')
      const decoyFixture = await seedEscapeRoomGroupActivity(
        {
          elements: [qrElement],
          courseId,
          participantIds: [decoyParticipantA.id, decoyParticipantB.id],
        },
        lecturerCtx
      )
      const decoyInstance = decoyFixture.groupActivity.stacks[0]!.elements[0]!
      await expect(
        submitGroupActivityDecisions(
          {
            activityId: decoyFixture.activityInstance.id,
            responses: [qrResponse(decoyInstance.id, 'ZbCdEf12_-34')],
          },
          participantCtx(decoyParticipantA.id)
        )
      ).rejects.toMatchObject({ extensions: { code: 'ESCAPE_ROOM_LOCKOUT' } })
    })

    it('commits incorrect results and lockout without finalizing decisions', async () => {
      const fixture = await seedGroupEscapeRoom()
      const instances = fixture.groupActivity.stacks[0]!.elements
      const responses = [
        groupScResponse(instances[0]!.id, 1),
        groupScResponse(instances[1]!.id, 0),
      ]

      await expect(
        submitGroupActivityDecisions(
          { activityId: fixture.activityInstance.id, responses },
          participantCtx(fixture.participantA.id)
        )
      ).rejects.toMatchObject({
        message: 'Some answers are incorrect. You are locked out.',
        extensions: {
          code: 'ESCAPE_ROOM_LOCKOUT',
          lockoutRemainingSeconds: 5,
        },
      })

      const state = await snapshotGroupEscapeRoom(fixture)
      expect(state.activityInstance.decisions).toBeNull()
      expect(state.activityInstance.decisionsSubmittedAt).toBeNull()
      expect(state.attempt.status).toBe(DB.EscapeRoomStatus.IN_PROGRESS)
      expect(state.attempt.lockoutUntil).not.toBeNull()
      for (const instance of state.results) {
        expect('total' in instance.results ? instance.results.total : 0).toBe(1)
      }

      await prisma.escapeRoomAttempt.update({
        where: { id: fixture.attempt.id },
        data: { lockoutUntil: new Date(Date.now() - 1_000) },
      })
      await expect(
        submitGroupActivityDecisions(
          {
            activityId: fixture.activityInstance.id,
            responses: instances.map((instance) =>
              groupScResponse(instance.id, 0)
            ),
          },
          participantCtx(fixture.participantA.id)
        )
      ).resolves.toBe(fixture.activityInstance.id)
      expect(
        await prisma.escapeRoomAttempt.findUniqueOrThrow({
          where: { id: fixture.attempt.id },
          select: { status: true },
        })
      ).toEqual({ status: DB.EscapeRoomStatus.COMPLETED })
    })

    it('allows only one of two concurrent valid submissions to mutate state', async () => {
      const fixture = await seedGroupEscapeRoom()
      const instances = fixture.groupActivity.stacks[0]!.elements
      const responses = instances.map((instance) =>
        groupScResponse(instance.id, 0)
      )

      const results = await Promise.allSettled(
        Array.from({ length: 2 }, () =>
          submitGroupActivityDecisions(
            { activityId: fixture.activityInstance.id, responses },
            participantCtx(fixture.participantA.id)
          )
        )
      )

      expect(
        results.filter((result) => result.status === 'fulfilled')
      ).toHaveLength(1)
      const state = await snapshotGroupEscapeRoom(fixture)
      expect(state.attempt.status).toBe(DB.EscapeRoomStatus.COMPLETED)
      for (const instance of state.results) {
        expect('total' in instance.results ? instance.results.total : 0).toBe(1)
      }
    })
  })

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

      await expect(
        handlePruneEscapeRooms({ prisma }, { logger })
      ).resolves.toBe(true)
      await expect(
        handlePruneEscapeRooms({ prisma }, { logger })
      ).resolves.toBe(true)

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

      await expect(
        handlePruneEscapeRooms({ prisma }, { logger })
      ).resolves.toBe(true)
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
    it('reports per-participant cleared stacks, total stacks and attempt metadata', async () => {
      const quiz = await seedEscapeRoomQuiz(2, { timeLimit: 1800 })
      const stack0 = quiz.stacks[0]!
      const participant = await seedParticipant('progress')
      const notStartedParticipant = await seedParticipant(
        'progress-not-started'
      )
      const outsideParticipant = await prisma.participant.create({
        data: {
          username: `${TEST_PREFIX}-progress-outside`,
          password: 'test-password',
        },
      })
      createdParticipantIds.push(outsideParticipant.id)
      const inactiveParticipant = await prisma.participant.create({
        data: {
          username: `${TEST_PREFIX}-progress-inactive`,
          password: 'test-password',
          participations: { create: [{ courseId, isActive: false }] },
        },
      })
      createdParticipantIds.push(inactiveParticipant.id)
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
      const entry = progress!.attempts.find(
        (attempt) => attempt.participantId === participant.id
      )!
      expect(entry.participantId).toBe(participant.id)
      expect(entry.displayName).toBe(`${TEST_PREFIX}-progress`)
      expect(entry.status).toBe(DB.EscapeRoomStatus.IN_PROGRESS)
      expect(entry.clearedStacks).toBe(1)
      expect(entry.hintsUsedCount).toBe(0)
      expect(entry.penaltySeconds).toBe(0)
      expect(entry.completedAt).toBeNull()
      expect(entry.timeSpentSeconds).toBeNull()

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

    it('keeps group progress scoped to the shared group attempt', async () => {
      const participantA = await seedParticipant('progress-group-a')
      const participantB = await seedParticipant('progress-group-b')
      const fixture = await seedEscapeRoomGroupActivity(
        {
          elements: [scElement],
          courseId,
          participantIds: [participantA.id, participantB.id],
        },
        lecturerCtx
      )

      const progress = await getEscapeRoomProgress(
        { groupActivityId: fixture.groupActivity.id },
        lecturerCtx
      )

      expect(progress).not.toBeNull()
      expect(progress!.attempts).toHaveLength(1)
      expect(progress!.attempts[0]).toMatchObject({
        id: fixture.attempt.id,
        groupId: fixture.group.id,
        participantId: null,
        status: DB.EscapeRoomStatus.IN_PROGRESS,
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
})
