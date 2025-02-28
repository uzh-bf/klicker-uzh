// Define the access levels for resources
export enum AccessLevel {
  VIEWER = 'viewer', // Read-only access
  EDITOR = 'editor', // Can modify but not manage permissions
  ADMIN = 'admin',   // Can modify and manage permissions
  OWNER = 'owner',   // Full control with transfer rights
}

// Mapping of AccessLevel to human-readable names
export const AccessLevelNames = {
  [AccessLevel.VIEWER]: 'viewer',
  [AccessLevel.EDITOR]: 'editor',
  [AccessLevel.ADMIN]: 'admin',
  [AccessLevel.OWNER]: 'owner',
}

// Define the types of resources that can have permissions
export type ResourceType = 'element' | 'activity'

// Define the types of activities
export enum ActivityType {
  PRACTICE_QUIZ = 'practiceQuiz',
  LIVE_QUIZ = 'liveQuiz',
  MICROLEARNING = 'microlearning',
  GROUP_ACTIVITY = 'groupActivity',
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
  type: 'element'
  name: string
  content: string
  explanation?: string
  // Additional element-specific fields can be added as needed
}

// Activity resource
export interface Activity extends ResourceBase {
  type: 'activity'
  activityType: ActivityType
  name: string
  displayName: string
  description?: string
  elementIds: string[] // IDs of elements included in this activity
  // Additional activity-specific fields can be added as needed
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
const mockElements: Element[] = [
  {
    id: 'elem-1',
    ownerId: 'user-1',
    createdAt: new Date('2025-01-15'),
    type: 'element',
    name: 'Multiple Choice Question about TypeScript',
    content: 'What is TypeScript?',
    explanation:
      'TypeScript is a superset of JavaScript that adds static typing.',
  },
  {
    id: 'elem-2',
    ownerId: 'user-1',
    createdAt: new Date('2025-01-20'),
    type: 'element',
    name: 'Free Text Question about React',
    content: 'Explain the concept of React hooks.',
  },
  {
    id: 'elem-3',
    ownerId: 'user-2',
    createdAt: new Date('2025-01-25'),
    type: 'element',
    name: 'Numerical Question about Algorithms',
    content: 'What is the time complexity of quicksort in the worst case?',
  },
  {
    id: 'elem-4',
    ownerId: 'user-3',
    createdAt: new Date('2025-02-01'),
    type: 'element',
    name: 'Content Slide about Database Design',
    content: 'Introduction to relational database design principles.',
  },
]

// Mock data for activities
const mockActivities: Activity[] = [
  {
    id: 'act-1',
    ownerId: 'user-1',
    createdAt: new Date('2025-01-30'),
    type: 'activity',
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
    type: 'activity',
    activityType: ActivityType.LIVE_QUIZ,
    name: 'algorithms-live',
    displayName: 'Algorithms Live Session',
    elementIds: ['elem-3'],
  },
  {
    id: 'act-3',
    ownerId: 'user-3',
    createdAt: new Date('2025-02-10'),
    type: 'activity',
    activityType: ActivityType.GROUP_ACTIVITY,
    name: 'database-workshop',
    displayName: 'Database Design Workshop',
    description: 'Collaborative workshop on database design',
    elementIds: ['elem-4', 'elem-3'],
  },
]

// Mock data for users
const mockUsers = [
  { id: 'user-1', name: 'User 1' },
  { id: 'user-2', name: 'User 2' },
  { id: 'user-3', name: 'User 3' },
]

// Mock permission grants
const mockPermissionGrants: PermissionGrant[] = [
  // Direct element permissions
  {
    id: 'perm-1',
    resourceId: 'elem-1',
    resourceType: 'element',
    userId: 'user-2',
    level: AccessLevel.VIEWER,
    grantedBy: 'user-1',
    grantedAt: new Date('2025-01-16'),
  },
  {
    id: 'perm-2',
    resourceId: 'elem-2',
    resourceType: 'element',
    userId: 'user-3',
    level: AccessLevel.EDITOR,
    grantedBy: 'user-1',
    grantedAt: new Date('2025-01-21'),
  },

  // Direct activity permissions
  {
    id: 'perm-3',
    resourceId: 'act-1',
    resourceType: 'activity',
    userId: 'user-2',
    level: AccessLevel.ADMIN,
    grantedBy: 'user-1',
    grantedAt: new Date('2025-01-31'),
  },
  {
    id: 'perm-4',
    resourceId: 'act-2',
    resourceType: 'activity',
    userId: 'user-1',
    level: AccessLevel.VIEWER,
    grantedBy: 'user-2',
    grantedAt: new Date('2025-02-06'),
  },
  {
    id: 'perm-5',
    resourceId: 'act-3',
    resourceType: 'activity',
    userId: 'user-2',
    level: AccessLevel.EDITOR,
    grantedBy: 'user-3',
    grantedAt: new Date('2025-02-11'),
  },
]

/**
 * Get a resource by its ID
 * @param resourceId The ID of the resource to retrieve
 * @returns The resource or undefined if not found
 */
function getResourceById(resourceId: string): Element | Activity | undefined {
  // First check elements
  const element = mockElements.find((elem) => elem.id === resourceId)
  if (element) return element

  // Then check activities
  return mockActivities.find((act) => act.id === resourceId)
}

/**
 * Get direct permission grants for a user on a specific resource
 * @param resourceId The ID of the resource
 * @param userId The ID of the user
 * @returns The permission grant or undefined if none exists
 */
function getDirectPermission(
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
function isResourceOwner(resourceId: string, userId: string): boolean {
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
      if (context?.activityId && directPermission.derivedFrom?.resourceId === context.activityId) {
        return directPermission.level
      }
      // Otherwise, this permission doesn't apply outside its activity context
      return null
    }
    // For global permissions, always apply them
    return directPermission.level
  }

  // Get the resource
  const resource = getResourceById(resourceId)
  if (!resource) return null

  // If it's an element, check if it's part of any activities the user has access to
  if (resource.type === 'element') {
    // Find activities that contain this element
    const containingActivities = mockActivities.filter((activity) =>
      activity.elementIds.includes(resourceId)
    )

    // Check user's permission on each containing activity
    let highestDerivedLevel: AccessLevel | null = null

    for (const activity of containingActivities) {
      const activityPermission = calculateEffectivePermission(
        activity.id,
        userId,
        { activityId: activity.id }
      )

      // If user has access to the activity, they get derived access to the element
      if (activityPermission) {
        // Map activity permission to element permission (potentially with reduced rights)
        // For example, ADMIN on activity might translate to EDITOR on contained elements
        let derivedElementPermission: AccessLevel | null = null

        switch (activityPermission) {
          case AccessLevel.OWNER:
          case AccessLevel.ADMIN:
            derivedElementPermission = AccessLevel.EDITOR
            break
          case AccessLevel.EDITOR:
            derivedElementPermission = AccessLevel.EDITOR
            break
          case AccessLevel.VIEWER:
            derivedElementPermission = AccessLevel.VIEWER
            break
        }

        // Update highest derived level if this one is higher
        if (
          derivedElementPermission &&
          (!highestDerivedLevel ||
            getPermissionRank(derivedElementPermission) >
              getPermissionRank(highestDerivedLevel))
        ) {
          highestDerivedLevel = derivedElementPermission
        }
      }
    }

    return highestDerivedLevel
  }

  // If we get here, the user has no access to this resource
  return null
}

/**
 * Get a numeric rank for permission levels to compare them
 * @param level The access level
 * @returns A numeric rank (higher means more permissions)
 */
function getPermissionRank(level: AccessLevel): number {
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
  mockPermissionGrants.splice(grantIndex, 1)
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
      reason: `Element is used in ${containingActivities.length} activities. Use softDeleteElement() or cloneElementForActivities() instead of direct deletion.` 
    };
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
): { success: boolean; message: string; clonedElementIds?: Record<string, string> } {
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
      message: 'Element is not used in any activities, use regular deletion instead',
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
export function computeCompletePermissionTable(): Map<string, Map<string, AccessLevel>> {
  const permissionTable = new Map<string, Map<string, AccessLevel>>();
  
  // Get all unique user IDs from elements, activities, and permission grants
  const userIds = new Set<string>();
  
  // Add owners of resources
  mockElements.forEach(elem => userIds.add(elem.ownerId));
  mockActivities.forEach(act => userIds.add(act.ownerId));
  
  // Add users with explicit permission grants
  mockPermissionGrants.forEach(grant => userIds.add(grant.userId));
  
  // For each user, calculate their permissions on all resources
  userIds.forEach(userId => {
    const userPermissions = calculateAllDerivedPermissions(userId);
    permissionTable.set(userId, userPermissions);
  });
  
  return permissionTable;
}

/**
 * Convert the permission table to a serializable format for caching
 * @param permissionTable The permission table to serialize
 * @returns A serializable object representation of the permission table
 */
export function serializePermissionTable(
  permissionTable: Map<string, Map<string, AccessLevel>>
): Record<string, Record<string, string>> {
  const serialized: Record<string, Record<string, string>> = {};
  
  permissionTable.forEach((resourceMap, userId) => {
    serialized[userId] = {};
    resourceMap.forEach((level, resourceId) => {
      serialized[userId][resourceId] = AccessLevelNames[level];
    });
  });
  
  return serialized;
}

/**
 * Deserialize a permission table from its serialized format
 * @param serialized The serialized permission table
 * @returns The reconstructed permission table as a nested Map
 */
export function deserializePermissionTable(
  serialized: Record<string, Record<string, string>>
): Map<string, Map<string, AccessLevel>> {
  const permissionTable = new Map<string, Map<string, AccessLevel>>();
  
  Object.entries(serialized).forEach(([userId, resources]) => {
    const resourceMap = new Map<string, AccessLevel>();
    
    Object.entries(resources).forEach(([resourceId, accessLevel]) => {
      resourceMap.set(resourceId, accessLevel as AccessLevel);
    });
    
    permissionTable.set(userId, resourceMap);
  });
  
  return permissionTable;
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
  const userPermissions = permissionTable.get(userId);
  if (!userPermissions) return null;
  
  return userPermissions.get(resourceId) || null;
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
 * Propagate READ permissions from an activity to all its elements
 * This ensures that users with access to an activity can see all its elements
 * @param activityId The ID of the activity
 * @param userId The ID of the user receiving permissions
 * @param grantedBy The ID of the user who granted permission on the activity
 * @param scope The scope of the propagated permissions (default: GLOBAL)
 * @returns Array of permission grants created
 */
export function propagateActivityPermissionsToElements(
  activityId: string,
  userId: string,
  grantedBy: string,
  scope: PermissionScope = PermissionScope.GLOBAL
): PermissionGrant[] {
  const elementIds = getActivityElements(activityId)
  const newGrants: PermissionGrant[] = []

  for (const elementId of elementIds) {
    // Check if user already has permissions on this element
    const existingPermission = getDirectPermission(elementId, userId)
    
    // Only grant READ permission if user doesn't have any permission yet
    // or if existing permission is lower than READ
    if (!existingPermission || existingPermission.level < AccessLevel.VIEWER) {
      // Create a new permission grant
      const newGrant: PermissionGrant = {
        id: `perm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        resourceId: elementId,
        resourceType: 'element',
        userId,
        level: AccessLevel.VIEWER,
        grantedBy,
        grantedAt: new Date(),
        scope,
        derivedFrom: {
          resourceId: activityId,
          resourceType: 'activity'
        }
      }
      
      // Add to the mock grants
      mockPermissionGrants.push(newGrant)
      
      // Add to the return array
      newGrants.push(newGrant)
    }
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
 * @param resourceId The ID of the resource
 * @param userId The ID of the user receiving permission
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
    // Whether element permissions should be scoped to the activity context only
    elementScope?: PermissionScope
  } = {}
): { success: boolean; message: string; propagatedGrants?: PermissionGrant[] } {
  // First, grant the direct permission
  const grantResult = grantPermission(resourceId, userId, level, grantedBy)
  
  if (!grantResult) {
    return {
      success: false,
      message: 'Failed to grant permission',
    }
  }
  
  const propagatedGrants: PermissionGrant[] = []
  
  // Check if this is an activity, and propagate to elements if needed
  const resource = mockActivities.find((act) => act.id === resourceId)
  if (resource && resource.type === 'activity') {
    // Use the specified element scope or default to GLOBAL
    const elementScope = options.elementScope || PermissionScope.GLOBAL
    const elementGrants = propagateActivityPermissionsToElements(resourceId, userId, grantedBy, elementScope)
    propagatedGrants.push(...elementGrants)
    
    return {
      success: true,
      message: `Permission granted successfully. Also granted READ access to ${elementGrants.length} elements in the activity.`,
      propagatedGrants,
    }
  }
  
  return {
    success: true,
    message: 'Permission granted successfully.',
    propagatedGrants,
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
  canEdit: boolean;
  activityPermission: AccessLevel | null;
  elementsWithoutAccess: { id: string; name: string }[];
} {
  // Check activity permission
  const activityPermission = calculateEffectivePermission(activityId, userId)
  const canEditActivity = activityPermission !== null && activityPermission >= AccessLevel.EDITOR
  
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

// Demo function to test the permission system
export function runPermissionDemo(): void {
  console.log('=== Permission Management System Demo ===');
  
  // Test case 1: Direct permissions
  console.log('\nTest Case 1: Direct Permissions');
  console.log(
    `User-2's permission on Element-1: ${calculateEffectivePermission('elem-1', 'user-2')}`
  );
  console.log(
    `User-3's permission on Element-2: ${calculateEffectivePermission('elem-2', 'user-3')}`
  );
  
  // Test case 2: Derived permissions from activities
  console.log('\nTest Case 2: Derived Permissions');
  console.log(
    `User-2's permission on Activity-1: ${calculateEffectivePermission('act-1', 'user-2')}`
  );
  // User-2 has ADMIN on act-1, which contains elem-1 and elem-2, so should have EDITOR on those elements
  console.log(
    `User-2's derived permission on Element-2 (via Activity-1): ${calculateEffectivePermission('elem-2', 'user-2')}`
  );
  
  // Test case 3: Ownership permissions
  console.log('\nTest Case 3: Ownership');
  console.log(`User-1 owns Element-1: ${isResourceOwner('elem-1', 'user-1')}`);
  console.log(
    `User-1's permission on Element-1: ${calculateEffectivePermission('elem-1', 'user-1')}`
  );
  
  // Test case 4: Permission granting
  console.log('\nTest Case 4: Granting Permissions');
  const newGrant = grantPermission(
    'elem-3',
    'user-1',
    AccessLevel.EDITOR,
    'user-2'
  );
  console.log(`Grant result: ${newGrant ? 'Success' : 'Failed'}`);
  console.log(
    `User-1's new permission on Element-3: ${calculateEffectivePermission('elem-3', 'user-1')}`
  );
  
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
  console.log(`Soft delete result: ${softDeleteResult.success ? 'Success' : 'Failed'} - ${softDeleteResult.message}`)
  
  // Check if the element is marked as deleted
  const softDeletedElement = mockElements.find(e => e.id === 'elem-1')
  console.log(`Element-1 isDeleted flag: ${softDeletedElement?.isDeleted}`)
  
  // Test cloning for activities
  const cloneResult = cloneElementForActivities('elem-2', 'user-1')
  console.log(`Clone result: ${cloneResult.success ? 'Success' : 'Failed'} - ${cloneResult.message}`)
  
  if (cloneResult.success && cloneResult.clonedElementIds) {
    console.log('Cloned element IDs:')
    Object.entries(cloneResult.clonedElementIds).forEach(([activityId, elementId]) => {
      const activity = mockActivities.find(a => a.id === activityId)
      console.log(`- Activity "${activity?.displayName}": ${elementId}`)
    })
    
    // Verify that the activity now uses the cloned element
    const activity = mockActivities.find(a => a.id === 'act-1')
    console.log(`Activity "${activity?.displayName}" now contains elements: ${activity?.elementIds.join(', ')}`)
  }

  // Test case 6: All derived permissions for a user
  console.log('\nTest Case 6: All Derived Permissions');
  const allPermissions = calculateAllDerivedPermissions('user-2');
  console.log('User-2 has access to the following resources:');
  allPermissions.forEach((level, resourceId) => {
    const resource = getResourceById(resourceId);
    console.log(
      `- ${resource?.type === 'element' ? 'Element' : 'Activity'} "${resourceId}": ${AccessLevelNames[level]}`
    );
  });
  
  // Test case 7: Complete permission table for caching
  console.log('\nTest Case 7: Complete Permission Table for Caching');
  const permissionTable = computeCompletePermissionTable();
  console.log(`Generated permission table for ${permissionTable.size} users`);
  
  // Print a sample of the permission table
  const sampleUserId = 'user-2';
  console.log(`\nSample permissions for ${sampleUserId}:`);
  const userPermissions = permissionTable.get(sampleUserId);
  if (userPermissions) {
    userPermissions.forEach((level, resourceId) => {
      const resource = getResourceById(resourceId);
      console.log(
        `- ${resource?.type === 'element' ? 'Element' : 'Activity'} "${resourceId}": ${AccessLevelNames[level]}`
      );
    });
  }
  
  // Test serialization and deserialization
  console.log('\nTest Case 8: Serialization and Deserialization');
  const serialized = serializePermissionTable(permissionTable);
  console.log('Serialized permission table (sample):');
  console.log(JSON.stringify(serialized['user-1'], null, 2));
  
  const deserialized = deserializePermissionTable(serialized);
  console.log(`\nDeserialized permission table has ${deserialized.size} users`);
  
  // Verify the deserialized data matches the original
  let isMatch = true;
  permissionTable.forEach((resourceMap, userId) => {
    const deserializedMap = deserialized.get(userId);
    if (!deserializedMap) {
      isMatch = false;
      return;
    }
    
    resourceMap.forEach((level, resourceId) => {
      if (deserializedMap.get(resourceId) !== level) {
        isMatch = false;
      }
    });
  });
  
  console.log(`Deserialized data matches original: ${isMatch}`);
  
  // Test permission lookup from the table
  console.log('\nTest Case 9: Permission Lookup from Table');
  const lookupResult1 = getPermissionFromTable(permissionTable, 'user-2', 'elem-1');
  console.log(`User-2's permission on Element-1 (from table): ${lookupResult1 !== null ? AccessLevelNames[lookupResult1] : 'No access'}`);
  
  const lookupResult2 = getPermissionFromTable(permissionTable, 'user-1', 'elem-3');
  console.log(`User-1's permission on Element-3 (from table): ${lookupResult2 !== null ? AccessLevelNames[lookupResult2] : 'No access'}`);
  
  // Test case 10: Activity-Element Permission Propagation
  console.log('\nTest Case 10: Activity-Element Permission Propagation')

  // Grant user-3 EDITOR access to activity-1
  const propagationResult = grantPermissionWithPropagation('act-1', 'user-3', AccessLevel.EDITOR, 'user-1')
  console.log(`Grant result: ${propagationResult.success ? 'Success' : 'Failed'} - ${propagationResult.message}`)

  if (propagationResult.propagatedGrants && propagationResult.propagatedGrants.length > 0) {
    console.log(`Propagated ${propagationResult.propagatedGrants.length} permissions to elements:`)
    propagationResult.propagatedGrants.forEach((grant) => {
      const element = mockElements.find((elem) => elem.id === grant.resourceId)
      console.log(`- Element "${element?.name}": ${AccessLevelNames[grant.level]}`)
    })
  }

  // Check if user-3 can now edit the activity with all its elements
  const editCheck = canEditActivityWithElements('act-1', 'user-3')
  console.log(`Can user-3 edit activity-1? ${editCheck.canEdit ? 'Yes' : 'No'}`)
  console.log(`Activity permission: ${editCheck.activityPermission !== null ? AccessLevelNames[editCheck.activityPermission] : 'None'}`)

  if (editCheck.elementsWithoutAccess.length > 0) {
    console.log(`Elements without sufficient access: ${editCheck.elementsWithoutAccess.length}`)
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
    type: 'activity',
    ownerId: 'user-1',
    elementIds: ['elem-1', 'elem-2'],
    isDeleted: false
  }
  mockActivities.push(activityX)
  
  // Grant user-d EDITOR access to activity-x with ACTIVITY_ONLY scope for elements
  console.log('Granting User D access to Activity X with activity-scoped element permissions:')
  const scopedResult = grantPermissionWithPropagation(
    'act-x', 
    'user-d', 
    AccessLevel.EDITOR, 
    'user-1',
    { elementScope: PermissionScope.ACTIVITY_ONLY }
  )
  
  console.log(`Grant result: ${scopedResult.success ? 'Success' : 'Failed'} - ${scopedResult.message}`)
  
  if (scopedResult.propagatedGrants && scopedResult.propagatedGrants.length > 0) {
    console.log(`Propagated ${scopedResult.propagatedGrants.length} scoped permissions to elements`)
  }
  
  // Check if user-d can access elements in different contexts
  const elem1InActivityContext = calculateEffectivePermission('elem-1', 'user-d', { activityId: 'act-x' })
  const elem1OutsideActivity = calculateEffectivePermission('elem-1', 'user-d')
  
  console.log(`User D's access to Element 1 within Activity X context: ${elem1InActivityContext !== null ? AccessLevelNames[elem1InActivityContext] : 'No access'}`)
  console.log(`User D's access to Element 1 outside activity context: ${elem1OutsideActivity !== null ? AccessLevelNames[elem1OutsideActivity] : 'No access'}`)
  
  // Check if user-d can edit the activity
  const editCheckScoped = canEditActivityWithElements('act-x', 'user-d')
  console.log(`Can User D edit Activity X? ${editCheckScoped.canEdit ? 'Yes' : 'No'}`)
  console.log(`Activity permission: ${editCheckScoped.activityPermission !== null ? AccessLevelNames[editCheckScoped.activityPermission] : 'None'}`)

  if (editCheckScoped.elementsWithoutAccess.length > 0) {
    console.log(`Elements without sufficient access: ${editCheckScoped.elementsWithoutAccess.length}`)
    editCheckScoped.elementsWithoutAccess.forEach((element) => {
      console.log(`- ${element.name} (${element.id})`)
    })
  }
}

// Run the demo
runPermissionDemo();
