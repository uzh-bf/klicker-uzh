# Affiliation-Based Participant Invitations

## Implementation Status

### 🚧 In Progress - Enhancing Invitation System
- [ ] **Multi-Email Invitation Matching**: Update auto-accept logic to check all verified affiliation emails
- [ ] **Database Query Optimization**: Ensure efficient lookups across multiple emails
- [ ] **Auth Flow Enhancement**: Integrate affiliation emails from EduID into invitation processing
- [ ] **Testing & Validation**: Comprehensive testing of multi-email invitation scenarios

## Overview

The Participant Invitation System has been enhanced to support affiliation-based email matching. When participants authenticate via EduID, the system now checks for invitations sent to any of their verified organizational emails, not just their primary email address.

## Problem Statement

### Current Limitation
The existing participant invitation system only checks the primary email address during SSO authentication. This creates a gap when:
1. Lecturers send invitations to students' organizational emails (e.g., student@uzh.ch)
2. Students authenticate via EduID which provides their primary email and verified affiliations
3. The primary email differs from the organizational email where the invitation was sent
4. Students don't get automatically enrolled despite having valid invitations

### Root Cause
- `autoAcceptInvitations` function only accepts a single email parameter
- Only the primary email from the EduID profile is used for invitation lookup
- Affiliation emails stored in `ParticipantAccount` are not utilized for invitation matching

## Architecture Enhancement

### Data Flow Diagram

```
1. Lecturer uploads CSV with org emails → ParticipantInvitation entries created (PENDING)
2. Student visits PWA and authenticates via EduID
3. EduID returns profile with:
   - Primary email (profile.email)
   - Affiliation emails (profile.swissEduIDLinkedAffiliationMail)
4. Auth app:
   - Creates/finds participant account
   - Links primary EduID account
   - Creates affiliation accounts for each org email
   - Checks for pending invitations across ALL emails (primary + affiliations)
   - Auto-accepts matching invitations → Creates Participation entries
5. Redirects to PWA with enrollment count
```

### Key Components Modified

#### 1. Multi-Email Invitation Processing
```typescript
// Before: Single email check
async function autoAcceptInvitations(email: string, participantId?: string)

// After: Multiple email check
async function autoAcceptInvitations(emails: string[], participantId?: string)
```

#### 2. Affiliation Email Extraction
```typescript
// Extract all emails for invitation checking
const affiliationEmails = profile.swissEduIDLinkedAffiliationMail || []
const primaryEmail = profile.email
const allEmails = [primaryEmail, ...affiliationEmails]
  .filter(Boolean)
  .map(email => email.toLowerCase())
```

#### 3. Enhanced Database Query
```typescript
// Multi-email invitation lookup
const pendingInvitations = await prisma.participantInvitation.findMany({
  where: {
    email: { in: emails }, // Use IN operator for multiple emails
    status: 'PENDING',
  },
})
```

## Implementation Details

### 1. Enhanced autoAcceptInvitations Function

**Location**: `apps/auth/src/pages/api/auth/[...nextauth].ts`

#### Current Signature
```typescript
async function autoAcceptInvitations(email: string, participantId?: string): Promise<number>
```

#### Enhanced Signature
```typescript
async function autoAcceptInvitations(emails: string[], participantId?: string): Promise<number>
```

#### Key Changes:
- Accept array of emails instead of single email
- Use `email: { in: emails }` for database query
- Maintain deduplication logic for multiple invitation matches
- Enhanced logging to track which emails matched invitations

### 2. Updated createOrLinkParticipant Function

#### Enhancement Points:
1. **Extract Affiliation Emails**: Parse `swissEduIDLinkedAffiliationMail` from EduID profile
2. **Combine Email Arrays**: Merge primary email with affiliation emails
3. **Call Enhanced autoAcceptInvitations**: Pass all emails for comprehensive invitation checking

#### Implementation:
```typescript
async function createOrLinkParticipant(profile: ExtendedProfile) {
  // ... existing logic ...
  
  // Extract all relevant emails
  const affiliationEmails = profile.swissEduIDLinkedAffiliationMail || []
  const allEmails = [
    profile.email,
    ...affiliationEmails
  ].filter(Boolean).map(email => email.toLowerCase())
  
  // Check for invitations across all emails
  const acceptedCount = await autoAcceptInvitations(
    allEmails,
    participant.id
  )
  
  // ... rest of logic ...
}
```

### 3. Database Performance Considerations

#### Current Index Structure
```prisma
model ParticipantInvitation {
  // ...
  @@unique([email, courseId])
  @@index([email])
}
```

#### Optimization Strategy:
- Existing email index supports IN queries efficiently
- Monitor query performance with multiple email lookups
- Consider compound index if performance issues arise

#### Query Performance:
```sql
-- Efficient multi-email lookup using existing index
SELECT * FROM ParticipantInvitation 
WHERE email IN ('primary@email.com', 'affiliation1@org.ch', 'affiliation2@org.ch')
  AND status = 'PENDING';
```

### 4. Error Handling & Logging

#### Enhanced Error Tracking:
- Log which specific emails matched invitations
- Track affiliation email processing errors separately
- Maintain detailed logs for debugging invitation acceptance

#### Example Logging:
```typescript
console.log(`Processing invitations for ${allEmails.length} emails:`, allEmails)
console.log(`Found ${pendingInvitations.length} pending invitations across all emails`)
console.log(`Successfully accepted ${acceptedCount} invitations`)
```

## Migration Strategy

### Phase 1: Backward Compatibility
- Maintain existing single-email `autoAcceptInvitations` calls
- Add overloaded version that accepts email arrays
- Ensure no breaking changes to existing flows

### Phase 2: Enhanced Processing
- Update `createOrLinkParticipant` to extract affiliation emails
- Implement multi-email invitation lookup
- Add comprehensive logging and error handling

### Phase 3: Performance Optimization
- Monitor database query performance
- Add additional indexes if needed
- Optimize query patterns for large user bases

### Phase 4: Testing & Validation
- Unit tests for multi-email scenarios
- Integration tests with real EduID profiles
- Performance testing with multiple affiliations

## Testing Scenarios

### Unit Tests

#### 1. Multi-Email Invitation Matching
```typescript
describe('autoAcceptInvitations - Multi-Email', () => {
  it('should accept invitations for any provided email', async () => {
    // Create invitations for different emails
    const primaryInvitation = await createInvitation('primary@email.com')
    const affiliationInvitation = await createInvitation('student@uzh.ch')
    
    // Process with both emails
    const acceptedCount = await autoAcceptInvitations([
      'primary@email.com',
      'student@uzh.ch'
    ], participantId)
    
    expect(acceptedCount).toBe(2)
  })
  
  it('should handle duplicate invitations gracefully', async () => {
    // Test edge cases with duplicate emails or invitations
  })
})
```

#### 2. Affiliation Email Extraction
```typescript
describe('createOrLinkParticipant - Affiliation Processing', () => {
  it('should extract affiliation emails from EduID profile', async () => {
    const profile = {
      email: 'primary@email.com',
      swissEduIDLinkedAffiliationMail: ['student@uzh.ch', 'researcher@ethz.ch']
    }
    
    // Verify all emails are processed for invitations
  })
})
```

### Integration Tests

#### 1. End-to-End EduID Flow
- Create invitations for organizational emails
- Simulate EduID authentication with affiliation emails
- Verify automatic enrollment occurs
- Check participation records are created correctly

#### 2. Mixed Email Scenarios
- Primary email has invitation
- Affiliation email has different invitation
- Verify both are processed correctly

### Performance Tests

#### 1. Multiple Affiliation Handling
- Test with users having 5+ affiliations
- Measure query performance
- Ensure acceptable response times

#### 2. Large-Scale Invitation Processing
- Test with courses having 1000+ invitations
- Monitor database performance
- Validate memory usage patterns

## Production Readiness

### Pre-Deployment Checklist

#### 1. Code Quality
- [ ] All unit tests pass
- [ ] Integration tests validate EduID flow
- [ ] Code review completed
- [ ] Performance benchmarks acceptable

#### 2. Database Preparation
- [ ] Existing indexes support new query patterns
- [ ] Migration scripts tested in staging
- [ ] Backup procedures verified

#### 3. Monitoring Setup
- [ ] Enhanced logging in place
- [ ] Performance monitoring configured
- [ ] Error tracking for multi-email scenarios

#### 4. Documentation
- [ ] Technical documentation updated
- [ ] Troubleshooting guide created
- [ ] User communication prepared

### Deployment Strategy

#### 1. Staged Rollout
- Deploy to QA environment first
- Test with real EduID test accounts
- Monitor performance and error rates

#### 2. Production Deployment
- Deploy during low-traffic period
- Monitor invitation acceptance rates
- Have rollback plan ready

#### 3. Post-Deployment Validation
- Verify invitation acceptance rates improve
- Monitor for any performance degradation
- Validate logging and error tracking

## Success Metrics

### Quantitative Measures
1. **Invitation Acceptance Rate**: Increase from current baseline
2. **Multi-Email Match Rate**: Percentage of logins that match affiliation emails
3. **Query Performance**: Response times remain under acceptable thresholds
4. **Error Rate**: No increase in authentication errors

### Qualitative Measures
1. **User Experience**: Students automatically enrolled without manual intervention
2. **Lecturer Satisfaction**: Reduced support requests for invitation issues
3. **System Reliability**: No disruption to existing authentication flows

## Troubleshooting Guide

### Common Issues

#### 1. Invitations Not Auto-Accepted
**Symptoms**: Student logs in but doesn't get enrolled despite invitation
**Debugging Steps**:
1. Check EduID profile contains expected affiliation emails
2. Verify invitation was sent to one of the profile emails
3. Review logs for email normalization issues
4. Confirm ParticipantAccount entries were created for affiliations

#### 2. Performance Issues
**Symptoms**: Slow authentication response times
**Debugging Steps**:
1. Monitor database query execution times
2. Check for missing indexes on ParticipantInvitation
3. Review query plans for multi-email lookups
4. Consider optimizing affiliation processing logic

#### 3. Duplicate Enrollments
**Symptoms**: Student enrolled multiple times in same course
**Debugging Steps**:
1. Check for race conditions in invitation processing
2. Verify unique constraints on Participation table
3. Review transaction isolation in auto-accept logic

### Debug Tools

#### 1. Enhanced Logging
```typescript
// Enable detailed logging for troubleshooting
console.log('EduID Profile:', {
  primaryEmail: profile.email,
  affiliationEmails: profile.swissEduIDLinkedAffiliationMail,
  processedEmails: allEmails
})
```

#### 2. Database Queries
```sql
-- Check pending invitations for a user
SELECT pi.*, c.name as courseName 
FROM ParticipantInvitation pi
JOIN Course c ON pi.courseId = c.id
WHERE pi.email IN ('primary@email.com', 'affiliation@org.ch')
  AND pi.status = 'PENDING';

-- Check participant affiliations
SELECT pa.* FROM ParticipantAccount pa
WHERE pa.participantId = 'participant-uuid'
  AND pa.type = 'affiliation';
```

## Future Enhancements

### Email Alias Support
- Handle email aliases and forwarding addresses
- Support multiple domains for same organization
- Enhanced email normalization logic

### Advanced Affiliation Matching
- Fuzzy matching for similar email domains
- Support for historical affiliation changes
- Integration with external directory services

### Performance Optimizations
- Caching of affiliation lookups
- Batch processing for large invitation sets
- Optimized database query patterns

### Analytics & Reporting
- Track affiliation email usage patterns
- Monitor invitation acceptance rates by email type
- Generate reports on multi-email matching effectiveness

## Security Considerations

### Email Verification
- Only use verified affiliation emails from EduID
- Validate email format and domain constraints
- Prevent injection attacks through email parameters

### Data Privacy
- Handle affiliation emails according to privacy policies
- Ensure proper consent for email processing
- Implement data retention policies for affiliations

### Access Control
- Maintain existing access controls for invitation system
- Ensure affiliation-based access doesn't bypass security
- Audit logging for all affiliation-related operations

## Compliance & Governance

### GDPR Compliance
- Document affiliation email processing
- Ensure user consent for expanded email matching
- Implement right to be forgotten for affiliations

### Audit Requirements
- Log all invitation acceptance events
- Track changes to affiliation processing logic
- Maintain audit trail for compliance reviews

### Change Management
- Document all system changes
- Version control for configuration updates
- Rollback procedures for production issues