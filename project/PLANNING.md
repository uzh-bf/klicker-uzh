# PLANNING.md - KlickerUZH Project Planning

This document serves as the central planning document for the KlickerUZH project, tracking epics, features, and high-level architectural decisions.

## Project Overview

KlickerUZH is an open-source audience interaction platform designed for educational settings. The platform enables real-time quizzes, microlearning, practice activities, and group collaboration with gamification elements.

## Architecture

### Core Principles

- Microservices architecture with separate frontend and backend services
- GraphQL API for client-server communication
- PostgreSQL with Prisma ORM for data persistence
- Redis for caching and real-time features
- Monorepo structure using pnpm workspaces and Turbo

### Technology Stack

- **Frontend**: Next.js 15 (Pages Router), React, TailwindCSS, Apollo Client
- **Backend**: Node.js, GraphQL (Pothos), Prisma, Redis
- **Database**: PostgreSQL
- **Infrastructure**: Docker, Kubernetes
- **Testing**: Jest, Cypress
- **Development**: TypeScript, pnpm, Turbo

---

## Current Epics

### Epic 1: Sharing System Performance Optimization (Parent Epic)

**Status**: In Progress
**Priority**: High
**Created**: 2025-05-30
**Child Epics**: Epic 2, Epic 3, Epic 3A, Epic 4, Epic 5, Epic 6, Epic 7

#### Problem Description

The current sharing system implementation experiences transaction timeout issues when:

- Sharing objects (elements, courses, activities) with many users (e.g., 50+ users)
- Sharing large objects with complex hierarchies (e.g., courses with multiple activities and elements)
- User groups with many members require permission updates

The system currently performs all permission recomputations within single database transactions, leading to timeouts when the operation scale exceeds Prisma's transaction limits.

#### Root Cause Analysis

1. **Extensive Operations in Single Transactions**

   - The `recomputeDerivedPermissions` function and its entity-specific variants perform all operations within a single transaction
   - Each recomputation involves multiple database queries and writes

2. **Cascading Permission Propagation**

   - Permissions propagate through hierarchies: Course → Activities → Elements → Answer Collections
   - Each level multiplies the number of database operations required

3. **User Group Expansion**

   - When sharing with user groups, each member needs individual derived permission records
   - Large groups exponentially increase the transaction size

4. **Sequential Processing**

   - Elements and other child objects are processed sequentially in loops
   - No batching or parallel processing is utilized effectively

5. **Comprehensive Recomputation**
   - The system recomputes all permissions rather than just changed ones
   - No incremental update strategy exists

#### Proposed Solutions

##### Solution 1A: Group Permission Splitting (Recommended - High Impact)

Split user group permission workflow into two separate transactions:

- **Transaction 1**: Create DirectPermission for group + create DerivedPermission for the group itself (with status PENDING)
- **Transaction 2**: Create individual DerivedPermission records for all group members + mark group's DerivedPermission as COMPLETED
- Use status field to track completion and enable independent retry of Transaction 2

**Pros**:

- Immediate permission registration after Transaction 1 (ultra-lightweight)
- Transaction 2 scales only with group size, not object hierarchy depth
- Independent retry capability for member expansion
- Graceful degradation if member expansion fails
- Addresses the most common timeout scenario (large user groups)

**Cons**:

- Requires schema changes (DerivedPermission needs group support and status field)
- Permission checking logic becomes more complex (individual + group fallback)
- Temporary inconsistency window between transactions

##### Solution 1B: Transaction Batching (Complementary)

Break large permission operations into smaller, manageable transactions:

- Process users in batches (e.g., 10-20 users per transaction)
- Implement a queue-based system for permission updates
- Maintain consistency through careful transaction ordering

**Pros**:

- Maintains ACID properties within reasonable bounds
- Handles hierarchical propagation timeouts (Course → Activity → Element)
- Relatively simple to implement
- Can be rolled back gracefully

**Cons**:

- Requires careful handling of partial failures
- May introduce temporary permission inconsistencies

##### Solution 2: Async Background Processing

Move non-critical permission updates to a background job system:

- Immediate updates for direct permissions
- Queue derived permission calculations for background processing
- Use event-driven architecture for permission changes

**Pros**:

- Eliminates timeout issues entirely
- Better user experience (no waiting)
- Scalable to any number of users

**Cons**:

- Eventual consistency model
- Requires job queue infrastructure
- Complex error handling and retry logic

##### Solution 3: Query Optimization

Optimize the database queries and operations:

- Use bulk inserts/updates instead of individual operations
- Implement database-level batch operations
- Cache intermediate results within transactions

**Pros**:

- Improves performance without architectural changes
- Maintains current consistency model

**Cons**:

- May not solve the problem for very large operations
- Limited by database capabilities

##### Solution 4: Incremental Updates

Only compute and update changed permissions:

- Track permission dependencies
- Calculate minimal update set
- Skip unchanged permission paths

**Pros**:

- Dramatically reduces operation count
- Maintains consistency

**Cons**:

- Complex dependency tracking required
- Risk of missing updates

#### Implementation Plan

**Phase 1A: Group Permission Splitting (Immediate Impact)**

- [ ] Design schema changes for DerivedPermission (add userGroupId, status fields)
- [ ] Create Prisma migration for new fields and constraints
- [ ] Update permission checking logic to support group fallback
- [ ] Implement two-transaction group sharing workflow
- [ ] Add retry mechanism for failed member expansion
- [ ] Create monitoring for pending/failed group permissions

**Phase 1B: Analysis and Preparation**

- [ ] Profile current permission operations to identify remaining bottlenecks
- [ ] Create test scenarios with complex hierarchies (Course → Activity → Element)
- [ ] Design transaction batching strategy for hierarchical propagation
- [ ] Implement performance metrics and monitoring

**Phase 2: Hierarchical Transaction Batching**

- [ ] Implement batch processing for hierarchical permission propagation
- [ ] Add progress tracking for long-running operations
- [ ] Create fallback mechanisms for timeout scenarios in complex hierarchies
- [ ] Implement retry logic for failed batches

**Phase 3: Optimization**

- [ ] Add caching layer for permission calculations
- [ ] Implement bulk database operations
- [ ] Optimize query patterns
- [ ] Add incremental update detection

**Phase 4: Testing and Rollout**

- [ ] Comprehensive testing with production-like data volumes (both group and hierarchy scenarios)
- [ ] Performance benchmarking
- [ ] Gradual rollout with feature flags
- [ ] Monitor and tune based on production metrics

#### Success Metrics

- No transaction timeouts for operations with up to 1000 users
- Permission updates complete within 30 seconds for large operations
- Maintain data consistency throughout all operations
- No degradation in permission accuracy

#### Technical Considerations

**For Group Permission Splitting:**
- Schema migration strategy for adding userGroupId and status to DerivedPermission
- Update unique constraints to support both individual and group permissions
- Permission checking performance impact (individual query + potential group fallback)
- Handling of edge cases during the consistency window between transactions
- Retry mechanism design for failed member expansions
- Monitoring and alerting for stuck permissions in PENDING status

**General:**
- Maintain backward compatibility with existing permission system
- Ensure audit trail integrity throughout all transaction phases
- Consider impact on real-time permission checks (especially group fallback queries)
- Plan for rollback scenarios for both individual transactions and the overall feature
- Database performance considerations for new query patterns

### Epic 2: Permission System v3.0 - Database Schema and Migration

**Status**: Planning
**Priority**: Critical
**Created**: 2025-05-30
**Dependencies**: None
**Parent Epic**: Epic 1 (Sharing System Performance Optimization)

#### Problem Description

The current permission system experiences transaction timeouts when sharing objects with large user groups or complex hierarchies. The v3.0 architecture requires a new intermediate operation table to break down monolithic permission operations into granular, independently-processable tasks.

#### Goals

1. Create the `PendingPermissionOperation` database schema with appropriate fields and indexes
2. Generate and apply Prisma migration for the new table
3. Update Prisma schema files following KlickerUZH conventions
4. Ensure proper foreign key relationships and cascade behaviors
5. Set up the foundation for asynchronous permission processing

#### Technical Specification

**New Prisma Model**: `PendingPermissionOperation`
- Links to DirectPermission via foreign key with cascade delete
- Stores operation type, status, and priority
- Contains generic fields for target identification (userId, groupId, objectId, objectType)
- Tracks permission levels and operation context
- Includes retry logic fields and timestamps
- Uses proper indexes for query performance

**Key Design Decisions**:
- Use generic `objectId`/`objectType` fields instead of specific foreign keys (courseId, elementId, etc.)
- This maintains flexibility and avoids schema changes for new object types
- Operations are temporary processing records, not permanent data
- The existing Permission and DerivedPermission models remain unchanged

#### Success Criteria

- [ ] PendingPermissionOperation model added to `packages/prisma/src/prisma/schema/sharing.prisma`
- [ ] All required fields, enums, and indexes properly defined
- [ ] Migration successfully generated using `pnpm run prisma:migrate`
- [ ] Migration can be applied cleanly to development database
- [ ] Prisma client builds successfully with new types
- [ ] Schema follows existing KlickerUZH patterns and conventions

### Epic 3: Permission System v3.0 - Parallel Operation Creation (Dual-Mode)

**Status**: Planning  
**Priority**: Critical
**Created**: 2025-05-30
**Updated**: 2025-05-30
**Dependencies**: Epic 2 (must be completed first)
**Parent Epic**: Epic 1 (Sharing System Performance Optimization)

#### Problem Description

Once the database schema is in place, we need to extend the sharing services and permission utilities to create operations in the PendingPermissionOperation table IN ADDITION to the existing permission computation. This dual-mode approach allows us to test and validate the new system in parallel before switching over completely.

#### Goals

1. Extend sharing services to create operations alongside existing permission computation
2. Add operation creation utilities without modifying existing permission logic
3. Ensure both systems work in parallel without interference
4. Add comprehensive tests to verify operations are created correctly
5. Enable feature flags or configuration for controlling operation creation
6. Maintain 100% backward compatibility with zero risk to existing functionality

#### Technical Specification

**Extended Components (Not Modified)**:
1. **Sharing Service** (`packages/graphql/src/services/sharing.ts`):
   - Keep all existing `recomputeDerivedPermissions` calls unchanged
   - Add operation creation AFTER successful permission computation
   - Wrap operation creation in try-catch to prevent any impact on existing flow
   - Use same transaction for consistency but allow operation creation to fail silently

2. **Permission Utilities** (`packages/util/src/permissions/`):
   - Add new operation creation helper functions in separate module
   - Create operation builder utilities that mirror permission computation logic
   - Ensure operation creation is completely independent of permission computation

3. **Dual-Mode Implementation Pattern**:
   ```typescript
   // Example pattern for dual-mode implementation
   async function grantPermission(args, ctx) {
     // Existing logic remains unchanged
     const result = await existingPermissionLogic(args, ctx)
     
     // New operation creation in parallel (non-blocking)
     try {
       if (shouldCreateOperations()) {
         await createPendingOperations(args, ctx)
       }
     } catch (error) {
       // Log but don't fail the main operation
       console.error('Failed to create pending operations:', error)
     }
     
     return result
   }
   ```

4. **Operation Creation Strategy**:
   - Create operations that mirror what the existing system does
   - Include all necessary metadata for later processing validation
   - Use operation fingerprints to link operations with their permission results

**Testing Strategy**:
- Verify operations are created for all permission scenarios
- Ensure operation creation failures don't affect existing functionality
- Compare operations created with actual permission computations
- Performance tests to ensure minimal overhead

#### Success Criteria

- [ ] Existing permission logic remains completely unchanged
- [ ] Operations are created in parallel with existing permissions
- [ ] Operation creation failures don't affect main functionality
- [ ] Feature flag or config controls operation creation
- [ ] Comprehensive logging for operation creation
- [ ] Tests verify dual-mode operation without regression
- [ ] Performance impact is negligible (<5% overhead)

### Epic 3A: Permission System v3.0 - Integration Testing for Operation Generation

**Status**: Completed
**Priority**: High
**Created**: 2025-05-30
**Completed**: 2025-05-31
**Dependencies**: Epic 3 (must be completed first)
**Parent Epic**: Epic 1 (Sharing System Performance Optimization)

#### Problem Description

With the dual-mode implementation in place, we need comprehensive integration tests to verify that all sharing scenarios in the application correctly generate pending permission operations. This testing suite will validate the operation generation system before we proceed with the processing implementation.

#### Goals

1. Create comprehensive integration tests for all sharing scenarios
2. Verify correct operation types and data for each permission action
3. Test idempotency and fingerprint generation
4. Validate performance overhead remains within acceptable limits
5. Ensure edge cases and error scenarios are properly handled
6. Document all tested scenarios for future reference

#### Test Coverage Requirements

**Object Types to Test**:
- Elements (all types: SC, MC, KPRIM, NUMERICAL, FREE_TEXT, CONTENT, FLASHCARD, SELECTION, CASE_STUDY)
- Answer Collections
- Courses
- Activities (Live Quiz, Practice Quiz, Microlearning, Group Activity)
- Catalog Collections
- User Groups

**Sharing Scenarios**:
- Individual user permissions (READ, WRITE, EXECUTE, ADMIN)
- User group permissions with various member counts
- Permission level changes (upgrades and downgrades)
- Permission revocation
- Ownership transfers
- Catalog sharing requests and approvals

**Propagation Testing**:
- Course sharing with/without propagation to activities
- Activity sharing with/without propagation to elements
- Cascading propagation (Course → Activity → Element)
- Answer collection links to elements

#### Success Criteria

- [ ] Test file created at `packages/graphql/test/operationGeneration.test.ts`
- [ ] 100% coverage of all sharing service functions that create operations
- [ ] All operation types have corresponding test cases
- [ ] Idempotency verified through duplicate operation tests
- [ ] Performance tests show <5% overhead
- [ ] Edge cases documented and tested
- [ ] Integration with existing test infrastructure

### Epic 4: Permission System v3.0 - Operation Processing Implementation

**Status**: Planning
**Priority**: Critical
**Created**: 2025-05-30
**Dependencies**: Epic 3 and Epic 3A (must be completed first)
**Parent Epic**: Epic 1 (Sharing System Performance Optimization)

#### Problem Description

With operations being created in the PendingPermissionOperation table, we need to implement the processing engine that consumes these operations asynchronously. This includes the recursive processing pattern, error handling, and transaction management for scalable permission computation.

#### Goals

1. Implement the core operation processing engine with SELECT FOR UPDATE SKIP LOCKED
2. Create processors for each operation type
3. Implement recursive operation generation and processing
4. Add comprehensive error handling and retry mechanisms
5. Ensure idempotent operation processing
6. Maintain data consistency throughout processing

#### Technical Specification

**Core Components**:

1. **Operation Processor Service** (`packages/graphql/src/services/operationProcessor.ts`):
   - Main processing loop with configurable batch size
   - SELECT FOR UPDATE SKIP LOCKED for concurrent processing
   - Operation type dispatcher
   - Error handling and retry logic
   - Metrics and logging

2. **Operation Type Processors**:
   - `EXPAND_GROUP_TO_USER_OPERATIONS`: Expands group permissions to individual user operations
   - `PROCESS_USER_ELEMENT_ACCESS`: Computes user permissions for elements
   - `PROCESS_USER_COURSE_ACCESS`: Computes user permissions for courses
   - `PROCESS_USER_*_ACCESS`: Similar processors for all object types
   - `UPDATE_PERMISSION_LEVEL`: Updates existing permission levels
   - `REVOKE_USER_PERMISSION`: Removes permissions

3. **Recursive Processing Pattern**:
   - Parent operations create child operations
   - Dependency tracking through `parentOperationId`
   - Priority-based processing order
   - Completion tracking and cleanup

4. **Transaction Management**:
   - Small transaction boundaries per operation
   - Rollback handling for failed operations
   - Consistency guarantees

**Processing Flow**:
```
1. Fetch batch of operations (SELECT FOR UPDATE SKIP LOCKED)
2. For each operation:
   - Begin transaction
   - Process based on type
   - Generate child operations if needed
   - Update operation status
   - Commit or rollback
3. Handle errors with exponential backoff
4. Clean up completed operations
```

#### Success Criteria

- [ ] Operation processor successfully handles all operation types
- [ ] Concurrent processing works without conflicts
- [ ] Recursive operations are generated and processed correctly
- [ ] Error handling prevents data corruption
- [ ] Performance meets requirements (1000+ users without timeout)
- [ ] Idempotency is maintained across retries
- [ ] Comprehensive test coverage for all scenarios

### Epic 5: Permission System v3.0 - Migration and Rollout Strategy

**Status**: Planning
**Priority**: High
**Created**: 2025-05-30
**Dependencies**: Epic 4 (must be completed first)
**Parent Epic**: Epic 1 (Sharing System Performance Optimization)

#### Problem Description

The new permission system requires a careful migration strategy to transition from the current synchronous system to the asynchronous operation-based system. We need to ensure zero downtime, data consistency, and the ability to roll back if issues arise.

#### Goals

1. Design and implement feature flags for gradual rollout
2. Create migration scripts for existing permissions
3. Implement dual-write strategy during transition
4. Build verification tools to ensure consistency
5. Create rollback procedures
6. Document the migration process

#### Technical Specification

**Migration Phases**:

1. **Phase 1: Dual Write Mode**
   - Both old and new systems active
   - Operations created but not processed
   - Existing system continues to handle permissions
   - Verify operation creation correctness

2. **Phase 2: Shadow Processing**
   - Enable operation processing in shadow mode
   - Compare results with existing system
   - Monitor for discrepancies
   - Fix any issues found

3. **Phase 3: Gradual Cutover**
   - Route percentage of traffic to new system
   - Monitor performance and correctness
   - Gradually increase percentage
   - Keep rollback ready

4. **Phase 4: Full Migration**
   - All traffic on new system
   - Old system in standby
   - Final verification
   - Cleanup old code

**Key Components**:

1. **Feature Flags**:
   - `permission.v3.enabled`: Master switch
   - `permission.v3.write_operations`: Enable operation creation
   - `permission.v3.process_operations`: Enable processing
   - `permission.v3.read_path`: Use new system for reads
   - `permission.v3.traffic_percentage`: Gradual rollout control

2. **Migration Tools**:
   - Permission consistency checker
   - Operation queue monitor
   - Performance comparison dashboard
   - Rollback scripts

3. **Verification System**:
   - Compare old vs new permission calculations
   - Detect and log discrepancies
   - Automated reconciliation for minor differences
   - Alert on major inconsistencies

#### Success Criteria

- [ ] Feature flags implemented and tested
- [ ] Migration scripts handle all edge cases
- [ ] Shadow mode reveals no critical issues
- [ ] Performance improvements demonstrated
- [ ] Rollback procedures tested and documented
- [ ] Zero downtime during migration
- [ ] All permissions correctly migrated
- [ ] Monitoring and alerting in place

### Epic 6: Permission System v3.0 - Monitoring and Observability

**Status**: Planning
**Priority**: High
**Created**: 2025-05-30
**Dependencies**: Epic 4 (should be completed in parallel)
**Parent Epic**: Epic 1 (Sharing System Performance Optimization)

#### Problem Description

The asynchronous operation-based permission system requires comprehensive monitoring and observability to ensure reliable operation in production. We need visibility into operation processing performance, error rates, and system health.

#### Goals

1. Implement comprehensive metrics collection for operation processing
2. Create dashboards for real-time monitoring
3. Set up alerting for critical issues
4. Add distributed tracing for operation flows
5. Implement operation queue health checks
6. Create SLOs and SLIs for the permission system

#### Technical Specification

**Metrics to Track**:

1. **Operation Metrics**:
   - Operations created per minute by type
   - Operations processed per minute by type
   - Operation processing time (p50, p95, p99)
   - Operation queue depth by priority
   - Failed operations by type and error
   - Retry rates and success rates

2. **Performance Metrics**:
   - Transaction completion times
   - Database query performance
   - Concurrent processor utilization
   - Memory usage and garbage collection

3. **Business Metrics**:
   - Permission grants/revokes per hour
   - User group expansion times
   - Hierarchical propagation depth
   - Permission check latency

**Monitoring Infrastructure**:

1. **Metrics Collection**:
   - Prometheus metrics for operation statistics
   - Custom metrics for business KPIs
   - Database query performance tracking

2. **Dashboards**:
   - Operation processing overview
   - Error rate and retry monitoring
   - Queue depth and processing lag
   - Performance trends over time

3. **Alerting Rules**:
   - Queue depth exceeds threshold
   - Processing lag increases
   - Error rate spikes
   - Operation processing stalls
   - Database connection issues

4. **Distributed Tracing**:
   - Trace operation lifecycle from creation to completion
   - Visualize recursive operation chains
   - Identify performance bottlenecks

#### Success Criteria

- [ ] All key metrics are collected and stored
- [ ] Dashboards provide clear visibility into system health
- [ ] Alerts fire accurately for critical issues
- [ ] Tracing helps diagnose complex operation flows
- [ ] SLOs are defined and monitored
- [ ] Runbooks exist for common operational issues
- [ ] On-call team can effectively troubleshoot issues

### Epic 7: Permission System v3.0 - Performance Testing and Optimization

**Status**: Planning
**Priority**: Medium
**Created**: 2025-05-30
**Dependencies**: Epic 4 (must be completed first)
**Parent Epic**: Epic 1 (Sharing System Performance Optimization)

#### Problem Description

Before full production rollout, we need to thoroughly test the performance of the new permission system and optimize any bottlenecks found. This includes load testing, stress testing, and performance tuning.

#### Goals

1. Create comprehensive performance test suite
2. Establish performance baselines
3. Identify and optimize bottlenecks
4. Validate system behavior under load
5. Ensure scalability requirements are met
6. Document performance characteristics

#### Technical Specification

**Test Scenarios**:

1. **Load Testing**:
   - Share course with 1000+ users via user group
   - Complex hierarchy with 50 activities, 500 elements
   - Concurrent sharing operations by multiple users
   - Mixed read/write permission workloads

2. **Stress Testing**:
   - Maximum operation queue depth
   - Database connection limits
   - Memory pressure scenarios
   - Network partition tolerance

3. **Performance Benchmarks**:
   - Operation processing throughput
   - End-to-end permission update latency
   - Database query performance
   - Resource utilization efficiency

**Optimization Areas**:

1. **Database Optimizations**:
   - Query plan analysis and optimization
   - Index tuning for operation queries
   - Connection pooling configuration
   - Batch operation improvements

2. **Application Optimizations**:
   - Operation batching strategies
   - Memory allocation patterns
   - Concurrent processor tuning
   - Cache effectiveness

3. **Infrastructure Optimizations**:
   - Database hardware/configuration
   - Network latency reduction
   - Container resource limits
   - Kubernetes pod autoscaling

**Testing Infrastructure**:
- Dedicated performance testing environment
- Production-like data volumes
- Load generation tools
- Performance monitoring setup
- Automated test execution

#### Success Criteria

- [ ] Performance tests cover all critical scenarios
- [ ] System handles 1000+ user operations without timeout
- [ ] Operation processing maintains <100ms p99 latency
- [ ] Resource utilization remains within acceptable bounds
- [ ] No memory leaks or resource exhaustion
- [ ] Performance regression tests integrated into CI/CD
- [ ] Performance documentation complete

---

## Completed Epics

(None yet - this is a new planning document)

## Architecture Decisions

### ADR-001: Permission System Design

**Date**: Historical
**Decision**: Implement a hierarchical permission system with direct and derived permissions
**Rationale**: Provides flexibility while maintaining security and supporting complex sharing scenarios

### ADR-002: Monorepo Structure

**Date**: Historical
**Decision**: Use pnpm workspaces with Turbo for monorepo management
**Rationale**: Enables code sharing, consistent tooling, and efficient builds across all services

### ADR-003: Permission System v3.0 - Intermediate Operation Table Architecture

**Date**: 2025-05-30
**Decision**: Implement an intermediate operation table (PendingPermissionOperation) to break down monolithic permission operations into granular, independently-processable tasks
**Rationale**: 
- Eliminates transaction timeout issues for large-scale permission operations
- Enables true asynchronous processing with fine-grained progress tracking
- Provides fault tolerance through independent operation processing
- Maintains consistency while supporting eventual consistency model
- Uses generic objectId/objectType fields for flexibility across all object types

### ADR-004: Dual-Mode Permission Implementation Strategy

**Date**: 2025-05-30
**Decision**: Implement the new permission operation system in parallel with the existing system, creating operations alongside traditional permission computation without modifying existing logic
**Rationale**:
- Zero risk to existing functionality during development and testing
- Ability to validate operation creation against actual permission results
- Gradual rollout with feature flags and monitoring
- Easy rollback if issues are discovered
- Performance impact can be measured in production before full migration
- Allows A/B testing and comparison of both approaches

## Implementation Status

### Epic 2: Database Schema and Migration (Completed - 2025-05-30)
- ✅ Created PendingPermissionOperation model in Prisma schema
- ✅ Added PermissionOperationType and PermissionOperationStatus enums
- ✅ Migration created and applied (add_pending_permission_operation)
- ✅ Created utility functions in operationTypes.ts
- ✅ Updated documentation

### Epic 3: Parallel Operation Creation (Completed - 2025-05-30)
- ✅ Created operation builder module with comprehensive functions
- ✅ Implemented feature flag configuration system
- ✅ Extended shareObject function for permission grants
- ✅ Extended revokeObjectAccess for permission revocation
- ✅ Extended changeObjectPermissionLevel for permission updates
- ✅ All extensions wrapped in try-catch for safety
- ✅ Zero modifications to existing permission logic

### Epic 3A: Integration Testing for Operation Generation (Completed - 2025-05-31)
- ✅ Created comprehensive integration test file at packages/graphql/test/operationGeneration.test.ts
- ✅ Implemented test infrastructure with data factories and verification utilities
- ✅ Completed element sharing tests (all permission levels, user groups, updates, revocation)
- ✅ Completed course sharing tests (with and without propagation)
- ✅ Completed activity sharing tests (live quiz, practice quiz, microlearning, group activity)
- ✅ Completed idempotency tests with operation fingerprint verification
- ✅ Completed error handling tests (operation failure doesn't affect permission grant)
- ✅ Fixed operation persistence issue - all test suites now passing
- ✅ Resolved Prisma createMany limitation by using flat data structures
- ✅ **Phase 2 Critical Tasks Completed**:
  - ✅ Answer Collection Operations (Tasks 12.1-12.2)
  - ✅ Advanced Permission Scenarios (Tasks 15.1-15.4) 
  - ✅ Edge Cases and Error Scenarios (Tasks 16.1-16.3)
  - ✅ Propagation Verification, Group Expansion, Operation Dependencies, Performance Measurement
- 📋 **Deferred**: Lower priority tasks (catalog operations, advanced failure simulation, concurrent testing)

## Notes

- This document should be updated whenever new epics are planned or completed
- Each epic should include problem description, proposed solutions, and implementation plan
- Keep technical decisions documented for future reference
- Regular reviews ensure alignment with project goals
