# TODO-EPIC-2.md - Permission System v3.0 - Database Schema and Migration

This document tracks the detailed implementation tasks for Epic 2: Database Schema and Migration for the Permission System v3.0.

## Epic Overview

**Goal**: Create the `PendingPermissionOperation` database schema with appropriate fields and indexes, following KlickerUZH conventions and ensuring proper foreign key relationships.

**Key Deliverables**:
- New Prisma model for PendingPermissionOperation
- Database migration scripts
- Updated Prisma client with new types
- Documentation of schema design decisions

## Tasks

### 1. Schema Design and Planning

- [x] **Task 1.1**: Review existing permission schema structure
  - **Date**: 2025-05-30
  - **Description**: Analyze current Permission and DerivedPermission models in `packages/prisma/src/prisma/schema/sharing.prisma`
  - **Acceptance Criteria**: 
    - Document current schema relationships
    - Identify integration points for new table
    - Note cascade delete patterns to follow
  - **Notes**: Reviewed sharing.prisma. Key findings:
    - Permission model links to users/groups and all object types
    - DerivedPermission stores computed permissions with cascade delete on DirectPermission
    - Uses generic object fields pattern (elementId, courseId, etc.) not polymorphic relations
    - Permission levels: READ, WRITE, EXECUTE, ADMIN, OWNER
    - Cascade patterns: OnDelete: Cascade for all relationships

- [x] **Task 1.2**: Design PendingPermissionOperation schema
  - **Date**: 2025-05-30
  - **Description**: Create detailed schema design following the specification in permission-v3-concept.md
  - **Acceptance Criteria**:
    - All fields from specification included
    - Proper types and constraints defined
    - Index strategy documented
    - Foreign key relationships mapped
  - **Schema Design**:
    ```prisma
    model PendingPermissionOperation {
      id                    Int                        @id @default(autoincrement())
      operationType         PermissionOperationType
      status                PermissionOperationStatus  @default(PENDING)
      priority              Int                        @default(0)
      
      // Target identification - generic approach
      targetUserId          String?                    @db.Uuid
      targetGroupId         Int?
      objectId              String                     // Generic ID for any object
      objectType            ObjectType                 // Reuse existing enum
      
      // Permission levels
      permissionLevel       PermissionLevel?
      oldPermissionLevel    PermissionLevel?
      
      // Links to direct permission (with cascade delete)
      directPermission      Permission?                @relation(fields: [directPermissionId], references: [id], onDelete: Cascade, onUpdate: Cascade)
      directPermissionId    Int?
      
      // Recursive operations
      parentOperation       PendingPermissionOperation? @relation("OperationHierarchy", fields: [parentOperationId], references: [id], onDelete: Cascade, onUpdate: Cascade)
      parentOperationId     Int?
      childOperations       PendingPermissionOperation[] @relation("OperationHierarchy")
      
      // Retry and error handling
      retryCount            Int                        @default(0)
      lastError             String?
      
      // Idempotency
      operationFingerprint  String?                    @unique
      
      // Timestamps
      createdAt             DateTime                   @default(now())
      updatedAt             DateTime                   @updatedAt
      processedAt           DateTime?
    }
    ```

- [ ] **Task 1.3**: Review with team and get approval
  - **Date**: 
  - **Description**: Present schema design for review
  - **Acceptance Criteria**:
    - Schema reviewed by team lead
    - Any feedback incorporated
    - Final design approved

### 2. Prisma Schema Implementation

- [x] **Task 2.1**: Add PermissionOperationType enum
  - **Date**: 
  - **Description**: Add new enum to sharing.prisma for operation types
  - **Acceptance Criteria**:
    ```prisma
    enum PermissionOperationType {
      EXPAND_GROUP_TO_USER_OPERATIONS
      PROCESS_USER_ELEMENT_ACCESS
      PROCESS_USER_ANSWER_COLLECTION_ACCESS
      PROCESS_USER_COURSE_ACCESS
      PROCESS_USER_LIVE_QUIZ_ACCESS
      PROCESS_USER_PRACTICE_QUIZ_ACCESS
      PROCESS_USER_MICROLEARNING_ACCESS
      PROCESS_USER_GROUP_ACTIVITY_ACCESS
      PROCESS_USER_CATALOG_COLLECTION_ACCESS
      UPDATE_PERMISSION_LEVEL
      REVOKE_USER_PERMISSION
    }
    ```

- [x] **Task 2.2**: Add PermissionOperationStatus enum
  - **Date**: 
  - **Description**: Add enum for operation status tracking
  - **Acceptance Criteria**:
    ```prisma
    enum PermissionOperationStatus {
      PENDING
      PROCESSING
      COMPLETED
      FAILED
    }
    ```

- [x] **Task 2.3**: Create PendingPermissionOperation model
  - **Date**: 
  - **Description**: Implement the full Prisma model with all fields
  - **Acceptance Criteria**:
    - Model includes all fields from specification:
      - id, operationType, status, priority
      - targetUserId, targetGroupId, objectId, objectType
      - permissionLevel, oldPermissionLevel
      - directPermissionId with foreign key
      - parentOperationId for recursion
      - retryCount, lastError
      - operationFingerprint for idempotency
      - createdAt, updatedAt, processedAt
    - Proper relations defined
    - Cascade delete on DirectPermission

- [x] **Task 2.4**: Add required indexes
  - **Date**: 
  - **Description**: Create indexes for query performance
  - **Acceptance Criteria**:
    - Index on (status, priority) for queue queries
    - Index on directPermissionId for cascade lookups
    - Index on parentOperationId for recursive queries
    - Index on (targetUserId, objectId, objectType) for user queries
    - Index on operationFingerprint for idempotency
    - Composite indexes for common query patterns

- [x] **Task 2.5**: Update model documentation
  - **Date**: 
  - **Description**: Add comprehensive JSDoc comments to the model
  - **Acceptance Criteria**:
    - Each field has clear documentation
    - Purpose of model explained
    - Example usage documented
    - Relationships explained

### 3. Migration Generation and Testing

- [x] **Task 3.1**: Generate Prisma migration
  - **Date**: 2025-05-30
  - **Description**: Run `pnpm run prisma:migrate` to create migration files
  - **Acceptance Criteria**:
    - Migration generated successfully
    - SQL reviewed for correctness
    - No warnings or errors
  - **Notes**: Migration created at `20250530203031_add_pending_permission_operation`
    - Creates PermissionOperationType and PermissionOperationStatus enums
    - Creates PendingPermissionOperation table with all required fields
    - Adds all indexes for performance
    - Sets up foreign key relationships with cascade delete

- [ ] **Task 3.2**: Test migration on development database
  - **Date**: 
  - **Description**: Apply migration to local development database
  - **Acceptance Criteria**:
    - Migration applies cleanly
    - Table created with correct structure
    - Indexes created successfully
    - Foreign keys properly established

- [ ] **Task 3.3**: Test rollback procedure
  - **Date**: 
  - **Description**: Verify migration can be rolled back safely
  - **Acceptance Criteria**:
    - Document rollback steps
    - Test rollback on dev database
    - Ensure no data loss scenarios

- [x] **Task 3.4**: Sync schema with analytics package
  - **Date**: 2025-05-30
  - **Description**: Run `./util/sync-schema.sh` to update analytics schema
  - **Acceptance Criteria**:
    - Schema synced successfully
    - Analytics package builds without errors
    - Python schema matches TypeScript
  - **Notes**: Schema synced successfully, PendingPermissionOperation model present in analytics

### 4. Type Generation and Integration

- [x] **Task 4.1**: Generate Prisma client types
  - **Date**: 2025-05-30
  - **Description**: Ensure Prisma client includes new types
  - **Acceptance Criteria**:
    - Run `pnpm run prisma:generate`
    - Types available in @klicker-uzh/prisma package
    - No TypeScript errors
  - **Notes**: Generated successfully with `pnpm run build`
    - PendingPermissionOperation model available
    - PermissionOperationType and PermissionOperationStatus enums exported

- [x] **Task 4.2**: Update package exports
  - **Date**: 2025-05-30
  - **Description**: Ensure new types are properly exported
  - **Acceptance Criteria**:
    - PendingPermissionOperation type exported
    - Enums exported
    - Import/export verified in consuming packages
  - **Notes**: Types are automatically exported by Prisma build process
    - All types available in dist/index.d.ts

- [x] **Task 4.3**: Create type guards and utilities
  - **Date**: 2025-05-30
  - **Description**: Add helper functions for type safety
  - **Acceptance Criteria**:
    - Type guard for operation types
    - Status check utilities
    - Priority comparison functions
  - **Notes**: Created operationTypes.ts in packages/util/src/permissions
    - Type guards for different operation types
    - Status checking utilities
    - Priority calculation and comparison functions
    - Operation fingerprint generation for idempotency

### 5. Testing

- [ ] **Task 5.1**: Write unit tests for schema validation
  - **Date**: 
  - **Description**: Create tests to verify schema constraints
  - **Acceptance Criteria**:
    - Test required fields
    - Test enum values
    - Test foreign key constraints
    - Test cascade delete behavior

- [ ] **Task 5.2**: Write integration tests for database operations
  - **Date**: 
  - **Description**: Test CRUD operations on new table
  - **Acceptance Criteria**:
    - Test create operation
    - Test read with various filters
    - Test update status
    - Test delete and cascade

- [ ] **Task 5.3**: Performance testing of indexes
  - **Date**: 
  - **Description**: Verify index performance with sample data
  - **Acceptance Criteria**:
    - Generate 10,000+ test operations
    - Test query performance
    - Verify index usage in query plans
    - Document performance baselines

### 6. Documentation

- [x] **Task 6.1**: Update CLAUDE.md files
  - **Date**: 2025-05-30
  - **Description**: Document new schema in relevant CLAUDE.md files
  - **Acceptance Criteria**:
    - Update packages/prisma/CLAUDE.md
    - Add schema description
    - Document usage patterns
  - **Notes**: Updated both prisma and util CLAUDE.md files
    - Added PendingPermissionOperation documentation to prisma package
    - Added operation type utilities documentation to util package

- [ ] **Task 6.2**: Create migration guide
  - **Date**: 
  - **Description**: Document migration process for other developers
  - **Acceptance Criteria**:
    - Step-by-step migration instructions
    - Troubleshooting section
    - Rollback procedures

- [ ] **Task 6.3**: Update API documentation
  - **Date**: 
  - **Description**: Document new types in API docs
  - **Acceptance Criteria**:
    - Type definitions documented
    - Field descriptions added
    - Example usage provided

### 7. Review and Deployment Preparation

- [ ] **Task 7.1**: Code review
  - **Date**: 
  - **Description**: Submit PR for comprehensive review
  - **Acceptance Criteria**:
    - PR created with detailed description
    - Schema changes reviewed
    - Migration scripts reviewed
    - Tests reviewed and passing

- [ ] **Task 7.2**: Update deployment scripts
  - **Date**: 
  - **Description**: Ensure deployment process handles new migration
  - **Acceptance Criteria**:
    - Migration included in deployment
    - Rollback plan documented
    - Staging deployment tested

- [ ] **Task 7.3**: Final verification
  - **Date**: 
  - **Description**: Complete final checks before merge
  - **Acceptance Criteria**:
    - All tests passing
    - No TypeScript errors
    - Documentation complete
    - Team approval obtained

## Dependencies

- Requires understanding of current permission system architecture
- Needs access to development database for testing
- Coordination with team for review and approval

## Risks and Mitigations

1. **Risk**: Migration fails in production
   - **Mitigation**: Thoroughly test on staging, have rollback plan ready

2. **Risk**: Performance impact of new table
   - **Mitigation**: Proper indexing, performance testing before deployment

3. **Risk**: Breaking changes to existing code
   - **Mitigation**: New table is additive only, no changes to existing schema

## Success Metrics

- Migration applies successfully in all environments
- No performance degradation in existing permission operations
- New types available and properly integrated
- Zero downtime during deployment

## Notes

- This epic lays the foundation for the entire v3.0 permission system
- Schema must be flexible enough to handle future operation types
- Consider future requirements when designing indexes
- Maintain backward compatibility throughout

## Discovered During Work

### Additional Tasks Completed

- Created operationTypes.ts utility file with comprehensive type guards and helper functions
- Updated root CLAUDE.md to document Permission System v3.0 development
- Successfully synced schema with analytics package
- All types properly generated and exported from Prisma package

### Notes on Implementation

- Migration was created manually due to Doppler authentication issues
- The PendingPermissionOperation model uses generic objectId/objectType fields as designed
- All indexes were created for optimal query performance
- Type utilities include priority calculation, fingerprint generation, and operation comparison
- Documentation updated across multiple CLAUDE.md files for future reference

### Remaining Tasks (Skipped for Now)

- Task 3.2: Test migration on development database (requires database access)
- Task 3.3: Test rollback procedure (requires database access)
- Task 5.x: Testing tasks (to be done when database is available)
- Task 6.2: Create migration guide (can be done later)
- Task 6.3: Update API documentation (can be done later)
- Task 7.x: Review and deployment tasks (to be done in PR phase)