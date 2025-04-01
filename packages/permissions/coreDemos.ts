import {
  AccessLevel,
  AccessLevelNames,
  addGroupMember,
  AuditActionType,
  AuditLogEntry,
  calculateAllDerivedPermissions,
  calculateEffectivePermission,
  canDeleteElement,
  canEditActivityWithElements,
  cloneElementForActivities,
  computeCompletePermissionTable,
  deserializePermissionTable,
  getAuditLogs,
  getDirectPermission,
  getGroupMembers,
  getResourceAuditLogs,
  getResourceById,
  getUserActionAuditLogs,
  getUserAffectedAuditLogs,
  grantPermission,
  grantPermissionWithPropagation,
  isResourceOwner,
  mockActivities,
  mockAuditLogs,
  mockElements,
  mockPermissionGrants,
  mockUsers,
  PermissionScope,
  propagateActivityPermissionsToElements,
  removeGroupMember,
  ResourceType,
  revokePermission,
  serializePermissionTable,
  softDeleteElement,
  transferOwnership,
} from './index'

// Helper function to print audit logs (moved from index.ts)
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
    // Need to add shareMode and accessLevel to AuditLogEntry details type
    // console.log(`  Share mode: ${log.details?.shareMode}`)
    // console.log(`  Access level: ${log.details?.accessLevel}`)
    console.log(`  Reason: ${log.details?.reason}`)
  }
}

// Demo function to test the permission system (moved from index.ts)
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
  const lookupResult1 = permissionTable.get('user-2')?.get('elem-1') // Use direct map access for efficiency
  console.log(
    `User-2's permission on Element-1 (from table): ${lookupResult1 !== null && lookupResult1 !== undefined ? AccessLevelNames[lookupResult1] : 'No access'}`
  )

  const lookupResult2 = permissionTable.get('user-1')?.get('elem-3')
  console.log(
    `User-1's permission on Element-3 (from table): ${lookupResult2 !== null && lookupResult2 !== undefined ? AccessLevelNames[lookupResult2] : 'No access'}`
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

  // Ensure activityX has required properties (added missing ones)
  const activityX = {
    id: 'act-x',
    ownerId: 'user-1',
    createdAt: new Date(),
    type: ResourceType.ACTIVITY,
    activityType: 'practiceQuiz', // Added missing property
    name: 'Activity X',
    displayName: 'Activity X Display', // Added missing property
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

// Demo function to test user group permissions (moved from index.ts)
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

/**
 * Demo function to showcase audit logging functionality (moved from index.ts)
 */
export function runAuditLoggingDemo(): void {
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
