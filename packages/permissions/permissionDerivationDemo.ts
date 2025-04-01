import {
  DatabasePermission,
  DerivedPermission,
  deriveEffectivePermissions,
  PermissionLevel,
  PermissionStatus,
  ResourceType,
  UserGroup,
} from './databasePermissions.js'

// ===== Test Helpers (moved from databasePermissions.ts) =====

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

// ===== Demo Function (moved from databasePermissions.ts) =====

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
  derivedPermissions.forEach((permission: DerivedPermission) => {
    console.log(
      `- User ${permission.userId} has ${permission.permissionLevel} access to ${permission.resourceType}:${permission.resourceId} (Source: ${permission.source}${permission.sourceGroupId ? ` Group ${permission.sourceGroupId}` : ''})`
    )
  })

  // Analyze specific cases
  console.log('\n=== EDGE CASE ANALYSIS ===')

  // Case 1: User with direct permission
  const user3Permissions = derivedPermissions.filter(
    (p: DerivedPermission) =>
      p.userId === 'user3' && p.resourceType === ResourceType.COURSE
  )
  console.log('1. User3 course permissions (direct):', user3Permissions)

  // Case 2: User with group permission only
  const user4Permissions = derivedPermissions.filter(
    (p: DerivedPermission) =>
      p.userId === 'user4' && p.resourceType === ResourceType.COURSE
  )
  console.log('2. User4 course permissions (via group only):', user4Permissions)

  // Case 3: User with conflicting permissions (direct should win)
  const user2QuizPermissions = derivedPermissions.filter(
    (p: DerivedPermission) =>
      p.userId === 'user2' && p.resourceType === ResourceType.LIVE_QUIZ
  )
  console.log(
    '3. User2 quiz permissions (direct vs group conflict):',
    user2QuizPermissions
  )

  // Case 4: User with requested permission (should not appear)
  const user7Permissions = derivedPermissions.filter(
    (p: DerivedPermission) =>
      p.userId === 'user7' && p.resourceType === ResourceType.COURSE
  )
  console.log(
    '4. User7 course permissions (requested should be ignored):',
    user7Permissions
  )

  // Case 5: User in multiple groups (highest permission should win)
  const user8ElementPermissions = derivedPermissions.filter(
    (p: DerivedPermission) =>
      p.userId === 'user8' && p.resourceType === ResourceType.ELEMENT
  )
  console.log(
    '5. User8 element permissions (in multiple groups):',
    user8ElementPermissions
  )

  // Case 6: Group admin getting ADMIN rights
  const user9Permissions = derivedPermissions.filter(
    (p: DerivedPermission) =>
      p.userId === 'user9' && p.resourceType === ResourceType.PRACTICE_QUIZ
  )
  console.log(
    '6. User9 practice quiz permissions (group admin):',
    user9Permissions
  )

  // Case 7: Empty group (should not create any permissions)
  const emptyGroupPermissions = derivedPermissions.filter(
    (p: DerivedPermission) => p.resourceType === ResourceType.MICRO_LEARNING
  )
  console.log(
    '7. Micro learning permissions (empty group):',
    emptyGroupPermissions
  )

  // Case 8: Direct permission with lower level than group permission
  const user4ElementPermissions = derivedPermissions.filter(
    (p: DerivedPermission) =>
      p.userId === 'user4' && p.resourceType === ResourceType.ELEMENT
  )
  console.log(
    '8. User4 element permissions (direct lower than group):',
    user4ElementPermissions
  )

  // Case 9: Owner permissions
  const user11Permissions = derivedPermissions.filter(
    (p: DerivedPermission) => p.userId === 'user11'
  )
  console.log('9. User11 catalog permissions (owner):', user11Permissions)

  // Case 10: Multiple direct permissions (highest should win)
  const user12Permissions = derivedPermissions.filter(
    (p: DerivedPermission) => p.userId === 'user12'
  )
  console.log(
    '10. User12 answer collection permissions (multiple direct):',
    user12Permissions
  )

  // Case 11: Owner permissions taking precedence
  const user1Permissions = derivedPermissions.filter(
    (p: DerivedPermission) =>
      p.userId === 'user1' && p.resourceType === ResourceType.COURSE
  )
  console.log('11. User1 course permissions (owner):', user1Permissions)
}

// Run the permission derivation demo
console.log('Starting permission derivation demo...')
runPermissionDerivationDemo()
