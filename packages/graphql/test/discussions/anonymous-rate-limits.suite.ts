import {
  DiscussionEventType,
  DiscussionScopeType,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import {
  createCourseDiscussionThread,
  generateCourseDiscussionEmbeddingInfo,
} from '../../src/services/discussions.js'
import { hashAnonymousFingerprint } from '../../src/services/discussions/embeds.js'
import { seedCourse } from '../helpers.js'
import type { DiscussionTestContext } from './fixtures.js'
import { createAnonymousContext, enableCourseDiscussion } from './fixtures.js'

export function registerAnonymousRateLimitsSuite(
  getContext: () => DiscussionTestContext
) {
  it('uses the proxy-normalized request IP instead of a raw forwarded header', () => {
    const { userOneCtx } = getContext()
    const normalizedContext = createAnonymousContext(userOneCtx, {
      ip: '203.0.113.10',
    })
    const otherClientContext = createAnonymousContext(userOneCtx, {
      ip: '203.0.113.11',
    })
    const normalizedFingerprint = hashAnonymousFingerprint(
      normalizedContext,
      'course-id'
    )

    normalizedContext.req.headers['x-forwarded-for'] = '198.51.100.20'

    expect(hashAnonymousFingerprint(normalizedContext, 'course-id')).toBe(
      normalizedFingerprint
    )
    expect(normalizedFingerprint).not.toBe(
      hashAnonymousFingerprint(otherClientContext, 'course-id')
    )
  })

  it('rejects anonymous posting when embed token scope does not match', async () => {
    const { prisma, userOneCtx } = getContext()
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, {
      courseId: course.id,
      allowAnonymous: true,
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    const embedInfo = await generateCourseDiscussionEmbeddingInfo(
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
    const embedUrl = new URL(embedInfo!.embedUrl, 'https://pwa.example.test')
    expect(embedUrl.searchParams.has('embedToken')).toBe(false)
    expect(new URLSearchParams(embedUrl.hash.slice(1)).get('embedToken')).toBe(
      embedInfo!.embedToken
    )

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

  it('records only the first anonymous rejection in a rate-limit window', async () => {
    const { prisma, userOneCtx } = getContext()
    const course = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, {
      courseId: course.id,
      allowAnonymous: true,
    })
    await recomputeDerivedPermissions({ courseId: course.id }, prisma)

    const embedInfo = await generateCourseDiscussionEmbeddingInfo(
      {
        courseId: course.id,
        externalBlock: {
          externalSource: 'lms',
          externalRef: 'rate-limited-block',
        },
        allowAnonymous: true,
      },
      userOneCtx
    )
    expect(embedInfo).toBeTruthy()

    const anonymousCtx = createAnonymousContext(userOneCtx)
    const createAnonymousThread = () =>
      createCourseDiscussionThread(
        {
          courseId: course.id,
          content: 'Anonymous question',
          scope: {
            scopeType: DiscussionScopeType.EXTERNAL_BLOCK,
            externalSource: 'lms',
            externalRef: 'rate-limited-block',
          },
          isAnonymous: true,
          embedToken: embedInfo!.embedToken,
        },
        anonymousCtx
      )

    const staleCounterKey = `discussion:anon:course:${course.id}:${hashAnonymousFingerprint(anonymousCtx, course.id)}`
    await anonymousCtx.redisExec.set(staleCounterKey, '1')
    expect(await anonymousCtx.redisExec.ttl(staleCounterKey)).toBe(-1)

    expect(await createAnonymousThread()).toBeTruthy()
    const counterKeys = await anonymousCtx.redisExec.keys(
      `discussion:anon:*:${course.id}:*`
    )
    expect(counterKeys).toHaveLength(3)
    const counterTtls = await Promise.all(
      counterKeys.map((key) => anonymousCtx.redisExec.ttl(key))
    )
    expect(counterTtls.every((ttl) => ttl > 0)).toBe(true)

    const persistedScope = await prisma.discussionScope.findFirstOrThrow({
      where: {
        space: { courseId: course.id },
        scopeKey: 'ext:lms:rate-limited-block',
      },
      select: {
        updatedAt: true,
        space: { select: { updatedAt: true } },
      },
    })
    expect(await createAnonymousThread()).toBeNull()
    expect(await createAnonymousThread()).toBeNull()

    const unchangedScope = await prisma.discussionScope.findFirstOrThrow({
      where: {
        space: { courseId: course.id },
        scopeKey: 'ext:lms:rate-limited-block',
      },
      select: {
        updatedAt: true,
        space: { select: { updatedAt: true } },
      },
    })
    expect(unchangedScope).toEqual(persistedScope)

    let rateLimitEvents = await prisma.discussionEvent.findMany({
      where: {
        eventType: DiscussionEventType.ANON_RATE_LIMITED,
        scope: { space: { courseId: course.id } },
      },
      select: { metadata: true },
    })

    expect(rateLimitEvents).toHaveLength(1)
    expect(rateLimitEvents[0]?.metadata).toMatchObject({
      reason: 'scope_window',
      limit: 1,
      ttlSec: 90,
    })

    const [scopeCounterKey] = await anonymousCtx.redisExec.keys(
      `discussion:anon:scope:${course.id}:*`
    )
    expect(scopeCounterKey).toBeDefined()
    await anonymousCtx.redisExec.expire(scopeCounterKey!, 1)
    await new Promise((resolve) => setTimeout(resolve, 1100))

    expect(await createAnonymousThread()).toBeTruthy()
    expect(await createAnonymousThread()).toBeNull()

    rateLimitEvents = await prisma.discussionEvent.findMany({
      where: {
        eventType: DiscussionEventType.ANON_RATE_LIMITED,
        scope: { space: { courseId: course.id } },
      },
      select: { metadata: true },
    })
    expect(rateLimitEvents).toHaveLength(2)
  })

  it('bounds anonymous course rate-limit events', async () => {
    const { prisma, userOneCtx } = getContext()
    const courseWindowCourse = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, {
      courseId: courseWindowCourse.id,
      allowAnonymous: true,
    })
    await recomputeDerivedPermissions(
      { courseId: courseWindowCourse.id },
      prisma
    )

    const courseWindowCtx = createAnonymousContext(userOneCtx)
    const courseWindowResults: Array<
      Awaited<ReturnType<typeof createCourseDiscussionThread>>
    > = []
    for (let index = 0; index < 8; index++) {
      const embedInfo = await generateCourseDiscussionEmbeddingInfo(
        {
          courseId: courseWindowCourse.id,
          externalBlock: {
            externalSource: 'lms',
            externalRef: `course-window-${index}`,
          },
          allowAnonymous: true,
        },
        userOneCtx
      )

      courseWindowResults.push(
        await createCourseDiscussionThread(
          {
            courseId: courseWindowCourse.id,
            content: `Course-window question ${index}`,
            scope: {
              scopeType: DiscussionScopeType.EXTERNAL_BLOCK,
              externalSource: 'lms',
              externalRef: `course-window-${index}`,
            },
            isAnonymous: true,
            embedToken: embedInfo!.embedToken,
          },
          courseWindowCtx
        )
      )
    }

    expect(courseWindowResults.filter(Boolean)).toHaveLength(6)
    expect(
      await prisma.discussionEvent.findMany({
        where: {
          eventType: DiscussionEventType.ANON_RATE_LIMITED,
          scope: { space: { courseId: courseWindowCourse.id } },
        },
        select: { metadata: true },
      })
    ).toEqual([
      {
        metadata: {
          reason: 'course_window',
          limit: 6,
          ttlSec: 3600,
        },
      },
    ])
  })

  it('bounds anonymous IP rate-limit events', async () => {
    const { prisma, userOneCtx } = getContext()
    const ipWindowCourse = await seedCourse({}, userOneCtx)
    await enableCourseDiscussion(prisma, {
      courseId: ipWindowCourse.id,
      allowAnonymous: true,
    })
    await recomputeDerivedPermissions({ courseId: ipWindowCourse.id }, prisma)
    const ipWindowEmbed = await generateCourseDiscussionEmbeddingInfo(
      {
        courseId: ipWindowCourse.id,
        externalBlock: {
          externalSource: 'lms',
          externalRef: 'ip-window',
        },
        allowAnonymous: true,
      },
      userOneCtx
    )

    const ipWindowResults: Array<
      Awaited<ReturnType<typeof createCourseDiscussionThread>>
    > = []
    for (let index = 0; index < 22; index++) {
      const anonymousCtx = createAnonymousContext(userOneCtx, {
        ip: '192.0.2.1',
        userAgent: `vitest-ip-window-${index}`,
      })
      ipWindowResults.push(
        await createCourseDiscussionThread(
          {
            courseId: ipWindowCourse.id,
            content: `IP-window question ${index}`,
            scope: {
              scopeType: DiscussionScopeType.EXTERNAL_BLOCK,
              externalSource: 'lms',
              externalRef: 'ip-window',
            },
            isAnonymous: true,
            embedToken: ipWindowEmbed!.embedToken,
          },
          anonymousCtx
        )
      )
    }

    expect(ipWindowResults.filter(Boolean)).toHaveLength(20)
    expect(
      await prisma.discussionEvent.findMany({
        where: {
          eventType: DiscussionEventType.ANON_RATE_LIMITED,
          scope: { space: { courseId: ipWindowCourse.id } },
        },
        select: { metadata: true },
      })
    ).toEqual([
      {
        metadata: {
          reason: 'ip_window',
          limit: 20,
          ttlSec: 3600,
        },
      },
    ])
  })
}
