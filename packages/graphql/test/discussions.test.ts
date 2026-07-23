import type { Hatchet } from '@hatchet-dev/typescript-sdk'
import {
  DiscussionEventType,
  DiscussionScopeType,
  ElementStackType,
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../src/lib/context.js'
import {
  courseDiscussionOverview,
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
  seedMicroLearning,
  seedPracticeQuiz,
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

  it('preserves comparison text and rejects oversized content', async () => {
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, { courseId: course.id })

    const participantId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const participantCtx = createParticipantContext(userOneCtx, participantId)

    const thread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: '  Let x < 10 and y > 2.  ',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      participantCtx
    )

    expect(thread?.content).toBe('Let x < 10 and y > 2.')

    const oversizedThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'x'.repeat(4001),
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      participantCtx
    )
    expect(oversizedThread).toBeNull()

    const oversizedReply = await createCourseDiscussionReply(
      {
        courseId: course.id,
        threadId: thread!.id,
        content: 'x'.repeat(4001),
      },
      participantCtx
    )
    expect(oversizedReply).toBeNull()
  })

  it('atomically caps visible replies at fifty per thread', async () => {
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
        content: 'A thread approaching its reply cap.',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      participantOneCtx
    )
    expect(thread).toBeTruthy()

    await prisma.discussionReply.createMany({
      data: Array.from({ length: 49 }, (_, index) => ({
        threadId: thread!.id,
        spaceId: thread!.spaceId,
        scopeId: thread!.scopeId,
        content: `Existing reply ${index + 1}`,
        authorParticipantId: participantOneId,
      })),
    })
    const seededReplies = await prisma.discussionReply.findMany({
      where: { threadId: thread!.id },
      orderBy: { id: 'asc' },
      select: { id: true },
    })
    await prisma.discussionThread.update({
      where: { id: thread!.id },
      data: { replyCount: 49 },
    })

    const concurrentReplies = await Promise.all([
      createCourseDiscussionReply(
        {
          courseId: course.id,
          threadId: thread!.id,
          content: 'Concurrent reply one',
        },
        participantOneCtx
      ),
      createCourseDiscussionReply(
        {
          courseId: course.id,
          threadId: thread!.id,
          content: 'Concurrent reply two',
        },
        participantTwoCtx
      ),
    ])

    expect(concurrentReplies.filter(Boolean)).toHaveLength(1)
    expect(
      await prisma.discussionReply.count({
        where: { threadId: thread!.id, isDeleted: false },
      })
    ).toBe(50)
    expect(
      await prisma.discussionThread.findUnique({
        where: { id: thread!.id },
        select: { replyCount: true },
      })
    ).toEqual({ replyCount: 50 })

    const overflowReply = await createCourseDiscussionReply(
      {
        courseId: course.id,
        threadId: thread!.id,
        content: 'This reply must not be stored.',
      },
      participantOneCtx
    )
    expect(overflowReply).toBeNull()

    expect(
      await deleteCourseDiscussionReply(
        { replyId: seededReplies[0]!.id },
        participantOneCtx
      )
    ).toBe(true)

    const [replyCreatedDuringDelete, replyDeletedDuringCreate] =
      await Promise.all([
        createCourseDiscussionReply(
          {
            courseId: course.id,
            threadId: thread!.id,
            content: 'Created while another reply is deleted.',
          },
          participantOneCtx
        ),
        deleteCourseDiscussionReply(
          { replyId: seededReplies[1]!.id },
          participantOneCtx
        ),
      ])

    expect(replyCreatedDuringDelete).toBeTruthy()
    expect(replyDeletedDuringCreate).toBe(true)
    expect(
      await prisma.discussionReply.count({
        where: { threadId: thread!.id, isDeleted: false },
      })
    ).toBe(49)
    expect(
      await prisma.discussionThread.findUnique({
        where: { id: thread!.id },
        select: { replyCount: true },
      })
    ).toEqual({ replyCount: 49 })
    expect(
      await prisma.discussionEvent.count({
        where: {
          threadId: thread!.id,
          eventType: DiscussionEventType.REPLY_CREATED,
        },
      })
    ).toBe(2)
    expect(
      await prisma.discussionEvent.count({
        where: {
          threadId: thread!.id,
          eventType: DiscussionEventType.REPLY_DELETED,
        },
      })
    ).toBe(2)
  })

  it('rejects anonymous posting when embed token scope does not match', async () => {
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, {
      courseId: course.id,
      allowAnonymous: true,
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    const embedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: 'lms',
          externalRef: 'chapter-3',
        },
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
          externalRef: 'chapter-4',
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
          scopeType: DiscussionScopeType.EXTERNAL_BLOCK,
          externalSource: 'lms',
          externalRef: 'chapter-3',
        },
        isAnonymous: true,
        embedToken: embedInfo!.embedToken,
      },
      anonymousCtx
    )

    expect(acceptedThread).toBeTruthy()
    expect(acceptedThread?.isAnonymous).toBe(true)
  })

  it('keeps upvotes behind both course discussion gates', async () => {
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
        content: 'Voting must fail closed with either gate disabled.',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      participantOneCtx
    )
    const reply = await createCourseDiscussionReply(
      {
        courseId: course.id,
        threadId: thread!.id,
        content: 'Reply voting must use the same gates.',
      },
      participantOneCtx
    )

    expect(thread).toBeTruthy()
    expect(reply).toBeTruthy()

    for (const settings of [
      { enabled: false, rolloutEnabled: true },
      { enabled: true, rolloutEnabled: false },
    ]) {
      await enableCourseDiscussion(prisma, {
        courseId: course.id,
        ...settings,
      })

      expect(
        await toggleCourseDiscussionThreadUpvote(
          { threadId: thread!.id, upvote: true },
          participantTwoCtx
        )
      ).toBeNull()
      expect(
        await toggleCourseDiscussionReplyUpvote(
          { replyId: reply!.id, upvote: true },
          participantTwoCtx
        )
      ).toBeNull()
    }

    expect(
      await prisma.discussionThreadVote.count({
        where: { threadId: thread!.id },
      })
    ).toBe(0)
    expect(
      await prisma.discussionReplyVote.count({
        where: { replyId: reply!.id },
      })
    ).toBe(0)
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

    const embedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: 'lms',
          externalRef: 'disabled-course-flag',
        },
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

    const embedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: 'lms',
          externalRef: 'disabled-rollout-gate',
        },
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
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

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
        externalBlock: {
          externalSource: 'lms',
          externalRef: 'anonymous-enabled',
        },
        allowAnonymous: true,
      },
      userOneCtx
    )

    const identifiedOnlyEmbedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: 'lms',
          externalRef: 'identified-only',
        },
        allowAnonymous: false,
      },
      userOneCtx
    )

    expect(anonymousEmbedInfo).toBeTruthy()
    expect(identifiedOnlyEmbedInfo).toBeTruthy()

    const anonymousPage = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: 'ext:lms:anonymous-enabled',
        embedToken: anonymousEmbedInfo!.embedToken,
      },
      createAnonymousContext(userOneCtx)
    )

    const identifiedOnlyPage = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: 'ext:lms:identified-only',
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
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    const embedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: 'lms',
          externalRef: 'untampered-scope',
        },
        allowAnonymous: true,
      },
      userOneCtx
    )

    expect(embedInfo).toBeTruthy()

    const tamperedPage = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: 'ext:lms:untampered-scope:tampered',
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
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    const embedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: 'lms',
          externalRef: 'anonymous-disabled',
        },
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
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    const embedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: 'lms',
          externalRef: 'tampered-block-origin',
        },
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

  it('creates course discussion threads for activity-agnostic stacks and external blocks', async () => {
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, {
      courseId: course.id,
      allowAnonymous: true,
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    const participantId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const participantCtx = createParticipantContext(userOneCtx, participantId)

    const practiceQuiz = await seedPracticeQuiz(
      { courseId: course.id, elements: [] },
      userOneCtx
    )
    const practiceStack = await prisma.elementStack.create({
      data: {
        type: ElementStackType.PRACTICE_QUIZ,
        order: 0,
        displayName: 'Alpha Stack',
        practiceQuizId: practiceQuiz.id,
      },
    })

    const stackThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'Practice stack thread',
        scope: {
          scopeType: DiscussionScopeType.PRACTICE_STACK,
          stackId: practiceStack.id,
        },
      },
      participantCtx
    )

    expect(stackThread).toBeTruthy()
    expect(stackThread?.scope.scopeType).toBe(
      DiscussionScopeType.PRACTICE_STACK
    )
    expect(stackThread?.scope.scopeKey).toBe(`stack:${practiceStack.id}`)

    const embedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: 'moodle',
          externalRef: 'block-7',
        },
        allowAnonymous: true,
      },
      userOneCtx
    )

    expect(embedInfo).toBeTruthy()

    const externalThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'External block thread',
        scope: {
          scopeType: DiscussionScopeType.EXTERNAL_BLOCK,
          externalSource: 'moodle',
          externalRef: 'block-7',
        },
        isAnonymous: true,
        embedToken: embedInfo!.embedToken,
      },
      createAnonymousContext(userOneCtx)
    )

    expect(externalThread).toBeTruthy()
    expect(externalThread?.scope.scopeType).toBe(
      DiscussionScopeType.EXTERNAL_BLOCK
    )
    expect(externalThread?.scope.scopeKey).toBe('ext:moodle:block-7')

    const stackPage = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: `stack:${practiceStack.id}`,
        limit: 20,
      },
      participantCtx
    )

    expect(stackPage.threads).toHaveLength(1)
    expect(stackPage.threads[0]?.content).toBe('Practice stack thread')

    const microLearning = await seedMicroLearning(
      { courseId: course.id, elements: [] },
      userOneCtx
    )
    const microLearningStack = await prisma.elementStack.create({
      data: {
        type: ElementStackType.MICROLEARNING,
        order: 0,
        microLearningId: microLearning.id,
      },
      select: { id: true },
    })

    const microLearningThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'Microlearning stack thread',
        scope: {
          scopeType: DiscussionScopeType.PRACTICE_STACK,
          stackId: microLearningStack.id,
        },
      },
      participantCtx
    )

    expect(microLearningThread).toBeTruthy()
    expect(microLearningThread?.scope.scopeType).toBe(
      DiscussionScopeType.PRACTICE_STACK
    )
    expect(microLearningThread?.scope.scopeKey).toBe(
      `stack:${microLearningStack.id}`
    )
  })

  it('keeps the discussion schema limited to the shipped alpha scope', async () => {
    const removedSpaceColumns = await prisma.$queryRaw<
      Array<{ column_name: string }>
    >`
      SELECT column_name::text
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'DiscussionSpace'
        AND column_name IN ('liveQuizId')
    `

    expect(removedSpaceColumns).toHaveLength(0)

    const discussionSpaceCourseColumn = await prisma.$queryRaw<
      Array<{ is_nullable: string }>
    >`
      SELECT is_nullable::text
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'DiscussionSpace'
        AND column_name = 'courseId'
    `

    expect(discussionSpaceCourseColumn).toEqual([{ is_nullable: 'NO' }])

    const removedScopeColumns = await prisma.$queryRaw<
      Array<{ column_name: string }>
    >`
      SELECT column_name::text
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'DiscussionScope'
        AND column_name IN ('practiceQuizId', 'instanceId', 'liveBlockId')
    `

    expect(removedScopeColumns).toHaveLength(0)

    const discussionSpaceTypes = await prisma.$queryRaw<
      Array<{ label: string }>
    >`
      SELECT enumlabel::text AS label
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'DiscussionSpaceType'
      ORDER BY enumsortorder
    `

    expect(discussionSpaceTypes.map(({ label }) => label)).toEqual(['COURSE'])

    const discussionScopeTypes = await prisma.$queryRaw<
      Array<{ label: string }>
    >`
      SELECT enumlabel::text AS label
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'DiscussionScopeType'
      ORDER BY enumsortorder
    `

    expect(discussionScopeTypes.map(({ label }) => label)).toEqual([
      'COURSE',
      'PRACTICE_STACK',
      'EXTERNAL_BLOCK',
    ])
  })

  it('keeps default thread listing course-only even when other scopes exist', async () => {
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, {
      courseId: course.id,
      allowAnonymous: true,
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

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

    const practiceQuiz = await seedPracticeQuiz(
      { courseId: course.id, elements: [] },
      userOneCtx
    )
    const practiceStack = await prisma.elementStack.create({
      data: {
        type: ElementStackType.PRACTICE_QUIZ,
        order: 0,
        displayName: 'Scoped Practice Stack',
        practiceQuizId: practiceQuiz.id,
      },
    })

    const stackThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'Practice-stack thread',
        scope: {
          scopeType: DiscussionScopeType.PRACTICE_STACK,
          stackId: practiceStack.id,
        },
      },
      participantCtx
    )

    expect(stackThread).toBeTruthy()

    const externalEmbedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: 'moodle',
          externalRef: 'course-block',
        },
        allowAnonymous: true,
      },
      userOneCtx
    )

    expect(externalEmbedInfo).toBeTruthy()

    const externalThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'External-block thread',
        scope: {
          scopeType: DiscussionScopeType.EXTERNAL_BLOCK,
          externalSource: 'moodle',
          externalRef: 'course-block',
        },
        isAnonymous: true,
        embedToken: externalEmbedInfo!.embedToken,
      },
      createAnonymousContext(userOneCtx)
    )

    expect(externalThread).toBeTruthy()

    const participantOverview = await courseDiscussionOverview(
      {
        courseId: course.id,
        limit: 50,
      },
      participantCtx
    )
    expect(participantOverview.groups).toHaveLength(0)

    const overview = await courseDiscussionOverview(
      {
        courseId: course.id,
        limit: 50,
      },
      userOneCtx
    )

    const overviewLabels = overview.groups.map((group) => group.sourceLabel)
    expect(overviewLabels).toEqual(['Course'])
    const overviewThreadContents = overview.groups.flatMap((group) =>
      group.threads.map((thread) => thread.content)
    )
    expect(overviewThreadContents).toContain('Course-scope thread')
    expect(overviewThreadContents).toContain('Practice-stack thread')
    expect(overviewThreadContents).toContain('External-block thread')

    const threadPage = await courseDiscussionThreads(
      {
        courseId: course.id,
        limit: 50,
      },
      participantCtx
    )

    const leakedExternalPage = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: 'ext:moodle:course-block',
      },
      participantCtx
    )

    const threadContents = threadPage.threads.map((thread) => thread.content)
    expect(threadContents).toContain('Course-scope thread')
    expect(threadContents).not.toContain('Practice-stack thread')
    expect(threadContents).not.toContain('External-block thread')
    expect(leakedExternalPage.threads).toHaveLength(0)
    expect(leakedExternalPage.isAccessible).toBe(false)
  })
})
