import type * as DB from '@klicker-uzh/prisma/client'
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
