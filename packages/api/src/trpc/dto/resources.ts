import { PermissionLevel } from '@klicker-uzh/prisma/client'
import { SharingType } from '@klicker-uzh/types'

type AnswerCollectionCountSource = {
  entries: number
  permissions: number
  linkedElements: number
  linkedTemplates: number
}

type AnswerCollectionInfoSource = {
  id: number
  name: string
  description: string
  originalId?: number | null
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
  owner?: { shortname: string } | null
  _count: AnswerCollectionCountSource
}

type AnswerCollectionPermissionSource = {
  permissionLevel: PermissionLevel
  derived: boolean
  directPermission?: { userGroupId?: number | null } | null
  answerCollection?: AnswerCollectionInfoSource | null
}

type SingleAnswerCollectionSource = {
  id: number
  name: string
  description: string
  owner?: { shortname: string } | null
  entries: {
    id: number
    value: string
    _count: { itemUsages: number; templateUsages: number }
  }[]
  permissions: { permissionLevel: PermissionLevel }[]
  _count: { permissions: number }
}

function getPermissionFlags(permissionLevel: PermissionLevel) {
  const isOwner = permissionLevel === PermissionLevel.OWNER
  const isManager =
    permissionLevel === PermissionLevel.ADMIN ||
    permissionLevel === PermissionLevel.OWNER
  const isEditor =
    permissionLevel === PermissionLevel.WRITE ||
    permissionLevel === PermissionLevel.ADMIN ||
    permissionLevel === PermissionLevel.OWNER

  return { isOwner, isManager, isEditor }
}

export function toAnswerCollectionInfo(
  permission: AnswerCollectionPermissionSource
) {
  const collection = permission.answerCollection

  if (!collection || (permission.derived && collection.isDeleted)) {
    return null
  }

  const flags = getPermissionFlags(permission.permissionLevel)
  const isInUse =
    collection._count.linkedElements > 0 ||
    collection._count.linkedTemplates > 0

  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    ownerShortname: collection.owner?.shortname,
    numSharedUsers: collection._count.permissions - 1,
    numOfEntries: collection._count.entries,
    permissionLevel: permission.permissionLevel,
    ...flags,
    isImported:
      permission.permissionLevel === PermissionLevel.OWNER &&
      collection.originalId !== null,
    isShared: permission.permissionLevel !== PermissionLevel.OWNER,
    isDeletable: !isInUse,
    isRemovable:
      !isInUse &&
      permission.permissionLevel !== PermissionLevel.OWNER &&
      !permission.derived &&
      permission.directPermission?.userGroupId === null,
    sharingType:
      permission.permissionLevel === PermissionLevel.OWNER
        ? SharingType.OWNED
        : permission.derived
          ? SharingType.DEPENDENCY
          : SharingType.SHARED,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  }
}

export function toSingleAnswerCollection(
  collection: SingleAnswerCollectionSource | null
) {
  const permissionLevel = collection?.permissions[0]?.permissionLevel

  if (!collection || !permissionLevel) return null

  const flags = getPermissionFlags(permissionLevel)

  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    ownerShortname: collection.owner?.shortname,
    numSharedUsers: flags.isManager
      ? collection._count.permissions - 1
      : undefined,
    permissionLevel,
    ...flags,
    isShared: permissionLevel !== PermissionLevel.OWNER,
    entries: collection.entries.map((entry) => ({
      id: entry.id,
      value: entry.value,
      numSolutionUsages: entry._count.itemUsages + entry._count.templateUsages,
    })),
  }
}
