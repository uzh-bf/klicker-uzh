import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  DiscussionEventType,
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
  courseDiscussionScopes,
  courseDiscussionThreads,
  createCourseDiscussionReply,
  createCourseDiscussionThread,
  deleteCourseDiscussionReply,
  deleteCourseDiscussionThread,
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

    const participantOneCtx = createParticipantContext(
      userOneCtx,
      participantOneId
    )
    const participantTwoCtx = createParticipantContext(
      userOneCtx,
      participantTwoId
    )

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

  it('keeps discussion functionality disabled when the course flag is off', async () => {
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, {
      courseId: course.id,
      enabled: false,
      rolloutEnabled: true,
    })

    const participantId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const participantCtx = createParticipantContext(userOneCtx, participantId)

    const thread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'This should not be created',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      participantCtx
    )

    expect(thread).toBeNull()

    const threadPage = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: `course:${course.id}`,
      },
      participantCtx
    )

    expect(threadPage.threads).toHaveLength(0)
    expect(threadPage.canPostAnonymously).toBe(false)

    const scopes = await courseDiscussionScopes(
      { courseId: course.id },
      participantCtx
    )
    expect(scopes).toHaveLength(0)

    const embedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        scope: { scopeType: DiscussionScopeType.COURSE },
        allowAnonymous: true,
      },
      userOneCtx
    )

    expect(embedInfo).toBeNull()
  })

  it('keeps discussion functionality hidden when the rollout gate is off', async () => {
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, {
      courseId: course.id,
      enabled: true,
      allowAnonymous: true,
      rolloutEnabled: false,
    })

    const participantId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const participantCtx = createParticipantContext(userOneCtx, participantId)

    const thread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'This should stay hidden behind the rollout gate',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      participantCtx
    )

    expect(thread).toBeNull()

    const threadPage = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: `course:${course.id}`,
      },
      participantCtx
    )

    expect(threadPage.threads).toHaveLength(0)
    expect(threadPage.canPostAnonymously).toBe(false)
    expect(threadPage.isAccessible).toBe(false)

    const scopes = await courseDiscussionScopes(
      { courseId: course.id },
      participantCtx
    )
    expect(scopes).toHaveLength(0)

    const embedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        scope: { scopeType: DiscussionScopeType.COURSE },
        allowAnonymous: true,
      },
      userOneCtx
    )

    expect(embedInfo).toBeNull()
  })

  it('only exposes anonymous embed posting when the specific token allows it', async () => {
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, {
      courseId: course.id,
      allowAnonymous: true,
    })

    const participantId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const participantCtx = createParticipantContext(userOneCtx, participantId)

    await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'Visible in embeds',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      participantCtx
    )

    const anonymousEmbedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        scope: { scopeType: DiscussionScopeType.COURSE },
        allowAnonymous: true,
      },
      userOneCtx
    )

    const identifiedOnlyEmbedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        scope: { scopeType: DiscussionScopeType.COURSE },
        allowAnonymous: false,
      },
      userOneCtx
    )

    expect(anonymousEmbedInfo).toBeTruthy()
    expect(identifiedOnlyEmbedInfo).toBeTruthy()

    const anonymousPage = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: `course:${course.id}`,
        embedToken: anonymousEmbedInfo!.embedToken,
      },
      createAnonymousContext(userOneCtx)
    )

    const identifiedOnlyPage = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: `course:${course.id}`,
        embedToken: identifiedOnlyEmbedInfo!.embedToken,
      },
      createAnonymousContext(userOneCtx)
    )

    expect(anonymousPage.canPostAnonymously).toBe(true)
    expect(identifiedOnlyPage.canPostAnonymously).toBe(false)
  })

  it('hides anonymous posting when an embed scope key is tampered with', async () => {
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

    const tamperedPage = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: `course:${course.id}:tampered`,
        embedToken: embedInfo!.embedToken,
      },
      createAnonymousContext(userOneCtx)
    )

    expect(tamperedPage.threads).toHaveLength(0)
    expect(tamperedPage.canPostAnonymously).toBe(false)
    expect(tamperedPage.isAccessible).toBe(false)
  })

  it('marks non-embed viewers without course access as inaccessible', async () => {
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, { courseId: course.id })

    const deniedPage = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: `course:${course.id}`,
      },
      createAnonymousContext(userOneCtx)
    )

    expect(deniedPage.threads).toHaveLength(0)
    expect(deniedPage.canPostAnonymously).toBe(false)
    expect(deniedPage.isAccessible).toBe(false)
  })

  it('clamps anonymous embed capability to the course setting', async () => {
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, {
      courseId: course.id,
      allowAnonymous: false,
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
    expect(embedInfo?.allowAnonymous).toBe(false)
  })

  it('does not persist a new scope when a tampered anonymous embed thread is rejected', async () => {
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

    const initialScopeCount = await prisma.discussionScope.count()

    const deniedThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'This tampered embed request should be rejected',
        scope: {
          scopeType: DiscussionScopeType.EXTERNAL_BLOCK,
          externalSource: 'moodle',
          externalRef: 'tampered-block',
        },
        isAnonymous: true,
        embedToken: embedInfo!.embedToken,
      },
      createAnonymousContext(userOneCtx)
    )

    expect(deniedThread).toBeNull()
    expect(await prisma.discussionScope.count()).toBe(initialScopeCount)
  })

  it('uses explicit delete events and enforces delete authorization', async () => {
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, { courseId: course.id })

    const authorParticipantId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const otherParticipantId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })

    const authorCtx = createParticipantContext(userOneCtx, authorParticipantId)
    const otherParticipantCtx = createParticipantContext(
      userOneCtx,
      otherParticipantId
    )

    const thread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'Delete me',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      authorCtx
    )
    expect(thread).toBeTruthy()

    const reply = await createCourseDiscussionReply(
      {
        courseId: course.id,
        threadId: thread!.id,
        content: 'Delete this reply',
      },
      authorCtx
    )
    expect(reply).toBeTruthy()

    const deniedThreadDelete = await deleteCourseDiscussionThread(
      { threadId: thread!.id },
      otherParticipantCtx
    )
    expect(deniedThreadDelete).toBe(false)

    const replyDeleted = await deleteCourseDiscussionReply(
      { replyId: reply!.id },
      authorCtx
    )
    expect(replyDeleted).toBe(true)

    const threadDeleted = await deleteCourseDiscussionThread(
      { threadId: thread!.id },
      authorCtx
    )
    expect(threadDeleted).toBe(true)

    const deleteEvents = await prisma.discussionEvent.findMany({
      where: {
        threadId: thread!.id,
      },
      orderBy: { id: 'asc' },
    })

    expect(deleteEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        DiscussionEventType.REPLY_DELETED,
        DiscussionEventType.THREAD_DELETED,
      ])
    )
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
        label.includes(
          standaloneLiveQuiz.displayName ?? standaloneLiveQuiz.name
        )
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
