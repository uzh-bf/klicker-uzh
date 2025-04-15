import * as DB from '@klicker-uzh/prisma'
import {
  MISSING_CATALOG_COLLECTION_ID,
  type PrismaTransactionClient,
} from './types.js'

// auxilary type definitions
type UserAccessMap = {
  [userId: string]: {
    maxAccessLevel: DB.PermissionLevel
    parentPermissionId: number | undefined
    derived: boolean
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

const inversePermissionLevelMap: Record<
  number,
  DB.PermissionLevel | undefined
> = {
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
    // optional user to limit the required recomputation
    userId,
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
      { id: catalogCollectionId, userId },
      prisma
    )
  } else if (typeof answerCollectionId !== 'undefined') {
    await recomputeAnswerCollectionPermissions(
      { id: answerCollectionId, userId },
      prisma
    )
  } else if (typeof elementId !== 'undefined') {
    await recomputeElementPermissions(
      {
        id: elementId,
        userId,
      },
      prisma
    )
  } else if (typeof liveQuizId !== 'undefined') {
    await recomputeLiveQuizPermissions(
      {
        id: liveQuizId,
        userId,
      },
      prisma
    )
  } else if (typeof practiceQuizId !== 'undefined') {
    await recomputePracticeQuizPermissions(
      {
        id: practiceQuizId,
        userId,
      },
      prisma
    )
  } else if (typeof microLearningId !== 'undefined') {
    await recomputeMicroLearningPermissions(
      {
        id: microLearningId,
        userId,
      },
      prisma
    )
  } else if (typeof groupActivityId !== 'undefined') {
    await recomputeGroupActivityPermissions(
      {
        id: groupActivityId,
        userId,
      },
      prisma
    )
  } else if (typeof courseId !== 'undefined') {
    await recomputeCoursePermissions(
      {
        id: courseId,
        userId,
      },
      prisma
    )
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
  }: {
    id: string
    userId?: string
  },
  prisma: PrismaTransactionClient
) {
  // for the top-level default catalog collection, no permissions are awarded
  if (id === MISSING_CATALOG_COLLECTION_ID) {
    return
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
            { userGroup: { members: { some: { id: userId } } } },
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
    // no permission found that would justify access
    return
  }

  // if the user still has access, add a corresponding derived permission
  if (typeof maxAccessLevel !== 'undefined') {
    await prisma.derivedPermission.create({
      data: {
        permissionLevel: maxAccessLevel,
        catalogCollection: { connect: { id } },
        directPermission:
          typeof parentPermissionId !== 'undefined'
            ? { connect: { id: parentPermissionId } }
            : undefined,
        user: { connect: { id: userId } },
      },
    })
  }

  return
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

// ! Derived permission recomputation for answer collections
// #region
async function recomputeAnswerCollectionPermissions(
  { id, userId }: { id: number; userId?: string },
  prisma: PrismaTransactionClient
) {
  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputeAnswerCollectionPermissionsUser(
      { id, userId },
      prisma
    )
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeAnswerCollectionPermissionsObject({ id }, prisma)
}

async function recomputeAnswerCollectionPermissionsUser(
  { id, userId }: { id: number; userId: string },
  prisma: PrismaTransactionClient
) {
  // check if a permission for this user exists
  const existingPermission = await prisma.derivedPermission.findUnique({
    where: {
      answerCollectionId_userId: {
        answerCollectionId: id,
        userId,
      },
    },
  })

  // if a derived permission exists, remove it
  if (existingPermission) {
    await prisma.derivedPermission.delete({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: id,
          userId,
        },
      },
    })
  }

  // check for ownership, direct permissions or links to other objects that would imply derived permissions
  const answerCollection = await prisma.answerCollection.findUnique({
    where: {
      id,
    },
    include: {
      directPermissions: {
        where: {
          OR: [
            { userId },
            { userGroup: { members: { some: { id: userId } } } },
          ],
        },
      },
      linkedElements: {
        where: { permissions: { some: { userId } } },
        include: { permissions: { where: { userId } } },
      },
      linkedTemplates: {
        where: {
          OR: [
            {
              liveQuiz: { permissions: { some: { userId } } },
              practiceQuiz: { permissions: { some: { userId } } },
              microLearning: { permissions: { some: { userId } } },
              groupActivity: { permissions: { some: { userId } } },
            },
          ],
        },
        include: {
          liveQuiz: { include: { permissions: { where: { userId } } } },
          practiceQuiz: { include: { permissions: { where: { userId } } } },
          microLearning: { include: { permissions: { where: { userId } } } },
          groupActivity: { include: { permissions: { where: { userId } } } },
        },
      },
    },
  })

  // if the answer collection does not exist, return
  if (!answerCollection) {
    return
  }

  // determine the maximum access level of the user
  let maxAccessLevel: DB.PermissionLevel | undefined = undefined
  let parentPermissionId: number | undefined = undefined
  let derived = false

  // if user is answer collection owner, set the corresponding permission
  if (answerCollection.ownerId === userId && !answerCollection.isDeleted) {
    maxAccessLevel = DB.PermissionLevel.OWNER
  }
  // if the user has a direct permission or a derived access, use this case
  else if (
    answerCollection.directPermissions.length > 0 ||
    answerCollection.linkedElements.length > 0 ||
    answerCollection.linkedTemplates.length > 0
  ) {
    // if the object is soft-deleted, not direct permissions are valid anymore
    if (
      answerCollection.directPermissions.length > 0 &&
      !answerCollection.isDeleted
    ) {
      // determine the highest available direct permission level
      const { maxDirectPermission, directPermissionId } =
        getMaxAccessLevelIndividual({
          directPermissions: answerCollection.directPermissions,
        })

      maxAccessLevel = inversePermissionLevelMap[maxDirectPermission]
      parentPermissionId = directPermissionId
    }
    // if the user does not have direct access to the answer collection, but has access to linked elements -> derived permission
    // if direct access was granted, inherited permissions do not need to be considered -> can only be READ level for answer collections
    else if (
      typeof maxAccessLevel === 'undefined' &&
      answerCollection.linkedElements.length > 0 &&
      typeof answerCollection.linkedElements[0] !== 'undefined'
    ) {
      const element = answerCollection.linkedElements[0]!

      // if the user has more than one derived permission on the linked element, something went wrong
      if (element.permissions.length !== 1) {
        throw new Error(
          `More or less than one derived permission found for answer collection ${id} (id) and a single user ${userId} (id).`
        )
      }

      // use the permission of the linked element to set the derived permission
      const permissionLinkedElement = element.permissions[0]
      maxAccessLevel = DB.PermissionLevel.READ // derived permissions on answer collections are always on read level
      parentPermissionId =
        permissionLinkedElement?.directPermissionId ?? undefined
      derived = true // permission was derived from another element
    }
    // derived permissions based on template usage
    else if (
      typeof maxAccessLevel === 'undefined' &&
      answerCollection.linkedTemplates.length > 0 &&
      typeof answerCollection.linkedTemplates[0] !== 'undefined'
    ) {
      const template = answerCollection.linkedTemplates[0]!
      const permissions =
        template.liveQuiz?.permissions ??
        template.practiceQuiz?.permissions ??
        template.microLearning?.permissions ??
        template.groupActivity?.permissions ??
        []

      // if the user has more than one derived permission on the linked template, something went wrong
      if (permissions.length !== 1) {
        throw new Error(
          `More or less than one derived permission found for tmeplate ${template.id} (id) and a single user ${userId} (id).`
        )
      }

      const permissionLinkedTemplate = permissions[0]
      maxAccessLevel = DB.PermissionLevel.READ // derived permissions on answer collections are always on read level
      parentPermissionId =
        permissionLinkedTemplate?.directPermissionId ?? undefined
      derived = true // permission was derived from another element
    }
  } else {
    // no direct permission or derived access found that would justify access
    return
  }

  // if the user still has access, add a corresponding derived permission
  if (typeof maxAccessLevel !== 'undefined') {
    await prisma.derivedPermission.create({
      data: {
        permissionLevel: maxAccessLevel,
        derived,
        answerCollection: {
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
  }

  return
}

async function recomputeAnswerCollectionPermissionsObject(
  { id }: { id: number },
  prisma: PrismaTransactionClient
) {
  // delete all derived permissions for this catalog collection
  await prisma.derivedPermission.deleteMany({
    where: {
      answerCollectionId: id,
    },
  })

  // fetch the object and all direct permissions on it, including user groups
  const answerCollection = await prisma.answerCollection.findUnique({
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
      linkedElements: {
        include: {
          permissions: true, // derived permissions - linked to users with access to element
        },
      },
      linkedTemplates: {
        include: {
          // derived permissions - linked to users with access to activity template
          liveQuiz: { include: { permissions: true } },
          practiceQuiz: { include: { permissions: true } },
          microLearning: { include: { permissions: true } },
          groupActivity: { include: { permissions: true } },
        },
      },
    },
  })

  if (!answerCollection) {
    console.error(`Answer collection with id ${id} not found`)
    return
  }

  // determine the access map based on ownership and direct permissions
  const directUserAccess = getMaxAccessLevelCombined({
    directPermissions: answerCollection.directPermissions,
    objectDeleted: answerCollection.isDeleted,
    ownerId: answerCollection.ownerId,
  })

  // extend the user access map based on direct permissions with derived permissions from linked elements
  const extendedUserAccess1 =
    answerCollection.linkedElements.length > 0
      ? answerCollection.linkedElements.reduce<UserAccessMap>(
          (acc, linkedElement) => {
            // iterate over the derived permissions on the linked element and grant corresponding derived permissions
            // for answer collections: permission level on parent element does not matter -> READ permissions on answer collection
            // (no override of existing permissions required -> new permission could only be equivalent or smaller)
            for (const permission of linkedElement.permissions) {
              if (typeof acc[permission.userId] === 'undefined') {
                acc[permission.userId] = {
                  maxAccessLevel: DB.PermissionLevel.READ,
                  parentPermissionId:
                    permission.directPermissionId ?? undefined,
                  derived: true,
                }
              }
            }

            return acc
          },
          {
            ...directUserAccess,
          }
        )
      : directUserAccess

  // extend the user access map based on direct permissions with derived permissions from linked elements
  const extendedUserAccess2 =
    answerCollection.linkedTemplates.length > 0
      ? answerCollection.linkedTemplates.reduce<UserAccessMap>(
          (acc, linkedTemplate) => {
            // iterate over the derived permissions on the linked template and grant corresponding derived permissions
            // for answer collections: permission level on parent element does not matter -> READ permissions on answer collection
            // (no override of existing permissions required -> new permission could only be equivalent or smaller)
            const permissions =
              linkedTemplate.liveQuiz?.permissions ??
              linkedTemplate.practiceQuiz?.permissions ??
              linkedTemplate.microLearning?.permissions ??
              linkedTemplate.groupActivity?.permissions ??
              []

            for (const permission of permissions) {
              if (typeof acc[permission.userId] === 'undefined') {
                acc[permission.userId] = {
                  maxAccessLevel: DB.PermissionLevel.READ,
                  parentPermissionId:
                    permission.directPermissionId ?? undefined,
                  derived: true,
                }
              }
            }

            return acc
          },
          {
            ...extendedUserAccess1,
          }
        )
      : extendedUserAccess1

  // create derived permissions for each user with access
  await prisma.derivedPermission.createMany({
    data: Object.entries(extendedUserAccess2).map(
      ([userId, { maxAccessLevel, parentPermissionId, derived }]) => ({
        permissionLevel: maxAccessLevel,
        derived,
        userId,
        answerCollectionId: id,
        directPermissionId: parentPermissionId,
      })
    ),
  })
}
// #endregion

// ! Derived permission recomputation for elements
// #region
async function recomputeElementPermissions(
  {
    id,
    userId,
  }: {
    id: number
    userId?: string
  },
  prisma: PrismaTransactionClient
) {
  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputeElementPermissionsUser({ id, userId }, prisma)
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeElementPermissionsObject({ id }, prisma)
}

async function recomputeElementPermissionsUser(
  { id, userId }: { id: number; userId: string },
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

  // if a derived permission exists, remove it
  if (existingPermission) {
    await prisma.derivedPermission.delete({
      where: {
        elementId_userId: {
          elementId: id,
          userId,
        },
      },
    })
  }

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
            { userGroup: { members: { some: { id: userId } } } },
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
                          permissionLevel: {
                            in: [
                              DB.PermissionLevel.ADMIN,
                              DB.PermissionLevel.OWNER,
                            ],
                          },
                        },
                      },
                    },
                  },
                  {
                    microLearning: {
                      permissions: {
                        some: {
                          userId,
                          permissionLevel: {
                            in: [
                              DB.PermissionLevel.ADMIN,
                              DB.PermissionLevel.OWNER,
                            ],
                          },
                        },
                      },
                    },
                  },
                  {
                    groupActivity: {
                      permissions: {
                        some: {
                          userId,
                          permissionLevel: {
                            in: [
                              DB.PermissionLevel.ADMIN,
                              DB.PermissionLevel.OWNER,
                            ],
                          },
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
                      permissionLevel: {
                        in: [
                          DB.PermissionLevel.ADMIN,
                          DB.PermissionLevel.OWNER,
                        ],
                      },
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
                      permissionLevel: {
                        in: [
                          DB.PermissionLevel.ADMIN,
                          DB.PermissionLevel.OWNER,
                        ],
                      },
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
                      permissionLevel: {
                        in: [
                          DB.PermissionLevel.ADMIN,
                          DB.PermissionLevel.OWNER,
                        ],
                      },
                    },
                  },
                },
              },
              microLearning: {
                include: {
                  permissions: {
                    where: {
                      userId,
                      permissionLevel: {
                        in: [
                          DB.PermissionLevel.ADMIN,
                          DB.PermissionLevel.OWNER,
                        ],
                      },
                    },
                  },
                },
              },
              groupActivity: {
                include: {
                  permissions: {
                    where: {
                      userId,
                      permissionLevel: {
                        in: [
                          DB.PermissionLevel.ADMIN,
                          DB.PermissionLevel.OWNER,
                        ],
                      },
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

    // if the element is included in an activity where the user has ADMIN / OWNER permissions
    // --> owner requires derived admin permissions (at least) - skip if direct ADMIn permissions are already granted
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

      if (permission) {
        maxAccessLevel = DB.PermissionLevel.ADMIN
        parentPermissionId = permission.directPermissionId ?? undefined
        derived = true // permission was derived from another element
      }
    }
  }

  // if the user has access, add a corresponding derived permission
  if (typeof maxAccessLevel !== 'undefined') {
    await prisma.derivedPermission.create({
      data: {
        permissionLevel: maxAccessLevel,
        derived,
        element: { connect: { id } },
        directPermission:
          typeof parentPermissionId !== 'undefined'
            ? { connect: { id: parentPermissionId } }
            : undefined,
        user: { connect: { id: userId } },
      },
    })
  }

  // compute derived permissions for answer collections that are linked to the element (= PROPAGATION = MIN. REQUIRED)
  if (element.answerCollectionId !== null) {
    await recomputeAnswerCollectionPermissionsUser(
      { id: element.answerCollectionId, userId },
      prisma
    )
  }

  return
}

async function recomputeElementPermissionsObject(
  { id }: { id: number },
  prisma: PrismaTransactionClient
) {
  // delete all derived permissions for this element
  await prisma.derivedPermission.deleteMany({
    where: {
      elementId: id,
    },
  })

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
                      permissionLevel: {
                        in: [
                          DB.PermissionLevel.ADMIN,
                          DB.PermissionLevel.OWNER,
                        ],
                      },
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
                      permissionLevel: {
                        in: [
                          DB.PermissionLevel.ADMIN,
                          DB.PermissionLevel.OWNER,
                        ],
                      },
                    },
                  },
                },
              },
              microLearning: {
                include: {
                  permissions: {
                    where: {
                      permissionLevel: {
                        in: [
                          DB.PermissionLevel.ADMIN,
                          DB.PermissionLevel.OWNER,
                        ],
                      },
                    },
                  },
                },
              },
              groupActivity: {
                include: {
                  permissions: {
                    where: {
                      permissionLevel: {
                        in: [
                          DB.PermissionLevel.ADMIN,
                          DB.PermissionLevel.OWNER,
                        ],
                      },
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
  const adminActivityPermissions: DB.DerivedPermission[] =
    element.elementInstances.flatMap((instance) => [
      ...(instance.elementBlock?.liveQuiz.permissions ?? []),
      ...(instance.elementStack?.practiceQuiz?.permissions ?? []),
      ...(instance.elementStack?.microLearning?.permissions ?? []),
      ...(instance.elementStack?.groupActivity?.permissions ?? []),
    ])

  // extend the user access map based on the activity permissions resulting in derived ADMIN access
  const userAccess =
    adminActivityPermissions.length > 0
      ? adminActivityPermissions.reduce<UserAccessMap>(
          (acc, permission) => {
            // if the user already has a permission, check if it is already on ADMIN level
            if (
              typeof acc[permission.userId] !== 'undefined' &&
              acc[permission.userId]!.maxAccessLevel !==
                DB.PermissionLevel.ADMIN &&
              acc[permission.userId]!.maxAccessLevel !==
                DB.PermissionLevel.OWNER
            ) {
              acc[permission.userId]!.maxAccessLevel = DB.PermissionLevel.ADMIN
              acc[permission.userId]!.parentPermissionId =
                permission.directPermissionId ?? undefined
              acc[permission.userId]!.derived = true // permission was derived from an activity with ADMIN permissions
            }

            // if user does not have a permission yet, add it
            if (typeof acc[permission.userId] === 'undefined') {
              acc[permission.userId] = {
                maxAccessLevel: DB.PermissionLevel.ADMIN,
                parentPermissionId: permission.directPermissionId ?? undefined,
                derived: true, // permission was derived from an activity with ADMIN permissions
              }
            }

            return acc
          },
          { ...directUserAccess }
        )
      : directUserAccess

  // create derived permissions for each user with access
  await prisma.derivedPermission.createMany({
    data: Object.entries(userAccess).map(
      ([userId, { maxAccessLevel, parentPermissionId, derived }]) => ({
        permissionLevel: maxAccessLevel,
        derived,
        userId,
        elementId: id,
        directPermissionId: parentPermissionId,
      })
    ),
  })

  // compute derived permissions for answer collections that are linked to the element (= PROPAGATION = MIN. REQUIRED)
  if (element.answerCollectionId !== null) {
    await recomputeAnswerCollectionPermissionsObject(
      { id: element.answerCollectionId },
      prisma
    )
  }
}
// #endregion

// ! Derived permission recomputation for live quizzes
// #region
async function recomputeLiveQuizPermissions(
  {
    id,
    userId,
  }: {
    id: string
    userId?: string
  },
  prisma: PrismaTransactionClient
) {
  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputeLiveQuizPermissionsUser({ id, userId }, prisma)
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeLiveQuizPermissionsObject({ id }, prisma)
}

async function recomputeLiveQuizPermissionsUser(
  { id, userId }: { id: string; userId: string },
  prisma: PrismaTransactionClient
) {
  // check if a permission for this user exists
  const existingPermission = await prisma.derivedPermission.findUnique({
    where: {
      liveQuizId_userId: {
        liveQuizId: id,
        userId,
      },
    },
  })

  // if a derived permission exists, remove it
  if (existingPermission) {
    await prisma.derivedPermission.delete({
      where: {
        liveQuizId_userId: {
          liveQuizId: id,
          userId,
        },
      },
    })
  }

  // check for ownership, direct permissions, links to a course that would imply derived permissions
  const liveQuiz = await prisma.liveQuiz.findUnique({
    where: {
      id,
    },
    include: {
      directPermissions: {
        where: {
          OR: [
            { userId },
            { userGroup: { members: { some: { id: userId } } } },
          ],
        },
      },
      // course from which derived permissions would be inherited
      course: {
        include: {
          permissions: {
            where: {
              userId,
            },
            include: {
              directPermission: true,
            },
          },
        },
      },
      // element instances (with elementId on them) contained in this quiz to propagate the derived permission update to elements
      blocks: {
        include: {
          elements: true,
        },
      },
    },
  })

  // if the live quiz does not exist, return
  if (!liveQuiz) {
    return
  }

  // compute the derived permission level (maximum) for this user on the activity
  const res = getActivityPermissionsUser({
    activityOwnerId: liveQuiz.ownerId,
    activityDeleted: liveQuiz.isDeleted,
    userId,
    directPermissions: liveQuiz.directPermissions,
    coursePermissions: liveQuiz.course?.permissions ?? [],
  })

  // if no valid derived permission was computed, return early
  if (res === null) {
    return
  }

  // if the user still has access, add a corresponding derived permission
  const { maxAccessLevel, parentPermissionId, derived } = res
  if (typeof maxAccessLevel !== 'undefined') {
    await prisma.derivedPermission.create({
      data: {
        permissionLevel: maxAccessLevel,
        derived,
        liveQuiz: {
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
  }

  // if the activity still exists and the user had ADMIN / OWNER permissions on it,
  // the derived element permissions need to be recomputed (-> complete recompute required)
  // users with lower permissions on the activity will never obtained derived permissions through it
  // --> however, since the computation is based on derived activity permissions, we need to compute these before
  await propagateActivityToElementsUser(
    { stacks: liveQuiz.blocks, userId },
    prisma
  )

  return
}

async function recomputeLiveQuizPermissionsObject(
  { id }: { id: string },
  prisma: PrismaTransactionClient
) {
  // delete all derived permissions for this element
  await prisma.derivedPermission.deleteMany({
    where: {
      liveQuizId: id,
    },
  })

  // fetch the object and all direct permissions on it, including user groups, as well as activities the element is used in
  // permissions on the course should automatically imply corresponding permissions on the contained live quizzes
  // depending on the permission level on the activity, derived permissions on the contained elements might be required
  const liveQuiz = await prisma.liveQuiz.findUnique({
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
      // course from which derived permissions would be inherited
      course: {
        include: {
          permissions: {
            include: {
              directPermission: true,
            },
          },
        },
      },
      // element instances contained in the activity to propagate the derived permission update to elements
      blocks: {
        include: {
          elements: true,
        },
      },
    },
  })

  if (!liveQuiz) {
    console.error(`Live quiz with id ${id} or corresponding owner not found`)
    return
  }

  // compute a map between all users with direct or direct access to the considered activity
  const userAccess = getActivityPermissionsObject({
    activityOwnerId: liveQuiz.ownerId,
    activityDeleted: liveQuiz.isDeleted,
    directPermissions: liveQuiz.directPermissions,
    coursePermissions: liveQuiz.course?.permissions ?? [],
  })

  // create derived permissions for each user with access
  await prisma.derivedPermission.createMany({
    data: Object.entries(userAccess).map(
      ([userId, { maxAccessLevel, parentPermissionId, derived }]) => ({
        permissionLevel: maxAccessLevel,
        derived,
        userId,
        liveQuizId: id,
        directPermissionId: parentPermissionId,
      })
    ),
  })

  // recompute the derived permissions on all elements contained in this activity
  await propagateActivityToElements({ stacks: liveQuiz.blocks }, prisma)
}
// #endregion

// ! Derived permission recomputation for practice quizzes
// #region
async function recomputePracticeQuizPermissions(
  {
    id,
    userId,
  }: {
    id: string
    userId?: string
  },
  prisma: PrismaTransactionClient
) {
  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputePracticeQuizPermissionsUser({ id, userId }, prisma)
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputePracticeQuizPermissionsObject({ id }, prisma)
}

async function recomputePracticeQuizPermissionsUser(
  { id, userId }: { id: string; userId: string },
  prisma: PrismaTransactionClient
) {
  // check if a permission for this user exists
  const existingPermission = await prisma.derivedPermission.findUnique({
    where: {
      practiceQuizId_userId: {
        practiceQuizId: id,
        userId,
      },
    },
  })

  // if a derived permission exists, remove it
  if (existingPermission) {
    await prisma.derivedPermission.delete({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: id,
          userId,
        },
      },
    })
  }

  // check for ownership, direct permissions, links to a course that would imply derived permissions
  const practiceQuiz = await prisma.practiceQuiz.findUnique({
    where: {
      id,
    },
    include: {
      directPermissions: {
        where: {
          OR: [
            { userId },
            { userGroup: { members: { some: { id: userId } } } },
          ],
        },
      },
      // course from which derived permissions would be inherited
      course: {
        include: {
          permissions: {
            where: {
              userId,
            },
            include: {
              directPermission: true,
            },
          },
        },
      },
      // element instances (with elementId on them) contained in this quiz to propagate the derived permission update to elements
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  // if the practice quiz does not exist, return
  if (!practiceQuiz) {
    return
  }

  // compute the derived permission level (maximum) for this user on the activity
  const res = getActivityPermissionsUser({
    activityOwnerId: practiceQuiz.ownerId,
    activityDeleted: practiceQuiz.isDeleted,
    userId,
    directPermissions: practiceQuiz.directPermissions,
    coursePermissions: practiceQuiz.course?.permissions ?? [],
  })

  // if no valid derived permission was computed, return early
  if (res === null) {
    return
  }

  // if the user still has access, add a corresponding derived permission
  const { maxAccessLevel, parentPermissionId, derived } = res
  if (typeof maxAccessLevel !== 'undefined') {
    await prisma.derivedPermission.create({
      data: {
        permissionLevel: maxAccessLevel,
        derived,
        practiceQuiz: {
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
  }

  // if the activity still exists and the user had ADMIN / OWNER permissions on it,
  // the derived element permissions need to be recomputed (-> complete recompute required)
  // users with lower permissions on the activity will never obtained derived permissions through it
  // --> however, since the computation is based on derived activity permissions, we need to compute these before
  await propagateActivityToElementsUser(
    { stacks: practiceQuiz.stacks, userId },
    prisma
  )

  return
}

async function recomputePracticeQuizPermissionsObject(
  { id }: { id: string },
  prisma: PrismaTransactionClient
) {
  // delete all derived permissions for this element
  await prisma.derivedPermission.deleteMany({
    where: {
      practiceQuizId: id,
    },
  })

  // fetch the object and all direct permissions on it, including user groups, as well as activities the element is used in
  // permissions on the course should automatically imply corresponding permissions on the contained practice quizzes
  // depending on the permission level on the activity, derived permissions on the contained elements might be required
  const practiceQuiz = await prisma.practiceQuiz.findUnique({
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
      // course from which derived permissions would be inherited
      course: {
        include: {
          permissions: {
            include: {
              directPermission: true,
            },
          },
        },
      },
      // element instances contained in the activity to propagate the derived permission update to elements
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  if (!practiceQuiz) {
    console.error(
      `Practice quiz with id ${id} or corresponding owner not found`
    )
    return
  }

  // compute a map between all users with direct or direct access to the considered activity
  const userAccess = getActivityPermissionsObject({
    activityOwnerId: practiceQuiz.ownerId,
    activityDeleted: practiceQuiz.isDeleted,
    directPermissions: practiceQuiz.directPermissions,
    coursePermissions: practiceQuiz.course?.permissions ?? [],
  })

  // create derived permissions for each user with access
  await prisma.derivedPermission.createMany({
    data: Object.entries(userAccess).map(
      ([userId, { maxAccessLevel, parentPermissionId, derived }]) => ({
        permissionLevel: maxAccessLevel,
        derived,
        userId,
        practiceQuizId: id,
        directPermissionId: parentPermissionId,
      })
    ),
  })

  // recompute the derived permissions on all elements contained in this activity
  await propagateActivityToElements({ stacks: practiceQuiz.stacks }, prisma)
}
// #endregion

// ! Derived permission recomputation for microlearnings
// #region
async function recomputeMicroLearningPermissions(
  {
    id,
    userId,
  }: {
    id: string
    userId?: string
  },
  prisma: PrismaTransactionClient
) {
  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputeMicroLearningPermissionsUser({ id, userId }, prisma)
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeMicroLearningPermissionsObject({ id }, prisma)
}

async function recomputeMicroLearningPermissionsUser(
  { id, userId }: { id: string; userId: string },
  prisma: PrismaTransactionClient
) {
  // check if a permission for this user exists
  const existingPermission = await prisma.derivedPermission.findUnique({
    where: {
      microLearningId_userId: {
        microLearningId: id,
        userId,
      },
    },
  })

  // if a derived permission exists, remove it
  if (existingPermission) {
    await prisma.derivedPermission.delete({
      where: {
        microLearningId_userId: {
          microLearningId: id,
          userId,
        },
      },
    })
  }

  // check for ownership, direct permissions, links to a course that would imply derived permissions
  const microLearning = await prisma.microLearning.findUnique({
    where: {
      id,
    },
    include: {
      directPermissions: {
        where: {
          OR: [
            { userId },
            { userGroup: { members: { some: { id: userId } } } },
          ],
        },
      },
      // course from which derived permissions would be inherited
      course: {
        include: {
          permissions: {
            where: {
              userId,
            },
            include: {
              directPermission: true,
            },
          },
        },
      },
      // element instances (with elementId on them) contained in this quiz to propagate the derived permission update to elements
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  // if the microlearning does not exist, return
  if (!microLearning) {
    return
  }

  // compute the derived permission level (maximum) for this user on the activity
  const res = getActivityPermissionsUser({
    activityOwnerId: microLearning.ownerId,
    activityDeleted: microLearning.isDeleted,
    userId,
    directPermissions: microLearning.directPermissions,
    coursePermissions: microLearning.course?.permissions ?? [],
  })

  // if no valid derived permission was computed, return early
  if (res === null) {
    return
  }

  // if the user still has access, add a corresponding derived permission
  const { maxAccessLevel, parentPermissionId, derived } = res
  if (typeof maxAccessLevel !== 'undefined') {
    await prisma.derivedPermission.create({
      data: {
        permissionLevel: maxAccessLevel,
        derived,
        microLearning: {
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
  }

  // if the activity still exists and the user had ADMIN / OWNER permissions on it,
  // the derived element permissions need to be recomputed (-> complete recompute required)
  // users with lower permissions on the activity will never obtained derived permissions through it
  // --> however, since the computation is based on derived activity permissions, we need to compute these before
  await propagateActivityToElementsUser(
    { stacks: microLearning.stacks, userId },
    prisma
  )

  return
}

async function recomputeMicroLearningPermissionsObject(
  { id }: { id: string },
  prisma: PrismaTransactionClient
) {
  // delete all derived permissions for this element
  await prisma.derivedPermission.deleteMany({
    where: {
      microLearningId: id,
    },
  })

  // fetch the object and all direct permissions on it, including user groups, as well as activities the element is used in
  // permissions on the course should automatically imply corresponding permissions on the contained microlearning
  // depending on the permission level on the activity, derived permissions on the contained elements might be required
  const microLearning = await prisma.microLearning.findUnique({
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
      // course from which derived permissions would be inherited
      course: {
        include: {
          permissions: {
            include: {
              directPermission: true,
            },
          },
        },
      },
      // element instances contained in the activity to propagate the derived permission update to elements
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  if (!microLearning) {
    console.error(
      `Microlearning with id ${id} or corresponding owner not found`
    )
    return
  }

  // compute a map between all users with direct or direct access to the considered activity
  const userAccess = getActivityPermissionsObject({
    activityOwnerId: microLearning.ownerId,
    activityDeleted: microLearning.isDeleted,
    directPermissions: microLearning.directPermissions,
    coursePermissions: microLearning.course?.permissions ?? [],
  })

  // create derived permissions for each user with access
  await prisma.derivedPermission.createMany({
    data: Object.entries(userAccess).map(
      ([userId, { maxAccessLevel, parentPermissionId, derived }]) => ({
        permissionLevel: maxAccessLevel,
        derived,
        userId,
        microLearningId: id,
        directPermissionId: parentPermissionId,
      })
    ),
  })

  // recompute the derived permissions on all elements contained in this activity
  await propagateActivityToElements({ stacks: microLearning.stacks }, prisma)
}
// #endregion

// ! Derived permission recomputation for group activities
// #region
async function recomputeGroupActivityPermissions(
  {
    id,
    userId,
  }: {
    id: string
    userId?: string
  },
  prisma: PrismaTransactionClient
) {
  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputeGroupActivityPermissionsUser({ id, userId }, prisma)
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeGroupActivityPermissionsObject({ id }, prisma)
}

async function recomputeGroupActivityPermissionsUser(
  { id, userId }: { id: string; userId: string },
  prisma: PrismaTransactionClient
) {
  // check if a permission for this user exists
  const existingPermission = await prisma.derivedPermission.findUnique({
    where: {
      groupActivityId_userId: {
        groupActivityId: id,
        userId,
      },
    },
  })

  // if a derived permission exists, remove it
  if (existingPermission) {
    await prisma.derivedPermission.delete({
      where: {
        groupActivityId_userId: {
          groupActivityId: id,
          userId,
        },
      },
    })
  }

  // check for ownership, direct permissions, links to a course that would imply derived permissions
  const groupActivity = await prisma.groupActivity.findUnique({
    where: {
      id,
    },
    include: {
      directPermissions: {
        where: {
          OR: [
            { userId },
            { userGroup: { members: { some: { id: userId } } } },
          ],
        },
      },
      // course from which derived permissions would be inherited
      course: {
        include: {
          permissions: {
            where: {
              userId,
            },
            include: {
              directPermission: true,
            },
          },
        },
      },
      // element instances (with elementId on them) contained in this quiz to propagate the derived permission update to elements
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  // if the group activity does not exist, return
  if (!groupActivity) {
    return
  }

  // compute the derived permission level (maximum) for this user on the activity
  const res = getActivityPermissionsUser({
    activityOwnerId: groupActivity.ownerId,
    activityDeleted: groupActivity.isDeleted,
    userId,
    directPermissions: groupActivity.directPermissions,
    coursePermissions: groupActivity.course?.permissions ?? [],
  })

  // if no valid derived permission was computed, return early
  if (res === null) {
    return
  }

  // if the user still has access, add a corresponding derived permission
  const { maxAccessLevel, parentPermissionId, derived } = res
  if (typeof maxAccessLevel !== 'undefined') {
    await prisma.derivedPermission.create({
      data: {
        permissionLevel: maxAccessLevel,
        derived,
        groupActivity: {
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
  }

  // if the activity still exists and the user had ADMIN / OWNER permissions on it,
  // the derived element permissions need to be recomputed (-> complete recompute required)
  // users with lower permissions on the activity will never obtained derived permissions through it
  // --> however, since the computation is based on derived activity permissions, we need to compute these before
  await propagateActivityToElementsUser(
    { stacks: groupActivity.stacks, userId },
    prisma
  )

  return
}

async function recomputeGroupActivityPermissionsObject(
  { id }: { id: string },
  prisma: PrismaTransactionClient
) {
  // delete all derived permissions for this element
  await prisma.derivedPermission.deleteMany({
    where: {
      groupActivityId: id,
    },
  })

  // fetch the object and all direct permissions on it, including user groups, as well as activities the element is used in
  // permissions on the course should automatically imply corresponding permissions on the contained group activities
  // depending on the permission level on the activity, derived permissions on the contained elements might be required
  const groupActivity = await prisma.groupActivity.findUnique({
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
      // course from which derived permissions would be inherited
      course: {
        include: {
          permissions: {
            include: {
              directPermission: true,
            },
          },
        },
      },
      // element instances contained in the activity to propagate the derived permission update to elements
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  if (!groupActivity) {
    console.error(
      `Group activity with id ${id} or corresponding owner not found`
    )
    return
  }

  // compute a map between all users with direct or direct access to the considered activity
  const userAccess = getActivityPermissionsObject({
    activityOwnerId: groupActivity.ownerId,
    activityDeleted: groupActivity.isDeleted,
    directPermissions: groupActivity.directPermissions,
    coursePermissions: groupActivity.course?.permissions ?? [],
  })

  // create derived permissions for each user with access
  await prisma.derivedPermission.createMany({
    data: Object.entries(userAccess).map(
      ([userId, { maxAccessLevel, parentPermissionId, derived }]) => ({
        permissionLevel: maxAccessLevel,
        derived,
        userId,
        groupActivityId: id,
        directPermissionId: parentPermissionId,
      })
    ),
  })

  // recompute the derived permissions on all elements contained in this activity
  await propagateActivityToElements({ stacks: groupActivity.stacks }, prisma)
}
// #endregion

// ! Derived permission recomputation for courses
// #region
async function recomputeCoursePermissions(
  {
    id,
    userId,
  }: {
    id: string
    userId?: string
  },
  prisma: PrismaTransactionClient
) {
  // if a user is defined, only recompute derived permissions for this user
  if (userId) {
    return await recomputeCoursePermissionsUser({ id, userId }, prisma)
  }

  // if the permission of a user group was modified or anything else, all derived permissions for the object need to be recomputed
  return await recomputeCoursePermissionsObject({ id }, prisma)
}

async function recomputeCoursePermissionsUser(
  { id, userId }: { id: string; userId: string },
  prisma: PrismaTransactionClient
) {
  // check if a permission for this user exists
  const existingPermission = await prisma.derivedPermission.findUnique({
    where: {
      courseId_userId: {
        courseId: id,
        userId,
      },
    },
  })

  // if a derived permission exists, remove it
  if (existingPermission) {
    await prisma.derivedPermission.delete({
      where: {
        courseId_userId: {
          courseId: id,
          userId,
        },
      },
    })
  }

  // check if the user has a direct permission or ownership on the course and fetch all linked activities for dependency updates
  const course = await prisma.course.findUnique({
    where: {
      id,
    },
    include: {
      directPermissions: {
        where: {
          OR: [
            { userId },
            { userGroup: { members: { some: { id: userId } } } },
          ],
        },
      },
      // activities in course that inherit permissions from it
      liveQuizzes: true,
      practiceQuizzes: true,
      microLearnings: true,
      groupActivities: true,
    },
  })

  // if the course does not exist, return
  if (!course) {
    return
  }

  // determine the maximum access level of the user
  let maxAccessLevel: DB.PermissionLevel | undefined = undefined
  let parentPermissionId: number | undefined = undefined
  let derived = false

  if (course.ownerId === userId) {
    maxAccessLevel = DB.PermissionLevel.OWNER
  } else if (course.directPermissions.length > 0) {
    // determine the highest available direct permission level (groups and individual direct permissions)
    const { maxDirectPermission, directPermissionId } =
      getMaxAccessLevelIndividual({
        directPermissions: course.directPermissions,
      })

    maxAccessLevel = inversePermissionLevelMap[maxDirectPermission]
    parentPermissionId = directPermissionId
  } else {
    return
  }

  // if the user has access, add a corresponding derived permission
  if (typeof maxAccessLevel !== 'undefined') {
    await prisma.derivedPermission.create({
      data: {
        permissionLevel: maxAccessLevel,
        derived,
        course: { connect: { id } },
        directPermission:
          typeof parentPermissionId !== 'undefined'
            ? { connect: { id: parentPermissionId } }
            : undefined,
        user: { connect: { id: userId } },
      },
    })
  }

  // recompute the derived permissions on all activities contained in this course (sequentially)
  for (const liveQuiz of course.liveQuizzes) {
    await recomputeLiveQuizPermissionsUser({ id: liveQuiz.id, userId }, prisma)
  }
  for (const practiceQuiz of course.practiceQuizzes) {
    await recomputePracticeQuizPermissionsUser(
      { id: practiceQuiz.id, userId },
      prisma
    )
  }
  for (const microLearning of course.microLearnings) {
    await recomputeMicroLearningPermissionsUser(
      { id: microLearning.id, userId },
      prisma
    )
  }
  for (const groupActivity of course.groupActivities) {
    await recomputeGroupActivityPermissionsUser(
      { id: groupActivity.id, userId },
      prisma
    )
  }

  return
}

async function recomputeCoursePermissionsObject(
  { id }: { id: string },
  prisma: PrismaTransactionClient
) {
  // delete all derived permissions for this course
  await prisma.derivedPermission.deleteMany({
    where: {
      courseId: id,
    },
  })

  // fetch the course and all direct permissions on it, including user groups, as well as all activities on the course for propagation
  const course = await prisma.course.findUnique({
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
      // activities in course that inherit permissions from it
      liveQuizzes: true,
      practiceQuizzes: true,
      microLearnings: true,
      groupActivities: true,
    },
  })

  if (!course) {
    console.error(`Course with id ${id} not found`)
    return
  }

  // determine the access map based on ownership and direct permissions (no derived access on courses is possible)
  const userAccess = getMaxAccessLevelCombined({
    directPermissions: course.directPermissions,
    objectDeleted: false, // soft-deletion is not possible for courses
    ownerId: course.ownerId,
  })

  // create derived permissions for each user with access
  await prisma.derivedPermission.createMany({
    data: Object.entries(userAccess).map(
      ([userId, { maxAccessLevel, parentPermissionId, derived }]) => ({
        permissionLevel: maxAccessLevel,
        derived,
        userId,
        courseId: id,
        directPermissionId: parentPermissionId,
      })
    ),
  })

  // recompute the derived permissions on all activities contained in this course (sequentially)
  for (const liveQuiz of course.liveQuizzes) {
    await recomputeLiveQuizPermissionsObject({ id: liveQuiz.id }, prisma)
  }
  for (const practiceQuiz of course.practiceQuizzes) {
    await recomputePracticeQuizPermissionsObject(
      { id: practiceQuiz.id },
      prisma
    )
  }
  for (const microLearning of course.microLearnings) {
    await recomputeMicroLearningPermissionsObject(
      { id: microLearning.id },
      prisma
    )
  }
  for (const groupActivity of course.groupActivities) {
    await recomputeGroupActivityPermissionsObject(
      { id: groupActivity.id },
      prisma
    )
  }
}
// #endregion

// ! Generic helper functions for maximum access level determination (for objects WITHOUT derived access rights)
// #region
// maximum access level determination based on direct permissions (individual and group) for a single user
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

// maximum access level determination based on direct permissions (individual and group) for all users with access to the object
function getMaxAccessLevelCombined({
  directPermissions,
  objectDeleted,
  ownerId,
}: {
  directPermissions: (DB.Permission & {
    userGroup?: (DB.UserGroup & { members: DB.User[] }) | null
  })[]
  objectDeleted: boolean
  ownerId?: string | null
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
            derived: false,
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
              derived: false,
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
    ownerId && !objectDeleted
      ? {
          [ownerId]: {
            maxAccessLevel: DB.PermissionLevel.OWNER,
            parentPermissionId: undefined,
            derived: false,
          },
        }
      : {}
  )

  return userAccess
}

// compute access level for activity based on course permissions and propagation parameters
function getActivityAccessFromCourse({
  coursePermissionLevel,
  directCoursePermission,
}: {
  coursePermissionLevel: DB.PermissionLevel
  directCoursePermission?: DB.Permission | null
}) {
  let maxAccessLevel: DB.PermissionLevel | undefined = undefined
  let parentPermissionId: number | undefined = undefined
  let derived = false

  switch (coursePermissionLevel) {
    // if the user has ADMIN (or OWNER) permissions on the course, these rights need to be propagated for sharing functionalities to work properly
    case DB.PermissionLevel.OWNER:
    case DB.PermissionLevel.ADMIN:
      maxAccessLevel = DB.PermissionLevel.ADMIN
      parentPermissionId = directCoursePermission?.id
      derived = true
      break

    // if the user has WRITE permissions on the course, READ or WRITE access is derived (depending on propagation setting)
    case DB.PermissionLevel.WRITE:
      maxAccessLevel = directCoursePermission?.propagation
        ? DB.PermissionLevel.WRITE
        : DB.PermissionLevel.READ
      parentPermissionId = directCoursePermission?.id
      derived = true
      break

    // if the user has EXECUTION permissions on the course, propagate these rights
    case DB.PermissionLevel.EXECUTE:
      maxAccessLevel = DB.PermissionLevel.EXECUTE
      parentPermissionId = directCoursePermission?.id
      derived = true
      break

    // if the user has READ permissions on the course, automatically also add READ permissions on the quiz
    case DB.PermissionLevel.READ:
      maxAccessLevel = DB.PermissionLevel.READ
      parentPermissionId = directCoursePermission?.id
      derived = true
      break
  }

  return { maxAccessLevel, parentPermissionId, derived }
}

function getActivityPermissionsUser({
  activityOwnerId,
  activityDeleted,
  userId,
  directPermissions,
  coursePermissions,
}: {
  activityOwnerId: string
  activityDeleted: boolean
  userId: string
  directPermissions: DB.Permission[]
  coursePermissions: (DB.DerivedPermission & {
    directPermission?: DB.Permission | null
  })[]
}) {
  // determine the maximum access level of the user
  let maxAccessLevel: DB.PermissionLevel | undefined = undefined
  let parentPermissionId: number | undefined = undefined
  let derived = false

  // if user is answer collection owner, set the corresponding permission
  if (activityOwnerId === userId && !activityDeleted) {
    maxAccessLevel = DB.PermissionLevel.OWNER
  }
  // if the user has a direct permission or a derived access, use this case
  else if (
    directPermissions.length > 0 ||
    (coursePermissions.length ?? -1) > 0
  ) {
    // if the activity is soft-deleted, no direct permissions are valid anymore
    if (directPermissions.length > 0 && !activityDeleted) {
      // determine the highest available direct permission level
      const { maxDirectPermission, directPermissionId } =
        getMaxAccessLevelIndividual({
          directPermissions: directPermissions,
        })

      maxAccessLevel = inversePermissionLevelMap[maxDirectPermission]
      parentPermissionId = directPermissionId
    }

    // is the user is also granted access to the course the object is contained in, we need to check it for higher derived permission levels
    if ((coursePermissions.length ?? -1) > 0) {
      // if the user has more than one derived permission on the linked element, something went wrong
      if (coursePermissions.length !== 1) {
        throw new Error(
          `More or less than one derived permission found for a course linked to an activity and a single user ${userId} (id).`
        )
      }

      // derived permission on this object for this user should be unique
      const permission = coursePermissions[0]!

      // compute the derived permissions based on the course permissions
      const {
        maxAccessLevel: courseMaxAccessLevel,
        parentPermissionId: courseParentPermissionId,
        derived: courseDerived,
      } = getActivityAccessFromCourse({
        coursePermissionLevel: permission.permissionLevel,
        directCoursePermission: permission.directPermission,
      })

      // check if the derived access level is higher than the currently known maximum one
      if (
        typeof maxAccessLevel === 'undefined' ||
        (typeof courseMaxAccessLevel !== 'undefined' &&
          permissionLevelMap[courseMaxAccessLevel] >
            permissionLevelMap[maxAccessLevel])
      ) {
        maxAccessLevel = courseMaxAccessLevel
        parentPermissionId = courseParentPermissionId
        derived = courseDerived
      }
    }
  } else {
    return null
  }

  return { maxAccessLevel, parentPermissionId, derived }
}

async function propagateActivityToElementsUser(
  {
    stacks,
    userId,
  }: {
    stacks:
      | (Partial<DB.ElementBlock> & { elements: DB.ElementInstance[] }[])
      | (Partial<DB.ElementStack> & { elements: DB.ElementInstance[] }[])
    userId: string
  },
  prisma: PrismaTransactionClient
) {
  const elementIds = [
    ...new Set(
      stacks.flatMap((stack) =>
        stack.elements.map((instance) => instance.elementId)
      )
    ),
  ]

  // sequentially update all elements
  for (const elementId of elementIds) {
    await recomputeElementPermissionsUser({ id: elementId, userId }, prisma)
  }
}

function getActivityPermissionsObject({
  activityOwnerId,
  activityDeleted,
  directPermissions,
  coursePermissions,
}: {
  activityOwnerId: string
  activityDeleted: boolean
  directPermissions: DB.Permission[]
  coursePermissions: (DB.DerivedPermission & {
    directPermission?: DB.Permission | null
  })[]
}) {
  // determine the access map based on ownership and direct permissions
  const directUserAccess = getMaxAccessLevelCombined({
    directPermissions: directPermissions,
    objectDeleted: activityDeleted,
    ownerId: activityOwnerId,
  })

  // extend the user access map based on the course permissions
  const userAccess =
    coursePermissions.length > 0
      ? coursePermissions.reduce<UserAccessMap>(
          (acc, coursePermission) => {
            // get the corresponding direct permission
            const directCoursePermission = coursePermission.directPermission

            if (
              !directCoursePermission &&
              coursePermission.permissionLevel !== DB.PermissionLevel.OWNER
            ) {
              return acc
            }

            // depending on the permission level and the propagation setting on the direct course permission, choose the derived permission level
            const {
              maxAccessLevel: courseMaxAccessLevel,
              parentPermissionId: courseParentPermissionId,
              derived: courseDerived,
            } = getActivityAccessFromCourse({
              coursePermissionLevel: coursePermission.permissionLevel,
              directCoursePermission: coursePermission.directPermission,
            })

            // if the user is granted derived access through the course permission and this access level is higher than the current one, update it
            if (
              typeof courseMaxAccessLevel !== 'undefined' &&
              (typeof acc[coursePermission.userId] === 'undefined' ||
                permissionLevelMap[courseMaxAccessLevel] >
                  permissionLevelMap[
                    acc[coursePermission.userId]!.maxAccessLevel
                  ])
            ) {
              acc[coursePermission.userId] = {
                maxAccessLevel: courseMaxAccessLevel,
                parentPermissionId: courseParentPermissionId,
                derived: courseDerived,
              }
            }

            return acc
          },
          { ...directUserAccess }
        )
      : directUserAccess

  return userAccess
}

export async function propagateActivityToElements(
  {
    stacks,
  }: {
    stacks:
      | (Partial<DB.ElementBlock> & { elements: DB.ElementInstance[] }[])
      | (Partial<DB.ElementStack> & { elements: DB.ElementInstance[] }[])
  },
  prisma: PrismaTransactionClient
) {
  const elementIds = [
    ...new Set(
      stacks.flatMap((stack) =>
        stack.elements.map((instance) => instance.elementId)
      )
    ),
  ]

  // sequentially update all elements
  for (const elementId of elementIds) {
    await recomputeElementPermissionsObject({ id: elementId }, prisma)
  }
}
// #endregion
