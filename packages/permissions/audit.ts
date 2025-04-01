import prisma from './lib/prisma.js' // Reverted import path
import { mockAuditLogs } from './mockData.js'
import {
  AccessLevel,
  AuditActionType,
  AuditLogEntry,
  ResourceType,
} from './types.js'

// Type definition for the details object - adjust based on actual needs
// We might need to make this more specific per actionType later
type AuditLogDetails = {
  permissionBefore?: AccessLevel | null
  permissionAfter?: AccessLevel | null
  targetUserId?: string
  groupId?: string
  memberId?: string
  previousOwnerId?: string
  newOwnerId?: string
  reason?: string
  metadata?: Record<string, any>
  shareMode?: string // Assuming ShareMode is string-like
  accessLevel?: AccessLevel
  revokedGrantId?: string
  removedDerivedGrantCount?: number
  removedPermissionCount?: number
}

// Interface for the input data to logAuditEvent, mirroring AuditLogEntry but without id/timestamp
interface LogAuditEventInput {
  actionType: AuditActionType
  performedByUserId: string
  resourceId?: string | null // Match Prisma schema (optional)
  resourceType?: ResourceType | null // Match Prisma schema (optional)
  details?: AuditLogDetails | null
}

// Generate a unique ID for audit log entries
export function generateAuditLogId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Logs an audit event to the database.
 * @param eventInput - The audit event data to log.
 */
export async function logAuditEvent(
  eventInput: LogAuditEventInput
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actionType: eventInput.actionType,
        performedByUserId: eventInput.performedByUserId,
        resourceId: eventInput.resourceId,
        resourceType: eventInput.resourceType,
        // Stringify the details object for SQLite compatibility
        details: eventInput.details ? JSON.stringify(eventInput.details) : null,
        // timestamp is handled by @default(now())
      },
    })
  } catch (error) {
    console.error('Failed to log audit event:', error)
    // Depending on requirements, you might want to:
    // - Rethrow the error
    // - Log to a fallback mechanism (e.g., console, file)
    // - Ignore the error (if audit logging is non-critical)
  }
}

// Query functions for audit logs
export function getAuditLogs(filters?: {
  timeStart?: Date
  timeEnd?: Date
  actionType?: AuditActionType
  performedBy?: string
  resourceId?: string
  resourceType?: ResourceType
  targetUserId?: string
}): AuditLogEntry[] {
  let filteredLogs = [...mockAuditLogs]

  if (filters) {
    if (filters.timeStart) {
      filteredLogs = filteredLogs.filter(
        (log) => log.timestamp >= filters.timeStart!
      )
    }
    if (filters.timeEnd) {
      filteredLogs = filteredLogs.filter(
        (log) => log.timestamp <= filters.timeEnd!
      )
    }
    if (filters.actionType) {
      filteredLogs = filteredLogs.filter(
        (log) => log.actionType === filters.actionType
      )
    }
    if (filters.performedBy) {
      filteredLogs = filteredLogs.filter(
        (log) => log.performedBy === filters.performedBy
      )
    }
    if (filters.resourceId) {
      filteredLogs = filteredLogs.filter(
        (log) => log.resourceId === filters.resourceId
      )
    }
    if (filters.resourceType) {
      filteredLogs = filteredLogs.filter(
        (log) => log.resourceType === filters.resourceType
      )
    }
    if (filters.targetUserId) {
      filteredLogs = filteredLogs.filter(
        (log) => log.details?.targetUserId === filters.targetUserId
      )
    }
  }

  // Return in reverse chronological order (newest first)
  return filteredLogs.sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  )
}

// Get audit logs for a specific resource
export function getResourceAuditLogs(resourceId: string): AuditLogEntry[] {
  return getAuditLogs({ resourceId })
}

// Get audit logs for a specific user's actions
export function getUserActionAuditLogs(userId: string): AuditLogEntry[] {
  return getAuditLogs({ performedBy: userId })
}

// Get audit logs for changes affecting a specific user
export function getUserAffectedAuditLogs(userId: string): AuditLogEntry[] {
  return getAuditLogs({ targetUserId: userId })
}
