import * as DB from '@klicker-uzh/prisma'
import { MISSING_CATALOG_COLLECTION_ID } from './sharing.js'
import { PrismaTransactionClient } from './stacks.js'

// auxilary type definitions
type UserAccessMap = {
  [userId: string]: {
    maxAccessLevel: DB.PermissionLevel
    parentPermissionId: number | undefined
  }
}

// map to directly compare permission levels
const permissionLevelMap = {
  [DB.PermissionLevel.OWNER]: 5,
  [DB.PermissionLevel.ADMIN]: 4,
  [DB.PermissionLevel.WRITE]: 3,
  [DB.PermissionLevel.EXECUTE]: 2,
  [DB.PermissionLevel.READ]: 1,
  ['NONE']: 0,
}
const inversePermissionLevelMap = {
  0: undefined,
  1: DB.PermissionLevel.READ,
  2: DB.PermissionLevel.EXECUTE,
  3: DB.PermissionLevel.WRITE,
  4: DB.PermissionLevel.ADMIN,
  5: DB.PermissionLevel.OWNER,
}

// ! Generic entry point for derived permission recomputation
export async function recomputeDerivedPermissions(
  {
    // object ids - exactly one must be defined
    catalogCollectionId,
    answerCollectionId,
    elementId,
    courseId,
    liveQuizId,
    practiceQuizId,
    microLearningId,
    groupActivityId,
    // optional user or user group ids that limit the recomputation
    userId,
    userGroupId,
    // parameter to determine whether propagation of permissions is enabled
    // (this parameter only has an effect for select object types)
    propagation = false,
  }: {
    catalogCollectionId?: string
    answerCollectionId?: number
    elementId?: number
    courseId?: string
    liveQuizId?: string
    practiceQuizId?: string
    microLearningId?: string
    groupActivityId?: string
    userId?: string
    userGroupId?: number
    propagation?: boolean
  } & (
    | { catalogCollectionId: string }
    | { answerCollectionId: number }
    | { elementId: number }
    | { courseId: string }
    | { liveQuizId: string }
    | { practiceQuizId: string }
    | { microLearningId: string }
    | { groupActivityId: string }
  ),
  prisma: PrismaTransactionClient
) {
  if (typeof catalogCollectionId !== 'undefined') {
    await recomputeCatalogCollectionPermissions(
      {
        id: catalogCollectionId,
        userId,
        userGroupId,
      },
      prisma
    )
  } else if (typeof answerCollectionId !== 'undefined') {
    // TODO: call corresponding function
    // TODO: when implementing recompute for all derived permissions of an answer collection, make sure to also set the derived ones based on the linked elements
  } else if (typeof elementId !== 'undefined') {
    // TODO: call corresponding function
  } else if (typeof courseId !== 'undefined') {
    // TODO: call corresponding function
  } else if (typeof liveQuizId !== 'undefined') {
    // TODO: call corresponding function
  } else if (typeof practiceQuizId !== 'undefined') {
    // TODO: call corresponding function
  } else if (typeof microLearningId !== 'undefined') {
    // TODO: call corresponding function
  } else if (typeof groupActivityId !== 'undefined') {
    // TODO: call corresponding function
  } else {
    throw new Error('No object id defined')
  }
}

// ! Derived permission recomputation for catalog collections
// #region
async function recomputeCatalogCollectionPermissions(
  {
    id,
    userId,
    userGroupId,
  }: {
    id: string
    userId?: string
    userGroupId?: number
  },
  prisma: PrismaTransactionClient
) {
  // for the top-level default catalog collection, no permissions are awarded
  if (id === MISSING_CATALOG_COLLECTION_ID) {
    return null
  }

  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputeCatalogCollectionPermissionsUser(
      { id, userId },
      prisma
    )
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeCatalogCollectionPermissionsObject({ id }, prisma)
}

async function recomputeCatalogCollectionPermissionsUser(
  { id, userId }: { id: string; userId: string },
  prisma: PrismaTransactionClient
) {
  // check if a permission for this user exists
  const existingPermission = await prisma.derivedPermission.findUnique({
    where: {
      catalogCollectionId_userId: {
        catalogCollectionId: id,
        userId,
      },
    },
  })

  // if a derived permission exists, remove it
  if (existingPermission) {
    await prisma.derivedPermission.delete({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: id,
          userId,
        },
      },
    })
  }

  // check if the user is the owner of the catalog collection or has a direct permission
  const catalogCollection = await prisma.catalogCollection.findUnique({
    where: {
      id,
    },
    include: {
      directPermissions: {
        where: {
          OR: [
            { userId },
            {
              userGroup: {
                members: {
                  some: {
                    id: userId,
                  },
                },
              },
            },
          ],
        },
      },
    },
  })

  // if the catalog collection does not exist, return null
  if (!catalogCollection) {
    return null
  }

  // determine the maximum access level of the user
  let maxAccessLevel: DB.PermissionLevel | undefined = undefined
  let parentPermissionId: number | undefined = undefined
  if (catalogCollection.ownerId === userId) {
    maxAccessLevel = DB.PermissionLevel.OWNER
  } else if (catalogCollection.directPermissions.length > 0) {
    const { maxDirectPermission, directPermissionId } =
      getMaxAccessLevelIndividual({
        directPermissions: catalogCollection.directPermissions,
      })
    maxAccessLevel = inversePermissionLevelMap[maxDirectPermission]
    parentPermissionId = directPermissionId
  } else {
    // no permission found that would justify access
    return null
  }

  // if the user still has access, add a corresponding derived permission
  if (typeof maxAccessLevel !== 'undefined') {
    const derivedPermission = await prisma.derivedPermission.create({
      data: {
        permissionLevel: maxAccessLevel,
        catalogCollection: {
          connect: {
            id,
          },
        },
        directPermission:
          typeof parentPermissionId !== 'undefined'
            ? {
                connect: {
                  id: parentPermissionId,
                },
              }
            : undefined,
        user: {
          connect: {
            id: userId,
          },
        },
      },
    })

    return derivedPermission
  }

  return null
}

async function recomputeCatalogCollectionPermissionsObject(
  { id }: { id: string },
  prisma: PrismaTransactionClient
) {
  // delete all derived permissions for this catalog collection
  await prisma.derivedPermission.deleteMany({
    where: {
      catalogCollectionId: id,
    },
  })

  // fetch the object and all direct permissions on it, including user groups
  const catalogCollection = await prisma.catalogCollection.findUnique({
    where: {
      id,
    },
    include: {
      directPermissions: {
        include: {
          userGroup: {
            include: {
              members: true,
            },
          },
        },
      },
    },
  })

  if (!catalogCollection || !catalogCollection.ownerId) {
    throw new Error(`Catalog collection with id ${id} not found`)
  }

  // determine the maximum access level for each user with individual permissions or inside a user group
  const userAccess = getMaxAccessLevelCombined({
    directPermissions: catalogCollection.directPermissions,
    ownerId: catalogCollection.ownerId,
  })

  // create derived permissions for each user with access
  await prisma.derivedPermission.createMany({
    data: Object.entries(userAccess).map(
      ([userId, { maxAccessLevel, parentPermissionId }]) => ({
        permissionLevel: maxAccessLevel,
        userId,
        catalogCollectionId: id,
        directPermissionId: parentPermissionId,
      })
    ),
  })
}
// #endregion

// ! Generic helper functions for maximum access level determination
function getMaxAccessLevelIndividual({
  directPermissions,
}: {
  directPermissions: DB.Permission[]
}) {
  return directPermissions.reduce<{
    maxDirectPermission: number
    directPermissionId: number | undefined
  }>(
    (acc, directPermission) => {
      if (
        permissionLevelMap[directPermission.permissionLevel] >
        acc.maxDirectPermission
      ) {
        return {
          maxDirectPermission:
            permissionLevelMap[directPermission.permissionLevel],
          directPermissionId: directPermission.id,
        }
      } else {
        return acc
      }
    },
    {
      maxDirectPermission: permissionLevelMap['NONE'],
      directPermissionId: undefined,
    }
  )
}

function getMaxAccessLevelCombined({
  directPermissions,
  ownerId,
}: {
  directPermissions: (DB.Permission & {
    userGroup?: (DB.UserGroup & { members: DB.User[] }) | null
  })[]
  ownerId: string
}) {
  const userAccess = directPermissions.reduce<UserAccessMap>(
    (acc, directPermission) => {
      if (directPermission.userId) {
        // if user already has a permission, check if the new one is higher
        if (
          typeof acc[directPermission.userId] !== 'undefined' &&
          permissionLevelMap[directPermission.permissionLevel] >
            permissionLevelMap[acc[directPermission.userId]!.maxAccessLevel]
        ) {
          acc[directPermission.userId]!.maxAccessLevel =
            directPermission.permissionLevel
          acc[directPermission.userId]!.parentPermissionId = directPermission.id
        }

        // if user does not have a permission yet, add it
        if (typeof acc[directPermission.userId] === 'undefined') {
          acc[directPermission.userId] = {
            maxAccessLevel: directPermission.permissionLevel,
            parentPermissionId: directPermission.id,
          }
        }
      } else if (directPermission.userGroup) {
        // iterate over the members and add / update the corresponding permissions for each user
        directPermission.userGroup.members.forEach((user) => {
          if (
            typeof acc[user.id] !== 'undefined' &&
            permissionLevelMap[directPermission.permissionLevel] >
              permissionLevelMap[acc[user.id]!.maxAccessLevel]
          ) {
            acc[user.id]!.maxAccessLevel = directPermission.permissionLevel
            acc[user.id]!.parentPermissionId = directPermission.id
          }

          if (typeof acc[user.id] === 'undefined') {
            acc[user.id] = {
              maxAccessLevel: directPermission.permissionLevel,
              parentPermissionId: directPermission.id,
            }
          }
        })
      } else {
        throw new Error(
          `Direct permission without user or user group found for catalog collection.`
        )
      }

      return acc
    },
    {
      [ownerId]: {
        maxAccessLevel: DB.PermissionLevel.OWNER,
        parentPermissionId: undefined,
      },
    }
  )

  return userAccess
}
