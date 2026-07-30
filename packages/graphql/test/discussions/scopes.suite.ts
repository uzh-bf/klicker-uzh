import {
  DiscussionScopeType,
  ElementStackType,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import {
  courseDiscussionOverview,
  courseDiscussionThreads,
  createCourseDiscussionReply,
  createCourseDiscussionThread,
  getCourseDiscussionEmbeddingInfo,
  toggleCourseDiscussionThreadUpvote,
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

export function registerScopesSuite(getContext: () => DiscussionTestContext) {
  it('rejects oversized external identifiers instead of merging truncated scopes', async () => {
    const { prisma, userOneCtx } = getContext()
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, { courseId: course.id })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    const maxSource = 's'.repeat(100)
    const maxRef = 'r'.repeat(200)
    const collidingSource = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: `${maxSource}x`,
          externalRef: maxRef,
        },
      },
      userOneCtx
    )
    const collidingRef = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: maxSource,
          externalRef: `${maxRef}x`,
        },
      },
      userOneCtx
    )
    const malformedUnicode = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: '\ud800',
          externalRef: maxRef,
        },
      },
      userOneCtx
    )

    expect(collidingSource).toBeNull()
    expect(collidingRef).toBeNull()
    expect(malformedUnicode).toBeNull()
    await expect(
      prisma.discussionSpace.count({
        where: { courseId: course.id },
      })
    ).resolves.toBe(0)

    const validEmbed = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: maxSource,
          externalRef: maxRef,
        },
      },
      userOneCtx
    )
    expect(validEmbed).toBeTruthy()
    await expect(
      prisma.discussionScope.findMany({
        where: { space: { courseId: course.id } },
        select: {
          scopeKey: true,
          externalSource: true,
          externalRef: true,
        },
      })
    ).resolves.toEqual([
      {
        scopeKey: `ext:${maxSource}:${maxRef}`,
        externalSource: maxSource,
        externalRef: maxRef,
      },
    ])

    const participantId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    await prisma.discussionSpace.delete({
      where: { courseId: course.id },
    })

    const malformedPost = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'This malformed scope must not recreate its parent space.',
        scope: {
          scopeType: DiscussionScopeType.EXTERNAL_BLOCK,
          externalSource: '\ud800',
          externalRef: maxRef,
        },
        embedToken: validEmbed!.embedToken,
      },
      createParticipantContext(userOneCtx, participantId)
    )

    expect(malformedPost).toBeNull()
    await expect(
      prisma.discussionSpace.count({
        where: { courseId: course.id },
      })
    ).resolves.toBe(0)
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

  it('supports evaluated practice, microlearning, external, and course embed scopes', async () => {
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

    for (const stackType of [
      ElementStackType.PRACTICE_QUIZ,
      ElementStackType.MICROLEARNING,
    ] as const) {
      const seeded = await seedDiscussionStack(
        prisma,
        { courseId: course.id, stackType },
        userOneCtx
      )
      const customDisplayName =
        stackType === ElementStackType.PRACTICE_QUIZ ? 'Practice Stack 7' : null
      if (customDisplayName) {
        await prisma.elementStack.update({
          where: { id: seeded.stack.id },
          data: { displayName: customDisplayName },
        })
      }
      await seedStackEvaluation(prisma, {
        courseId: course.id,
        participantId,
        ...seeded,
      })

      const thread = await createCourseDiscussionThread(
        {
          courseId: course.id,
          content: `${stackType} stack thread`,
          scope: {
            scopeType: DiscussionScopeType.PRACTICE_STACK,
            stackId: seeded.stack.id,
          },
        },
        participantCtx
      )

      const expectedScopePresentation = {
        stackType,
        stackOrder: seeded.stack.order,
        stackDisplayName: customDisplayName,
      }
      expect(thread?.scope).toMatchObject({
        scopeType: DiscussionScopeType.PRACTICE_STACK,
        scopeKey: `stack:${seeded.stack.id}`,
        ...expectedScopePresentation,
      })

      const listedThreads = await courseDiscussionThreads(
        {
          courseId: course.id,
          scopeKey: `stack:${seeded.stack.id}`,
        },
        participantCtx
      )
      const listedScope = listedThreads.threads[0]?.scope
      expect(listedScope).toMatchObject(expectedScopePresentation)

      const upvotedThread = await toggleCourseDiscussionThreadUpvote(
        {
          threadId: thread!.id,
          upvote: true,
        },
        participantCtx
      )
      expect(upvotedThread?.scope).toMatchObject(expectedScopePresentation)
    }

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

    expect(externalThread?.scope.scopeType).toBe(
      DiscussionScopeType.EXTERNAL_BLOCK
    )
    expect(externalThread?.scope.scopeKey).toBe('ext:moodle:block-7')

    const courseEmbedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        allowAnonymous: true,
      },
      userOneCtx
    )
    expect(courseEmbedInfo?.scopeKey).toBe(`course:${course.id}`)

    const courseEmbedThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'Course embed thread',
        scope: { scopeType: DiscussionScopeType.COURSE },
        isAnonymous: true,
        embedToken: courseEmbedInfo!.embedToken,
      },
      createAnonymousContext(userOneCtx, {
        ip: '127.0.0.2',
      })
    )
    expect(courseEmbedThread?.scope.scopeType).toBe(DiscussionScopeType.COURSE)
  })

  it('keeps the discussion schema limited to the shipped alpha scope', async () => {
    const { prisma } = getContext()
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

    const redundantAncestryColumns = await prisma.$queryRaw<
      Array<{ table_name: string; column_name: string }>
    >`
      SELECT table_name::text, column_name::text
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'DiscussionThread' AND column_name = 'spaceId')
          OR (
            table_name = 'DiscussionReply'
            AND column_name IN ('spaceId', 'scopeId')
          )
          OR (
            table_name = 'DiscussionEvent'
            AND column_name IN ('spaceId', 'threadId', 'replyId')
          )
        )
    `

    expect(redundantAncestryColumns).toHaveLength(0)

    const discussionEventColumns = await prisma.$queryRaw<
      Array<{ column_name: string; is_nullable: string }>
    >`
      SELECT column_name::text, is_nullable::text
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'DiscussionEvent'
        AND column_name IN ('scopeId', 'subjectId')
      ORDER BY column_name
    `

    expect(discussionEventColumns).toEqual([
      { column_name: 'scopeId', is_nullable: 'NO' },
      { column_name: 'subjectId', is_nullable: 'YES' },
    ])

    const discussionEventSubjectConstraint = await prisma.$queryRaw<
      Array<{ definition: string }>
    >`
      SELECT pg_get_constraintdef(oid)::text AS definition
      FROM pg_constraint
      WHERE conname = 'DiscussionEvent_subjectId_check'
    `

    expect(discussionEventSubjectConstraint).toHaveLength(1)
    expect(discussionEventSubjectConstraint[0]?.definition).toContain(
      "'ANON_RATE_LIMITED'"
    )

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
}
