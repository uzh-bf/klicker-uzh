# Invite Existing Users Implementation Plan

## Overview

This plan extends the participant invitation system to handle existing verified users during invitation creation. Instead of all invitations being PENDING until login, the system will now automatically enroll users who already have verified ParticipantAccount records.

## Problem Statement

Currently, when invitations are imported via CSV:
1. All invitations are created as PENDING status
2. Users must log in via eduID SSO for invitations to be auto-accepted
3. Existing verified users experience unnecessary delay in course access

The solution should:
- Detect existing verified users during invitation import
- Immediately create participations for verified users
- Mark their invitations as ACCEPTED
- Maintain PENDING status for truly new users

## Key Design Decisions

### 1. SSO-Only Matching Strategy
**Decision**: Only use ParticipantAccount.ssoId for matching existing users
**Rationale**: 
- Participant.email is user-defined and unvalidated (work in progress)
- ParticipantAccount.ssoId comes from trusted SSO providers
- ParticipantAccount.isVerified ensures account authenticity

### 2. Database Schema Compatibility
**Decision**: No schema changes required
**Rationale**:
- Existing ParticipantInvitation model supports both PENDING and ACCEPTED states
- ParticipantAccount already has verification flags
- Current login flow already handles invitation auto-acceptance

### 3. Service-Layer Architecture
**Decision**: Create reusable service layer for invitation management
**Rationale**:
- Enables easy backend GraphQL integration later
- Separates business logic from CLI script concerns
- Supports proper transaction handling and error management

## Implementation Components

### 1. Core Invitation Service

**File**: `packages/graphql/src/services/participantInvitations.ts`

**Key Functions**:
```typescript
createParticipantInvitations(courseId: string, emails: string[], options?: CreateInvitationsOptions): Promise<CreateInvitationsResponse>
getCourseInvitations(courseId: string): Promise<ParticipantInvitation[]>
getParticipantInvitations(participantId: string): Promise<ParticipantInvitation[]>
```

**Processing Logic**:
1. Validate course exists and is assessment-enabled
2. For each email:
   - Normalize to lowercase
   - Validate email format
   - Check for existing invitation (skip if duplicate)
   - Query for verified ParticipantAccount with matching ssoId
   - If found: auto-accept invitation and create participation
   - If not found: create PENDING invitation
3. Return detailed results with counts and individual statuses

**Transaction Handling**:
- Use Prisma transactions for auto-acceptance (invitation + participation)
- Batch processing to handle large CSV imports efficiently
- Proper error isolation (one failed email doesn't break the batch)

### 2. Enhanced Import Script

**File**: `packages/graphql/src/scripts/importParticipantInvitations.ts`

**Changes**:
- Replace direct database calls with service layer
- Enhanced output reporting:
  ```
  === Import Results ===
  Total rows processed: 150
  Successfully created (PENDING): 120
  Auto-accepted (existing users): 22
  Skipped (duplicates): 7
  Errors: 1
  
  Auto-accepted users:
  - student1@uzh.ch → participant_id_123
  - student2@uzh.ch → participant_id_456
  ```
- Maintain dry-run functionality
- Same CLI interface and validation

### 3. Database Query Strategy

**Existing User Detection**:
```sql
SELECT pa.participantId, p.id, p.username 
FROM ParticipantAccount pa
JOIN Participant p ON pa.participantId = p.id
WHERE pa.ssoId = ? 
  AND pa.isVerified = true
```

**Security Considerations**:
- ONLY trust verified ParticipantAccount records
- Never use participant.email for matching
- Log all auto-acceptances for audit trail

### 4. Testing Strategy

**Unit Tests** (`packages/graphql/src/tests/participantInvitations.test.ts`):
- Test invitation creation for new users (PENDING)
- Test auto-acceptance for verified SSO users
- Test that unverified accounts remain PENDING
- Test duplicate detection
- Test transaction rollback on errors
- Test batch processing
- Test email validation

**Integration Tests**:
- End-to-end CSV import with mixed user types
- Verify participation creation for auto-accepted users
- Test dry-run mode accuracy
- Test script output formatting

## Use Cases and Flows

### Use Case 1: Import with Mixed Users
**Scenario**: CSV contains 100 emails, 30 are existing verified users
**Expected Behavior**:
- 30 invitations created as ACCEPTED with immediate participations
- 70 invitations created as PENDING
- Script reports both counts clearly
- Existing users can access course immediately

### Use Case 2: All New Users
**Scenario**: CSV contains 50 emails, none have existing accounts
**Expected Behavior**:
- 50 invitations created as PENDING
- Users must complete eduID login for enrollment
- Current SSO callback logic handles their acceptance

### Use Case 3: All Existing Users
**Scenario**: CSV contains 25 emails, all have verified accounts
**Expected Behavior**:
- 25 invitations created as ACCEPTED
- 25 participations created immediately
- Users see course in their dashboard without additional login

### Use Case 4: Duplicate Import
**Scenario**: Same CSV imported twice
**Expected Behavior**:
- Second import detects all duplicates
- No duplicate invitations created
- Clear reporting of skipped entries

## Backend Integration Preparation

### GraphQL Mutation Design
```graphql
mutation CreateParticipantInvitations($input: CreateInvitationsInput!) {
  createParticipantInvitations(input: $input) {
    totalProcessed
    created
    autoAccepted
    duplicates
    errors
    results {
      email
      status
      invitationId
      participantId
      error
    }
  }
}
```

### Service Layer Benefits
- Consistent validation and error handling
- Transaction management
- Audit logging capability
- Rate limiting support (future)
- Batch processing optimization

## Migration and Rollout

### Phase 1: Service Layer Implementation
1. Create invitation service with comprehensive tests
2. Verify service works correctly in isolation
3. Test various edge cases and error conditions

### Phase 2: Script Enhancement
1. Update import script to use service
2. Test with existing CSV files
3. Verify output formatting and dry-run mode
4. Performance testing with large imports

### Phase 3: Validation and Documentation
1. Create comprehensive test data sets
2. Document new behavior and output formats
3. Update existing documentation
4. Training for lecturers on new reporting

### Phase 4: Production Deployment
1. Deploy service layer first (backward compatible)
2. Update import script
3. Monitor first imports for any issues
4. Collect feedback from users

## Performance Considerations

### Batch Processing
- Process invitations in configurable batches (default 50)
- Avoid memory issues with large CSV files
- Provide progress indication for large imports

### Database Optimization
- Existing indexes on ParticipantAccount.ssoId support efficient lookups
- Transaction boundaries minimize lock contention
- Bulk participation creation when possible

### Error Handling
- Individual email failures don't abort entire import
- Clear error reporting with specific failure reasons
- Graceful handling of database constraint violations

## Security and Compliance

### Email Privacy
- Email normalization (lowercase) for consistent matching
- No additional email storage beyond existing schema
- Audit trail of auto-acceptance actions

### Access Control
- Only assessment-enabled courses can have invitations
- Lecturer must have course access to import invitations
- Service layer validates course permissions

### Data Integrity
- Transactions ensure invitation/participation consistency
- Duplicate detection prevents data inconsistencies
- Proper foreign key relationships maintained

## Future Enhancements

### Immediate Opportunities
- GraphQL mutation for frontend invitation management
- Real-time status updates during large imports
- Invitation analytics and reporting dashboard

### Advanced Features
- Email notification integration for auto-accepted users
- Bulk invitation management (revoke, resend)
- Custom invitation messages per course
- Expiry dates for pending invitations

## Risk Mitigation

### Primary Risks
1. **Performance degradation** with large imports
   - Mitigation: Batch processing and progress monitoring

2. **Data inconsistency** during auto-acceptance
   - Mitigation: Proper transaction boundaries

3. **False matches** due to email variations
   - Mitigation: Exact ssoId matching only, no fuzzy logic

4. **Breaking existing workflows**
   - Mitigation: Maintain CLI compatibility, enhanced reporting only

### Testing Strategy
- Comprehensive unit test coverage (>90%)
- Integration tests with real database
- Performance testing with large datasets
- Manual testing with actual CSV files

## Success Metrics

### Functional Success
- All existing users auto-enrolled during import
- No false positives or negatives in user matching
- Consistent behavior between CLI and future API
- Clear, actionable error messages

### Performance Success
- Import time scales linearly with user count
- Memory usage remains bounded for large files
- Database performance impact minimal
- No degradation of existing login flow

### User Experience Success
- Lecturers understand new output format immediately
- Students see courses appear without additional login
- Reduced support requests about "missing" enrollments
- Clear audit trail for administrative review