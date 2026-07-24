import { DiscussionScopeType } from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { v4 as uuidv4 } from 'uuid'
import {
  courseDiscussionThreads,
  createCourseDiscussionReply,
  createCourseDiscussionThread,
  getCourseDiscussionEmbeddingInfo,
  toggleCourseDiscussionReplyUpvote,
  toggleCourseDiscussionThreadUpvote,
} from '../../src/services/discussions.js'
import { seedCourse } from '../helpers.js'
import type { DiscussionTestContext } from './fixtures.js'
import {
  createAnonymousContext,
  createParticipantContext,
  enableCourseDiscussion,
  seedParticipantInCourse,
} from './fixtures.js'

export function registerGatesAndEmbedAccessSuite(
  getContext: () => DiscussionTestContext
) {
  it('keeps upvotes behind both course discussion gates', async () => {
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
    const { prisma, userOneCtx } = getContext()
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
    expect(threadPage.canPostIdentified).toBe(false)

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
    const { prisma, userOneCtx } = getContext()
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
    const participantEmbedPage = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: 'ext:lms:anonymous-enabled',
        embedToken: anonymousEmbedInfo!.embedToken,
      },
      participantCtx
    )

    expect(anonymousPage.canPostAnonymously).toBe(true)
    expect(anonymousPage.canPostIdentified).toBe(false)
    expect(identifiedOnlyPage.canPostAnonymously).toBe(false)
    expect(identifiedOnlyPage.canPostIdentified).toBe(false)
    expect(participantEmbedPage.canPostAnonymously).toBe(true)
    expect(participantEmbedPage.canPostIdentified).toBe(true)
  })

  it('hides anonymous posting when an embed scope key is tampered with', async () => {
    const { prisma, userOneCtx } = getContext()
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
    const { prisma, userOneCtx } = getContext()
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
    const { prisma, userOneCtx } = getContext()
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
    const { prisma, userOneCtx } = getContext()
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

  it('does not recreate a deleted scope for a stale anonymous embed token', async () => {
    const { prisma, userOneCtx } = getContext()
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
          externalRef: 'deleted-block',
        },
        allowAnonymous: true,
      },
      userOneCtx
    )
    expect(embedInfo).toBeTruthy()

    await prisma.discussionSpace.delete({
      where: { courseId: course.id },
    })

    const stalePageWithoutSpace = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: embedInfo!.scopeKey,
        embedToken: embedInfo!.embedToken,
      },
      createAnonymousContext(userOneCtx)
    )
    expect(stalePageWithoutSpace.isAccessible).toBe(false)
    expect(stalePageWithoutSpace.canPostAnonymously).toBe(false)

    const replacementEmbedInfo = await getCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: 'lms',
          externalRef: 'deleted-block',
        },
        allowAnonymous: true,
      },
      userOneCtx
    )
    expect(replacementEmbedInfo).toBeTruthy()

    const stalePageWithReplacementSpace = await courseDiscussionThreads(
      {
        courseId: course.id,
        scopeKey: embedInfo!.scopeKey,
        embedToken: embedInfo!.embedToken,
      },
      createAnonymousContext(userOneCtx)
    )
    expect(stalePageWithReplacementSpace.isAccessible).toBe(false)
    expect(stalePageWithReplacementSpace.canPostAnonymously).toBe(false)

    const deniedThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'This stale embed request should be rejected',
        scope: {
          scopeType: DiscussionScopeType.EXTERNAL_BLOCK,
          externalSource: 'lms',
          externalRef: 'deleted-block',
        },
        isAnonymous: true,
        embedToken: embedInfo!.embedToken,
      },
      createAnonymousContext(userOneCtx)
    )

    expect(deniedThread).toBeNull()
    expect(
      await prisma.discussionSpace.findUnique({
        where: { courseId: course.id },
      })
    ).toBeTruthy()
  })

  it('does not create a discussion space before participant access is authorized', async () => {
    const { prisma, userOneCtx } = getContext()
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, { courseId: course.id })

    const participantId = uuidv4()
    await prisma.participant.create({
      data: {
        id: participantId,
        username: `participant-${participantId.slice(0, 8)}`,
        password: 'test-password',
      },
    })

    const deniedThread = await createCourseDiscussionThread(
      {
        courseId: course.id,
        content: 'This participant is not enrolled.',
        scope: { scopeType: DiscussionScopeType.COURSE },
      },
      createParticipantContext(userOneCtx, participantId)
    )

    expect(deniedThread).toBeNull()
    expect(
      await prisma.discussionSpace.findUnique({
        where: { courseId: course.id },
      })
    ).toBeNull()
  })
}
