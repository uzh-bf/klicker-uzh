# TODO-EPIC-3.md - Permission System v3.0 - Parallel Operation Creation (Dual-Mode)

This document tracks the detailed implementation tasks for Epic 3: Parallel Operation Creation in dual-mode alongside existing permission computation.

## Epic Overview

**Goal**: Extend the permission system to create PendingPermissionOperation entries IN ADDITION to existing permission computation, allowing parallel testing and validation before full migration.

**Key Principle**: Zero risk to existing functionality - the new system runs alongside the old one without any modifications to current logic.

**Key Deliverables**:
- Operation creation utilities that mirror permission computation
- Extended service functions that create operations after successful permissions
- Feature flag system for controlling operation creation
- Comprehensive logging and monitoring
- Performance validation with minimal overhead

## Tasks

### 1. Operation Creation Infrastructure

- [x] **Task 1.1**: Create operation builder module
  - **Date**: 2025-05-30
  - **Description**: Create new module for building PendingPermissionOperation entries
  - **Acceptance Criteria**:
    - New file: `packages/util/src/permissions/operationBuilder.ts`
    - Functions to build operations for each permission scenario
    - Separate from existing permission logic
    - Full TypeScript typing

- [x] **Task 1.2**: Implement operation creation helpers
  - **Date**: 2025-05-30
  - **Description**: Helper functions for creating different operation types
  - **Acceptance Criteria**:
    - `createGroupExpansionOperation()` ✓
    - `createUserAccessOperation()` ✓
    - `createPermissionUpdateOperation()` ✓
    - `createRevokeOperation()` ✓
    - Proper fingerprint generation ✓
    - Priority assignment logic ✓

- [x] **Task 1.3**: Add feature flag system
  - **Date**: 2025-05-30
  - **Description**: Implement configuration for enabling/disabling operation creation
  - **Acceptance Criteria**:
    - Environment variable: `ENABLE_PENDING_OPERATIONS` ✓
    - Runtime configuration option ✓
    - Default to disabled ✓
    - Easy toggle for testing ✓

### 2. Sharing Service Extensions

- [x] **Task 2.1**: Analyze existing permission flows
  - **Date**: 2025-05-30
  - **Description**: Document all permission computation paths in sharing service
  - **Acceptance Criteria**:
    - List all functions that trigger permission recomputation ✓
    - Identify transaction boundaries ✓
    - Map data flow for each scenario ✓
    - Document in service comments ✓

- [x] **Task 2.2**: Extend grantDirectPermission (shareObject)
  - **Date**: 2025-05-30
  - **Description**: Add operation creation to direct permission granting
  - **Acceptance Criteria**:
    ```typescript
    // After existing logic
    if (shouldCreateOperations()) {
      await createOperationsForDirectPermission(permission, ctx)
    }
    ```
    - Wrapped in try-catch ✓
    - Logs errors but doesn't throw ✓
    - Uses same transaction ✓

- [x] **Task 2.3**: Extend revokeDirectPermission (revokeObjectAccess)
  - **Date**: 2025-05-30
  - **Description**: Add operation creation for permission revocation
  - **Acceptance Criteria**:
    - Creates REVOKE_USER_PERMISSION operations ✓
    - Handles cascading revocations ✓
    - Non-blocking implementation ✓

- [x] **Task 2.4**: Extend updatePermissionLevel (changeObjectPermissionLevel)
  - **Date**: 2025-05-30
  - **Description**: Add operation creation for permission updates
  - **Acceptance Criteria**:
    - Creates UPDATE_PERMISSION_LEVEL operations ✓
    - Captures old and new permission levels ✓
    - Maintains operation history ✓

- [x] **Task 2.5**: Extend user group operations
  - **Date**: 2025-05-30
  - **Description**: Add operation creation for group member changes
  - **Acceptance Criteria**:
    - Creates EXPAND_GROUP_TO_USER_OPERATIONS ✓
    - Handles member additions/removals ✓
    - Links to parent group operation ✓

### 3. Permission Utility Extensions

- [ ] **Task 3.1**: Create operation mirroring utilities
  - **Date**: 
  - **Description**: Utilities that create operations matching permission computations
  - **Acceptance Criteria**:
    - Mirror logic from each recompute function
    - Create operations for all affected objects
    - Maintain parent-child relationships

- [ ] **Task 3.2**: Add operation creation to recomputeDerivedPermissions
  - **Date**: 
  - **Description**: Extend main entry point with operation creation
  - **Acceptance Criteria**:
    - Operations created after successful recomputation
    - Respects user-specific vs object-wide operations
    - Handles all object types

- [ ] **Task 3.3**: Extend entity-specific recompute functions
  - **Date**: 
  - **Description**: Add operation creation to each entity's recompute function
  - **Acceptance Criteria**:
    - All 8 entity types covered
    - Operations reflect actual computations performed
    - Consistent error handling

### 4. Logging and Monitoring

- [ ] **Task 4.1**: Implement comprehensive logging
  - **Date**: 
  - **Description**: Add detailed logging for operation creation
  - **Acceptance Criteria**:
    - Log operation creation attempts
    - Log failures with full context
    - Performance timing logs
    - Structured logging format

- [ ] **Task 4.2**: Add metrics collection
  - **Date**: 
  - **Description**: Collect metrics on operation creation
  - **Acceptance Criteria**:
    - Count of operations created by type
    - Success/failure rates
    - Performance overhead measurements
    - Queue depth tracking

- [ ] **Task 4.3**: Create monitoring dashboard
  - **Date**: 
  - **Description**: Basic dashboard for operation monitoring
  - **Acceptance Criteria**:
    - Operations created over time
    - Error rate visualization
    - Performance impact graphs
    - Queue status

### 5. Testing

- [ ] **Task 5.1**: Unit tests for operation builders
  - **Date**: 
  - **Description**: Test operation creation logic
  - **Acceptance Criteria**:
    - Test all operation types
    - Verify fingerprint generation
    - Test priority assignment
    - Error handling tests

- [ ] **Task 5.2**: Integration tests for dual-mode
  - **Date**: 
  - **Description**: Test operations created alongside permissions
  - **Acceptance Criteria**:
    - Verify operations match permissions
    - Test with feature flag on/off
    - Ensure no side effects
    - Transaction rollback tests

- [ ] **Task 5.3**: Performance benchmarks
  - **Date**: 
  - **Description**: Measure performance impact
  - **Acceptance Criteria**:
    - Baseline without operations
    - Overhead with operations enabled
    - Large-scale scenarios
    - Must be <5% overhead

- [ ] **Task 5.4**: Failure resilience tests
  - **Date**: 
  - **Description**: Ensure operation failures don't affect permissions
  - **Acceptance Criteria**:
    - Simulate database errors
    - Test transaction failures
    - Verify main flow continues
    - Check error logging

### 6. Validation Tools

- [ ] **Task 6.1**: Create operation validator
  - **Date**: 
  - **Description**: Tool to validate operations against actual permissions
  - **Acceptance Criteria**:
    - Compare operations with derived permissions
    - Identify discrepancies
    - Generate validation reports
    - CLI tool for manual checks

- [ ] **Task 6.2**: Build operation inspector
  - **Date**: 
  - **Description**: Tool to inspect pending operations
  - **Acceptance Criteria**:
    - List operations by status
    - Filter by type/user/object
    - Show operation hierarchy
    - Export capabilities

### 7. Documentation

- [ ] **Task 7.1**: Document dual-mode architecture
  - **Date**: 
  - **Description**: Comprehensive documentation of the approach
  - **Acceptance Criteria**:
    - Architecture diagrams
    - Data flow documentation
    - Configuration guide
    - Troubleshooting section

- [ ] **Task 7.2**: Create runbook
  - **Date**: 
  - **Description**: Operational runbook for dual-mode system
  - **Acceptance Criteria**:
    - How to enable/disable
    - Monitoring procedures
    - Common issues
    - Performance tuning

- [ ] **Task 7.3**: Update CLAUDE.md files
  - **Date**: 
  - **Description**: Update package documentation
  - **Acceptance Criteria**:
    - Document new modules
    - Explain dual-mode approach
    - Add usage examples

### 8. Rollout Preparation

- [ ] **Task 8.1**: Create rollout plan
  - **Date**: 
  - **Description**: Detailed plan for enabling in production
  - **Acceptance Criteria**:
    - Phased rollout strategy
    - Rollback procedures
    - Success metrics
    - Risk assessment

- [ ] **Task 8.2**: Prepare feature toggles
  - **Date**: 
  - **Description**: Production-ready feature flag system
  - **Acceptance Criteria**:
    - Environment-based toggles
    - Runtime configuration
    - A/B testing capability
    - Monitoring integration

## Dependencies

- Epic 2 must be completed (database schema in place)
- No changes to existing permission logic
- Minimal performance impact requirement

## Risks and Mitigations

1. **Risk**: Performance degradation
   - **Mitigation**: Comprehensive benchmarking, <5% overhead requirement

2. **Risk**: Operation creation affects main flow
   - **Mitigation**: Try-catch wrapping, fail-silent approach

3. **Risk**: Inconsistency between systems
   - **Mitigation**: Validation tools, comprehensive logging

## Success Metrics

- Zero regression in existing functionality
- <5% performance overhead when enabled
- 100% of permission operations have corresponding pending operations
- No increase in error rates
- Successful parallel operation for 2+ weeks in production

## Notes

- This epic focuses on safe, parallel implementation
- No existing logic should be modified
- All new code should be in separate modules where possible
- Extensive logging is critical for validation
- Performance monitoring is essential

## Discovered During Work

### Implementation Notes (2025-05-30)

1. **Function Names**: The actual function names in the sharing service differ from the task descriptions:
   - `shareObject` instead of `grantDirectPermission`
   - `revokeObjectAccess` instead of `revokeDirectPermission`
   - `changeObjectPermissionLevel` instead of `updatePermissionLevel`

2. **Helper Functions Created**: To maintain clean separation, three helper functions were added:
   - `createPendingOperationsForPermission` - For new permission grants
   - `createPendingOperationsForRevoke` - For permission revocation
   - `createPendingOperationsForUpdate` - For permission level changes

3. **Import Organization**: All operation-related imports were added to the util package imports at the top of sharing.ts

4. **Safety Measures**: All operation creation is wrapped in try-catch blocks with comprehensive logging to ensure no impact on existing functionality

5. **Permission Loading**: For operations that require user/userGroup relationships, we load the permission with includes before creating operations

### Critical Design Flaw (2025-05-31)

6. **User Group Operation Ambiguity**: The `EXPAND_GROUP_TO_USER_OPERATIONS` operation type is overloaded:
   - Used for grants (should expand to `PROCESS_USER_*_ACCESS`)
   - Used for updates (should expand to `UPDATE_PERMISSION_LEVEL`)
   - Used for revocations (should expand to `REVOKE_USER_PERMISSION`)
   
   The processor cannot distinguish the intent, creating a critical security risk.

## Critical Fix Required: Disambiguate Group Expansion Operations

### 9. Fix User Group Operation Ambiguity

- [x] **Task 9.1**: Update PermissionOperationType enum
  - **Date**: 2025-05-31
  - **Priority**: CRITICAL
  - **Description**: Add new operation types to disambiguate group expansion
  - **Changes**:
    ```prisma
    enum PermissionOperationType {
      EXPAND_GROUP_TO_USER_GRANT_OPERATIONS    // New
      EXPAND_GROUP_TO_USER_UPDATE_OPERATIONS   // New
      EXPAND_GROUP_TO_USER_REVOKE_OPERATIONS   // New
      // EXPAND_GROUP_TO_USER_OPERATIONS      // Keep for backward compatibility
      PROCESS_USER_ELEMENT_ACCESS
      // ... rest of operations
    }
    ```
  - **Acceptance Criteria**:
    - New operation types added to schema
    - Migration generated and tested
    - Old type kept for backward compatibility

- [x] **Task 9.2**: Update operation builder for grants
  - **Date**: 2025-05-31
  - **Priority**: CRITICAL
  - **Description**: Use EXPAND_GROUP_TO_USER_GRANT_OPERATIONS for new grants
  - **Code Changes**:
    ```typescript
    // In buildOperationsForDirectPermission
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
    ```

- [x] **Task 9.3**: Update operation builder for updates
  - **Date**: 2025-05-31
  - **Priority**: CRITICAL
  - **Description**: Use EXPAND_GROUP_TO_USER_UPDATE_OPERATIONS for updates
  - **Code Changes**:
    ```typescript
    // In buildOperationsForPermissionUpdate
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
    ```

- [x] **Task 9.4**: Update operation builder for revocations
  - **Date**: 2025-05-31
  - **Priority**: CRITICAL
  - **Description**: Use EXPAND_GROUP_TO_USER_REVOKE_OPERATIONS for revocations
  - **Code Changes**:
    ```typescript
    // In buildOperationsForPermissionRevoke
    if (permission.userGroup) {
      operations.push(
        buildOperation({
          operationType: 'EXPAND_GROUP_TO_USER_REVOKE_OPERATIONS',
          targetGroupId: permission.userGroup.id,
          objectId,
          objectType,
          oldPermissionLevel: permission.permissionLevel,
          // No permissionLevel for revocations
        })
      )
    }
    ```

- [x] **Task 9.5**: Update operation priorities
  - **Date**: 2025-05-31
  - **Priority**: CRITICAL
  - **Description**: Add priorities for new operation types
  - **Code Changes**:
    ```typescript
    const OPERATION_PRIORITIES: Record<PermissionOperationType, number> = {
      REVOKE_USER_PERMISSION: 100,
      EXPAND_GROUP_TO_USER_REVOKE_OPERATIONS: 95,    // New
      EXPAND_GROUP_TO_USER_UPDATE_OPERATIONS: 90,    // New
      EXPAND_GROUP_TO_USER_GRANT_OPERATIONS: 85,     // New
      // EXPAND_GROUP_TO_USER_OPERATIONS: 90,        // Keep for compatibility
      UPDATE_PERMISSION_LEVEL: 50,
      // ... rest
    }
    ```

- [x] **Task 9.6**: Update all tests
  - **Date**: 2025-05-31
  - **Priority**: HIGH
  - **Description**: Update tests to expect new operation types
  - **Test Updates**:
    - Element sharing with groups → EXPAND_GROUP_TO_USER_GRANT_OPERATIONS ✓
    - Permission updates with groups → EXPAND_GROUP_TO_USER_UPDATE_OPERATIONS (no test cases found)
    - Permission revocation with groups → EXPAND_GROUP_TO_USER_REVOKE_OPERATIONS (no test cases found)
    - Update operation counts and expectations ✓
    - Verify fingerprints work with new types ✓
  - **Notes**: 
    - Updated all 19 occurrences in operationGeneration.test.ts to use EXPAND_GROUP_TO_USER_GRANT_OPERATIONS
    - No tests found that create group operations for updates or revocations (these may need to be added later)
    - All occurrences were in shareObject contexts, confirming they were grant operations

- [x] **Task 9.7**: Add backward compatibility handling
  - **Date**: 2025-05-31
  - **Priority**: MEDIUM
  - **Description**: Ensure old operations can still be processed
  - **Implementation**:
    - ~~Keep old enum value in schema~~ (Not needed - user decided to remove old enum completely)
    - ~~Add deprecation comment~~ (Not applicable)
    - ~~Epic 4 processor should handle both old and new types~~ (Clean break approach)
    - ~~Log warning when encountering old type~~ (Not applicable)
  - **Notes**: User decided to make a clean break by removing the old EXPAND_GROUP_TO_USER_OPERATIONS enum value entirely. This avoids any ambiguity and ensures all new operations use the correct disambiguated types.

### Benefits of This Fix

1. **Security**: No risk of granting permissions when trying to revoke
2. **Clarity**: Processor logic becomes straightforward
3. **Type Safety**: Each operation type can have appropriate required fields
4. **Debugging**: Much easier to trace operation intent
5. **Future Proof**: Can add more specific types if needed

### Implementation Order

1. First: Update schema (Task 9.1)
2. Second: Update operation builders (Tasks 9.2-9.4)
3. Third: Update priorities (Task 9.5)
4. Fourth: Update tests (Task 9.6)
5. Fifth: Add compatibility layer (Task 9.7)

This is a CRITICAL fix that must be completed before Epic 4 implementation begins.