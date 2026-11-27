import * as DB from '@klicker-uzh/prisma/client'
import type { ActivityArtifactPin } from '@klicker-uzh/types'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import {
  ActivityArtifactRequestError,
  type ActivityArtifactRevision,
  type ActivityArtifactRuntime,
  isActivityArtifactId,
  parseCanonicalArtifactUrl,
  sanitizeActivityArtifactPin,
  validateActivityArtifactExercise,
} from '../lib/activityArtifacts.js'
import type { ContextWithUser } from '../lib/context.js'
import {
  isParticipantFeatureFlagEnabled,
  requireFeatureFlagAccess,
} from '../lib/featureFlags.js'

export type ClientActivityArtifact = ActivityArtifactRevision & {
  // Fixed trusted renderer on the configured publisher origin. No token or
  // artifact data travels in the frame URL.
  frameUrl: string
}

function toClientActivityArtifact(
  runtime: ActivityArtifactRuntime,
  revision: ActivityArtifactRevision
): ClientActivityArtifact {
  return { ...revision, frameUrl: `${runtime.frameOrigin}/frame` }
}

function toArtifactGraphQLError(error: unknown): GraphQLError {
  if (error instanceof GraphQLError) return error

  if (
    error instanceof ActivityArtifactRequestError &&
    typeof error.status === 'number' &&
    [400, 403, 404, 409, 422].includes(error.status)
  ) {
    return new GraphQLError('Artifact link is not available', {
      extensions: { code: 'BAD_USER_INPUT' },
    })
  }

  console.warn(
    '[activity-artifacts] publisher request failed',
    error instanceof Error ? error.message : 'unknown error'
  )
  return new GraphQLError('Artifact service is temporarily unavailable', {
    extensions: { code: 'SERVICE_UNAVAILABLE' },
  })
}

async function requireArtifactRuntime(ctx: ContextWithUser) {
  await requireFeatureFlagAccess(ctx, 'activity-artifacts')

  const runtime = ctx.activityArtifactRuntime
  if (!runtime) {
    throw new GraphQLError('Activity artifacts are not configured', {
      extensions: { code: 'SERVICE_UNAVAILABLE' },
    })
  }

  return runtime
}

/**
 * Lecturer lookup of the latest authorized revision for a canonical author
 * link. The mapped lecturer subject is the immutable account id, never input
 * from the browser.
 */
export async function previewActivityArtifactByUrl(
  { url }: { url: string },
  ctx: ContextWithUser
): Promise<ClientActivityArtifact> {
  const runtime = await requireArtifactRuntime(ctx)

  const parsed = parseCanonicalArtifactUrl(url, runtime.publisherOrigin)
  if (!parsed) {
    throw new GraphQLError('Invalid artifact link', {
      extensions: { code: 'BAD_USER_INPUT' },
    })
  }

  let revision: ActivityArtifactRevision
  try {
    revision = await runtime.getLatest({
      subject: ctx.user.sub,
      artifactId: parsed.artifactId,
    })
  } catch (error) {
    throw toArtifactGraphQLError(error)
  }

  return toClientActivityArtifact(runtime, revision)
}

/**
 * Staff lookup for the canonical author landing page. The publisher receives
 * the linked lecturer as `X-Artifact-Subject`; the browser never supplies it.
 */
export async function resolveStaffActivityArtifact(
  { artifactId }: { artifactId: string },
  ctx: ContextWithUser
): Promise<ClientActivityArtifact> {
  const runtime = await requireArtifactRuntime(ctx)

  if (!isActivityArtifactId(artifactId)) {
    throw new GraphQLError('Invalid artifact link', {
      extensions: { code: 'BAD_USER_INPUT' },
    })
  }

  let revision: ActivityArtifactRevision
  try {
    revision = await runtime.getLatest({
      subject: ctx.user.sub,
      artifactId,
    })
  } catch (error) {
    throw toArtifactGraphQLError(error)
  }

  return toClientActivityArtifact(runtime, revision)
}

/**
 * Confirms an attach or explicit upgrade. The exact revision the lecturer
 * reviewed is re-resolved from the publisher, so a preview that raced with a
 * newer revision can never pin the wrong one.
 */
export async function resolveContentArtifactPin(
  {
    url,
    artifactId,
    revisionId,
  }: { url: string; artifactId: string; revisionId: string },
  ctx: ContextWithUser
): Promise<ActivityArtifactPin> {
  const runtime = await requireArtifactRuntime(ctx)

  const parsed = parseCanonicalArtifactUrl(url, runtime.publisherOrigin)
  if (
    !parsed ||
    parsed.artifactId !== artifactId ||
    !isActivityArtifactId(revisionId)
  ) {
    throw new GraphQLError('Invalid artifact link', {
      extensions: { code: 'BAD_USER_INPUT' },
    })
  }

  let revision: ActivityArtifactRevision
  try {
    revision = await runtime.getRevision({
      subject: ctx.user.sub,
      artifactId,
      revisionId,
    })
  } catch (error) {
    throw toArtifactGraphQLError(error)
  }

  return { ...revision, subject: ctx.user.sub }
}

async function lecturerStillOwnsMicrolearning(
  ctx: ContextWithUser,
  microLearningId: string,
  lecturerSubject: string
) {
  const permission = await ctx.prisma.derivedPermission.findFirst({
    where: {
      userId: lecturerSubject,
      microLearningId,
      permissionLevel: {
        in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
      },
    },
    select: { id: true },
  })

  return permission !== null
}

/**
 * Placement and publication must fail before participants receive a silent
 * null when the stored pin names a lecturer who cannot administer the target
 * activity.
 */
export async function assertActivityArtifactPinsAccessible(
  microLearningId: string,
  prisma: Pick<PrismaTransactionClient, 'derivedPermission' | 'elementInstance'>
) {
  const instances = await prisma.elementInstance.findMany({
    where: {
      elementType: DB.ElementType.CONTENT,
      elementStack: { microLearningId },
      elementData: {
        path: ['options', 'activityArtifact'],
        not: DB.Prisma.DbNull,
      },
    },
    select: { elementData: true },
  })

  const pinSubjects = new Set<string>()
  for (const instance of instances) {
    const elementData = instance.elementData as {
      options?: { activityArtifact?: unknown }
    } | null
    const pin = sanitizeActivityArtifactPin(
      elementData?.options?.activityArtifact
    )
    if (pin) pinSubjects.add(pin.subject)
  }

  await assertPinSubjectsAccessible(
    [...pinSubjects].map((subject) => ({ microLearningId, subject })),
    prisma
  )
}

async function assertPinSubjectsAccessible(
  requirements: { microLearningId: string; subject: string }[],
  prisma: Pick<PrismaTransactionClient, 'derivedPermission'>
) {
  if (requirements.length === 0) return

  const activityIds = [
    ...new Set(requirements.map(({ microLearningId }) => microLearningId)),
  ]
  const subjects = [...new Set(requirements.map(({ subject }) => subject))]

  const permissions = await prisma.derivedPermission.findMany({
    where: {
      userId: { in: subjects },
      microLearningId: { in: activityIds },
      permissionLevel: {
        in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
      },
    },
    select: { userId: true, microLearningId: true },
  })
  const permitted = new Map<string, Set<string>>()
  for (const { userId, microLearningId } of permissions) {
    if (!userId || !microLearningId) continue
    const permittedSubjects =
      permitted.get(microLearningId) ?? new Set<string>()
    permittedSubjects.add(userId)
    permitted.set(microLearningId, permittedSubjects)
  }

  if (
    requirements.some(
      ({ microLearningId, subject }) =>
        !permitted.get(microLearningId)?.has(subject)
    )
  ) {
    throw new GraphQLError(
      'The attached activity artifact must be confirmed by a lecturer who administers this microlearning',
      { extensions: { code: 'BAD_USER_INPUT' } }
    )
  }
}

/**
 * A refresh replaces the pin stored on every affected instance. Validate that
 * replacement against the target activities before any write, using the same
 * ADMIN or OWNER requirement as placement and publication.
 */
export async function assertActivityArtifactElementDataAccessible(
  microLearningIds: string[],
  elementData: unknown,
  prisma: Pick<PrismaTransactionClient, 'derivedPermission'>
) {
  const activityIds = [...new Set(microLearningIds)]
  if (activityIds.length === 0) return

  const pin = sanitizeActivityArtifactPin(
    (elementData as { options?: { activityArtifact?: unknown } } | null)
      ?.options?.activityArtifact
  )
  if (!pin) return

  await assertPinSubjectsAccessible(
    activityIds.map((microLearningId) => ({
      microLearningId,
      subject: pin.subject,
    })),
    prisma
  )
}

/**
 * Participant run read. Participant, course and activity instance all come
 * from the session and the persisted instance; nothing here is supplied by
 * the browser. The publisher receives a short-lived run claim naming the
 * participant, the course and the instance, and answers with the exact pinned
 * revision.
 *
 * Any denial returns null so a participant cannot distinguish a missing
 * artifact from a missing activity.
 */
export async function getActivityArtifactForInstance(
  { elementInstanceId }: { elementInstanceId: number },
  ctx: ContextWithUser
): Promise<ClientActivityArtifact | null> {
  if (!isParticipantFeatureFlagEnabled(ctx, 'activity-artifacts')) return null

  const runtime = ctx.activityArtifactRuntime
  if (!runtime) return null

  const now = new Date()
  const instance = await ctx.prisma.elementInstance.findUnique({
    where: {
      id: elementInstanceId,
      type: DB.ElementInstanceType.MICROLEARNING,
      elementType: DB.ElementType.CONTENT,
      // The pilot serves only published Microlearning instances whose course
      // is live and whose configured window currently contains the request.
      elementStack: {
        type: DB.ElementStackType.MICROLEARNING,
        microLearning: {
          status: DB.PublicationStatus.PUBLISHED,
          isDeleted: false,
          scheduledStartAt: { lte: now },
          scheduledEndAt: { gte: now },
          course: { deletionRequestedAt: null },
        },
      },
    },
    select: {
      id: true,
      elementData: true,
      elementStack: {
        select: {
          microLearning: {
            select: {
              id: true,
              courseId: true,
            },
          },
        },
      },
    },
  })

  const microLearning = instance?.elementStack?.microLearning
  if (!instance || !microLearning) return null

  const participation = await ctx.prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId: microLearning.courseId,
        participantId: ctx.user.sub,
      },
    },
    select: { id: true },
  })
  if (!participation) return null

  const elementData = instance.elementData as {
    options?: { activityArtifact?: unknown }
  } | null
  const pin = sanitizeActivityArtifactPin(
    elementData?.options?.activityArtifact
  )
  if (!pin) return null

  try {
    // The stored pin names the lecturer it was resolved for. Serving it to a
    // run requires that this lecturer still administers the activity.
    if (
      !(await lecturerStillOwnsMicrolearning(
        ctx,
        microLearning.id,
        pin.subject
      ))
    ) {
      return null
    }

    const assignment = await runtime.assign({
      subject: pin.subject,
      courseId: microLearning.courseId,
      instanceId: String(instance.id),
      artifactId: pin.artifactId,
      revisionId: pin.revisionId,
    })
    if (assignment === 'conflict') return null

    const revision = await runtime.getRevision({
      subject: ctx.user.sub,
      artifactId: pin.artifactId,
      revisionId: pin.revisionId,
      run: {
        participantId: ctx.user.sub,
        courseId: microLearning.courseId,
        elementInstanceId: instance.id,
      },
    })

    // `digest` covers the stored HTML and stays fixed for the revision.
    // `renderedDigest` also covers the current frame shell, so a renderer-only
    // deployment changes it without changing the pinned source.
    if (revision.digest !== pin.digest) {
      console.warn(
        '[activity-artifacts] pinned revision digest mismatch; denying run'
      )
      return null
    }

    // Canonicalize both values into the validator's fixed field shape.
    // Object property order is irrelevant, while cashflow array order remains
    // meaningful.
    const servedExercise = validateActivityArtifactExercise(revision.exercise)
    const pinnedExercise = validateActivityArtifactExercise(pin.exercise)
    if (
      !servedExercise ||
      !pinnedExercise ||
      JSON.stringify(servedExercise) !== JSON.stringify(pinnedExercise)
    ) {
      console.warn(
        '[activity-artifacts] pinned revision exercise mismatch; denying run'
      )
      return null
    }

    return toClientActivityArtifact(runtime, revision)
  } catch (error) {
    console.warn(
      '[activity-artifacts] participant read failed; denying run',
      error instanceof Error ? error.message : 'unknown error'
    )
    return null
  }
}
