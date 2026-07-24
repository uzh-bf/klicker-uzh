import {
  DiscussionEventType,
  DiscussionScopeType,
} from '@klicker-uzh/prisma/client'
import {
  createCourseDiscussionReply,
  createCourseDiscussionThread,
  deleteCourseDiscussionReply,
  deleteCourseDiscussionThread,
} from '../../src/services/discussions.js'
import { seedCourse } from '../helpers.js'
import type { DiscussionTestContext } from './fixtures.js'
import {
  createParticipantContext,
  enableCourseDiscussion,
  runTwiceConcurrently,
  seedParticipantInCourse,
} from './fixtures.js'

export function registerDeletionPolicySuite(
  getContext: () => DiscussionTestContext
) {
  it('keeps delete operations behind both course discussion gates', async () => {
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
        content: 'Deletion must fail closed.',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      participantCtx
    )
    const reply = await createCourseDiscussionReply(
      {
        courseId: course.id,
        threadId: thread!.id,
        content: 'Reply deletion must fail closed too.',
      },
      participantCtx
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
        await deleteCourseDiscussionReply(
          { replyId: reply!.id },
          participantCtx
        )
      ).toBe(false)
      expect(
        await deleteCourseDiscussionThread(
          { threadId: thread!.id },
          participantCtx
        )
      ).toBe(false)
    }

    expect(
      await prisma.discussionThread.findUnique({
        where: { id: thread!.id },
        select: { isDeleted: true },
      })
    ).toEqual({ isDeleted: false })
    expect(
      await prisma.discussionReply.findUnique({
        where: { id: reply!.id },
        select: { isDeleted: true },
      })
    ).toEqual({ isDeleted: false })
  })

  it('uses explicit delete events and enforces delete authorization', async () => {
    const { prisma, userOneCtx } = getContext()
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

    const threadDeleteResults = await runTwiceConcurrently(() =>
      deleteCourseDiscussionThread({ threadId: thread!.id }, authorCtx)
    )
    expect(threadDeleteResults.filter(Boolean)).toHaveLength(1)

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
    expect(
      deleteEvents.filter(
        (event) => event.eventType === DiscussionEventType.THREAD_DELETED
      )
    ).toHaveLength(1)
  })

  it('keeps concurrent thread and reply deletion atomic', async () => {
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
        content: 'Delete the thread and reply concurrently.',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      participantCtx
    )
    const reply = await createCourseDiscussionReply(
      {
        courseId: course.id,
        threadId: thread!.id,
        content: 'This reply must be deleted consistently.',
      },
      participantCtx
    )

    const [threadDeleted, replyDeleted] = await Promise.all([
      deleteCourseDiscussionThread({ threadId: thread!.id }, participantCtx),
      deleteCourseDiscussionReply({ replyId: reply!.id }, participantCtx),
    ])

    expect(threadDeleted).toBe(true)
    expect(
      await prisma.discussionThread.findUnique({
        where: { id: thread!.id },
        select: { isDeleted: true, replyCount: true },
      })
    ).toEqual({ isDeleted: true, replyCount: 0 })
    expect(
      await prisma.discussionReply.findUnique({
        where: { id: reply!.id },
        select: { isDeleted: true },
      })
    ).toEqual({ isDeleted: true })

    const replyDeleteEvents = await prisma.discussionEvent.count({
      where: {
        replyId: reply!.id,
        eventType: DiscussionEventType.REPLY_DELETED,
      },
    })
    expect(replyDeleteEvents).toBe(replyDeleted ? 1 : 0)
  })
}
