import { AccessLevel } from './index'

// Define the permission level enum to match the database schema
export enum PermissionLevel {
  READ = 'READ', // read access (no modifications, no deletion, no sharing)
  WRITE = 'WRITE', // edit access (no deletion, no sharing)
  EXECUTE = 'EXECUTE', // e.g. for live quizzes: only inspect evaluation
  ADMIN = 'ADMIN', // e.g. admins can not only edit (= WRITE) but also change access rights
}

// Define the permission status enum to match the database schema
export enum PermissionStatus {
  REQUESTED = 'REQUESTED',
  GRANTED = 'GRANTED',
}

// Define the resource types that can have permissions
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

// Define the user group model
export interface UserGroup {
  id: number
  name: string
  ownerId: string
  members: string[] // Array of user IDs
  admins: string[] // Array of user IDs
  createdAt: Date
  updatedAt: Date
}

// Define the database permission model
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

// Define the derived permission model
export interface DerivedPermission {
  userId: string
  resourceId: string
  resourceType: ResourceType
  permissionLevel: PermissionLevel
  source: 'DIRECT' | 'GROUP' | 'OWNER'
  sourceGroupId?: number
  originalPermissionId: number
}

/**
 * Maps a database permission level to our internal AccessLevel
 * @param level The database permission level
 * @returns The corresponding internal access level
 */
export function mapPermissionLevelToAccessLevel(level: PermissionLevel): AccessLevel {
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
function getResourceInfo(permission: DatabasePermission): { type: ResourceType; id: string | number } | null {
  if (permission.catalogCollectionId) {
    return { type: ResourceType.CATALOG_COLLECTION, id: permission.catalogCollectionId }
  }
  if (permission.answerCollectionId) {
    return { type: ResourceType.ANSWER_COLLECTION, id: permission.answerCollectionId }
  }
  if (permission.elementId) {
    return { type: ResourceType.ELEMENT, id: permission.elementId }
  }
  if (permission.courseId) {
    return { type: ResourceType.COURSE, id: permission.courseId }
  }
  if (permission.liveQuizId) {
    return { type: ResourceType.LIVE_QUIZ, id: permission.liveQuizId }
  }
  if (permission.practiceQuizId) {
    return { type: ResourceType.PRACTICE_QUIZ, id: permission.practiceQuizId }
  }
  if (permission.microLearningId) {
    return { type: ResourceType.MICRO_LEARNING, id: permission.microLearningId }
  }
  if (permission.groupActivityId) {
    return { type: ResourceType.GROUP_ACTIVITY, id: permission.groupActivityId }
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
  
  // Process direct user permissions first
  grantedPermissions
    .filter((p) => p.userId !== undefined)
    .forEach((permission) => {
      const resourceInfo = getResourceInfo(permission)
      if (!resourceInfo || !permission.userId) return
      
      const key = `${permission.userId}:${resourceInfo.type}:${resourceInfo.id}`
      
      // Create derived permission
      const derivedPermission: DerivedPermission = {
        userId: permission.userId,
        resourceId: String(resourceInfo.id),
        resourceType: resourceInfo.type,
        permissionLevel: permission.permissionLevel,
        source: 'DIRECT',
        originalPermissionId: permission.id,
      }
      
      // Add to map (direct permissions take precedence, so we don't check if it exists)
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
    })
  
  // Process group permissions
  grantedPermissions
    .filter((p) => p.userGroupId !== undefined)
    .forEach((permission) => {
      const resourceInfo = getResourceInfo(permission)
      if (!resourceInfo || !permission.userGroupId) return
      
      // Find the group
      const group = userGroups.find((g) => g.id === permission.userGroupId)
      if (!group) return
      
      // For each member of the group, create a derived permission
      group.members.forEach((userId) => {
        const key = `${userId}:${resourceInfo.type}:${resourceInfo.id}`
        
        // Check if user already has a direct permission for this resource
        if (derivedPermissionsMap.has(key)) {
          const existingPermission = derivedPermissionsMap.get(key)!
          
          // If existing permission is direct or owner, it takes precedence
          if (existingPermission.source === 'DIRECT' || existingPermission.source === 'OWNER') {
            return
          }
          
          // If existing permission is from another group, compare levels
          if (existingPermission.source === 'GROUP') {
            const existingRank = getPermissionLevelRank(existingPermission.permissionLevel)
            const newRank = getPermissionLevelRank(permission.permissionLevel)
            
            // Only replace if new permission has higher rank
            if (newRank <= existingRank) {
              return
            }
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
      })
      
      // For admins, ensure they have at least ADMIN rights
      group.admins.forEach((userId) => {
        const key = `${userId}:${resourceInfo.type}:${resourceInfo.id}`
        
        // Create derived permission for admin
        const adminPermission: DerivedPermission = {
          userId,
          resourceId: String(resourceInfo.id),
          resourceType: resourceInfo.type,
          permissionLevel: PermissionLevel.ADMIN,
          source: 'GROUP',
          sourceGroupId: permission.userGroupId,
          originalPermissionId: permission.id,
        }
        
        // Check if user already has a permission for this resource
        if (derivedPermissionsMap.has(key)) {
          const existingPermission = derivedPermissionsMap.get(key)!
          
          // If existing permission is direct or owner, it takes precedence
          if (existingPermission.source === 'DIRECT' || existingPermission.source === 'OWNER') {
            return
          }
          
          // If existing permission is from another group, compare levels
          if (existingPermission.source === 'GROUP') {
            const existingRank = getPermissionLevelRank(existingPermission.permissionLevel)
            const adminRank = getPermissionLevelRank(PermissionLevel.ADMIN)
            
            // Only replace if admin permission has higher rank
            if (adminRank <= existingRank) {
              return
            }
          }
        }
        
        // Add admin permission to map
        derivedPermissionsMap.set(key, adminPermission)
      })
    })
  
  // Convert map values to array
  return Array.from(derivedPermissionsMap.values())
}

/**
 * Demo function to test the permission derivation
 */
export function runPermissionDerivationDemo(): void {
  console.log('=== PERMISSION DERIVATION DEMO ===')
  
  // Create sample user groups
  const userGroups: UserGroup[] = [
    {
      id: 1,
      name: 'Instructors',
      ownerId: 'user1',
      members: ['user2', 'user3', 'user4'],
      admins: ['user2'],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      name: 'Students',
      ownerId: 'user1',
      members: ['user5', 'user6', 'user7'],
      admins: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]
  
  // Create sample permissions
  const permissions: DatabasePermission[] = [
    // Direct user permissions
    {
      id: 1,
      permissionLevel: PermissionLevel.ADMIN,
      permissionStatus: PermissionStatus.GRANTED,
      userId: 'user1',
      objectOwnerId: 'user1',
      courseId: 'course1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      permissionLevel: PermissionLevel.WRITE,
      permissionStatus: PermissionStatus.GRANTED,
      userId: 'user3',
      objectOwnerId: 'user1',
      courseId: 'course1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 3,
      permissionLevel: PermissionLevel.READ,
      permissionStatus: PermissionStatus.GRANTED,
      userId: 'user5',
      objectOwnerId: 'user1',
      courseId: 'course1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    
    // Group permissions
    {
      id: 4,
      permissionLevel: PermissionLevel.WRITE,
      permissionStatus: PermissionStatus.GRANTED,
      userGroupId: 1, // Instructors
      objectOwnerId: 'user1',
      courseId: 'course1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 5,
      permissionLevel: PermissionLevel.READ,
      permissionStatus: PermissionStatus.GRANTED,
      userGroupId: 2, // Students
      objectOwnerId: 'user1',
      courseId: 'course1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    
    // Requested permission (should be ignored)
    {
      id: 6,
      permissionLevel: PermissionLevel.ADMIN,
      permissionStatus: PermissionStatus.REQUESTED,
      userId: 'user7',
      objectOwnerId: 'user1',
      courseId: 'course1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    
    // Conflicting permissions
    {
      id: 7,
      permissionLevel: PermissionLevel.READ,
      permissionStatus: PermissionStatus.GRANTED,
      userGroupId: 1, // Instructors
      objectOwnerId: 'user1',
      liveQuizId: 'quiz1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 8,
      permissionLevel: PermissionLevel.WRITE,
      permissionStatus: PermissionStatus.GRANTED,
      userId: 'user2', // Also in Instructors group
      objectOwnerId: 'user1',
      liveQuizId: 'quiz1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]
  
  // Derive effective permissions
  const derivedPermissions = deriveEffectivePermissions(permissions, userGroups)
  
  // Print results
  console.log(`Derived ${derivedPermissions.length} effective permissions:`)
  derivedPermissions.forEach((permission) => {
    console.log(`- User ${permission.userId} has ${permission.permissionLevel} access to ${permission.resourceType}:${permission.resourceId} (Source: ${permission.source}${permission.sourceGroupId ? ` Group ${permission.sourceGroupId}` : ''})`)
  })
  
  // Analyze specific cases
  console.log('\nSpecific cases:')
  
  // Case 1: User with direct permission
  const user3Permissions = derivedPermissions.filter((p) => p.userId === 'user3' && p.resourceType === ResourceType.COURSE)
  console.log('User3 course permissions:', user3Permissions)
  
  // Case 2: User with group permission only
  const user4Permissions = derivedPermissions.filter((p) => p.userId === 'user4' && p.resourceType === ResourceType.COURSE)
  console.log('User4 course permissions (via group only):', user4Permissions)
  
  // Case 3: User with conflicting permissions (direct should win)
  const user2QuizPermissions = derivedPermissions.filter((p) => p.userId === 'user2' && p.resourceType === ResourceType.LIVE_QUIZ)
  console.log('User2 quiz permissions (direct vs group conflict):', user2QuizPermissions)
  
  // Case 4: User with requested permission (should not appear)
  const user7Permissions = derivedPermissions.filter((p) => p.userId === 'user7' && p.resourceType === ResourceType.COURSE)
  console.log('User7 course permissions (requested should be ignored):', user7Permissions)
}
