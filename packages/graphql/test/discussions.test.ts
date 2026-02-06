import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  DiscussionScopeType,
  DiscussionSpaceType,
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../src/lib/context.js'
import {
  courseDiscussionOverview,
  courseDiscussionThreads,
  createCourseDiscussionReply,
  createCourseDiscussionThread,
  getCourseDiscussionEmbeddingInfo,
  toggleCourseDiscussionReplyUpvote,
  toggleCourseDiscussionThreadUpvote,
} from '../src/services/discussions.js'
import {
  initializePrisma,
  seedCourse,
  seedLiveQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'

function createParticipantContext(
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

function createAnonymousContext(baseCtx: ContextWithUser): Context {
  return {
    ...baseCtx,
    user: undefined,
    req: {
      headers: {
        'user-agent': 'vitest-anon',
        'x-forwarded-for': '127.0.0.1',
      },
      ip: '127.0.0.1',
      locals: {},
    } as any,
  }
}

async function enableCourseDiscussion(
  prisma: PrismaClient,
  {
    courseId,
    allowAnonymous = false,
  }: {
    courseId: string
    allowAnonymous?: boolean
  }
) {
  await prisma.course.update({
    where: { id: courseId },
    data: {
      isCourseQAEnabled: true,
      isCourseQAAnonymousEnabled: allowAnonymous,
    },
  })
}

async function seedParticipantInCourse(
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

describe('Integration tests for the course discussion platform', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser

  beforeAll(async () => {
    const {
      prisma: newPrisma,
      hatchet: newHatchet,
      emitter: newEmitter,
    } = await initializePrisma()

    prisma = newPrisma
    hatchet = newHatchet
    emitter = newEmitter
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const { userOneCtx: ctx1 } = await testInitialization(
      prisma,
      hatchet,
      emitter
    )
    userOneCtx = ctx1
  })

  afterEach(async () => {
    await testCleanup(prisma)
  })

  it('creates course threads/replies and handles idempotent upvote toggles', async () => {
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, { courseId: course.id })

    const participantOneId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const participantTwoId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })

    const participantOneCtx = createParticipantContext(userOneCtx, participantOneId)
    const participantTwoCtx = createParticipantContext(userOneCtx, participantTwoId)

    const thread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'How does this concept work?',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      participantOneCtx
    )

    expect(thread).toBeTruthy()
    expect(thread?.scope.scopeType).toBe(DiscussionScopeType.COURSE)
    expect(thread?.scope.scopeKey).toBe(`course:${course.id}`)

    const reply = await createCourseDiscussionReply(
      {
        courseId: course.id,
        threadId: thread!.id,
        content: 'Here is one possible explanation.',
      },
      participantTwoCtx
    )

    expect(reply).toBeTruthy()
    expect(reply?.threadId).toBe(thread?.id)

    const threadPage = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: `course:${course.id}`,
        limit: 20,
      },
      participantOneCtx
    )

    expect(threadPage.threads).toHaveLength(1)
    expect(threadPage.threads[0]?.replies).toHaveLength(1)

    const upvotedThread = await toggleCourseDiscussionThreadUpvote(
      { threadId: thread!.id, upvote: true },
      participantTwoCtx
    )
    expect(upvotedThread?.upvotes).toBe(1)

    const upvotedThreadAgain = await toggleCourseDiscussionThreadUpvote(
      { threadId: thread!.id, upvote: true },
      participantTwoCtx
    )
    expect(upvotedThreadAgain?.upvotes).toBe(1)

    const removedThreadUpvote = await toggleCourseDiscussionThreadUpvote(
      { threadId: thread!.id, upvote: false },
      participantTwoCtx
    )
    expect(removedThreadUpvote?.upvotes).toBe(0)

    const upvotedReply = await toggleCourseDiscussionReplyUpvote(
      { replyId: reply!.id, upvote: true },
      participantOneCtx
    )
    expect(upvotedReply?.upvotes).toBe(1)

    const upvotedReplyAgain = await toggleCourseDiscussionReplyUpvote(
      { replyId: reply!.id, upvote: true },
      participantOneCtx
    )
    expect(upvotedReplyAgain?.upvotes).toBe(1)

    const removedReplyUpvote = await toggleCourseDiscussionReplyUpvote(
      { replyId: reply!.id, upvote: false },
      participantOneCtx
    )
    expect(removedReplyUpvote?.upvotes).toBe(0)
  })

  it('rejects anonymous posting when embed token scope does not match', async () => {
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, {
      courseId: course.id,
      allowAnonymous: true,
    })

    const embedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        scope: { scopeType: DiscussionScopeType.COURSE },
        allowAnonymous: true,
      },
      userOneCtx
    )

    expect(embedInfo).toBeTruthy()

    const anonymousCtx = createAnonymousContext(userOneCtx)

    const deniedThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'Anonymous question in wrong scope',
        scope: {
          scopeType: DiscussionScopeType.EXTERNAL_BLOCK,
          externalSource: 'lms',
          externalRef: 'chapter-3',
        },
        isAnonymous: true,
        embedToken: embedInfo!.embedToken,
      },
      anonymousCtx
    )

    expect(deniedThread).toBeNull()

    const acceptedThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'Anonymous question in valid scope',
        scope: {
          scopeType: DiscussionScopeType.COURSE,
        },
        isAnonymous: true,
        embedToken: embedInfo!.embedToken,
      },
      anonymousCtx
    )

    expect(acceptedThread).toBeTruthy()
    expect(acceptedThread?.isAnonymous).toBe(true)
  })

  it('aggregates linked live-quiz spaces into course overview and excludes standalone live quizzes', async () => {
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, { courseId: course.id })

    const participantId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const participantCtx = createParticipantContext(userOneCtx, participantId)

    const courseThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'Course-scope thread',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      participantCtx
    )
    expect(courseThread).toBeTruthy()

    const linkedLiveQuiz = await seedLiveQuiz(
      { elements: [], courseId: course.id },
      userOneCtx
    )
    const standaloneLiveQuiz = await seedLiveQuiz({ elements: [] }, userOneCtx)

    const linkedSpace = await prisma.discussionSpace.create({
      data: {
        spaceType: DiscussionSpaceType.LIVE_QUIZ,
        liveQuizId: linkedLiveQuiz.id,
      },
    })
    const linkedScope = await prisma.discussionScope.create({
      data: {
        spaceId: linkedSpace.id,
        scopeType: DiscussionScopeType.LIVE_QUIZ,
        scopeKey: `lq:${linkedLiveQuiz.id}`,
        scopeLabel: 'Live Quiz Scope',
      },
    })
    await prisma.discussionThread.create({
      data: {
        spaceId: linkedSpace.id,
        scopeId: linkedScope.id,
        content: 'Linked live-quiz thread',
      },
    })

    const standaloneSpace = await prisma.discussionSpace.create({
      data: {
        spaceType: DiscussionSpaceType.LIVE_QUIZ,
        liveQuizId: standaloneLiveQuiz.id,
      },
    })
    const standaloneScope = await prisma.discussionScope.create({
      data: {
        spaceId: standaloneSpace.id,
        scopeType: DiscussionScopeType.LIVE_QUIZ,
        scopeKey: `lq:${standaloneLiveQuiz.id}`,
        scopeLabel: 'Standalone Live Quiz Scope',
      },
    })
    await prisma.discussionThread.create({
      data: {
        spaceId: standaloneSpace.id,
        scopeId: standaloneScope.id,
        content: 'Standalone live-quiz thread',
      },
    })

    const overview = await courseDiscussionOverview(
      {
        courseId: course.id,
        limit: 50,
      },
      participantCtx
    )

    const overviewLabels = overview.groups.map((group) => group.sourceLabel)
    expect(overviewLabels).toContain('Course')
    expect(
      overviewLabels.some((label) =>
        label.includes(linkedLiveQuiz.displayName ?? linkedLiveQuiz.name)
      )
    ).toBe(true)
    expect(
      overviewLabels.some((label) =>
        label.includes(standaloneLiveQuiz.displayName ?? standaloneLiveQuiz.name)
      )
    ).toBe(false)

    const threadPage = await courseDiscussionThreads(
      {
        courseId: course.id,
        includeLinkedLiveQuizSpaces: true,
        limit: 50,
      },
      participantCtx
    )

    const threadContents = threadPage.threads.map((thread) => thread.content)
    expect(threadContents).toContain('Course-scope thread')
    expect(threadContents).toContain('Linked live-quiz thread')
    expect(threadContents).not.toContain('Standalone live-quiz thread')
  })
})
