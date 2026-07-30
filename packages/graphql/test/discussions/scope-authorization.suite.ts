import {
  DiscussionScopeType,
  ElementStackType,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import {
  CourseDiscussionPostFailureCode,
  courseDiscussionOverview,
  courseDiscussionThreads,
  createCourseDiscussionReply,
  createCourseDiscussionReplyResult,
  createCourseDiscussionThread,
  generateCourseDiscussionEmbeddingInfo,
} from '../../src/services/discussions.js'
import { seedCourse } from '../helpers.js'
import type { DiscussionTestContext } from './fixtures.js'
import {
  createAnonymousContext,
  createParticipantContext,
  enableCourseDiscussion,
  expectStackOperationsDenied,
  seedDiscussionStack,
  seedParticipantInCourse,
  seedStackEvaluation,
} from './fixtures.js'

export function registerScopeAuthorizationSuite(
  getContext: () => DiscussionTestContext
) {
  it('keeps unauthorized reply probes indistinguishable', async () => {
    const { prisma, userOneCtx } = getContext()
    const course = await seedCourse({}, userOneCtx)
    const otherCourse = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, { courseId: course.id })
    await enableCourseDiscussion(prisma, { courseId: otherCourse.id })

    const participantId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const participantCtx = createParticipantContext(userOneCtx, participantId)
    const otherParticipantId = await seedParticipantInCourse(prisma, {
      courseId: otherCourse.id,
    })
    const otherParticipantCtx = createParticipantContext(
      userOneCtx,
      otherParticipantId
    )

    const activeThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'Existing thread',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      participantCtx
    )
    const deletedThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'Deleted thread',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      participantCtx
    )
    const cappedThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'Capped thread',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      participantCtx
    )
    const otherCourseThread = await createCourseDiscussionThread(
      {
        courseId: otherCourse.id,
        content: 'Other course thread',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      otherParticipantCtx
    )

    if (
      !activeThread ||
      !deletedThread ||
      !cappedThread ||
      !otherCourseThread
    ) {
      throw new Error('Reply probe fixtures could not be created')
    }

    await prisma.discussionThread.update({
      where: { id: deletedThread.id },
      data: { isDeleted: true },
    })
    await prisma.discussionThread.update({
      where: { id: cappedThread.id },
      data: { replyCount: 50 },
    })

    const anonymousCtx = createAnonymousContext(userOneCtx)
    const probeThreadIds = [
      2_147_483_647,
      activeThread.id,
      deletedThread.id,
      cappedThread.id,
      otherCourseThread.id,
    ]

    for (const isAnonymous of [false, true]) {
      for (const threadId of probeThreadIds) {
        await expect(
          createCourseDiscussionReplyResult(
            {
              courseId: course.id,
              threadId,
              content: 'Unauthorized reply probe',
              isAnonymous,
            },
            anonymousCtx
          )
        ).resolves.toEqual({
          reply: null,
          failureCode: CourseDiscussionPostFailureCode.THREAD_UNAVAILABLE,
        })
      }
    }
  })

  it('gates activity-agnostic stack discussions on participant evaluation', async () => {
    const { prisma, userOneCtx } = getContext()
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

    const practice = await seedDiscussionStack(
      prisma,
      {
        courseId: course.id,
        stackType: ElementStackType.PRACTICE_QUIZ,
      },
      userOneCtx
    )
    const practiceStack = practice.stack

    await expectStackOperationsDenied(
      {
        courseId: course.id,
        stackId: practiceStack.id,
      },
      participantCtx
    )

    expect(
      await prisma.discussionSpace.count({
        where: { courseId: course.id },
      })
    ).toBe(0)

    await seedStackEvaluation(prisma, {
      courseId: course.id,
      participantId,
      ...practice,
      elementIndexes: [0],
    })

    await expectStackOperationsDenied(
      {
        courseId: course.id,
        stackId: practiceStack.id,
      },
      participantCtx
    )
    expect(
      await prisma.discussionSpace.count({
        where: { courseId: course.id },
      })
    ).toBe(0)

    await seedStackEvaluation(prisma, {
      courseId: course.id,
      participantId,
      ...practice,
      elementIndexes: [1],
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

    const stackReply = await createCourseDiscussionReply(
      {
        courseId: course.id,
        threadId: stackThread!.id,
        content: 'Practice stack reply',
      },
      participantCtx
    )
    expect(stackReply).toBeTruthy()

    await prisma.questionResponse.deleteMany({
      where: {
        participantId,
        elementInstance: { elementStackId: practiceStack.id },
      },
    })

    await expectStackOperationsDenied(
      {
        courseId: course.id,
        stackId: practiceStack.id,
        threadId: stackThread!.id,
        replyId: stackReply!.id,
      },
      participantCtx
    )
  })

  it('limits participantless staff stack reads to the owning course', async () => {
    const { prisma, userOneCtx } = getContext()
    const course = await seedCourse({}, userOneCtx)
    const otherCourse = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, { courseId: course.id })
    await enableCourseDiscussion(prisma, { courseId: otherCourse.id })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    await recomputeDerivedPermissions({ courseId: otherCourse.id }, prisma)

    const participantId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const participantCtx = createParticipantContext(userOneCtx, participantId)
    const sameCourseStack = await seedDiscussionStack(
      prisma,
      {
        courseId: course.id,
        stackType: ElementStackType.PRACTICE_QUIZ,
      },
      userOneCtx
    )
    const otherCourseStack = await seedDiscussionStack(
      prisma,
      {
        courseId: otherCourse.id,
        stackType: ElementStackType.PRACTICE_QUIZ,
      },
      userOneCtx
    )
    await seedStackEvaluation(prisma, {
      courseId: course.id,
      participantId,
      ...sameCourseStack,
    })

    const thread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'Staff-visible stack thread',
        scope: {
          scopeType: DiscussionScopeType.PRACTICE_STACK,
          stackId: sameCourseStack.stack.id,
        },
      },
      participantCtx
    )
    expect(thread).toBeTruthy()

    const sameCoursePage = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: `stack:${sameCourseStack.stack.id}`,
      },
      userOneCtx
    )
    expect(sameCoursePage.isAccessible).toBe(true)
    expect(sameCoursePage.threads.map(({ content }) => content)).toContain(
      'Staff-visible stack thread'
    )

    const foreignCoursePage = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: `stack:${otherCourseStack.stack.id}`,
      },
      userOneCtx
    )
    expect(foreignCoursePage.isAccessible).toBe(false)
    expect(foreignCoursePage.threads).toHaveLength(0)
  })

  it('keeps default thread listing course-only even when other scopes exist', async () => {
    const { prisma, userOneCtx } = getContext()
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

    const practice = await seedDiscussionStack(
      prisma,
      {
        courseId: course.id,
        stackType: ElementStackType.PRACTICE_QUIZ,
      },
      userOneCtx
    )
    await seedStackEvaluation(prisma, {
      courseId: course.id,
      participantId,
      ...practice,
    })
    const practiceStack = practice.stack

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

    const externalEmbedInfo = await generateCourseDiscussionEmbeddingInfo(
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
}
