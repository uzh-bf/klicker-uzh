import type {
  Prisma,
  PendingPermissionOperation,
  PermissionOperationType,
  PermissionOperationStatus,
  PermissionLevel,
  ObjectType,
  Permission,
} from '@klicker-uzh/prisma'

// Simple feature flag check - aligns with how other features are controlled
export function shouldCreateOperations(): boolean {
  // For testing, always enabled. In production, check environment variable
  return process.env.ENABLE_PENDING_OPERATIONS === 'true' || process.env.NODE_ENV === 'test'
}

// Simplified logging that matches existing patterns
export function logOperation(level: 'info' | 'error', message: string, data?: any): void {
  if (level === 'error' || process.env.LOG_PENDING_OPERATIONS === 'true') {
    console[level](`[PendingOperations] ${message}`, data || {})
  }
}

// Priority values for operation types
const OPERATION_PRIORITIES: Record<PermissionOperationType, number> = {
  REVOKE_USER_PERMISSION: 100,
  EXPAND_GROUP_TO_USER_REVOKE_OPERATIONS: 95,
  EXPAND_GROUP_TO_USER_UPDATE_OPERATIONS: 90,
  EXPAND_GROUP_TO_USER_GRANT_OPERATIONS: 85,
  UPDATE_PERMISSION_LEVEL: 50,
  PROCESS_USER_ELEMENT_ACCESS: 10,
  PROCESS_USER_ANSWER_COLLECTION_ACCESS: 10,
  PROCESS_USER_COURSE_ACCESS: 10,
  PROCESS_USER_LIVE_QUIZ_ACCESS: 10,
  PROCESS_USER_PRACTICE_QUIZ_ACCESS: 10,
  PROCESS_USER_MICROLEARNING_ACCESS: 10,
  PROCESS_USER_GROUP_ACTIVITY_ACCESS: 10,
  PROCESS_USER_CATALOG_COLLECTION_ACCESS: 10,
}

// Object type to operation type mapping
const OBJECT_TO_OPERATION_TYPE: Record<ObjectType, PermissionOperationType> = {
  ELEMENT: 'PROCESS_USER_ELEMENT_ACCESS',
  ANSWER_COLLECTION: 'PROCESS_USER_ANSWER_COLLECTION_ACCESS',
  COURSE: 'PROCESS_USER_COURSE_ACCESS',
  LIVE_QUIZ: 'PROCESS_USER_LIVE_QUIZ_ACCESS',
  PRACTICE_QUIZ: 'PROCESS_USER_PRACTICE_QUIZ_ACCESS',
  MICRO_LEARNING: 'PROCESS_USER_MICROLEARNING_ACCESS',
  GROUP_ACTIVITY: 'PROCESS_USER_GROUP_ACTIVITY_ACCESS',
  CATALOG_COLLECTION: 'PROCESS_USER_CATALOG_COLLECTION_ACCESS',
  USER_GROUP: 'EXPAND_GROUP_TO_USER_GRANT_OPERATIONS', // Default for direct mapping (grants)
}

/**
 * Extract object ID and type from a permission
 */
function getObjectFromPermission(permission: Permission): { objectId: string; objectType: ObjectType } {
  if (permission.elementId) {
    return { objectId: permission.elementId.toString(), objectType: 'ELEMENT' }
  } else if (permission.answerCollectionId) {
    return { objectId: permission.answerCollectionId.toString(), objectType: 'ANSWER_COLLECTION' }
  } else if (permission.courseId) {
    return { objectId: permission.courseId.toString(), objectType: 'COURSE' }
  } else if (permission.liveQuizId) {
    return { objectId: permission.liveQuizId.toString(), objectType: 'LIVE_QUIZ' }
  } else if (permission.practiceQuizId) {
    return { objectId: permission.practiceQuizId.toString(), objectType: 'PRACTICE_QUIZ' }
  } else if (permission.microLearningId) {
    return { objectId: permission.microLearningId.toString(), objectType: 'MICRO_LEARNING' }
  } else if (permission.groupActivityId) {
    return { objectId: permission.groupActivityId.toString(), objectType: 'GROUP_ACTIVITY' }
  } else if (permission.catalogCollectionId) {
    return { objectId: permission.catalogCollectionId.toString(), objectType: 'CATALOG_COLLECTION' }
  }
  throw new Error('Permission has no associated object')
}

/**
 * Generate operation fingerprint for idempotency
 */
export function generateOperationFingerprint(
  operationType: PermissionOperationType,
  targetUserId: string | null,
  targetGroupId: number | null,
  objectId: string,
  objectType: string,
  permissionLevel: string | null
): string {
  return [
    operationType,
    targetUserId || 'null',
    targetGroupId?.toString() || 'null',
    objectId,
    objectType,
    permissionLevel || 'null',
  ].join(':')
}

/**
 * Build a single operation (returns flat structure for createMany)
 */
function buildOperation(params: {
  operationType: PermissionOperationType
  targetUserId?: string
  targetGroupId?: number
  objectId: string
  objectType: ObjectType
  permissionLevel?: PermissionLevel | null
  oldPermissionLevel?: PermissionLevel | null
  directPermissionId?: number
  parentOperationId?: number
}): Prisma.PendingPermissionOperationCreateManyInput {
  const {
    operationType,
    targetUserId,
    targetGroupId,
    objectId,
    objectType,
    permissionLevel,
    oldPermissionLevel,
    directPermissionId,
    parentOperationId,
  } = params

  return {
    operationType,
    status: 'PENDING' as PermissionOperationStatus,
    priority: OPERATION_PRIORITIES[operationType] || 0,
    targetUserId,
    targetGroupId,
    objectId,
    objectType,
    permissionLevel,
    oldPermissionLevel,
    operationFingerprint: generateOperationFingerprint(
      operationType,
      targetUserId || null,
      targetGroupId || null,
      objectId,
      objectType,
      permissionLevel || null
    ),
    directPermissionId: directPermissionId || null,
    parentOperationId: parentOperationId || null,
  }
}

/**
 * Build operations for a new direct permission grant
 */
export function buildOperationsForDirectPermission(
  permission: Permission & {
    user?: { id: string } | null
    userGroup?: { id: number } | null
  },
  propagation: boolean = false
): Prisma.PendingPermissionOperationCreateManyInput[] {
  const operations: Prisma.PendingPermissionOperationCreateManyInput[] = []
  const { objectId, objectType } = getObjectFromPermission(permission)

  // Handle user group permissions (grants)
  if (permission.userGroup) {
    operations.push(
      buildOperation({
        operationType: 'EXPAND_GROUP_TO_USER_GRANT_OPERATIONS',
        targetGroupId: permission.userGroup.id,
        objectId,
        objectType,
        permissionLevel: permission.permissionLevel,
        directPermissionId: permission.id,
      })
    )
  }

  // Handle individual user permissions
  if (permission.user) {
    operations.push(
      buildOperation({
        operationType: OBJECT_TO_OPERATION_TYPE[objectType],
        targetUserId: permission.user.id,
        objectId,
        objectType,
        permissionLevel: permission.permissionLevel,
        directPermissionId: permission.id,
      })
    )
  }

  // If propagation is enabled and this is a course/activity, we would create child operations
  // For now, we log this requirement but don't implement the full propagation logic
  // The actual propagation would be handled during operation processing
  if (propagation && (objectType === 'COURSE' || objectType === 'LIVE_QUIZ' || 
      objectType === 'PRACTICE_QUIZ' || objectType === 'MICRO_LEARNING' || 
      objectType === 'GROUP_ACTIVITY')) {
    logOperation('info', 'Propagation requested but not implemented in simplified version', {
      objectType,
      objectId,
      propagation,
    })
  }

  return operations
}

/**
 * Build operations for permission level updates
 */
export function buildOperationsForPermissionUpdate(
  permission: Permission & {
    user?: { id: string } | null
    userGroup?: { id: number } | null
  },
  oldLevel: PermissionLevel,
  newLevel: PermissionLevel
): Prisma.PendingPermissionOperationCreateManyInput[] {
  const operations: Prisma.PendingPermissionOperationCreateManyInput[] = []
  const { objectId, objectType } = getObjectFromPermission(permission)

  // Handle individual user permission updates
  if (permission.user) {
    operations.push(
      buildOperation({
        operationType: 'UPDATE_PERMISSION_LEVEL',
        targetUserId: permission.user.id,
        objectId,
        objectType,
        permissionLevel: newLevel,
        oldPermissionLevel: oldLevel,
        directPermissionId: permission.id,
      })
    )
  }

  // Handle user group permission updates (requires expansion)
  if (permission.userGroup) {
    operations.push(
      buildOperation({
        operationType: 'EXPAND_GROUP_TO_USER_UPDATE_OPERATIONS',
        targetGroupId: permission.userGroup.id,
        objectId,
        objectType,
        permissionLevel: newLevel,
        oldPermissionLevel: oldLevel,
        directPermissionId: permission.id,
      })
    )
  }

  return operations
}

/**
 * Build operations for revoking permissions
 */
export function buildOperationsForPermissionRevoke(
  permission: Permission & {
    user?: { id: string } | null
    userGroup?: { id: number } | null
  }
): Prisma.PendingPermissionOperationCreateManyInput[] {
  const operations: Prisma.PendingPermissionOperationCreateManyInput[] = []
  const { objectId, objectType } = getObjectFromPermission(permission)

  // Handle individual user revocations
  if (permission.user) {
    operations.push(
      buildOperation({
        operationType: 'REVOKE_USER_PERMISSION',
        targetUserId: permission.user.id,
        objectId,
        objectType,
        oldPermissionLevel: permission.permissionLevel,
      })
    )
  }

  // Handle user group revocations (requires expansion)
  if (permission.userGroup) {
    operations.push(
      buildOperation({
        operationType: 'EXPAND_GROUP_TO_USER_REVOKE_OPERATIONS',
        targetGroupId: permission.userGroup.id,
        objectId,
        objectType,
        oldPermissionLevel: permission.permissionLevel,
        // No permissionLevel for revocations
        directPermissionId: permission.id,
      })
    )
  }

  return operations
}

// Type guards for operation types
export function isGroupExpansionOperation(operation: PendingPermissionOperation): boolean {
  return operation.operationType === 'EXPAND_GROUP_TO_USER_GRANT_OPERATIONS' ||
         operation.operationType === 'EXPAND_GROUP_TO_USER_UPDATE_OPERATIONS' ||
         operation.operationType === 'EXPAND_GROUP_TO_USER_REVOKE_OPERATIONS'
}

export function isUserAccessOperation(operation: PendingPermissionOperation): boolean {
  return operation.operationType.startsWith('PROCESS_USER_')
}

export function isPermissionUpdateOperation(operation: PendingPermissionOperation): boolean {
  return operation.operationType === 'UPDATE_PERMISSION_LEVEL'
}

export function isRevokeOperation(operation: PendingPermissionOperation): boolean {
  return operation.operationType === 'REVOKE_USER_PERMISSION'
}

export function isOperationComplete(operation: PendingPermissionOperation): boolean {
  return operation.status === 'COMPLETED' || operation.status === 'FAILED'
}

export function canRetryOperation(
  operation: PendingPermissionOperation,
  maxRetries: number = 3
): boolean {
  return operation.status === 'FAILED' && operation.retryCount < maxRetries
}