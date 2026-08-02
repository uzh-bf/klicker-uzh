import {
  ObjectType,
  PermissionPropagationMode,
  type PermissionPropagationWork,
} from '@klicker-uzh/prisma/client'
import type { PrismaTransactionClient } from '@klicker-uzh/util'

export const PERMISSION_PROPAGATION_RECOVERY_SLO_MS = 5 * 60 * 1000

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
