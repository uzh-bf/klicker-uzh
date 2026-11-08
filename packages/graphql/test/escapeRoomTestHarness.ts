import { prisma as prismaClient } from '@klicker-uzh/prisma'
import * as DB from '@klicker-uzh/prisma/client'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import {
  type ElementData,
  type ElementInstanceResults,
  StackFeedbackStatus,
} from '@klicker-uzh/types'
import {
  generateQrScanCode,
  getInitialInstanceResults,
  processElementData,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import type { GraphQLObjectType } from 'graphql'
import { v4 as uuidv4 } from 'uuid'
import { afterAll, beforeAll, vi } from 'vitest'
import { schema } from '../src/index.js'
import type { Context, ContextWithUser } from '../src/lib/context.js'
import {
  getEscapeRoomExpiresInSeconds,
  getEscapeRoomHints,
  getEscapeRoomProgress,
  getEscapeRoomRemainingSeconds,
  requestEscapeRoomHint,
  resetEscapeRoomAttempt,
  startEscapeRoomAttempt,
} from '../src/services/escapeRooms.js'
import {
  getMicroLearningData,
  manipulateMicroLearning,
} from '../src/services/microLearning.js'
import {
  getPracticeQuizData,
  manipulatePracticeQuiz,
} from '../src/services/practiceQuizzes.js'
import { handlePruneEscapeRooms } from '../src/services/pruneEscapeRooms.js'
import { respondToElementStack } from '../src/services/stacks.js'
import { seedCourse } from './helpers.js'

const QR_SCAN_CODE = generateQrScanCode()
const TEST_PREFIX = `escape-${Date.now()}-${QR_SCAN_CODE}`

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

function createCtx(
  user?: Context['user'],
  claims = new Map<string, string>()
): Context {
  return {
    prisma: prisma as any,
    req: { locals: {} } as any,
    res: { cookie: vi.fn() } as any,
    redisExec: {
      set: vi.fn(async (key: string, token: string) => {
        if (claims.has(key)) return null
        claims.set(key, token)
        return 'OK'
      }),
      get: vi.fn(async (key: string) => claims.get(key) ?? null),
      del: vi.fn(async (key: string) => (claims.delete(key) ? 1 : 0)),
      eval: vi.fn(
        async (
          _script: string,
          _numberOfKeys: number,
          key: string,
          token: string
        ) => {
          if (claims.get(key) !== token) return 0
          claims.delete(key)
          return 1
        }
      ),
      smembers: vi.fn().mockResolvedValue([]),
    } as any,
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
  role: DB.UserRole = DB.UserRole.USER,
  claims?: Map<string, string>
): ContextWithUser {
  return createCtx(
    {
      sub,
      role,
      scope: DB.UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    claims
  ) as ContextWithUser
}

function participantCtx(
  participantId: string,
  claims?: Map<string, string>
): ContextWithUser {
  return createUserCtx(participantId, DB.UserRole.PARTICIPANT, claims)
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

function qrResponse(instanceId: number, code: string) {
  return {
    instanceId,
    type: DB.ElementType.QR_SCAN,
    qrScanResponse: code,
  }
}

/**
 * Seeds a practice quiz configured as an escape room, with a single-element
 * stack per array entry (order determines the sequential escape room step)
 * and an attached `escapeRoomConfig`.
 *
 * Unlike `seedPracticeQuiz`, the created `ElementInstance` rows carry real
 * `elementData`/`results`/`anonymousResults` (via `processElementData` /
 * `getInitialInstanceResults`), because `respondToElementStack` grades
 * correctness against the instance's own `elementData` - a bare `{}`
 * placeholder always evaluates as incorrect.
 *
 * @param elements - Full element records (with options) to include, one per stack
 * @param courseId - The ID of the course to associate the practice quiz with
 * @param status - Optional publication status for the practice quiz
 * @param timeLimit - Escape room time limit in seconds (default 3600)
 * @param lockoutSeconds - Escape room lockout duration in seconds (default 5)
 * @param ctx - The context object including the authenticated user and Prisma client
 * @returns The created practice quiz, including its ordered stacks (with elements) and escapeRoomConfig
 */
async function seedEscapeRoomPracticeQuiz(
  {
    elements,
    courseId,
    status,
    timeLimit,
    lockoutSeconds,
  }: {
    elements: DB.Element[]
    courseId: string
    status?: DB.PublicationStatus
    timeLimit?: number
    lockoutSeconds?: number
  },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.create({
    data: {
      name: uuidv4(),
      displayName: uuidv4(),
      description: uuidv4(),
      courseId,
      status,
      ownerId: ctx.user.sub,
      stacks: {
        create: elements.map((element, index) => {
          const elementData = processElementData(element)
          const results = getInitialInstanceResults(elementData)
          return {
            order: index,
            type: DB.ElementStackType.PRACTICE_QUIZ,
            elements: {
              create: [
                {
                  order: 0,
                  elementId: element.id,
                  type: DB.ElementInstanceType.PRACTICE_QUIZ,
                  elementType: element.type,
                  options: {},
                  elementData,
                  results,
                  anonymousResults: results,
                  ownerId: ctx.user.sub,
                  // respondToElementStack reads instanceStatistics with a non-null
                  // assertion when grading a response, so a published instance must
                  // have a statistics row (all counts default to 0).
                  instanceStatistics: { create: {} },
                },
              ],
            },
          }
        }),
      },
      escapeRoomConfig: {
        create: {
          timeLimit: timeLimit ?? 3600,
          lockoutSeconds: lockoutSeconds ?? 5,
        },
      },
    },
    include: {
      stacks: { orderBy: { order: 'asc' }, include: { elements: true } },
      escapeRoomConfig: true,
    },
  })

  return practiceQuiz
}

async function seedEscapeRoomMicroLearning(
  {
    elements,
    courseId,
    timeLimit,
    lockoutSeconds,
  }: {
    elements: DB.Element[]
    courseId: string
    timeLimit?: number
    lockoutSeconds?: number
  },
  ctx: ContextWithUser
) {
  return ctx.prisma.microLearning.create({
    data: {
      name: uuidv4(),
      displayName: uuidv4(),
      description: uuidv4(),
      courseId,
      status: DB.PublicationStatus.PUBLISHED,
      scheduledStartAt: new Date(Date.now() - 60_000),
      scheduledEndAt: new Date(Date.now() + 3_600_000),
      ownerId: ctx.user.sub,
      stacks: {
        create: elements.map((element, index) => {
          const elementData = processElementData(element)
          const results = getInitialInstanceResults(elementData)
          return {
            order: index,
            type: DB.ElementStackType.MICROLEARNING,
            elements: {
              create: {
                order: 0,
                elementId: element.id,
                type: DB.ElementInstanceType.MICROLEARNING,
                elementType: element.type,
                options: {},
                elementData,
                results,
                anonymousResults: results,
                ownerId: ctx.user.sub,
                instanceStatistics: { create: {} },
              },
            },
          }
        }),
      },
      escapeRoomConfig: {
        create: {
          timeLimit: timeLimit ?? 3600,
          lockoutSeconds: lockoutSeconds ?? 5,
        },
      },
    },
    include: {
      stacks: { orderBy: { order: 'asc' }, include: { elements: true } },
      escapeRoomConfig: true,
    },
  })
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
      password: TEST_PREFIX,
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

export {
  courseId,
  createCtx,
  createdElementIds,
  createdParticipantIds,
  createdQuizIds,
  createdStandaloneAttemptIds,
  createdUserIds,
  createUserCtx,
  DB,
  generateQrScanCode,
  getEscapeRoomExpiresInSeconds,
  getEscapeRoomHints,
  getEscapeRoomProgress,
  getEscapeRoomRemainingSeconds,
  getMicroLearningData,
  getPracticeQuizData,
  handlePruneEscapeRooms,
  lecturerCtx,
  manipulateMicroLearning,
  manipulatePracticeQuiz,
  participantCtx,
  prisma,
  QR_SCAN_CODE,
  qrElement,
  qrResponse,
  recomputeDerivedPermissions,
  requestEscapeRoomHint,
  resetEscapeRoomAttempt,
  respondToElementStack,
  scElement,
  schema,
  scResponse,
  seedCourse,
  seedEscapeRoomMicroLearning,
  seedEscapeRoomPracticeQuiz,
  seedEscapeRoomQuiz,
  seedParticipant,
  StackFeedbackStatus,
  startEscapeRoomAttempt,
  TEST_PREFIX,
}
export type {
  Context,
  ContextWithUser,
  ElementData,
  ElementInstanceResults,
  GraphQLObjectType,
}

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
      qrScanCode: QR_SCAN_CODE,
      ownerId: lecturer.id,
    },
  })
  createdElementIds.push(qrElement.id)
}, 60000)

afterAll(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
}, 60000)
