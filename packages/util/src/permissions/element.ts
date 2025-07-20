/**
 * Derived permission recomputation for Elements in KlickerUZH:
 * - recomputeElementPermissions: dispatches to user/object variant.
 * - recomputeElementPermissionsUser: recompute derived permissions for a specific user.
 * - recomputeElementPermissionsObject: recompute derived permissions for all users.
 */

import * as DB from '@klicker-uzh/prisma'
import { type PrismaTransactionClient } from '../types.js'
import { updateAccessRequestInstances } from './accessRequest.js'
import {
  recomputeAnswerCollectionPermissionsObject,
  recomputeAnswerCollectionPermissionsUser,
} from './answerCollection.js'
import { inversePermissionLevelMap, type UserAccessMap } from './constants.js'
import {
  getMaxAccessLevelCombined,
  getMaxAccessLevelIndividual,
} from './util.js'

// WHERE clause component to filter relevant activities, which would result in permissions on the contained elements
const ACTIVITY_PERMISSIONS_WHERE_CLAUSE = [
  // ? ADMIN / OWNER permissions on activity
  {
    permissionLevel: {
      in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
    },
  },
  // ? propagation enabled & READ / WRITE / EXECUTE permissions on activity
  // --> if this is modified, the logic in the function body below also needs to be adapted
  {
    permissionLevel: {
      in: [
        DB.PermissionLevel.READ,
        DB.PermissionLevel.EXECUTE,
        DB.PermissionLevel.WRITE,
      ],
    },
    directPermission: {
      propagation: true,
      OR: [
        { liveQuizId: { not: null } },
        { practiceQuizId: { not: null } },
        { microLearningId: { not: null } },
        { groupActivityId: { not: null } },
      ],
    },
  },
]

/**
 * Dispatch function for the recomputation of derived permissions for elements.
 *
 * Based on the provided parameters, this function delegates to either user-specific
 * or object-wide permission recomputation for elements.
 *
 * @param params - Object containing element ID and optional user ID
 * @param params.id - ID of the element
 * @param params.userId - Optional user ID to limit recomputation to a specific user
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeElementPermissions(
  {
    id,
    userId,
    updateAccessRequests,
  }: {
    id: number
    userId?: string
    updateAccessRequests: boolean
  },
  prisma: PrismaTransactionClient
) {
  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputeElementPermissionsUser(
      { id, userId, updateAccessRequests },
      prisma
    )
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeElementPermissionsObject(
    { id, updateAccessRequests },
    prisma
  )
}

/**
 * Recomputes derived permissions for a specific user on an element.
 *
 * This function removes any existing derived permission for the user and then
 * computes the highest granted permission level for that same user from the
 * following potential sources of access permissions:
 * - direct permission granted to the individual user
 * - direct permission granted to a user group the user is part of
 * - ownership of the element
 * - any derived permission granted to the individual user on an activity where
 *   an instance of the element is included, according to the following rules:
 *   READ on activity --> no access to element
 *   WRITE on activity --> no access to element
 *   ADMIN on activity --> ADMIN on element
 *   OWNER on activity --> ADMIN on element
 *
 * The reason behind the last rule is that the sharing of activities, which is
 * allowed with >= ADMIN permissions, with a sufficiently high permission level
 * implicitly also results in the sharing of the associated elements. To ensure
 * consistency with the permission levels and sharing activities on elements, the
 * users therefore need to be granted at least ADMIN permissions on the element.
 *
 * Additionally, if the element is linked to an answer collection, all derived
 * permissions on the latter are recomputed for the user.
 *
 * @param params - Object containing element ID and user ID
 * @param params.id - ID of the element
 * @param params.userId - ID of the user to recompute permissions for
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeElementPermissionsUser(
  {
    id,
    userId,
    updateAccessRequests,
  }: { id: number; userId: string; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  // check if a permission for this user exists
  const existingPermission = await prisma.derivedPermission.findUnique({
    where: {
      elementId_userId: {
        elementId: id,
        userId,
      },
    },
  })

  // check if the user has a direct permission or ownership on the element, fetch linked answer collections and activities the element is included in
  const element = await prisma.element.findUnique({
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
      // fetch all instances that are included in acitvities where the user has admin / owner permissions -> derived admin permissions
      elementInstances: {
        take: 1, // a single instance in the corresponding activity is sufficient for admin permissions
        where: {
          OR: [
            {
              elementStack: {
                OR: [
                  {
                    practiceQuiz: {
                      permissions: {
                        some: {
                          userId,
                          OR: ACTIVITY_PERMISSIONS_WHERE_CLAUSE,
                        },
                      },
                    },
                  },
                  {
                    microLearning: {
                      permissions: {
                        some: {
                          userId,
                          OR: ACTIVITY_PERMISSIONS_WHERE_CLAUSE,
                        },
                      },
                    },
                  },
                  {
                    groupActivity: {
                      permissions: {
                        some: {
                          userId,
                          OR: ACTIVITY_PERMISSIONS_WHERE_CLAUSE,
                        },
                      },
                    },
                  },
                ],
              },
            },
            {
              elementBlock: {
                liveQuiz: {
                  permissions: {
                    some: {
                      userId,
                      OR: ACTIVITY_PERMISSIONS_WHERE_CLAUSE,
                    },
                  },
                },
              },
            },
          ],
        },
        include: {
          elementBlock: {
            include: {
              liveQuiz: {
                include: {
                  permissions: {
                    where: {
                      userId,
                      OR: ACTIVITY_PERMISSIONS_WHERE_CLAUSE,
                    },
                  },
                },
              },
            },
          },
          elementStack: {
            include: {
              practiceQuiz: {
                include: {
                  permissions: {
                    where: {
                      userId,
                      OR: ACTIVITY_PERMISSIONS_WHERE_CLAUSE,
                    },
                  },
                },
              },
              microLearning: {
                include: {
                  permissions: {
                    where: {
                      userId,
                      OR: ACTIVITY_PERMISSIONS_WHERE_CLAUSE,
                    },
                  },
                },
              },
              groupActivity: {
                include: {
                  permissions: {
                    where: {
                      userId,
                      OR: ACTIVITY_PERMISSIONS_WHERE_CLAUSE,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  // if the element does not exist, return
  if (!element) {
    return
  }

  // determine the maximum access level of the user
  let maxAccessLevel: DB.PermissionLevel | undefined = undefined
  let parentPermissionId: number | undefined = undefined
  let derived = false

  if (element.ownerId === userId && !element.isDeleted) {
    maxAccessLevel = DB.PermissionLevel.OWNER
  } else {
    // determine the highest available direct permission level (groups and individual direct permissions)
    // if the element is soft-deleted, no direct permissions are valid anymore
    if (element.directPermissions.length > 0 && !element.isDeleted) {
      const { maxDirectPermission, directPermissionId } =
        getMaxAccessLevelIndividual({
          directPermissions: element.directPermissions,
        })

      maxAccessLevel = inversePermissionLevelMap[maxDirectPermission]
      parentPermissionId = directPermissionId
    }

    // if the element is included in an activity where the user has ADMIN / OWNER permissions or propagation is enabled
    // --> owner requires derived admin permissions (at least) - skip if direct ADMIN permissions are already granted
    if (
      element.elementInstances.length > 0 &&
      maxAccessLevel !== DB.PermissionLevel.ADMIN
    ) {
      const instance = element.elementInstances[0]!
      const permission =
        instance.elementBlock?.liveQuiz?.permissions[0] ??
        instance.elementStack?.practiceQuiz?.permissions[0] ??
        instance.elementStack?.microLearning?.permissions[0] ??
        instance.elementStack?.groupActivity?.permissions[0]

      // OWNER / ADMIN permissions on the activity -> ADMIN on element
      if (
        permission &&
        (permission.permissionLevel === DB.PermissionLevel.OWNER ||
          permission.permissionLevel === DB.PermissionLevel.ADMIN)
      ) {
        maxAccessLevel = DB.PermissionLevel.ADMIN
        parentPermissionId = permission.directPermissionId ?? undefined
        derived = true // permission was derived from an activity
      }
      // READ / EXECUTE / WRITE on the activity AND propagation enabled (only these are fetched above!)
      // --> READ / WRITE on element
      else if (permission) {
        maxAccessLevel =
          permission.permissionLevel === DB.PermissionLevel.WRITE
            ? DB.PermissionLevel.WRITE
            : DB.PermissionLevel.READ
        parentPermissionId = permission.directPermissionId ?? undefined
        derived = true // permission was derived from an activity
      }
    }
  }

  // if the user has access, add a corresponding derived permission
  if (
    typeof maxAccessLevel !== 'undefined' &&
    (!existingPermission ||
      existingPermission.permissionLevel !== maxAccessLevel ||
      existingPermission.derived !== derived ||
      existingPermission.directPermissionId !== parentPermissionId)
  ) {
    await prisma.derivedPermission.upsert({
      where: {
        elementId_userId: {
          elementId: id,
          userId,
        },
      },
      create: {
        permissionLevel: maxAccessLevel,
        derived,
        directPermission:
          typeof parentPermissionId !== 'undefined'
            ? { connect: { id: parentPermissionId } }
            : undefined,
        element: { connect: { id } },
        user: { connect: { id: userId } },
      },
      update: {
        permissionLevel: maxAccessLevel,
        derived,
        directPermission:
          typeof parentPermissionId !== 'undefined'
            ? { connect: { id: parentPermissionId } }
            : { disconnect: true },
      },
    })
  }
  // if a derived permission exists, remove it
  else if (existingPermission && typeof maxAccessLevel === 'undefined') {
    await prisma.derivedPermission.delete({
      where: {
        elementId_userId: {
          elementId: id,
          userId,
        },
      },
    })
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { elementId: id, userId, objectSoftDeleted: element.isDeleted },
      prisma
    )
  }

  // compute derived permissions for answer collections that are linked to the element (= PROPAGATION = MIN. REQUIRED)
  if (element.answerCollectionId !== null) {
    await recomputeAnswerCollectionPermissionsUser(
      { id: element.answerCollectionId, userId, updateAccessRequests },
      prisma
    )
  }

  return
}

/**
 * Recomputes derived permissions for all users on an element.
 *
 * This function deletes all existing derived permissions for the element
 * and then recomputes them. Permissions are directly deduplicated for the
 * derived permissions table to only contain the highest permission level
 * for each user. The following sources for direct permissions on elements
 * are considered:
 * - direct permissions granted to users
 * - direct permissions granted to user groups
 * - ownership of the element
 * - derived permissions granted to users on activities where an instance of
 *   the element is included, according to the same rules as for the user-specific
 *   derived permissions recomputation for elements (see above).
 *
 *
 * The reason behind the last rule is that the sharing of activities, which is
 * allowed with >= ADMIN permissions, with a sufficiently high permission level
 * implicitly also results in the sharing of the associated elements. To ensure
 * consistency with the permission levels and sharing activities on elements, the
 * users therefore need to be granted at least ADMIN permissions on the element.
 *
 * Additionally, if the element is linked to an answer collection, all derived
 * permissions on the latter are recomputed.
 *
 * @param params - Object containing element ID
 * @param params.id - ID of the element
 * @param params.updateAccessRequests - Flag to update access requests for the object
 * @param prisma - Prisma transaction client for database operations
 */
export async function recomputeElementPermissionsObject(
  { id, updateAccessRequests }: { id: number; updateAccessRequests: boolean },
  prisma: PrismaTransactionClient
) {
  // fetch the object and all direct permissions on it, including user groups, as well as activities the element is used in
  // (ADMIN / OWNER permissions on the activity should automatically imply ADMIN permissions on the contained elements to enable propagation)
  const element = await prisma.element.findUnique({
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
      elementInstances: {
        include: {
          elementBlock: {
            include: {
              liveQuiz: {
                include: {
                  permissions: {
                    where: {
                      OR: ACTIVITY_PERMISSIONS_WHERE_CLAUSE,
                    },
                  },
                },
              },
            },
          },
          elementStack: {
            include: {
              practiceQuiz: {
                include: {
                  permissions: {
                    where: {
                      OR: ACTIVITY_PERMISSIONS_WHERE_CLAUSE,
                    },
                  },
                },
              },
              microLearning: {
                include: {
                  permissions: {
                    where: {
                      OR: ACTIVITY_PERMISSIONS_WHERE_CLAUSE,
                    },
                  },
                },
              },
              groupActivity: {
                include: {
                  permissions: {
                    where: {
                      OR: ACTIVITY_PERMISSIONS_WHERE_CLAUSE,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!element) {
    console.error(`Element with id ${id} not found`)
    return
  }

  // determine the access map based on ownership and direct permissions
  const directUserAccess = getMaxAccessLevelCombined({
    directPermissions: element.directPermissions,
    objectDeleted: element.isDeleted,
    ownerId: element.ownerId,
  })

  // get all activity permissions (ADMIN and OWNER level), which make a user qualify for ADMIN access on the element
  const activityPermissions: DB.DerivedPermission[] =
    element.elementInstances.flatMap((instance) => [
      ...(instance.elementBlock?.liveQuiz.permissions ?? []),
      ...(instance.elementStack?.practiceQuiz?.permissions ?? []),
      ...(instance.elementStack?.microLearning?.permissions ?? []),
      ...(instance.elementStack?.groupActivity?.permissions ?? []),
    ])

  // extend the user access map based on the activity permissions resulting in derived ADMIN access
  const userAccess =
    activityPermissions.length > 0
      ? activityPermissions.reduce<UserAccessMap>(
          (acc, permission) => {
            // if the user already has a ADMIN / OWNER permission, no derived access can be higher
            if (
              typeof acc[permission.userId] !== 'undefined' &&
              (acc[permission.userId]!.maxAccessLevel ===
                DB.PermissionLevel.ADMIN ||
                acc[permission.userId]!.maxAccessLevel ===
                  DB.PermissionLevel.OWNER)
            ) {
              return acc
            }

            // if the user has ADMIN / OWNER permissions on the activity, grant ADMIN access on the element
            if (
              permission.permissionLevel === DB.PermissionLevel.OWNER ||
              permission.permissionLevel === DB.PermissionLevel.ADMIN
            ) {
              if (acc[permission.userId]) {
                acc[permission.userId]!.maxAccessLevel =
                  DB.PermissionLevel.ADMIN
                acc[permission.userId]!.parentPermissionId =
                  permission.directPermissionId ?? undefined
                acc[permission.userId]!.derived = true // permission was derived from an activity with ADMIN permissions
              } else {
                acc[permission.userId] = {
                  maxAccessLevel: DB.PermissionLevel.ADMIN,
                  parentPermissionId:
                    permission.directPermissionId ?? undefined,
                  derived: true, // permission was derived from an activity with ADMIN permissions
                }
              }
            }
            // if the user has WRITE permissions on the activity and propagation is enabled, grant WRITE access on the element
            // ? where clause already ensures that fetched WRITE permissions have propagation enabled on activity
            else if (permission.permissionLevel === DB.PermissionLevel.WRITE) {
              if (acc[permission.userId]) {
                acc[permission.userId]!.maxAccessLevel =
                  DB.PermissionLevel.WRITE
                acc[permission.userId]!.parentPermissionId =
                  permission.directPermissionId ?? undefined
                acc[permission.userId]!.derived = true // permission was derived from an activity with WRITE permissions
              } else {
                acc[permission.userId] = {
                  maxAccessLevel: DB.PermissionLevel.WRITE,
                  parentPermissionId:
                    permission.directPermissionId ?? undefined,
                  derived: true, // permission was derived from an activity with WRITE permissions
                }
              }
            }
            // if the user has READ / EXECUTE permissions on the activity and propagation is enabled, grant READ access on the element
            // ? where clause already ensures that fetched READ / EXECUTE permissions have propagation enabled on activity
            else if (
              permission.permissionLevel === DB.PermissionLevel.READ ||
              permission.permissionLevel === DB.PermissionLevel.EXECUTE
            ) {
              if (acc[permission.userId]) {
                acc[permission.userId]!.maxAccessLevel = DB.PermissionLevel.READ
                acc[permission.userId]!.parentPermissionId =
                  permission.directPermissionId ?? undefined
                acc[permission.userId]!.derived = true // permission was derived from an activity with READ / EXECUTE permissions
              } else {
                acc[permission.userId] = {
                  maxAccessLevel: DB.PermissionLevel.READ,
                  parentPermissionId:
                    permission.directPermissionId ?? undefined,
                  derived: true, // permission was derived from an activity with READ / EXECUTE permissions
                }
              }
            }

            return acc
          },
          { ...directUserAccess }
        )
      : directUserAccess

  // remove the derived permissions for all users that do not have access (anymore)
  await prisma.derivedPermission.deleteMany({
    where: {
      elementId: id,
      userId: {
        notIn: Object.keys(userAccess),
      },
    },
  })

  // create / update derived permissions for each user with access
  const results = await Promise.allSettled(
    Object.entries(userAccess).map(
      async ([userId, { maxAccessLevel, parentPermissionId, derived }]) =>
        await prisma.derivedPermission.upsert({
          where: {
            elementId_userId: {
              elementId: id,
              userId,
            },
          },
          create: {
            permissionLevel: maxAccessLevel,
            derived,
            directPermission:
              typeof parentPermissionId !== 'undefined'
                ? { connect: { id: parentPermissionId } }
                : undefined,
            element: { connect: { id } },
            user: { connect: { id: userId } },
          },
          update: {
            permissionLevel: maxAccessLevel,
            derived,
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
      `Failed to update derived permissions for element (ID: ${element.id}): ${rejectedPromises
        .map((result) => result.reason?.message || 'Unknown error')
        .join(', ')}`
    )
  }

  // if the corresponding flag is set, update the access requests for the object
  if (updateAccessRequests) {
    await updateAccessRequestInstances(
      { elementId: id, objectSoftDeleted: element.isDeleted },
      prisma
    )
  }

  // compute derived permissions for answer collections that are linked to the element (= PROPAGATION = MIN. REQUIRED)
  if (element.answerCollectionId !== null) {
    await recomputeAnswerCollectionPermissionsObject(
      { id: element.answerCollectionId, updateAccessRequests },
      prisma
    )
  }
}
