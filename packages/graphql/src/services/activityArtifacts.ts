import * as DB from '@klicker-uzh/prisma/client'
import type { ActivityArtifactPin } from '@klicker-uzh/types'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import {
  ActivityArtifactRequestError,
  type ActivityArtifactRevision,
  type ActivityArtifactRuntime,
  getActivityArtifactBindingInstanceId,
  isActivityArtifactId,
  parseCanonicalArtifactUrl,
  sanitizeActivityArtifactPin,
  validateActivityArtifactExercise,
} from '../lib/activityArtifacts.js'
import type { ContextWithUser, FeatureFlagEvaluator } from '../lib/context.js'
import {
  isFeatureFlagEnabledForAccount,
  isParticipantFeatureFlagEnabled,
  requireFeatureFlagAccess,
} from '../lib/featureFlags.js'

export type ClientActivityArtifact = ActivityArtifactRevision & {
  // Fixed trusted renderer on the configured publisher origin. No token or
  // artifact data travels in the frame URL.
  frameUrl: string
}

export type ActivityArtifactInstanceResult = {
  available: boolean
  artifact: ClientActivityArtifact | null
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
    return new GraphQLError(
      error.status === 403
        ? 'You do not have permission to access this artifact'
        : 'Artifact link is not available',
      {
        extensions: {
          code: error.status === 403 ? 'FORBIDDEN' : 'BAD_USER_INPUT',
        },
      }
    )
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

  const permitted = await loadPermittedPinSubjects(requirements, prisma)
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

async function loadPermittedPinSubjects(
  requirements: { microLearningId: string; subject: string }[],
  prisma: Pick<PrismaTransactionClient, 'derivedPermission'>
) {
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

  return permitted
}

type ActivityArtifactCheckInstance = {
  id: number
  microLearningId: string
  elementType: DB.ElementType
  elementData: unknown
}

export function hasActivityArtifactPin(
  instances: Pick<
    ActivityArtifactCheckInstance,
    'elementType' | 'elementData'
  >[]
) {
  return instances.some(
    ({ elementType, elementData }) =>
      elementType === DB.ElementType.CONTENT &&
      sanitizeActivityArtifactPin(
        (
          elementData as {
            options?: { activityArtifact?: unknown }
          } | null
        )?.options?.activityArtifact
      ) !== null
  )
}

/**
 * Returns only pinned instances that the requesting participant may attempt to
 * render. Callers establish current enrollment and pass only active
 * Microlearning instances. The single permission lookup applies to every
 * candidate and keeps ordinary CONTENT elements out of the artifact path.
 */
export async function getActivityArtifactCheckInstanceIds(
  instances: ActivityArtifactCheckInstance[],
  prisma: Pick<PrismaTransactionClient, 'derivedPermission'>
) {
  const requirements: { microLearningId: string; subject: string }[] = []
  const candidates: {
    instanceId: number
    microLearningId: string
    pinSubject: string
  }[] = []

  for (const instance of instances) {
    if (instance.elementType !== DB.ElementType.CONTENT) continue

    const pin = sanitizeActivityArtifactPin(
      (
        instance.elementData as {
          options?: { activityArtifact?: unknown }
        } | null
      )?.options?.activityArtifact
    )
    if (!pin) continue

    candidates.push({
      instanceId: instance.id,
      microLearningId: instance.microLearningId,
      pinSubject: pin.subject,
    })
    requirements.push({
      microLearningId: instance.microLearningId,
      subject: pin.subject,
    })
  }

  if (candidates.length === 0) return new Set<number>()

  const permitted = await loadPermittedPinSubjects(requirements, prisma)
  return new Set(
    candidates
      .filter(
        ({ microLearningId, pinSubject }) =>
          permitted.get(microLearningId)?.has(pinSubject) === true
      )
      .map(({ instanceId }) => instanceId)
  )
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

type ActivityArtifactPublicationBinding = {
  instanceId: number
  courseId: string
  pin: ActivityArtifactPin
}

async function loadActivityArtifactPinsForPublication(
  microLearningId: string,
  featureFlags: Pick<FeatureFlagEvaluator, 'isEnabled'> | undefined,
  prisma: Pick<
    PrismaTransactionClient,
    'derivedPermission' | 'elementInstance' | 'user'
  >
): Promise<ActivityArtifactPublicationBinding[]> {
  const instances = await prisma.elementInstance.findMany({
    where: {
      elementType: DB.ElementType.CONTENT,
      elementStack: { microLearningId },
      elementData: {
        path: ['options', 'activityArtifact'],
        not: DB.Prisma.DbNull,
      },
    },
    select: {
      id: true,
      elementData: true,
      elementStack: {
        select: {
          microLearning: { select: { courseId: true } },
        },
      },
    },
  })

  const bindings: ActivityArtifactPublicationBinding[] = []
  for (const instance of instances) {
    const pin = sanitizeActivityArtifactPin(
      (
        instance.elementData as {
          options?: { activityArtifact?: unknown }
        } | null
      )?.options?.activityArtifact
    )
    const courseId = instance.elementStack?.microLearning?.courseId
    if (!pin || !courseId) {
      throw new GraphQLError('The attached activity artifact is invalid', {
        extensions: { code: 'BAD_USER_INPUT' },
      })
    }

    bindings.push({ instanceId: instance.id, courseId, pin })
  }

  if (bindings.length === 0) return bindings

  const subjects = [...new Set(bindings.map(({ pin }) => pin.subject))]
  const accounts = await prisma.user.findMany({
    where: { id: { in: subjects } },
    select: {
      id: true,
      role: true,
      catalystInstitutional: true,
      catalystIndividual: true,
      betaEnabled: true,
    },
  })
  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  for (const { pin } of bindings) {
    const account = accountsById.get(pin.subject)
    if (!account) {
      throw new GraphQLError('The attached activity artifact is invalid', {
        extensions: { code: 'BAD_USER_INPUT' },
      })
    }
    if (
      !isFeatureFlagEnabledForAccount(
        featureFlags,
        account,
        'activity-artifacts'
      )
    ) {
      throw new GraphQLError(
        'Re-enable activity artifacts for the linked artifact owner before publishing',
        { extensions: { code: 'FORBIDDEN' } }
      )
    }
  }

  await assertPinSubjectsAccessible(
    bindings.map(({ pin }) => ({
      microLearningId,
      subject: pin.subject,
    })),
    prisma
  )

  return bindings
}

function requirePublicationArtifactRuntime(
  runtime: Pick<ActivityArtifactRuntime, 'assign'> | undefined
): Pick<ActivityArtifactRuntime, 'assign'> {
  if (!runtime) {
    throw new GraphQLError('Activity artifacts are not configured', {
      extensions: { code: 'SERVICE_UNAVAILABLE' },
    })
  }

  return runtime
}

/**
 * Checks every pinned instance before a publication side effect. Scheduled
 * publications use this without creating a remote binding; the worker repeats
 * the checks when the activity actually becomes visible.
 */
export async function assertActivityArtifactPinsPublishable(
  microLearningId: string,
  runtime: Pick<ActivityArtifactRuntime, 'assign'> | undefined,
  featureFlags: Pick<FeatureFlagEvaluator, 'isEnabled'> | undefined,
  prisma: Pick<
    PrismaTransactionClient,
    'derivedPermission' | 'elementInstance' | 'user'
  >
) {
  const bindings = await loadActivityArtifactPinsForPublication(
    microLearningId,
    featureFlags,
    prisma
  )
  if (bindings.length > 0) requirePublicationArtifactRuntime(runtime)
}

/**
 * Establishes the immutable publisher binding for every pinned instance in a
 * Microlearning. This runs at the publication boundary, before the activity
 * becomes visible. A failed database update can be retried because the
 * publisher accepts the same binding idempotently.
 */
export async function assignActivityArtifactPinsForPublication(
  microLearningId: string,
  runtime: Pick<ActivityArtifactRuntime, 'assign'> | undefined,
  featureFlags: Pick<FeatureFlagEvaluator, 'isEnabled'> | undefined,
  prisma: Pick<
    PrismaTransactionClient,
    'derivedPermission' | 'elementInstance' | 'user'
  >
) {
  const bindings = await loadActivityArtifactPinsForPublication(
    microLearningId,
    featureFlags,
    prisma
  )
  if (bindings.length === 0) return

  const artifactRuntime = requirePublicationArtifactRuntime(runtime)

  for (const { instanceId, courseId, pin } of bindings) {
    let assignment: 'bound' | 'conflict'
    try {
      assignment = await artifactRuntime.assign({
        subject: pin.subject,
        courseId,
        instanceId: getActivityArtifactBindingInstanceId(
          instanceId,
          pin.revisionId
        ),
        artifactId: pin.artifactId,
        revisionId: pin.revisionId,
      })
    } catch (error) {
      throw toArtifactGraphQLError(error)
    }

    if (assignment === 'conflict') {
      throw new GraphQLError(
        'The attached activity artifact no longer matches this instance',
        { extensions: { code: 'BAD_USER_INPUT' } }
      )
    }
  }
}

/**
 * Participant run read. Participant, course and activity instance all come
 * from the session and the persisted instance; nothing here is supplied by
 * the browser. The publisher receives a short-lived run claim naming the
 * participant, the course and the instance, and answers with the exact pinned
 * revision.
 *
 * Any access denial returns null so a participant cannot distinguish a missing
 * artifact from a missing activity. An authorized participant with a stored
 * pin receives only a generic unavailable result while the pilot is off.
 */
export async function getActivityArtifactForInstance(
  { elementInstanceId }: { elementInstanceId: number },
  ctx: ContextWithUser
): Promise<ActivityArtifactInstanceResult | null> {
  const enabled = isParticipantFeatureFlagEnabled(ctx, 'activity-artifacts')

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

  // The stored pin names the lecturer it was resolved for. Serving it to a
  // run requires that this lecturer still administers the activity. Perform
  // this authorization check before returning any availability state.
  let lecturerStillOwnsActivity = false
  try {
    lecturerStillOwnsActivity = await lecturerStillOwnsMicrolearning(
      ctx,
      microLearning.id,
      pin.subject
    )
  } catch {
    return null
  }
  if (!lecturerStillOwnsActivity) {
    return null
  }

  if (!enabled) return { available: false, artifact: null }

  const runtime = ctx.activityArtifactRuntime
  if (!runtime) return { available: false, artifact: null }

  try {
    const run = {
      participantId: ctx.user.sub,
      courseId: microLearning.courseId,
      elementInstanceId: instance.id,
      bindingInstanceId: getActivityArtifactBindingInstanceId(
        instance.id,
        pin.revisionId
      ),
    }

    const readRevision = (bindingInstanceId: string) =>
      runtime.getRevision({
        subject: ctx.user.sub,
        artifactId: pin.artifactId,
        revisionId: pin.revisionId,
        run: { ...run, bindingInstanceId },
      })

    let revision: ActivityArtifactRevision
    try {
      revision = await readRevision(run.bindingInstanceId)
    } catch (error) {
      // Bindings created before revision qualification used the numeric
      // instance id. Keep those published activities readable without writing
      // on a participant request or replacing the immutable publisher binding.
      if (
        !(error instanceof ActivityArtifactRequestError) ||
        error.status !== 404
      ) {
        throw error
      }
      revision = await readRevision(String(instance.id))
    }

    // `digest` covers the stored HTML and stays fixed for the revision.
    // `renderedDigest` also covers the current frame shell, so a renderer-only
    // deployment changes it without changing the pinned source.
    if (revision.digest !== pin.digest) {
      console.warn(
        '[activity-artifacts] pinned revision digest mismatch; denying run'
      )
      return { available: false, artifact: null }
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
      return { available: false, artifact: null }
    }

    return {
      available: true,
      artifact: toClientActivityArtifact(runtime, revision),
    }
  } catch (error) {
    console.warn(
      '[activity-artifacts] participant read failed; denying run',
      error instanceof Error ? error.message : 'unknown error'
    )
    return { available: false, artifact: null }
  }
}
