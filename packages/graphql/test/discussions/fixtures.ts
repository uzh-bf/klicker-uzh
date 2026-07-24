import {
  DiscussionScopeType,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  PrismaClient,
  ResponseCorrectness,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type { ElementData, ElementInstanceResults } from '@klicker-uzh/types'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../../src/lib/context.js'
import {
  courseDiscussionThreads,
  createCourseDiscussionReply,
  createCourseDiscussionThread,
  deleteCourseDiscussionReply,
  deleteCourseDiscussionThread,
  toggleCourseDiscussionReplyUpvote,
  toggleCourseDiscussionThreadUpvote,
} from '../../src/services/discussions.js'
import { seedMicroLearning, seedPracticeQuiz } from '../helpers.js'

export interface DiscussionTestContext {
  prisma: PrismaClient
  userOneCtx: ContextWithUser
}

export function createParticipantContext(
  baseCtx: ContextWithUser,
  participantId: string
): Context {
  return {
    ...baseCtx,
    user: {
      ...baseCtx.user,
      sub: participantId,
      role: UserRole.PARTICIPANT,
      scope: UserLoginScope.SESSION_EXEC,
    },
    req: {
      headers: {
        'user-agent': 'vitest',
        'x-forwarded-for': '127.0.0.1',
      },
      ip: '127.0.0.1',
      locals: {},
    } as any,
  }
}

export function createAnonymousContext(
  baseCtx: ContextWithUser,
  {
    ip = '127.0.0.1',
    userAgent = 'vitest-anon',
  }: { ip?: string; userAgent?: string } = {}
): Context {
  return {
    ...baseCtx,
    user: undefined,
    req: {
      headers: {
        'user-agent': userAgent,
        'x-forwarded-for': ip,
      },
      ip,
      locals: {},
    } as any,
  }
}

export function runTwiceConcurrently<T>(operation: () => Promise<T>) {
  return Promise.all([operation(), operation()])
}

export async function enableCourseDiscussion(
  prisma: PrismaClient,
  {
    courseId,
    enabled = true,
    allowAnonymous = false,
    rolloutEnabled = true,
  }: {
    courseId: string
    enabled?: boolean
    allowAnonymous?: boolean
    rolloutEnabled?: boolean
  }
) {
  await prisma.course.update({
    where: { id: courseId },
    data: {
      isCourseQARolloutEnabled: rolloutEnabled,
      isCourseQAEnabled: enabled,
      isCourseQAAnonymousEnabled: allowAnonymous,
    },
  })
}

export async function seedParticipantInCourse(
  prisma: PrismaClient,
  { courseId }: { courseId: string }
) {
  const participantId = uuidv4()

  await prisma.participant.create({
    data: {
      id: participantId,
      username: `participant-${participantId.slice(0, 8)}`,
      password: 'test-password',
    },
  })

  await prisma.participation.create({
    data: {
      courseId,
      participantId,
      isActive: true,
    },
  })

  return participantId
}

export async function seedDiscussionStack(
  prisma: PrismaClient,
  {
    courseId,
    stackType,
  }: {
    courseId: string
    stackType: 'PRACTICE_QUIZ' | 'MICROLEARNING'
  },
  ctx: ContextWithUser
) {
  const elements = await Promise.all(
    [0, 1].map((index) =>
      prisma.element.create({
        data: {
          name: `Discussion content ${index} ${uuidv4()}`,
          content: `Discussion evaluation marker ${index}`,
          options: {},
          type: ElementType.CONTENT,
          ownerId: ctx.user.sub,
        },
      })
    )
  )

  const activity =
    stackType === ElementStackType.PRACTICE_QUIZ
      ? await seedPracticeQuiz(
          {
            courseId,
            elements: [{ id: elements[0]!.id, type: ElementType.CONTENT }],
          },
          ctx
        )
      : await seedMicroLearning(
          {
            courseId,
            elements: [{ id: elements[0]!.id, type: ElementType.CONTENT }],
          },
          ctx
        )

  const seededStack = await prisma.elementStack.findFirstOrThrow({
    where:
      stackType === ElementStackType.PRACTICE_QUIZ
        ? { practiceQuizId: activity.id }
        : { microLearningId: activity.id },
  })

  await prisma.elementInstance.create({
    data: {
      order: 1,
      type:
        stackType === ElementStackType.PRACTICE_QUIZ
          ? ElementInstanceType.PRACTICE_QUIZ
          : ElementInstanceType.MICROLEARNING,
      elementType: ElementType.CONTENT,
      options: {},
      elementData: {} as ElementData,
      results: {} as ElementInstanceResults,
      anonymousResults: {} as ElementInstanceResults,
      elementId: elements[1]!.id,
      elementStackId: seededStack.id,
      ownerId: ctx.user.sub,
    },
  })

  const stack = await prisma.elementStack.findUniqueOrThrow({
    where: { id: seededStack.id },
    include: {
      elements: {
        orderBy: { order: 'asc' },
        select: { id: true },
      },
    },
  })

  return {
    stack,
    practiceQuizId:
      stackType === ElementStackType.PRACTICE_QUIZ ? activity.id : undefined,
    microLearningId:
      stackType === ElementStackType.MICROLEARNING ? activity.id : undefined,
  }
}

export async function seedStackEvaluation(
  prisma: PrismaClient,
  {
    courseId,
    participantId,
    stack,
    practiceQuizId,
    microLearningId,
    elementIndexes,
  }: {
    courseId: string
    participantId: string
    stack: { elements: Array<{ id: number }> }
    practiceQuizId?: string
    microLearningId?: string
    elementIndexes?: number[]
  }
) {
  const participation = await prisma.participation.findUniqueOrThrow({
    where: {
      courseId_participantId: {
        courseId,
        participantId,
      },
    },
    select: { id: true },
  })
  const instances = (elementIndexes ?? stack.elements.map((_, index) => index))
    .map((index) => stack.elements[index])
    .filter((instance): instance is { id: number } => Boolean(instance))

  if (instances.length === 0) {
    throw new Error('Discussion stack requires at least one selected element')
  }

  await Promise.all(
    instances.map((instance) =>
      prisma.questionResponse.create({
        data: {
          averageTimeSpent: 1,
          firstResponse: { viewed: true },
          firstResponseCorrectness: ResponseCorrectness.CORRECT,
          lastResponse: { viewed: true },
          lastResponseCorrectness: ResponseCorrectness.CORRECT,
          participantId,
          participationId: participation.id,
          elementInstanceId: instance.id,
          practiceQuizId,
          microLearningId,
          courseId,
        },
      })
    )
  )
}

export async function expectStackOperationsDenied(
  {
    courseId,
    stackId,
    threadId,
    replyId,
  }: {
    courseId: string
    stackId: number
    threadId?: number
    replyId?: number
  },
  participantCtx: Context
) {
  const page = await courseDiscussionThreads(
    {
      courseId,
      scopeKey: `stack:${stackId}`,
    },
    participantCtx
  )
  const thread = await createCourseDiscussionThread(
    {
      courseId,
      content: 'Blocked stack thread',
      scope: {
        scopeType: DiscussionScopeType.PRACTICE_STACK,
        stackId,
      },
    },
    participantCtx
  )

  expect(page.isAccessible).toBe(false)
  expect(thread).toBeNull()

  if (!threadId || !replyId) return

  expect(
    await createCourseDiscussionReply(
      {
        courseId,
        threadId,
        content: 'Blocked stack reply',
      },
      participantCtx
    )
  ).toBeNull()
  expect(
    await toggleCourseDiscussionThreadUpvote(
      { threadId, upvote: true },
      participantCtx
    )
  ).toBeNull()
  expect(
    await toggleCourseDiscussionReplyUpvote(
      { replyId, upvote: true },
      participantCtx
    )
  ).toBeNull()
  expect(await deleteCourseDiscussionThread({ threadId }, participantCtx)).toBe(
    false
  )
  expect(await deleteCourseDiscussionReply({ replyId }, participantCtx)).toBe(
    false
  )
}
