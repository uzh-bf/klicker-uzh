import type { Context } from '@hatchet-dev/typescript-sdk'
import {
  ObjectType,
  PermissionPropagationCursorKind,
  PermissionPropagationFailureCode,
  PermissionPropagationMode,
  PermissionPropagationSignalSource,
  Prisma,
  type PermissionPropagationWork,
} from '@klicker-uzh/prisma/client'
import type {
  HatchetHandlerGlobalContext,
  PermissionPropagationReconciliationTaskInput,
  PermissionPropagationReconciliationTaskResult,
  PermissionPropagationTaskInput,
  PermissionPropagationTaskResult,
} from '@klicker-uzh/types'
import {
  recomputeDerivedPermissions,
  type PrismaTransactionClient,
} from '@klicker-uzh/util'

export const PERMISSION_PROPAGATION_RECOVERY_SLO_MS = 5 * 60 * 1000
const PERMISSION_PROPAGATION_TRANSACTION_TIMEOUT_MS = 60_000
const PERMISSION_PROPAGATION_REDISPATCH_MS = 60_000
const PERMISSION_PROPAGATION_SIGNAL_SAFETY_LAG_MS = 60_000
const PERMISSION_PROPAGATION_RECONCILIATION_STATE_ID = 'permission-propagation'
const PERMISSION_PROPAGATION_REGULAR_SAMPLE_SIZE = 2
const PERMISSION_PROPAGATION_FULL_SWEEP_BATCH_SIZE = 25
const PERMISSION_PROPAGATION_SIGNAL_SOURCE_BATCH_SIZE = 15
const PERMISSION_PROPAGATION_DISPATCH_BATCH_SIZE = 100

const PERMISSION_OBJECT_SIGNAL_PROJECTION = Prisma.sql`
  CASE
    WHEN permission."catalogCollectionId" IS NOT NULL THEN 'CATALOG_COLLECTION'::"ObjectType"
    WHEN permission."answerCollectionId" IS NOT NULL THEN 'ANSWER_COLLECTION'::"ObjectType"
    WHEN permission."elementId" IS NOT NULL THEN 'ELEMENT'::"ObjectType"
    WHEN permission."courseId" IS NOT NULL THEN 'COURSE'::"ObjectType"
    WHEN permission."liveQuizId" IS NOT NULL THEN 'LIVE_QUIZ'::"ObjectType"
    WHEN permission."practiceQuizId" IS NOT NULL THEN 'PRACTICE_QUIZ'::"ObjectType"
    WHEN permission."microLearningId" IS NOT NULL THEN 'MICRO_LEARNING'::"ObjectType"
    WHEN permission."groupActivityId" IS NOT NULL THEN 'GROUP_ACTIVITY'::"ObjectType"
  END AS "objectType",
  COALESCE(
    permission."catalogCollectionId"::text,
    permission."answerCollectionId"::text,
    permission."elementId"::text,
    permission."courseId"::text,
    permission."liveQuizId"::text,
    permission."practiceQuizId"::text,
    permission."microLearningId"::text,
    permission."groupActivityId"::text
  ) AS "objectId"
`

// audit rows carry the user group id as text, so only values that fit a signed
// 32-bit integer may reach the cast; anything else yields NULL and drops out
const USER_GROUP_ID_FROM_AUDIT_OBJECT_ID = Prisma.sql`
  CASE
    WHEN audit."objectId" ~ '^[1-9][0-9]{0,9}$'
      AND audit."objectId"::bigint <= 2147483647
    THEN audit."objectId"::integer
  END
`

export type PermissionPropagationObjectType = Exclude<
  ObjectType,
  typeof ObjectType.USER_GROUP
>

const PERMISSION_PROPAGATION_OBJECT_TYPES = [
  ObjectType.CATALOG_COLLECTION,
  ObjectType.ANSWER_COLLECTION,
  ObjectType.ELEMENT,
  ObjectType.COURSE,
  ObjectType.LIVE_QUIZ,
  ObjectType.PRACTICE_QUIZ,
  ObjectType.MICRO_LEARNING,
  ObjectType.GROUP_ACTIVITY,
] as const satisfies readonly PermissionPropagationObjectType[]

export type PermissionPropagationScope =
  | {
      objectType: PermissionPropagationObjectType
      objectId: string
      mode: typeof PermissionPropagationMode.OBJECT
      userId?: never
    }
  | {
      objectType: PermissionPropagationObjectType
      objectId: string
      mode: typeof PermissionPropagationMode.USER
      userId: string
    }

function encodeKeyPart(value: string | undefined) {
  return value === undefined
    ? '-:'
    : `${Buffer.byteLength(value, 'utf8')}:${value}`
}

export function permissionPropagationKey(scope: PermissionPropagationScope) {
  if ((scope.objectType as ObjectType) === ObjectType.USER_GROUP) {
    throw new Error('User groups are not permission propagation work objects.')
  }
  if (scope.objectId.length === 0) {
    throw new Error('Permission propagation work requires an object ID.')
  }
  if (
    scope.mode === PermissionPropagationMode.USER &&
    scope.userId.length === 0
  ) {
    throw new Error('User-scoped permission propagation requires a user ID.')
  }
  if (
    scope.mode === PermissionPropagationMode.OBJECT &&
    'userId' in scope &&
    scope.userId !== undefined
  ) {
    throw new Error('Object-scoped permission propagation cannot carry a user.')
  }

  return (
    encodeKeyPart(scope.objectType) +
    encodeKeyPart(scope.objectId) +
    encodeKeyPart(scope.mode) +
    encodeKeyPart(
      scope.mode === PermissionPropagationMode.USER ? scope.userId : undefined
    )
  )
}

export async function acquirePermissionPropagationFence(
  prisma: PrismaTransactionClient
) {
  const startedAt = performance.now()

  await prisma.$executeRaw`
    SELECT pg_advisory_xact_lock(5144, 1)
  `

  return performance.now() - startedAt
}

export async function upsertPermissionPropagationWork(
  prisma: PrismaTransactionClient,
  input: {
    scope: PermissionPropagationScope
    updateAccessRequests: boolean
    dirtyAt?: Date
  }
) {
  const key = permissionPropagationKey(input.scope)
  const dirtyAt = input.dirtyAt ?? new Date()
  const recoverBy = new Date(
    dirtyAt.getTime() + PERMISSION_PROPAGATION_RECOVERY_SLO_MS
  )
  const userId =
    input.scope.mode === PermissionPropagationMode.USER
      ? input.scope.userId
      : null

  const rows = await prisma.$queryRaw<PermissionPropagationWork[]>`
    INSERT INTO "PermissionPropagationWork" (
      "key",
      "objectType",
      "objectId",
      "mode",
      "userId",
      "generation",
      "updateAccessRequests",
      "dirtyAt",
      "recoverBy",
      "updatedAt"
    )
    VALUES (
      ${key},
      ${input.scope.objectType}::"ObjectType",
      ${input.scope.objectId},
      ${input.scope.mode}::"PermissionPropagationMode",
      ${userId}::uuid,
      1,
      ${input.updateAccessRequests},
      ${dirtyAt},
      ${recoverBy},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("key") DO UPDATE
    SET
      "generation" = "PermissionPropagationWork"."generation" + 1,
      "updateAccessRequests" = CASE
        WHEN
          "PermissionPropagationWork"."processedGeneration" <
          "PermissionPropagationWork"."generation"
        THEN
          "PermissionPropagationWork"."updateAccessRequests"
          OR EXCLUDED."updateAccessRequests"
        ELSE EXCLUDED."updateAccessRequests"
      END,
      "dirtyAt" = CASE
        WHEN
          "PermissionPropagationWork"."processedGeneration" <
          "PermissionPropagationWork"."generation"
        THEN "PermissionPropagationWork"."dirtyAt"
        ELSE EXCLUDED."dirtyAt"
      END,
      "recoverBy" = CASE
        WHEN
          "PermissionPropagationWork"."processedGeneration" <
          "PermissionPropagationWork"."generation"
        THEN "PermissionPropagationWork"."recoverBy"
        ELSE EXCLUDED."recoverBy"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *
  `

  const work = rows[0]
  if (!work) {
    throw new Error('Permission propagation work upsert returned no row.')
  }

  return work
}

export async function markPermissionPropagationDispatched(
  prisma: PrismaTransactionClient,
  input: { key: string; generation: bigint; acceptedAt?: Date }
) {
  const { count } = await prisma.permissionPropagationWork.updateMany({
    where: {
      key: input.key,
      generation: { gte: input.generation },
      dispatchedGeneration: { lte: input.generation },
    },
    data: {
      dispatchedGeneration: input.generation,
      lastDispatchedAt: input.acceptedAt ?? new Date(),
    },
  })

  return count === 1
}

// the one rule for what a numeric object id may look like; its two call sites
// disagree only on the failure policy, so the rule itself must not be restated
function isNumericObjectId(objectId: string) {
  return /^[1-9]\d*$/.test(objectId) && Number.isSafeInteger(Number(objectId))
}

// a scope we are about to recompute must fail loudly, since silently skipping it
// would leave the derived permissions of a real object stale behind a green tick
function parseNumericObjectId(objectId: string) {
  if (!isNumericObjectId(objectId)) {
    throw new Error('Permission propagation numeric object ID is invalid.')
  }

  return Number(objectId)
}

// a bulk existence probe drops unusable ids instead: they cannot name a row in a
// numeric-keyed table, which is exactly the answer the probe is asked for
function filterNumericObjectIds(objectIds: string[]) {
  return objectIds.filter(isNumericObjectId).map(Number)
}

function permissionPropagationScopeFromWork(
  work: PermissionPropagationWork
): PermissionPropagationScope {
  if (
    work.generation < 1n ||
    work.processedGeneration < 0n ||
    work.processedGeneration > work.generation ||
    work.dispatchedGeneration < 0n ||
    work.dispatchedGeneration > work.generation
  ) {
    throw new Error('Permission propagation work counters are invalid.')
  }
  if (work.recoverBy < work.dirtyAt) {
    throw new Error('Permission propagation recovery window is invalid.')
  }
  if (work.objectType === ObjectType.USER_GROUP) {
    throw new Error('User groups are not permission propagation work objects.')
  }

  const objectType = work.objectType as PermissionPropagationObjectType
  let scope: PermissionPropagationScope
  if (work.mode === PermissionPropagationMode.USER) {
    if (work.userId === null) {
      throw new Error('User-scoped permission propagation work has no user.')
    }
    scope = {
      objectType,
      objectId: work.objectId,
      mode: work.mode,
      userId: work.userId,
    }
  } else {
    if (work.userId !== null) {
      throw new Error(
        'Object-scoped permission propagation work carries a user.'
      )
    }
    scope = {
      objectType,
      objectId: work.objectId,
      mode: work.mode,
    }
  }

  if (permissionPropagationKey(scope) !== work.key) {
    throw new Error('Permission propagation work key does not match its scope.')
  }

  return scope
}

function unreachablePermissionPropagationObjectType(objectType: never): never {
  throw new Error(
    `Unsupported permission propagation object type: ${String(objectType)}`
  )
}

async function recomputePermissionPropagationWork(
  work: PermissionPropagationWork,
  scope: PermissionPropagationScope,
  prisma: PrismaTransactionClient
) {
  const userId =
    scope.mode === PermissionPropagationMode.USER ? scope.userId : undefined
  const options = {
    userId,
    updateAccessRequests: work.updateAccessRequests,
  }

  switch (scope.objectType) {
    case ObjectType.CATALOG_COLLECTION:
      return recomputeDerivedPermissions(
        { catalogCollectionId: scope.objectId, ...options },
        prisma
      )
    case ObjectType.ANSWER_COLLECTION:
      return recomputeDerivedPermissions(
        {
          answerCollectionId: parseNumericObjectId(scope.objectId),
          ...options,
        },
        prisma
      )
    case ObjectType.ELEMENT:
      return recomputeDerivedPermissions(
        { elementId: parseNumericObjectId(scope.objectId), ...options },
        prisma
      )
    case ObjectType.COURSE:
      return recomputeDerivedPermissions(
        { courseId: scope.objectId, ...options },
        prisma
      )
    case ObjectType.LIVE_QUIZ:
      return recomputeDerivedPermissions(
        { liveQuizId: scope.objectId, ...options },
        prisma
      )
    case ObjectType.PRACTICE_QUIZ:
      return recomputeDerivedPermissions(
        { practiceQuizId: scope.objectId, ...options },
        prisma
      )
    case ObjectType.MICRO_LEARNING:
      return recomputeDerivedPermissions(
        { microLearningId: scope.objectId, ...options },
        prisma
      )
    case ObjectType.GROUP_ACTIVITY:
      return recomputeDerivedPermissions(
        { groupActivityId: scope.objectId, ...options },
        prisma
      )
    default:
      return unreachablePermissionPropagationObjectType(scope.objectType)
  }
}

function parseTaskGeneration(taskGeneration: string) {
  if (!/^[1-9]\d*$/.test(taskGeneration)) {
    throw new Error('Permission propagation task generation is invalid.')
  }

  return BigInt(taskGeneration)
}

async function persistPermissionPropagationFailure(
  globalCtx: HatchetHandlerGlobalContext,
  executionCtx: Context<unknown>,
  input: {
    workKey: string
    generation: bigint
    code: PermissionPropagationFailureCode
  }
) {
  try {
    await globalCtx.prisma.permissionPropagationFailure.upsert({
      where: {
        workKey_generation_code: {
          workKey: input.workKey,
          generation: input.generation,
          code: input.code,
        },
      },
      create: {
        workKey: input.workKey,
        generation: input.generation,
        code: input.code,
      },
      update: {},
    })
  } catch {
    executionCtx.logger.error(
      'Permission propagation failure could not be persisted.'
    )
  }
}

export async function handlePermissionPropagationWork(
  input: PermissionPropagationTaskInput,
  globalCtx: HatchetHandlerGlobalContext,
  executionCtx: Context<unknown>
): Promise<PermissionPropagationTaskResult> {
  const taskGeneration = parseTaskGeneration(input.taskGeneration)
  let observedGeneration: bigint | undefined

  try {
    return await globalCtx.prisma.$transaction(
      async (tx) => {
        await acquirePermissionPropagationFence(tx)
        const work = await tx.permissionPropagationWork.findUnique({
          where: { key: input.workKey },
        })

        if (!work) {
          return { status: 'missing', processedGeneration: null }
        }
        const scope = permissionPropagationScopeFromWork(work)
        observedGeneration = work.generation
        if (taskGeneration > work.generation) {
          throw new Error(
            'Permission propagation task generation is ahead of durable work.'
          )
        }
        if (work.processedGeneration >= work.generation) {
          return {
            status: 'already-processed',
            processedGeneration: work.processedGeneration.toString(),
          }
        }

        await recomputePermissionPropagationWork(work, scope, tx)

        const { count } = await tx.permissionPropagationWork.updateMany({
          where: {
            key: work.key,
            generation: observedGeneration,
            processedGeneration: { lt: observedGeneration },
          },
          data: { processedGeneration: observedGeneration },
        })
        if (count !== 1) {
          throw new Error(
            'Permission propagation work changed while holding the fence.'
          )
        }

        return {
          status: 'processed',
          processedGeneration: observedGeneration.toString(),
        }
      },
      { timeout: PERMISSION_PROPAGATION_TRANSACTION_TIMEOUT_MS }
    )
  } catch (error) {
    if (observedGeneration !== undefined) {
      await persistPermissionPropagationFailure(globalCtx, executionCtx, {
        workKey: input.workKey,
        generation: observedGeneration,
        code: PermissionPropagationFailureCode.WORKER_EXECUTION_FAILED,
      })
    }
    throw error
  }
}

type PermissionPropagationCursor = {
  nextObjectType: PermissionPropagationObjectType
}

type PermissionPropagationSignal = {
  signalAt: Date
  sourceId: number
  relationId: number
  relationMaxId?: number | null
  objectType: ObjectType | null
  objectId: string | null
}

type PermissionPropagationSignalCursor = {
  through: Date
  sourceId: number | null
  relationId: number | null
  relationMaxId: number | null
}

function isPermissionPropagationObjectType(
  objectType: ObjectType
): objectType is PermissionPropagationObjectType {
  return (
    PERMISSION_PROPAGATION_OBJECT_TYPES as readonly ObjectType[]
  ).includes(objectType)
}

function numericCursorId(objectId: string | null) {
  return objectId === null ? undefined : parseNumericObjectId(objectId)
}

async function listPermissionPropagationObjectIds(
  prisma: PrismaTransactionClient,
  objectType: PermissionPropagationObjectType,
  afterId: string | null,
  take: number
): Promise<string[]> {
  switch (objectType) {
    case ObjectType.CATALOG_COLLECTION:
      return (
        await prisma.catalogCollection.findMany({
          where: afterId === null ? undefined : { id: { gt: afterId } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take,
        })
      ).map(({ id }) => id)
    case ObjectType.ANSWER_COLLECTION:
      return (
        await prisma.answerCollection.findMany({
          where:
            afterId === null
              ? undefined
              : { id: { gt: numericCursorId(afterId) } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take,
        })
      ).map(({ id }) => String(id))
    case ObjectType.ELEMENT:
      return (
        await prisma.element.findMany({
          where:
            afterId === null
              ? undefined
              : { id: { gt: numericCursorId(afterId) } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take,
        })
      ).map(({ id }) => String(id))
    case ObjectType.COURSE:
      return (
        await prisma.course.findMany({
          where: afterId === null ? undefined : { id: { gt: afterId } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take,
        })
      ).map(({ id }) => id)
    case ObjectType.LIVE_QUIZ:
      return (
        await prisma.liveQuiz.findMany({
          where: afterId === null ? undefined : { id: { gt: afterId } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take,
        })
      ).map(({ id }) => id)
    case ObjectType.PRACTICE_QUIZ:
      return (
        await prisma.practiceQuiz.findMany({
          where: afterId === null ? undefined : { id: { gt: afterId } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take,
        })
      ).map(({ id }) => id)
    case ObjectType.MICRO_LEARNING:
      return (
        await prisma.microLearning.findMany({
          where: afterId === null ? undefined : { id: { gt: afterId } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take,
        })
      ).map(({ id }) => id)
    case ObjectType.GROUP_ACTIVITY:
      return (
        await prisma.groupActivity.findMany({
          where: afterId === null ? undefined : { id: { gt: afterId } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take,
        })
      ).map(({ id }) => id)
    default:
      return unreachablePermissionPropagationObjectType(objectType)
  }
}

async function collectPermissionPropagationObjectBatch(
  prisma: PrismaTransactionClient,
  kind: PermissionPropagationCursorKind,
  initialCursor: PermissionPropagationCursor,
  take: number
) {
  const initialTypeIndex = PERMISSION_PROPAGATION_OBJECT_TYPES.indexOf(
    initialCursor.nextObjectType
  )
  if (initialTypeIndex === -1) {
    throw new Error('Permission propagation cursor object type is invalid.')
  }

  const storedCursors = await prisma.permissionPropagationCursor.findMany({
    where: { kind },
  })
  const objectIdsByType = new Map<
    PermissionPropagationObjectType,
    string | null
  >()
  for (const cursor of storedCursors) {
    if (!isPermissionPropagationObjectType(cursor.objectType)) {
      throw new Error('Permission propagation cursor object type is invalid.')
    }
    objectIdsByType.set(cursor.objectType, cursor.objectId)
  }

  const scopes: PermissionPropagationScope[] = []
  const scopeKeys = new Set<string>()
  const exhaustedObjectTypes = new Set<PermissionPropagationObjectType>()
  let objectTypeIndex = initialTypeIndex

  while (
    scopes.length < take &&
    exhaustedObjectTypes.size < PERMISSION_PROPAGATION_OBJECT_TYPES.length
  ) {
    const objectType = PERMISSION_PROPAGATION_OBJECT_TYPES[objectTypeIndex]!
    let cursorObjectId = objectIdsByType.get(objectType) ?? null
    let objectIds = await listPermissionPropagationObjectIds(
      prisma,
      objectType,
      cursorObjectId,
      1
    )

    if (objectIds.length === 0 && cursorObjectId !== null) {
      cursorObjectId = null
      objectIdsByType.set(objectType, null)
      objectIds = await listPermissionPropagationObjectIds(
        prisma,
        objectType,
        null,
        1
      )
    }

    const nextObjectId = objectIds[0]
    if (nextObjectId === undefined) {
      exhaustedObjectTypes.add(objectType)
    } else {
      const scope = {
        objectType,
        objectId: nextObjectId,
        mode: PermissionPropagationMode.OBJECT,
      } as const
      const key = permissionPropagationKey(scope)
      if (scopeKeys.has(key)) {
        exhaustedObjectTypes.add(objectType)
      } else {
        scopeKeys.add(key)
        scopes.push(scope)
        objectIdsByType.set(objectType, nextObjectId)
      }
    }

    await prisma.permissionPropagationCursor.upsert({
      where: { kind_objectType: { kind, objectType } },
      create: {
        kind,
        objectType,
        objectId: objectIdsByType.get(objectType) ?? null,
      },
      update: { objectId: objectIdsByType.get(objectType) ?? null },
    })

    objectTypeIndex =
      (objectTypeIndex + 1) % PERMISSION_PROPAGATION_OBJECT_TYPES.length
  }

  return {
    cursor: {
      nextObjectType: PERMISSION_PROPAGATION_OBJECT_TYPES[objectTypeIndex]!,
    },
    scopes,
  }
}

async function existingPermissionPropagationObjectIds(
  prisma: PrismaTransactionClient,
  objectType: PermissionPropagationObjectType,
  objectIds: string[]
) {
  switch (objectType) {
    case ObjectType.CATALOG_COLLECTION:
      return (
        await prisma.catalogCollection.findMany({
          where: { id: { in: objectIds } },
          select: { id: true },
        })
      ).map(({ id }) => id)
    case ObjectType.ANSWER_COLLECTION:
      return (
        await prisma.answerCollection.findMany({
          where: { id: { in: filterNumericObjectIds(objectIds) } },
          select: { id: true },
        })
      ).map(({ id }) => String(id))
    case ObjectType.ELEMENT:
      return (
        await prisma.element.findMany({
          where: { id: { in: filterNumericObjectIds(objectIds) } },
          select: { id: true },
        })
      ).map(({ id }) => String(id))
    case ObjectType.COURSE:
      return (
        await prisma.course.findMany({
          where: { id: { in: objectIds } },
          select: { id: true },
        })
      ).map(({ id }) => id)
    case ObjectType.LIVE_QUIZ:
      return (
        await prisma.liveQuiz.findMany({
          where: { id: { in: objectIds } },
          select: { id: true },
        })
      ).map(({ id }) => id)
    case ObjectType.PRACTICE_QUIZ:
      return (
        await prisma.practiceQuiz.findMany({
          where: { id: { in: objectIds } },
          select: { id: true },
        })
      ).map(({ id }) => id)
    case ObjectType.MICRO_LEARNING:
      return (
        await prisma.microLearning.findMany({
          where: { id: { in: objectIds } },
          select: { id: true },
        })
      ).map(({ id }) => id)
    case ObjectType.GROUP_ACTIVITY:
      return (
        await prisma.groupActivity.findMany({
          where: { id: { in: objectIds } },
          select: { id: true },
        })
      ).map(({ id }) => id)
    default:
      return unreachablePermissionPropagationObjectType(objectType)
  }
}

async function collectPermissionPropagationSignalSourcePage(
  prisma: PrismaTransactionClient,
  source: PermissionPropagationSignalSource,
  input: { after: PermissionPropagationSignalCursor; through: Date }
) {
  if (
    (input.after.sourceId === null) !== (input.after.relationId === null) ||
    (input.after.sourceId === null && input.after.relationMaxId !== null) ||
    (input.after.sourceId !== null && input.after.sourceId <= 0) ||
    (input.after.relationId !== null && input.after.relationId < 0) ||
    (input.after.relationMaxId !== null &&
      (input.after.relationId === null ||
        input.after.relationMaxId < input.after.relationId ||
        (source !== PermissionPropagationSignalSource.USER_GROUP &&
          source !== PermissionPropagationSignalSource.USER_GROUP_AUDIT)))
  ) {
    throw new Error('Permission propagation signal cursor is invalid.')
  }
  let signals: PermissionPropagationSignal[]
  switch (source) {
    case PermissionPropagationSignalSource.PERMISSION:
      signals = await prisma.$queryRaw<PermissionPropagationSignal[]>`
        SELECT
          permission."updatedAt" AS "signalAt",
          permission."id" AS "sourceId",
          0 AS "relationId",
          ${PERMISSION_OBJECT_SIGNAL_PROJECTION}
        FROM "Permission" permission
        WHERE permission."updatedAt" <= ${input.through}
          AND (
            permission."updatedAt" > ${input.after.through}
            OR (
              permission."updatedAt" = ${input.after.through}
              AND ${input.after.sourceId}::integer IS NOT NULL
              AND permission."id" > ${input.after.sourceId}
            )
          )
        ORDER BY permission."updatedAt", permission."id"
        LIMIT ${PERMISSION_PROPAGATION_SIGNAL_SOURCE_BATCH_SIZE}
      `
      break
    case PermissionPropagationSignalSource.USER_GROUP:
      signals = await prisma.$queryRaw<PermissionPropagationSignal[]>`
        WITH continued_event AS MATERIALIZED (
          SELECT
            ${input.after.through}::timestamp AS "signalAt",
            user_group."id" AS "sourceId"
          FROM "UserGroup" user_group
          WHERE ${input.after.relationMaxId}::integer IS NOT NULL
            AND user_group."id" = ${input.after.sourceId}
          LIMIT 1
        ),
        next_event AS MATERIALIZED (
          SELECT
            user_group."updatedAt" AS "signalAt",
            user_group."id" AS "sourceId"
          FROM "UserGroup" user_group
          WHERE ${input.after.relationMaxId}::integer IS NULL
            AND user_group."updatedAt" <= ${input.through}
            AND (
              user_group."updatedAt" > ${input.after.through}
              OR (
                user_group."updatedAt" = ${input.after.through}
                AND ${input.after.sourceId}::integer IS NOT NULL
                AND user_group."id" > ${input.after.sourceId}
              )
            )
          ORDER BY user_group."updatedAt", user_group."id"
          LIMIT 1
        ),
        source_event AS MATERIALIZED (
          SELECT
            event."signalAt",
            event."sourceId",
            COALESCE(
              ${input.after.relationMaxId}::integer,
              (
                SELECT MAX(permission."id")
                FROM "Permission" permission
                WHERE permission."userGroupId" = event."sourceId"
              ),
              0
            ) AS "relationMaxId"
          FROM (
            SELECT * FROM continued_event
            UNION ALL
            SELECT * FROM next_event
          ) event
        )
        SELECT
          source_event."signalAt",
          source_event."sourceId",
          COALESCE(permission."id", 0) AS "relationId",
          source_event."relationMaxId",
          ${PERMISSION_OBJECT_SIGNAL_PROJECTION}
        FROM source_event
        LEFT JOIN LATERAL (
          SELECT permission.*
          FROM "Permission" permission
          WHERE permission."userGroupId" = source_event."sourceId"
            AND permission."id" > CASE
              WHEN ${input.after.relationMaxId}::integer IS NULL THEN 0
              ELSE ${input.after.relationId}
            END
            AND permission."id" <= source_event."relationMaxId"
          ORDER BY permission."id"
          LIMIT ${PERMISSION_PROPAGATION_SIGNAL_SOURCE_BATCH_SIZE}
        ) permission ON true
        ORDER BY COALESCE(permission."id", 0)
      `
      break
    case PermissionPropagationSignalSource.DIRECT_AUDIT:
      signals = await prisma.$queryRaw<PermissionPropagationSignal[]>`
        WITH source_page AS MATERIALIZED (
          SELECT audit.*
          FROM (
            VALUES
              ('CATALOG_COLLECTION'::"ObjectType"),
              ('ANSWER_COLLECTION'::"ObjectType"),
              ('ELEMENT'::"ObjectType"),
              ('COURSE'::"ObjectType"),
              ('LIVE_QUIZ'::"ObjectType"),
              ('PRACTICE_QUIZ'::"ObjectType"),
              ('MICRO_LEARNING'::"ObjectType"),
              ('GROUP_ACTIVITY'::"ObjectType")
          ) signal_type("objectType")
          CROSS JOIN LATERAL (
            SELECT audit.*
            FROM "AuditLogEntry" audit
            WHERE audit."objectType" = signal_type."objectType"
              AND audit."createdAt" <= ${input.through}
              AND (
                audit."createdAt" > ${input.after.through}
                OR (
                  audit."createdAt" = ${input.after.through}
                  AND ${input.after.sourceId}::integer IS NOT NULL
                  AND audit."id" > ${input.after.sourceId}
                )
              )
            ORDER BY audit."createdAt", audit."id"
            LIMIT ${PERMISSION_PROPAGATION_SIGNAL_SOURCE_BATCH_SIZE}
          ) audit
          ORDER BY audit."createdAt", audit."id"
          LIMIT ${PERMISSION_PROPAGATION_SIGNAL_SOURCE_BATCH_SIZE}
        )
        SELECT
          source_page."createdAt" AS "signalAt",
          source_page."id" AS "sourceId",
          0 AS "relationId",
          source_page."objectType",
          source_page."objectId"
        FROM source_page
        ORDER BY source_page."createdAt", source_page."id"
      `
      break
    case PermissionPropagationSignalSource.USER_GROUP_AUDIT:
      signals = await prisma.$queryRaw<PermissionPropagationSignal[]>`
        WITH continued_event AS MATERIALIZED (
          SELECT
            ${input.after.through}::timestamp AS "signalAt",
            audit."id" AS "sourceId",
            ${USER_GROUP_ID_FROM_AUDIT_OBJECT_ID} AS "userGroupId"
          FROM "AuditLogEntry" audit
          WHERE ${input.after.relationMaxId}::integer IS NOT NULL
            AND audit."id" = ${input.after.sourceId}
            AND audit."objectType" = 'USER_GROUP'
          LIMIT 1
        ),
        next_event AS MATERIALIZED (
          SELECT
            audit."createdAt" AS "signalAt",
            audit."id" AS "sourceId",
            ${USER_GROUP_ID_FROM_AUDIT_OBJECT_ID} AS "userGroupId"
          FROM "AuditLogEntry" audit
          WHERE ${input.after.relationMaxId}::integer IS NULL
            AND audit."objectType" = 'USER_GROUP'
            AND audit."createdAt" <= ${input.through}
            AND (
              audit."createdAt" > ${input.after.through}
              OR (
                audit."createdAt" = ${input.after.through}
                AND ${input.after.sourceId}::integer IS NOT NULL
                AND audit."id" > ${input.after.sourceId}
              )
            )
          ORDER BY audit."createdAt", audit."id"
          LIMIT 1
        ),
        source_event AS MATERIALIZED (
          SELECT
            event."signalAt",
            event."sourceId",
            event."userGroupId",
            COALESCE(
              ${input.after.relationMaxId}::integer,
              (
                SELECT MAX(permission."id")
                FROM "Permission" permission
                WHERE permission."userGroupId" = event."userGroupId"
              ),
              0
            ) AS "relationMaxId"
          FROM (
            SELECT * FROM continued_event
            UNION ALL
            SELECT * FROM next_event
          ) event
        )
        SELECT
          source_event."signalAt",
          source_event."sourceId",
          COALESCE(permission."id", 0) AS "relationId",
          source_event."relationMaxId",
          ${PERMISSION_OBJECT_SIGNAL_PROJECTION}
        FROM source_event
        LEFT JOIN LATERAL (
          SELECT permission.*
          FROM "Permission" permission
          WHERE permission."userGroupId" = source_event."userGroupId"
            AND permission."id" > CASE
              WHEN ${input.after.relationMaxId}::integer IS NULL THEN 0
              ELSE ${input.after.relationId}
            END
            AND permission."id" <= source_event."relationMaxId"
          ORDER BY permission."id"
          LIMIT ${PERMISSION_PROPAGATION_SIGNAL_SOURCE_BATCH_SIZE}
        ) permission ON true
        ORDER BY COALESCE(permission."id", 0)
      `
      break
    case PermissionPropagationSignalSource.ACTIVITY:
      signals = await prisma.$queryRaw<PermissionPropagationSignal[]>`
        SELECT
          activity."updatedAt" AS "signalAt",
          activity."id" AS "sourceId",
          0 AS "relationId",
          CASE
            WHEN activity."answerCollectionId" IS NOT NULL THEN 'ANSWER_COLLECTION'::"ObjectType"
            WHEN activity."elementId" IS NOT NULL THEN 'ELEMENT'::"ObjectType"
            WHEN activity."courseId" IS NOT NULL THEN 'COURSE'::"ObjectType"
            WHEN activity."liveQuizId" IS NOT NULL THEN 'LIVE_QUIZ'::"ObjectType"
            WHEN activity."practiceQuizId" IS NOT NULL THEN 'PRACTICE_QUIZ'::"ObjectType"
            WHEN activity."microLearningId" IS NOT NULL THEN 'MICRO_LEARNING'::"ObjectType"
            WHEN activity."groupActivityId" IS NOT NULL THEN 'GROUP_ACTIVITY'::"ObjectType"
          END AS "objectType",
          COALESCE(
            activity."answerCollectionId"::text,
            activity."elementId"::text,
            activity."courseId"::text,
            activity."liveQuizId"::text,
            activity."practiceQuizId"::text,
            activity."microLearningId"::text,
            activity."groupActivityId"::text
          ) AS "objectId"
        FROM "ActivityLogEntry" activity
        WHERE activity."updatedAt" <= ${input.through}
          AND (
            activity."updatedAt" > ${input.after.through}
            OR (
              activity."updatedAt" = ${input.after.through}
              AND ${input.after.sourceId}::integer IS NOT NULL
              AND activity."id" > ${input.after.sourceId}
            )
          )
        ORDER BY activity."updatedAt", activity."id"
        LIMIT ${PERMISSION_PROPAGATION_SIGNAL_SOURCE_BATCH_SIZE}
      `
      break
    case PermissionPropagationSignalSource.ELEMENT_INSTANCE:
      signals = await prisma.$queryRaw<PermissionPropagationSignal[]>`
        WITH source_page AS MATERIALIZED (
          SELECT
            instance."updatedAt" AS "signalAt",
            instance."id" AS "sourceId",
            instance."elementId",
            block."liveQuizId",
            stack."practiceQuizId",
            stack."microLearningId",
            stack."groupActivityId"
          FROM "ElementInstance" instance
          LEFT JOIN "ElementBlock" block
            ON block."id" = instance."elementBlockId"
          LEFT JOIN "ElementStack" stack
            ON stack."id" = instance."elementStackId"
          WHERE instance."updatedAt" <= ${input.through}
            AND (
              instance."updatedAt" > ${input.after.through}
              OR (
                instance."updatedAt" = ${input.after.through}
                AND ${input.after.sourceId}::integer IS NOT NULL
                AND instance."id" > ${input.after.sourceId}
              )
            )
          ORDER BY instance."updatedAt", instance."id"
          LIMIT ${PERMISSION_PROPAGATION_SIGNAL_SOURCE_BATCH_SIZE}
        )
        SELECT
          source_page."signalAt",
          source_page."sourceId",
          0 AS "relationId",
          object_signal."objectType",
          object_signal."objectId"
        FROM source_page
        CROSS JOIN LATERAL (
          VALUES
            ('ELEMENT'::"ObjectType", source_page."elementId"::text),
            ('LIVE_QUIZ'::"ObjectType", source_page."liveQuizId"::text),
            ('PRACTICE_QUIZ'::"ObjectType", source_page."practiceQuizId"::text),
            ('MICRO_LEARNING'::"ObjectType", source_page."microLearningId"::text),
            ('GROUP_ACTIVITY'::"ObjectType", source_page."groupActivityId"::text)
        ) object_signal("objectType", "objectId")
        WHERE object_signal."objectId" IS NOT NULL
        ORDER BY
          source_page."signalAt",
          source_page."sourceId",
          object_signal."objectType"
      `
      break
    case PermissionPropagationSignalSource.CATALOG_ASSIGNMENT:
      signals = await prisma.$queryRaw<PermissionPropagationSignal[]>`
        WITH source_page AS MATERIALIZED (
          SELECT *
          FROM "CatalogCollectionAssignment" assignment
          WHERE assignment."updatedAt" <= ${input.through}
            AND (
              assignment."updatedAt" > ${input.after.through}
              OR (
                assignment."updatedAt" = ${input.after.through}
                AND ${input.after.sourceId}::integer IS NOT NULL
                AND assignment."id" > ${input.after.sourceId}
              )
            )
          ORDER BY assignment."updatedAt", assignment."id"
          LIMIT ${PERMISSION_PROPAGATION_SIGNAL_SOURCE_BATCH_SIZE}
        )
        SELECT
          source_page."updatedAt" AS "signalAt",
          source_page."id" AS "sourceId",
          0 AS "relationId",
          object_signal."objectType",
          object_signal."objectId"
        FROM source_page
        CROSS JOIN LATERAL (
          VALUES
            ('CATALOG_COLLECTION'::"ObjectType", source_page."catalogCollectionId"::text),
            ('ANSWER_COLLECTION'::"ObjectType", source_page."answerCollectionId"::text),
            ('ELEMENT'::"ObjectType", source_page."elementId"::text),
            ('COURSE'::"ObjectType", source_page."courseId"::text),
            ('LIVE_QUIZ'::"ObjectType", source_page."liveQuizId"::text),
            ('PRACTICE_QUIZ'::"ObjectType", source_page."practiceQuizId"::text),
            ('MICRO_LEARNING'::"ObjectType", source_page."microLearningId"::text),
            ('GROUP_ACTIVITY'::"ObjectType", source_page."groupActivityId"::text)
        ) object_signal("objectType", "objectId")
        WHERE object_signal."objectId" IS NOT NULL
        ORDER BY
          source_page."updatedAt",
          source_page."id",
          object_signal."objectType"
      `
      break
    default: {
      const unreachable: never = source
      throw new Error(
        `Unsupported permission propagation signal source: ${unreachable}`
      )
    }
  }

  const positions = new Map<
    string,
    Pick<PermissionPropagationSignal, 'signalAt' | 'sourceId' | 'relationId'>
  >()
  for (const signal of signals) {
    if (signal.sourceId <= 0 || signal.relationId < 0) {
      throw new Error('Permission propagation signal position is invalid.')
    }
    positions.set(`${signal.sourceId}:${signal.relationId}`, signal)
  }
  const lastPosition = [...positions.values()].at(-1)
  const isFanoutSource =
    source === PermissionPropagationSignalSource.USER_GROUP ||
    source === PermissionPropagationSignalSource.USER_GROUP_AUDIT
  let cursor: PermissionPropagationSignalCursor
  if (isFanoutSource) {
    const firstPosition = signals.at(0)
    const relationMaxId = firstPosition?.relationMaxId
    if (
      firstPosition &&
      (relationMaxId === null ||
        relationMaxId === undefined ||
        signals.some(
          (signal) =>
            signal.sourceId !== firstPosition.sourceId ||
            signal.signalAt.getTime() !== firstPosition.signalAt.getTime() ||
            signal.relationMaxId !== relationMaxId
        ))
    ) {
      throw new Error('Permission propagation fanout page is invalid.')
    }
    if (!lastPosition) {
      cursor =
        input.after.relationMaxId === null
          ? {
              through: input.through,
              sourceId: null,
              relationId: null,
              relationMaxId: null,
            }
          : {
              through: input.after.through,
              sourceId: input.after.sourceId,
              relationId: 0,
              relationMaxId: null,
            }
    } else {
      if (relationMaxId === null || relationMaxId === undefined) {
        throw new Error('Permission propagation fanout page is invalid.')
      }
      // a zero position means the lateral join found no permission left in the
      // frozen window, so the fanout is exhausted even when the ceiling row was
      // deleted before it could be read; treating it as progress would reset the
      // sub-cursor to zero and pin this source on one event forever
      cursor =
        lastPosition.relationId > 0 && lastPosition.relationId < relationMaxId
          ? {
              through: lastPosition.signalAt,
              sourceId: lastPosition.sourceId,
              relationId: lastPosition.relationId,
              relationMaxId,
            }
          : {
              through: lastPosition.signalAt,
              sourceId: lastPosition.sourceId,
              relationId: 0,
              relationMaxId: null,
            }
    }
  } else {
    cursor =
      positions.size === PERMISSION_PROPAGATION_SIGNAL_SOURCE_BATCH_SIZE &&
      lastPosition
        ? {
            through: lastPosition.signalAt,
            sourceId: lastPosition.sourceId,
            relationId: lastPosition.relationId,
            relationMaxId: null,
          }
        : {
            through: input.through,
            sourceId: null,
            relationId: null,
            relationMaxId: null,
          }
  }

  return { cursor, signals }
}

async function collectRecentPermissionPropagationScopes(
  prisma: PrismaTransactionClient,
  through: Date
) {
  const cursorRows = await prisma.permissionPropagationSignalCursor.findMany()
  const cursorsBySource = new Map(
    cursorRows.map((cursor) => [cursor.source, cursor])
  )
  const signals: PermissionPropagationSignal[] = []

  for (const source of Object.values(PermissionPropagationSignalSource)) {
    const stored = cursorsBySource.get(source)
    const after = stored
      ? {
          through: stored.through,
          sourceId: stored.sourceId,
          relationId: stored.relationId,
          relationMaxId: stored.relationMaxId,
        }
      : {
          through,
          sourceId: null,
          relationId: null,
          relationMaxId: null,
        }
    const requestedThrough = through > after.through ? through : after.through
    const page = await collectPermissionPropagationSignalSourcePage(
      prisma,
      source,
      {
        after,
        through: requestedThrough,
      }
    )
    signals.push(...page.signals)
    await prisma.permissionPropagationSignalCursor.upsert({
      where: { source },
      create: {
        source,
        through: page.cursor.through,
        sourceId: page.cursor.sourceId,
        relationId: page.cursor.relationId,
        relationMaxId: page.cursor.relationMaxId,
      },
      update: {
        through: page.cursor.through,
        sourceId: page.cursor.sourceId,
        relationId: page.cursor.relationId,
        relationMaxId: page.cursor.relationMaxId,
      },
    })
  }

  const idsByType = new Map<PermissionPropagationObjectType, Set<string>>()
  for (const signal of signals) {
    if ((signal.objectType === null) !== (signal.objectId === null)) {
      throw new Error('Permission propagation signal is invalid.')
    }
    if (signal.objectType === null || signal.objectId === null) {
      continue
    }
    if (
      !isPermissionPropagationObjectType(signal.objectType) ||
      signal.objectId.length === 0
    ) {
      throw new Error('Permission propagation signal is invalid.')
    }
    const objectIds = idsByType.get(signal.objectType) ?? new Set<string>()
    objectIds.add(signal.objectId)
    idsByType.set(signal.objectType, objectIds)
  }

  const scopes: PermissionPropagationScope[] = []
  for (const [objectType, objectIds] of idsByType) {
    const existingIds = await existingPermissionPropagationObjectIds(
      prisma,
      objectType,
      [...objectIds]
    )
    scopes.push(
      ...existingIds.map((objectId) => ({
        objectType,
        objectId,
        mode: PermissionPropagationMode.OBJECT,
      }))
    )
  }

  return scopes
}

async function discoverPermissionPropagationWork(
  globalCtx: HatchetHandlerGlobalContext,
  includeFullSweep: boolean,
  now: Date
) {
  return globalCtx.prisma.$transaction(
    async (tx) => {
      await acquirePermissionPropagationFence(tx)
      const requestedSignalThrough = new Date(
        now.getTime() - PERMISSION_PROPAGATION_SIGNAL_SAFETY_LAG_MS
      )
      const state = await tx.permissionPropagationReconciliationState.upsert({
        where: { id: PERMISSION_PROPAGATION_RECONCILIATION_STATE_ID },
        create: {
          id: PERMISSION_PROPAGATION_RECONCILIATION_STATE_ID,
        },
        update: {},
      })
      if (
        !isPermissionPropagationObjectType(state.sampleObjectType) ||
        !isPermissionPropagationObjectType(state.fullSweepObjectType)
      ) {
        throw new Error(
          'Permission propagation reconciliation cursor type is invalid.'
        )
      }
      const recent = await collectRecentPermissionPropagationScopes(
        tx,
        requestedSignalThrough
      )
      const sample = await collectPermissionPropagationObjectBatch(
        tx,
        PermissionPropagationCursorKind.SAMPLE,
        {
          nextObjectType: state.sampleObjectType,
        },
        PERMISSION_PROPAGATION_REGULAR_SAMPLE_SIZE
      )
      const fullSweep = includeFullSweep
        ? await collectPermissionPropagationObjectBatch(
            tx,
            PermissionPropagationCursorKind.FULL_SWEEP,
            {
              nextObjectType: state.fullSweepObjectType,
            },
            PERMISSION_PROPAGATION_FULL_SWEEP_BATCH_SIZE
          )
        : undefined
      const scopesByKey = new Map<string, PermissionPropagationScope>()
      for (const scope of [
        ...recent,
        ...sample.scopes,
        ...(fullSweep?.scopes ?? []),
      ]) {
        scopesByKey.set(permissionPropagationKey(scope), scope)
      }

      for (const scope of scopesByKey.values()) {
        await upsertPermissionPropagationWork(tx, {
          scope,
          updateAccessRequests: true,
          dirtyAt: now,
        })
      }

      await tx.permissionPropagationReconciliationState.update({
        where: { id: state.id },
        data: {
          sampleObjectType: sample.cursor.nextObjectType,
          ...(fullSweep
            ? {
                fullSweepObjectType: fullSweep.cursor.nextObjectType,
              }
            : {}),
        },
      })

      return scopesByKey.size
    },
    { timeout: PERMISSION_PROPAGATION_TRANSACTION_TIMEOUT_MS }
  )
}

export async function reconcilePendingPermissionPropagationWork(
  globalCtx: HatchetHandlerGlobalContext,
  executionCtx: Context<unknown>,
  now: Date = new Date()
) {
  const overdue = await globalCtx.prisma.$queryRaw<PermissionPropagationWork[]>`
    SELECT work.*
    FROM "PermissionPropagationWork" work
    WHERE work."processedGeneration" < work."generation"
      AND work."recoverBy" <= ${now}
      AND NOT EXISTS (
        SELECT 1
        FROM "PermissionPropagationFailure" failure
        WHERE failure."workKey" = work."key"
          AND failure."generation" = work."generation"
          AND failure."code" =
            ${PermissionPropagationFailureCode.RECOVERY_SLO_BREACHED}::"PermissionPropagationFailureCode"
      )
    ORDER BY work."recoverBy" ASC, work."key" ASC
    LIMIT ${PERMISSION_PROPAGATION_DISPATCH_BATCH_SIZE}
  `
  for (const work of overdue) {
    await persistPermissionPropagationFailure(globalCtx, executionCtx, {
      workKey: work.key,
      generation: work.generation,
      code: PermissionPropagationFailureCode.RECOVERY_SLO_BREACHED,
    })
  }

  const redispatchBefore = new Date(
    now.getTime() - PERMISSION_PROPAGATION_REDISPATCH_MS
  )
  const candidates = await globalCtx.prisma.$queryRaw<
    PermissionPropagationWork[]
  >`
      SELECT *
      FROM "PermissionPropagationWork"
      WHERE "processedGeneration" < "generation"
        AND (
          "dispatchedGeneration" < "generation"
          OR "lastDispatchedAt" IS NULL
          OR "lastDispatchedAt" <= ${redispatchBefore}
        )
      ORDER BY "recoverBy" ASC, "key" ASC
      LIMIT ${PERMISSION_PROPAGATION_DISPATCH_BATCH_SIZE}
    `
  let dispatchedWorkCount = 0
  let failedDispatchCount = 0

  for (const work of candidates) {
    try {
      await globalCtx.hatchet.runNoWait<PermissionPropagationTaskInput>(
        'permission-propagation',
        {
          workKey: work.key,
          taskGeneration: work.generation.toString(),
        },
        {}
      )
      await markPermissionPropagationDispatched(globalCtx.prisma, {
        key: work.key,
        generation: work.generation,
        acceptedAt: now,
      })
      dispatchedWorkCount += 1
    } catch {
      failedDispatchCount += 1
      await persistPermissionPropagationFailure(globalCtx, executionCtx, {
        workKey: work.key,
        generation: work.generation,
        code: PermissionPropagationFailureCode.DISPATCH_FAILED,
      })
      executionCtx.logger.error(
        'Permission propagation dispatch failed; inspect durable failure state.'
      )
    }
  }

  return { dispatchedWorkCount, failedDispatchCount }
}

export async function handlePermissionPropagationReconciliation(
  input: PermissionPropagationReconciliationTaskInput,
  globalCtx: HatchetHandlerGlobalContext,
  executionCtx: Context<unknown>
): Promise<PermissionPropagationReconciliationTaskResult> {
  if (input.mode !== 'regular' && input.mode !== 'full-sweep') {
    throw new Error('Permission propagation reconciliation mode is invalid.')
  }

  const now = new Date()
  const discoveredWorkCount = await discoverPermissionPropagationWork(
    globalCtx,
    input.mode === 'full-sweep',
    now
  )
  const { dispatchedWorkCount, failedDispatchCount } =
    await reconcilePendingPermissionPropagationWork(
      globalCtx,
      executionCtx,
      now
    )

  return {
    discoveredWorkCount: String(discoveredWorkCount),
    dispatchedWorkCount: String(dispatchedWorkCount),
    failedDispatchCount: String(failedDispatchCount),
  }
}
