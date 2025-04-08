import * as DB from '@klicker-uzh/prisma'
import { MISSING_CATALOG_COLLECTION_ID } from './sharing.js'
import { PrismaTransactionClient } from './stacks.js'

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
    // optional user to limit the required recomputation
    userId,
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
    const derivedPermission = await prisma.derivedPermission.create({
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

// ! Derived permission recomputation for answer collections
// #region
async function recomputeAnswerCollectionPermissions(
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
  if (answerCollection.ownerId === userId) {
    maxAccessLevel = DB.PermissionLevel.OWNER
  }
  // if the user has a direct permission or a derived access, use this case
  else if (
    answerCollection.directPermissions.length > 0 ||
    answerCollection.linkedElements.length > 0 ||
    answerCollection.linkedTemplates.length > 0
  ) {
    if (answerCollection.directPermissions.length > 0) {
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
    const derivedPermission = await prisma.derivedPermission.create({
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

  if (!answerCollection || !answerCollection.ownerId) {
    throw new Error(`Catalog collection with id ${id} not found`)
  }

  // determine the access map based on ownership and direct permissions
  const directUserAccess = getMaxAccessLevelCombined({
    directPermissions: answerCollection.directPermissions,
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

// ! Derived permission recomputation for answer collections
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
      // fetch all instances that are included in acitvities where the user has admin permissions -> derived admin permissions
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

  if (element.ownerId === userId) {
    maxAccessLevel = DB.PermissionLevel.OWNER
  } else {
    // determine the highest available direct permission level (groups and individual direct permissions)
    if (element.directPermissions.length > 0) {
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

  if (!element || !element.ownerId) {
    throw new Error(`Catalog collection with id ${id} not found`)
  }

  // determine the access map based on ownership and direct permissions
  const directUserAccess = getMaxAccessLevelCombined({
    directPermissions: element.directPermissions,
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

// TODO: for activity permissions: check if course above has permissions that propagate downwards & call element derived permission propagation to continue propagation (if necessary = ADMIN / OWNER permissions on activity)
// TODO: for course permissions: compute derived permissions based on direct permissions and call activity permission recomputation depending on the access level of the user (however, pretty much every permission level on the course implies permissions on the contained activities - KEEP IN MIND EFFECT OF PROPAGATION PARAMETER HERE)

// ! Generic helper functions for maximum access level determination (for objects WITHOUT derived access rights)
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
    {
      [ownerId]: {
        maxAccessLevel: DB.PermissionLevel.OWNER,
        parentPermissionId: undefined,
        derived: false,
      },
    }
  )

  return userAccess
}
