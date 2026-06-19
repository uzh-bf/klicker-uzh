import {
  ActivityLogType,
  AuditLogType,
  ObjectAccess,
  ObjectType,
  PermissionLevel,
  PublicationStatus,
  type CatalogCollectionAssignment,
  type DerivedPermission,
  type Prisma,
} from '@klicker-uzh/prisma/client'
import {
  MISSING_CATALOG_COLLECTION_ID,
  recomputeDerivedPermissions,
  updateAccessRequestInstances,
} from '@klicker-uzh/util'
import { getPrisma } from '../context.js'
import {
  sortDerivedPermissionInfos,
  sortPermissionInfos,
  toActivityLogEntry,
  toCatalogCollection,
  toCatalogObjectsFromAssignment,
  toCatalogSharingRequest,
  toDerivedPermissionInfo,
  toOwnerPermission,
  toPermissionInfo,
  toUserGroupMember,
} from '../dto/sharing.js'
import { router } from '../init.js'
import { hasObjectPermission } from '../permissions.js'
import { userFullAccessProcedure, userProcedure } from '../procedures.js'
import {
  activityLogEntryInput,
  addActivityMessageInput,
  addObjectToCatalogInput,
  addUserToUserGroupInput,
  approveObjectSharingRequestInput,
  catalogCollectionAccessInput,
  catalogCollectionInput,
  catalogCollectionNameInput,
  catalogObjectAccessInput,
  catalogObjectActionInput,
  changePermissionLevelInput,
  createCatalogCollectionInput,
  createUserGroupInput,
  deleteCatalogCollectionInput,
  demoteGroupAdminInput,
  derivedPermissionOriginInput,
  objectActivityInput,
  promoteGroupMemberInput,
  removeCatalogObjectAssignmentInput,
  removeObjectInput,
  requestCatalogCollectionInput,
  requestCatalogObjectInput,
  revokeObjectAccessInput,
  shareObjectInput,
  sharingRequestInput,
  transferGroupOwnershipInput,
  transferObjectOwnershipInput,
  userGroupInput,
  userGroupNameInput,
  userGroupUserInput,
} from '../schemas/sharing.js'

type ActivityLogObjectFields = Pick<
  Prisma.ActivityLogEntryUncheckedCreateInput,
  | 'answerCollectionId'
  | 'elementId'
  | 'courseId'
  | 'liveQuizId'
  | 'practiceQuizId'
  | 'microLearningId'
  | 'groupActivityId'
>

type PermissionObjectScope = Pick<
  Prisma.PermissionUncheckedCreateInput,
  | 'catalogCollectionId'
  | 'answerCollectionId'
  | 'elementId'
  | 'courseId'
  | 'liveQuizId'
  | 'practiceQuizId'
  | 'microLearningId'
  | 'groupActivityId'
>

type UserGroupPermission = Pick<
  Prisma.PermissionGetPayload<{}>,
  keyof PermissionObjectScope
>

type RecomputePermissionScope = Parameters<
  typeof recomputeDerivedPermissions
>[0]

type UpdateAccessRequestScope = Parameters<
  typeof updateAccessRequestInstances
>[0]

const adminPermissionLevels = [PermissionLevel.ADMIN, PermissionLevel.OWNER]

const writePermissionLevels = [
  PermissionLevel.WRITE,
  PermissionLevel.ADMIN,
  PermissionLevel.OWNER,
]

const readPermissionLevels = [
  PermissionLevel.READ,
  PermissionLevel.EXECUTE,
  PermissionLevel.WRITE,
  PermissionLevel.ADMIN,
  PermissionLevel.OWNER,
]

const directPermissionInclude = {
  user: { select: { id: true, shortname: true, email: true } },
  userGroup: { select: { id: true, name: true } },
} satisfies Prisma.PermissionInclude

const derivedPermissionInclude = {
  user: { select: { shortname: true, email: true } },
} satisfies Prisma.DerivedPermissionInclude

const derivedPermissionOriginInclude = {
  user: { select: { shortname: true, email: true } },
  directPermission: {
    include: {
      user: { select: { shortname: true } },
      userGroup: { select: { name: true } },
      catalogCollection: {
        include: { owner: { select: { shortname: true } } },
      },
      answerCollection: {
        include: { owner: { select: { shortname: true } } },
      },
      element: { include: { owner: { select: { shortname: true } } } },
      course: { include: { owner: { select: { shortname: true } } } },
      liveQuiz: { include: { owner: { select: { shortname: true } } } },
      practiceQuiz: {
        include: { owner: { select: { shortname: true } } },
      },
      microLearning: {
        include: { owner: { select: { shortname: true } } },
      },
      groupActivity: {
        include: { owner: { select: { shortname: true } } },
      },
    },
  },
} satisfies Prisma.DerivedPermissionInclude

type DerivedPermissionOriginSource = Prisma.DerivedPermissionGetPayload<{
  include: typeof derivedPermissionOriginInclude
}>

type AccessRequestScopeSource = Pick<
  Prisma.AccessRequestGetPayload<{}>,
  | 'catalogCollectionId'
  | 'answerCollectionId'
  | 'elementId'
  | 'courseId'
  | 'liveQuizId'
  | 'practiceQuizId'
  | 'microLearningId'
  | 'groupActivityId'
>

type CatalogCollectionAssignmentScopeSource = Pick<
  CatalogCollectionAssignment,
  | 'answerCollectionId'
  | 'elementId'
  | 'courseId'
  | 'liveQuizId'
  | 'practiceQuizId'
  | 'microLearningId'
  | 'groupActivityId'
> & {
  catalogCollectionId?: string | null
}

type CatalogActionScope =
  | { answerCollectionId: number; elementId?: undefined }
  | { elementId: number; answerCollectionId?: undefined }

type AddCatalogObjectScope =
  | {
      answerCollectionId: number
      elementId?: undefined
      liveQuizId?: undefined
    }
  | {
      elementId: number
      answerCollectionId?: undefined
      liveQuizId?: undefined
    }
  | {
      liveQuizId: string
      answerCollectionId?: undefined
      elementId?: undefined
    }

function parseNumericObjectId(objectId: string) {
  const parsedObjectId = Number.parseInt(objectId, 10)

  return Number.isNaN(parsedObjectId) ? null : parsedObjectId
}

function getActivityLogObjectFields({
  objectId,
  objectType,
}: {
  objectId: string
  objectType: ObjectType
}): ActivityLogObjectFields | null {
  switch (objectType) {
    case ObjectType.ANSWER_COLLECTION: {
      const answerCollectionId = parseNumericObjectId(objectId)
      return answerCollectionId === null ? null : { answerCollectionId }
    }
    case ObjectType.ELEMENT: {
      const elementId = parseNumericObjectId(objectId)
      return elementId === null ? null : { elementId }
    }
    case ObjectType.COURSE:
      return { courseId: objectId }
    case ObjectType.LIVE_QUIZ:
      return { liveQuizId: objectId }
    case ObjectType.PRACTICE_QUIZ:
      return { practiceQuizId: objectId }
    case ObjectType.MICRO_LEARNING:
      return { microLearningId: objectId }
    case ObjectType.GROUP_ACTIVITY:
      return { groupActivityId: objectId }
    case ObjectType.CATALOG_COLLECTION:
    case ObjectType.USER_GROUP:
      return null
  }
}

function getPermissionObjectScope({
  objectId,
  objectType,
}: {
  objectId: string
  objectType: ObjectType
}): PermissionObjectScope | null {
  switch (objectType) {
    case ObjectType.CATALOG_COLLECTION:
      return { catalogCollectionId: objectId }
    case ObjectType.ANSWER_COLLECTION: {
      const answerCollectionId = parseNumericObjectId(objectId)
      return answerCollectionId === null ? null : { answerCollectionId }
    }
    case ObjectType.ELEMENT: {
      const elementId = parseNumericObjectId(objectId)
      return elementId === null ? null : { elementId }
    }
    case ObjectType.COURSE:
      return { courseId: objectId }
    case ObjectType.LIVE_QUIZ:
      return { liveQuizId: objectId }
    case ObjectType.PRACTICE_QUIZ:
      return { practiceQuizId: objectId }
    case ObjectType.MICRO_LEARNING:
      return { microLearningId: objectId }
    case ObjectType.GROUP_ACTIVITY:
      return { groupActivityId: objectId }
    case ObjectType.USER_GROUP:
      return null
  }
}

function getAuditLogObjectType(scope: PermissionObjectScope): {
  objectType: ObjectType
  objectId: string
} {
  const defined = [
    [ObjectType.CATALOG_COLLECTION, scope.catalogCollectionId],
    [ObjectType.ANSWER_COLLECTION, scope.answerCollectionId],
    [ObjectType.ELEMENT, scope.elementId],
    [ObjectType.COURSE, scope.courseId],
    [ObjectType.LIVE_QUIZ, scope.liveQuizId],
    [ObjectType.PRACTICE_QUIZ, scope.practiceQuizId],
    [ObjectType.MICRO_LEARNING, scope.microLearningId],
    [ObjectType.GROUP_ACTIVITY, scope.groupActivityId],
  ].filter(([, value]) => value != null)

  if (defined.length !== 1) {
    throw new Error(
      `Ambiguous permission object identifiers: ${JSON.stringify(scope)}`
    )
  }

  const [objectType, objectId] = defined[0]!
  return { objectType: objectType as ObjectType, objectId: String(objectId) }
}

async function hasAdminObjectPermission(
  prisma: Prisma.TransactionClient | ReturnType<typeof getPrisma>,
  scope: PermissionObjectScope,
  userId: string
) {
  const permissionLevel = { in: adminPermissionLevels }

  if (scope.catalogCollectionId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: scope.catalogCollectionId,
            userId,
          },
          permissionLevel,
        },
      })
    )
  }

  if (scope.answerCollectionId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: scope.answerCollectionId,
            userId,
          },
          permissionLevel,
        },
      })
    )
  }

  if (scope.elementId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: { elementId: scope.elementId, userId },
          permissionLevel,
        },
      })
    )
  }

  if (scope.courseId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: { courseId: scope.courseId, userId },
          permissionLevel,
        },
      })
    )
  }

  if (scope.liveQuizId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: { liveQuizId: scope.liveQuizId, userId },
          permissionLevel,
        },
      })
    )
  }

  if (scope.practiceQuizId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: scope.practiceQuizId,
            userId,
          },
          permissionLevel,
        },
      })
    )
  }

  if (scope.microLearningId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: scope.microLearningId,
            userId,
          },
          permissionLevel,
        },
      })
    )
  }

  if (scope.groupActivityId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: scope.groupActivityId,
            userId,
          },
          permissionLevel,
        },
      })
    )
  }

  return false
}

async function hasOwnerObjectPermission(
  prisma: Prisma.TransactionClient | ReturnType<typeof getPrisma>,
  scope: PermissionObjectScope,
  userId: string
) {
  const permissionLevel = PermissionLevel.OWNER

  if (scope.catalogCollectionId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId: scope.catalogCollectionId,
            userId,
          },
          permissionLevel,
        },
      })
    )
  }

  if (scope.answerCollectionId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          answerCollectionId_userId: {
            answerCollectionId: scope.answerCollectionId,
            userId,
          },
          permissionLevel,
        },
      })
    )
  }

  if (scope.elementId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          elementId_userId: { elementId: scope.elementId, userId },
          permissionLevel,
        },
      })
    )
  }

  if (scope.courseId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          courseId_userId: { courseId: scope.courseId, userId },
          permissionLevel,
        },
      })
    )
  }

  if (scope.liveQuizId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          liveQuizId_userId: { liveQuizId: scope.liveQuizId, userId },
          permissionLevel,
        },
      })
    )
  }

  if (scope.practiceQuizId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          practiceQuizId_userId: {
            practiceQuizId: scope.practiceQuizId,
            userId,
          },
          permissionLevel,
        },
      })
    )
  }

  if (scope.microLearningId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          microLearningId_userId: {
            microLearningId: scope.microLearningId,
            userId,
          },
          permissionLevel,
        },
      })
    )
  }

  if (scope.groupActivityId) {
    return Boolean(
      await prisma.derivedPermission.findUnique({
        where: {
          groupActivityId_userId: {
            groupActivityId: scope.groupActivityId,
            userId,
          },
          permissionLevel,
        },
      })
    )
  }

  return false
}

function permissionUserWhere(
  scope: PermissionObjectScope,
  userId: string
): Prisma.PermissionWhereUniqueInput {
  return {
    catalogCollectionId_userId: scope.catalogCollectionId
      ? { catalogCollectionId: scope.catalogCollectionId, userId }
      : undefined,
    answerCollectionId_userId: scope.answerCollectionId
      ? { answerCollectionId: scope.answerCollectionId, userId }
      : undefined,
    elementId_userId: scope.elementId
      ? { elementId: scope.elementId, userId }
      : undefined,
    courseId_userId: scope.courseId
      ? { courseId: scope.courseId, userId }
      : undefined,
    liveQuizId_userId: scope.liveQuizId
      ? { liveQuizId: scope.liveQuizId, userId }
      : undefined,
    practiceQuizId_userId: scope.practiceQuizId
      ? { practiceQuizId: scope.practiceQuizId, userId }
      : undefined,
    microLearningId_userId: scope.microLearningId
      ? { microLearningId: scope.microLearningId, userId }
      : undefined,
    groupActivityId_userId: scope.groupActivityId
      ? { groupActivityId: scope.groupActivityId, userId }
      : undefined,
  }
}

function permissionUserGroupWhere(
  scope: PermissionObjectScope,
  userGroupId: number
): Prisma.PermissionWhereUniqueInput {
  return {
    catalogCollectionId_userGroupId: scope.catalogCollectionId
      ? { catalogCollectionId: scope.catalogCollectionId, userGroupId }
      : undefined,
    answerCollectionId_userGroupId: scope.answerCollectionId
      ? { answerCollectionId: scope.answerCollectionId, userGroupId }
      : undefined,
    elementId_userGroupId: scope.elementId
      ? { elementId: scope.elementId, userGroupId }
      : undefined,
    courseId_userGroupId: scope.courseId
      ? { courseId: scope.courseId, userGroupId }
      : undefined,
    liveQuizId_userGroupId: scope.liveQuizId
      ? { liveQuizId: scope.liveQuizId, userGroupId }
      : undefined,
    practiceQuizId_userGroupId: scope.practiceQuizId
      ? { practiceQuizId: scope.practiceQuizId, userGroupId }
      : undefined,
    microLearningId_userGroupId: scope.microLearningId
      ? { microLearningId: scope.microLearningId, userGroupId }
      : undefined,
    groupActivityId_userGroupId: scope.groupActivityId
      ? { groupActivityId: scope.groupActivityId, userGroupId }
      : undefined,
  }
}

async function recomputeForScope(
  scope: PermissionObjectScope,
  prisma: Prisma.TransactionClient,
  options?: { userId?: string; updateAccessRequests?: boolean }
) {
  await recomputeDerivedPermissions(
    { ...scope, ...options } as RecomputePermissionScope,
    prisma
  )
}

async function updateAccessRequestsForScope(
  scope: PermissionObjectScope,
  prisma: Prisma.TransactionClient,
  options?: { userId?: string }
) {
  await updateAccessRequestInstances(
    { ...scope, ...options } as UpdateAccessRequestScope,
    prisma
  )
}

async function createPermissionAuditLog({
  prisma,
  scope,
  type,
  sourceUserId,
  targetUserId,
  targetUserGroupId,
  message,
}: {
  prisma: Prisma.TransactionClient
  scope: PermissionObjectScope
  type: AuditLogType
  sourceUserId: string
  targetUserId?: string | null
  targetUserGroupId?: number | null
  message: string
}) {
  const { objectType, objectId } = getAuditLogObjectType(scope)

  await prisma.auditLogEntry.create({
    data: {
      type,
      objectType,
      objectId,
      sourceUserId,
      targetUserId: targetUserId ?? undefined,
      targetUserGroupId: targetUserGroupId ?? undefined,
      message,
    },
  })
}

async function getObjectOwnerId(
  prisma: ReturnType<typeof getPrisma>,
  scope: PermissionObjectScope
) {
  if (scope.catalogCollectionId) {
    return (
      await prisma.catalogCollection.findUnique({
        where: { id: scope.catalogCollectionId },
        select: { ownerId: true },
      })
    )?.ownerId
  }

  if (scope.answerCollectionId) {
    return (
      await prisma.answerCollection.findUnique({
        where: { id: scope.answerCollectionId },
        select: { ownerId: true },
      })
    )?.ownerId
  }

  if (scope.elementId) {
    return (
      await prisma.element.findUnique({
        where: { id: scope.elementId },
        select: { ownerId: true },
      })
    )?.ownerId
  }

  if (scope.courseId) {
    return (
      await prisma.course.findUnique({
        where: { id: scope.courseId },
        select: { ownerId: true },
      })
    )?.ownerId
  }

  if (scope.liveQuizId) {
    return (
      await prisma.liveQuiz.findUnique({
        where: { id: scope.liveQuizId },
        select: { ownerId: true },
      })
    )?.ownerId
  }

  if (scope.practiceQuizId) {
    return (
      await prisma.practiceQuiz.findUnique({
        where: { id: scope.practiceQuizId },
        select: { ownerId: true },
      })
    )?.ownerId
  }

  if (scope.microLearningId) {
    return (
      await prisma.microLearning.findUnique({
        where: { id: scope.microLearningId },
        select: { ownerId: true },
      })
    )?.ownerId
  }

  if (scope.groupActivityId) {
    return (
      await prisma.groupActivity.findUnique({
        where: { id: scope.groupActivityId },
        select: { ownerId: true },
      })
    )?.ownerId
  }

  return null
}

async function updateObjectOwner(
  prisma: Prisma.TransactionClient,
  scope: PermissionObjectScope,
  newOwnerId: string
) {
  if (scope.catalogCollectionId) {
    await prisma.catalogCollection.update({
      where: { id: scope.catalogCollectionId },
      data: { owner: { connect: { id: newOwnerId } } },
    })
    return
  }

  if (scope.answerCollectionId) {
    await prisma.answerCollection.update({
      where: { id: scope.answerCollectionId },
      data: { owner: { connect: { id: newOwnerId } } },
    })
    return
  }

  if (scope.elementId) {
    await prisma.element.update({
      where: { id: scope.elementId },
      data: { owner: { connect: { id: newOwnerId } } },
    })
    return
  }

  if (scope.courseId) {
    await prisma.course.update({
      where: { id: scope.courseId },
      data: { owner: { connect: { id: newOwnerId } } },
    })
    return
  }

  if (scope.liveQuizId) {
    await prisma.liveQuiz.update({
      where: { id: scope.liveQuizId },
      data: { owner: { connect: { id: newOwnerId } } },
    })
    return
  }

  if (scope.practiceQuizId) {
    await prisma.practiceQuiz.update({
      where: { id: scope.practiceQuizId },
      data: { owner: { connect: { id: newOwnerId } } },
    })
    return
  }

  if (scope.microLearningId) {
    await prisma.microLearning.update({
      where: { id: scope.microLearningId },
      data: { owner: { connect: { id: newOwnerId } } },
    })
    return
  }

  if (scope.groupActivityId) {
    await prisma.groupActivity.update({
      where: { id: scope.groupActivityId },
      data: { owner: { connect: { id: newOwnerId } } },
    })
  }
}

function rejectsSameOwnerTransfer(scope: PermissionObjectScope) {
  return Boolean(
    scope.liveQuizId ||
      scope.practiceQuizId ||
      scope.microLearningId ||
      scope.groupActivityId
  )
}

function toObjectPermissionsResult(
  object: {
    ownerId: string | null
    owner?: { id: string; shortname: string; email: string } | null
    directPermissions: Array<
      Prisma.PermissionGetPayload<{ include: typeof directPermissionInclude }>
    >
  },
  userId: string
) {
  return {
    isOwner: object.ownerId === userId,
    ownerPermission: object.owner
      ? toOwnerPermission(object.owner, userId)
      : undefined,
    permissions: sortPermissionInfos(
      object.directPermissions.map((permission) =>
        toPermissionInfo(permission, userId)
      )
    ),
  }
}

async function getObjectPermissionsForScope(
  prisma: ReturnType<typeof getPrisma>,
  scope: PermissionObjectScope,
  userId: string
) {
  if (scope.catalogCollectionId) {
    const collection = await prisma.catalogCollection.findUnique({
      where: { id: scope.catalogCollectionId },
      include: {
        directPermissions: { include: directPermissionInclude },
        owner: { select: { id: true, shortname: true, email: true } },
      },
    })

    return collection
      ? toObjectPermissionsResult(collection, userId)
      : { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  if (scope.answerCollectionId) {
    const collection = await prisma.answerCollection.findUnique({
      where: { id: scope.answerCollectionId },
      include: {
        directPermissions: { include: directPermissionInclude },
        owner: { select: { id: true, shortname: true, email: true } },
      },
    })

    return collection
      ? toObjectPermissionsResult(collection, userId)
      : { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  if (scope.elementId) {
    const element = await prisma.element.findUnique({
      where: { id: scope.elementId },
      include: {
        directPermissions: { include: directPermissionInclude },
        owner: { select: { id: true, shortname: true, email: true } },
      },
    })

    return element
      ? toObjectPermissionsResult(element, userId)
      : { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  if (scope.courseId) {
    const course = await prisma.course.findUnique({
      where: { id: scope.courseId },
      include: {
        directPermissions: { include: directPermissionInclude },
        owner: { select: { id: true, shortname: true, email: true } },
      },
    })

    return course
      ? toObjectPermissionsResult(course, userId)
      : { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  if (scope.liveQuizId) {
    const liveQuiz = await prisma.liveQuiz.findUnique({
      where: { id: scope.liveQuizId },
      include: {
        directPermissions: { include: directPermissionInclude },
        owner: { select: { id: true, shortname: true, email: true } },
      },
    })

    return liveQuiz
      ? toObjectPermissionsResult(liveQuiz, userId)
      : { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  if (scope.practiceQuizId) {
    const practiceQuiz = await prisma.practiceQuiz.findUnique({
      where: { id: scope.practiceQuizId },
      include: {
        directPermissions: { include: directPermissionInclude },
        owner: { select: { id: true, shortname: true, email: true } },
      },
    })

    return practiceQuiz
      ? toObjectPermissionsResult(practiceQuiz, userId)
      : { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  if (scope.microLearningId) {
    const microLearning = await prisma.microLearning.findUnique({
      where: { id: scope.microLearningId },
      include: {
        directPermissions: { include: directPermissionInclude },
        owner: { select: { id: true, shortname: true, email: true } },
      },
    })

    return microLearning
      ? toObjectPermissionsResult(microLearning, userId)
      : { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  if (scope.groupActivityId) {
    const groupActivity = await prisma.groupActivity.findUnique({
      where: { id: scope.groupActivityId },
      include: {
        directPermissions: { include: directPermissionInclude },
        owner: { select: { id: true, shortname: true, email: true } },
      },
    })

    return groupActivity
      ? toObjectPermissionsResult(groupActivity, userId)
      : { isOwner: false, ownerPermission: undefined, permissions: [] }
  }

  return { isOwner: false, ownerPermission: undefined, permissions: [] }
}

function toDerivedPermissionsResult(
  object: {
    permissions: Array<
      Prisma.DerivedPermissionGetPayload<{
        include: typeof derivedPermissionInclude
      }>
    >
  } | null,
  userId: string
) {
  return sortDerivedPermissionInfos(
    (object?.permissions ?? []).map((permission) =>
      toDerivedPermissionInfo(permission, userId)
    )
  )
}

async function getDerivedPermissionsForScope(
  prisma: ReturnType<typeof getPrisma>,
  scope: PermissionObjectScope,
  userId: string
) {
  if (scope.catalogCollectionId) return []

  const include = {
    permissions: {
      where: { derived: true },
      include: derivedPermissionInclude,
    },
  }

  if (scope.answerCollectionId) {
    return toDerivedPermissionsResult(
      await prisma.answerCollection.findUnique({
        where: { id: scope.answerCollectionId },
        include,
      }),
      userId
    )
  }

  if (scope.elementId) {
    return toDerivedPermissionsResult(
      await prisma.element.findUnique({
        where: { id: scope.elementId },
        include,
      }),
      userId
    )
  }

  if (scope.courseId) {
    return toDerivedPermissionsResult(
      await prisma.course.findUnique({
        where: { id: scope.courseId },
        include,
      }),
      userId
    )
  }

  if (scope.liveQuizId) {
    return toDerivedPermissionsResult(
      await prisma.liveQuiz.findUnique({
        where: { id: scope.liveQuizId },
        include,
      }),
      userId
    )
  }

  if (scope.practiceQuizId) {
    return toDerivedPermissionsResult(
      await prisma.practiceQuiz.findUnique({
        where: { id: scope.practiceQuizId },
        include,
      }),
      userId
    )
  }

  if (scope.microLearningId) {
    return toDerivedPermissionsResult(
      await prisma.microLearning.findUnique({
        where: { id: scope.microLearningId },
        include,
      }),
      userId
    )
  }

  if (scope.groupActivityId) {
    return toDerivedPermissionsResult(
      await prisma.groupActivity.findUnique({
        where: { id: scope.groupActivityId },
        include,
      }),
      userId
    )
  }

  return []
}

function getPermissionScopeFromDerivedPermission(
  permission: Pick<
    DerivedPermission,
    | 'catalogCollectionId'
    | 'answerCollectionId'
    | 'elementId'
    | 'courseId'
    | 'liveQuizId'
    | 'practiceQuizId'
    | 'microLearningId'
    | 'groupActivityId'
  >
): PermissionObjectScope {
  return {
    catalogCollectionId: permission.catalogCollectionId ?? undefined,
    answerCollectionId: permission.answerCollectionId ?? undefined,
    elementId: permission.elementId ?? undefined,
    courseId: permission.courseId ?? undefined,
    liveQuizId: permission.liveQuizId ?? undefined,
    practiceQuizId: permission.practiceQuizId ?? undefined,
    microLearningId: permission.microLearningId ?? undefined,
    groupActivityId: permission.groupActivityId ?? undefined,
  }
}

function getPermissionScopeFromAccessRequest(
  request: AccessRequestScopeSource
): PermissionObjectScope {
  return {
    catalogCollectionId: request.catalogCollectionId ?? undefined,
    answerCollectionId: request.answerCollectionId ?? undefined,
    elementId: request.elementId ?? undefined,
    courseId: request.courseId ?? undefined,
    liveQuizId: request.liveQuizId ?? undefined,
    practiceQuizId: request.practiceQuizId ?? undefined,
    microLearningId: request.microLearningId ?? undefined,
    groupActivityId: request.groupActivityId ?? undefined,
  }
}

function emitObjectInvalidation(
  scope: PermissionObjectScope,
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
) {
  if (!emitter) return

  const defined = [
    ['CatalogCollection', scope.catalogCollectionId],
    ['AnswerCollection', scope.answerCollectionId],
    ['Element', scope.elementId],
    ['Course', scope.courseId],
    ['LiveQuiz', scope.liveQuizId],
    ['PracticeQuiz', scope.practiceQuizId],
    ['MicroLearning', scope.microLearningId],
    ['GroupActivity', scope.groupActivityId],
  ].filter(([, value]) => value != null)

  if (defined.length !== 1) return

  const [typename, id] = defined[0]!

  emitter.emit('invalidate', {
    typename,
    id,
  })
}

function toDerivedPermissionOrigin(permission: DerivedPermissionOriginSource) {
  const permissionUser = `${permission.user.shortname} (${permission.user.email})`

  if (permission.directPermission === null) {
    return {
      permissionUser,
      parentObjectType: undefined,
      parentObjectName: undefined,
      parentObjectOwner: undefined,
      parentTargetUser: undefined,
      parentTargetUserGroup: undefined,
      parentPermissionLevel: undefined,
    }
  }

  const directPermission = permission.directPermission
  const sharedDerivedPermissionInfo = {
    permissionUser,
    parentTargetUser: directPermission.user?.shortname,
    parentTargetUserGroup: directPermission.userGroup?.name,
    parentPermissionLevel: directPermission.permissionLevel,
  }

  if (directPermission.catalogCollection) {
    return {
      ...sharedDerivedPermissionInfo,
      parentObjectType: ObjectType.CATALOG_COLLECTION,
      parentObjectName: directPermission.catalogCollection.name,
      parentObjectOwner:
        directPermission.catalogCollection.owner?.shortname ?? '',
    }
  }

  if (directPermission.answerCollection) {
    return {
      ...sharedDerivedPermissionInfo,
      parentObjectType: ObjectType.ANSWER_COLLECTION,
      parentObjectName: directPermission.answerCollection.name,
      parentObjectOwner: directPermission.answerCollection.owner.shortname,
    }
  }

  if (directPermission.element) {
    return {
      ...sharedDerivedPermissionInfo,
      parentObjectType: ObjectType.ELEMENT,
      parentObjectName: directPermission.element.name,
      parentObjectOwner: directPermission.element.owner.shortname,
    }
  }

  if (directPermission.course) {
    return {
      ...sharedDerivedPermissionInfo,
      parentObjectType: ObjectType.COURSE,
      parentObjectName: directPermission.course.name,
      parentObjectOwner: directPermission.course.owner.shortname,
    }
  }

  if (directPermission.liveQuiz) {
    return {
      ...sharedDerivedPermissionInfo,
      parentObjectType: ObjectType.LIVE_QUIZ,
      parentObjectName: directPermission.liveQuiz.name,
      parentObjectOwner: directPermission.liveQuiz.owner.shortname,
    }
  }

  if (directPermission.practiceQuiz) {
    return {
      ...sharedDerivedPermissionInfo,
      parentObjectType: ObjectType.PRACTICE_QUIZ,
      parentObjectName: directPermission.practiceQuiz.name,
      parentObjectOwner: directPermission.practiceQuiz.owner.shortname,
    }
  }

  if (directPermission.microLearning) {
    return {
      ...sharedDerivedPermissionInfo,
      parentObjectType: ObjectType.MICRO_LEARNING,
      parentObjectName: directPermission.microLearning.name,
      parentObjectOwner: directPermission.microLearning.owner.shortname,
    }
  }

  if (directPermission.groupActivity) {
    return {
      ...sharedDerivedPermissionInfo,
      parentObjectType: ObjectType.GROUP_ACTIVITY,
      parentObjectName: directPermission.groupActivity.name,
      parentObjectOwner: directPermission.groupActivity.owner.shortname,
    }
  }

  return {
    permissionUser,
    parentObjectType: undefined,
    parentObjectName: undefined,
    parentObjectOwner: undefined,
    parentTargetUser: undefined,
    parentTargetUserGroup: undefined,
    parentPermissionLevel: undefined,
  }
}

async function shareObjectWithUser({
  prisma,
  scope,
  sourceUserId,
  shortnameOrEmail,
  permissionLevel,
  propagation,
}: {
  prisma: ReturnType<typeof getPrisma>
  scope: PermissionObjectScope
  sourceUserId: string
  shortnameOrEmail: string
  permissionLevel: PermissionLevel
  propagation: boolean
}) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ shortname: shortnameOrEmail }, { email: shortnameOrEmail }],
    },
    select: { id: true, shortname: true, email: true },
  })

  if (!user || user.id === sourceUserId) return null

  const permission = await prisma.$transaction(
    async (transaction) => {
      const newPermission = await transaction.permission.upsert({
        where: permissionUserWhere(scope, user.id),
        create: {
          permissionLevel,
          propagation,
          userId: user.id,
          ...scope,
        },
        update: { permissionLevel, propagation },
      })

      await transaction.accessRequest.deleteMany({
        where: {
          userId: user.id,
          ...scope,
        },
      })

      await recomputeForScope(scope, transaction, {
        userId: user.id,
        updateAccessRequests: permissionLevel === PermissionLevel.ADMIN,
      })

      const { objectType, objectId } = getAuditLogObjectType(scope)
      await createPermissionAuditLog({
        prisma: transaction,
        scope,
        type: AuditLogType.PERMISSION_GRANTED,
        sourceUserId,
        targetUserId: user.id,
        message: `Direct permission with level ${permissionLevel} granted for ${objectType} (ID ${objectId}) by owner / admin ${sourceUserId} to user ${user.id}.`,
      })

      return newPermission
    },
    { timeout: 60000 }
  )

  return {
    permissionId: permission.id,
    userId: user.id,
    username: user.shortname,
    userEmail: user.email,
    userGroupId: undefined,
    userGroupName: undefined,
    permissionLevel: permission.permissionLevel,
    propagation: permission.propagation,
    isOwn: false,
  }
}

async function shareObjectWithUserGroup({
  prisma,
  scope,
  sourceUserId,
  userGroupId,
  permissionLevel,
  propagation,
}: {
  prisma: ReturnType<typeof getPrisma>
  scope: PermissionObjectScope
  sourceUserId: string
  userGroupId: number
  permissionLevel: PermissionLevel
  propagation: boolean
}) {
  const userGroup = await prisma.userGroup.findFirst({
    where: {
      id: userGroupId,
      OR: [
        { ownerId: sourceUserId },
        { admins: { some: { id: sourceUserId } } },
        { members: { some: { id: sourceUserId } } },
      ],
    },
    select: { id: true, name: true },
  })

  if (!userGroup) return null

  const permission = await prisma.$transaction(
    async (transaction) => {
      const newPermission = await transaction.permission.upsert({
        where: permissionUserGroupWhere(scope, userGroupId),
        create: {
          permissionLevel,
          propagation,
          userGroupId,
          ...scope,
        },
        update: { permissionLevel, propagation },
      })

      await recomputeForScope(scope, transaction, {
        updateAccessRequests: permissionLevel === PermissionLevel.ADMIN,
      })

      const { objectType, objectId } = getAuditLogObjectType(scope)
      await createPermissionAuditLog({
        prisma: transaction,
        scope,
        type: AuditLogType.PERMISSION_GRANTED,
        sourceUserId,
        targetUserGroupId: userGroupId,
        message: `Direct permission with level ${permissionLevel} granted for ${objectType} (ID ${objectId}) by owner / admin ${sourceUserId} to user group ${userGroupId}.`,
      })

      return newPermission
    },
    { timeout: 60000 }
  )

  return {
    permissionId: permission.id,
    userId: undefined,
    username: undefined,
    userEmail: undefined,
    userGroupId: userGroup.id,
    userGroupName: userGroup.name,
    permissionLevel: permission.permissionLevel,
    propagation: permission.propagation,
    isOwn: false,
  }
}

async function countCatalogSharingRequests(
  prisma: ReturnType<typeof getPrisma>,
  userId: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { pendingRequests: true },
  })

  return user?.pendingRequests.length ?? 0
}

async function getCatalogSharingRequests(
  prisma: ReturnType<typeof getPrisma>,
  userId: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      pendingRequests: {
        include: {
          user: { select: { shortname: true, email: true } },
          catalogCollection: { select: { name: true } },
          answerCollection: { select: { name: true } },
          element: { select: { name: true } },
        },
      },
    },
  })

  if (!user) return null

  return user.pendingRequests
    .map(toCatalogSharingRequest)
    .filter((request) => request !== null)
}

async function hasCatalogCollectionReadPermission(
  prisma: ReturnType<typeof getPrisma>,
  catalogCollectionId: string,
  userId: string
) {
  return hasCatalogCollectionPermission(
    prisma,
    catalogCollectionId,
    userId,
    readPermissionLevels
  )
}

async function hasCatalogCollectionPermission(
  prisma: ReturnType<typeof getPrisma>,
  catalogCollectionId: string,
  userId: string,
  permissionLevels: PermissionLevel[]
) {
  const permission = await prisma.derivedPermission.findUnique({
    where: {
      catalogCollectionId_userId: {
        catalogCollectionId,
        userId,
      },
      permissionLevel: { in: permissionLevels },
    },
  })

  return Boolean(permission)
}

function getPermissionScopeFromCatalogAssignment(
  assignment: CatalogCollectionAssignmentScopeSource
): PermissionObjectScope {
  return {
    catalogCollectionId: assignment.catalogCollectionId ?? undefined,
    answerCollectionId: assignment.answerCollectionId ?? undefined,
    elementId: assignment.elementId ?? undefined,
    courseId: assignment.courseId ?? undefined,
    liveQuizId: assignment.liveQuizId ?? undefined,
    practiceQuizId: assignment.practiceQuizId ?? undefined,
    microLearningId: assignment.microLearningId ?? undefined,
    groupActivityId: assignment.groupActivityId ?? undefined,
  }
}

async function verifyCatalogObjectEditPermissions({
  prisma,
  assignmentId,
  userId,
}: {
  prisma: ReturnType<typeof getPrisma>
  assignmentId: number
  userId: string
}) {
  const assignment = await prisma.catalogCollectionAssignment.findUnique({
    where: { id: assignmentId },
  })

  if (!assignment) return false

  if (assignment.catalogCollectionId !== MISSING_CATALOG_COLLECTION_ID) {
    return hasCatalogCollectionPermission(
      prisma,
      assignment.catalogCollectionId,
      userId,
      writePermissionLevels
    )
  }

  const scope = getPermissionScopeFromCatalogAssignment({
    ...assignment,
    catalogCollectionId: undefined,
  })

  return hasAdminObjectPermission(prisma, scope, userId)
}

async function createCatalogCollection({
  prisma,
  userId,
  name,
  access,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
  name: string
  access: ObjectAccess
}) {
  const collection = await prisma.$transaction(
    async (transaction) => {
      const newCollection = await transaction.catalogCollection.create({
        data: { name, access, owner: { connect: { id: userId } } },
        include: { owner: { select: { shortname: true } } },
      })

      await recomputeDerivedPermissions(
        { catalogCollectionId: newCollection.id, userId },
        transaction
      )

      return newCollection
    },
    { timeout: 60000 }
  )

  return {
    id: collection.id,
    name: collection.name,
    access: collection.access,
    ownerShortname: collection.owner?.shortname ?? null,
    isOwner: true,
    isManager: true,
    isEditor: true,
    isRequested: false,
    isShared: false,
  }
}

async function changeCatalogCollectionAccess({
  prisma,
  emitter,
  userId,
  catalogCollectionId,
  access,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  userId: string
  catalogCollectionId: string
  access: ObjectAccess
}) {
  const collection = await prisma.$transaction(async (transaction) => {
    const updatedCollection = await transaction.catalogCollection.update({
      where: { id: catalogCollectionId },
      data: { access },
    })

    await transaction.auditLogEntry.create({
      data: {
        type: AuditLogType.CATALOG_ASSIGNMENT_MODIFIED,
        objectType: ObjectType.CATALOG_COLLECTION,
        objectId: catalogCollectionId,
        sourceUserId: userId,
        message: `Catalog collection access level changed to ${access}`,
      },
    })

    return updatedCollection
  })

  emitObjectInvalidation({ catalogCollectionId: collection.id }, emitter)

  return true
}

async function changeCatalogCollectionName({
  prisma,
  emitter,
  catalogCollectionId,
  name,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  catalogCollectionId: string
  name: string
}) {
  const updatedCollection = await prisma.catalogCollection.update({
    where: { id: catalogCollectionId },
    data: { name },
  })

  emitObjectInvalidation({ catalogCollectionId: updatedCollection.id }, emitter)

  return true
}

async function changeCatalogObjectAccess({
  prisma,
  emitter,
  userId,
  assignmentId,
  access,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  userId: string
  assignmentId: number
  access: ObjectAccess
}) {
  const sufficientPermissions = await verifyCatalogObjectEditPermissions({
    prisma,
    assignmentId,
    userId,
  })

  if (!sufficientPermissions) return false

  const updatedAssignment = await prisma.$transaction(async (transaction) => {
    const newAssignment = await transaction.catalogCollectionAssignment.update({
      where: { id: assignmentId },
      data: { access },
    })
    const scope = getPermissionScopeFromCatalogAssignment({
      ...newAssignment,
      catalogCollectionId: undefined,
    })
    const { objectType, objectId } = getAuditLogObjectType(scope)

    await transaction.auditLogEntry.create({
      data: {
        type: AuditLogType.CATALOG_ASSIGNMENT_MODIFIED,
        objectType,
        objectId,
        sourceUserId: userId,
        message: `Catalog object assignment (ID ${newAssignment.id} for ${objectType} with ID ${objectId}) access level changed to ${access}`,
      },
    })

    return newAssignment
  })

  emitter?.emit('invalidate', {
    typename: 'CatalogCollectionAssignment',
    id: updatedAssignment.id,
  })

  return (
    updatedAssignment.id !== null && typeof updatedAssignment.id !== 'undefined'
  )
}

async function deleteCatalogCollection({
  prisma,
  emitter,
  catalogCollectionId,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  catalogCollectionId: string
}) {
  const deletedCollection = await prisma.catalogCollection.delete({
    where: { id: catalogCollectionId },
  })

  emitObjectInvalidation({ catalogCollectionId }, emitter)

  return deletedCollection.id
}

async function verifyCatalogCollectionBrowsable({
  prisma,
  catalogCollectionId,
  userId,
}: {
  prisma: ReturnType<typeof getPrisma>
  catalogCollectionId: string
  userId: string
}) {
  if (catalogCollectionId === MISSING_CATALOG_COLLECTION_ID) {
    return true
  }

  const catalogCollection = await prisma.catalogCollection.findUnique({
    where: { id: catalogCollectionId },
    select: { access: true },
  })

  if (!catalogCollection) return false
  if (catalogCollection.access === ObjectAccess.PUBLIC) return true

  return hasCatalogCollectionReadPermission(prisma, catalogCollectionId, userId)
}

async function getCatalogCollectionInfo({
  prisma,
  userId,
  catalogCollectionId,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
  catalogCollectionId?: string | null
}) {
  if (
    !catalogCollectionId ||
    catalogCollectionId === MISSING_CATALOG_COLLECTION_ID
  ) {
    return null
  }

  const valid = await verifyCatalogCollectionBrowsable({
    prisma,
    catalogCollectionId,
    userId,
  })

  if (!valid) return null

  const collection = await prisma.catalogCollection.findUnique({
    where: { id: catalogCollectionId },
    include: {
      owner: { select: { shortname: true } },
      permissions: { where: { userId } },
      accessRequests: { where: { userId }, select: { id: true } },
    },
  })

  return collection ? toCatalogCollection(collection) : null
}

async function getCatalogCollectionsList(
  prisma: ReturnType<typeof getPrisma>,
  userId: string
) {
  const collections = await prisma.catalogCollection.findMany({
    where: { id: { not: MISSING_CATALOG_COLLECTION_ID } },
    include: {
      _count: { select: { objectAssignments: true } },
      owner: { select: { shortname: true } },
      permissions: { where: { userId } },
      accessRequests: { where: { userId }, select: { id: true } },
    },
  })

  return collections
    .filter(
      (collection) =>
        collection.ownerId === userId ||
        collection.access !== ObjectAccess.PUBLIC ||
        collection._count.objectAssignments !== 0 ||
        collection.permissions.length !== 0
    )
    .map(toCatalogCollection)
}

async function getCatalogObjects({
  prisma,
  userId,
  catalogCollectionId,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
  catalogCollectionId?: string | null
}) {
  if (
    catalogCollectionId &&
    !(await verifyCatalogCollectionBrowsable({
      prisma,
      catalogCollectionId,
      userId,
    }))
  ) {
    return []
  }

  const catalogCollection = await prisma.catalogCollection.findUnique({
    where: {
      id: catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
    },
    include: {
      objectAssignments: {
        include: {
          answerCollection: {
            where: { isDeleted: false },
            select: {
              id: true,
              name: true,
              owner: { select: { shortname: true } },
              permissions: { where: { userId } },
              accessRequests: { where: { userId }, select: { id: true } },
            },
          },
          element: {
            where: { isDeleted: false },
            select: {
              id: true,
              name: true,
              owner: { select: { shortname: true } },
              permissions: { where: { userId } },
              accessRequests: { where: { userId }, select: { id: true } },
            },
          },
          liveQuiz: {
            where: { isDeleted: false },
            select: {
              id: true,
              name: true,
              status: true,
              owner: { select: { shortname: true } },
              permissions: { where: { userId } },
              accessRequests: { where: { userId }, select: { id: true } },
              templateInfo: { select: { id: true } },
            },
          },
        },
      },
    },
  })

  return (
    catalogCollection?.objectAssignments
      .map(toCatalogObjectsFromAssignment)
      .filter((object) => object !== null) ?? []
  )
}

async function getCatalogAnswerCollections(
  prisma: ReturnType<typeof getPrisma>,
  userId: string
) {
  const collections = await prisma.answerCollection.findMany({
    where: {
      isDeleted: false,
      permissions: {
        some: {
          userId,
          permissionLevel: { in: adminPermissionLevels },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return collections.map((collection) => ({
    id: String(collection.id),
    name: collection.name,
  }))
}

async function getCatalogLiveQuizTemplates(
  prisma: ReturnType<typeof getPrisma>,
  userId: string
) {
  const liveQuizzes = await prisma.liveQuiz.findMany({
    where: {
      status: PublicationStatus.TEMPLATE,
      permissions: {
        some: {
          userId,
          permissionLevel: { in: adminPermissionLevels },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return liveQuizzes.map((liveQuiz) => ({
    id: liveQuiz.id,
    name: liveQuiz.name,
  }))
}

async function getCatalogElements(
  prisma: ReturnType<typeof getPrisma>,
  userId: string
) {
  const elements = await prisma.element.findMany({
    where: {
      isDeleted: false,
      permissions: {
        some: {
          userId,
          permissionLevel: { in: adminPermissionLevels },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return elements.map((element) => ({
    id: String(element.id),
    name: element.name,
  }))
}

function getCatalogActionScope({
  objectId,
  objectType,
}: {
  objectId: string
  objectType: ObjectType
}): CatalogActionScope | null {
  if (objectType === ObjectType.ANSWER_COLLECTION) {
    const answerCollectionId = parseNumericObjectId(objectId)
    return answerCollectionId === null ? null : { answerCollectionId }
  }

  if (objectType === ObjectType.ELEMENT) {
    const elementId = parseNumericObjectId(objectId)
    return elementId === null ? null : { elementId }
  }

  return null
}

function getAddCatalogObjectScope({
  objectId,
  objectType,
}: {
  objectId: string
  objectType: ObjectType
}): AddCatalogObjectScope | null {
  if (objectType === ObjectType.ANSWER_COLLECTION) {
    const answerCollectionId = parseNumericObjectId(objectId)
    return answerCollectionId === null ? null : { answerCollectionId }
  }

  if (objectType === ObjectType.ELEMENT) {
    const elementId = parseNumericObjectId(objectId)
    return elementId === null ? null : { elementId }
  }

  if (objectType === ObjectType.LIVE_QUIZ) {
    return { liveQuizId: objectId }
  }

  return null
}

async function getCatalogObjectInfoForAddition({
  prisma,
  userId,
  scope,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
  scope: AddCatalogObjectScope
}) {
  if (typeof scope.answerCollectionId !== 'undefined') {
    const answerCollection = await prisma.answerCollection.findUnique({
      where: {
        id: scope.answerCollectionId,
        permissions: {
          some: {
            userId,
            permissionLevel: { in: adminPermissionLevels },
          },
        },
      },
      include: {
        owner: { select: { shortname: true } },
        permissions: { where: { userId } },
      },
    })

    const permission = answerCollection?.permissions[0]
    if (!answerCollection || !permission) return null

    return {
      objectId: answerCollection.id,
      objectUuid: null,
      objectType: ObjectType.ANSWER_COLLECTION,
      objectName: answerCollection.name,
      ownerShortname: answerCollection.owner?.shortname ?? null,
      ownerId: answerCollection.ownerId,
      templateId: null,
      isShared: permission.permissionLevel !== PermissionLevel.OWNER,
    }
  }

  if (typeof scope.elementId !== 'undefined') {
    const element = await prisma.element.findUnique({
      where: {
        id: scope.elementId,
        permissions: {
          some: {
            userId,
            permissionLevel: { in: adminPermissionLevels },
          },
        },
      },
      include: {
        owner: { select: { shortname: true } },
        permissions: { where: { userId } },
      },
    })

    const permission = element?.permissions[0]
    if (!element || !permission) return null

    return {
      objectId: element.id,
      objectUuid: null,
      objectType: ObjectType.ELEMENT,
      objectName: element.name,
      ownerShortname: element.owner?.shortname ?? null,
      ownerId: element.ownerId,
      templateId: null,
      isShared: permission.permissionLevel !== PermissionLevel.OWNER,
    }
  }

  if (typeof scope.liveQuizId !== 'undefined') {
    const liveQuiz = await prisma.liveQuiz.findUnique({
      where: {
        id: scope.liveQuizId,
        status: PublicationStatus.TEMPLATE,
        permissions: {
          some: {
            userId,
            permissionLevel: { in: adminPermissionLevels },
          },
        },
      },
      include: {
        owner: { select: { shortname: true } },
        templateInfo: { select: { id: true } },
        permissions: { where: { userId } },
      },
    })

    const permission = liveQuiz?.permissions[0]
    if (!liveQuiz || !permission) return null

    return {
      objectId: null,
      objectUuid: liveQuiz.id,
      objectType: ObjectType.LIVE_QUIZ,
      objectName: liveQuiz.name,
      ownerShortname: liveQuiz.owner?.shortname ?? null,
      ownerId: liveQuiz.ownerId,
      templateId: liveQuiz.templateInfo?.id ?? null,
      isShared: permission.permissionLevel !== PermissionLevel.OWNER,
    }
  }

  return null
}

async function addObjectToCatalog({
  prisma,
  emitter,
  userId,
  objectId,
  objectType,
  access,
  catalogCollectionId,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  userId: string
  objectId: string
  objectType: ObjectType
  access: ObjectAccess
  catalogCollectionId?: string | null
}) {
  const canEditCollection =
    catalogCollectionId && catalogCollectionId !== MISSING_CATALOG_COLLECTION_ID
      ? await hasCatalogCollectionPermission(
          prisma,
          catalogCollectionId,
          userId,
          writePermissionLevels
        )
      : true

  if (!canEditCollection) return null

  const scope = getAddCatalogObjectScope({ objectId, objectType })
  if (!scope) return null

  const objectInfo = await getCatalogObjectInfoForAddition({
    prisma,
    userId,
    scope,
  })
  if (!objectInfo) return null

  const assignedCatalogCollectionId =
    catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID
  const assignment = await prisma.$transaction(async (transaction) => {
    const newAssignment = await transaction.catalogCollectionAssignment.upsert({
      where: {
        answerCollectionId_catalogCollectionId:
          typeof scope.answerCollectionId !== 'undefined'
            ? {
                answerCollectionId: scope.answerCollectionId,
                catalogCollectionId: assignedCatalogCollectionId,
              }
            : undefined,
        elementId_catalogCollectionId:
          typeof scope.elementId !== 'undefined'
            ? {
                elementId: scope.elementId,
                catalogCollectionId: assignedCatalogCollectionId,
              }
            : undefined,
        liveQuizId_catalogCollectionId:
          typeof scope.liveQuizId !== 'undefined'
            ? {
                liveQuizId: scope.liveQuizId,
                catalogCollectionId: assignedCatalogCollectionId,
              }
            : undefined,
      },
      create: {
        access,
        catalogCollection: {
          connect: { id: assignedCatalogCollectionId },
        },
        answerCollection:
          typeof scope.answerCollectionId !== 'undefined'
            ? { connect: { id: scope.answerCollectionId } }
            : undefined,
        element:
          typeof scope.elementId !== 'undefined'
            ? { connect: { id: scope.elementId } }
            : undefined,
        liveQuiz:
          typeof scope.liveQuizId !== 'undefined'
            ? { connect: { id: scope.liveQuizId } }
            : undefined,
      },
      update: { access },
    })

    const auditScope: PermissionObjectScope = {
      answerCollectionId: scope.answerCollectionId,
      elementId: scope.elementId,
      liveQuizId: scope.liveQuizId,
    }
    const { objectType: auditObjectType, objectId: auditObjectId } =
      getAuditLogObjectType(auditScope)

    await transaction.auditLogEntry.create({
      data: {
        type: AuditLogType.CATALOG_ASSIGNMENT_CREATED,
        objectType: auditObjectType,
        objectId: auditObjectId,
        sourceUserId: userId,
        message: `${auditObjectType} (ID ${auditObjectId}) added to catalog collection (ID ${catalogCollectionId}) by user ${userId}.`,
      },
    })

    return newAssignment
  })

  emitter?.emit('invalidate', {
    typename: 'CatalogCollectionAssignment',
    id: assignment.id,
  })

  return {
    id: assignment.id,
    objectId: objectInfo.objectId,
    objectUuid: objectInfo.objectUuid,
    name: objectInfo.objectName,
    objectType: objectInfo.objectType,
    templateId: objectInfo.templateId,
    access: assignment.access,
    ownerShortname: objectInfo.ownerShortname,
    isOwner: objectInfo.ownerId === userId,
    isManager: true,
    isRequested: false,
    isShared: objectInfo.isShared,
  }
}

async function removeCatalogObjectAssignment({
  prisma,
  emitter,
  userId,
  assignmentId,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  userId: string
  assignmentId: number
}) {
  const assignment = await prisma.catalogCollectionAssignment.findUnique({
    where: { id: assignmentId },
  })

  if (!assignment) return false

  const sufficientPermissions =
    assignment.catalogCollectionId !== MISSING_CATALOG_COLLECTION_ID
      ? await hasCatalogCollectionPermission(
          prisma,
          assignment.catalogCollectionId,
          userId,
          writePermissionLevels
        )
      : await hasAdminObjectPermission(
          prisma,
          getPermissionScopeFromCatalogAssignment({
            ...assignment,
            catalogCollectionId: undefined,
          }),
          userId
        )

  if (!sufficientPermissions) return false

  const deletedAssignment = await prisma.$transaction(async (transaction) => {
    const removedAssignment =
      await transaction.catalogCollectionAssignment.delete({
        where: { id: assignmentId },
      })

    const scope = getPermissionScopeFromCatalogAssignment({
      ...assignment,
      catalogCollectionId: undefined,
    })
    const { objectType: auditObjectType, objectId: auditObjectId } =
      getAuditLogObjectType(scope)

    await transaction.auditLogEntry.create({
      data: {
        type: AuditLogType.CATALOG_ASSIGNMENT_DELETED,
        objectType: auditObjectType,
        objectId: auditObjectId,
        sourceUserId: userId,
        message: `${auditObjectType} (ID ${auditObjectId}) removed from catalog collection (ID ${assignment.catalogCollectionId}) by user ${userId}.`,
      },
    })

    return removedAssignment
  })

  emitter?.emit('invalidate', {
    typename: 'CatalogCollectionAssignment',
    id: deletedAssignment.id,
  })

  return (
    deletedAssignment.id !== null && typeof deletedAssignment.id !== 'undefined'
  )
}

async function copyAnswerCollectionToAccount({
  prisma,
  emitter,
  userId,
  collectionId,
  catalogCollectionId,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  userId: string
  collectionId: number
  catalogCollectionId?: string | null
}) {
  const validAccess = catalogCollectionId
    ? await verifyCatalogCollectionBrowsable({
        prisma,
        catalogCollectionId,
        userId,
      })
    : true

  if (!validAccess) return false

  const assignment = await prisma.catalogCollectionAssignment.findUnique({
    where: {
      answerCollectionId_catalogCollectionId: {
        answerCollectionId: collectionId,
        catalogCollectionId:
          catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
      },
    },
    include: {
      answerCollection: {
        include: {
          entries: true,
        },
      },
    },
  })

  if (!assignment || assignment.access !== ObjectAccess.PUBLIC) return false

  const collection = assignment.answerCollection
  if (!collection || collection.ownerId === userId) return false

  const importCount = await prisma.answerCollection.count({
    where: {
      originalId: collection.id,
      ownerId: userId,
    },
  })

  await prisma.$transaction(async (transaction) => {
    const newCollection = await transaction.answerCollection.create({
      data: {
        originalId: collection.id,
        name:
          importCount > 0
            ? `${collection.name} (${importCount})`
            : collection.name,
        description: collection.description,
        owner: {
          connect: {
            id: userId,
          },
        },
        entries: {
          create: collection.entries.map((entry) => ({
            value: entry.value,
          })),
        },
      },
      include: {
        entries: true,
      },
    })

    await recomputeDerivedPermissions(
      { answerCollectionId: newCollection.id, userId },
      transaction
    )

    return newCollection
  })

  emitObjectInvalidation({ answerCollectionId: collection.id }, emitter)

  return true
}

async function copyElementToAccount({
  prisma,
  emitter,
  userId,
  elementId,
  catalogCollectionId,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  userId: string
  elementId: number
  catalogCollectionId?: string | null
}) {
  const validAccess = catalogCollectionId
    ? await verifyCatalogCollectionBrowsable({
        prisma,
        catalogCollectionId,
        userId,
      })
    : true

  if (!validAccess) return false

  const assignment = await prisma.catalogCollectionAssignment.findUnique({
    where: {
      elementId_catalogCollectionId: {
        elementId,
        catalogCollectionId:
          catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
      },
    },
    include: {
      element: {
        include: {
          answerCollectionItems: true,
        },
      },
    },
  })

  if (!assignment || assignment.access !== ObjectAccess.PUBLIC) return false

  const element = assignment.element
  if (!element || element.ownerId === userId) return false

  const importCount = await prisma.element.count({
    where: {
      originalId: String(element.id),
      ownerId: userId,
    },
  })

  await prisma.$transaction(async (transaction) => {
    const newElement = await transaction.element.create({
      data: {
        originalId: String(element.id),
        name:
          importCount > 0 ? `${element.name} (${importCount})` : element.name,
        content: element.content,
        explanation: element.explanation,
        basePoints: element.basePoints,
        pointsMultiplier: element.pointsMultiplier,
        type: element.type,
        options: element.options,
        answerCollection:
          element.answerCollectionId !== null
            ? {
                connect: {
                  id: element.answerCollectionId,
                },
              }
            : undefined,
        answerCollectionItems: {
          connect: element.answerCollectionItems.map((item) => ({
            id: item.id,
          })),
        },
        owner: {
          connect: {
            id: userId,
          },
        },
      },
    })

    await recomputeDerivedPermissions(
      { elementId: newElement.id, userId },
      transaction
    )

    if (newElement.answerCollectionId !== null) {
      await recomputeDerivedPermissions(
        {
          answerCollectionId: newElement.answerCollectionId,
          userId,
        },
        transaction
      )
    }

    return newElement
  })

  emitObjectInvalidation({ elementId: element.id }, emitter)

  return true
}

async function importAnswerCollection({
  prisma,
  emitter,
  userId,
  collectionId,
  catalogCollectionId,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  userId: string
  collectionId: number
  catalogCollectionId?: string | null
}) {
  const validAccess = catalogCollectionId
    ? await verifyCatalogCollectionBrowsable({
        prisma,
        catalogCollectionId,
        userId,
      })
    : true

  if (!validAccess) return false

  const assignment = await prisma.catalogCollectionAssignment.findUnique({
    where: {
      answerCollectionId_catalogCollectionId: {
        answerCollectionId: collectionId,
        catalogCollectionId:
          catalogCollectionId ?? MISSING_CATALOG_COLLECTION_ID,
      },
    },
    include: {
      answerCollection: {
        include: {
          entries: true,
        },
      },
    },
  })

  if (!assignment || assignment.access !== ObjectAccess.PUBLIC) return false

  const collection = assignment.answerCollection
  if (!collection || collection.ownerId === userId) return false

  await prisma.$transaction(async (transaction) => {
    await transaction.permission.upsert({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: collection.id,
          userId,
        },
      },
      create: {
        permissionLevel: PermissionLevel.READ,
        propagation: false,
        user: {
          connect: {
            id: userId,
          },
        },
        answerCollection: {
          connect: {
            id: collection.id,
          },
        },
      },
      update: {},
    })

    await recomputeDerivedPermissions(
      { answerCollectionId: collection.id, userId },
      transaction
    )

    await transaction.auditLogEntry.create({
      data: {
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: String(collection.id),
        sourceUserId: userId,
        targetUserId: userId,
        message: `Read permission granted on answer collection (ID ${collection.id}) through public catalog collection (ID ${catalogCollectionId}) and assignment (ID ${assignment.id}) for user ${userId}.`,
      },
    })
  })

  emitObjectInvalidation({ answerCollectionId: collection.id }, emitter)

  return true
}

async function copyCatalogObjectToAccount({
  prisma,
  emitter,
  userId,
  objectId,
  objectType,
  catalogCollectionId,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  userId: string
  objectId: string
  objectType: ObjectType
  catalogCollectionId?: string | null
}) {
  const scope = getCatalogActionScope({ objectId, objectType })

  if (scope?.answerCollectionId !== undefined) {
    return copyAnswerCollectionToAccount({
      prisma,
      emitter,
      userId,
      collectionId: scope.answerCollectionId,
      catalogCollectionId,
    })
  }

  if (scope?.elementId !== undefined) {
    return copyElementToAccount({
      prisma,
      emitter,
      userId,
      elementId: scope.elementId,
      catalogCollectionId,
    })
  }

  return false
}

async function importCatalogObject({
  prisma,
  emitter,
  userId,
  objectId,
  objectType,
  catalogCollectionId,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  userId: string
  objectId: string
  objectType: ObjectType
  catalogCollectionId?: string | null
}) {
  if (objectType !== ObjectType.ANSWER_COLLECTION) return false

  const scope = getCatalogActionScope({ objectId, objectType })
  if (scope?.answerCollectionId === undefined) return false

  return importAnswerCollection({
    prisma,
    emitter,
    userId,
    collectionId: scope.answerCollectionId,
    catalogCollectionId,
  })
}

async function requestCatalogCollection({
  prisma,
  emitter,
  userId,
  catalogCollectionId,
  requestedPermissionLevel,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  userId: string
  catalogCollectionId: string
  requestedPermissionLevel?: PermissionLevel | null
}) {
  const permissionLevel = requestedPermissionLevel ?? PermissionLevel.READ
  const catalogCollection = await prisma.catalogCollection.findUnique({
    where: {
      id: catalogCollectionId,
      permissions: {
        none: {
          userId,
          permissionLevel,
        },
      },
      accessRequests: {
        none: {
          userId,
          permissionLevel,
        },
      },
    },
    include: {
      permissions: {
        where: {
          userId,
          permissionLevel,
        },
      },
      accessRequests: {
        where: {
          userId,
          permissionLevel,
        },
      },
      owner: { select: { shortname: true } },
    },
  })

  if (
    !catalogCollection ||
    catalogCollection.permissions.length > 0 ||
    catalogCollection.accessRequests.length > 0 ||
    !catalogCollection.ownerId
  ) {
    return null
  }

  const adminOwnerPermissions = await prisma.derivedPermission.findMany({
    where: {
      catalogCollectionId,
      permissionLevel: {
        in: adminPermissionLevels,
      },
    },
  })

  if (adminOwnerPermissions.length === 0) {
    console.log(
      'No admin or owner could be found on the catalog collection ',
      catalogCollectionId
    )
    return null
  }

  const ownerAdminIds = adminOwnerPermissions.map(
    (permission) => permission.userId
  )
  await prisma.$transaction(async (transaction) => {
    const results = await Promise.allSettled(
      ownerAdminIds.map(async (adminOwnerId) => {
        await transaction.accessRequest.upsert({
          where: {
            catalogCollectionId_userId_objectAdminOrOwnerId: {
              catalogCollectionId,
              userId,
              objectAdminOrOwnerId: adminOwnerId,
            },
          },
          create: {
            permissionLevel,
            catalogCollectionId,
            userId,
            objectAdminOrOwnerId: adminOwnerId,
          },
          update: {
            permissionLevel,
          },
        })

        await transaction.auditLogEntry.create({
          data: {
            type: AuditLogType.REQUEST_CREATED,
            objectType: ObjectType.CATALOG_COLLECTION,
            objectId: catalogCollectionId,
            sourceUserId: userId,
            targetUserId: adminOwnerId,
            message: `Access request (permission level ${permissionLevel}) created for ${ObjectType.CATALOG_COLLECTION} (ID ${catalogCollectionId}) by user ${userId} for owner / admin ${adminOwnerId}.`,
          },
        })
      })
    )

    if (!results.every((result) => result.status === 'fulfilled')) {
      throw new Error(
        `Failed to create access requests for catalog collection ${catalogCollectionId}: ${JSON.stringify(
          results
        )}`
      )
    }
  })

  emitObjectInvalidation({ catalogCollectionId }, emitter)

  return {
    id: catalogCollection.id,
    name: catalogCollection.name,
    access: catalogCollection.access,
    ownerShortname: catalogCollection.owner?.shortname ?? null,
    isOwner: false,
    isManager: false,
    isEditor: false,
    isRequested: true,
    isShared: false,
  }
}

async function requestCatalogObject({
  prisma,
  emitter,
  userId,
  objectId,
  objectType,
  catalogCollectionId,
  requestedPermissionLevel,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  userId: string
  objectId: string
  objectType: ObjectType
  catalogCollectionId?: string | null
  requestedPermissionLevel?: PermissionLevel | null
}) {
  const validAccess = catalogCollectionId
    ? await verifyCatalogCollectionBrowsable({
        prisma,
        catalogCollectionId,
        userId,
      })
    : true

  if (!validAccess) return false

  const scope = getCatalogActionScope({ objectId, objectType })
  if (!scope) return false

  const permissionLevel = requestedPermissionLevel ?? PermissionLevel.READ
  let objectInfo:
    | {
        existingPermission: boolean
        existingRequest: boolean
      }
    | undefined

  if (scope.answerCollectionId !== undefined) {
    const collection = await prisma.answerCollection.findUnique({
      where: {
        id: scope.answerCollectionId,
        permissions: {
          none: {
            userId,
            permissionLevel,
          },
        },
        accessRequests: {
          none: {
            userId,
            permissionLevel,
          },
        },
      },
      include: {
        permissions: {
          where: {
            userId,
            permissionLevel,
          },
        },
        accessRequests: {
          where: {
            userId,
            permissionLevel,
          },
        },
      },
    })

    if (!collection) return false

    objectInfo = {
      existingPermission: collection.permissions.length > 0,
      existingRequest: collection.accessRequests.length > 0,
    }
  } else if (scope.elementId !== undefined) {
    const element = await prisma.element.findUnique({
      where: {
        id: scope.elementId,
        permissions: {
          none: {
            userId,
            permissionLevel,
          },
        },
        accessRequests: {
          none: {
            userId,
            permissionLevel,
          },
        },
      },
      include: {
        permissions: {
          where: {
            userId,
            permissionLevel,
          },
        },
        accessRequests: {
          where: {
            userId,
            permissionLevel,
          },
        },
      },
    })

    if (!element) return false

    objectInfo = {
      existingPermission: element.permissions.length > 0,
      existingRequest: element.accessRequests.length > 0,
    }
  }

  if (
    !objectInfo ||
    objectInfo.existingPermission ||
    objectInfo.existingRequest
  ) {
    return false
  }

  const adminOwnerPermissions = await prisma.derivedPermission.findMany({
    where: {
      permissionLevel: {
        in: adminPermissionLevels,
      },
      ...scope,
    },
  })

  if (adminOwnerPermissions.length === 0) {
    console.log(
      'No admin or owner could be found on the catalog object ',
      scope
    )
    return false
  }

  const ownerAdminIds = adminOwnerPermissions.map(
    (permission) => permission.userId
  )
  await prisma.$transaction(async (transaction) => {
    const results = await Promise.allSettled(
      ownerAdminIds.map(async (adminOwnerId) => {
        await transaction.accessRequest.upsert({
          where: {
            answerCollectionId_userId_objectAdminOrOwnerId:
              typeof scope.answerCollectionId !== 'undefined'
                ? {
                    answerCollectionId: scope.answerCollectionId,
                    userId,
                    objectAdminOrOwnerId: adminOwnerId,
                  }
                : undefined,
            elementId_userId_objectAdminOrOwnerId:
              typeof scope.elementId !== 'undefined'
                ? {
                    elementId: scope.elementId,
                    userId,
                    objectAdminOrOwnerId: adminOwnerId,
                  }
                : undefined,
          },
          create: {
            permissionLevel,
            userId,
            objectAdminOrOwnerId: adminOwnerId,
            ...scope,
          },
          update: {
            permissionLevel,
          },
        })

        const { objectType: auditObjectType, objectId: auditObjectId } =
          getAuditLogObjectType(scope)
        await transaction.auditLogEntry.create({
          data: {
            type: AuditLogType.REQUEST_CREATED,
            objectType: auditObjectType,
            objectId: auditObjectId,
            sourceUserId: userId,
            targetUserId: adminOwnerId,
            message: `Access request (permission level ${permissionLevel}) created for ${auditObjectType} (ID ${auditObjectId}) by user ${userId} for owner / admin ${adminOwnerId}.`,
          },
        })
      })
    )

    if (!results.every((result) => result.status === 'fulfilled')) {
      throw new Error(
        `Failed to create access requests for object ${JSON.stringify(
          scope
        )}: ${JSON.stringify(results)}`
      )
    }
  })

  emitObjectInvalidation(scope, emitter)

  return true
}

async function cancelObjectSharingRequest({
  prisma,
  emitter,
  userId,
  objectId,
  objectType,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  userId: string
  objectId: string
  objectType: ObjectType
}) {
  const scope = getCatalogActionScope({ objectId, objectType })
  if (!scope) return false

  const requests = await prisma.accessRequest.findMany({
    where: {
      userId,
      ...scope,
    },
  })

  if (requests.length === 0) return false

  await prisma.$transaction(async (transaction) => {
    await transaction.accessRequest.deleteMany({
      where: {
        userId,
        ...scope,
      },
    })

    const { objectType: auditObjectType, objectId: auditObjectId } =
      getAuditLogObjectType(scope)
    await transaction.auditLogEntry.create({
      data: {
        type: AuditLogType.REQUEST_CANCELLED,
        objectType: auditObjectType,
        objectId: auditObjectId,
        sourceUserId: userId,
        message: `Access request cancelled for ${auditObjectType} (ID ${auditObjectId}) by user ${userId}.`,
      },
    })
  })

  for (const request of requests) {
    emitter?.emit('invalidate', {
      typename: 'AccessRequest',
      id: request.id,
    })
  }
  emitObjectInvalidation(scope, emitter)

  return true
}

async function resolveObjectSharingRequest({
  prisma,
  emitter,
  sourceUserId,
  requestId,
  userId,
  permissionLevel,
  propagation,
  approved,
}: {
  prisma: ReturnType<typeof getPrisma>
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
  sourceUserId: string
  requestId: number
  userId: string
  permissionLevel: PermissionLevel
  propagation: boolean
  approved: boolean
}) {
  const pendingRequest = await prisma.accessRequest.findUnique({
    where: {
      id: requestId,
      userId,
      objectAdminOrOwnerId: sourceUserId,
    },
  })

  if (!pendingRequest) return false

  const scope = getPermissionScopeFromAccessRequest(pendingRequest)

  await prisma.$transaction(
    async (transaction) => {
      if (approved) {
        await transaction.permission.upsert({
          where: permissionUserWhere(scope, userId),
          create: {
            permissionLevel,
            propagation,
            userId,
            ...scope,
          },
          update: {},
        })
      }

      await transaction.accessRequest.deleteMany({
        where: {
          userId,
          ...scope,
        },
      })

      const { objectType, objectId } = getAuditLogObjectType(scope)
      await createPermissionAuditLog({
        prisma: transaction,
        scope,
        type: AuditLogType.REQUEST_RESOLVED,
        sourceUserId,
        targetUserId: userId,
        message: `Access request ${
          approved
            ? `approved (with permission level ${permissionLevel})`
            : 'declined'
        } for ${objectType} (ID ${objectId}) by owner / admin ${sourceUserId} for user ${userId}.`,
      })

      await recomputeForScope(scope, transaction, {
        userId,
        updateAccessRequests: permissionLevel === PermissionLevel.ADMIN,
      })
    },
    { timeout: 60000 }
  )

  emitObjectInvalidation(scope, emitter)

  return true
}

async function transferObjectOwnership({
  prisma,
  scope,
  sourceUserId,
  shortnameOrEmail,
}: {
  prisma: ReturnType<typeof getPrisma>
  scope: PermissionObjectScope
  sourceUserId: string
  shortnameOrEmail: string
}) {
  const newOwner = await prisma.user.findFirst({
    where: {
      OR: [{ shortname: shortnameOrEmail }, { email: shortnameOrEmail }],
    },
    include: { sharedObjects: { where: scope } },
  })
  const currentOwnerId = await getObjectOwnerId(prisma, scope)

  if (!newOwner || currentOwnerId == null) return null
  if (rejectsSameOwnerTransfer(scope) && currentOwnerId === newOwner.id) {
    return null
  }

  const permission = await prisma.$transaction(
    async (transaction) => {
      await updateObjectOwner(transaction, scope, newOwner.id)

      const adminPermission = await transaction.permission.upsert({
        where: permissionUserWhere(scope, sourceUserId),
        create: {
          permissionLevel: PermissionLevel.ADMIN,
          userId: sourceUserId,
          ...scope,
        },
        update: { permissionLevel: PermissionLevel.ADMIN },
        include: directPermissionInclude,
      })

      if (newOwner.sharedObjects.length > 0) {
        await transaction.permission.delete({
          where: permissionUserWhere(scope, newOwner.id),
        })
      }

      const { objectType, objectId } = getAuditLogObjectType(scope)
      await createPermissionAuditLog({
        prisma: transaction,
        scope,
        type: AuditLogType.OWNER_TRANSFERRED,
        sourceUserId,
        targetUserId: newOwner.id,
        message: `Ownership of ${objectType} (ID ${objectId}) transferred from user ${sourceUserId} to user ${newOwner.id}.`,
      })

      await recomputeForScope(scope, transaction, {
        userId: newOwner.id,
        updateAccessRequests: true,
      })
      await recomputeForScope(scope, transaction, {
        userId: sourceUserId,
        updateAccessRequests: false,
      })

      return adminPermission
    },
    { timeout: 60000 }
  )

  return permission.user ? toPermissionInfo(permission, sourceUserId) : null
}

async function changeObjectPermissionLevel({
  prisma,
  scope,
  sourceUserId,
  permissionId,
  permissionLevel,
  propagation,
}: {
  prisma: ReturnType<typeof getPrisma>
  scope: PermissionObjectScope
  sourceUserId: string
  permissionId: number
  permissionLevel: PermissionLevel
  propagation: boolean
}) {
  const previousPermission = await prisma.permission.findFirst({
    where: { id: permissionId, ...scope },
  })

  if (!previousPermission) return false

  const userGroup =
    previousPermission.userGroupId !== null
      ? await prisma.userGroup.findUnique({
          where: { id: previousPermission.userGroupId },
          include: { members: true, admins: true },
        })
      : null

  const updatedPermission = await prisma.$transaction(
    async (transaction) => {
      const permission = await transaction.permission.update({
        where: { id: permissionId },
        data: { permissionLevel, propagation },
      })

      const affectedUserIds = permission.userId
        ? [permission.userId]
        : userGroup
          ? [
              userGroup.ownerId,
              ...userGroup.admins.map((admin) => admin.id),
              ...userGroup.members.map((member) => member.id),
            ]
          : []

      const updateAccessRequests =
        (previousPermission.permissionLevel !== PermissionLevel.ADMIN &&
          permissionLevel === PermissionLevel.ADMIN) ||
        (previousPermission.permissionLevel === PermissionLevel.ADMIN &&
          permissionLevel !== PermissionLevel.ADMIN)

      for (const affectedUserId of affectedUserIds) {
        await recomputeForScope(scope, transaction, {
          userId: affectedUserId,
          updateAccessRequests,
        })
      }

      const { objectType, objectId } = getAuditLogObjectType(scope)
      await createPermissionAuditLog({
        prisma: transaction,
        scope,
        type: AuditLogType.PERMISSION_MODIFIED,
        sourceUserId,
        targetUserId: permission.userId,
        targetUserGroupId: permission.userGroupId,
        message: `Permission level changed from ${previousPermission.permissionLevel} to ${permissionLevel} for ${objectType} (ID ${objectId}) through owner / admin ${sourceUserId} for ${permission.userId ? `user ${permission.userId}` : `user group ${permission.userGroupId}`}.`,
      })

      return permission
    },
    { timeout: 60000 }
  )

  return Boolean(updatedPermission)
}

async function revokeObjectAccess({
  prisma,
  scope,
  sourceUserId,
  permissionId,
}: {
  prisma: ReturnType<typeof getPrisma>
  scope: PermissionObjectScope
  sourceUserId: string
  permissionId: number
}) {
  const permission = await prisma.permission.findFirst({
    where: { id: permissionId, ...scope },
    include: {
      user: { select: { id: true } },
    },
  })

  if (!permission) return null

  const userGroup =
    permission.userGroupId !== null
      ? await prisma.userGroup.findUnique({
          where: { id: permission.userGroupId },
          include: { members: true, admins: true },
        })
      : null

  const deletedPermission = await prisma.$transaction(
    async (transaction) => {
      const deleted = await transaction.permission.delete({
        where: { id: permissionId },
      })

      const { objectType, objectId } = getAuditLogObjectType(scope)
      await createPermissionAuditLog({
        prisma: transaction,
        scope,
        type: AuditLogType.PERMISSION_REVOKED,
        sourceUserId,
        targetUserId: permission.userId,
        targetUserGroupId: permission.userGroupId,
        message: `Permission revoked for ${objectType} (ID ${objectId}) by owner / admin ${sourceUserId} for ${permission.user?.id ? `user ${permission.user?.id}` : `user group ${permission.userGroupId}`}.`,
      })

      const affectedUserIds = permission.userId
        ? [permission.userId]
        : userGroup
          ? [
              userGroup.ownerId,
              ...userGroup.admins.map((admin) => admin.id),
              ...userGroup.members.map((member) => member.id),
            ]
          : []

      for (const affectedUserId of affectedUserIds) {
        await recomputeForScope(scope, transaction, {
          userId: affectedUserId,
          updateAccessRequests: false,
        })
      }

      if (permission.permissionLevel === PermissionLevel.ADMIN) {
        await updateAccessRequestsForScope(scope, transaction, {
          userId: permission.userId ?? undefined,
        })
      }

      return deleted
    },
    { timeout: 60000 }
  )

  return deletedPermission.id
}

async function removeObject({
  prisma,
  scope,
  userId,
  emitter,
}: {
  prisma: ReturnType<typeof getPrisma>
  scope: PermissionObjectScope
  userId: string
  emitter: { emit: (eventName: string, payload: unknown) => void } | undefined
}) {
  if (scope.answerCollectionId || scope.catalogCollectionId) return null

  const permission = await prisma.permission.findFirst({
    where: { ...scope, userId },
  })

  if (!permission) return null

  const { objectType, objectId } = getAuditLogObjectType(scope)

  await prisma.$transaction(
    async (transaction) => {
      await transaction.permission.deleteMany({
        where: { ...scope, userId },
      })

      await createPermissionAuditLog({
        prisma: transaction,
        scope,
        type: AuditLogType.PERMISSION_REMOVED,
        sourceUserId: userId,
        message: `User ${userId} removed own permission on ${objectType} (ID: ${objectId})`,
      })

      await recomputeForScope(scope, transaction, { userId })
    },
    { timeout: 60000 }
  )

  emitObjectInvalidation(scope, emitter)

  return objectId
}

function getScopeFromUserGroupPermission(
  permission: UserGroupPermission
): PermissionObjectScope | null {
  if (permission.catalogCollectionId != null) {
    return { catalogCollectionId: permission.catalogCollectionId }
  }
  if (permission.answerCollectionId != null) {
    return { answerCollectionId: permission.answerCollectionId }
  }
  if (permission.elementId != null) return { elementId: permission.elementId }
  if (permission.courseId != null) return { courseId: permission.courseId }
  if (permission.liveQuizId != null) {
    return { liveQuizId: permission.liveQuizId }
  }
  if (permission.practiceQuizId != null) {
    return { practiceQuizId: permission.practiceQuizId }
  }
  if (permission.microLearningId != null) {
    return { microLearningId: permission.microLearningId }
  }
  if (permission.groupActivityId != null) {
    return { groupActivityId: permission.groupActivityId }
  }

  return null
}

async function recomputePermissionsUserGroupMember(
  {
    permissions,
    userId,
  }: { permissions: UserGroupPermission[]; userId?: string },
  prisma: Prisma.TransactionClient
) {
  for (const permission of permissions) {
    const scope = getScopeFromUserGroupPermission(permission)
    if (!scope) continue

    await recomputeForScope(scope, prisma, userId ? { userId } : undefined)
  }
}

async function createUserGroupAuditLog({
  prisma,
  type,
  groupId,
  sourceUserId,
  targetUserId,
  message,
}: {
  prisma: Prisma.TransactionClient
  type: AuditLogType
  groupId: number
  sourceUserId: string
  targetUserId?: string | null
  message: string
}) {
  await prisma.auditLogEntry.create({
    data: {
      type,
      objectType: ObjectType.USER_GROUP,
      objectId: String(groupId),
      sourceUserId,
      targetUserId: targetUserId ?? undefined,
      message,
    },
  })
}

async function createUserGroup({
  prisma,
  userId,
  name,
  members,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
  name: string
  members: { shortnameOrEmail: string; isAdmin?: boolean | null }[]
}) {
  const existingUserGroup = await prisma.userGroup.findUnique({
    where: {
      ownerId_name: {
        ownerId: userId,
        name,
      },
    },
  })

  if (existingUserGroup) return null

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      OR: members.flatMap((member) => [
        { shortname: member.shortnameOrEmail },
        { email: member.shortnameOrEmail },
      ]),
    },
  })

  if (users.length === 0) return null

  const { memberIds, adminIds } = users.reduce<{
    memberIds: string[]
    adminIds: string[]
  }>(
    (acc, user) => {
      const isAdmin = members.find(
        (member) =>
          member.shortnameOrEmail === user.shortname ||
          member.shortnameOrEmail === user.email
      )?.isAdmin

      if (isAdmin) {
        acc.adminIds.push(user.id)
      } else {
        acc.memberIds.push(user.id)
      }
      return acc
    },
    { memberIds: [], adminIds: [] }
  )

  const newUserGroup = await prisma.$transaction(async (transaction) => {
    const createdUserGroup = await transaction.userGroup.create({
      data: {
        name,
        members: { connect: memberIds.map((id) => ({ id })) },
        admins: { connect: adminIds.map((id) => ({ id })) },
        owner: { connect: { id: userId } },
      },
      include: {
        members: {
          select: { id: true, shortname: true, email: true },
          orderBy: { shortname: 'asc' },
        },
        admins: {
          select: { id: true, shortname: true, email: true },
          orderBy: { shortname: 'asc' },
        },
        owner: {
          select: { id: true, shortname: true, email: true },
        },
      },
    })

    await createUserGroupAuditLog({
      prisma: transaction,
      type: AuditLogType.USER_GROUP_CREATED,
      groupId: createdUserGroup.id,
      sourceUserId: userId,
      message: `User group created with members [${createdUserGroup.members.map((member) => member.id).join(',')}] and admins [${createdUserGroup.admins.map((admin) => admin.id).join(',')}].`,
    })

    return createdUserGroup
  })

  return {
    id: newUserGroup.id,
    name: newUserGroup.name,
    members: newUserGroup.members.map((member) =>
      toUserGroupMember(member, userId)
    ),
    admins: newUserGroup.admins.map((admin) =>
      toUserGroupMember(admin, userId)
    ),
    owner: toUserGroupMember(newUserGroup.owner, userId),
    numOfMembers: newUserGroup.members.length + newUserGroup.admins.length + 1,
    isMember: false,
    isAdmin: false,
    isOwner: true,
  }
}

async function getUserGroupsUser(
  prisma: ReturnType<typeof getPrisma>,
  userId: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userGroups: {
        include: {
          members: { select: { id: true, shortname: true, email: true } },
          admins: { select: { id: true, shortname: true, email: true } },
          owner: { select: { id: true, shortname: true, email: true } },
        },
      },
      adminUserGroups: {
        include: {
          members: { select: { id: true, shortname: true, email: true } },
          admins: { select: { id: true, shortname: true, email: true } },
          owner: { select: { id: true, shortname: true, email: true } },
        },
      },
      managedUserGroups: {
        include: {
          members: { select: { id: true, shortname: true, email: true } },
          admins: { select: { id: true, shortname: true, email: true } },
          owner: { select: { id: true, shortname: true, email: true } },
        },
      },
    },
  })

  if (!user) return null

  return [
    ...user.managedUserGroups.map((group) => ({
      id: group.id,
      name: group.name,
      members: group.members.map((member) => toUserGroupMember(member, userId)),
      admins: group.admins.map((admin) => toUserGroupMember(admin, userId)),
      owner: toUserGroupMember(group.owner, userId),
      numOfMembers: group.admins.length + group.members.length + 1,
      isMember: false,
      isAdmin: false,
      isOwner: true,
    })),
    ...user.adminUserGroups.map((group) => ({
      id: group.id,
      name: group.name,
      members: group.members.map((member) => toUserGroupMember(member, userId)),
      admins: group.admins.map((admin) => toUserGroupMember(admin, userId)),
      owner: toUserGroupMember(group.owner, userId),
      numOfMembers: group.admins.length + group.members.length + 1,
      isMember: false,
      isAdmin: true,
      isOwner: false,
    })),
    ...user.userGroups.map((group) => ({
      id: group.id,
      name: group.name,
      members: group.members.map((member) => toUserGroupMember(member, userId)),
      admins: group.admins.map((admin) => toUserGroupMember(admin, userId)),
      owner: toUserGroupMember(group.owner, userId),
      numOfMembers: group.admins.length + group.members.length + 1,
      isMember: true,
      isAdmin: false,
      isOwner: false,
    })),
  ]
}

async function leaveUserGroup({
  prisma,
  userId,
  groupId,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
  groupId: number
}) {
  const userGroup = await prisma.userGroup.findUnique({
    where: { id: groupId },
    include: {
      members: { where: { id: userId } },
      admins: { where: { id: userId } },
    },
  })

  if (
    !userGroup ||
    (userGroup.members.length === 0 && userGroup.admins.length === 0)
  ) {
    return false
  }

  await prisma.$transaction(
    async (transaction) => {
      const updatedUserGroup = await transaction.userGroup.update({
        where: { id: groupId },
        data: {
          members:
            userGroup.members.length > 0
              ? { disconnect: { id: userId } }
              : undefined,
          admins:
            userGroup.admins.length > 0
              ? { disconnect: { id: userId } }
              : undefined,
        },
        include: { permissions: true },
      })

      await createUserGroupAuditLog({
        prisma: transaction,
        type: AuditLogType.USER_GROUP_USER_REMOVED,
        groupId: updatedUserGroup.id,
        sourceUserId: userId,
        targetUserId: userId,
        message: `User left user group.`,
      })

      await recomputePermissionsUserGroupMember(
        { permissions: updatedUserGroup.permissions, userId },
        transaction
      )
    },
    { timeout: 60000 }
  )

  return true
}

async function deleteUserGroup({
  prisma,
  userId,
  groupId,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
  groupId: number
}) {
  const userGroup = await prisma.userGroup.findUnique({
    where: { id: groupId, ownerId: userId },
    include: { permissions: true },
  })

  if (!userGroup) return false

  await prisma.$transaction(
    async (transaction) => {
      await transaction.userGroup.delete({ where: { id: groupId } })

      await createUserGroupAuditLog({
        prisma: transaction,
        type: AuditLogType.USER_GROUP_DELETED,
        groupId: userGroup.id,
        sourceUserId: userId,
        message: `User group deleted by owner.`,
      })

      await recomputePermissionsUserGroupMember(
        { permissions: userGroup.permissions },
        transaction
      )
    },
    { timeout: 60000 }
  )

  return true
}

async function promoteGroupMemberToAdmin({
  prisma,
  userId,
  groupId,
  memberId,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
  groupId: number
  memberId: string
}) {
  const group = await prisma.userGroup.findUnique({
    where: { id: groupId },
    include: {
      members: { where: { id: memberId } },
      admins: { where: { id: userId } },
    },
  })

  if (
    !group ||
    group.members.length === 0 ||
    (group.admins.length === 0 && group.ownerId !== userId)
  ) {
    return false
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.userGroup.update({
      where: { id: groupId },
      data: {
        members: { disconnect: { id: memberId } },
        admins: { connect: { id: memberId } },
      },
    })

    await createUserGroupAuditLog({
      prisma: transaction,
      type: AuditLogType.USER_GROUP_USER_MODIFIED,
      groupId: group.id,
      sourceUserId: userId,
      targetUserId: memberId,
      message: `User promoted from member to admin.`,
    })
  })

  return true
}

async function demoteGroupAdminToMember({
  prisma,
  userId,
  groupId,
  adminId,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
  groupId: number
  adminId: string
}) {
  const group = await prisma.userGroup.findUnique({
    where: { id: groupId },
    include: { admins: true },
  })

  const adminUserIds = group?.admins.map((admin) => admin.id) ?? []
  if (
    !group ||
    !adminUserIds.includes(adminId) ||
    (!adminUserIds.includes(userId) && group.ownerId !== userId)
  ) {
    return false
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.userGroup.update({
      where: { id: groupId },
      data: {
        admins: { disconnect: { id: adminId } },
        members: { connect: { id: adminId } },
      },
    })

    await createUserGroupAuditLog({
      prisma: transaction,
      type: AuditLogType.USER_GROUP_USER_MODIFIED,
      groupId: group.id,
      sourceUserId: userId,
      targetUserId: adminId,
      message: `User demoted from admin to member.`,
    })
  })

  return true
}

async function removeUserFromGroup({
  prisma,
  sourceUserId,
  groupId,
  userId,
}: {
  prisma: ReturnType<typeof getPrisma>
  sourceUserId: string
  groupId: number
  userId: string
}) {
  if (userId === sourceUserId) return false

  const group = await prisma.userGroup.findUnique({
    where: { id: groupId },
    include: {
      members: { where: { id: userId } },
      admins: true,
    },
  })

  const adminUserIds = group?.admins.map((admin) => admin.id) ?? []
  const userIsAdmin = adminUserIds.includes(userId)
  const userIsMember = (group?.members.length ?? -1) > 0
  if (
    !group ||
    (group.members.length === 0 && !adminUserIds.includes(userId)) ||
    (!adminUserIds.includes(sourceUserId) && group.ownerId !== sourceUserId) ||
    (userIsAdmin && userIsMember)
  ) {
    return false
  }

  await prisma.$transaction(
    async (transaction) => {
      const updatedUserGroup = await transaction.userGroup.update({
        where: { id: groupId },
        data: {
          admins: userIsAdmin ? { disconnect: { id: userId } } : undefined,
          members: userIsMember ? { disconnect: { id: userId } } : undefined,
        },
        include: { permissions: true },
      })

      await createUserGroupAuditLog({
        prisma: transaction,
        type: AuditLogType.USER_GROUP_USER_REMOVED,
        groupId: updatedUserGroup.id,
        sourceUserId,
        targetUserId: userId,
        message: `User removed from group.`,
      })

      await recomputePermissionsUserGroupMember(
        { permissions: updatedUserGroup.permissions, userId },
        transaction
      )
    },
    { timeout: 60000 }
  )

  return true
}

async function changeUserGroupName({
  prisma,
  userId,
  id,
  name,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
  id: number
  name: string
}) {
  const userGroup = await prisma.userGroup.findUnique({
    where: { id },
    include: {
      admins: { where: { id: userId } },
    },
  })

  if (
    !userGroup ||
    (userGroup.admins.length === 0 && userGroup.ownerId !== userId)
  ) {
    return false
  }

  await prisma.userGroup.update({
    where: { id },
    data: { name },
  })

  await prisma.auditLogEntry.create({
    data: {
      type: AuditLogType.USER_GROUP_MODIFIED,
      objectType: ObjectType.USER_GROUP,
      objectId: String(userGroup.id),
      sourceUserId: userId,
      message: `User group name changed to ${name}.`,
    },
  })

  return true
}

async function transferGroupOwnership({
  prisma,
  userId,
  id,
  newOwnerId,
}: {
  prisma: ReturnType<typeof getPrisma>
  userId: string
  id: number
  newOwnerId: string
}) {
  const userGroup = await prisma.userGroup.findUnique({
    where: { id },
    include: {
      admins: { where: { id: newOwnerId } },
    },
  })

  if (
    !userGroup ||
    userGroup.ownerId !== userId ||
    userGroup.admins.length === 0
  ) {
    return false
  }

  await prisma.$transaction(async (transaction) => {
    let groupName = userGroup.name
    let counter = 0
    let valid = false

    do {
      const existingGroup = await transaction.userGroup.findUnique({
        where: {
          ownerId_name: {
            ownerId: newOwnerId,
            name: groupName,
          },
        },
      })

      if (existingGroup) {
        counter += 1
        groupName = `${userGroup.name} (${counter})`
      } else {
        valid = true
      }
    } while (valid === false && counter < 100)

    if (!valid) {
      throw new Error(`Could not find a valid name for the new user group.`)
    }

    await transaction.userGroup.update({
      where: { id },
      data: {
        name: groupName,
        owner: { connect: { id: newOwnerId } },
        admins: {
          connect: { id: userId },
          disconnect: { id: newOwnerId },
        },
      },
    })

    await createUserGroupAuditLog({
      prisma: transaction,
      type: AuditLogType.USER_GROUP_MODIFIED,
      groupId: userGroup.id,
      sourceUserId: userId,
      targetUserId: newOwnerId,
      message: `User group ownership transferred to group admin.`,
    })
  })

  return true
}

async function addUserToUserGroup({
  prisma,
  sourceUserId,
  groupId,
  shortnameOrEmail,
  asAdmin = false,
}: {
  prisma: ReturnType<typeof getPrisma>
  sourceUserId: string
  groupId: number
  shortnameOrEmail: string
  asAdmin?: boolean | null
}) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ shortname: shortnameOrEmail }, { email: shortnameOrEmail }],
    },
  })

  if (!user) return null

  const userGroup = await prisma.userGroup.findUnique({
    where: { id: groupId },
    include: {
      members: true,
      admins: true,
    },
  })

  const adminUserIds = userGroup?.admins.map((admin) => admin.id) ?? []
  if (
    !userGroup ||
    (!adminUserIds.includes(sourceUserId) && userGroup.ownerId !== sourceUserId)
  ) {
    return null
  }

  const memberUserIds = userGroup.members.map((member) => member.id)
  if (memberUserIds.includes(user.id) || adminUserIds.includes(user.id)) {
    return null
  }

  await prisma.$transaction(
    async (transaction) => {
      const updatedUserGroup = await transaction.userGroup.update({
        where: { id: groupId },
        data: {
          members: !asAdmin ? { connect: { id: user.id } } : undefined,
          admins: asAdmin ? { connect: { id: user.id } } : undefined,
        },
        include: { permissions: true },
      })

      await createUserGroupAuditLog({
        prisma: transaction,
        type: AuditLogType.USER_GROUP_USER_ADDED,
        groupId: updatedUserGroup.id,
        sourceUserId,
        targetUserId: user.id,
        message: `New user added to group as ${asAdmin ? 'admin' : 'member'}.`,
      })

      await recomputePermissionsUserGroupMember(
        { permissions: updatedUserGroup.permissions, userId: user.id },
        transaction
      )
    },
    { timeout: 60000 }
  )

  return toUserGroupMember(user, sourceUserId)
}

export const sharingRouter = router({
  userGroups: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)

    return { userGroups: await getUserGroupsUser(prisma, ctx.user.sub) }
  }),

  createUserGroup: userFullAccessProcedure
    .input(createUserGroupInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        userGroup: await createUserGroup({
          prisma,
          userId: ctx.user.sub,
          name: input.name,
          members: input.members,
        }),
      }
    }),

  leaveUserGroup: userFullAccessProcedure
    .input(userGroupInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        left: await leaveUserGroup({
          prisma,
          userId: ctx.user.sub,
          groupId: input.groupId,
        }),
      }
    }),

  deleteUserGroup: userFullAccessProcedure
    .input(userGroupInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        deleted: await deleteUserGroup({
          prisma,
          userId: ctx.user.sub,
          groupId: input.groupId,
        }),
      }
    }),

  changeUserGroupName: userFullAccessProcedure
    .input(userGroupNameInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        changed: await changeUserGroupName({
          prisma,
          userId: ctx.user.sub,
          id: input.id,
          name: input.name,
        }),
      }
    }),

  addUserToUserGroup: userFullAccessProcedure
    .input(addUserToUserGroupInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        user: await addUserToUserGroup({
          prisma,
          sourceUserId: ctx.user.sub,
          groupId: input.groupId,
          shortnameOrEmail: input.shortnameOrEmail,
          asAdmin: input.asAdmin,
        }),
      }
    }),

  promoteGroupMemberToAdmin: userFullAccessProcedure
    .input(promoteGroupMemberInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        promoted: await promoteGroupMemberToAdmin({
          prisma,
          userId: ctx.user.sub,
          groupId: input.groupId,
          memberId: input.memberId,
        }),
      }
    }),

  demoteGroupAdminToMember: userFullAccessProcedure
    .input(demoteGroupAdminInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        demoted: await demoteGroupAdminToMember({
          prisma,
          userId: ctx.user.sub,
          groupId: input.groupId,
          adminId: input.adminId,
        }),
      }
    }),

  removeUserFromGroup: userFullAccessProcedure
    .input(userGroupUserInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        removed: await removeUserFromGroup({
          prisma,
          sourceUserId: ctx.user.sub,
          groupId: input.groupId,
          userId: input.userId,
        }),
      }
    }),

  transferGroupOwnership: userFullAccessProcedure
    .input(transferGroupOwnershipInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        transferred: await transferGroupOwnership({
          prisma,
          userId: ctx.user.sub,
          id: input.id,
          newOwnerId: input.newOwnerId,
        }),
      }
    }),

  catalogSharingRequestCount: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)

    return { count: await countCatalogSharingRequests(prisma, ctx.user.sub) }
  }),

  catalogSharingRequests: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)

    return {
      catalogSharingRequests: await getCatalogSharingRequests(
        prisma,
        ctx.user.sub
      ),
    }
  }),

  catalogCollectionInfo: userProcedure
    .input(catalogCollectionInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        catalogCollectionInfo: await getCatalogCollectionInfo({
          prisma,
          userId: ctx.user.sub,
          catalogCollectionId: input.catalogCollectionId,
        }),
      }
    }),

  catalogCollections: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)

    return {
      catalogCollections: await getCatalogCollectionsList(prisma, ctx.user.sub),
    }
  }),

  catalogObjects: userProcedure
    .input(catalogCollectionInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        catalogObjects: await getCatalogObjects({
          prisma,
          userId: ctx.user.sub,
          catalogCollectionId: input.catalogCollectionId,
        }),
      }
    }),

  catalogAnswerCollections: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)

    return {
      catalogAnswerCollections: await getCatalogAnswerCollections(
        prisma,
        ctx.user.sub
      ),
    }
  }),

  catalogLiveQuizTemplates: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)

    return {
      catalogLiveQuizTemplates: await getCatalogLiveQuizTemplates(
        prisma,
        ctx.user.sub
      ),
    }
  }),

  catalogElements: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)

    return {
      catalogElements: await getCatalogElements(prisma, ctx.user.sub),
    }
  }),

  createCatalogCollection: userFullAccessProcedure
    .input(createCatalogCollectionInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        catalogCollection: await createCatalogCollection({
          prisma,
          userId: ctx.user.sub,
          name: input.name,
          access: input.access,
        }),
      }
    }),

  changeCatalogCollectionName: userFullAccessProcedure
    .input(catalogCollectionNameInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const canEdit = await hasCatalogCollectionPermission(
        prisma,
        input.catalogCollectionId,
        ctx.user.sub,
        writePermissionLevels
      )

      if (!canEdit) return { changed: false }

      return {
        changed: await changeCatalogCollectionName({
          prisma,
          emitter: ctx.emitter,
          catalogCollectionId: input.catalogCollectionId,
          name: input.name,
        }),
      }
    }),

  changeCatalogCollectionAccess: userFullAccessProcedure
    .input(catalogCollectionAccessInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const canManage = await hasAdminObjectPermission(
        prisma,
        { catalogCollectionId: input.catalogCollectionId },
        ctx.user.sub
      )

      if (!canManage) return { changed: false }

      return {
        changed: await changeCatalogCollectionAccess({
          prisma,
          emitter: ctx.emitter,
          userId: ctx.user.sub,
          catalogCollectionId: input.catalogCollectionId,
          access: input.access,
        }),
      }
    }),

  changeCatalogObjectAccess: userFullAccessProcedure
    .input(catalogObjectAccessInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        changed: await changeCatalogObjectAccess({
          prisma,
          emitter: ctx.emitter,
          userId: ctx.user.sub,
          assignmentId: input.assignmentId,
          access: input.access,
        }),
      }
    }),

  deleteCatalogCollection: userFullAccessProcedure
    .input(deleteCatalogCollectionInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const canManage = await hasAdminObjectPermission(
        prisma,
        { catalogCollectionId: input.catalogCollectionId },
        ctx.user.sub
      )

      if (!canManage) return { deletedCatalogCollectionId: null }

      return {
        deletedCatalogCollectionId: await deleteCatalogCollection({
          prisma,
          emitter: ctx.emitter,
          catalogCollectionId: input.catalogCollectionId,
        }),
      }
    }),

  addObjectToCatalog: userFullAccessProcedure
    .input(addObjectToCatalogInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        catalogObject: await addObjectToCatalog({
          prisma,
          emitter: ctx.emitter,
          userId: ctx.user.sub,
          objectId: input.objectId,
          objectType: input.objectType,
          access: input.access,
          catalogCollectionId: input.catalogCollectionId,
        }),
      }
    }),

  removeCatalogObjectAssignment: userFullAccessProcedure
    .input(removeCatalogObjectAssignmentInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        removed: await removeCatalogObjectAssignment({
          prisma,
          emitter: ctx.emitter,
          userId: ctx.user.sub,
          assignmentId: input.assignmentId,
        }),
      }
    }),

  copyCatalogObjectToAccount: userFullAccessProcedure
    .input(catalogObjectActionInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        copied: await copyCatalogObjectToAccount({
          prisma,
          emitter: ctx.emitter,
          userId: ctx.user.sub,
          objectId: input.objectId,
          objectType: input.objectType,
          catalogCollectionId: input.catalogCollectionId,
        }),
      }
    }),

  importCatalogObject: userFullAccessProcedure
    .input(catalogObjectActionInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        imported: await importCatalogObject({
          prisma,
          emitter: ctx.emitter,
          userId: ctx.user.sub,
          objectId: input.objectId,
          objectType: input.objectType,
          catalogCollectionId: input.catalogCollectionId,
        }),
      }
    }),

  requestCatalogCollection: userFullAccessProcedure
    .input(requestCatalogCollectionInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        catalogCollection: await requestCatalogCollection({
          prisma,
          emitter: ctx.emitter,
          userId: ctx.user.sub,
          catalogCollectionId: input.catalogCollectionId,
          requestedPermissionLevel: input.requestedPermissionLevel,
        }),
      }
    }),

  requestCatalogObject: userFullAccessProcedure
    .input(requestCatalogObjectInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        requested: await requestCatalogObject({
          prisma,
          emitter: ctx.emitter,
          userId: ctx.user.sub,
          objectId: input.objectId,
          objectType: input.objectType,
          catalogCollectionId: input.catalogCollectionId,
          requestedPermissionLevel: input.requestedPermissionLevel,
        }),
      }
    }),

  cancelObjectSharingRequest: userFullAccessProcedure
    .input(objectActivityInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        cancelled: await cancelObjectSharingRequest({
          prisma,
          emitter: ctx.emitter,
          userId: ctx.user.sub,
          objectId: input.objectId,
          objectType: input.objectType,
        }),
      }
    }),

  approveObjectSharingRequest: userFullAccessProcedure
    .input(approveObjectSharingRequestInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        resolved: await resolveObjectSharingRequest({
          prisma,
          emitter: ctx.emitter,
          sourceUserId: ctx.user.sub,
          requestId: input.requestId,
          userId: input.userId,
          permissionLevel: input.permissionLevel,
          propagation: input.propagation,
          approved: true,
        }),
      }
    }),

  declineObjectSharingRequest: userFullAccessProcedure
    .input(sharingRequestInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)

      return {
        resolved: await resolveObjectSharingRequest({
          prisma,
          emitter: ctx.emitter,
          sourceUserId: ctx.user.sub,
          requestId: input.requestId,
          userId: input.userId,
          permissionLevel: PermissionLevel.READ,
          propagation: false,
          approved: false,
        }),
      }
    }),

  objectPermissions: userProcedure
    .input(objectActivityInput)
    .query(async ({ ctx, input }) => {
      const scope = getPermissionObjectScope(input)

      if (!scope) return { objectPermissions: null }

      const prisma = getPrisma(ctx)
      const canManage = await hasAdminObjectPermission(
        prisma,
        scope,
        ctx.user.sub
      )

      if (!canManage) return { objectPermissions: null }

      return {
        objectPermissions: await getObjectPermissionsForScope(
          prisma,
          scope,
          ctx.user.sub
        ),
      }
    }),

  derivedObjectPermissions: userProcedure
    .input(objectActivityInput)
    .query(async ({ ctx, input }) => {
      const scope = getPermissionObjectScope(input)

      if (!scope) return { derivedObjectPermissions: null }
      if (scope.catalogCollectionId) return { derivedObjectPermissions: [] }

      const prisma = getPrisma(ctx)
      const canManage = await hasAdminObjectPermission(
        prisma,
        scope,
        ctx.user.sub
      )

      if (!canManage) return { derivedObjectPermissions: null }

      return {
        derivedObjectPermissions: await getDerivedPermissionsForScope(
          prisma,
          scope,
          ctx.user.sub
        ),
      }
    }),

  derivedPermissionOrigin: userProcedure
    .input(derivedPermissionOriginInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const permission = await prisma.derivedPermission.findFirst({
        where: { id: input.id, derived: true },
        include: derivedPermissionOriginInclude,
      })

      if (!permission) return { derivedPermissionOrigin: null }

      const scope = getPermissionScopeFromDerivedPermission(permission)
      const canManage = await hasAdminObjectPermission(
        prisma,
        scope,
        ctx.user.sub
      )

      if (!canManage) return { derivedPermissionOrigin: null }

      return { derivedPermissionOrigin: toDerivedPermissionOrigin(permission) }
    }),

  shareObject: userFullAccessProcedure
    .input(shareObjectInput)
    .mutation(async ({ ctx, input }) => {
      const scope = getPermissionObjectScope(input)

      if (!scope) return { permission: null }

      const prisma = getPrisma(ctx)
      const canManage = await hasAdminObjectPermission(
        prisma,
        scope,
        ctx.user.sub
      )

      if (!canManage) return { permission: null }

      const shortnameOrEmail = input.shortnameOrEmail?.trim()

      if (shortnameOrEmail) {
        return {
          permission: await shareObjectWithUser({
            prisma,
            scope,
            sourceUserId: ctx.user.sub,
            shortnameOrEmail,
            permissionLevel: input.permissionLevel,
            propagation: input.propagation,
          }),
        }
      }

      if (input.userGroupId != null) {
        return {
          permission: await shareObjectWithUserGroup({
            prisma,
            scope,
            sourceUserId: ctx.user.sub,
            userGroupId: input.userGroupId,
            permissionLevel: input.permissionLevel,
            propagation: input.propagation,
          }),
        }
      }

      return { permission: null }
    }),

  transferObjectOwnership: userFullAccessProcedure
    .input(transferObjectOwnershipInput)
    .mutation(async ({ ctx, input }) => {
      const scope = getPermissionObjectScope(input)

      if (!scope) return { permission: null }

      const prisma = getPrisma(ctx)
      const canTransfer = await hasOwnerObjectPermission(
        prisma,
        scope,
        ctx.user.sub
      )

      if (!canTransfer) return { permission: null }

      const shortnameOrEmail = input.shortnameOrEmail.trim()

      if (!shortnameOrEmail) return { permission: null }

      return {
        permission: await transferObjectOwnership({
          prisma,
          scope,
          sourceUserId: ctx.user.sub,
          shortnameOrEmail,
        }),
      }
    }),

  changePermissionLevel: userFullAccessProcedure
    .input(changePermissionLevelInput)
    .mutation(async ({ ctx, input }) => {
      const scope = getPermissionObjectScope(input)

      if (!scope) return { changed: false }

      const prisma = getPrisma(ctx)
      const canManage = await hasAdminObjectPermission(
        prisma,
        scope,
        ctx.user.sub
      )

      if (!canManage) return { changed: false }

      return {
        changed: await changeObjectPermissionLevel({
          prisma,
          scope,
          sourceUserId: ctx.user.sub,
          permissionId: input.permissionId,
          permissionLevel: input.permissionLevel,
          propagation: input.propagation,
        }),
      }
    }),

  revokeObjectAccess: userFullAccessProcedure
    .input(revokeObjectAccessInput)
    .mutation(async ({ ctx, input }) => {
      const scope = getPermissionObjectScope(input)

      if (!scope) return { revokedPermissionId: null }

      const prisma = getPrisma(ctx)
      const canManage = await hasAdminObjectPermission(
        prisma,
        scope,
        ctx.user.sub
      )

      if (!canManage) return { revokedPermissionId: null }

      return {
        revokedPermissionId: await revokeObjectAccess({
          prisma,
          scope,
          sourceUserId: ctx.user.sub,
          permissionId: input.permissionId,
        }),
      }
    }),

  removeObject: userFullAccessProcedure
    .input(removeObjectInput)
    .mutation(async ({ ctx, input }) => {
      const scope = getPermissionObjectScope(input)

      if (!scope) return { removedObjectId: null }

      const prisma = getPrisma(ctx)

      return {
        removedObjectId: await removeObject({
          prisma,
          scope,
          userId: ctx.user.sub,
          emitter: ctx.emitter,
        }),
      }
    }),

  objectActivity: userProcedure
    .input(objectActivityInput)
    .query(async ({ ctx, input }) => {
      const objectFields = getActivityLogObjectFields(input)

      if (!objectFields) return { objectActivity: null }

      const canRead = await hasObjectPermission(
        ctx,
        input,
        PermissionLevel.READ
      )

      if (!canRead) return { objectActivity: null }

      const prisma = getPrisma(ctx)
      const activityLog = await prisma.activityLogEntry.findMany({
        where: objectFields,
        include: { user: { select: { shortname: true } } },
        orderBy: { createdAt: 'asc' },
      })

      return {
        objectActivity: activityLog.map((entry) =>
          toActivityLogEntry(entry, ctx.user.sub)
        ),
      }
    }),

  addActivityMessage: userFullAccessProcedure
    .input(addActivityMessageInput)
    .mutation(async ({ ctx, input }) => {
      const objectFields = getActivityLogObjectFields(input)

      if (!objectFields) return { activityMessage: null }

      const canRead = await hasObjectPermission(
        ctx,
        input,
        PermissionLevel.READ
      )

      if (!canRead) return { activityMessage: null }

      const prisma = getPrisma(ctx)
      const activityMessage = await prisma.activityLogEntry.create({
        data: {
          type: ActivityLogType.MESSAGE,
          message: input.message,
          objectType: input.objectType,
          ...objectFields,
          userId: ctx.user.sub,
        },
        include: { user: { select: { shortname: true } } },
      })

      return {
        activityMessage: toActivityLogEntry(activityMessage, ctx.user.sub),
      }
    }),

  deleteActivityMessage: userFullAccessProcedure
    .input(activityLogEntryInput)
    .mutation(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const activityMessage = await prisma.activityLogEntry.findUnique({
        where: { id: input.id },
      })

      if (!activityMessage || activityMessage.userId !== ctx.user.sub) {
        return { deleted: false }
      }

      await prisma.activityLogEntry.delete({
        where: { id: input.id, userId: ctx.user.sub },
      })

      return { deleted: true }
    }),

  resolveActivityLogEntry: userFullAccessProcedure
    .input(activityLogEntryInput)
    .mutation(() => {
      return { activityLogEntry: null }
    }),
})
