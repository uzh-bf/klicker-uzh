import * as DB from '@klicker-uzh/prisma/client'
import type { Context } from '../../lib/context.js'
import {
  canParticipantAccessDiscussionScope,
  getCourseAccessActor,
  getCourseSettings,
  isCourseDiscussionEnabled,
} from './access.js'
import {
  rejectEmbedCourseMismatch,
  verifyEmbedScopeBinding,
  verifyEmbedToken,
} from './embeds.js'
import { isSupportedCourseScopeKey } from './model.js'
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
    embedClaims?.scopeKey ?? scopeKey ?? `course:${courseId}`

  if (
    !isSupportedCourseScopeKey(courseId, effectiveScopeKey) ||
    (embedClaims && scopeKey && scopeKey !== embedClaims.scopeKey) ||
    (effectiveScopeKey.startsWith('ext:') && !embedClaims)
  ) {
    return null
  }

  const stackScopeMatch = effectiveScopeKey.match(/^stack:(\d+)$/)
  if (stackScopeMatch) {
    const stackId = Number.parseInt(stackScopeMatch[1] ?? '', 10)
    const stack = await ctx.prisma.elementStack.findFirst({
      where: {
        id: stackId,
        OR: [
          { courseId },
          { practiceQuiz: { courseId } },
          { microLearning: { courseId } },
        ],
      },
      select: { id: true },
    })
    const participantCanAccess = await canParticipantAccessDiscussionScope(
      {
        participantId,
        courseId,
        scope: {
          scopeType: DB.DiscussionScopeType.PRACTICE_STACK,
          stackId,
        },
      },
      ctx
    )

    if (!stack || !participantCanAccess) {
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
