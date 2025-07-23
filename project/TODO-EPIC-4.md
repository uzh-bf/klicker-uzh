# TODO-EPIC-4.md - Permission System v3.0: Operation Processing Implementation

This file tracks the implementation tasks for Epic 4: Operation Processing Engine.

**Epic Status**: In Progress
**Started**: 2025-07-23
**Target Completion**: TBD

## Overview

Implement the asynchronous operation processing engine that consumes operations from the PendingPermissionOperation table. This is the critical missing piece that will make the permission system v3.0 functional.

## Core Tasks

### 1. Operation Processor Service Foundation
- [ ] Create `/packages/graphql/src/services/operationProcessor.ts` with basic structure
- [ ] Implement `fetchPendingOperations` with SELECT FOR UPDATE SKIP LOCKED
- [ ] Create operation type dispatcher pattern
- [ ] Add basic configuration (batch size, retry settings, etc.)
- [ ] Implement transaction wrapper for individual operation processing
- [ ] Add comprehensive logging infrastructure
- [ ] Create metrics collection points

### 2. Group Expansion Processors (Highest Priority)
- [ ] Implement `EXPAND_GROUP_TO_USER_GRANT_OPERATIONS` processor
- [ ] Implement `EXPAND_GROUP_TO_USER_UPDATE_OPERATIONS` processor
- [ ] Implement `EXPAND_GROUP_TO_USER_REVOKE_OPERATIONS` processor
- [ ] Add tests for group expansion edge cases
- [ ] Verify operation fingerprinting prevents duplicates

### 3. User Access Processors
- [ ] Implement `PROCESS_USER_ELEMENT_ACCESS` processor
- [ ] Implement `PROCESS_USER_COURSE_ACCESS` processor
- [ ] Implement `PROCESS_USER_ANSWER_COLLECTION_ACCESS` processor
- [ ] Implement `PROCESS_USER_LIVE_QUIZ_ACCESS` processor
- [ ] Implement `PROCESS_USER_PRACTICE_QUIZ_ACCESS` processor
- [ ] Implement `PROCESS_USER_MICROLEARNING_ACCESS` processor
- [ ] Implement `PROCESS_USER_GROUP_ACTIVITY_ACCESS` processor
- [ ] Implement `PROCESS_USER_CATALOG_COLLECTION_ACCESS` processor

### 4. Modification Processors
- [ ] Implement `UPDATE_PERMISSION_LEVEL` processor
- [ ] Implement `REVOKE_USER_PERMISSION` processor
- [ ] Handle cascading effects for hierarchical objects

### 5. Error Handling & Resilience
- [ ] Implement exponential backoff with jitter
- [ ] Add circuit breaker pattern for failing operations
- [ ] Create dead letter queue mechanism
- [ ] Handle cascading failures (parent operation fails)
- [ ] Add operation timeout handling
- [ ] Implement retry count limits

### 6. Performance & Optimization
- [ ] Implement operation coalescing for duplicate user/object pairs
- [ ] Add batch processing where safe (multiple operations in one transaction)
- [ ] Optimize database queries with proper indexes
- [ ] Add connection pooling configuration
- [ ] Implement operation cleanup job (remove old completed operations)

### 7. Monitoring & Observability
- [ ] Add Prometheus metrics for operation processing
- [ ] Track operation lag (creation vs processing rate)
- [ ] Monitor queue depth by operation type and priority
- [ ] Add performance metrics (p50, p95, p99 processing times)
- [ ] Create health check endpoint for processor status
- [ ] Add distributed tracing support

### 8. Testing
- [ ] Unit tests for each operation processor
- [ ] Integration tests for recursive operation processing
- [ ] Load tests with 1000+ user scenarios
- [ ] Failure scenario tests (database down, network issues)
- [ ] Idempotency verification tests
- [ ] Performance regression tests

### 9. Deployment & Operations
- [ ] Create Kubernetes deployment configuration
- [ ] Add horizontal pod autoscaling configuration
- [ ] Create runbooks for common issues
- [ ] Build consistency checking tools
- [ ] Implement operation replay capability
- [ ] Add manual intervention tools

### 10. Documentation
- [ ] Document processing architecture
- [ ] Create operation flow diagrams
- [ ] Write troubleshooting guide
- [ ] Document monitoring and alerting setup
- [ ] Update CLAUDE.md files with new components

## Implementation Order

1. **Phase 1**: Core processor + group expansion (highest impact)
2. **Phase 2**: User access processors + error handling
3. **Phase 3**: Optimization + monitoring
4. **Phase 4**: Testing + deployment preparation

## Technical Decisions

### Job Queue vs Direct Processing
- **Decision**: Start with SELECT FOR UPDATE SKIP LOCKED
- **Rationale**: Simpler initial implementation, can migrate to Bull/BullMQ later
- **Migration Path**: Abstract processor interface to allow queue swap

### Operation Coalescing Strategy
- **Decision**: Coalesce operations for same user/object within 5-second window
- **Rationale**: Reduces redundant processing without adding too much latency
- **Implementation**: Check for existing pending operations before creating new ones

### Monitoring First Approach
- **Decision**: Implement metrics and logging before processors
- **Rationale**: Need visibility from day one to debug issues
- **Tools**: Prometheus metrics, structured logging

## Progress Notes

**2025-07-23**: 
- Epic 4 planning completed
- Analyzed existing codebase structure
- Type definitions exist but no implementation
- Created this TODO file to track implementation

## Next Steps

1. Set up the basic operation processor service structure
2. Implement the first group expansion processor
3. Add comprehensive logging and metrics
4. Test with real data from the integration tests

## Blockers & Questions

- [ ] Confirm if Bull/BullMQ is available or should use native implementation
- [ ] Verify database connection pool settings for concurrent processing
- [ ] Decide on operation retention period (7 days? 30 days?)
- [ ] Confirm metric collection infrastructure (Prometheus endpoint?)