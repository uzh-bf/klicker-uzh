import * as DB from '@klicker-uzh/prisma/client'
import {
  buildCourseDiscussionScopeKey,
  parseCourseDiscussionScopeKey,
} from '@klicker-uzh/types'
import type { Context } from '../../lib/context.js'
import {
  canAccessCourseDiscussionScope,
  getCourseAccessActor,
  getCourseSettings,
  isCourseDiscussionEnabled,
} from './access.js'
import {
  rejectEmbedCourseMismatch,
  verifyEmbedScopeBinding,
  verifyEmbedToken,
} from './embeds.js'
import type { CourseDiscussionThreadsArgs, ResolvedActor } from './types.js'

interface CourseDiscussionReadContext {
  participantId: string | null
  canPostAnonymously: boolean
  canPostIdentified: boolean
  effectiveScopeKey: string
  space: DB.DiscussionSpace | null
}

export async function resolveCourseDiscussionReadContext(
  {
    courseId,
    scopeKey,
    embedToken,
  }: Pick<CourseDiscussionThreadsArgs, 'courseId' | 'scopeKey' | 'embedToken'>,
  ctx: Context
): Promise<CourseDiscussionReadContext | null> {
  const course = await getCourseSettings(courseId, ctx)
  if (!isCourseDiscussionEnabled(course)) {
    return null
  }

  const embedClaims = await verifyEmbedToken(embedToken)
  let actor: ResolvedActor | null = null

  if (!embedClaims) {
    actor = await getCourseAccessActor({ courseId }, ctx)
    if (!actor) {
      return null
    }
  } else if (
    embedClaims.spaceType !== DB.DiscussionSpaceType.COURSE ||
    rejectEmbedCourseMismatch(embedClaims, courseId)
  ) {
    return null
  }

  const participantActor = embedClaims
    ? await getCourseAccessActor({ courseId }, ctx)
    : actor
  const participantId = participantActor?.participantId ?? null
  const canPostIdentified = Boolean(participantId)
  const canPostAnonymously =
    !!embedClaims?.allowAnonymous && !!course.isCourseQAAnonymousEnabled
  const effectiveScopeKey =
    embedClaims?.scopeKey ?? scopeKey ?? buildCourseDiscussionScopeKey(courseId)
  const parsedScope = parseCourseDiscussionScopeKey(effectiveScopeKey)

  if (
    !parsedScope ||
    (parsedScope.kind === 'course' && parsedScope.courseId !== courseId) ||
    (embedClaims && scopeKey && scopeKey !== embedClaims.scopeKey) ||
    (parsedScope.kind === 'externalBlock' && !embedClaims)
  ) {
    return null
  }

  if (parsedScope.kind === 'practiceStack') {
    const participantCanAccess = await canAccessCourseDiscussionScope(
      {
        participantId,
        courseId,
        scope: {
          scopeType: DB.DiscussionScopeType.PRACTICE_STACK,
          stackId: parsedScope.stackId,
        },
      },
      ctx
    )

    if (!participantCanAccess) {
      return null
    }
  }

  const space = await ctx.prisma.discussionSpace.findUnique({
    where: {
      courseId,
    },
  })

  if (embedClaims) {
    const scopeExists = space
      ? await ctx.prisma.discussionScope.findUnique({
          where: {
            spaceId_scopeKey: {
              spaceId: space.id,
              scopeKey: effectiveScopeKey,
            },
          },
          select: { id: true },
        })
      : null
    const bindingIsValid =
      space &&
      scopeExists &&
      (await verifyEmbedScopeBinding(
        {
          embedClaims,
          expectedSpace: space,
          expectedScopeKey: effectiveScopeKey,
          requireAnonymous: false,
        },
        ctx
      ))

    if (!bindingIsValid) {
      return null
    }
  }

  return {
    participantId,
    canPostAnonymously,
    canPostIdentified,
    effectiveScopeKey,
    space,
  }
}
