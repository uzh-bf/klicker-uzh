import {
  DiscussionScopeType,
  ElementStackType,
} from '@klicker-uzh/prisma/client'
import {
  COURSE_QA_CONTENT_MAX_LENGTH,
  COURSE_QA_EXTERNAL_REF_MAX_LENGTH,
  COURSE_QA_EXTERNAL_SOURCE_MAX_LENGTH,
} from '@klicker-uzh/types'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { schema } from '../../src/index.js'
import {
  CourseDiscussionPostFailureCode,
  courseDiscussionThreads,
  createCourseDiscussionThread,
  generateCourseDiscussionEmbeddingInfo,
  toggleCourseDiscussionThreadUpvote,
} from '../../src/services/discussions.js'
import { seedCourse } from '../helpers.js'
import type { DiscussionTestContext } from './fixtures.js'
import {
  createAnonymousContext,
  createInvalidEmbedToken,
  createParticipantContext,
  enableCourseDiscussion,
  seedDiscussionStack,
  seedParticipantInCourse,
  seedStackEvaluation,
} from './fixtures.js'

export function registerScopesSuite(getContext: () => DiscussionTestContext) {
  it('exposes embed generation only as a validated mutation', async () => {
    const { prisma, userOneCtx, userTwoCtx } = getContext()
    const mutationFields = schema.getMutationType()?.getFields()
    const queryFields = schema.getQueryType()?.getFields()

    expect(queryFields?.getCourseDiscussionEmbeddingInfo).toBeUndefined()
    expect(mutationFields?.generateCourseDiscussionEmbeddingInfo).toBeDefined()

    const resolveEmbedMutation =
      mutationFields?.generateCourseDiscussionEmbeddingInfo?.resolve
    if (!resolveEmbedMutation) {
      throw new Error('Embed-generation mutation resolver is missing')
    }

    const initialSpaceCount = await prisma.discussionSpace.count()
    const invalidVariables = [
      {
        externalBlock: {
          externalSource: ' ',
          externalRef: 'block-1',
        },
        expiresInHours: 48,
      },
      {
        externalBlock: {
          externalSource: 'LMS',
          externalRef: ' ',
        },
        expiresInHours: 48,
      },
      {
        externalBlock: {
          externalSource: 'LMS',
          externalRef: 'x'.repeat(COURSE_QA_EXTERNAL_REF_MAX_LENGTH + 1),
        },
        expiresInHours: 48,
      },
      {
        externalBlock: {
          externalSource: 'x'.repeat(COURSE_QA_EXTERNAL_SOURCE_MAX_LENGTH + 1),
          externalRef: 'block-1',
        },
        expiresInHours: 48,
      },
      {
        externalBlock: {
          externalSource: 'LMS',
          externalRef: 'block-1',
        },
        expiresInHours: 0,
      },
      {
        externalBlock: {
          externalSource: 'LMS',
          externalRef: 'block-1',
        },
        expiresInHours: 337,
      },
    ]

    for (const variables of invalidVariables) {
      await expect(
        resolveEmbedMutation(
          {},
          {
            courseId: 'validation-only-course',
            ...variables,
          },
          userOneCtx,
          {} as never
        )
      ).rejects.toThrow()
    }

    expect(await prisma.discussionSpace.count()).toBe(initialSpaceCount)

    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, { courseId: course.id })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)
    const validArgs = {
      courseId: course.id,
      allowAnonymous: false,
      expiresInHours: 48,
    }

    await expect(
      resolveEmbedMutation(
        {},
        validArgs,
        createAnonymousContext(userOneCtx),
        {} as never
      )
    ).rejects.toThrow()
    await expect(
      resolveEmbedMutation(
        {},
        validArgs,
        createParticipantContext(userOneCtx, 'participant-auth-boundary'),
        {} as never
      )
    ).rejects.toThrow()
    await expect(
      resolveEmbedMutation({}, validArgs, userTwoCtx, {} as never)
    ).resolves.toBeNull()
    await expect(
      resolveEmbedMutation({}, validArgs, userOneCtx, {} as never)
    ).resolves.toMatchObject({
      courseId: course.id,
      scopeKey: `course:${course.id}`,
    })
    await expect(
      prisma.discussionSpace.count({
        where: { courseId: course.id },
      })
    ).resolves.toBe(1)
  })

  it('validates discussion posting inputs before service side effects', async () => {
    const { prisma, userOneCtx } = getContext()
    const mutationFields = schema.getMutationType()?.getFields()
    const resolveThreadMutation =
      mutationFields?.createCourseDiscussionThread?.resolve
    const resolveReplyMutation =
      mutationFields?.createCourseDiscussionReply?.resolve

    if (!resolveThreadMutation || !resolveReplyMutation) {
      throw new Error('Discussion posting mutation resolvers are missing')
    }

    const validThreadInput = {
      courseId: 'validation-only-course',
      content: 'Valid content',
      scope: { scopeType: DiscussionScopeType.COURSE },
    }
    const invalidThreadInputs = [
      { ...validThreadInput, courseId: ' ' },
      { ...validThreadInput, content: ' ' },
      {
        ...validThreadInput,
        content: 'x'.repeat(COURSE_QA_CONTENT_MAX_LENGTH + 1),
      },
      {
        ...validThreadInput,
        scope: {
          scopeType: DiscussionScopeType.PRACTICE_STACK,
          stackId: 0,
        },
      },
      {
        ...validThreadInput,
        scope: {
          scopeType: DiscussionScopeType.EXTERNAL_BLOCK,
          externalSource: ' ',
          externalRef: 'block-1',
        },
      },
      {
        ...validThreadInput,
        scope: {
          scopeType: DiscussionScopeType.EXTERNAL_BLOCK,
          externalSource: 'lms',
          externalRef: 'x'.repeat(COURSE_QA_EXTERNAL_REF_MAX_LENGTH + 1),
        },
      },
      { ...validThreadInput, embedToken: ' ' },
    ]

    for (const input of invalidThreadInputs) {
      await expect(
        resolveThreadMutation({}, { input }, userOneCtx, {} as never)
      ).rejects.toThrow()
    }

    const validReplyInput = {
      courseId: 'validation-only-course',
      threadId: 1,
      content: 'Valid reply',
    }
    const invalidReplyInputs = [
      { ...validReplyInput, courseId: ' ' },
      { ...validReplyInput, threadId: 0 },
      { ...validReplyInput, content: ' ' },
      {
        ...validReplyInput,
        content: 'x'.repeat(COURSE_QA_CONTENT_MAX_LENGTH + 1),
      },
      { ...validReplyInput, embedToken: ' ' },
    ]

    for (const input of invalidReplyInputs) {
      await expect(
        resolveReplyMutation({}, { input }, userOneCtx, {} as never)
      ).rejects.toThrow()
    }

    await expect(prisma.discussionSpace.count()).resolves.toBe(0)
    await expect(prisma.discussionThread.count()).resolves.toBe(0)
    await expect(prisma.discussionReply.count()).resolves.toBe(0)
  })

  it('returns typed posting results without exposing unavailable threads', async () => {
    const { prisma, userOneCtx } = getContext()
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, { courseId: course.id })
    const participantId = await seedParticipantInCourse(prisma, {
      courseId: course.id,
    })
    const participantCtx = createParticipantContext(userOneCtx, participantId)
    const mutationFields = schema.getMutationType()?.getFields()
    const resolveThreadMutation =
      mutationFields?.createCourseDiscussionThread?.resolve
    const resolveReplyMutation =
      mutationFields?.createCourseDiscussionReply?.resolve

    if (!resolveThreadMutation || !resolveReplyMutation) {
      throw new Error('Discussion posting mutation resolvers are missing')
    }

    await expect(
      resolveThreadMutation(
        {},
        {
          input: {
            courseId: course.id,
            content: 'Typed posting result',
            scope: { scopeType: DiscussionScopeType.COURSE },
          },
        },
        participantCtx,
        {} as never
      )
    ).resolves.toMatchObject({
      thread: {
        content: 'Typed posting result',
      },
      failureCode: null,
    })

    await expect(
      resolveThreadMutation(
        {},
        {
          input: {
            courseId: course.id,
            content: 'Invalid embed token',
            scope: { scopeType: DiscussionScopeType.COURSE },
            embedToken: await createInvalidEmbedToken(),
          },
        },
        participantCtx,
        {} as never
      )
    ).resolves.toEqual({
      thread: null,
      failureCode: CourseDiscussionPostFailureCode.INVALID_EMBED,
    })

    await expect(
      resolveReplyMutation(
        {},
        {
          input: {
            courseId: course.id,
            threadId: 2_147_483_647,
            content: 'Unavailable thread reply',
          },
        },
        participantCtx,
        {} as never
      )
    ).resolves.toEqual({
      reply: null,
      failureCode: CourseDiscussionPostFailureCode.THREAD_UNAVAILABLE,
    })
  })

  it('rejects oversized external identifiers instead of merging truncated scopes', async () => {
    const { prisma, userOneCtx } = getContext()
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, { courseId: course.id })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    const maxSource = 's'.repeat(COURSE_QA_EXTERNAL_SOURCE_MAX_LENGTH)
    const maxRef = 'r'.repeat(COURSE_QA_EXTERNAL_REF_MAX_LENGTH)
    const collidingSource = await generateCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: `${maxSource}x`,
          externalRef: maxRef,
        },
      },
      userOneCtx
    )
    const collidingRef = await generateCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: maxSource,
          externalRef: `${maxRef}x`,
        },
      },
      userOneCtx
    )
    const malformedUnicode = await generateCourseDiscussionEmbeddingInfo(
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

    const validEmbed = await generateCourseDiscussionEmbeddingInfo(
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

    const embedInfo = await generateCourseDiscussionEmbeddingInfo(
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

    const courseEmbedInfo = await generateCourseDiscussionEmbeddingInfo(
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
}
