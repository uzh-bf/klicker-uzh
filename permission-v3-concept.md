# Permission System v3.0 - Intermediate Operation Table Architecture

**Date**: 2025-05-30
**Status**: Concept - Team Review Required
**Authors**: Development Team

## Core Assumptions

**CRITICAL**: This permission system design is based on the following fundamental assumptions:

1. **Derived Permissions Only for Authorization**: All authorization logic in the application looks **exclusively** at the DerivedPermission table. There is **no fallback logic** to DirectPermissions during permission checks.

2. **DirectPermissions are Configuration Only**: DirectPermissions serve only as the source configuration for what permissions should exist. They are never consulted during runtime authorization decisions.

3. **Eventually Consistent Model**: Users may experience a delay between permission grant and access availability while DerivedPermissions are being computed.

4. **No Partial Access**: Until DerivedPermissions are created, users have no access to objects, even if DirectPermissions exist.

5. **Idempotent Operations**: Operations can be safely retried without creating duplicates or inconsistent states.

6. **Object Existence Validation**: Operations verify that target objects still exist before creating permissions.

## Executive Summary

The current KlickerUZH permission system experiences critical transaction timeout issues when sharing objects with large user groups or complex hierarchical structures. After analyzing the DirectPermission status approach (v2.0), we've identified a fundamental limitation: sharing creates only **one DirectPermission entry** regardless of complexity, meaning a single status field still requires completing everything before marking as COMPLETED.

This document proposes **Permission System v3.0** using an **intermediate operation table** that breaks monolithic permission operations into granular, independently-processable tasks. This approach provides true asynchronous processing with fine-grained progress tracking and fault tolerance. Given our core assumption that **authorization uses only DerivedPermissions**, this architecture ensures consistent permission resolution while eliminating transaction timeouts.

## 1. Problem Analysis: Why DirectPermission Status Fails

### 1.1 Current Architecture Reality

When sharing a Course with a UserGroup, the system creates:

```typescript
// ONLY ONE DirectPermission entry is created:
const directPermission = await prisma.permission.create({
  courseId: 'course-123',
  userGroupId: 456,
  permissionLevel: 'READ',
  // status: "PENDING" // Single status for entire operation
})

// NO DirectPermissions are created for:
// - Activities within the course (20+ activities)
// - Elements within activities (200+ elements)
// - These are all computed as DerivedPermissions
```

### 1.2 The Single Status Problem

With DirectPermission status approach:

- **One status field** tracks the entire operation
- Status can only be marked `COMPLETED` when **ALL** of the following finish:
  - Expand UserGroup (50 users) → 50 DerivedPermissions for course
  - Propagate to activities (20 activities) → 1,000 DerivedPermissions
  - Propagate to elements (200 elements) → 10,000 DerivedPermissions
  - **Total: 11,050 operations before marking COMPLETED**

**Result**: We're back to the original timeout problem - just delayed to background processing.

## 2. Proposed Solution: Intermediate Operation Table

### 2.1 Core Concept: Granular Operation Tracking

Replace single operation status with **multiple independent operation entries**:

1. **Transaction 1**: Create DirectPermission + create granular operation entries
2. **Background Processing**: Process each operation independently
3. **Completion Check**: DirectPermission is "complete" when all operations are done

### 2.2 Architectural Components

#### Component A: PendingPermissionOperation Table

```prisma
model PendingPermissionOperation {
  id String @id @default(uuid()) @db.Uuid

  // Link to the DirectPermission that triggered this operation
  directPermission   Permission @relation(fields: [directPermissionId], references: [id], onDelete: Cascade)
  directPermissionId Int

  // Operation definition
  operationType PendingOperationType
  status        OperationStatus @default(PENDING)
  priority      Int @default(1) // Higher numbers = higher priority

  // Target identifiers (generic and indexed for queries)
  targetUserId    String? @db.Uuid  // User this operation targets
  targetGroupId   Int?              // Group this operation targets
  
  // Generic object reference (matches any object type)
  objectId        String?           // Can be courseId, elementId (as string), etc.
  objectType      String?           // 'course', 'element', 'liveQuiz', etc.
  
  // Permission details
  permissionLevel    PermissionLevel?     // Permission level to set
  oldPermissionLevel PermissionLevel?     // Previous level (for updates)
  
  // Operation context
  sourceGroupId      Int?                 // Which group triggered this operation
  parentOperationId  String? @db.Uuid     // Parent operation in the hierarchy
  cascadeToChildren  Boolean @default(false)

  // Dependency management
  dependsOnOperations String[] // Array of operation IDs this operation waits for

  // Error handling and retry logic
  attempts       Int      @default(0)
  maxAttempts    Int      @default(3)
  lastError      String?

  // Timing and progress
  createdAt DateTime @default(now())
  startedAt DateTime?
  completedAt DateTime?

  // Indexes for efficient querying
  @@index([directPermissionId, status])
  @@index([status, priority, createdAt])
  @@index([targetUserId, status])
  @@index([targetGroupId, status])
  @@index([objectId, objectType, status])
  @@index([sourceGroupId])
  @@index([dependsOnOperations])
}

enum PendingOperationType {
  // Group expansion operations (create individual user operations)
  EXPAND_GROUP_TO_USER_OPERATIONS     // Creates individual user operations for group members

  // Individual user processing operations
  PROCESS_USER_COURSE_ACCESS          // Process individual user access to course
  PROCESS_USER_ACTIVITY_ACCESS        // Process individual user access to activity
  PROCESS_USER_ELEMENT_ACCESS         // Process individual user access to element

  // Hierarchical expansion operations (create child object operations)
  EXPAND_COURSE_TO_ACTIVITY_OPERATIONS   // Creates activity operations for user/group
  EXPAND_ACTIVITY_TO_ELEMENT_OPERATIONS  // Creates element operations for user/group

  // Final processing operations (create actual DerivedPermissions)
  CREATE_DERIVED_PERMISSION           // Create final DerivedPermission entry

  // Permission modification operations
  UPDATE_PERMISSION_LEVEL             // Update permission level (e.g., READ → WRITE)
  UPDATE_GROUP_TO_USER_OPERATIONS     // Update all group member permissions
  UPDATE_HIERARCHICAL_PERMISSIONS     // Update child object permissions after parent change
  
  // Permission revocation operations
  REVOKE_USER_PERMISSION              // Remove individual user permission
  REVOKE_GROUP_PERMISSION             // Remove group permission and all member permissions
  REVOKE_HIERARCHICAL_PERMISSIONS     // Remove permissions from child objects
  CASCADE_DELETE_PERMISSIONS          // Remove orphaned derived permissions

  // Maintenance operations
  UPDATE_ACCESS_REQUESTS              // Update pending access requests
  CLEANUP_COMPLETED_OPERATIONS        // Remove old completed operations
}

enum OperationStatus {
  PENDING       // Waiting to be processed
  IN_PROGRESS   // Currently being processed
  COMPLETED     // Successfully completed
  FAILED        // Failed after max attempts
  SKIPPED       // Skipped due to dependency failure
  CANCELLED     // Cancelled due to DirectPermission deletion
}
```

#### Component B: Smart Operation Creation

Break down complex sharing operations into manageable chunks:

```typescript
// Transaction 1: Create DirectPermission + Smart Operation Breakdown
async function shareObject({ courseId, userGroupId, permissionLevel }) {
  const directPermission = await prisma.$transaction(async (prisma) => {
    // 1. Create the DirectPermission (no status field needed)
    const permission = await prisma.permission.create({
      courseId,
      userGroupId,
      permissionLevel,
    })

    // 2. Create granular operations for this permission
    await createOperationsForCourseSharing(permission.id, prisma)

    return permission
  })

  // 3. Queue background processing
  await triggerBackgroundProcessing()

  return { success: true, immediate: true }
}

async function createOperationsForCourseSharing(
  directPermissionId: number,
  prisma: PrismaClient
) {
  const directPermission = await prisma.permission.findUnique({
    where: { id: directPermissionId },
    include: { userGroup: true },
  })

  const operations = []

  if (directPermission.userGroupId) {
    // Group sharing: Create expansion operation that will create individual user operations
    operations.push({
      directPermissionId,
      operationType: 'EXPAND_GROUP_TO_USER_OPERATIONS',
      targetGroupId: directPermission.userGroupId,
      objectId: directPermission.courseId,
      objectType: 'course',
      permissionLevel: directPermission.permissionLevel,
      priority: 10, // Highest priority - creates user access
      dependsOnOperations: [],
    })
  } else {
    // Individual user sharing: Create direct user operation
    operations.push({
      directPermissionId,
      operationType: 'PROCESS_USER_COURSE_ACCESS',
      targetUserId: directPermission.userId,
      objectId: directPermission.courseId,
      objectType: 'course',
      permissionLevel: directPermission.permissionLevel,
      priority: 10,
      dependsOnOperations: [],
    })
  }

  // Create all operations in one batch
  await prisma.pendingPermissionOperation.createMany({ data: operations })
}
```

#### Component C: Independent Operation Processing

Process operations individually with dependency management:

```typescript
export class PermissionOperationProcessor {
  async processReadyOperations() {
    // Get operations ready for processing (dependencies satisfied)
    const readyOperations = await prisma.pendingPermissionOperation.findMany({
      where: {
        status: 'PENDING',
        attempts: { lt: 3 },
        // No pending dependencies
        dependsOnOperations: {
          where: {
            status: {
              in: ['PENDING', 'IN_PROGRESS', 'FAILED', 'SKIPPED'],
            },
          },
          isEmpty: true,
        },
      },
      orderBy: [
        { priority: 'desc' }, // Higher priority first
        { createdAt: 'asc' }, // Older operations first
      ],
      take: 20, // Process in small batches
    })

    // Process operations in parallel where possible
    await Promise.allSettled(
      readyOperations.map((operation) => this.processOperation(operation))
    )
  }

  async processOperation(operation: PendingPermissionOperation) {
    try {
      // Mark as in progress
      await this.markOperationInProgress(operation.id)

      // Execute the specific operation type
      switch (operation.operationType) {
        case 'EXPAND_USER_GROUP_TO_COURSE':
          await this.expandUserGroupToCourse(operation)
          break
        case 'PROPAGATE_COURSE_TO_LIVEQUIZZES':
          await this.propagateCourseToLiveQuizzes(operation)
          break
        // Handle other operation types...
      }

      // Mark as completed and resolve dependencies
      await this.markOperationCompleted(operation.id)
      await this.resolveDependentOperations(operation.id)
    } catch (error) {
      await this.handleOperationError(operation, error)
    }
  }

  // Recursive operation implementations
  async expandGroupToUserOperations(operation: PendingPermissionOperation) {
    const userGroup = await this.getUserGroupWithMembers(operation.targetGroupId)

    // Create individual user operations for each group member
    const allUsers = [
      { id: userGroup.ownerId },
      ...userGroup.members,
      ...userGroup.admins,
    ].filter((user) => user.id) // Remove duplicates/nulls

    const userOperations = allUsers.map((user) => ({
      directPermissionId: operation.directPermissionId,
      operationType: `PROCESS_USER_${operation.objectType.toUpperCase()}_ACCESS`,
      targetUserId: user.id,
      objectId: operation.objectId,
      objectType: operation.objectType,
      permissionLevel: operation.permissionLevel,
      sourceGroupId: operation.targetGroupId, // Track where this came from
      priority: 8, // High priority - user access
      dependsOnOperations: [],
    }))

    // Create operations in batches to avoid transaction limits
    for (const batch of chunk(userOperations, 50)) {
      await prisma.pendingPermissionOperation.createMany({ data: batch })
    }
  }

  async processUserCourseAccess(operation: PendingPermissionOperation) {
    // Validate object exists before creating permission
    const objectExists = await this.validateObjectExists(
      operation.objectId,
      operation.objectType
    )
    
    if (!objectExists) {
      // Object was deleted, skip this operation
      await this.markOperationSkipped(operation.id, 'Object no longer exists')
      return
    }

    // Create the DerivedPermission for this user
    await prisma.derivedPermission.upsert({
      where: {
        [`${operation.objectType}Id_userId`]: {
          [`${operation.objectType}Id`]: operation.objectId,
          userId: operation.targetUserId,
        },
      },
      create: {
        [operation.objectType]: { connect: { id: operation.objectId } },
        user: { connect: { id: operation.targetUserId } },
        permissionLevel: operation.permissionLevel,
        derived: false,
        sourceGroupId: operation.sourceGroupId, // Track group source if applicable
      },
      update: {
        permissionLevel: operation.permissionLevel,
        sourceGroupId: operation.sourceGroupId,
      },
    })

    // Recursively create operations for child objects
    await this.createChildObjectOperations(operation)
  }

  async createChildObjectOperations(operation: PendingPermissionOperation) {
    const { targetUserId, objectId, objectType, permissionLevel } = operation

    if (objectType === 'course') {
      // Create operations for all activities in the course
      const activities = await this.getAllActivitiesInCourse(objectId)

      const activityOperations = activities.map((activity) => ({
        directPermissionId: operation.directPermissionId,
        operationType: `PROCESS_USER_${activity.type.toUpperCase()}_ACCESS`,
        targetUserId: targetUserId,
        objectId: activity.id,
        objectType: activity.type, // 'liveQuiz', 'practiceQuiz', etc.
        permissionLevel: this.deriveChildPermissionLevel(permissionLevel),
        parentOperationId: operation.id,
        sourceGroupId: operation.sourceGroupId,
        priority: 5, // Medium priority
        dependsOnOperations: [operation.id],
      }))

      await prisma.pendingPermissionOperation.createMany({
        data: activityOperations,
      })
    } else if (
      ['liveQuiz', 'practiceQuiz', 'microLearning', 'groupActivity'].includes(
        objectType
      )
    ) {
      // Create operations for all elements in the activity
      const elements = await this.getElementsInActivity(objectId)

      const elementOperations = elements.map((element) => ({
        directPermissionId: operation.directPermissionId,
        operationType: 'PROCESS_USER_ELEMENT_ACCESS',
        targetUserId: targetUserId,
        objectId: element.id.toString(), // Convert Int to String
        objectType: 'element',
        permissionLevel: this.deriveChildPermissionLevel(permissionLevel),
        parentOperationId: operation.id,
        sourceGroupId: operation.sourceGroupId,
        priority: 3, // Lower priority
        dependsOnOperations: [operation.id],
      }))

      await prisma.pendingPermissionOperation.createMany({
        data: elementOperations,
      })
    }
  }
}
```

#### Component D: Permission Modification and Revocation

Handle permission updates and revocations through operations:

```typescript
// Permission Update Operations
async function updatePermissionLevel(
  directPermissionId: number,
  newPermissionLevel: PermissionLevel
) {
  const directPermission = await prisma.permission.findUnique({
    where: { id: directPermissionId },
    include: { userGroup: true }
  })

  if (!directPermission) {
    throw new Error('Permission not found')
  }

  await prisma.$transaction(async (prisma) => {
    // 1. Update the DirectPermission
    await prisma.permission.update({
      where: { id: directPermissionId },
      data: { permissionLevel: newPermissionLevel }
    })

    // 2. Create operation to update derived permissions
    const operation = await prisma.pendingPermissionOperation.create({
      data: {
        directPermissionId,
        operationType: directPermission.userGroupId
          ? 'UPDATE_GROUP_TO_USER_OPERATIONS'
          : 'UPDATE_PERMISSION_LEVEL',
        targetUserId: directPermission.userId,
        targetGroupId: directPermission.userGroupId,
        objectId: directPermission.courseId || directPermission.elementId?.toString(),
        objectType: directPermission.courseId ? 'course' : 'element',
        permissionLevel: newPermissionLevel,
        oldPermissionLevel: directPermission.permissionLevel,
        priority: 10  // High priority for updates
      }
    })
  })
}

// Permission Revocation Operations
async function revokePermission(directPermissionId: number) {
  const directPermission = await prisma.permission.findUnique({
    where: { id: directPermissionId },
    include: { userGroup: true }
  })

  if (!directPermission) {
    throw new Error('Permission not found')
  }

  await prisma.$transaction(async (prisma) => {
    // 1. Mark DirectPermission as deleted (soft delete for operation tracking)
    await prisma.permission.update({
      where: { id: directPermissionId },
      data: { 
        deletedAt: new Date(),
        // Keep the record for operation processing
      }
    })

    // 2. Create revocation operation
    await prisma.pendingPermissionOperation.create({
      data: {
        directPermissionId,
        operationType: directPermission.userGroupId
          ? 'REVOKE_GROUP_PERMISSION'
          : 'REVOKE_USER_PERMISSION',
        targetUserId: directPermission.userId,
        targetGroupId: directPermission.userGroupId,
        objectId: directPermission.courseId || directPermission.elementId?.toString(),
        objectType: directPermission.courseId ? 'course' : 'element',
        cascadeToChildren: true,  // Remove child permissions too
        priority: 15  // Highest priority for revocations
      }
    })
  })
}

// Process Update Operations
export class PermissionUpdateProcessor {
  async processUpdatePermissionLevel(operation: PendingPermissionOperation) {
    // Update the DerivedPermission
    await prisma.derivedPermission.update({
      where: {
        [`${operation.objectType}Id_userId`]: {
          [`${operation.objectType}Id`]: operation.objectId,
          userId: operation.targetUserId
        }
      },
      data: {
        permissionLevel: operation.permissionLevel,
        updatedAt: new Date()
      }
    })

    // Create operations to update child permissions if needed
    if (this.shouldPropagateUpdate(operation.oldPermissionLevel, operation.permissionLevel)) {
      await this.createChildUpdateOperations(operation)
    }
  }

  async processUpdateGroupOperations(operation: PendingPermissionOperation) {
    // Get all users in the group
    const userGroup = await this.getUserGroupWithMembers(operation.targetGroupId)
    const allUsers = this.getAllGroupUsers(userGroup)

    // Create update operations for each user
    const updateOperations = allUsers.map(user => ({
      directPermissionId: operation.directPermissionId,
      operationType: 'UPDATE_PERMISSION_LEVEL',
      targetUserId: user.id,
      objectId: operation.objectId,
      objectType: operation.objectType,
      permissionLevel: operation.permissionLevel,
      oldPermissionLevel: operation.oldPermissionLevel,
      sourceGroupId: operation.targetGroupId,
      priority: 8,
      dependsOnOperations: []
    }))

    await prisma.pendingPermissionOperation.createMany({
      data: updateOperations
    })
  }

  async processRevokePermission(operation: PendingPermissionOperation) {
    // Delete the DerivedPermission
    await prisma.derivedPermission.delete({
      where: {
        [`${operation.objectType}Id_userId`]: {
          [`${operation.objectType}Id`]: operation.objectId,
          userId: operation.targetUserId
        }
      }
    })

    // Create cascade delete operations if needed
    if (operation.cascadeToChildren) {
      await this.createCascadeDeleteOperations(operation)
    }
  }

  async processCascadeDelete(operation: PendingPermissionOperation) {
    // Delete all child derived permissions
    if (operation.objectType === 'course') {
      // Delete all activity permissions for this user in this course
      await prisma.derivedPermission.deleteMany({
        where: {
          userId: operation.targetUserId,
          OR: [
            { liveQuiz: { courseId: operation.objectId } },
            { practiceQuiz: { courseId: operation.objectId } },
            { microLearning: { courseId: operation.objectId } },
            { groupActivity: { courseId: operation.objectId } }
          ]
        }
      })

      // Create operations to delete element permissions
      await this.createElementDeleteOperations(operation.targetUserId, operation.objectId)
    }
  }
}
```

#### Component E: Permission Resolution

Permission checking is simple and **only** uses DerivedPermissions (per our core assumptions):

```typescript
async function resolveUserPermission(
  objectId: string,
  objectType: string,
  userId: string
) {
  // ONLY check DerivedPermission - no fallback to DirectPermission
  const derivedPermission = await prisma.derivedPermission.findUnique({
    where: {
      [`${objectType}Id_userId`]: { [`${objectType}Id`]: objectId, userId },
    },
  })

  if (derivedPermission) {
    return {
      permissionLevel: derivedPermission.permissionLevel,
      derived: derivedPermission.derived,
      directPermissionId: derivedPermission.directPermissionId,
    }
  }

  // No access until DerivedPermission is created
  return null
}

// For monitoring purposes only - NOT for authorization
async function getPermissionProcessingStatus(
  objectId: string,
  objectType: string,
  userId: string
) {
  // Check if user has a DirectPermission that's still being processed
  const directPermission = await prisma.permission.findFirst({
    where: {
      [`${objectType}Id`]: objectId,
      OR: [
        { userId },
        {
          userGroup: {
            OR: [
              { ownerId: userId },
              { members: { some: { id: userId } } },
              { admins: { some: { id: userId } } },
            ],
          },
        },
      ],
    },
  })

  if (!directPermission) {
    return { status: 'NO_PERMISSION' }
  }

  const pendingCount = await prisma.pendingPermissionOperation.count({
    where: {
      directPermissionId: directPermission.id,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
  })

  return {
    status: pendingCount > 0 ? 'PROCESSING' : 'COMPLETED',
    pendingOperations: pendingCount,
  }
}
```

#### Component E: Comprehensive Monitoring

Track progress with detailed visibility:

```typescript
async function getPermissionProcessingStatus(directPermissionId: number) {
  const operations = await prisma.pendingPermissionOperation.findMany({
    where: { directPermissionId },
    orderBy: { createdAt: 'asc' },
  })

  const byStatus = operations.reduce((acc, op) => {
    acc[op.status] = (acc[op.status] || 0) + 1
    return acc
  }, {})

  const byType = operations.reduce((acc, op) => {
    acc[op.operationType] = (acc[op.operationType] || 0) + 1
    return acc
  }, {})

  return {
    total: operations.length,
    byStatus,
    byType,
    isComplete: byStatus.PENDING === 0 && byStatus.IN_PROGRESS === 0,
    estimatedCompletion: this.estimateCompletionTime(operations),
    failedOperations: operations.filter((op) => op.status === 'FAILED'),
  }
}
```

#### Component F: Clean Group Membership Management

Handle group membership changes without touching DirectPermissions:

```typescript
// Adding user to group
async function addUserToGroup(userId: string, groupId: number) {
  // Find all DirectPermissions for this group
  const groupPermissions = await prisma.permission.findMany({
    where: { userGroupId: groupId },
  })

  // Create pending operations for new user to get access to all group objects
  const newUserOperations = groupPermissions.map((permission) => {
    // Determine object type and ID from the permission
    const objectType = permission.courseId ? 'course' : 
                      permission.elementId ? 'element' :
                      permission.liveQuizId ? 'liveQuiz' :
                      permission.practiceQuizId ? 'practiceQuiz' :
                      permission.microLearningId ? 'microLearning' :
                      permission.groupActivityId ? 'groupActivity' : null
    
    const objectId = permission.courseId || 
                    permission.elementId?.toString() ||
                    permission.liveQuizId ||
                    permission.practiceQuizId ||
                    permission.microLearningId ||
                    permission.groupActivityId

    return {
      directPermissionId: permission.id,
      operationType: `PROCESS_USER_${objectType.toUpperCase()}_ACCESS`,
      targetUserId: userId,
      objectId: objectId,
      objectType: objectType,
      permissionLevel: permission.permissionLevel,
      sourceGroupId: groupId,
      priority: 10, // High priority - user access
      dependsOnOperations: [],
    }
  })

  await prisma.pendingPermissionOperation.createMany({
    data: newUserOperations,
  })
}

// Removing user from group
async function removeUserFromGroup(userId: string, groupId: number) {
  // Remove pending operations for this user from this group
  await prisma.pendingPermissionOperation.deleteMany({
    where: {
      targetUserId: userId,
      sourceGroupId: groupId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
  })

  // Remove derived permissions that came from this group
  await prisma.derivedPermission.deleteMany({
    where: {
      userId,
      sourceGroupId: groupId,
    },
  })
}
```

## 3. Recursive Workflow Architecture

### Before: Monolithic Transaction

```typescript
await prisma.$transaction(async (prisma) => {
  // 1. Create DirectPermission (1 op)
  // 2. Expand to 50 users (50 ops)
  // 3. Propagate to 20 activities (20 * 50 = 1,000 ops)
  // 4. Propagate to 200 elements (200 * 50 = 10,000 ops)
  // Total: 11,051 operations - TIMEOUT!
})
```

### After: Recursive Operation Queue

```typescript
// Transaction 1: Ultra-fast setup (2 operations)
await prisma.$transaction(async (prisma) => {
  // 1. Create DirectPermission (group → course)
  const permission = await prisma.permission.create({...})

  // 2. Create initial expansion operation
  await prisma.pendingPermissionOperation.create({
    type: 'EXPAND_GROUP_TO_USER_OPERATIONS',
    operationData: { groupId: 456, courseId: 'course-123' }
  })
})

// Background: Recursive operation processing
Level 1: EXPAND_GROUP_TO_USER_OPERATIONS
→ Creates 50 operations: PROCESS_USER_COURSE_ACCESS (one per user)

Level 2: Each PROCESS_USER_COURSE_ACCESS
→ Creates DerivedPermission for user + course
→ Creates 20 operations: PROCESS_USER_ACTIVITY_ACCESS (per activity)

Level 3: Each PROCESS_USER_ACTIVITY_ACCESS
→ Creates DerivedPermission for user + activity
→ Creates 10 operations: PROCESS_USER_ELEMENT_ACCESS (per element)

Level 4: Each PROCESS_USER_ELEMENT_ACCESS
→ Creates DerivedPermission for user + element
→ Processing complete for this path

Result: Same 11,051 DerivedPermissions, but processed as independent work items!
```

#### Component G: Handling Edge Cases and Race Conditions

Handle DirectPermission deletion and other race conditions:

```typescript
// Handle DirectPermission deletion during processing
export class PermissionDeletionHandler {
  async handleDirectPermissionDeletion(directPermissionId: number) {
    await prisma.$transaction(async (tx) => {
      // 1. Cancel all pending operations for this permission
      await tx.pendingPermissionOperation.updateMany({
        where: {
          directPermissionId,
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
          lastError: 'DirectPermission was deleted'
        }
      })

      // 2. The cascade delete on the foreign key will handle the rest
      await tx.permission.delete({
        where: { id: directPermissionId }
      })

      // 3. Create cleanup operations for orphaned DerivedPermissions
      await this.createCleanupOperations(directPermissionId)
    })
  }

  async createCleanupOperations(directPermissionId: number) {
    // Find all DerivedPermissions that were created from this DirectPermission
    const orphanedPermissions = await prisma.derivedPermission.findMany({
      where: { directPermissionId }
    })

    // Create CASCADE_DELETE_PERMISSIONS operations for each
    const cleanupOperations = orphanedPermissions.map(dp => ({
      directPermissionId: null, // No parent, this is a cleanup operation
      operationType: 'CASCADE_DELETE_PERMISSIONS',
      targetUserId: dp.userId,
      objectId: dp.courseId || dp.elementId?.toString() || dp.liveQuizId || 
                dp.practiceQuizId || dp.microLearningId || dp.groupActivityId,
      objectType: dp.courseId ? 'course' : 
                  dp.elementId ? 'element' :
                  dp.liveQuizId ? 'liveQuiz' :
                  dp.practiceQuizId ? 'practiceQuiz' :
                  dp.microLearningId ? 'microLearning' :
                  'groupActivity',
      priority: 20, // Highest priority - cleanup
      dependsOnOperations: []
    }))

    await prisma.pendingPermissionOperation.createMany({
      data: cleanupOperations
    })
  }
}

// Idempotency handling for operations
export class IdempotentOperationProcessor {
  async processOperationIdempotently(operation: PendingPermissionOperation) {
    // Generate operation fingerprint for idempotency
    const fingerprint = this.generateOperationFingerprint(operation)
    
    // Check if this exact operation was already processed
    const existingResult = await this.checkOperationHistory(fingerprint)
    if (existingResult) {
      // Operation already processed, mark as completed
      await this.markOperationCompleted(operation.id)
      return existingResult
    }

    try {
      // Process the operation
      const result = await this.processOperation(operation)
      
      // Record the result for future idempotency checks
      await this.recordOperationResult(fingerprint, result)
      
      return result
    } catch (error) {
      // Handle errors idempotently
      if (this.isRetryableError(error)) {
        throw error // Will be retried
      }
      
      // Non-retryable error, record and skip
      await this.recordOperationFailure(fingerprint, error)
      await this.markOperationFailed(operation.id, error.message)
    }
  }

  generateOperationFingerprint(operation: PendingPermissionOperation): string {
    // Create a unique fingerprint based on operation parameters
    const key = [
      operation.operationType,
      operation.targetUserId,
      operation.targetGroupId,
      operation.objectId,
      operation.objectType,
      operation.permissionLevel,
      operation.sourceGroupId
    ].filter(Boolean).join(':')
    
    return crypto.createHash('sha256').update(key).digest('hex')
  }
}
```

### Recursive Flow Visualization

```
Share Course with UserGroup[50 users]
│
├─ DirectPermission (group → course) ✅ IMMEDIATE
│
└─ PendingOperation: EXPAND_GROUP_TO_USER_OPERATIONS
   │
   ├─ PendingOperation: PROCESS_USER_COURSE_ACCESS (user1)
   │  ├─ DerivedPermission (user1 → course) ✅
   │  ├─ PROCESS_USER_ACTIVITY_ACCESS (user1 → activity1)
   │  ├─ PROCESS_USER_ACTIVITY_ACCESS (user1 → activity2)
   │  └─ ... (20 activities)
   │
   ├─ PendingOperation: PROCESS_USER_COURSE_ACCESS (user2)
   │  ├─ DerivedPermission (user2 → course) ✅
   │  ├─ PROCESS_USER_ACTIVITY_ACCESS (user2 → activity1)
   │  └─ ... (recursive expansion)
   │
   └─ ... (50 users total)

// Each operation processes independently and creates more operations recursively
```

## 4. Benefits Analysis

### 4.1 Benefits Over DirectPermission Status Approach

| Aspect                       | DirectPermission Status                | Recursive Operation Table                                   |
| ---------------------------- | -------------------------------------- | ----------------------------------------------------------- |
| **Transaction Size**         | 1 DirectPermission creation            | 1 DirectPermission + 1 expansion operation                  |
| **Group Management**         | Status tied to ALL users               | Individual user operations, clean add/remove                |
| **Processing Granularity**   | Single status for 11,051 operations    | Individual operations processed independently               |
| **Fault Tolerance**          | Single failure point                   | Operations fail independently, don't affect others          |
| **Progress Tracking**        | "Pending" or "Complete"                | "User access: ✅, Activity sync: 50%, Element sync: queued" |
| **Recursive Processing**     | Manual hierarchy handling              | Automatic recursive operation creation                      |
| **Priority Management**      | No prioritization                      | User access (high) vs optimization (low) priorities         |
| **Group Membership Changes** | Requires reprocessing entire operation | Add/remove individual user operations only                  |
| **Parallel Processing**      | Sequential processing only             | Independent operations can run in parallel                  |
| **Resource Usage**           | Background processing all-or-nothing   | Progressive resource allocation                             |

### 4.2 Recursive Architecture Benefits

1. **Self-Similar Processing**: Same logic handles direct user sharing, group expansion, and hierarchical propagation
2. **Automatic Decomposition**: Complex operations automatically break down into manageable work items
3. **Clean Group Management**: Group membership changes only affect individual user operations
4. **Progressive User Access**: Users get access as their individual operations complete
5. **Resource Efficiency**: High-priority operations (user access) complete before low-priority ones (optimization)
6. **Fault Isolation**: Individual user/object failures don't affect other processing
7. **Unified Codebase**: Same processing logic used for all permission scenarios

### 4.3 User Experience Benefits

```typescript
// Users can see detailed progress while waiting for access:
{
  "sharingStatus": "Processing",
  "progress": {
    "userExpansion": "completed",           // DerivedPermissions being created
    "activityPropagation": "in_progress",   // 15/20 activities processed
    "elementPropagation": "pending",        // Waiting for activities to complete
    "estimated": "2 minutes remaining"
  },
  "message": "Your access is being set up. Please wait a moment..."
}
```

## 5. User Experience and Authorization Flow

Given our core assumption that **only DerivedPermissions are used for authorization**, the system must handle the eventual consistency gracefully:

### 5.1 Authorization Flow

1. **Permission Check**: Application ONLY queries DerivedPermission table
2. **No Access State**: If no DerivedPermission exists, user has no access (even if DirectPermission exists)
3. **Processing Status**: Separate API to check if permissions are being processed
4. **User Feedback**: Clear UI messaging when access is pending

### 5.2 UI Considerations

```typescript
// Example authorization check in resolver
async function resolveAccess(objectId: string, userId: string, ctx: Context) {
  const permission = await resolveUserPermission(objectId, 'course', userId)

  if (!permission) {
    // Check if processing is in progress (for UI feedback only)
    const status = await getPermissionProcessingStatus(
      objectId,
      'course',
      userId
    )

    if (status.status === 'PROCESSING') {
      throw new GraphQLError('ACCESS_PENDING', {
        extensions: {
          code: 'ACCESS_PENDING',
          message: 'Your access is being set up. Please try again in a moment.',
          estimatedWaitTime: 30, // seconds
        },
      })
    }

    throw new GraphQLError('ACCESS_DENIED')
  }

  return permission
}
```

### 5.3 Handling Edge Cases

1. **New User Added to Group**: User sees "access pending" until their DerivedPermissions are created
2. **Mass Sharing**: Admin sees success confirmation, users see progressive access as operations complete
3. **Failed Operations**: Users without DerivedPermissions have no access (no partial states)
4. **Retry Mechanism**: Failed operations are retried automatically, users wait for completion

## 6. Implementation Requirements

### 6.1 Database Schema Changes

```sql
-- Create new operation tracking table
CREATE TABLE "PendingPermissionOperation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "directPermissionId" INTEGER NOT NULL,
  "operationType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "priority" INTEGER NOT NULL DEFAULT 1,
  
  -- Target identifiers
  "targetUserId" TEXT,
  "targetGroupId" INTEGER,
  
  -- Generic object reference
  "objectId" TEXT,
  "objectType" TEXT,
  
  -- Permission details
  "permissionLevel" TEXT,
  "oldPermissionLevel" TEXT,
  
  -- Operation context
  "sourceGroupId" INTEGER,
  "parentOperationId" TEXT,
  "cascadeToChildren" BOOLEAN NOT NULL DEFAULT false,
  
  -- Dependency and error handling
  "dependsOnOperations" TEXT[],
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lastError" TEXT,
  
  -- Timestamps
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "PendingPermissionOperation_directPermissionId_fkey"
    FOREIGN KEY ("directPermissionId") REFERENCES "Permission"("id") ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX "PendingPermissionOperation_directPermissionId_status_idx"
  ON "PendingPermissionOperation"("directPermissionId", "status");

CREATE INDEX "PendingPermissionOperation_status_priority_createdAt_idx"
  ON "PendingPermissionOperation"("status", "priority", "createdAt");

CREATE INDEX "PendingPermissionOperation_targetUserId_status_idx"
  ON "PendingPermissionOperation"("targetUserId", "status");

CREATE INDEX "PendingPermissionOperation_targetGroupId_status_idx"
  ON "PendingPermissionOperation"("targetGroupId", "status");

CREATE INDEX "PendingPermissionOperation_objectId_objectType_status_idx"
  ON "PendingPermissionOperation"("objectId", "objectType", "status");

CREATE INDEX "PendingPermissionOperation_sourceGroupId_idx"
  ON "PendingPermissionOperation"("sourceGroupId");

CREATE INDEX "PendingPermissionOperation_dependsOnOperations_idx"
  ON "PendingPermissionOperation" USING GIN("dependsOnOperations");
```

### 6.2 Core Files to Modify

1. **`packages/prisma/src/prisma/schema/sharing.prisma`**

   - Add `PendingPermissionOperation` model
   - No changes to existing Permission/DerivedPermission models

2. **`packages/graphql/src/services/sharing.ts`**

   - Replace monolithic sharing with operation creation
   - Add operation-based sharing functions

3. **`packages/util/src/permissions/`** (All files)

   - Convert recomputation functions to operation processors
   - Remove large transaction logic

4. **New Files**:
   - `packages/util/src/permissions/operationProcessor.ts`
   - `packages/util/src/permissions/operationCreator.ts`
   - `packages/graphql/src/services/permissionOperations.ts`

### 6.3 Background Processing Infrastructure Implementation

#### 6.3.1 Implementation Approach Options

We propose **3 implementation strategies** with different complexity/capability tradeoffs:

##### **Approach A: GraphQL Mutation via HTTP CronJob (Recommended for MVP)**

**Benefits**: Leverages existing infrastructure, low risk, quick deployment
**Use Case**: Initial implementation and moderate loads (<1000 operations/minute)

**Implementation:**

```typescript
// packages/graphql/src/services/permissionOperations.ts
export class PermissionOperationService {
  async processPermissionOperations(
    ctx: Context,
    batchSize: number = 50,
    maxProcessingTime: number = 120000 // 2 minutes
  ) {
    const startTime = Date.now()
    const results = {
      processed: 0,
      failed: 0,
      created: 0, // New operations created recursively
      errors: [] as string[],
    }

    try {
      while (Date.now() - startTime < maxProcessingTime) {
        // Get ready operations with lock to prevent concurrent processing
        const operations = await this.getAndLockReadyOperations(batchSize)

        if (operations.length === 0) {
          break // No more work to do
        }

        // Process operations in parallel batches
        const batchResults = await Promise.allSettled(
          operations.map((op) => this.processOperation(op))
        )

        // Update results and handle errors
        for (let i = 0; i < batchResults.length; i++) {
          const result = batchResults[i]
          const operation = operations[i]

          if (result.status === 'fulfilled') {
            results.processed++
            results.created += result.value.newOperationsCreated || 0
            await this.markOperationCompleted(operation.id)
          } else {
            results.failed++
            results.errors.push(
              `Operation ${operation.id}: ${result.reason.message}`
            )
            await this.handleOperationError(operation, result.reason)
          }
        }
      }

      // Send real-time updates for affected permissions
      await this.sendProgressUpdates(results)

      return {
        success: true,
        ...results,
        processingTimeMs: Date.now() - startTime,
      }
    } catch (error) {
      console.error('Permission operation processing failed:', error)
      return {
        success: false,
        error: error.message,
        ...results,
      }
    }
  }

  private async getAndLockReadyOperations(batchSize: number) {
    // Use SELECT FOR UPDATE SKIP LOCKED to prevent concurrent processing
    return await prisma.$transaction(async (tx) => {
      // Raw query with row-level locking to prevent race conditions
      const operations = await tx.$queryRaw<PendingPermissionOperation[]>`
        SELECT * FROM "PendingPermissionOperation"
        WHERE status = 'PENDING'
          AND attempts < 3
          AND NOT EXISTS (
            SELECT 1 FROM unnest("dependsOnOperations") AS dep_id
            WHERE EXISTS (
              SELECT 1 FROM "PendingPermissionOperation" dep
              WHERE dep.id::text = dep_id
                AND dep.status IN ('PENDING', 'IN_PROGRESS', 'FAILED')
            )
          )
        ORDER BY priority DESC, "createdAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `

      // Mark as IN_PROGRESS to prevent other workers from picking them up
      if (operations.length > 0) {
        await tx.pendingPermissionOperation.updateMany({
          where: {
            id: { in: operations.map((op) => op.id) },
          },
          data: {
            status: 'IN_PROGRESS',
            startedAt: new Date(),
            attempts: { increment: 1 },
          },
        })
      }

      return operations
    })
  }
}
```

**GraphQL Schema Integration:**

```typescript
// packages/graphql/src/schema/admin.ts
export const PermissionOperationMutations = builder.mutationFields((t) => ({
  processPermissionOperations: t.field({
    type: PermissionOperationResult,
    args: {
      batchSize: t.arg.int({ required: false, defaultValue: 50 }),
      maxProcessingTime: t.arg.int({ required: false, defaultValue: 120000 }),
    },
    authScopes: {
      isAdmin: true, // Only admin/system can trigger
    },
    resolve: async (parent, args, ctx) => {
      const service = new PermissionOperationService()
      return await service.processPermissionOperations(
        ctx,
        args.batchSize,
        args.maxProcessingTime
      )
    },
  }),
}))
```

**Kubernetes CronJob Configuration:**

```yaml
# deploy/charts/klicker-uzh-v2/templates/cron-permission-operations.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: {{ include "chart.fullname" . }}-permission-operations
  labels:
    {{- include "chart.labels" . | nindent 4 }}
spec:
  # Run every minute for responsive processing
  schedule: "*/1 * * * *"

  # Allow up to 3 concurrent jobs for high load scenarios
  concurrencyPolicy: Allow

  # Keep last 3 successful and 3 failed jobs for debugging
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3

  jobTemplate:
    spec:
      # Complete within 5 minutes or terminate
      activeDeadlineSeconds: 300

      # Allow parallel processing
      parallelism: {{ .Values.permissionOperations.parallelism | default 2 }}

      template:
        metadata:
          labels:
            app: permission-operations-processor
        spec:
          restartPolicy: OnFailure

          containers:
          - name: processor
            image: curlimages/curl:7.85.0
            imagePullPolicy: IfNotPresent

            command: ["/bin/sh"]
            args:
              - -c
              - |
                echo "Starting permission operations processing..."

                # Add unique worker ID to prevent conflicts
                WORKER_ID="${HOSTNAME:-worker}-$(date +%s)"

                RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
                  -X POST \
                  -H "Content-Type: application/json" \
                  -H "x-token: {{ .Values.cron.token }}" \
                  -H "x-graphql-yoga-csrf: processPermissionOperations" \
                  -H "x-worker-id: ${WORKER_ID}" \
                  -d '{
                    "operationName": "ProcessPermissionOperations",
                    "variables": {
                      "batchSize": {{ .Values.permissionOperations.batchSize | default 50 }},
                      "maxProcessingTime": {{ .Values.permissionOperations.maxProcessingTime | default 120000 }}
                    },
                    "extensions": {
                      "persistedQuery": {
                        "version": 1,
                        "sha256Hash": "{{ .Values.permissionOperations.queryHash }}"
                      }
                    }
                  }' \
                  "http://{{ include "chart.fullname" . }}-backend-graphql:3000/api/graphql")

                # Extract HTTP status and body
                HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
                BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS\:.*//g')

                echo "HTTP Status: $HTTP_STATUS"
                echo "Response: $BODY"

                if [ $HTTP_STATUS -eq 200 ]; then
                  echo "✅ Processing completed successfully"

                  # Parse response to get metrics
                  PROCESSED=$(echo $BODY | grep -o '"processed":[0-9]*' | cut -d: -f2)
                  FAILED=$(echo $BODY | grep -o '"failed":[0-9]*' | cut -d: -f2)

                  echo "📊 Processed: ${PROCESSED:-0}, Failed: ${FAILED:-0}"
                  exit 0
                else
                  echo "❌ Processing failed with status $HTTP_STATUS"
                  echo "Response: $BODY"
                  exit 1
                fi

            resources:
              requests:
                memory: "64Mi"
                cpu: "50m"
              limits:
                memory: "128Mi"
                cpu: "200m"

            env:
            - name: WORKER_ID
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
```

##### **Approach B: Dedicated Node.js Worker (Recommended for Scale)**

**Benefits**: Better performance, dedicated resources, advanced monitoring
**Use Case**: High load scenarios (>1000 operations/minute), production environments

**Standalone Worker Application:**

```typescript
// apps/permission-worker/src/index.ts
import { PrismaClient } from '@klicker-uzh/prisma'
import { PermissionOperationProcessor } from './processor'

class PermissionWorker {
  private prisma = new PrismaClient()
  private processor = new PermissionOperationProcessor(this.prisma)
  private isShuttingDown = false

  async start() {
    console.log('🚀 Permission operation worker starting...')

    // Graceful shutdown handling
    process.on('SIGTERM', () => this.gracefulShutdown())
    process.on('SIGINT', () => this.gracefulShutdown())

    // Main processing loop
    await this.processLoop()
  }

  private async processLoop() {
    while (!this.isShuttingDown) {
      try {
        const result = await this.processor.processOperationBatch()

        if (result.processed === 0) {
          // No work available, wait before next check
          await this.sleep(5000) // 5 seconds
        } else {
          console.log(
            `✅ Processed ${result.processed} operations, ${result.failed} failed`
          )

          // Continue immediately if there might be more work
          await this.sleep(100) // Brief pause
        }
      } catch (error) {
        console.error('❌ Processing error:', error)
        await this.sleep(10000) // 10 seconds on error
      }
    }
  }

  private async gracefulShutdown() {
    console.log('🛑 Shutting down gracefully...')
    this.isShuttingDown = true

    // Wait for current operations to complete
    await this.processor.waitForCompletion()
    await this.prisma.$disconnect()

    console.log('✅ Shutdown complete')
    process.exit(0)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Start the worker
const worker = new PermissionWorker()
worker.start().catch((error) => {
  console.error('💥 Worker startup failed:', error)
  process.exit(1)
})
```

**Kubernetes Deployment:**

```yaml
# deploy/charts/klicker-uzh-v2/templates/deployment-permission-worker.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "chart.fullname" . }}-permission-worker
  labels:
    {{- include "chart.labels" . | nindent 4 }}
    component: permission-worker
spec:
  replicas: {{ .Values.permissionWorker.replicas | default 2 }}

  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1

  selector:
    matchLabels:
      {{- include "chart.selectorLabels" . | nindent 6 }}
      component: permission-worker

  template:
    metadata:
      labels:
        {{- include "chart.selectorLabels" . | nindent 8 }}
        component: permission-worker
    spec:
      containers:
      - name: permission-worker
        image: {{ .Values.permissionWorker.image.repository }}:{{ .Values.permissionWorker.image.tag }}
        imagePullPolicy: {{ .Values.permissionWorker.image.pullPolicy }}

        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: {{ include "chart.fullname" . }}-backend-graphql
              key: DATABASE_URL
        - name: WORKER_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: NODE_ENV
          value: "production"

        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"

        # Health checks
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30

        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10

        # Graceful shutdown
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 10"]

        terminationGracePeriodSeconds: 30
```

##### **Approach C: Queue-Based Architecture (Recommended for Production)**

**Benefits**: Enterprise-grade reliability, automatic scaling, advanced monitoring
**Use Case**: Production environments, high availability requirements

**Queue Integration:**

```typescript
// packages/util/src/permissions/operationQueue.ts
import Bull from 'bull'
import Redis from 'ioredis'

export class PermissionOperationQueue {
  private queue: Bull.Queue
  private redis: Redis.Redis

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL)
    this.queue = new Bull('permission-operations', {
      redis: {
        port: this.redis.options.port,
        host: this.redis.options.host,
        password: this.redis.options.password,
      },
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 3, // Retry failed jobs 3 times
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    })

    // Setup job processor
    this.queue.process(
      'PROCESS_OPERATION',
      10,
      this.processOperation.bind(this)
    )
  }

  async addOperation(operation: PendingPermissionOperation) {
    await this.queue.add(
      'PROCESS_OPERATION',
      {
        operationId: operation.id,
        operationType: operation.operationType,
        directPermissionId: operation.directPermissionId,
      },
      {
        priority: operation.priority,
        delay: operation.delay || 0,
      }
    )
  }

  private async processOperation(job: Bull.Job) {
    const { operationId } = job.data

    const operation = await prisma.pendingPermissionOperation.findUnique({
      where: { id: operationId },
    })

    if (!operation || operation.status !== 'PENDING') {
      return { skipped: true, reason: 'Operation not found or not pending' }
    }

    const processor = new OperationTypeProcessor()
    const result = await processor.processOperation(operation)

    // Queue any new operations created
    if (result.newOperations) {
      for (const newOp of result.newOperations) {
        await this.addOperation(newOp)
      }
    }

    return result
  }

  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
    ])

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    }
  }
}
```

#### 6.3.2 Configuration Management

**Helm Values for Different Environments:**

```yaml
# values.yaml - Production configuration
permissionOperations:
  enabled: true
  approach: "graphql" # "graphql", "worker", or "queue"
  parallelism: 3  # Run 3 workers in parallel
  batchSize: 100  # Process 100 operations per batch
  maxProcessingTime: 120000  # 2 minutes max per worker
  queryHash: "a1b2c3d4e5f6..."  # SHA256 hash of the GraphQL query

# Dedicated worker configuration (when approach: "worker")
permissionWorker:
  enabled: false  # Enable when using worker approach
  replicas: 2
  image:
    repository: klicker-permission-worker
    tag: latest
    pullPolicy: IfNotPresent

# Queue configuration (when approach: "queue")
permissionQueue:
  enabled: false  # Enable when using queue approach
  redis:
    enabled: true
    host: "redis-cluster"
    port: 6379

# values-staging.yaml - Staging configuration
permissionOperations:
  enabled: true
  approach: "graphql"
  parallelism: 1  # Single worker for staging
  batchSize: 20   # Smaller batches
  maxProcessingTime: 60000  # 1 minute max

# values-dev.yaml - Development configuration
permissionOperations:
  enabled: false  # Disable in development (process synchronously)
```

#### 6.3.3 Monitoring and Observability

**Prometheus Metrics Integration:**

```typescript
// packages/graphql/src/services/monitoring.ts
import prometheus from 'prom-client'

export const permissionOperationMetrics = {
  // Operation processing metrics
  operationsProcessed: new prometheus.Counter({
    name: 'permission_operations_processed_total',
    help: 'Total number of permission operations processed',
    labelNames: ['operation_type', 'status', 'worker_id'],
  }),

  operationDuration: new prometheus.Histogram({
    name: 'permission_operation_duration_seconds',
    help: 'Duration of permission operation processing',
    labelNames: ['operation_type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  }),

  queueDepth: new prometheus.Gauge({
    name: 'permission_operation_queue_depth',
    help: 'Number of operations waiting in queue by status',
    labelNames: ['status'],
  }),

  // User experience metrics
  permissionProcessingLag: new prometheus.Histogram({
    name: 'permission_processing_lag_seconds',
    help: 'Time from permission creation to full processing completion',
    buckets: [10, 30, 60, 120, 300, 600],
  }),

  // Error tracking
  operationErrors: new prometheus.Counter({
    name: 'permission_operation_errors_total',
    help: 'Total number of operation errors',
    labelNames: ['operation_type', 'error_type'],
  }),
}

// Enhanced monitoring service
export class PermissionOperationMonitoring {
  async getProcessingStatus() {
    const [pending, inProgress, completed, failed] = await Promise.all([
      prisma.pendingPermissionOperation.count({ where: { status: 'PENDING' } }),
      prisma.pendingPermissionOperation.count({
        where: { status: 'IN_PROGRESS' },
      }),
      prisma.pendingPermissionOperation.count({
        where: { status: 'COMPLETED' },
      }),
      prisma.pendingPermissionOperation.count({ where: { status: 'FAILED' } }),
    ])

    // Update Prometheus metrics
    permissionOperationMetrics.queueDepth.set({ status: 'pending' }, pending)
    permissionOperationMetrics.queueDepth.set(
      { status: 'in_progress' },
      inProgress
    )
    permissionOperationMetrics.queueDepth.set(
      { status: 'completed' },
      completed
    )
    permissionOperationMetrics.queueDepth.set({ status: 'failed' }, failed)

    return {
      pending,
      inProgress,
      completed,
      failed,
      total: pending + inProgress + completed + failed,
      health: failed < (pending + inProgress + completed + failed) * 0.05, // <5% failure rate
    }
  }

  async getStuckOperations() {
    const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago

    return await prisma.pendingPermissionOperation.findMany({
      where: {
        status: 'IN_PROGRESS',
        startedAt: { lt: stuckThreshold },
      },
      include: {
        directPermission: {
          include: {
            userGroup: true,
            user: true,
          },
        },
      },
    })
  }
}
```

**Grafana Dashboard Configuration:**

```yaml
# monitoring/grafana/permission-operations-dashboard.json
{
  'dashboard':
    {
      'title': 'Permission Operations',
      'panels':
        [
          {
            'title': 'Queue Depth',
            'type': 'stat',
            'targets':
              [
                {
                  'expr': 'sum(permission_operation_queue_depth) by (status)',
                  'legendFormat': '{{status}}',
                },
              ],
          },
          {
            'title': 'Processing Rate',
            'type': 'graph',
            'targets':
              [
                {
                  'expr': 'rate(permission_operations_processed_total[5m])',
                  'legendFormat': 'Operations/sec',
                },
              ],
          },
          {
            'title': 'Error Rate',
            'type': 'graph',
            'targets':
              [
                {
                  'expr': 'rate(permission_operation_errors_total[5m])',
                  'legendFormat': 'Errors/sec',
                },
              ],
          },
        ],
    },
}
```

#### 6.3.4 Implementation Roadmap

**Phase 1: MVP Implementation (Week 1-2)**

- ✅ **Quick Start**: GraphQL + CronJob approach
- ✅ **Low Risk**: Leverages existing patterns
- ✅ **Immediate Value**: Eliminates timeout issues

**Phase 2: Scale Enhancement (Week 3-4)**

- ✅ **Performance**: Add dedicated worker approach
- ✅ **Reliability**: Enhanced error handling and monitoring
- ✅ **Observability**: Prometheus metrics and Grafana dashboards

**Phase 3: Production Hardening (Week 5-6)**

- ✅ **Enterprise**: Queue-based architecture with Redis
- ✅ **Auto-scaling**: Dynamic worker scaling based on queue depth
- ✅ **Advanced Monitoring**: Comprehensive alerting and SLA tracking

This implementation strategy provides **immediate relief** from timeout issues while establishing a **clear scaling path** that can grow with KlickerUZH's needs.

## 7. Migration Strategy

### Phase 1: Core Infrastructure

- [ ] Create `PendingPermissionOperation` table
- [ ] Implement basic operation processor
- [ ] Create operation creation logic for Course → UserGroup sharing

### Phase 2: Background Processing

- [ ] Deploy cron job for operation processing
- [ ] Implement retry logic and error handling
- [ ] Add basic monitoring

### Phase 3: Enhanced Operations

- [ ] Add dependency management
- [ ] Implement all operation types
- [ ] Add progress tracking UI

### Phase 4: Optimization

- [ ] Parallel processing capabilities
- [ ] Advanced prioritization
- [ ] Performance tuning

## 8. Risk Assessment

### 8.1 Potential Risks

| Risk                       | Impact | Probability | Mitigation                                    |
| -------------------------- | ------ | ----------- | --------------------------------------------- |
| **Increased Complexity**   | Medium | High        | Clear documentation, comprehensive testing    |
| **Operation Table Growth** | Low    | Medium      | Cleanup completed operations periodically     |
| **Dependency Deadlocks**   | High   | Low         | Careful dependency design, deadlock detection |
| **Partial State Handling** | Medium | Medium      | Robust error handling, graceful degradation   |

### 8.2 Mitigation Strategies

1. **Operation Cleanup**: Automated cleanup of completed operations after 30 days
2. **Deadlock Prevention**: Limit dependency chains, detect circular dependencies
3. **Processing Status Visibility**: Users informed when permissions are being processed
4. **Monitoring**: Comprehensive alerting on failed/stuck operations

## 9. Success Metrics

### 9.1 Performance Metrics

- **Initial Sharing Response Time**: <2 seconds (DirectPermission creation + operation setup)
- **User Access Delay**: <30 seconds for first operation (user group expansion)
- **Full Processing SLA**: 95% of operations complete within 10 minutes
- **Operation Success Rate**: >99% successful completion

### 9.2 Operational Metrics

- **Operation Throughput**: Process 1000+ operations per minute
- **Error Rate**: <1% failed operations
- **Retry Success Rate**: >90% success after retry
- **User Experience**: Detailed progress visibility

## 10. Solutions to Core Concerns

This architecture specifically addresses the three validated concerns:

### 10.1 Permission Updates and Modifications

**Concern**: What happens when a DirectPermission's level changes or needs revocation?

**Solution**: 
- Added dedicated operation types: `UPDATE_PERMISSION_LEVEL`, `UPDATE_GROUP_TO_USER_OPERATIONS`, `REVOKE_USER_PERMISSION`, etc.
- Update operations propagate through the same recursive architecture
- Revocation operations include cascade deletion for child permissions
- All modifications are processed as atomic operations with proper cleanup

### 10.2 Data Model Consistency

**Concern**: The concept uses generic objectId/objectType but KlickerUZH uses specific fields.

**Solution**:
- PendingPermissionOperation uses generic `objectId`/`objectType` fields for flexibility
- This is appropriate because operations are temporary processing records
- The operation processor maps these to specific fields when creating DerivedPermissions
- Avoids schema changes when new object types are added
- Maintains type safety in the permanent permission tables

### 10.3 Consistency and Race Conditions

**Concern**: Concurrent processing, database locking, and handling object deletion during processing.

**Solutions**:
- **Concurrent Processing**: `SELECT FOR UPDATE SKIP LOCKED` prevents multiple workers from processing the same operation
- **Object Validation**: Operations validate object existence before creating permissions
- **DirectPermission Deletion**: Cascade delete on foreign key + CANCELLED status for in-flight operations
- **Idempotency**: Operation fingerprinting ensures operations can be safely retried
- **Orphan Cleanup**: CASCADE_DELETE_PERMISSIONS operations clean up stray DerivedPermissions

## 11. Conclusion

The **Recursive Operation Table architecture** represents a fundamental evolution from monolithic permission processing to a **self-similar, resilient, scalable system** that elegantly handles complexity through recursive decomposition.

**Key Architectural Breakthroughs:**

- 🔄 **Recursive Self-Similarity**: Same processing logic handles individual users, groups, and hierarchical objects
- 🎯 **Automatic Decomposition**: Complex operations recursively break down into independent work items
- ⚡ **Ultra-Fast Initial Response**: 2-operation transaction completes immediately
- 🧹 **Clean Group Management**: Group membership changes handled without touching DirectPermissions
- 📊 **Progressive Completion**: Users get access as their individual DerivedPermissions are created
- 🚀 **Infinite Scalability**: Each operation creates more operations until all paths are complete

**Revolutionary Benefits:**

- ✅ **Eliminates All Timeout Scenarios**: No operation ever processes more than ~50 items
- ✅ **Unifies Processing Logic**: Same code handles direct sharing, group expansion, and hierarchy propagation
- ✅ **Consistent Authorization Model**: Only DerivedPermissions are used for authorization (no complex fallback logic)
- ✅ **Enables True Async**: Operations process completely independently with automatic dependency management
- ✅ **Offers Surgical Precision**: Individual failures don't affect other users or processing paths
- ✅ **Supports Dynamic Groups**: Add/remove users without reprocessing entire permission grants

**Implementation Simplicity:**
The recursive approach actually **simplifies** the codebase by using the same processing logic for all scenarios:

- **Direct user sharing**: Creates `PROCESS_USER_*_ACCESS` operations directly
- **Group sharing**: Creates `EXPAND_GROUP_TO_USER_OPERATIONS` → creates individual user operations
- **Hierarchical propagation**: Each operation automatically creates child operations recursively

This architecture transforms KlickerUZH's permission system from a **fragile monolith** into an **elegant, self-organizing system** that can handle enterprise-scale complexity while remaining simple to understand, maintain, and extend.

---

**Next Steps**: Team review and approval for implementation planning of **Phase 1: Recursive Infrastructure**.
