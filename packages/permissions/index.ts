// Define the types of resources that can have permissions
export enum ResourceType {
  ELEMENT = 'element',
  ACTIVITY = 'activity',
  USER_GROUP = 'user_group',
}

// Define the sharing modes for activities
export enum ShareMode {
  ACTIVITY_ONLY = 'activity_only',
  ACTIVITY_AND_ELEMENTS = 'activity_and_elements',
}

// Options for sharing an activity
export interface ShareActivityOptions {
  shareMode: ShareMode
  level: AccessLevel
  userId: string
  grantedBy: string
  reason?: string
}

// User group model
export interface UserGroup extends ResourceBase {
  type: ResourceType.USER_GROUP
  name: string
  description?: string
  ownerId: string
  isDeleted: boolean
  createdAt: Date
}

// Group membership record
export interface GroupMembership {
  id: string
  groupId: string
  userId: string
  addedBy: string
  addedAt: Date
}

// Define the access levels for resources
export enum AccessLevel {
  VIEWER = 'viewer', // Read-only access
  EDITOR = 'editor', // Can modify but not manage permissions
  ADMIN = 'admin', // Can modify and manage permissions
  OWNER = 'owner', // Full control with transfer rights
}

// Mapping of AccessLevel to human-readable names
export const AccessLevelNames = {
  [AccessLevel.VIEWER]: 'viewer',
  [AccessLevel.EDITOR]: 'editor',
  [AccessLevel.ADMIN]: 'admin',
  [AccessLevel.OWNER]: 'owner',
}

// Base interface for resources
interface ResourceBase {
  id: string
  ownerId: string
  createdAt: Date
  type: ResourceType
  isDeleted?: boolean // Flag for soft deletion
}

// Element resource
export interface Element extends ResourceBase {
  type: ResourceType.ELEMENT
  name: string
  content: string
  explanation?: string
  // Additional element-specific fields can be added as needed
}

// Activity resource
export interface Activity extends ResourceBase {
  type: ResourceType.ACTIVITY
  activityType: ActivityType
  name: string
  displayName: string
  description?: string
  elementIds: string[] // IDs of elements included in this activity
  // Additional activity-specific fields can be added as needed
}

// Define the types of activities
export enum ActivityType {
  PRACTICE_QUIZ = 'practiceQuiz',
  LIVE_QUIZ = 'liveQuiz',
  MICROLEARNING = 'microlearning',
  GROUP_ACTIVITY = 'groupActivity',
}

// Permission scope defines where a permission is applicable
export enum PermissionScope {
  // Permission applies everywhere
  GLOBAL = 'global',
  // Permission only applies within the context of an activity
  ACTIVITY_ONLY = 'activity_only',
}

// Permission grant record
export interface PermissionGrant {
  id: string
  resourceId: string
  resourceType: ResourceType
  userId: string
  level: AccessLevel
  grantedBy: string // ID of the user who granted this permission
  grantedAt: Date
  // The scope limits where this permission is applicable
  scope?: PermissionScope
  // If this is a derived permission, this tracks the source
  derivedFrom?: {
    resourceId: string
    resourceType: ResourceType
  }
}

// Mock data for elements
export const mockElements: Element[] = [
  {
    id: 'elem-1',
    ownerId: 'user-1',
    createdAt: new Date('2025-01-15'),
    type: ResourceType.ELEMENT,
    name: 'Multiple Choice Question about TypeScript',
    content: 'What is TypeScript?',
    explanation:
      'TypeScript is a superset of JavaScript that adds static typing.',
  },
  {
    id: 'elem-2',
    ownerId: 'user-1',
    createdAt: new Date('2025-01-20'),
    type: ResourceType.ELEMENT,
    name: 'Free Text Question about React',
    content: 'Explain the concept of React hooks.',
  },
  {
    id: 'elem-3',
    ownerId: 'user-2',
    createdAt: new Date('2025-01-25'),
    type: ResourceType.ELEMENT,
    name: 'Numerical Question about Algorithms',
    content: 'What is the time complexity of quicksort in the worst case?',
  },
  {
    id: 'elem-4',
    ownerId: 'user-3',
    createdAt: new Date('2025-02-01'),
    type: ResourceType.ELEMENT,
    name: 'Content Slide about Database Design',
    content: 'Introduction to relational database design principles.',
  },
]

// Mock data for activities
export const mockActivities: Activity[] = [
  {
    id: 'act-1',
    ownerId: 'user-1',
    createdAt: new Date('2025-01-30'),
    type: ResourceType.ACTIVITY,
    activityType: ActivityType.PRACTICE_QUIZ,
    name: 'programming-basics',
    displayName: 'Programming Basics Quiz',
    description: 'A quiz covering basic programming concepts',
    elementIds: ['elem-1', 'elem-2'],
  },
  {
    id: 'act-2',
    ownerId: 'user-2',
    createdAt: new Date('2025-02-05'),
    type: ResourceType.ACTIVITY,
    activityType: ActivityType.LIVE_QUIZ,
    name: 'algorithms-live',
    displayName: 'Algorithms Live Session',
    elementIds: ['elem-3'],
  },
  {
    id: 'act-3',
    ownerId: 'user-3',
    createdAt: new Date('2025-02-10'),
    type: ResourceType.ACTIVITY,
    activityType: ActivityType.GROUP_ACTIVITY,
    name: 'database-workshop',
    displayName: 'Database Design Workshop',
    description: 'Collaborative workshop on database design',
    elementIds: ['elem-4', 'elem-3'],
  },
]

// Mock data for user groups
export const mockUserGroups: UserGroup[] = [
  {
    id: 'group-1',
    name: 'Teaching Assistants',
    description: 'TAs for Programming 101',
    ownerId: 'user-1',
    isDeleted: false,
    createdAt: new Date(),
    type: ResourceType.USER_GROUP,
  },
  {
    id: 'group-2',
    name: 'Course Instructors',
    description: 'Senior instructors with full access',
    ownerId: 'user-1',
    isDeleted: false,
    createdAt: new Date(),
    type: ResourceType.USER_GROUP,
  },
]

// Mock data for users
export const mockUsers = [
  { id: 'user-1', name: 'User 1' },
  { id: 'user-2', name: 'User 2' },
  { id: 'user-3', name: 'User 3' },
]

// Mock data for group memberships
export const mockGroupMemberships: GroupMembership[] = [
  {
    id: 'membership-1',
    groupId: 'group-1',
    userId: 'user-2',
    addedBy: 'user-1',
    addedAt: new Date(),
  },
  {
    id: 'membership-2',
    groupId: 'group-1',
    userId: 'user-3',
    addedBy: 'user-1',
    addedAt: new Date(),
  },
  {
    id: 'membership-3',
    groupId: 'group-2',
    userId: 'user-2',
    addedBy: 'user-1',
    addedAt: new Date(),
  },
]

// Mock permission grants
export const mockPermissionGrants: PermissionGrant[] = [
  // Direct element permissions
  {
    id: 'perm-1',
    resourceId: 'elem-1',
    resourceType: ResourceType.ELEMENT,
    userId: 'user-2',
    level: AccessLevel.VIEWER,
    grantedBy: 'user-1',
    grantedAt: new Date('2025-01-16'),
  },
  {
    id: 'perm-2',
    resourceId: 'elem-2',
    resourceType: ResourceType.ELEMENT,
    userId: 'user-3',
    level: AccessLevel.EDITOR,
    grantedBy: 'user-1',
    grantedAt: new Date('2025-01-21'),
  },

  // Direct activity permissions
  {
    id: 'perm-3',
    resourceId: 'act-1',
    resourceType: ResourceType.ACTIVITY,
    userId: 'user-2',
    level: AccessLevel.ADMIN,
    grantedBy: 'user-1',
    grantedAt: new Date('2025-01-31'),
  },
  {
    id: 'perm-4',
    resourceId: 'act-2',
    resourceType: ResourceType.ACTIVITY,
    userId: 'user-1',
    level: AccessLevel.VIEWER,
    grantedBy: 'user-2',
    grantedAt: new Date('2025-02-06'),
  },
  {
    id: 'perm-5',
    resourceId: 'act-3',
    resourceType: ResourceType.ACTIVITY,
    userId: 'user-2',
    level: AccessLevel.EDITOR,
    grantedBy: 'user-3',
    grantedAt: new Date('2025-02-11'),
  },
  {
    id: 'perm-6',
    resourceId: 'elem-3',
    resourceType: ResourceType.ELEMENT,
    userId: 'user-1',
    level: AccessLevel.EDITOR,
    grantedBy: 'user-2',
    grantedAt: new Date('2025-02-12'),
  },
  {
    id: 'perm-7',
    resourceId: 'elem-4',
    resourceType: ResourceType.ELEMENT,
    userId: 'user-3',
    level: AccessLevel.ADMIN,
    grantedBy: 'user-3',
    grantedAt: new Date('2025-02-13'),
  },
  {
    id: 'perm-8',
    resourceId: 'elem-clone-elem-2-act-1',
    resourceType: ResourceType.ELEMENT,
    userId: 'user-2',
    level: AccessLevel.EDITOR,
    grantedBy: 'user-1',
    grantedAt: new Date(),
  },

  // Group permissions
  {
    id: 'perm-g1',
    resourceId: 'elem-4',
    resourceType: ResourceType.ELEMENT,
    userId: 'group-1', // Permission granted to the group
    level: AccessLevel.EDITOR,
    grantedBy: 'user-1',
    grantedAt: new Date(),
  },
  {
    id: 'perm-g2',
    resourceId: 'act-3',
    resourceType: ResourceType.ACTIVITY,
    userId: 'group-1', // Permission granted to the group
    level: AccessLevel.VIEWER,
    grantedBy: 'user-1',
    grantedAt: new Date(),
  },
  {
    id: 'perm-g3',
    resourceId: 'elem-3',
    resourceType: ResourceType.ELEMENT,
    userId: 'group-2', // Permission granted to the group
    level: AccessLevel.ADMIN,
    grantedBy: 'user-1',
    grantedAt: new Date(),
  },
]

// Define the types of audit log actions
export enum AuditActionType {
  PERMISSION_GRANT = 'permission_grant',
  PERMISSION_REVOKE = 'permission_revoke',
  OWNERSHIP_TRANSFER = 'ownership_transfer',
  GROUP_MEMBER_ADD = 'group_member_add',
  GROUP_MEMBER_REMOVE = 'group_member_remove',
  ELEMENT_DELETE = 'element_delete',
  ELEMENT_SOFT_DELETE = 'element_soft_delete',
  ACTIVITY_SHARE = 'activity_share',
}

// Audit log entry interface
export interface AuditLogEntry {
  id: string
  timestamp: Date
  actionType: AuditActionType
  performedBy: string // User ID who performed the action
  resourceId: string
  resourceType: ResourceType
  details: {
    // For permission changes
    permissionBefore?: AccessLevel | null
    permissionAfter?: AccessLevel | null
    targetUserId?: string // The user whose permission changed

    // For group membership changes
    groupId?: string
    memberId?: string

    // For ownership transfers
    previousOwnerId?: string
    newOwnerId?: string

    // Additional context
    reason?: string
    metadata?: Record<string, any>
  }
}

// Mock storage for audit logs
export const mockAuditLogs: AuditLogEntry[] = []

// Generate a unique ID for audit log entries
export function generateAuditLogId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// Core audit logging function
export function logAuditEvent({
  actionType,
  userId,
  resourceId,
  resourceType,
  details,
}: {
  actionType: AuditActionType
  userId: string
  resourceId: string
  resourceType: ResourceType
  details: AuditLogEntry['details']
}): AuditLogEntry {
  const logEntry: AuditLogEntry = {
    id: generateAuditLogId(),
    timestamp: new Date(),
    actionType,
    performedBy: userId,
    resourceId,
    resourceType,
    details,
  }

  mockAuditLogs.push(logEntry)
  return logEntry
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

/**
 * Get a resource by its ID
 * @param resourceId The ID of the resource to retrieve
 * @returns The resource or undefined if not found
 */
export function getResourceById(
  resourceId: string
): Element | Activity | UserGroup | undefined {
  // First check elements
  const element = mockElements.find((elem) => elem.id === resourceId)
  if (element) return element

  // Then check activities
  const activity = mockActivities.find((act) => act.id === resourceId)
  if (activity) return activity

  // Then check user groups
  return mockUserGroups.find((group) => group.id === resourceId)
}

/**
 * Get direct permission grants for a user on a specific resource
 * @param resourceId The ID of the resource
 * @param userId The ID of the user
 * @returns The permission grant or undefined if none exists
 */
export function getDirectPermission(
  resourceId: string,
  userId: string
): PermissionGrant | undefined {
  return mockPermissionGrants.find(
    (grant) => grant.resourceId === resourceId && grant.userId === userId
  )
}

/**
 * Check if a user is the owner of a resource
 * @param resourceId The ID of the resource
 * @param userId The ID of the user
 * @returns True if the user is the owner, false otherwise
 */
export function isResourceOwner(resourceId: string, userId: string): boolean {
  const resource = getResourceById(resourceId)
  return resource ? resource.ownerId === userId : false
}

/**
 * Calculate the effective access level for a user on a resource
 * @param resourceId The ID of the resource
 * @param userId The ID of the user
 * @param context Optional context in which the permission is being checked
 * @returns The effective access level or null if no access
 */
export function calculateEffectivePermission(
  resourceId: string,
  userId: string,
  context?: {
    // If checking in the context of an activity, specify the activity ID
    activityId?: string
    // Whether to skip checking group permissions (to avoid infinite recursion)
    skipGroupCheck?: boolean
  }
): AccessLevel | null {
  // Check if user is the owner (highest permission)
  if (isResourceOwner(resourceId, userId)) {
    return AccessLevel.OWNER
  }

  // Check for direct permission first
  const directPermission = getDirectPermission(resourceId, userId)
  if (directPermission) {
    // If the permission is scoped to an activity, check if we're in that context
    if (directPermission.scope === PermissionScope.ACTIVITY_ONLY) {
      // If we're checking in an activity context and it matches the derived source, allow it
      if (
        context?.activityId &&
        directPermission.derivedFrom?.resourceId === context.activityId
      ) {
        return directPermission.level
      }
      // Otherwise, this permission doesn't apply outside its activity context
      return null
    }
    // For global permissions, always apply them
    return directPermission.level
  }

  // Check for group-derived permissions if not skipping group check
  if (!context?.skipGroupCheck) {
    // Get all groups the user is a member of
    const userGroups = getUserGroups(userId)

    // Check each group's permission on this resource
    let highestGroupPermission: AccessLevel | null = null

    for (const groupId of userGroups) {
      // Get the group's permission on this resource
      // We pass skipGroupCheck=true to avoid infinite recursion
      const groupPermission = calculateEffectivePermission(
        resourceId,
        groupId,
        { ...context, skipGroupCheck: true }
      )

      // If the group has permission, check if it's higher than what we've found so far
      if (
        groupPermission &&
        (!highestGroupPermission || groupPermission > highestGroupPermission)
      ) {
        highestGroupPermission = groupPermission
      }
    }

    // If we found any group-derived permission, return it
    if (highestGroupPermission) {
      return highestGroupPermission
    }
  }

  // Get the resource
  const resource = getResourceById(resourceId)
  if (!resource) return null

  // For elements, check if they are in activities the user has access to
  if (resource.type === ResourceType.ELEMENT) {
    // Find activities that contain this element
    const containingActivities = mockActivities.filter((activity) =>
      activity.elementIds.includes(resourceId)
    )

    // Check if user has access to any of these activities
    let highestDerivedLevel: AccessLevel | null = null

    for (const activity of containingActivities) {
      const activityPermission = calculateEffectivePermission(
        activity.id,
        userId,
        { activityId: activity.id }
      )

      // If user has access to the activity, they get derived access to the element
      if (activityPermission) {
        // The derived permission level depends on the activity permission level
        let derivedLevel: AccessLevel

        // Map activity permission to element permission
        // OWNER/ADMIN of activity -> EDITOR of element
        // EDITOR/VIEWER of activity -> VIEWER of element
        if (
          activityPermission === AccessLevel.OWNER ||
          activityPermission === AccessLevel.ADMIN
        ) {
          derivedLevel = AccessLevel.EDITOR
        } else {
          derivedLevel = AccessLevel.VIEWER
        }

        // Keep track of the highest derived level
        if (!highestDerivedLevel || derivedLevel > highestDerivedLevel) {
          highestDerivedLevel = derivedLevel
        }
      }
    }

    if (highestDerivedLevel) {
      return highestDerivedLevel
    }
  }

  // No direct, group-derived, or activity-derived permission found
  return null
}

/**
 * Get a numeric rank for permission levels to compare them
 * @param level The access level
 * @returns A numeric rank (higher means more permissions)
 */
export function getPermissionRank(level: AccessLevel): number {
  switch (level) {
    case AccessLevel.OWNER:
      return 4
    case AccessLevel.ADMIN:
      return 3
    case AccessLevel.EDITOR:
      return 2
    case AccessLevel.VIEWER:
      return 1
    default:
      return 0
  }
}

/**
 * Calculate all derived permissions for a user
 * @param userId The ID of the user
 * @returns A map of resource IDs to their effective access levels
 */
export function calculateAllDerivedPermissions(
  userId: string
): Map<string, AccessLevel> {
  const permissionMap = new Map<string, AccessLevel>()

  // Check all elements
  for (const element of mockElements) {
    const permission = calculateEffectivePermission(element.id, userId)
    if (permission) {
      permissionMap.set(element.id, permission)
    }
  }

  // Check all activities
  for (const activity of mockActivities) {
    const permission = calculateEffectivePermission(activity.id, userId)
    if (permission) {
      permissionMap.set(activity.id, permission)
    }
  }

  // Check all user groups
  for (const group of mockUserGroups) {
    const permission = calculateEffectivePermission(group.id, userId)
    if (permission) {
      permissionMap.set(group.id, permission)
    }
  }

  return permissionMap
}

/**
 * Grant a permission to a user for a resource
 * @param resourceId The ID of the resource
 * @param userId The ID of the user receiving the permission
 * @param level The access level to grant
 * @param grantedBy The ID of the user granting the permission
 * @returns The new permission grant or null if the operation failed
 */
export function grantPermission(
  resourceId: string,
  userId: string,
  level: AccessLevel,
  grantedBy: string
): PermissionGrant | null {
  // Check if the granting user has sufficient permissions
  const granterPermission = calculateEffectivePermission(resourceId, grantedBy)

  // Only OWNER and ADMIN can grant permissions
  if (
    granterPermission !== AccessLevel.OWNER &&
    granterPermission !== AccessLevel.ADMIN
  ) {
    console.error('Insufficient permissions to grant access')
    return null
  }

  // ADMIN cannot grant OWNER level
  if (granterPermission === AccessLevel.ADMIN && level === AccessLevel.OWNER) {
    console.error('ADMIN cannot grant OWNER level permissions')
    return null
  }

  // Check if a permission already exists
  const existingGrant = getDirectPermission(resourceId, userId)
  if (existingGrant) {
    // Update existing grant
    existingGrant.level = level
    existingGrant.grantedBy = grantedBy
    existingGrant.grantedAt = new Date()
    logAuditEvent({
      actionType: AuditActionType.PERMISSION_GRANT,
      userId: grantedBy,
      resourceId: resourceId,
      resourceType: getResourceById(resourceId)?.type || ResourceType.ELEMENT,
      details: {
        targetUserId: userId,
        permissionBefore: existingGrant.level,
        permissionAfter: level,
      },
    })
    return existingGrant
  }

  // Create a new permission grant
  const resource = getResourceById(resourceId)
  if (!resource) {
    console.error('Resource not found')
    return null
  }

  const newGrant: PermissionGrant = {
    id: `perm-${mockPermissionGrants.length + 1}`,
    resourceId,
    resourceType: resource.type,
    userId,
    level,
    grantedBy,
    grantedAt: new Date(),
  }

  // Add to mock data
  mockPermissionGrants.push(newGrant)
  logAuditEvent({
    actionType: AuditActionType.PERMISSION_GRANT,
    userId: grantedBy,
    resourceId: resourceId,
    resourceType: getResourceById(resourceId)?.type || ResourceType.ELEMENT,
    details: {
      targetUserId: userId,
      permissionAfter: level,
    },
  })
  return newGrant
}

/**
 * Revoke a permission from a user for a resource
 * @param resourceId The ID of the resource
 * @param userId The ID of the user losing the permission
 * @param revokedBy The ID of the user revoking the permission
 * @returns True if successful, false otherwise
 */
export function revokePermission(
  resourceId: string,
  userId: string,
  revokedBy: string
): boolean {
  // Check if the revoking user has sufficient permissions
  const revokerPermission = calculateEffectivePermission(resourceId, revokedBy)

  // Only OWNER and ADMIN can revoke permissions
  if (
    revokerPermission !== AccessLevel.OWNER &&
    revokerPermission !== AccessLevel.ADMIN
  ) {
    console.error('Insufficient permissions to revoke access')
    return false
  }

  // Find the index of the permission to revoke
  const grantIndex = mockPermissionGrants.findIndex(
    (grant) => grant.resourceId === resourceId && grant.userId === userId
  )

  if (grantIndex === -1) {
    console.error('Permission not found')
    return false
  }

  // Cannot revoke OWNER permissions unless you are the OWNER
  if (
    mockPermissionGrants[grantIndex].level === AccessLevel.OWNER &&
    revokerPermission !== AccessLevel.OWNER
  ) {
    console.error('Only the OWNER can revoke OWNER permissions')
    return false
  }

  // Remove the permission grant
  const removedGrant = mockPermissionGrants.splice(grantIndex, 1)[0]
  logAuditEvent({
    actionType: AuditActionType.PERMISSION_REVOKE,
    userId: revokedBy,
    resourceId: resourceId,
    resourceType: getResourceById(resourceId)?.type || ResourceType.ELEMENT,
    details: {
      targetUserId: userId,
      permissionBefore: removedGrant.level,
    },
  })
  return true
}

/**
 * Transfer ownership of a resource to another user
 * @param resourceId The ID of the resource
 * @param newOwnerId The ID of the new owner
 * @param currentOwnerId The ID of the current owner
 * @returns True if successful, false otherwise
 */
export function transferOwnership(
  resourceId: string,
  newOwnerId: string,
  currentOwnerId: string
): boolean {
  // Verify the current owner
  const resource = getResourceById(resourceId)
  if (!resource) {
    console.error('Resource not found')
    return false
  }

  if (resource.ownerId !== currentOwnerId) {
    console.error('Only the current owner can transfer ownership')
    return false
  }

  // Update the resource owner
  resource.ownerId = newOwnerId

  // Remove any existing OWNER permissions for the new owner
  const existingOwnerGrant = mockPermissionGrants.findIndex(
    (grant) =>
      grant.resourceId === resourceId &&
      grant.userId === newOwnerId &&
      grant.level === AccessLevel.OWNER
  )

  if (existingOwnerGrant !== -1) {
    mockPermissionGrants.splice(existingOwnerGrant, 1)
  }

  // Grant the previous owner ADMIN permissions
  grantPermission(resourceId, currentOwnerId, AccessLevel.ADMIN, newOwnerId)

  logAuditEvent({
    actionType: AuditActionType.OWNERSHIP_TRANSFER,
    userId: newOwnerId,
    resourceId: resourceId,
    resourceType: getResourceById(resourceId)?.type || ResourceType.ELEMENT,
    details: {
      previousOwnerId: currentOwnerId,
      newOwnerId,
    },
  })
  return true
}

/**
 * Check if a user can perform a specific operation on a resource
 * @param resourceId The ID of the resource
 * @param userId The ID of the user
 * @param requiredLevel The minimum access level required
 * @returns True if the user has sufficient permissions, false otherwise
 */
export function canPerformOperation(
  resourceId: string,
  userId: string,
  requiredLevel: AccessLevel
): boolean {
  const effectivePermission = calculateEffectivePermission(resourceId, userId)

  if (!effectivePermission) return false

  return (
    getPermissionRank(effectivePermission) >= getPermissionRank(requiredLevel)
  )
}

/**
 * Check if an element can be deleted
 * @param elementId The ID of the element
 * @param userId The ID of the user attempting to delete
 * @returns An object with a boolean indicating if deletion is allowed and a reason if not
 */
export function canDeleteElement(
  elementId: string,
  userId: string
): { allowed: boolean; reason?: string } {
  // Check if user has permission to delete
  if (!canPerformOperation(elementId, userId, AccessLevel.ADMIN)) {
    return {
      allowed: false,
      reason: 'Insufficient permissions to delete this element',
    }
  }

  // Check if the element is used in any activities
  const element = mockElements.find((elem) => elem.id === elementId)
  if (!element) {
    return { allowed: false, reason: 'Element not found' }
  }

  // Find activities that contain this element
  const containingActivities = mockActivities.filter((activity) =>
    activity.elementIds.includes(elementId)
  )

  if (containingActivities.length > 0) {
    // Element is used in activities, cannot be hard deleted
    return {
      allowed: false,
      reason: `Element is used in ${containingActivities.length} activities. Use softDeleteElement() or cloneElementForActivities() instead of direct deletion.`,
    }
  }

  // Element is not used in any activities, safe to delete
  return { allowed: true }
}

/**
 * Soft delete an element by marking it as deleted
 * @param elementId The ID of the element to soft delete
 * @param userId The ID of the user attempting the deletion
 * @returns An object with success status and message
 */
export function softDeleteElement(
  elementId: string,
  userId: string
): { success: boolean; message: string } {
  // Check if user has permission to delete
  if (!canPerformOperation(elementId, userId, AccessLevel.ADMIN)) {
    return {
      success: false,
      message: 'Insufficient permissions to delete this element',
    }
  }

  // Find the element
  const element = mockElements.find((elem) => elem.id === elementId)
  if (!element) {
    return { success: false, message: 'Element not found' }
  }

  // Mark the element as deleted
  element.isDeleted = true

  logAuditEvent({
    actionType: AuditActionType.ELEMENT_SOFT_DELETE,
    userId: userId,
    resourceId: elementId,
    resourceType: ResourceType.ELEMENT,
    details: {},
  })
  return {
    success: true,
    message: `Element "${element.name}" has been marked as deleted but is still available to activities that use it.`,
  }
}

/**
 * Clone an element for each activity that uses it, then delete the original
 * @param elementId The ID of the element to clone and delete
 * @param userId The ID of the user attempting the operation
 * @returns An object with success status, message, and cloned element IDs
 */
export function cloneElementForActivities(
  elementId: string,
  userId: string
): {
  success: boolean
  message: string
  clonedElementIds?: Record<string, string>
} {
  // Check if user has permission
  if (!canPerformOperation(elementId, userId, AccessLevel.ADMIN)) {
    return {
      success: false,
      message: 'Insufficient permissions to perform this operation',
    }
  }

  // Find the element
  const element = mockElements.find((elem) => elem.id === elementId)
  if (!element) {
    return { success: false, message: 'Element not found' }
  }

  // Find activities that contain this element
  const containingActivities = mockActivities.filter((activity) =>
    activity.elementIds.includes(elementId)
  )

  if (containingActivities.length === 0) {
    return {
      success: false,
      message:
        'Element is not used in any activities, use regular deletion instead',
    }
  }

  // Create clones for each activity
  const clonedElementIds: Record<string, string> = {}

  containingActivities.forEach((activity) => {
    // Create a clone of the element with a reference to the original
    const clonedElement: Element = {
      ...element,
      id: `elem-clone-${element.id}-${activity.id}`,
      createdAt: new Date(),
      name: `${element.name} (Clone for ${activity.displayName})`,
    }

    // Add the cloned element to the mock data
    mockElements.push(clonedElement)

    // Store the mapping of activity ID to cloned element ID
    clonedElementIds[activity.id] = clonedElement.id

    // Update the activity to use the cloned element instead of the original
    const activityIndex = mockActivities.findIndex((a) => a.id === activity.id)
    if (activityIndex !== -1) {
      mockActivities[activityIndex].elementIds = mockActivities[
        activityIndex
      ].elementIds.map((id) => (id === elementId ? clonedElement.id : id))
    }
  })

  // Now that all activities use clones, we can safely delete the original
  const elementIndex = mockElements.findIndex((e) => e.id === elementId)
  if (elementIndex !== -1) {
    mockElements.splice(elementIndex, 1)
  }

  logAuditEvent({
    actionType: AuditActionType.ELEMENT_DELETE,
    userId: userId,
    resourceId: elementId,
    resourceType: ResourceType.ELEMENT,
    details: {},
  })
  return {
    success: true,
    message: `Element "${element.name}" has been cloned for ${containingActivities.length} activities and the original has been deleted.`,
    clonedElementIds,
  }
}

/**
 * Compute a complete permission table for all users and resources
 * This can be used to cache permissions for quick lookup
 * @returns A nested map: Map<userId, Map<resourceId, AccessLevel>>
 */
export function computeCompletePermissionTable(): Map<
  string,
  Map<string, AccessLevel>
> {
  const permissionTable = new Map<string, Map<string, AccessLevel>>()

  // Get all unique user IDs from elements, activities, and permission grants
  const userIds = new Set<string>()

  // Add owners of resources
  mockElements.forEach((elem) => userIds.add(elem.ownerId))
  mockActivities.forEach((act) => userIds.add(act.ownerId))
  mockUserGroups.forEach((group) => userIds.add(group.ownerId))

  // Add users with explicit permission grants
  mockPermissionGrants.forEach((grant) => userIds.add(grant.userId))

  // For each user, calculate their permissions on all resources
  userIds.forEach((userId) => {
    const userPermissions = calculateAllDerivedPermissions(userId)
    permissionTable.set(userId, userPermissions)
  })

  return permissionTable
}

/**
 * Convert the permission table to a serializable format for caching
 * @param permissionTable The permission table to serialize
 * @returns A serializable object representation of the permission table
 */
export function serializePermissionTable(
  permissionTable: Map<string, Map<string, AccessLevel>>
): Record<string, Record<string, string>> {
  const serialized: Record<string, Record<string, string>> = {}

  permissionTable.forEach((resourceMap, userId) => {
    serialized[userId] = {}
    resourceMap.forEach((level, resourceId) => {
      serialized[userId][resourceId] = AccessLevelNames[level]
    })
  })

  return serialized
}

/**
 * Deserialize a permission table from its serialized format
 * @param serialized The serialized permission table
 * @returns The reconstructed permission table as a nested Map
 */
export function deserializePermissionTable(
  serialized: Record<string, Record<string, string>>
): Map<string, Map<string, AccessLevel>> {
  const permissionTable = new Map<string, Map<string, AccessLevel>>()

  Object.entries(serialized).forEach(([userId, resources]) => {
    const resourceMap = new Map<string, AccessLevel>()

    Object.entries(resources).forEach(([resourceId, accessLevel]) => {
      resourceMap.set(resourceId, accessLevel as AccessLevel)
    })

    permissionTable.set(userId, resourceMap)
  })

  return permissionTable
}

/**
 * Get the effective permission for a user on a resource from the cached permission table
 * @param permissionTable The cached permission table
 * @param userId The ID of the user
 * @param resourceId The ID of the resource
 * @returns The effective access level or null if no access
 */
export function getPermissionFromTable(
  permissionTable: Map<string, Map<string, AccessLevel>>,
  userId: string,
  resourceId: string
): AccessLevel | null {
  const userPermissions = permissionTable.get(userId)
  if (!userPermissions) return null

  return userPermissions.get(resourceId) || null
}

/**
 * Get all elements contained in an activity
 * @param activityId The ID of the activity
 * @returns Array of element IDs contained in the activity
 */
export function getActivityElements(activityId: string): string[] {
  const activity = mockActivities.find((act) => act.id === activityId)
  if (!activity) {
    return []
  }
  return activity.elementIds
}

/**
 * Get all activities that contain a specific element
 * @param elementId The ID of the element
 * @returns Array of activity IDs that contain the element
 */
export function getElementActivities(elementId: string): string[] {
  return mockActivities
    .filter((activity) => activity.elementIds.includes(elementId))
    .map((activity) => activity.id)
}

/**
 * Propagate permissions from an activity to all its elements
 * @param activityId The ID of the activity
 * @param userId The ID of the user or group to grant permissions to
 * @param options Options for permission propagation
 * @returns Array of created permission grants
 */
export function propagateActivityPermissionsToElements(
  activityId: string,
  userId: string,
  options?: {
    // Whether to use activity-scoped permissions (default: global)
    scope?: PermissionScope
    // Whether this is a group permission (default: false)
    isGroupPermission?: boolean
  }
): PermissionGrant[] {
  const activity = mockActivities.find((act) => act.id === activityId)
  if (!activity) {
    return []
  }

  // Get the user's or group's permission on the activity
  const activityPermission = getDirectPermission(activityId, userId)
  if (!activityPermission) {
    return []
  }

  // Determine the permission level to grant on elements
  // Usually, we grant READ access to elements when a user has access to an activity
  const elementPermissionLevel = AccessLevel.VIEWER

  // Create a permission grant for each element in the activity
  const newGrants: PermissionGrant[] = []

  for (const elementId of activity.elementIds) {
    // Skip if the user already has direct permission on this element
    if (getDirectPermission(elementId, userId)) {
      continue
    }

    // Create a new permission grant
    const newGrant: PermissionGrant = {
      id: `perm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      resourceId: elementId,
      resourceType: ResourceType.ELEMENT,
      userId,
      level: elementPermissionLevel,
      grantedBy: activityPermission.grantedBy,
      grantedAt: new Date(),
      // If specified, set the permission scope
      scope: options?.scope || PermissionScope.GLOBAL,
      // Track that this permission is derived from the activity
      derivedFrom: {
        resourceId: activityId,
        resourceType: ResourceType.ACTIVITY,
      },
    }

    // Add to our mock data
    mockPermissionGrants.push(newGrant)
    newGrants.push(newGrant)

    // If this is a group permission, we don't need to propagate to group members
    // as they'll inherit the permission through the group
  }

  return newGrants
}

/**
 * Check if a user can access all elements in an activity
 * @param activityId The ID of the activity
 * @param userId The ID of the user
 * @returns True if user has at least READ access to all elements, false otherwise
 */
export function canAccessAllActivityElements(
  activityId: string,
  userId: string
): boolean {
  const elementIds = getActivityElements(activityId)

  for (const elementId of elementIds) {
    const permission = calculateEffectivePermission(elementId, userId)
    if (!permission || permission < AccessLevel.VIEWER) {
      return false
    }
  }

  return true
}

/**
 * Enhanced permission granting that handles propagation to related resources
 * For example, when granting access to an activity, also grant READ access to all elements in that activity
 * @param resourceId The ID of the resource to grant permission on
 * @param userId The ID of the user or group to grant permission to
 * @param level The access level to grant
 * @param grantedBy The ID of the user granting the permission
 * @param options Additional options for permission granting
 * @returns Result object with success status and message
 */
export function grantPermissionWithPropagation(
  resourceId: string,
  userId: string,
  level: AccessLevel,
  grantedBy: string,
  options: {
    // For activities, specify how element permissions should be scoped
    elementScope?: PermissionScope
    // Whether this is a group permission
    isGroupPermission?: boolean
  } = {}
): {
  success: boolean
  message: string
  propagatedGrants?: PermissionGrant[]
} {
  // First, grant the direct permission
  const grantResult = grantPermission(resourceId, userId, level, grantedBy)

  if (!grantResult.success) {
    return grantResult
  }

  // Track any propagated permissions
  const propagatedGrants: PermissionGrant[] = []

  // Check if this is an activity, and propagate to elements if needed
  const resource = getResourceById(resourceId)
  if (resource && resource.type === ResourceType.ACTIVITY) {
    // Use the specified element scope or default to GLOBAL
    const elementScope = options.elementScope || PermissionScope.GLOBAL
    const elementGrants = propagateActivityPermissionsToElements(
      resourceId,
      userId,
      {
        scope: elementScope,
        isGroupPermission: options.isGroupPermission,
      }
    )
    propagatedGrants.push(...elementGrants)

    return {
      success: true,
      message: `Permission granted with ${elementGrants.length} propagated element permissions`,
      propagatedGrants,
    }
  }

  return {
    success: true,
    message: 'Permission granted successfully',
    propagatedGrants,
  }
}

/**
 * Share an activity with a user, with control over how element permissions are handled
 * @param activityId The ID of the activity to share
 * @param options Options for sharing the activity
 * @returns Result object with success status, message, and created permissions
 */
export function shareActivity(
  activityId: string,
  options: ShareActivityOptions
): {
  success: boolean
  message: string
  activityPermission?: PermissionGrant
  elementPermissions?: PermissionGrant[]
} {
  // Verify the activity exists
  const activity = mockActivities.find((act) => act.id === activityId)
  if (!activity) {
    return {
      success: false,
      message: `Activity with ID ${activityId} not found`,
    }
  }

  // Verify the user exists
  const user = mockUsers.find((u) => u.id === options.userId)
  if (!user) {
    return {
      success: false,
      message: `User with ID ${options.userId} not found`,
    }
  }

  // Check if the granting user has sufficient permissions
  const granterPermission = calculateEffectivePermission(
    activityId,
    options.grantedBy
  )
  if (
    !granterPermission ||
    (granterPermission !== AccessLevel.OWNER &&
      granterPermission !== AccessLevel.ADMIN)
  ) {
    return {
      success: false,
      message: `User ${options.grantedBy} does not have sufficient permissions to share this activity`,
    }
  }

  // First, grant permission to the activity
  const grantResult = grantPermission(
    activityId,
    options.userId,
    options.level,
    options.grantedBy
  )

  if (!grantResult) {
    return {
      success: false,
      message: 'Failed to grant permission to the activity',
    }
  }

  // Log the activity sharing action
  logAuditEvent({
    actionType: AuditActionType.ACTIVITY_SHARE,
    userId: options.grantedBy,
    resourceId: activityId,
    resourceType: ResourceType.ACTIVITY,
    details: {
      targetUserId: options.userId,
      shareMode: options.shareMode,
      accessLevel: options.level,
      reason: options.reason || 'No reason provided',
    },
  })

  // Handle element permissions based on the sharing mode
  let elementPermissions: PermissionGrant[] = []

  if (options.shareMode === ShareMode.ACTIVITY_ONLY) {
    // For ACTIVITY_ONLY mode, propagate with activity-scoped permissions
    elementPermissions = propagateActivityPermissionsToElements(
      activityId,
      options.userId,
      {
        scope: PermissionScope.ACTIVITY_ONLY,
      }
    )

    return {
      success: true,
      message: `Activity shared with activity-scoped element permissions. ${elementPermissions.length} element permissions created.`,
      activityPermission: grantResult,
      elementPermissions,
    }
  } else {
    // For ACTIVITY_AND_ELEMENTS mode, propagate with global permissions
    elementPermissions = propagateActivityPermissionsToElements(
      activityId,
      options.userId,
      {
        scope: PermissionScope.GLOBAL,
      }
    )

    return {
      success: true,
      message: `Activity shared with global element permissions. ${elementPermissions.length} element permissions created.`,
      activityPermission: grantResult,
      elementPermissions,
    }
  }
}

/**
 * Check if a user can edit an activity and all its elements
 * @param activityId The ID of the activity
 * @param userId The ID of the user
 * @returns Object with overall result and details about any missing permissions
 */
export function canEditActivityWithElements(
  activityId: string,
  userId: string
): {
  canEdit: boolean
  activityPermission: AccessLevel | null
  elementsWithoutAccess: { id: string; name: string }[]
} {
  // Check activity permission
  const activityPermission = calculateEffectivePermission(activityId, userId)
  const canEditActivity =
    activityPermission !== null && activityPermission >= AccessLevel.EDITOR

  // If user can't edit the activity, no need to check elements
  if (!canEditActivity) {
    return {
      canEdit: false,
      activityPermission,
      elementsWithoutAccess: [],
    }
  }

  // Check element permissions
  const elementIds = getActivityElements(activityId)
  const elementsWithoutAccess: { id: string; name: string }[] = []

  for (const elementId of elementIds) {
    const permission = calculateEffectivePermission(elementId, userId)
    if (!permission || permission < AccessLevel.VIEWER) {
      const element = mockElements.find((elem) => elem.id === elementId)
      if (element) {
        elementsWithoutAccess.push({
          id: elementId,
          name: element.name,
        })
      }
    }
  }

  return {
    canEdit: elementsWithoutAccess.length === 0,
    activityPermission,
    elementsWithoutAccess,
  }
}

/**
 * Check if a user is a member of a group
 * @param groupId The ID of the group
 * @param userId The ID of the user
 * @returns True if the user is a member of the group
 */
export function isGroupMember(groupId: string, userId: string): boolean {
  return mockGroupMemberships.some(
    (membership) =>
      membership.groupId === groupId && membership.userId === userId
  )
}

/**
 * Get all groups that a user is a member of
 * @param userId The ID of the user
 * @returns Array of group IDs
 */
export function getUserGroups(userId: string): string[] {
  return mockGroupMemberships
    .filter((membership) => membership.userId === userId)
    .map((membership) => membership.groupId)
}

/**
 * Get all members of a group
 * @param groupId The ID of the group
 * @returns Array of user IDs
 */
export function getGroupMembers(groupId: string): string[] {
  return mockGroupMemberships
    .filter((membership) => membership.groupId === groupId)
    .map((membership) => membership.userId)
}

/**
 * Add a user to a group
 * @param groupId The ID of the group
 * @param userId The ID of the user to add
 * @param addedBy The ID of the user adding the member
 * @returns Result of the operation
 */
export function addGroupMember(
  groupId: string,
  userId: string,
  addedBy: string
): { success: boolean; message: string } {
  // Check if the group exists
  const group = mockUserGroups.find((g) => g.id === groupId)
  if (!group) {
    return { success: false, message: 'Group not found' }
  }

  // Check if user is already a member
  if (isGroupMember(groupId, userId)) {
    return { success: false, message: 'User is already a member of this group' }
  }

  // Add the membership
  const newMembership: GroupMembership = {
    id: `membership-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    groupId,
    userId,
    addedBy,
    addedAt: new Date(),
  }

  mockGroupMemberships.push(newMembership)
  logAuditEvent({
    actionType: AuditActionType.GROUP_MEMBER_ADD,
    userId: addedBy,
    resourceId: groupId,
    resourceType: ResourceType.USER_GROUP,
    details: {
      memberId: userId,
    },
  })
  return { success: true, message: 'User added to group successfully' }
}

/**
 * Remove a user from a group
 * @param groupId The ID of the group
 * @param userId The ID of the user to remove
 * @returns Result of the operation
 */
export function removeGroupMember(
  groupId: string,
  userId: string
): { success: boolean; message: string } {
  // Check if the membership exists
  const membershipIndex = mockGroupMemberships.findIndex(
    (membership) =>
      membership.groupId === groupId && membership.userId === userId
  )

  if (membershipIndex === -1) {
    return { success: false, message: 'User is not a member of this group' }
  }

  // Remove the membership
  mockGroupMemberships.splice(membershipIndex, 1)
  logAuditEvent({
    actionType: AuditActionType.GROUP_MEMBER_REMOVE,
    userId: userId,
    resourceId: groupId,
    resourceType: ResourceType.USER_GROUP,
    details: {
      memberId: userId,
    },
  })
  return { success: true, message: 'User removed from group successfully' }
}

/**
 * Create a new user group
 * @param name The name of the group
 * @param ownerId The ID of the group owner
 * @param description Optional description of the group
 * @returns The created group
 */
export function createUserGroup(
  name: string,
  ownerId: string,
  description?: string
): UserGroup {
  const newGroup: UserGroup = {
    id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name,
    description,
    ownerId,
    isDeleted: false,
    createdAt: new Date(),
    type: ResourceType.USER_GROUP,
  }

  mockUserGroups.push(newGroup)
  return newGroup
}

// Demo function to test the permission system
export function runPermissionDemo(): void {
  console.log('=== Permission Management System Demo ===')

  // Test case 1: Direct permissions
  console.log('\nTest Case 1: Direct Permissions')
  console.log(
    `User-2's permission on Element-1: ${calculateEffectivePermission('elem-1', 'user-2')}`
  )
  console.log(
    `User-3's permission on Element-2: ${calculateEffectivePermission('elem-2', 'user-3')}`
  )

  // Test case 2: Derived permissions from activities
  console.log('\nTest Case 2: Derived Permissions')
  console.log(
    `User-2's permission on Activity-1: ${calculateEffectivePermission('act-1', 'user-2')}`
  )
  // User-2 has ADMIN on act-1, which contains elem-1 and elem-2, so should have EDITOR on those elements
  console.log(
    `User-2's derived permission on Element-2 (via Activity-1): ${calculateEffectivePermission('elem-2', 'user-2')}`
  )

  // Test case 3: Ownership permissions
  console.log('\nTest Case 3: Ownership')
  console.log(`User-1 owns Element-1: ${isResourceOwner('elem-1', 'user-1')}`)
  console.log(
    `User-1's permission on Element-1: ${calculateEffectivePermission('elem-1', 'user-1')}`
  )

  // Test case 4: Permission granting
  console.log('\nTest Case 4: Granting Permissions')
  const newGrant = grantPermission(
    'elem-3',
    'user-1',
    AccessLevel.EDITOR,
    'user-2'
  )
  console.log(`Grant result: ${newGrant ? 'Success' : 'Failed'}`)
  console.log(
    `User-1's new permission on Element-3: ${calculateEffectivePermission('elem-3', 'user-1')}`
  )

  // Test case 5: Element deletion check
  console.log('\nTest Case 5: Element Deletion Check')
  const deleteCheck1 = canDeleteElement('elem-1', 'user-1')
  console.log(
    `Can User-1 delete Element-1? ${deleteCheck1.allowed}${deleteCheck1.reason ? ` (${deleteCheck1.reason})` : ''}`
  )

  const deleteCheck2 = canDeleteElement('elem-3', 'user-1')
  console.log(
    `Can User-1 delete Element-3? ${deleteCheck2.allowed}${deleteCheck2.reason ? ` (${deleteCheck2.reason})` : ''}`
  )

  // Test soft deletion and cloning
  console.log('\nTest Case 5b: Element Soft Deletion and Cloning')
  const softDeleteResult = softDeleteElement('elem-1', 'user-1')
  console.log(
    `Soft delete result: ${softDeleteResult.success ? 'Success' : 'Failed'} - ${softDeleteResult.message}`
  )

  // Check if the element is marked as deleted
  const softDeletedElement = mockElements.find((e) => e.id === 'elem-1')
  console.log(`Element-1 isDeleted flag: ${softDeletedElement?.isDeleted}`)

  // Test cloning for activities
  const cloneResult = cloneElementForActivities('elem-2', 'user-1')
  console.log(
    `Clone result: ${cloneResult.success ? 'Success' : 'Failed'} - ${cloneResult.message}`
  )

  if (cloneResult.success && cloneResult.clonedElementIds) {
    console.log('Cloned element IDs:')
    Object.entries(cloneResult.clonedElementIds).forEach(
      ([activityId, elementId]) => {
        const activity = mockActivities.find((a) => a.id === activityId)
        console.log(`- Activity "${activity?.displayName}": ${elementId}`)
      }
    )

    // Verify that the activity now uses the cloned element
    const activity = mockActivities.find((a) => a.id === 'act-1')
    console.log(
      `Activity "${activity?.displayName}" now contains elements: ${activity?.elementIds.join(', ')}`
    )
  }

  // Test case 6: All derived permissions for a user
  console.log('\nTest Case 6: All Derived Permissions')
  const allPermissions = calculateAllDerivedPermissions('user-2')
  console.log('User-2 has access to the following resources:')
  allPermissions.forEach((level, resourceId) => {
    const resource = getResourceById(resourceId)
    console.log(
      `- ${resource?.type === ResourceType.ELEMENT ? 'Element' : 'Activity'} "${resourceId}": ${AccessLevelNames[level]}`
    )
  })

  // Test case 7: Complete permission table for caching
  console.log('\nTest Case 7: Complete Permission Table for Caching')
  const permissionTable = computeCompletePermissionTable()
  console.log(`Generated permission table for ${permissionTable.size} users`)

  // Print a sample of the permission table
  const sampleUserId = 'user-2'
  console.log(`\nSample permissions for ${sampleUserId}:`)
  const userPermissions = permissionTable.get(sampleUserId)
  if (userPermissions) {
    userPermissions.forEach((level, resourceId) => {
      const resource = getResourceById(resourceId)
      console.log(
        `- ${resource?.type === ResourceType.ELEMENT ? 'Element' : 'Activity'} "${resourceId}": ${AccessLevelNames[level]}`
      )
    })
  }

  // Test serialization and deserialization
  console.log('\nTest Case 8: Serialization and Deserialization')
  const serialized = serializePermissionTable(permissionTable)
  console.log('Serialized permission table (sample):')
  console.log(JSON.stringify(serialized['user-1'], null, 2))

  const deserialized = deserializePermissionTable(serialized)
  console.log(`\nDeserialized permission table has ${deserialized.size} users`)

  // Verify the deserialized data matches the original
  let isMatch = true
  permissionTable.forEach((resourceMap, userId) => {
    const deserializedMap = deserialized.get(userId)
    if (!deserializedMap) {
      isMatch = false
      return
    }

    resourceMap.forEach((level, resourceId) => {
      if (deserializedMap.get(resourceId) !== level) {
        isMatch = false
      }
    })
  })

  console.log(`Deserialized data matches original: ${isMatch}`)

  // Test permission lookup from the table
  console.log('\nTest Case 9: Permission Lookup from Table')
  const lookupResult1 = getPermissionFromTable(
    permissionTable,
    'user-2',
    'elem-1'
  )
  console.log(
    `User-2's permission on Element-1 (from table): ${lookupResult1 !== null ? AccessLevelNames[lookupResult1] : 'No access'}`
  )

  const lookupResult2 = getPermissionFromTable(
    permissionTable,
    'user-1',
    'elem-3'
  )
  console.log(
    `User-1's permission on Element-3 (from table): ${lookupResult2 !== null ? AccessLevelNames[lookupResult2] : 'No access'}`
  )

  // Test case 10: Activity-Element Permission Propagation
  console.log('\nTest Case 10: Activity-Element Permission Propagation')

  // Grant user-3 EDITOR access to activity-1
  const propagationResult = grantPermissionWithPropagation(
    'act-1',
    'user-3',
    AccessLevel.EDITOR,
    'user-1'
  )
  console.log(
    `Grant result: ${propagationResult.success ? 'Success' : 'Failed'} - ${propagationResult.message}`
  )

  if (
    propagationResult.propagatedGrants &&
    propagationResult.propagatedGrants.length > 0
  ) {
    console.log(
      `Propagated ${propagationResult.propagatedGrants.length} permissions to elements:`
    )
    propagationResult.propagatedGrants.forEach((grant) => {
      const element = mockElements.find((elem) => elem.id === grant.resourceId)
      console.log(
        `- Element "${element?.name}": ${AccessLevelNames[grant.level]}`
      )
    })
  }

  // Check if user-3 can now edit the activity with all its elements
  const editCheck = canEditActivityWithElements('act-1', 'user-3')
  console.log(`Can user-3 edit activity-1? ${editCheck.canEdit ? 'Yes' : 'No'}`)
  console.log(
    `Activity permission: ${editCheck.activityPermission !== null ? AccessLevelNames[editCheck.activityPermission] : 'None'}`
  )

  if (editCheck.elementsWithoutAccess.length > 0) {
    console.log(
      `Elements without sufficient access: ${editCheck.elementsWithoutAccess.length}`
    )
    editCheck.elementsWithoutAccess.forEach((element) => {
      console.log(`- ${element.name} (${element.id})`)
    })
  }

  // Test case 11: Scoped Permissions
  console.log('\nTest Case 11: Scoped Permissions')

  // Create a new user and activity for testing
  const userD = { id: 'user-d', name: 'User D' }
  mockUsers.push(userD)

  const activityX = {
    id: 'act-x',
    name: 'Activity X',
    type: ResourceType.ACTIVITY,
    ownerId: 'user-1',
    elementIds: ['elem-1', 'elem-2'],
    isDeleted: false,
  }
  mockActivities.push(activityX)

  // Grant user-d EDITOR access to activity-x with ACTIVITY_ONLY scope for elements
  console.log(
    'Granting User D access to Activity X with activity-scoped element permissions:'
  )
  const scopedResult = grantPermissionWithPropagation(
    'act-x',
    'user-d',
    AccessLevel.EDITOR,
    'user-1',
    { elementScope: PermissionScope.ACTIVITY_ONLY }
  )

  console.log(
    `Grant result: ${scopedResult.success ? 'Success' : 'Failed'} - ${scopedResult.message}`
  )

  if (
    scopedResult.propagatedGrants &&
    scopedResult.propagatedGrants.length > 0
  ) {
    console.log(
      `Propagated ${scopedResult.propagatedGrants.length} scoped permissions to elements`
    )
  }

  // Check if user-d can access elements in different contexts
  const elem1InActivityContext = calculateEffectivePermission(
    'elem-1',
    'user-d',
    { activityId: 'act-x' }
  )
  const elem1OutsideActivity = calculateEffectivePermission('elem-1', 'user-d')

  console.log(
    `User D's access to Element 1 within Activity X context: ${elem1InActivityContext !== null ? AccessLevelNames[elem1InActivityContext] : 'No access'}`
  )
  console.log(
    `User D's access to Element 1 outside activity context: ${elem1OutsideActivity !== null ? AccessLevelNames[elem1OutsideActivity] : 'No access'}`
  )

  // Check if user-d can edit the activity
  const editCheckScoped = canEditActivityWithElements('act-x', 'user-d')
  console.log(
    `Can User D edit Activity X? ${editCheckScoped.canEdit ? 'Yes' : 'No'}`
  )
  console.log(
    `Activity permission: ${editCheckScoped.activityPermission !== null ? AccessLevelNames[editCheckScoped.activityPermission] : 'None'}`
  )

  if (editCheckScoped.elementsWithoutAccess.length > 0) {
    console.log(
      `Elements without sufficient access: ${editCheckScoped.elementsWithoutAccess.length}`
    )
    editCheckScoped.elementsWithoutAccess.forEach((element) => {
      console.log(`- ${element.name} (${element.id})`)
    })
  }
}

// Run the demos
runPermissionDemo()
console.log('\n\n')
export function runUserGroupPermissionDemo(): void {
  console.log('=== User Group Permission System Demo ===')

  // Show initial state
  console.log('\n1. Initial Group Setup:')
  console.log('Group 1 (Teaching Assistants):')
  console.log(
    '- Members:',
    getGroupMembers('group-1').map((id) => {
      const user = mockUsers.find((u) => u.id === id)
      return user ? user.name : id
    })
  )

  console.log('Group 2 (Course Instructors):')
  console.log(
    '- Members:',
    getGroupMembers('group-2').map((id) => {
      const user = mockUsers.find((u) => u.id === id)
      return user ? user.name : id
    })
  )

  // Display initial permissions
  console.log('\n2. Initial Permissions:')
  console.log(
    'User 2 direct permission on elem-4:',
    getDirectPermission('elem-4', 'user-2')?.level || 'None'
  )
  console.log(
    'Group 1 permission on elem-4:',
    getDirectPermission('elem-4', 'group-1')?.level || 'None'
  )
  console.log(
    'User 2 effective permission on elem-4:',
    calculateEffectivePermission('elem-4', 'user-2')
  )

  console.log(
    'User 3 direct permission on elem-3:',
    getDirectPermission('elem-3', 'user-3')?.level || 'None'
  )
  console.log(
    'Group 2 permission on elem-3:',
    getDirectPermission('elem-3', 'group-2')?.level || 'None'
  )
  console.log(
    'User 2 effective permission on elem-3:',
    calculateEffectivePermission('elem-3', 'user-2')
  )

  // Test adding a new user to a group
  console.log('\n3. Adding User 3 to Group 2:')
  const addResult = addGroupMember('group-2', 'user-3', 'user-1')
  console.log('Result:', addResult)

  // Check updated permissions
  console.log('\n4. Updated Permissions after Group Change:')
  console.log(
    'User 3 direct permission on elem-3:',
    getDirectPermission('elem-3', 'user-3')?.level || 'None'
  )
  console.log(
    'User 3 effective permission on elem-3 (via Group 2):',
    calculateEffectivePermission('elem-3', 'user-3')
  )

  // Test permission precedence
  console.log('\n5. Testing Permission Precedence:')
  console.log('Adding direct VIEWER permission to User 3 for elem-3')

  mockPermissionGrants.push({
    id: `perm-precedence-test-${Date.now()}`,
    resourceId: 'elem-3',
    resourceType: ResourceType.ELEMENT,
    userId: 'user-3',
    level: AccessLevel.VIEWER,
    grantedBy: 'user-1',
    grantedAt: new Date(),
  })

  console.log(
    'User 3 direct permission on elem-3:',
    getDirectPermission('elem-3', 'user-3')?.level || 'None'
  )
  console.log(
    'Group 2 permission on elem-3:',
    getDirectPermission('elem-3', 'group-2')?.level || 'None'
  )
  console.log(
    'User 3 effective permission on elem-3:',
    calculateEffectivePermission('elem-3', 'user-3')
  )
  console.log('(Higher permission level from group should be used)')

  // Test activity-scoped permissions with groups
  console.log('\n6. Testing Activity-Scoped Permissions with Groups:')

  // Grant group-1 access to an activity with activity-scoped element permissions
  mockPermissionGrants.push({
    id: `perm-activity-group-${Date.now()}`,
    resourceId: 'act-2',
    resourceType: ResourceType.ACTIVITY,
    userId: 'group-1',
    level: AccessLevel.EDITOR,
    grantedBy: 'user-1',
    grantedAt: new Date(),
  })

  // Propagate permissions from activity to its elements with activity-only scope
  const propagationResult = propagateActivityPermissionsToElements(
    'act-2',
    'group-1',
    { scope: PermissionScope.ACTIVITY_ONLY }
  )

  console.log('Propagated permissions:', propagationResult.length)

  // Check user-2's access to an element in act-2 (via group-1 membership)
  const element = mockElements.find((e) =>
    mockActivities.find((a) => a.id === 'act-2')?.elementIds.includes(e.id)
  )
  if (element) {
    console.log(
      `Testing User 2's access to ${element.name} (id: ${element.id}):`
    )
    console.log(
      '- Within activity context:',
      calculateEffectivePermission(element.id, 'user-2', {
        activityId: 'act-2',
      })
    )
    console.log(
      '- Outside activity context:',
      calculateEffectivePermission(element.id, 'user-2')
    )
  }

  console.log('\n=== End of User Group Permission Demo ===')
}
runUserGroupPermissionDemo()
console.log('\n\n')
/**
 * Demo function to showcase audit logging functionality
 */
function runAuditLoggingDemo(): void {
  console.log('=== AUDIT LOGGING DEMO ===')

  // Clear any existing audit logs for clean demo
  mockAuditLogs.length = 0

  console.log(
    '1. Creating a series of permission changes to generate audit logs...'
  )

  // Grant a permission - use valid user IDs and ensure granter has admin/owner permissions
  console.log('- Granting permission to user-2 on elem-1 by user-1 (owner)...')
  grantPermission('elem-1', 'user-2', AccessLevel.VIEWER, 'user-1')

  // Upgrade a permission
  console.log('- Upgrading permission for user-2 on elem-1 to EDITOR...')
  grantPermission('elem-1', 'user-2', AccessLevel.EDITOR, 'user-1')

  // Revoke a permission
  console.log('- Revoking permission from user-2 on elem-1...')
  revokePermission('elem-1', 'user-2', 'user-1')

  // Transfer ownership
  console.log('- Transferring ownership of elem-3 from user-3 to user-2...')
  transferOwnership('elem-3', 'user-2', 'user-3')

  // Add a user to a group
  console.log('- Adding user-3 to group-1...')
  addGroupMember('group-1', 'user-3', 'user-1')

  // Remove a user from a group
  console.log('- Removing user-3 from group-1...')
  removeGroupMember('group-1', 'user-3')

  // Soft delete an element
  console.log('- Soft deleting elem-3...')
  softDeleteElement('elem-3', 'user-2')

  console.log('\n2. Retrieving all audit logs:')
  const allLogs = getAuditLogs()
  console.log(`Found ${allLogs.length} audit log entries:`)
  allLogs.forEach((log, index) => {
    printAuditLog(log)
  })

  console.log('\n3. Filtering logs by resource:')
  const resourceLogs = getResourceAuditLogs('elem-1')
  console.log(`Found ${resourceLogs.length} logs for element 'elem-1':`)
  resourceLogs.forEach((log, index) => {
    printAuditLog(log)
  })

  console.log('\n4. Filtering logs by user actions:')
  const userActionLogs = getUserActionAuditLogs('user-1')
  console.log(`Found ${userActionLogs.length} actions performed by 'user-1':`)
  userActionLogs.forEach((log, index) => {
    printAuditLog(log)
  })

  console.log('\n5. Filtering logs by affected user:')
  const userAffectedLogs = getUserAffectedAuditLogs('user-2')
  console.log(`Found ${userAffectedLogs.length} changes affecting 'user-2':`)
  userAffectedLogs.forEach((log, index) => {
    printAuditLog(log)
  })

  console.log('\n6. Filtering logs by time range:')
  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
  const recentLogs = getAuditLogs({ timeStart: fiveMinutesAgo, timeEnd: now })
  console.log(`Found ${recentLogs.length} logs from the last 5 minutes`)

  console.log('\n7. Filtering logs by action type:')
  const grantLogs = getAuditLogs({
    actionType: AuditActionType.PERMISSION_GRANT,
  })
  console.log(`Found ${grantLogs.length} permission grant logs:`)
  grantLogs.forEach((log, index) => {
    printAuditLog(log)
  })

  console.log('\n=== END OF AUDIT LOGGING DEMO ===')
}
runAuditLoggingDemo()

function printAuditLog(log: AuditLogEntry) {
  console.log(`  Action: ${log.actionType}`)
  console.log(`  Time: ${log.timestamp}`)
  console.log(
    `  Performed by: ${log.performedBy} (${mockUsers.find((u) => u.id === log.performedBy)?.name || 'Unknown'})`
  )
  console.log(`  Resource: ${log.resourceId} (${log.resourceType})`)

  // Print relevant details based on action type
  if (log.actionType === AuditActionType.PERMISSION_GRANT) {
    console.log(`  Target user: ${log.details?.targetUserId}`)
    console.log(
      `  Permission change: ${log.details?.permissionBefore || 'none'} → ${log.details?.permissionAfter}`
    )
  } else if (log.actionType === AuditActionType.PERMISSION_REVOKE) {
    console.log(`  Target user: ${log.details?.targetUserId}`)
    console.log(`  Revoked permission: ${log.details?.permissionBefore}`)
  } else if (log.actionType === AuditActionType.OWNERSHIP_TRANSFER) {
    console.log(`  Previous owner: ${log.details?.previousOwnerId}`)
    console.log(`  New owner: ${log.details?.newOwnerId}`)
  } else if (
    log.actionType === AuditActionType.GROUP_MEMBER_ADD ||
    log.actionType === AuditActionType.GROUP_MEMBER_REMOVE
  ) {
    console.log(`  Member: ${log.details?.memberId}`)
  } else if (log.actionType === AuditActionType.ACTIVITY_SHARE) {
    console.log(`  Target user: ${log.details?.targetUserId}`)
    console.log(`  Share mode: ${log.details?.shareMode}`)
    console.log(`  Access level: ${log.details?.accessLevel}`)
    console.log(`  Reason: ${log.details?.reason}`)
  }
}
