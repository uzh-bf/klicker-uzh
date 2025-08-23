/**
 * Derived permission recomputation for Catalog Collections in KlickerUZH:
 * - recomputeCatalogCollectionPermissions: dispatches to user/object variants.
 * - recomputeCatalogCollectionPermissionsUser: recomputes for a specific user.
 * - recomputeCatalogCollectionPermissionsObject: recomputes for all users.
 */
import * as DB from '@klicker-uzh/prisma/dist/client.js'
import {
  MISSING_CATALOG_COLLECTION_ID,
  type PrismaTransactionClient,
} from '../types.js'
import { updateAccessRequestInstances } from './accessRequest.js'
import { inversePermissionLevelMap } from './constants.js'
import {
  getMaxAccessLevelCombined,
  getMaxAccessLevelIndividual,
} from './util.js'

/**
 * Dispatch function for the recomputation of derived permissions for catalog collections
 *
 * Based on the provided parameters, this function delegates to either user-specific
 * or object-wide permission recomputation for catalog collections.
 *
 * @param params - Object containing catalog collection ID and optional user ID
 * @param params.id - ID of the catalog collection
 * @param params.userId - Optional user ID to limit recomputation to a specific user
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 * @returns Promise that resolves when the permission recomputation completes
 */
export async function recomputeCatalogCollectionPermissions(
  {
    id,
    userId,
    updateAccessRequests,
  }: { id: string; userId?: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  // for the top-level default catalog collection, no permissions are awarded
  if (id === MISSING_CATALOG_COLLECTION_ID) {
    return
  }

  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputeCatalogCollectionPermissionsUser(
      { id, userId, updateAccessRequests },
      prisma
    )
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeCatalogCollectionPermissionsObject(
    { id, updateAccessRequests },
    prisma
  )
}

/**
 * Recomputes derived permissions for a specific user on a catalog collection.
 *
 * After removing any existing derived permission for the user, this function checks
 * if the user has a direct permission on the catalog collection, is part of a group
 * with a direct permission or is the owner of the object. The corresponding highest
 * permission is then stored in the form of a derived permission (deduplicated).
 *
 * @param params - Object containing catalog collection ID and user ID
 * @param params.id - ID of the catalog collection
 * @param params.userId - ID of the user to recompute permissions for
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */

export async function recomputeCatalogCollectionPermissionsUser(
  {
    id,
    userId,
    updateAccessRequests,
  }: { id: string; userId: string; updateAccessRequests: boolean },
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
                OR: [
                  { ownerId: userId },
                  { members: { some: { id: userId } } },
                  { admins: { some: { id: userId } } },
                ],
              },
            },
          ],
        },
      },
    },
  })

  // if the catalog collection does not exist, return
  if (!catalogCollection) {
    return
  }

  // determine the maximum access level of the user
  let maxAccessLevel: DB.PermissionLevel | undefined = undefined
  let parentPermissionId: number | undefined = undefined

  if (catalogCollection.ownerId === userId) {
    maxAccessLevel = DB.PermissionLevel.OWNER
  } else if (catalogCollection.directPermissions.length > 0) {
    // determine the highest available direct permission level
    const { maxDirectPermission, directPermissionId } =
      getMaxAccessLevelIndividual({
        directPermissions: catalogCollection.directPermissions,
      })

    maxAccessLevel = inversePermissionLevelMap[maxDirectPermission]
    parentPermissionId = directPermissionId
  } else {
    if (updateAccessRequests) {
      // remove any access requests that might have been created
      await prisma.accessRequest.deleteMany({
        where: {
          catalogCollectionId: id,
          objectAdminOrOwnerId: userId,
        },
      })
    }

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

    // no permission found that would justify access
    return
  }

  // if the user still has access, add a corresponding derived permission
  if (
    typeof maxAccessLevel !== 'undefined' &&
    (!existingPermission ||
      existingPermission.permissionLevel !== maxAccessLevel ||
      existingPermission.directPermissionId !== parentPermissionId)
  ) {
    await prisma.derivedPermission.upsert({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: id,
          userId,
        },
      },
      create: {
        permissionLevel: maxAccessLevel,
        directPermission:
          typeof parentPermissionId !== 'undefined'
            ? { connect: { id: parentPermissionId } }
            : undefined,
        catalogCollection: { connect: { id } },
        user: { connect: { id: userId } },
      },
      update: {
        permissionLevel: maxAccessLevel,
        directPermission:
          typeof parentPermissionId !== 'undefined'
            ? { connect: { id: parentPermissionId } }
            : { disconnect: true },
      },
    })
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { catalogCollectionId: id, userId },
      prisma
    )
  }

  return
}

/**
 * Recomputes derived permissions for all users on a catalog collection.
 *
 * This function deletes all existing derived permissions for the catalog collection
 * and then recomputes them based on all direct permissions that were granted to users
 * or user groups. Permissions are directly deduplicated for the derived permissions
 * table to only contain the highest permission level for each user.
 *
 * @param params - Object containing catalog collection ID
 * @param params.id - ID of the catalog collection
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeCatalogCollectionPermissionsObject(
  { id, updateAccessRequests }: { id: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
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
              admins: true,
            },
          },
        },
      },
    },
  })

  if (!catalogCollection) {
    console.error(`Catalog collection with id ${id} not found`)
    return
  }

  // determine the maximum access level for each user with individual permissions or inside a user group
  const userAccess = getMaxAccessLevelCombined({
    directPermissions: catalogCollection.directPermissions,
    objectDeleted: false, // soft-deletion not supported for catalog collections
    ownerId: catalogCollection.ownerId,
  })

  // remove the derived permissions for all users that do not have access (anymore)
  await prisma.derivedPermission.deleteMany({
    where: {
      catalogCollectionId: id,
      userId: {
        notIn: Object.keys(userAccess),
      },
    },
  })

  // create / update derived permissions for each user with access
  const results = await Promise.allSettled(
    Object.entries(userAccess).map(
      async ([userId, { maxAccessLevel, parentPermissionId }]) =>
        await prisma.derivedPermission.upsert({
          where: {
            catalogCollectionId_userId: {
              catalogCollectionId: id,
              userId,
            },
          },
          create: {
            permissionLevel: maxAccessLevel,
            directPermission:
              typeof parentPermissionId !== 'undefined'
                ? { connect: { id: parentPermissionId } }
                : undefined,
            catalogCollection: { connect: { id } },
            user: { connect: { id: userId } },
          },
          update: {
            permissionLevel: maxAccessLevel,
            directPermission:
              typeof parentPermissionId !== 'undefined'
                ? { connect: { id: parentPermissionId } }
                : { disconnect: true },
          },
        })
    )
  )

  // check if any promise was rejected and throw an error
  const rejectedPromises = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  )
  if (rejectedPromises.length > 0) {
    throw new Error(
      `Failed to update derived permissions for catalog collection (ID: ${catalogCollection.id}): ${rejectedPromises
        .map((result) => result.reason?.message || 'Unknown error')
        .join(', ')}`
    )
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances({ catalogCollectionId: id }, prisma)
  }
}
