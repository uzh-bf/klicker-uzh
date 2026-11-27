import * as DB from '@klicker-uzh/prisma/client'
import type { PrismaTransactionClient } from '../types.js'
import { permissionLevelMap } from './constants.js'
import { getMaxAccessLevelCombined } from './util.js'

/**
 * Direct grants that the generic sharing surfaces may create. Owners receive
 * OWNER through the object row and cannot receive another direct owner grant.
 */
export const SHARED_OBJECT_PERMISSION_LEVELS = [
  DB.PermissionLevel.READ,
  DB.PermissionLevel.WRITE,
  DB.PermissionLevel.ADMIN,
] as const

export const SHARED_OBJECT_TYPES = [
  DB.ObjectType.KB,
  DB.ObjectType.CHATBOT,
] as const

export type SharedObjectType = (typeof SHARED_OBJECT_TYPES)[number]

export function sharedObjectDirectPermissionWhere() {
  return {
    permissionLevel: { in: [...SHARED_OBJECT_PERMISSION_LEVELS] },
  } satisfies DB.Prisma.PermissionWhereInput
}

export function sharedObjectUserPermissionWhere(userId: string) {
  return {
    ...sharedObjectDirectPermissionWhere(),
    OR: [
      { userId },
      {
        userGroup: {
          OR: [
            { ownerId: userId },
            { members: { some: { id: userId } } },
            { admins: { some: { id: userId } } },
          ],
        },
      },
    ],
  } satisfies DB.Prisma.PermissionWhereInput
}

export type SharedObjectIdentity = {
  objectType: SharedObjectType
  objectId: string
}

export type SharedObjectUserGrants = {
  ownerId: string
  deletedAt?: Date | null
  directPermissions: DB.Permission[]
}

export type SharedObjectObjectGrants = SharedObjectUserGrants & {
  directPermissions: (DB.Permission & {
    userGroup: (DB.UserGroup & { members: DB.User[]; admins: DB.User[] }) | null
  })[]
}

function derivedPermissionWhere(
  { objectType, objectId }: SharedObjectIdentity,
  userId: string
): DB.Prisma.DerivedPermissionWhereUniqueInput {
  return objectType === DB.ObjectType.KB
    ? { kbId_userId: { kbId: objectId, userId } }
    : { chatbotId_userId: { chatbotId: objectId, userId } }
}

function derivedPermissionObjectWhere({
  objectType,
  objectId,
}: SharedObjectIdentity): DB.Prisma.DerivedPermissionWhereInput {
  return objectType === DB.ObjectType.KB
    ? { kbId: objectId }
    : { chatbotId: objectId }
}

function derivedPermissionObjectRelation({
  objectType,
  objectId,
}: SharedObjectIdentity): Pick<
  DB.Prisma.DerivedPermissionCreateInput,
  'kb' | 'chatbot'
> {
  return objectType === DB.ObjectType.KB
    ? { kb: { connect: { id: objectId } } }
    : { chatbot: { connect: { id: objectId } } }
}

async function upsertSharedObjectPermission(
  {
    identity,
    userId,
    permissionLevel,
    directPermissionId,
  }: {
    identity: SharedObjectIdentity
    userId: string
    permissionLevel: DB.PermissionLevel
    directPermissionId?: number
  },
  prisma: PrismaTransactionClient
) {
  const directPermission =
    typeof directPermissionId !== 'undefined'
      ? { connect: { id: directPermissionId } }
      : undefined

  await prisma.derivedPermission.upsert({
    where: derivedPermissionWhere(identity, userId),
    create: {
      permissionLevel,
      derived: false,
      directPermission,
      user: { connect: { id: userId } },
      ...derivedPermissionObjectRelation(identity),
    },
    update: {
      permissionLevel,
      derived: false,
      directPermission: directPermission ?? { disconnect: true },
    },
  })
}

export async function recomputeSharedObjectPermissionsUser(
  {
    identity,
    grants,
    userId,
  }: {
    identity: SharedObjectIdentity
    grants: SharedObjectUserGrants
    userId: string
  },
  prisma: PrismaTransactionClient
) {
  const existingPermission = await prisma.derivedPermission.findUnique({
    where: derivedPermissionWhere(identity, userId),
  })
  const access = resolveSharedObjectPermission({
    ownerId: grants.ownerId,
    objectDeleted: Boolean(grants.deletedAt),
    userId,
    directPermissions: grants.directPermissions,
  })

  if (!access) {
    if (existingPermission) {
      await prisma.derivedPermission.delete({
        where: derivedPermissionWhere(identity, userId),
      })
    }
    return
  }

  if (
    existingPermission &&
    existingPermission.permissionLevel === access.permissionLevel &&
    !existingPermission.derived &&
    existingPermission.directPermissionId ===
      (access.directPermissionId ?? null)
  ) {
    return
  }

  await upsertSharedObjectPermission(
    {
      identity,
      userId,
      permissionLevel: access.permissionLevel,
      directPermissionId: access.directPermissionId,
    },
    prisma
  )
}

export async function recomputeSharedObjectPermissionsObject(
  {
    identity,
    grants,
  }: {
    identity: SharedObjectIdentity
    grants: SharedObjectObjectGrants
  },
  prisma: PrismaTransactionClient
) {
  const objectDeleted = Boolean(grants.deletedAt)
  const userAccess = getMaxAccessLevelCombined({
    directPermissions: objectDeleted ? [] : grants.directPermissions,
    objectDeleted,
    ownerId: grants.ownerId,
  })

  await prisma.derivedPermission.deleteMany({
    where: {
      ...derivedPermissionObjectWhere(identity),
      userId: { notIn: Object.keys(userAccess) },
    },
  })

  const results = await Promise.allSettled(
    Object.entries(userAccess).map(
      async ([userId, { maxAccessLevel, parentPermissionId }]) =>
        await upsertSharedObjectPermission(
          {
            identity,
            userId,
            permissionLevel: maxAccessLevel,
            directPermissionId: parentPermissionId,
          },
          prisma
        )
    )
  )

  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  )
  if (rejected.length > 0) {
    throw new Error(
      `Failed to update derived permissions for ${identity.objectType} (ID: ${identity.objectId}): ${rejected
        .map((result) => result.reason?.message ?? 'Unknown error')
        .join(', ')}`
    )
  }
}

export function isSharedObjectPermissionLevel(
  permissionLevel: DB.PermissionLevel
): permissionLevel is (typeof SHARED_OBJECT_PERMISSION_LEVELS)[number] {
  return SHARED_OBJECT_PERMISSION_LEVELS.some(
    (level) => level === permissionLevel
  )
}

/**
 * Resolves effective access from the owner and committed direct or group
 * grants. Derived rows are deliberately not used because they can lag behind
 * a group-membership or grant change.
 */
export function resolveSharedObjectPermission({
  ownerId,
  userId,
  directPermissions,
  objectDeleted = false,
}: {
  ownerId: string
  userId: string
  directPermissions: Pick<DB.Permission, 'id' | 'permissionLevel'>[]
  objectDeleted?: boolean
}): {
  permissionLevel: DB.PermissionLevel
  directPermissionId?: number
} | null {
  if (objectDeleted) {
    return null
  }

  if (ownerId === userId) {
    return { permissionLevel: DB.PermissionLevel.OWNER }
  }

  const highest = directPermissions.reduce<{
    permissionLevel?: DB.PermissionLevel
    directPermissionId?: number
  }>((current, permission) => {
    if (!isSharedObjectPermissionLevel(permission.permissionLevel)) {
      return current
    }

    if (
      !current.permissionLevel ||
      permissionLevelMap[permission.permissionLevel] >
        permissionLevelMap[current.permissionLevel]
    ) {
      return {
        permissionLevel: permission.permissionLevel,
        directPermissionId: permission.id,
      }
    }

    return current
  }, {})

  return highest.permissionLevel
    ? {
        permissionLevel: highest.permissionLevel,
        directPermissionId: highest.directPermissionId,
      }
    : null
}

/**
 * Runtime permission lookup for KB and chatbot consumers. The predicate reads
 * the owner column and current user or group grants in one query. It returns
 * only the effective level, not grant targets or group membership details.
 */
export async function getPositiveObjectPermission(
  {
    objectType,
    objectId,
    userId,
    excludeDirectPermissionId,
  }: {
    objectType: SharedObjectType
    objectId: string
    userId: string
    excludeDirectPermissionId?: number
  },
  prisma: PrismaTransactionClient
): Promise<DB.PermissionLevel | null> {
  const directPermissions = {
    where: {
      permissionLevel: { in: [...SHARED_OBJECT_PERMISSION_LEVELS] },
      id: excludeDirectPermissionId
        ? { not: excludeDirectPermissionId }
        : undefined,
      OR: [
        { userId },
        {
          userGroup: {
            OR: [
              { ownerId: userId },
              { members: { some: { id: userId } } },
              { admins: { some: { id: userId } } },
            ],
          },
        },
      ],
    },
    select: { id: true, permissionLevel: true },
  } satisfies DB.Prisma.PermissionFindManyArgs

  if (objectType === DB.ObjectType.KB) {
    const kb = await prisma.kB.findUnique({
      where: { id: objectId },
      select: {
        ownerId: true,
        deletedAt: true,
        directPermissions,
      },
    })

    return kb
      ? (resolveSharedObjectPermission({
          ownerId: kb.ownerId,
          userId,
          directPermissions: kb.directPermissions,
          objectDeleted: kb.deletedAt !== null,
        })?.permissionLevel ?? null)
      : null
  }

  if (objectType === DB.ObjectType.CHATBOT) {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: objectId },
      select: {
        ownerId: true,
        directPermissions,
      },
    })

    return chatbot
      ? (resolveSharedObjectPermission({
          ownerId: chatbot.ownerId,
          userId,
          directPermissions: chatbot.directPermissions,
        })?.permissionLevel ?? null)
      : null
  }

  return null
}
