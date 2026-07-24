import {
  DiscussionEventType,
  DiscussionScopeType,
} from '@klicker-uzh/prisma/client'
import {
  courseDiscussionThreads,
  createCourseDiscussionReply,
  createCourseDiscussionThread,
  deleteCourseDiscussionReply,
  toggleCourseDiscussionReplyUpvote,
  toggleCourseDiscussionThreadUpvote,
} from '../../src/services/discussions.js'
import { seedCourse } from '../helpers.js'
import type { DiscussionTestContext } from './fixtures.js'
import {
  createParticipantContext,
  enableCourseDiscussion,
  runTwiceConcurrently,
  seedParticipantInCourse,
} from './fixtures.js'

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
          threadId: thread!.id,
          eventType: DiscussionEventType.THREAD_UPVOTED,
        },
      })
    ).toBe(1)
    expect(
      await prisma.discussionEvent.count({
        where: {
          replyId: reply!.id,
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
}
