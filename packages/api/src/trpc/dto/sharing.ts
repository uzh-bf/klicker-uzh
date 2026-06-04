import type * as DB from '@klicker-uzh/prisma/client'
import {
  ObjectType,
  PermissionLevel,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import type { ActivityLogModificationFieldType } from '@klicker-uzh/types'

type ActivityLogEntrySource = DB.ActivityLogEntry & {
  user?: { shortname: string } | null
}

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toNullableString(value: unknown) {
  if (value == null) return null
  return typeof value === 'string' ? value : String(value)
}

function getModificationDetails(entry: ActivityLogEntrySource) {
  return isRecord(entry.modificationDetails) ? entry.modificationDetails : {}
}

export function toActivityLogEntry(
  entry: ActivityLogEntrySource,
  userId: string
) {
  const modificationDetails = getModificationDetails(entry)

  return {
    id: entry.id,
    type: entry.type,
    objectType: entry.objectType,
    message: entry.message,
    resolved: entry.resolved,
    resolvedAt: entry.resolvedAt,
    username: entry.user?.shortname ?? '',
    isOwn: entry.userId === userId,
    options: {
      field: toNullableString(
        modificationDetails.field
      ) as ActivityLogModificationFieldType | null,
      oldValue: toNullableString(modificationDetails.oldValue),
      newValue: toNullableString(modificationDetails.newValue),
    },
    isEdited: entry.updatedAt.getTime() > entry.createdAt.getTime(),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}

type UserSummary = Pick<DB.User, 'id' | 'shortname' | 'email'>

type UserGroupSummary = Pick<DB.UserGroup, 'id' | 'name'>

type ObjectNameSummary = { name: string }

type CatalogSharingRequestSource = DB.AccessRequest & {
  user: Pick<DB.User, 'shortname' | 'email'>
  catalogCollection?: ObjectNameSummary | null
  answerCollection?: ObjectNameSummary | null
  element?: ObjectNameSummary | null
}

type CatalogPermissionSummary = Pick<DB.DerivedPermission, 'permissionLevel'>

type CatalogCollectionSource = Pick<
  DB.CatalogCollection,
  'id' | 'name' | 'access' | 'ownerId'
> & {
  owner?: Pick<DB.User, 'shortname'> | null
  permissions: CatalogPermissionSummary[]
  accessRequests: Pick<DB.AccessRequest, 'id'>[]
}

type CatalogObjectSource = {
  id: number
  name: string
  owner?: Pick<DB.User, 'shortname'> | null
  permissions: CatalogPermissionSummary[]
  accessRequests: Pick<DB.AccessRequest, 'id'>[]
}

type CatalogLiveQuizSource = {
  id: string
  name: string
  status: DB.PublicationStatus
  owner?: Pick<DB.User, 'shortname'> | null
  permissions: CatalogPermissionSummary[]
  accessRequests: Pick<DB.AccessRequest, 'id'>[]
  templateInfo?: { id: string } | null
}

type CatalogObjectAssignmentSource = Pick<
  DB.CatalogCollectionAssignment,
  'id' | 'access'
> & {
  answerCollection?: CatalogObjectSource | null
  element?: CatalogObjectSource | null
  liveQuiz?: CatalogLiveQuizSource | null
}

type DirectPermissionSource = DB.Permission & {
  user?: UserSummary | null
  userGroup?: UserGroupSummary | null
}

type DerivedPermissionSource = DB.DerivedPermission & {
  user: Pick<DB.User, 'shortname' | 'email'>
}

export function toPermissionInfo(
  permission: DirectPermissionSource,
  userId: string
) {
  return {
    permissionId: permission.id,
    userId: permission.user?.id,
    username: permission.user?.shortname,
    userEmail: permission.user?.email,
    userGroupId: permission.userGroup?.id,
    userGroupName: permission.userGroup?.name,
    permissionLevel: permission.permissionLevel,
    propagation: permission.propagation,
    isOwn: permission.user?.id === userId,
  }
}

export function toOwnerPermission(owner: UserSummary, userId: string) {
  return {
    permissionId: -1,
    userId: owner.id,
    username: owner.shortname,
    userEmail: owner.email,
    userGroupId: undefined,
    userGroupName: undefined,
    permissionLevel: PermissionLevel.OWNER,
    propagation: false,
    isOwn: owner.id === userId,
  }
}

export function sortPermissionInfos(
  permissions: ReturnType<typeof toPermissionInfo>[]
) {
  return permissions.sort((a, b) => {
    if (a.username === b.username) {
      return (a.userGroupName ?? '').localeCompare(b.userGroupName ?? '')
    }

    return (a.username ?? '').localeCompare(b.username ?? '')
  })
}

export function toDerivedPermissionInfo(
  permission: DerivedPermissionSource,
  userId: string
) {
  return {
    permissionId: permission.id,
    permissionLevel: permission.permissionLevel,
    userId: permission.userId,
    username: permission.user.shortname,
    userEmail: permission.user.email,
    isOwn: permission.userId === userId,
  }
}

export function sortDerivedPermissionInfos(
  permissions: ReturnType<typeof toDerivedPermissionInfo>[]
) {
  return permissions.sort((a, b) =>
    (a.username ?? '').localeCompare(b.username ?? '')
  )
}

export function toUserGroupMember(
  user: Pick<DB.User, 'id' | 'shortname' | 'email'>,
  userId: string
) {
  return {
    id: user.id,
    shortname: user.shortname,
    email: user.email,
    isSelf: user.id === userId,
  }
}

export function toCatalogSharingRequest(request: CatalogSharingRequestSource) {
  const sharedRequestAttributes = {
    requestId: request.id,
    userId: request.userId,
    userShortname: request.user.shortname,
    userEmail: request.user.email,
  }

  if (request.catalogCollection) {
    return {
      ...sharedRequestAttributes,
      objectName: request.catalogCollection.name,
      objectType: ObjectType.CATALOG_COLLECTION,
    }
  }

  if (request.answerCollection) {
    return {
      ...sharedRequestAttributes,
      objectName: request.answerCollection.name,
      objectType: ObjectType.ANSWER_COLLECTION,
    }
  }

  if (request.element) {
    return {
      ...sharedRequestAttributes,
      objectName: request.element.name,
      objectType: ObjectType.ELEMENT,
    }
  }

  return null
}

function getCatalogPermissionFlags(permissions: CatalogPermissionSummary[]) {
  return permissions.reduce(
    (acc, permission) => {
      const level = permission.permissionLevel
      return {
        isOwner: acc.isOwner || level === PermissionLevel.OWNER,
        isManager:
          acc.isManager ||
          level === PermissionLevel.OWNER ||
          level === PermissionLevel.ADMIN,
        isEditor:
          acc.isEditor ||
          level === PermissionLevel.OWNER ||
          level === PermissionLevel.ADMIN ||
          level === PermissionLevel.WRITE,
        isShared: acc.isShared || level !== PermissionLevel.OWNER,
      }
    },
    {
      isOwner: false,
      isManager: false,
      isEditor: false,
      isShared: false,
    }
  )
}

export function toCatalogCollection(collection: CatalogCollectionSource) {
  const isRequested = collection.accessRequests.length > 0
  const { isOwner, isManager, isEditor, isShared } = getCatalogPermissionFlags(
    collection.permissions
  )

  return {
    id: collection.id,
    name: collection.name,
    access: collection.access,
    ownerShortname: collection.owner?.shortname ?? null,
    isOwner,
    isManager,
    isEditor,
    isRequested,
    isShared,
  }
}

function toCatalogObject({
  assignmentId,
  access,
  objectId,
  objectUuid,
  name,
  objectType,
  templateId,
  ownerShortname,
  permissions,
  accessRequests,
}: {
  assignmentId: number
  access: DB.ObjectAccess
  objectId: number | null
  objectUuid: string | null
  name: string
  objectType: ObjectType
  templateId: string | null
  ownerShortname: string | null
  permissions: CatalogPermissionSummary[]
  accessRequests: Pick<DB.AccessRequest, 'id'>[]
}) {
  const permission = permissions[0]

  return {
    id: assignmentId,
    objectId,
    objectUuid,
    name,
    objectType,
    templateId,
    access,
    ownerShortname,
    isOwner: permission?.permissionLevel === PermissionLevel.OWNER,
    isManager:
      permission?.permissionLevel === PermissionLevel.ADMIN ||
      permission?.permissionLevel === PermissionLevel.OWNER,
    isRequested: accessRequests.length > 0,
    isShared:
      typeof permission !== 'undefined' &&
      permission.permissionLevel !== PermissionLevel.OWNER,
  }
}

export function toCatalogObjectsFromAssignment(
  assignment: CatalogObjectAssignmentSource
) {
  if (assignment.answerCollection) {
    const answerCollection = assignment.answerCollection

    return toCatalogObject({
      assignmentId: assignment.id,
      access: assignment.access,
      objectId: answerCollection.id,
      objectUuid: null,
      name: answerCollection.name,
      objectType: ObjectType.ANSWER_COLLECTION,
      templateId: null,
      ownerShortname: answerCollection.owner?.shortname ?? null,
      permissions: answerCollection.permissions,
      accessRequests: answerCollection.accessRequests,
    })
  }

  if (assignment.element) {
    const element = assignment.element

    return toCatalogObject({
      assignmentId: assignment.id,
      access: assignment.access,
      objectId: element.id,
      objectUuid: null,
      name: element.name,
      objectType: ObjectType.ELEMENT,
      templateId: null,
      ownerShortname: element.owner?.shortname ?? null,
      permissions: element.permissions,
      accessRequests: element.accessRequests,
    })
  }

  if (
    assignment.liveQuiz &&
    assignment.liveQuiz.status === PublicationStatus.TEMPLATE
  ) {
    const liveQuiz = assignment.liveQuiz

    return toCatalogObject({
      assignmentId: assignment.id,
      access: assignment.access,
      objectId: null,
      objectUuid: liveQuiz.id,
      name: liveQuiz.name,
      objectType: ObjectType.LIVE_QUIZ,
      templateId: liveQuiz.templateInfo?.id ?? null,
      ownerShortname: liveQuiz.owner?.shortname ?? null,
      permissions: liveQuiz.permissions,
      accessRequests: liveQuiz.accessRequests,
    })
  }

  return null
}
