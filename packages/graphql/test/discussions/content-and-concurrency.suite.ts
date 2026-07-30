import type { PrismaClient } from '@klicker-uzh/prisma/client'
import {
  DiscussionEventType,
  DiscussionScopeType,
  Prisma,
} from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../../src/lib/context.js'
import { deleteParticipantAccount } from '../../src/services/accounts.js'
import {
  courseDiscussionThreads,
  createCourseDiscussionReply,
  createCourseDiscussionThread,
  deleteCourseDiscussionReply,
  toggleCourseDiscussionReplyUpvote,
  toggleCourseDiscussionThreadUpvote,
} from '../../src/services/discussions.js'
import { lockParticipantForDiscussionVoteChanges } from '../../src/services/discussions/participant-votes.js'
import { seedCourse } from '../helpers.js'
import type { DiscussionTestContext } from './fixtures.js'
import {
  createParticipantContext,
  enableCourseDiscussion,
  runTwiceConcurrently,
  seedParticipantInCourse,
} from './fixtures.js'

async function waitForParticipantLockWaiters(
  prisma: PrismaClient,
  expectedCount: number
) {
  const deadline = Date.now() + 5000

  while (Date.now() < deadline) {
    const [result] = await prisma.$queryRaw<Array<{ count: number }>>(
      Prisma.sql`
        SELECT COUNT(*)::int AS "count"
        FROM "pg_stat_activity"
        WHERE "pid" <> pg_backend_pid()
          AND "datname" = current_database()
          AND "wait_event_type" = 'Lock'
          AND "query" LIKE '%FROM "public"."Participant"%'
          AND "query" LIKE '%FOR NO KEY UPDATE%'
      `
    )

    if ((result?.count ?? 0) >= expectedCount) return

    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  throw new Error(
    `Expected ${expectedCount} participant row lock waiter(s) before timeout`
  )
}

async function holdParticipantVoteLock(
  prisma: PrismaClient,
  participantId: string
) {
  let signalLockAcquired!: () => void
  const lockAcquired = new Promise<void>((resolve) => {
    signalLockAcquired = resolve
  })
  let releaseParticipantLock!: () => void
  const participantLockReleased = new Promise<void>((resolve) => {
    releaseParticipantLock = resolve
  })
  const transaction = prisma.$transaction(async (transaction) => {
    expect(
      await lockParticipantForDiscussionVoteChanges(transaction, participantId)
    ).toBe(true)
    signalLockAcquired()
    await participantLockReleased
  })

  await lockAcquired

  return {
    release: releaseParticipantLock,
    transaction,
  }
}

export function registerContentAndConcurrencySuite(
  getContext: () => DiscussionTestContext
) {
  it('creates course threads/replies and handles idempotent upvote toggles', async () => {
    const { prisma, userOneCtx } = getContext()
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
    expect(thread?.spaceId).toBe(thread?.scope.spaceId)

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
    expect(reply?.spaceId).toBe(thread?.spaceId)
    expect(reply?.scopeId).toBe(thread?.scopeId)

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
    expect(threadPage.threads[0]?.spaceId).toBe(thread?.spaceId)
    expect(threadPage.threads[0]?.replies[0]?.scopeId).toBe(thread?.scopeId)

    const upvotedThreads = await runTwiceConcurrently(() =>
      toggleCourseDiscussionThreadUpvote(
        { threadId: thread!.id, upvote: true },
        participantTwoCtx
      )
    )
    expect(upvotedThreads.map((result) => result?.upvotes)).toEqual([1, 1])

    const removedThreadUpvotes = await runTwiceConcurrently(() =>
      toggleCourseDiscussionThreadUpvote(
        { threadId: thread!.id, upvote: false },
        participantTwoCtx
      )
    )
    expect(removedThreadUpvotes.map((result) => result?.upvotes)).toEqual([
      0, 0,
    ])

    const upvotedReplies = await runTwiceConcurrently(() =>
      toggleCourseDiscussionReplyUpvote(
        { replyId: reply!.id, upvote: true },
        participantOneCtx
      )
    )
    expect(upvotedReplies.map((result) => result?.upvotes)).toEqual([1, 1])

    const removedReplyUpvotes = await runTwiceConcurrently(() =>
      toggleCourseDiscussionReplyUpvote(
        { replyId: reply!.id, upvote: false },
        participantOneCtx
      )
    )
    expect(removedReplyUpvotes.map((result) => result?.upvotes)).toEqual([0, 0])

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
    expect(
      await prisma.discussionEvent.count({
        where: {
          subjectId: thread!.id,
          eventType: DiscussionEventType.THREAD_UPVOTED,
        },
      })
    ).toBe(1)
    expect(
      await prisma.discussionEvent.count({
        where: {
          subjectId: reply!.id,
          eventType: DiscussionEventType.REPLY_UPVOTED,
        },
      })
    ).toBe(1)
  })

  it('preserves comparison text and rejects oversized content', async () => {
    const { prisma, userOneCtx } = getContext()
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

  it('reconciles discussion vote totals when a participant deletes their account', async () => {
    const { prisma, userOneCtx } = getContext()
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, { courseId: course.id })

    const authorId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const survivingVoterId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const deletedVoterId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const authorCtx = createParticipantContext(userOneCtx, authorId)
    const survivingVoterCtx = createParticipantContext(
      userOneCtx,
      survivingVoterId
    )
    const deletedVoterCtx = createParticipantContext(userOneCtx, deletedVoterId)
    const deletedVoterAccountCtx = {
      ...deletedVoterCtx,
      res: {
        ...deletedVoterCtx.res,
        cookie: () => undefined,
      },
    } as unknown as ContextWithUser
    const soloGroup = await prisma.participantGroup.create({
      data: {
        name: 'Deleted participant solo group',
        code: 1,
        courseId: course.id,
        participants: {
          connect: { id: deletedVoterId },
        },
      },
    })
    const sharedGroup = await prisma.participantGroup.create({
      data: {
        name: 'Shared participant group',
        code: 2,
        courseId: course.id,
        participants: {
          connect: [{ id: survivingVoterId }, { id: deletedVoterId }],
        },
      },
    })

    const thread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'A thread with votes from two participants.',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      authorCtx
    )
    const reply = await createCourseDiscussionReply(
      {
        courseId: course.id,
        threadId: thread!.id,
        content: 'A reply with votes from two participants.',
      },
      authorCtx
    )

    await toggleCourseDiscussionThreadUpvote(
      { threadId: thread!.id, upvote: true },
      survivingVoterCtx
    )
    await toggleCourseDiscussionThreadUpvote(
      { threadId: thread!.id, upvote: true },
      deletedVoterCtx
    )
    await toggleCourseDiscussionReplyUpvote(
      { replyId: reply!.id, upvote: true },
      survivingVoterCtx
    )
    await toggleCourseDiscussionReplyUpvote(
      { replyId: reply!.id, upvote: true },
      deletedVoterCtx
    )

    expect(await deleteParticipantAccount(deletedVoterAccountCtx)).toBe(true)

    expect(
      await prisma.discussionThread.findUnique({
        where: { id: thread!.id },
        select: { upvotes: true },
      })
    ).toEqual({ upvotes: 1 })
    expect(
      await prisma.discussionReply.findUnique({
        where: { id: reply!.id },
        select: { upvotes: true },
      })
    ).toEqual({ upvotes: 1 })
    expect(
      await prisma.discussionThreadVote.count({
        where: { threadId: thread!.id },
      })
    ).toBe(1)
    expect(
      await prisma.discussionReplyVote.count({
        where: { replyId: reply!.id },
      })
    ).toBe(1)
    await expect(
      prisma.participantGroup.findUnique({
        where: { id: soloGroup.id },
      })
    ).resolves.toBeNull()
    await expect(
      prisma.participantGroup.findUnique({
        where: { id: sharedGroup.id },
        include: {
          participants: {
            select: { id: true },
          },
        },
      })
    ).resolves.toMatchObject({
      participants: [{ id: survivingVoterId }],
    })
  })

  it('serializes a thread upvote with participant account deletion', async () => {
    const { prisma, userOneCtx } = getContext()
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, { courseId: course.id })

    const authorId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const survivingVoterId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const deletedVoterId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const authorCtx = createParticipantContext(userOneCtx, authorId)
    const survivingVoterCtx = createParticipantContext(
      userOneCtx,
      survivingVoterId
    )
    const deletedVoterCtx = createParticipantContext(userOneCtx, deletedVoterId)
    const deletedVoterAccountCtx = {
      ...deletedVoterCtx,
      res: {
        ...deletedVoterCtx.res,
        cookie: () => undefined,
      },
    } as unknown as ContextWithUser

    const thread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'A thread used to race an upvote with account deletion.',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      authorCtx
    )

    await toggleCourseDiscussionThreadUpvote(
      { threadId: thread!.id, upvote: true },
      survivingVoterCtx
    )

    const participantLock = await holdParticipantVoteLock(
      prisma,
      deletedVoterId
    )
    let accountDeletion!: Promise<boolean>
    let threadUpvote!: ReturnType<typeof toggleCourseDiscussionThreadUpvote>
    const queuedOperations: Promise<unknown>[] = []
    try {
      accountDeletion = deleteParticipantAccount(deletedVoterAccountCtx)
      queuedOperations.push(accountDeletion)
      await waitForParticipantLockWaiters(prisma, 1)

      threadUpvote = toggleCourseDiscussionThreadUpvote(
        { threadId: thread!.id, upvote: true },
        deletedVoterCtx
      )
      queuedOperations.push(threadUpvote)
      await waitForParticipantLockWaiters(prisma, 2)
    } finally {
      participantLock.release()
      const [lockResult] = await Promise.allSettled([
        participantLock.transaction,
        ...queuedOperations,
      ])
      if (lockResult?.status === 'rejected') throw lockResult.reason
    }

    const [, deleted] = await Promise.all([threadUpvote, accountDeletion])

    expect(deleted).toBe(true)
    await expect(
      prisma.discussionThread.findUnique({
        where: { id: thread!.id },
        select: { upvotes: true },
      })
    ).resolves.toEqual({ upvotes: 1 })
    await expect(
      prisma.discussionThreadVote.count({
        where: { threadId: thread!.id },
      })
    ).resolves.toBe(1)
  })

  it('serializes a reply unvote with participant account deletion', async () => {
    const { prisma, userOneCtx } = getContext()
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, { courseId: course.id })

    const authorId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const survivingVoterId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const deletedVoterId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const authorCtx = createParticipantContext(userOneCtx, authorId)
    const survivingVoterCtx = createParticipantContext(
      userOneCtx,
      survivingVoterId
    )
    const deletedVoterCtx = createParticipantContext(userOneCtx, deletedVoterId)
    const deletedVoterAccountCtx = {
      ...deletedVoterCtx,
      res: {
        ...deletedVoterCtx.res,
        cookie: () => undefined,
      },
    } as unknown as ContextWithUser

    const thread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'A thread whose reply is used for an account deletion race.',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      authorCtx
    )
    const reply = await createCourseDiscussionReply(
      {
        courseId: course.id,
        threadId: thread!.id,
        content: 'A reply used to race an unvote with account deletion.',
      },
      authorCtx
    )
    await toggleCourseDiscussionReplyUpvote(
      { replyId: reply!.id, upvote: true },
      survivingVoterCtx
    )
    await toggleCourseDiscussionReplyUpvote(
      { replyId: reply!.id, upvote: true },
      deletedVoterCtx
    )

    const participantLock = await holdParticipantVoteLock(
      prisma,
      deletedVoterId
    )
    let replyUnvote!: ReturnType<typeof toggleCourseDiscussionReplyUpvote>
    let accountDeletion!: Promise<boolean>
    const queuedOperations: Promise<unknown>[] = []
    try {
      replyUnvote = toggleCourseDiscussionReplyUpvote(
        { replyId: reply!.id, upvote: false },
        deletedVoterCtx
      )
      queuedOperations.push(replyUnvote)
      await waitForParticipantLockWaiters(prisma, 1)

      accountDeletion = deleteParticipantAccount(deletedVoterAccountCtx)
      queuedOperations.push(accountDeletion)
      await waitForParticipantLockWaiters(prisma, 2)
    } finally {
      participantLock.release()
      const [lockResult] = await Promise.allSettled([
        participantLock.transaction,
        ...queuedOperations,
      ])
      if (lockResult?.status === 'rejected') throw lockResult.reason
    }

    const [, deleted] = await Promise.all([replyUnvote, accountDeletion])

    expect(deleted).toBe(true)
    await expect(
      prisma.discussionReply.findUnique({
        where: { id: reply!.id },
        select: { upvotes: true },
      })
    ).resolves.toEqual({ upvotes: 1 })
    await expect(
      prisma.discussionReplyVote.count({
        where: { replyId: reply!.id },
      })
    ).resolves.toBe(1)
  })

  it('atomically caps visible replies at fifty per thread', async () => {
    const { prisma, userOneCtx } = getContext()
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
          scopeId: thread!.scopeId,
          eventType: DiscussionEventType.REPLY_CREATED,
        },
      })
    ).toBe(2)
    expect(
      await prisma.discussionEvent.count({
        where: {
          scopeId: thread!.scopeId,
          eventType: DiscussionEventType.REPLY_DELETED,
        },
      })
    ).toBe(2)
  })
}
