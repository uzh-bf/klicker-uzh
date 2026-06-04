import type * as DB from '@klicker-uzh/prisma/client'
import { ObjectType, PermissionLevel } from '@klicker-uzh/prisma/client'
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
