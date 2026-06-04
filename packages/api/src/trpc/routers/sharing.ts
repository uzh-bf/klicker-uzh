import {
  ActivityLogType,
  AuditLogType,
  ObjectType,
  PermissionLevel,
  type DerivedPermission,
  type Prisma,
} from '@klicker-uzh/prisma/client'
import {
  recomputeDerivedPermissions,
  updateAccessRequestInstances,
} from '@klicker-uzh/util'
import { getPrisma } from '../context.js'
import {
  sortDerivedPermissionInfos,
  sortPermissionInfos,
  toActivityLogEntry,
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
  approveObjectSharingRequestInput,
  changePermissionLevelInput,
  derivedPermissionOriginInput,
  objectActivityInput,
  revokeObjectAccessInput,
  shareObjectInput,
  sharingRequestInput,
  transferObjectOwnershipInput,
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

type RecomputePermissionScope = Parameters<
  typeof recomputeDerivedPermissions
>[0]

type UpdateAccessRequestScope = Parameters<
  typeof updateAccessRequestInstances
>[0]

const adminPermissionLevels = [PermissionLevel.ADMIN, PermissionLevel.OWNER]

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

export const sharingRouter = router({
  userGroups: userProcedure.query(async ({ ctx }) => {
    const prisma = getPrisma(ctx)

    return { userGroups: await getUserGroupsUser(prisma, ctx.user.sub) }
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
