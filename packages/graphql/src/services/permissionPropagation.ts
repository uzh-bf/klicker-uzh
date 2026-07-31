import type { Context } from '@hatchet-dev/typescript-sdk'
import {
  ObjectType,
  PermissionPropagationFailureCode,
  PermissionPropagationMode,
  type PermissionPropagationWork,
} from '@klicker-uzh/prisma/client'
import type {
  HatchetHandlerGlobalContext,
  PermissionPropagationTaskInput,
  PermissionPropagationTaskResult,
} from '@klicker-uzh/types'
import {
  recomputeDerivedPermissions,
  type PrismaTransactionClient,
} from '@klicker-uzh/util'

export const PERMISSION_PROPAGATION_RECOVERY_SLO_MS = 5 * 60 * 1000
const PERMISSION_PROPAGATION_TRANSACTION_TIMEOUT_MS = 60_000

export type PermissionPropagationObjectType = Exclude<
  ObjectType,
  typeof ObjectType.USER_GROUP
>

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

// a scope we are about to recompute must fail loudly, since silently skipping it
// would leave the derived permissions of a real object stale behind a green tick
function parseNumericObjectId(objectId: string) {
  if (!/^[1-9]\d*$/.test(objectId) || !Number.isSafeInteger(Number(objectId))) {
    throw new Error('Permission propagation numeric object ID is invalid.')
  }

  return Number(objectId)
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
