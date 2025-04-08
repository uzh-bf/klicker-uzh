import * as DB from '@klicker-uzh/prisma'
import { MISSING_CATALOG_COLLECTION_ID } from './sharing.js'
import { PrismaTransactionClient } from './stacks.js'

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
  } else if (typeof userGroupId !== 'undefined') {
    // TODO: implement once user groups are supported
  }

  // if no user or user group is defined, recompute derived permissions for all users & user groups
  // TODO
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
  if (catalogCollection?.ownerId === userId) {
    maxAccessLevel = DB.PermissionLevel.OWNER
  } else if (catalogCollection.directPermissions.length > 0) {
    const { maxDirectPermission, directPermissionId } =
      catalogCollection.directPermissions.reduce<{
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
