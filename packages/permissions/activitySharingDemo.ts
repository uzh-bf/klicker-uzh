import {
  AccessLevel,
  Activity,
  ActivityType,
  AuditActionType,
  AuditLogEntry,
  calculateEffectivePermission,
  Element,
  getAuditLogs,
  mockActivities,
  mockElements,
  mockPermissionGrants,
  mockUsers,
  ResourceType,
  shareActivity,
  ShareMode,
} from './index.js'

// Define a local interface for users in this demo, including email
interface DemoUser {
  id: string
  name: string
  email?: string // Made email optional to match original mockUsers if needed, though it's added here
}

/**
 * Demonstrates the activity sharing functionality with different sharing modes
 */
export function runActivitySharingDemo(): void {
  console.log('=== ACTIVITY SHARING DEMO ===')

  // Create test users if they don't exist
  if (!mockUsers.some((u) => u.id === 'user1')) {
    // Removed User type hint, relies on inferred type
    mockUsers.push({
      id: 'user1',
      name: 'Owner User',
      email: 'owner@example.com', // This property is not in the base mockUsers type
    })
  }

  if (!mockUsers.some((u) => u.id === 'user2')) {
    // Removed User type hint
    mockUsers.push({
      id: 'user2',
      name: 'Viewer User',
      email: 'viewer@example.com',
    })
  }

  if (!mockUsers.some((u) => u.id === 'user3')) {
    // Removed User type hint
    mockUsers.push({
      id: 'user3',
      name: 'Editor User',
      email: 'editor@example.com',
    })
  }

  // Create test elements if they don't exist
  const elementIds: string[] = []
  for (let i = 1; i <= 3; i++) {
    const elementId = `element${i}`
    if (!mockElements.some((e: Element) => e.id === elementId)) {
      mockElements.push({
        id: elementId,
        type: ResourceType.ELEMENT,
        name: `Test Element ${i}`,
        content: `Content for element ${i}`,
        ownerId: 'user1',
        createdAt: new Date(),
      })
    }
    elementIds.push(elementId)
  }

  // Create a test activity if it doesn't exist
  const activityId = 'activity1'
  if (!mockActivities.some((a: Activity) => a.id === activityId)) {
    mockActivities.push({
      id: activityId,
      type: ResourceType.ACTIVITY,
      activityType: ActivityType.PRACTICE_QUIZ,
      name: 'Test Activity',
      displayName: 'Test Activity Display Name',
      elementIds,
      ownerId: 'user1',
      createdAt: new Date(),
    })
  }

  // Clear any existing permissions
  const filteredPermissions = mockPermissionGrants.filter(
    (p: PermissionGrant) =>
      !(p.resourceId === activityId || elementIds.includes(p.resourceId))
  )
  mockPermissionGrants.length = 0
  mockPermissionGrants.push(...filteredPermissions)

  console.log(
    'Initial setup complete. Created activity with 3 elements owned by user1.'
  )

  // Scenario 1: Share activity with activity-scoped element permissions
  console.log('\nScenario 1: Sharing activity with ACTIVITY_ONLY mode')
  const activityOnlyResult = shareActivity(activityId, {
    shareMode: ShareMode.ACTIVITY_ONLY,
    level: AccessLevel.VIEWER,
    userId: 'user2',
    grantedBy: 'user1',
    reason: 'Demo of activity-only sharing',
  })

  console.log(
    `Share result: ${activityOnlyResult.success ? 'Success' : 'Failed'}`
  )
  console.log(`Message: ${activityOnlyResult.message}`)
  console.log(
    `Created ${activityOnlyResult.elementPermissions?.length || 0} element permissions`
  )

  // Test access in different contexts
  console.log('\nTesting access for user2:')
  console.log(
    `Access to activity: ${calculateEffectivePermission(activityId, 'user2')}`
  )

  // Test element access within activity context
  console.log('\nElement access within activity context:')
  for (const elementId of elementIds) {
    const permission = calculateEffectivePermission(elementId, 'user2', {
      activityId,
    })
    console.log(`Access to ${elementId} within activity: ${permission}`)
  }

  // Test element access outside activity context
  console.log('\nElement access outside activity context:')
  for (const elementId of elementIds) {
    const permission = calculateEffectivePermission(elementId, 'user2')
    console.log(`Access to ${elementId} outside activity: ${permission}`)
  }

  // Scenario 2: Share activity with global element permissions
  console.log('\nScenario 2: Sharing activity with ACTIVITY_AND_ELEMENTS mode')

  // Clear previous permissions for user3
  const filteredUser3Permissions = mockPermissionGrants.filter(
    (p: PermissionGrant) =>
      !(
        p.userId === 'user3' &&
        (p.resourceId === activityId || elementIds.includes(p.resourceId))
      )
  )
  mockPermissionGrants.length = 0
  mockPermissionGrants.push(...filteredUser3Permissions)

  const globalResult = shareActivity(activityId, {
    shareMode: ShareMode.ACTIVITY_AND_ELEMENTS,
    level: AccessLevel.EDITOR,
    userId: 'user3',
    grantedBy: 'user1',
    reason: 'Demo of global sharing',
  })

  console.log(`Share result: ${globalResult.success ? 'Success' : 'Failed'}`)
  console.log(`Message: ${globalResult.message}`)
  console.log(
    `Created ${globalResult.elementPermissions?.length || 0} element permissions`
  )

  // Test access in different contexts
  console.log('\nTesting access for user3:')
  console.log(
    `Access to activity: ${calculateEffectivePermission(activityId, 'user3')}`
  )

  // Test element access within activity context
  console.log('\nElement access within activity context:')
  for (const elementId of elementIds) {
    const permission = calculateEffectivePermission(elementId, 'user3', {
      activityId,
    })
    console.log(`Access to ${elementId} within activity: ${permission}`)
  }

  // Test element access outside activity context
  console.log('\nElement access outside activity context:')
  for (const elementId of elementIds) {
    const permission = calculateEffectivePermission(elementId, 'user3')
    console.log(`Access to ${elementId} outside activity: ${permission}`)
  }

  // Show audit logs for the sharing actions
  console.log('\nAudit logs for activity sharing:')
  const sharingLogs = getAuditLogs({
    actionType: AuditActionType.ACTIVITY_SHARE,
  })

  sharingLogs.forEach((log: AuditLogEntry, index: number) => {
    console.log(`\nLog #${index + 1}:`)
    console.log(`Action: ${log.actionType}`)
    console.log(
      // Using DemoUser type for the find callback user
      `Performed by: ${log.performedBy} (${(mockUsers.find((u: DemoUser) => u.id === log.performedBy) as DemoUser)?.name || 'Unknown User'})`
    )
    console.log(`Resource: ${log.resourceId} (${log.resourceType})`)
    console.log(`Timestamp: ${log.timestamp}`)
    console.log('Details:', log.details)
  })

  console.log('\n=== END OF ACTIVITY SHARING DEMO ===')
}

// Run the demo
