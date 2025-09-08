# ParticipantAccount Affiliation Email Support

## Problem Statement

Currently, when users log in via eduID SSO, we receive two types of affiliation data:
- `swissEduIDLinkedAffiliationUniqueID`: e.g., `523356@vho-switchaai.ch` (stored as ssoId)
- `swissEduIDLinkedAffiliationMail`: e.g., `testi.testerfrau@bf.uzh.ch` (NOT stored)

The invitation auto-acceptance during creation fails because:
1. Invitations are created with affiliation emails (e.g., `testi.testerfrau@bf.uzh.ch`)
2. We only store UniqueIDs in ParticipantAccount.ssoId
3. The service can't match the invitation email to any ParticipantAccount

## Solution Overview

Add an `email` field to the ParticipantAccount model to store affiliation emails alongside UniqueIDs. This enables:
- Invitation matching by email during creation
- Maintaining the UniqueID as the primary identifier
- Updating emails on subsequent logins if they change

## Implementation Plan

### 1. Database Schema Changes

#### Add email field to ParticipantAccount

**File**: `packages/prisma/src/prisma/schema/participant.prisma`

```prisma
model ParticipantAccount {
  id String @id @default(uuid()) @db.Uuid

  ssoId   String @unique  // UniqueID: "523356@vho-switchaai.ch"
  ssoType String @default("LTI1.1")
  
  // NEW: Store affiliation email for invitation matching
  email   String?  // Email: "testi.testerfrau@bf.uzh.ch"
  
  type       String  @default("sso") // "sso", "affiliation"
  isPrimary  Boolean @default(false)
  isVerified Boolean @default(false)

  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  participantId String      @db.Uuid

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([participantId, ssoType])
  // Performance indexes
  @@index([ssoId, isVerified])
  @@index([type, isVerified])
  @@index([email, isVerified])  // NEW: Index for email lookups
}
```

### 2. Auth Application Updates

#### Update createParticipantAffiliations function

**File**: `apps/auth/src/pages/api/auth/[...nextauth].ts`

```typescript
async function createParticipantAffiliations(
  participantId: string,
  affiliationIds: string[],
  affiliationEmails?: string[]  // NEW: Optional emails parameter
) {
  let processedAffiliations = new Set<string>()
  
  for (let i = 0; i < affiliationIds.length; i++) {
    const affiliationId = affiliationIds[i]
    const affiliationEmail = affiliationEmails?.[i]?.toLowerCase()  // Get corresponding email
    
    try {
      // Extract provider from UniqueID (existing logic)
      const parts = affiliationId.split('@')
      if (parts.length < 2) continue

      const domainParts = parts[1]?.split('.')
      if (!domainParts || domainParts.length === 0) continue

      const provider = domainParts[0]
      if (!provider) continue

      // Upsert participant account with email
      await prisma.participantAccount.upsert({
        where: {
          participantId_ssoType: {
            participantId,
            ssoType: provider,
          },
        },
        create: {
          ssoType: provider,
          ssoId: affiliationId,
          email: affiliationEmail,  // NEW: Store the email
          participant: { connect: { id: participantId } },
          type: 'affiliation',
          isVerified: true,
          isPrimary: false,
        },
        update: {
          email: affiliationEmail,  // NEW: Update email if changed
          isVerified: true,
        },
      })

      processedAffiliations.add(affiliationId)
    } catch (error) {
      console.error(
        `Failed to add participant affiliation ${affiliationId}:`,
        error
      )
    }
  }
  return [...processedAffiliations]
}
```

#### Update calls to createParticipantAffiliations

**For existing participants** (around line 343):
```typescript
if (profile.swissEduIDLinkedAffiliationUniqueID) {
  const participantAffiliations = await createParticipantAffiliations(
    existing.participantId,
    profile.swissEduIDLinkedAffiliationUniqueID,
    profile.swissEduIDLinkedAffiliationMail  // NEW: Pass emails
  )
}
```

**For new participants** (around line 434):
```typescript
if (profile.swissEduIDLinkedAffiliationUniqueID) {
  await createParticipantAffiliations(
    participant.id,
    profile.swissEduIDLinkedAffiliationUniqueID,
    profile.swissEduIDLinkedAffiliationMail  // NEW: Pass emails
  )
}
```

#### Update primary account creation (optional)

Consider also storing the primary email in the main ParticipantAccount record:

```typescript
// When creating the primary account
const account = await prisma.participantAccount.create({
  data: {
    ssoId: profile.sub || profile.id,
    email: profile.email?.toLowerCase(),  // Store primary email
    ssoType: 'eduid',
    type: 'sso',
    isPrimary: true,
    isVerified: true,
    participant: { connect: { id: participant.id } },
  },
})
```

### 3. Invitation Service Updates

#### Update participant lookup logic

**File**: `packages/graphql/src/services/participantInvitations.ts`

```typescript
// Check for existing verified ParticipantAccount with matching email
const participantAccount = await prisma.participantAccount.findFirst({
  where: {
    OR: [
      { ssoId: email, isVerified: true },    // Check UniqueID (backward compat)
      { email: email, isVerified: true }     // Check email field (NEW)
    ]
  },
  include: {
    participant: true,
  },
})
```

This allows the service to find participants by:
1. Their affiliation email (primary use case)
2. Their UniqueID (backward compatibility)

### 4. Migration Strategy

#### Step 1: Schema Migration

```bash
# Add the email field to ParticipantAccount
pnpm prisma:migrate
```

#### Step 2: Backfill Existing Data (Optional)

If needed, create a migration script to populate emails for existing ParticipantAccounts:

```typescript
// scripts/backfill-affiliation-emails.ts
async function backfillEmails() {
  // This would require mapping existing UniqueIDs to emails
  // Might need to wait for users to log in again to get their emails
  console.log('Emails will be populated on next user login')
}
```

#### Step 3: Deploy Updates

1. Deploy database migration
2. Deploy auth app changes
3. Deploy GraphQL service changes
4. Test with a user login to populate emails
5. Run invitation import

### 5. Testing Plan

#### Unit Tests

```typescript
describe('ParticipantAccount email support', () => {
  it('should store email when creating affiliation', async () => {
    await createParticipantAffiliations(
      'participant-id',
      ['523356@vho-switchaai.ch'],
      ['testi.testerfrau@bf.uzh.ch']
    )
    
    const account = await prisma.participantAccount.findFirst({
      where: { ssoId: '523356@vho-switchaai.ch' }
    })
    
    expect(account.email).toBe('testi.testerfrau@bf.uzh.ch')
  })
  
  it('should update email on subsequent login', async () => {
    // Create account with old email
    await createParticipantAffiliations(
      'participant-id',
      ['523356@vho-switchaai.ch'],
      ['old.email@bf.uzh.ch']
    )
    
    // Update with new email
    await createParticipantAffiliations(
      'participant-id',
      ['523356@vho-switchaai.ch'],
      ['new.email@bf.uzh.ch']
    )
    
    const account = await prisma.participantAccount.findFirst({
      where: { ssoId: '523356@vho-switchaai.ch' }
    })
    
    expect(account.email).toBe('new.email@bf.uzh.ch')
  })
})
```

#### Integration Tests

1. **Login Flow Test**:
   - User logs in via eduID with affiliations
   - Verify ParticipantAccount records have both ssoId and email
   - Verify emails are lowercase

2. **Invitation Auto-Accept Test**:
   - Create user with affiliation email via login
   - Create invitation with same email
   - Verify auto-acceptance during invitation creation
   - Verify participation is created

3. **Email Update Test**:
   - User logs in with affiliation
   - Admin changes user's affiliation email in eduID
   - User logs in again
   - Verify ParticipantAccount email is updated

### 6. Data Flow Example

```yaml
1. User logs in via eduID:
   - UniqueID: "523356@vho-switchaai.ch"
   - Email: "testi.testerfrau@bf.uzh.ch"

2. ParticipantAccount created/updated:
   - ssoId: "523356@vho-switchaai.ch"
   - email: "testi.testerfrau@bf.uzh.ch"
   - ssoType: "vho-switchaai"
   - type: "affiliation"
   - isVerified: true

3. Admin creates invitation:
   - email: "testi.testerfrau@bf.uzh.ch"
   
4. Service checks ParticipantAccount:
   - Finds record by email field
   - Auto-accepts invitation
   - Creates participation
```

### 7. Edge Cases & Considerations

#### Email Changes
- If a user's affiliation email changes in eduID, it will be updated on next login
- Old invitations with old email won't match anymore (expected behavior)

#### Multiple Affiliations
- User might have multiple affiliations with different emails
- Each gets its own ParticipantAccount record
- All can be used for invitation matching

#### Case Sensitivity
- Always store emails as lowercase
- Always compare emails as lowercase

#### Null Emails
- Primary accounts might not have emails (backward compatibility)
- Only affiliation accounts need emails for invitation matching

### 8. Benefits

1. **Immediate Auto-Acceptance**: Invitations auto-accept during creation for existing users
2. **Clean Data Model**: Email stored where it belongs, with the account
3. **Backward Compatible**: Existing ssoId matching still works
4. **Maintainable**: Clear relationship between UniqueID and email
5. **Performant**: Indexed email field for fast lookups

### 9. Rollback Plan

If issues arise:

1. **Keep email field**: No need to remove, just stop using it
2. **Revert service logic**: Remove email check from invitation service
3. **Auth app**: Stop populating email field
4. **No data loss**: All existing data remains valid

### 10. Implementation Checklist

- [ ] Add email field to ParticipantAccount schema
- [ ] Run Prisma migration
- [ ] Update createParticipantAffiliations to accept emails parameter
- [ ] Update function calls to pass affiliation emails
- [ ] Update invitation service to check email field
- [ ] Test login flow populates emails
- [ ] Test invitation auto-acceptance works
- [ ] Document changes in API docs
- [ ] Update any GraphQL schemas if needed

## Timeline Estimate

- Schema changes & migration: 1 hour
- Auth app updates: 2 hours
- Service updates: 1 hour
- Testing: 2 hours
- **Total**: ~6 hours

## Risk Assessment

- **Low Risk**: Schema addition (non-breaking)
- **Low Risk**: Auth updates (backward compatible)
- **Medium Risk**: Service logic change (needs testing)
- **Mitigation**: Feature flag for email checking if needed