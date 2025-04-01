import { AccessLevel } from './index'

// ===== Type Definitions =====

/**
 * Permission levels in the database schema
 * Defines the types of access a user can have to a resource
 */
export enum PermissionLevel {
  READ = 'READ', // read access (no modifications, no deletion, no sharing)
  WRITE = 'WRITE', // edit access (no deletion, no sharing)
  EXECUTE = 'EXECUTE', // e.g. for live quizzes: only inspect evaluation
  ADMIN = 'ADMIN', // e.g. admins can not only edit (= WRITE) but also change access rights
}

/**
 * Status of a permission request
 */
export enum PermissionStatus {
  REQUESTED = 'REQUESTED', // Permission has been requested but not yet granted
  GRANTED = 'GRANTED', // Permission has been granted and is active
}

/**
 * Types of resources that can have permissions
 * Matches the database schema resource types
 */
export enum ResourceType {
  CATALOG_COLLECTION = 'CATALOG_COLLECTION',
  ANSWER_COLLECTION = 'ANSWER_COLLECTION',
  ELEMENT = 'ELEMENT',
  COURSE = 'COURSE',
  LIVE_QUIZ = 'LIVE_QUIZ',
  PRACTICE_QUIZ = 'PRACTICE_QUIZ',
  MICRO_LEARNING = 'MICRO_LEARNING',
  GROUP_ACTIVITY = 'GROUP_ACTIVITY',
}

/**
 * Source of a derived permission
 */
export type PermissionSource = 'DIRECT' | 'GROUP' | 'OWNER'

/**
 * User group model from the database
 */
export interface UserGroup {
  id: number
  name: string
  ownerId: string
  members: string[] // Array of user IDs
  admins: string[] // Array of user IDs (subset of members)
  createdAt: Date
  updatedAt: Date
}

/**
 * Database permission model that matches the Prisma schema
 */
export interface DatabasePermission {
  id: number
  permissionLevel: PermissionLevel
  permissionStatus: PermissionStatus
  userId?: string
  userGroupId?: number
  objectOwnerId?: string

  // Resource identifiers - only one of these will be set
  catalogCollectionId?: string
  answerCollectionId?: number
  elementId?: number
  courseId?: string
  liveQuizId?: string
  practiceQuizId?: string
  microLearningId?: string
  groupActivityId?: string

  createdAt: Date
  updatedAt: Date
}

/**
 * Derived permission model after processing database permissions
 */
export interface DerivedPermission {
  userId: string
  resourceId: string
  resourceType: ResourceType
  permissionLevel: PermissionLevel
  source: PermissionSource
  sourceGroupId?: number
  originalPermissionId: number
}

/**
 * Resource information extracted from a database permission
 */
export interface ResourceInfo {
  type: ResourceType
  id: string | number
}

// ===== Helper Functions =====

/**
 * Maps a database permission level to our internal AccessLevel
 * @param level The database permission level
 * @returns The corresponding internal access level
 */
export function mapPermissionLevelToAccessLevel(
  level: PermissionLevel
): AccessLevel {
  switch (level) {
    case PermissionLevel.READ:
      return AccessLevel.VIEWER
    case PermissionLevel.WRITE:
      return AccessLevel.EDITOR
    case PermissionLevel.EXECUTE:
      return AccessLevel.VIEWER // Map EXECUTE to VIEWER for now
    case PermissionLevel.ADMIN:
      return AccessLevel.ADMIN
    default:
      return AccessLevel.VIEWER
  }
}

/**
 * Gets the resource type and ID from a database permission
 * @param permission The database permission
 * @returns An object with the resource type and ID, or null if not found
 */
function getResourceInfo(permission: DatabasePermission): ResourceInfo | null {
  const resourceMapping: [keyof DatabasePermission, ResourceType][] = [
    ['catalogCollectionId', ResourceType.CATALOG_COLLECTION],
    ['answerCollectionId', ResourceType.ANSWER_COLLECTION],
    ['elementId', ResourceType.ELEMENT],
    ['courseId', ResourceType.COURSE],
    ['liveQuizId', ResourceType.LIVE_QUIZ],
    ['practiceQuizId', ResourceType.PRACTICE_QUIZ],
    ['microLearningId', ResourceType.MICRO_LEARNING],
    ['groupActivityId', ResourceType.GROUP_ACTIVITY],
  ]

  for (const [key, type] of resourceMapping) {
    const id = permission[key]
    if (id !== undefined && id !== null) {
      return { type, id: id as string | number }
    }
  }

  return null
}

/**
 * Get the rank of a permission level for comparison
 * @param level The permission level
 * @returns A numeric rank (higher means more permissions)
 */
function getPermissionLevelRank(level: PermissionLevel): number {
  switch (level) {
    case PermissionLevel.READ:
      return 1
    case PermissionLevel.EXECUTE:
      return 2
    case PermissionLevel.WRITE:
      return 3
    case PermissionLevel.ADMIN:
      return 4
    default:
      return 0
  }
}

// ===== Core Permission Derivation =====

/**
 * Creates a unique key for the permission map
 * @param userId User ID
 * @param resourceType Resource type
 * @param resourceId Resource ID
 * @returns A unique string key
 */
function createPermissionKey(
  userId: string,
  resourceType: ResourceType,
  resourceId: string | number
): string {
  return `${userId}:${resourceType}:${resourceId}`
}

/**
 * Processes direct user permissions and adds them to the permissions map
 * @param permissions List of granted permissions
 * @param derivedPermissionsMap Map to store derived permissions
 */
function processDirectPermissions(
  permissions: DatabasePermission[],
  derivedPermissionsMap: Map<string, DerivedPermission>
): void {
  // Get only permissions assigned directly to users
  const directPermissions = permissions.filter((p) => p.userId !== undefined)

  for (const permission of directPermissions) {
    const resourceInfo = getResourceInfo(permission)
    if (!resourceInfo || !permission.userId) continue

    const key = createPermissionKey(
      permission.userId,
      resourceInfo.type,
      resourceInfo.id
    )

    // Create derived permission
    const derivedPermission: DerivedPermission = {
      userId: permission.userId,
      resourceId: String(resourceInfo.id),
      resourceType: resourceInfo.type,
      permissionLevel: permission.permissionLevel,
      source: 'DIRECT',
      originalPermissionId: permission.id,
    }

    // Add to map (direct permissions take precedence over group permissions)
    derivedPermissionsMap.set(key, derivedPermission)

    // If the user is the owner, add an owner-derived permission
    if (permission.objectOwnerId === permission.userId) {
      const ownerPermission: DerivedPermission = {
        userId: permission.userId,
        resourceId: String(resourceInfo.id),
        resourceType: resourceInfo.type,
        permissionLevel: PermissionLevel.ADMIN, // Owners always have ADMIN rights
        source: 'OWNER',
        originalPermissionId: permission.id,
      }

      // Owner permissions take precedence over everything
      derivedPermissionsMap.set(key, ownerPermission)
    }
  }
}

/**
 * Determines if a new permission should replace an existing one based on precedence rules
 * @param existing Existing permission
 * @param newPermLevel New permission level
 * @param newSource New permission source
 * @returns True if the new permission should replace the existing one
 */
function shouldReplacePermission(
  existing: DerivedPermission,
  newPermLevel: PermissionLevel,
  newSource: PermissionSource
): boolean {
  // Owner permissions have highest precedence
  if (existing.source === 'OWNER') return false

  // Direct permissions take precedence over group permissions
  if (existing.source === 'DIRECT' && newSource === 'GROUP') return false

  // If both are from groups or both are direct, higher level wins
  if (existing.source === newSource) {
    const existingRank = getPermissionLevelRank(existing.permissionLevel)
    const newRank = getPermissionLevelRank(newPermLevel)
    return newRank > existingRank
  }

  // If new is direct and existing is group, direct wins
  if (newSource === 'DIRECT' && existing.source === 'GROUP') return true

  // If new is owner, it always wins
  if (newSource === 'OWNER') return true

  return false
}

/**
 * Processes group permissions and adds them to the permissions map
 * @param permissions List of granted permissions
 * @param userGroups List of user groups
 * @param derivedPermissionsMap Map to store derived permissions
 */
function processGroupPermissions(
  permissions: DatabasePermission[],
  userGroups: UserGroup[],
  derivedPermissionsMap: Map<string, DerivedPermission>
): void {
  // Get only permissions assigned to groups
  const groupPermissions = permissions.filter(
    (p) => p.userGroupId !== undefined
  )

  for (const permission of groupPermissions) {
    const resourceInfo = getResourceInfo(permission)
    if (!resourceInfo || !permission.userGroupId) continue

    // Find the group
    const group = userGroups.find((g) => g.id === permission.userGroupId)
    if (!group) continue

    // Process regular members
    for (const userId of group.members) {
      const key = createPermissionKey(
        userId,
        resourceInfo.type,
        resourceInfo.id
      )

      // Check if user already has a permission for this resource
      if (derivedPermissionsMap.has(key)) {
        const existingPermission = derivedPermissionsMap.get(key)!

        // Check precedence rules
        if (
          !shouldReplacePermission(
            existingPermission,
            permission.permissionLevel,
            'GROUP'
          )
        ) {
          continue
        }
      }

      // Create derived permission from group membership
      const derivedPermission: DerivedPermission = {
        userId,
        resourceId: String(resourceInfo.id),
        resourceType: resourceInfo.type,
        permissionLevel: permission.permissionLevel,
        source: 'GROUP',
        sourceGroupId: permission.userGroupId,
        originalPermissionId: permission.id,
      }

      // Add to map
      derivedPermissionsMap.set(key, derivedPermission)
    }

    // Process group admins (they get ADMIN rights)
    for (const adminId of group.admins) {
      const key = createPermissionKey(
        adminId,
        resourceInfo.type,
        resourceInfo.id
      )

      // Check if admin already has a permission for this resource
      if (derivedPermissionsMap.has(key)) {
        const existingPermission = derivedPermissionsMap.get(key)!

        // Check precedence rules
        if (
          !shouldReplacePermission(
            existingPermission,
            PermissionLevel.ADMIN,
            'GROUP'
          )
        ) {
          continue
        }
      }

      // Create derived permission for admin
      const adminPermission: DerivedPermission = {
        userId: adminId,
        resourceId: String(resourceInfo.id),
        resourceType: resourceInfo.type,
        permissionLevel: PermissionLevel.ADMIN,
        source: 'GROUP',
        sourceGroupId: permission.userGroupId,
        originalPermissionId: permission.id,
      }

      // Add admin permission to map
      derivedPermissionsMap.set(key, adminPermission)
    }
  }
}

/**
 * Derives all effective permissions from a list of direct database permissions
 * @param permissions List of direct permissions from the database
 * @param userGroups List of user groups with their members
 * @returns A deduplicated list of effective permissions with precedence resolved
 */
export function deriveEffectivePermissions(
  permissions: DatabasePermission[],
  userGroups: UserGroup[]
): DerivedPermission[] {
  // Filter out permissions that are not granted
  const grantedPermissions = permissions.filter(
    (p) => p.permissionStatus === PermissionStatus.GRANTED
  )

  // Map to store derived permissions: key = "userId:resourceType:resourceId"
  const derivedPermissionsMap = new Map<string, DerivedPermission>()

  // Process permissions in order of precedence
  processDirectPermissions(grantedPermissions, derivedPermissionsMap)
  processGroupPermissions(grantedPermissions, userGroups, derivedPermissionsMap)

  // Convert map values to array
  return Array.from(derivedPermissionsMap.values())
}
