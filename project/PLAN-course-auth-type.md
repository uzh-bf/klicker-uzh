# Course AuthType Implementation Plan

## Overview

The `authType` field on the Course model separates authentication mechanisms from assessment features, providing more flexibility in how students can join courses.

### AuthType Values
- **`SSO`**: Students can ONLY join via invitations (no PIN code)
- **`PIN`**: Students join via PIN code (traditional method)

### Key Rules
1. Assessment courses MUST have `authType = SSO` (enforced)
2. Non-assessment courses can use either `SSO` or `PIN`
3. When `authType = SSO`, the course has no PIN code (`pinCode = null`)
4. When `authType = PIN`, the course has a generated PIN code

## Current State Analysis

### Database Schema
```prisma
enum CourseAuthType {
  SSO
  PIN
}

model Course {
  // ... other fields
  authType CourseAuthType @default(PIN)
  pinCode Int? // Now nullable
  isAssessmentEnabled Boolean @default(false)
  // ... other fields
}
```

### Current Implementation Issues
1. Code checks `isAssessmentEnabled` for authentication decisions
2. PIN generation logic tied to assessment flag
3. Invitation system checks assessment status instead of auth type
4. Frontend displays based on assessment flag, not auth method

## Required Changes

### 1. Invitation Service Updates ✅ COMPLETED

**File**: `packages/graphql/src/services/participantInvitations.ts`

**COMPLETED**: Updated the service to check `authType` instead of `isAssessmentEnabled`:
```typescript
if (course.authType !== 'SSO') {
  throw new Error('Course does not use SSO authentication. Only SSO courses can have invitations.')
}
```

**Changes Made**:
- Replaced `!course.isAssessmentEnabled` check with `course.authType !== 'SSO'`
- Updated error message to reflect SSO authentication requirement
- All other invitation logic remains unchanged (SSO ID matching, auto-acceptance, etc.)

### 2. Course Creation/Update Logic

**Files**: 
- `packages/graphql/src/services/courses.ts`
- GraphQL mutations for course management

**Changes Required**:

#### Course Creation
```typescript
// Determine authType based on assessment
const authType = isAssessmentEnabled ? 'SSO' : (authType ?? 'PIN')

// Validate: assessment courses must use SSO
if (isAssessmentEnabled && authType !== 'SSO') {
  throw new Error('Assessment courses must use SSO authentication')
}

// Generate PIN only for PIN auth courses
const pinCode = authType === 'PIN' 
  ? Math.floor(Math.random() * 900000000 + 100000000) 
  : null

const course = await prisma.course.create({
  data: {
    // ... other fields
    authType,
    pinCode,
    isAssessmentEnabled,
  }
})
```

#### Course Update
```typescript
// Prevent changing to PIN if invitations exist
if (authType === 'PIN') {
  const invitationCount = await prisma.participantInvitation.count({
    where: { courseId }
  })
  
  if (invitationCount > 0) {
    throw new Error('Cannot change to PIN authentication: course has existing invitations')
  }
}

// Clear PIN when switching to SSO
if (authType === 'SSO' && currentCourse.authType === 'PIN') {
  updateData.pinCode = null
}

// Generate PIN when switching to PIN
if (authType === 'PIN' && currentCourse.authType === 'SSO') {
  updateData.pinCode = Math.floor(Math.random() * 900000000 + 100000000)
}
```

### 3. Join Course Validation

**Files**: 
- `packages/graphql/src/services/participants.ts`
- GraphQL mutations for joining courses

**Current Logic**:
```typescript
if (course.isAssessmentEnabled) {
  throw new Error('Assessment courses can only be joined via invitation')
}
```

**New Logic**:
```typescript
if (course.authType === 'SSO') {
  throw new Error('This course uses SSO authentication and can only be joined via invitation')
}

// Additional validation
if (!course.pinCode) {
  throw new Error('Course does not have a PIN code')
}
```

### 4. Frontend Display Updates

**Files to Update**:
- `apps/frontend-manage/src/components/courses/CourseOverviewHeader.tsx`
- `apps/frontend-manage/src/pages/courses/[id].tsx`
- `apps/frontend-pwa/src/pages/join.tsx`

**Changes**:
- Replace `isAssessmentEnabled` checks with `authType === 'SSO'`
- Update UI labels and messages
- Show/hide PIN based on authType

#### Example Frontend Changes
```typescript
// Before
{course.isAssessmentEnabled ? (
  <Text>Invitations Only</Text>
) : (
  <PinDisplay pin={course.pinCode} />
)}

// After
{course.authType === 'SSO' ? (
  <Text>SSO Authentication (Invitations Only)</Text>
) : (
  <PinDisplay pin={course.pinCode} />
)}
```

### 5. Database Constraints

**Consider adding via migration**:
```sql
-- Ensure assessment courses use SSO
ALTER TABLE "Course" 
ADD CONSTRAINT check_assessment_requires_sso 
CHECK (
  "isAssessmentEnabled" = false OR 
  ("isAssessmentEnabled" = true AND "authType" = 'SSO')
);

-- Ensure SSO courses have no PIN
ALTER TABLE "Course" 
ADD CONSTRAINT check_sso_no_pin 
CHECK (
  "authType" != 'SSO' OR 
  ("authType" = 'SSO' AND "pinCode" IS NULL)
);

-- Ensure PIN courses have a PIN
ALTER TABLE "Course" 
ADD CONSTRAINT check_pin_has_code 
CHECK (
  "authType" != 'PIN' OR 
  ("authType" = 'PIN' AND "pinCode" IS NOT NULL)
);
```

## Migration Strategy

### 1. Data Migration
```sql
-- Set authType based on existing data
UPDATE "Course" 
SET "authType" = CASE 
  WHEN "isAssessmentEnabled" = true THEN 'SSO'
  ELSE 'PIN'
END;

-- Clear PIN codes for SSO courses
UPDATE "Course" 
SET "pinCode" = NULL 
WHERE "authType" = 'SSO';
```

### 2. Code Migration Order
1. **Backend First**:
   - Update invitation service
   - Update course creation/update logic
   - Update join course validation
   - Add GraphQL schema for authType

2. **Frontend Second**:
   - Update course management UI
   - Update student join flow
   - Update course display components

3. **Database Last**:
   - Run data migration
   - Add constraints

## Testing Plan

### Unit Tests

#### Invitation Service Tests
```typescript
describe('createParticipantInvitations', () => {
  it('should accept SSO courses', async () => {
    const course = { authType: 'SSO', id: 'test-id' }
    // Test should pass
  })
  
  it('should reject PIN courses', async () => {
    const course = { authType: 'PIN', id: 'test-id' }
    // Test should throw error
  })
})
```

#### Course Creation Tests
```typescript
describe('createCourse', () => {
  it('should force SSO for assessment courses', async () => {
    const result = await createCourse({ 
      isAssessmentEnabled: true,
      authType: 'PIN' // Should be overridden
    })
    expect(result.authType).toBe('SSO')
  })
  
  it('should generate PIN for PIN courses', async () => {
    const result = await createCourse({ authType: 'PIN' })
    expect(result.pinCode).toBeDefined()
    expect(result.pinCode).toBeGreaterThan(100000000)
  })
  
  it('should not generate PIN for SSO courses', async () => {
    const result = await createCourse({ authType: 'SSO' })
    expect(result.pinCode).toBeNull()
  })
})
```

### Integration Tests

1. **SSO Course Flow**:
   - Create SSO course (assessment)
   - Verify no PIN generated
   - Import invitations
   - Verify students can join via SSO
   - Verify students cannot join via PIN

2. **PIN Course Flow**:
   - Create PIN course
   - Verify PIN generated
   - Verify cannot import invitations
   - Verify students can join via PIN

3. **AuthType Switch**:
   - Create PIN course
   - Switch to SSO (should clear PIN)
   - Import invitations
   - Try to switch back to PIN (should fail with invitations)

4. **Mixed Scenarios**:
   - SSO course without assessment
   - Assessment course (verify SSO enforced)
   - Update assessment flag (verify authType consistency)

## Error Messages

### User-Facing Messages
- **Invalid invitation attempt**: "This course uses PIN authentication and does not support invitations."
- **Invalid PIN join**: "This course uses SSO authentication and can only be joined via invitation."
- **Auth type change blocked**: "Cannot change to PIN authentication while invitations exist."
- **Assessment validation**: "Assessment courses must use SSO authentication."

### Developer Messages (Logs)
- `[Course] Enforcing SSO for assessment course ${courseId}`
- `[Course] Generating PIN for course ${courseId}`
- `[Course] Clearing PIN for SSO course ${courseId}`
- `[Invitation] Rejected for PIN course ${courseId}`

## Benefits

### Separation of Concerns
- Authentication method is independent of assessment features
- Clearer code semantics (check authType for auth, not assessment)
- Easier to reason about security boundaries

### Flexibility
- Non-assessment courses can use SSO if desired
- Future auth methods can be added (LDAP, SAML, OAuth)
- Gradual migration paths for existing courses

### User Experience
- Clearer UI messaging about how to join
- Consistent behavior based on auth type
- Better error messages for students

## Rollback Plan

If issues arise:

1. **Quick Rollback**:
   - Revert code changes
   - Keep authType field but ignore it
   - Fall back to isAssessmentEnabled checks

2. **Data Preservation**:
   - AuthType field can remain in database
   - No data loss from migration
   - Can retry migration later

3. **Gradual Rollback**:
   - Revert frontend first (use feature flags)
   - Keep backend changes for testing
   - Monitor and fix issues before re-deployment

## Open Questions

1. **Should we allow manual PIN override for SSO courses?**
   - Use case: Backup access method
   - Security implications need review

2. **Should invitation system support PIN courses in future?**
   - Use case: Pre-registration for PIN courses
   - Would require UI/UX design work

3. **How to handle existing participants when switching auth types?**
   - Keep existing participations valid?
   - Require re-enrollment?

## Timeline Estimate

- **Backend Changes**: 4-6 hours
- **Frontend Changes**: 3-4 hours
- **Testing**: 2-3 hours
- **Documentation**: 1-2 hours
- **Total**: ~2 days of development work

## Risk Assessment

### Low Risk
- Database migration (reversible)
- Backend logic changes (well-tested)

### Medium Risk
- Frontend display changes (user-visible)
- Migration of existing courses (data integrity)

### Mitigation
- Comprehensive testing before deployment
- Feature flags for gradual rollout
- Clear communication to users about changes