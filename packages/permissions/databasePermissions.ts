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

// ===== Test Cases and Demo =====

/**
 * Creates a test permission object with default values
 * @param overrides Properties to override in the default permission
 * @returns A database permission object for testing
 */
function createTestPermission(
  overrides: Partial<DatabasePermission> = {}
): DatabasePermission {
  return {
    id: 1,
    permissionLevel: PermissionLevel.READ,
    permissionStatus: PermissionStatus.GRANTED,
    objectOwnerId: 'owner1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Creates a test user group with default values
 * @param overrides Properties to override in the default group
 * @returns A user group object for testing
 */
function createTestGroup(overrides: Partial<UserGroup> = {}): UserGroup {
  return {
    id: 1,
    name: 'Test Group',
    ownerId: 'owner1',
    members: ['member1', 'member2'],
    admins: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * Demo function to test the permission derivation with various edge cases
 */
export function runPermissionDerivationDemo(): void {
  console.log('=== PERMISSION DERIVATION DEMO ===')

  // Create sample user groups
  const userGroups: UserGroup[] = [
    createTestGroup({
      id: 1,
      name: 'Instructors',
      ownerId: 'user1',
      members: ['user2', 'user3', 'user4', 'user8'], // user8 is in both groups
      admins: ['user2'],
    }),
    createTestGroup({
      id: 2,
      name: 'Students',
      ownerId: 'user1',
      members: ['user5', 'user6', 'user7', 'user8'], // user8 is in both groups
      admins: [],
    }),
    createTestGroup({
      id: 3,
      name: 'Teaching Assistants',
      ownerId: 'user1',
      members: ['user9', 'user10'],
      admins: ['user9'],
    }),
    // Empty group (edge case)
    createTestGroup({
      id: 4,
      name: 'Empty Group',
      ownerId: 'user1',
      members: [],
      admins: [],
    }),
  ]

  // Create sample permissions with various edge cases
  const permissions: DatabasePermission[] = [
    // Basic permissions
    createTestPermission({
      id: 1,
      permissionLevel: PermissionLevel.ADMIN,
      userId: 'user1',
      objectOwnerId: 'user1', // Owner permission
      courseId: 'course1',
    }),
    createTestPermission({
      id: 2,
      permissionLevel: PermissionLevel.WRITE,
      userId: 'user3',
      objectOwnerId: 'user1',
      courseId: 'course1',
    }),
    createTestPermission({
      id: 3,
      permissionLevel: PermissionLevel.READ,
      userId: 'user5',
      objectOwnerId: 'user1',
      courseId: 'course1',
    }),

    // Group permissions
    createTestPermission({
      id: 4,
      permissionLevel: PermissionLevel.WRITE,
      userGroupId: 1, // Instructors
      objectOwnerId: 'user1',
      courseId: 'course1',
    }),
    createTestPermission({
      id: 5,
      permissionLevel: PermissionLevel.READ,
      userGroupId: 2, // Students
      objectOwnerId: 'user1',
      courseId: 'course1',
    }),

    // EDGE CASE: Requested permission (should be ignored)
    createTestPermission({
      id: 6,
      permissionLevel: PermissionLevel.ADMIN,
      permissionStatus: PermissionStatus.REQUESTED,
      userId: 'user7',
      objectOwnerId: 'user1',
      courseId: 'course1',
    }),

    // EDGE CASE: Conflicting direct vs group permissions
    createTestPermission({
      id: 7,
      permissionLevel: PermissionLevel.READ,
      userGroupId: 1, // Instructors
      objectOwnerId: 'user1',
      liveQuizId: 'quiz1',
    }),
    createTestPermission({
      id: 8,
      permissionLevel: PermissionLevel.WRITE,
      userId: 'user2', // Also in Instructors group
      objectOwnerId: 'user1',
      liveQuizId: 'quiz1',
    }),

    // EDGE CASE: User in multiple groups with different permission levels
    createTestPermission({
      id: 9,
      permissionLevel: PermissionLevel.READ,
      userGroupId: 2, // Students
      objectOwnerId: 'user1',
      elementId: 100,
    }),
    createTestPermission({
      id: 10,
      permissionLevel: PermissionLevel.WRITE,
      userGroupId: 1, // Instructors
      objectOwnerId: 'user1',
      elementId: 100,
    }),

    // EDGE CASE: Group admin with lower group permission
    createTestPermission({
      id: 11,
      permissionLevel: PermissionLevel.READ,
      userGroupId: 3, // Teaching Assistants
      objectOwnerId: 'user1',
      practiceQuizId: 'practice1',
    }),

    // EDGE CASE: Permission for empty group
    createTestPermission({
      id: 12,
      permissionLevel: PermissionLevel.ADMIN,
      userGroupId: 4, // Empty Group
      objectOwnerId: 'user1',
      microLearningId: 'micro1',
    }),

    // EDGE CASE: Direct permission with lower level than group permission
    createTestPermission({
      id: 13,
      permissionLevel: PermissionLevel.READ,
      userId: 'user4',
      objectOwnerId: 'user1',
      elementId: 100,
    }),

    // EDGE CASE: Owner not explicitly granted any permission
    createTestPermission({
      id: 14,
      permissionLevel: PermissionLevel.READ,
      userId: 'user11',
      objectOwnerId: 'user11', // User11 is owner but only has READ
      catalogCollectionId: 'catalog1',
    }),

    // EDGE CASE: Multiple direct permissions with different levels
    createTestPermission({
      id: 15,
      permissionLevel: PermissionLevel.READ,
      userId: 'user12',
      objectOwnerId: 'user1',
      answerCollectionId: 200,
    }),
    createTestPermission({
      id: 16,
      permissionLevel: PermissionLevel.WRITE,
      userId: 'user12',
      objectOwnerId: 'user1',
      answerCollectionId: 200,
    }),
  ]

  // Derive effective permissions
  const derivedPermissions = deriveEffectivePermissions(permissions, userGroups)

  // Print results
  console.log(`Derived ${derivedPermissions.length} effective permissions:`)
  derivedPermissions.forEach((permission) => {
    console.log(
      `- User ${permission.userId} has ${permission.permissionLevel} access to ${permission.resourceType}:${permission.resourceId} (Source: ${permission.source}${permission.sourceGroupId ? ` Group ${permission.sourceGroupId}` : ''})`
    )
  })

  // Analyze specific cases
  console.log('\n=== EDGE CASE ANALYSIS ===')

  // Case 1: User with direct permission
  const user3Permissions = derivedPermissions.filter(
    (p) => p.userId === 'user3' && p.resourceType === ResourceType.COURSE
  )
  console.log('1. User3 course permissions (direct):', user3Permissions)

  // Case 2: User with group permission only
  const user4Permissions = derivedPermissions.filter(
    (p) => p.userId === 'user4' && p.resourceType === ResourceType.COURSE
  )
  console.log('2. User4 course permissions (via group only):', user4Permissions)

  // Case 3: User with conflicting permissions (direct should win)
  const user2QuizPermissions = derivedPermissions.filter(
    (p) => p.userId === 'user2' && p.resourceType === ResourceType.LIVE_QUIZ
  )
  console.log(
    '3. User2 quiz permissions (direct vs group conflict):',
    user2QuizPermissions
  )

  // Case 4: User with requested permission (should not appear)
  const user7Permissions = derivedPermissions.filter(
    (p) => p.userId === 'user7' && p.resourceType === ResourceType.COURSE
  )
  console.log(
    '4. User7 course permissions (requested should be ignored):',
    user7Permissions
  )

  // Case 5: User in multiple groups (highest permission should win)
  const user8ElementPermissions = derivedPermissions.filter(
    (p) => p.userId === 'user8' && p.resourceType === ResourceType.ELEMENT
  )
  console.log(
    '5. User8 element permissions (in multiple groups):',
    user8ElementPermissions
  )

  // Case 6: Group admin getting ADMIN rights
  const user9Permissions = derivedPermissions.filter(
    (p) => p.userId === 'user9' && p.resourceType === ResourceType.PRACTICE_QUIZ
  )
  console.log(
    '6. User9 practice quiz permissions (group admin):',
    user9Permissions
  )

  // Case 7: Empty group (should not create any permissions)
  const emptyGroupPermissions = derivedPermissions.filter(
    (p) => p.resourceType === ResourceType.MICRO_LEARNING
  )
  console.log(
    '7. Micro learning permissions (empty group):',
    emptyGroupPermissions
  )

  // Case 8: Direct permission with lower level than group permission
  const user4ElementPermissions = derivedPermissions.filter(
    (p) => p.userId === 'user4' && p.resourceType === ResourceType.ELEMENT
  )
  console.log(
    '8. User4 element permissions (direct lower than group):',
    user4ElementPermissions
  )

  // Case 9: Owner permissions
  const user11Permissions = derivedPermissions.filter(
    (p) => p.userId === 'user11'
  )
  console.log('9. User11 catalog permissions (owner):', user11Permissions)

  // Case 10: Multiple direct permissions (highest should win)
  const user12Permissions = derivedPermissions.filter(
    (p) => p.userId === 'user12'
  )
  console.log(
    '10. User12 answer collection permissions (multiple direct):',
    user12Permissions
  )

  // Case 11: Owner permissions taking precedence
  const user1Permissions = derivedPermissions.filter(
    (p) => p.userId === 'user1' && p.resourceType === ResourceType.COURSE
  )
  console.log('11. User1 course permissions (owner):', user1Permissions)
}
