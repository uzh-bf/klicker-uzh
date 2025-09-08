# Generic Affiliations Authentication System

## Executive Summary

This plan outlines the implementation of a generic affiliations system that allows both lecturers and students to have multiple email addresses and identifiers associated with their accounts. This will enable login with any affiliated email/identifier, support for primary email changes, and robust account merging capabilities.

### Key Goals
- **Multiple Identifiers**: Store and authenticate with multiple email addresses and identifiers per user
- **Flexible Authentication**: Allow login with any affiliated email/identifier 
- **Account Merging**: Handle merging of accounts created through different methods (LTI, manual, Edu-ID)
- **Primary Email Management**: Support changing primary email while maintaining access
- **Consistent Implementation**: Generic solution for both lecturers (Users) and students (Participants)

---

## Production Readiness Requirements

### Critical Validation Policy

**🚨 IMPORTANT**: Only verified affiliations can be used for authentication to prevent account hijacking and ensure security:

1. **SSO Affiliations (Auto-Verified)**: 
   - Edu-ID affiliations are pre-verified by the identity provider
   - Can be used immediately for login and account linking
   - Source: `EDUID`, `LTI`, or other trusted SSO providers

2. **Manual Affiliations (Require Verification)**:
   - User-added email addresses require email verification
   - Cannot be used for login until verified
   - Must go through email confirmation workflow
   - Source: `MANUAL`

3. **Login Restriction**: 
   - Only `isVerified: true` affiliations can be used for authentication
   - Unverified affiliations are stored but blocked from login/linking

### Production Concerns Addressed

#### 1. Primary Email Synchronization
- Add `isPrimary` boolean to Account/ParticipantAccount records
- Enforce exactly one primary per user via database constraint
- Sync primary affiliation to User.email/Participant.email for backward compatibility
- Handle primary email changes gracefully without breaking existing functionality

#### 2. Race Conditions & Concurrency
- Use database transactions with row-level locking for affiliation operations
- Implement proper error handling for constraint violations
- Prevent duplicate affiliations from being created simultaneously

#### 3. Performance & Scalability
- Add database indexes on `providerAccountId` and `type` fields
- Optimize affiliation lookup with single combined query
- Consider Redis caching for frequently accessed affiliations
- Target: All lookups < 100ms

#### 4. Error Handling & User Communication
- Clear error messages for affiliation conflicts
- User-friendly conflict resolution options
- Proper error logging for debugging and monitoring
- No silent failures or confusing error states

#### 5. Migration & Rollback Strategy
- Feature flag: `ENABLE_AFFILIATION_LOGIN` for gradual rollout
- Backward-compatible schema changes
- Safe rollback path without data loss
- Gradual user adoption (start with specific domains/users)

#### 6. Monitoring & Observability
- Track metrics: login success/failure rates, affiliation conflicts, merge operations
- Alert on: sudden login failure increases, duplicate affiliation attempts
- Audit logging: all affiliation changes, merge operations, verification events
- Performance monitoring: query times, cache hit rates

---

## Current State Analysis

### Existing Implementation

#### Lecturer Authentication (User/Account)
- **Primary Storage**: `User.email` field with unique constraint
- **SSO Accounts**: `Account` table stores OAuth provider accounts
- **Affiliations**: Currently stored in `Account` table with `type: 'affiliation'`
- **Creation Process**: `createUserAffiliations()` function in auth callback
- **Lookup**: Direct email matching in `User.email` field

#### Student Authentication (Participant/ParticipantAccount)  
- **Primary Storage**: `Participant.email` field with unique constraint
- **SSO Accounts**: `ParticipantAccount` table stores SSO accounts (LTI, Edu-ID)
- **Affiliations**: Not currently implemented for students
- **Creation Process**: `createOrLinkParticipant()` function in auth callback
- **Lookup**: Direct email matching in `Participant.email` field

### Current Limitations

1. **Single Email Per Account**: Only one primary email stored per user/participant
2. **No Student Affiliations**: Students cannot have multiple affiliated emails
3. **Limited Lookup**: Cannot find accounts by affiliated emails (only primary)
4. **Account Merging**: No systematic approach to merge accounts with different emails
5. **Primary Email Changes**: If primary email changes, old accounts become orphaned

### Affiliation Data Format
Based on the codebase analysis, affiliations come from Edu-ID in formats like:
- `roland.schlaefli@df.uzh.ch` (departmental email)
- `roland.schlaefli@uzh.ch` (institutional email)  
- `3747847494@eduid.ch` (Edu-ID numeric identifier)
- Primary email is also stored separately on the user

---

## Proposed Solution: Enhanced Account/ParticipantAccount System

### Architecture Overview

Enhance the existing Account and ParticipantAccount system to support affiliations:
1. **Extend existing tables** instead of creating new ones
2. **Unify Account/ParticipantAccount structure** for consistent affiliation handling
3. **Leverage existing NextAuth patterns** for OAuth and affiliation storage
4. **Build on working lecturer affiliation system** for students

### Database Schema Design

#### Existing Account Table (Already Works for Lecturers)
The Account table already supports affiliations with `type: 'affiliation'`:

```prisma
model Account {
  id String @id @default(uuid()) @db.Uuid

  type              String // "oauth", "affiliation", etc.
  provider          String // "eduid", "uzh", "ethz", etc.
  providerAccountId String // The actual email/identifier
  
  // OAuth-specific fields (nullable for affiliations)
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId String @db.Uuid

  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  @@unique([provider, providerAccountId]) // Allows multiple affiliations per user
}
```

#### Enhanced ParticipantAccount Table
Extend ParticipantAccount to match Account structure with validation:

```prisma
model ParticipantAccount {
  id String @id @default(uuid()) @db.Uuid

  // Existing SSO fields (make nullable for affiliations)
  ssoId   String? @unique
  ssoType String @default("LTI1.1")
  
  // Add fields to match Account table
  type              String @default("sso") // "sso", "affiliation"
  provider          String? // "eduid", "uzh", "lti", etc.
  providerAccountId String? // The actual email/identifier
  
  // Validation and primary email management
  isPrimary  Boolean @default(false) // Only one primary per participant
  isVerified Boolean @default(false) // Only verified affiliations can login
  
  // OAuth/SSO fields (for future extensibility)
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  
  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  participantId String      @db.Uuid

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Support both old and new patterns
  @@unique([provider, providerAccountId], where: { provider: { not: null } })
  @@unique([participantId, ssoType]) // Backward compatibility
  
  // Ensure only one primary affiliation per participant
  @@unique([participantId, isPrimary], where: { isPrimary: true })
  
  // Performance indexes
  @@index([providerAccountId, isVerified]) // Fast verified lookup
  @@index([type, isVerified]) // Fast affiliation lookup
}
```

#### Enhanced Account Table (for lecturers)
Add validation fields to existing Account structure:

```prisma
model Account {
  id String @id @default(uuid()) @db.Uuid

  type              String // "oauth", "affiliation", etc.
  provider          String // "eduid", "uzh", "ethz", etc.
  providerAccountId String // The actual email/identifier
  
  // Validation and primary email management
  isPrimary  Boolean @default(false) // Only one primary per user
  isVerified Boolean @default(true)  // OAuth accounts are auto-verified
  
  // OAuth-specific fields (nullable for affiliations)
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId String @db.Uuid

  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  @@unique([provider, providerAccountId]) // Allows multiple affiliations per user
  
  // Ensure only one primary affiliation per user
  @@unique([userId, isPrimary], where: { isPrimary: true })
  
  // Performance indexes
  @@index([providerAccountId, isVerified]) // Fast verified lookup
  @@index([type, isVerified]) // Fast affiliation lookup
}
```

#### Account Merging Tracking
Add simple merge tracking:

```prisma
model AccountMerge {
  id String @id @default(uuid()) @db.Uuid
  
  // What was merged (flexible JSON structure)
  sourceAccountType String // "USER" or "PARTICIPANT"
  sourceAccountId   String @db.Uuid
  targetAccountType String // "USER" or "PARTICIPANT" 
  targetAccountId   String @db.Uuid
  
  // Merge details
  reason String
  transferredData Json
  performedBy String? // Admin who performed merge
  
  createdAt DateTime @default(now())
}
```

---

## Implementation Strategy

### Phase 1: Database Migration & Core Infrastructure

#### 1.1 Update Existing Tables
- Add new fields to `ParticipantAccount` table to match `Account` structure
- Add `AccountMerge` model for merge tracking
- Create migration scripts with proper constraints and indexes
- No data migration needed - existing records continue to work

#### 1.2 Backward Compatible Migration with Validation
```sql
-- Add new fields to ParticipantAccount table
ALTER TABLE "ParticipantAccount" ADD COLUMN "type" TEXT DEFAULT 'sso';
ALTER TABLE "ParticipantAccount" ADD COLUMN "provider" TEXT;
ALTER TABLE "ParticipantAccount" ADD COLUMN "providerAccountId" TEXT;
ALTER TABLE "ParticipantAccount" ADD COLUMN "isPrimary" BOOLEAN DEFAULT false;
ALTER TABLE "ParticipantAccount" ADD COLUMN "isVerified" BOOLEAN DEFAULT false;
ALTER TABLE "ParticipantAccount" ADD COLUMN "refresh_token" TEXT;
ALTER TABLE "ParticipantAccount" ADD COLUMN "access_token" TEXT;
ALTER TABLE "ParticipantAccount" ADD COLUMN "expires_at" INTEGER;
ALTER TABLE "ParticipantAccount" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Add new fields to Account table (for lecturers)
ALTER TABLE "Account" ADD COLUMN "isPrimary" BOOLEAN DEFAULT false;
ALTER TABLE "Account" ADD COLUMN "isVerified" BOOLEAN DEFAULT true; -- OAuth accounts auto-verified

-- Make ssoId nullable for affiliation records
ALTER TABLE "ParticipantAccount" ALTER COLUMN "ssoId" DROP NOT NULL;

-- Update existing SSO accounts to be verified
UPDATE "ParticipantAccount" SET "isVerified" = true WHERE "ssoType" IS NOT NULL;

-- Set primary email for existing accounts (first email becomes primary)
UPDATE "ParticipantAccount" SET "isPrimary" = true 
WHERE "id" IN (
  SELECT DISTINCT ON ("participantId") "id" 
  FROM "ParticipantAccount" 
  WHERE "participantId" IN (SELECT "id" FROM "Participant" WHERE "email" IS NOT NULL)
  ORDER BY "participantId", "createdAt" ASC
);

UPDATE "Account" SET "isPrimary" = true 
WHERE "id" IN (
  SELECT DISTINCT ON ("userId") "id" 
  FROM "Account" 
  WHERE "type" = 'affiliation'
  ORDER BY "userId", "createdAt" ASC
);

-- Add unique constraints for primary affiliations
ALTER TABLE "ParticipantAccount" ADD CONSTRAINT "ParticipantAccount_participantId_isPrimary_key" 
  UNIQUE ("participantId", "isPrimary") WHERE "isPrimary" = true;
  
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_isPrimary_key" 
  UNIQUE ("userId", "isPrimary") WHERE "isPrimary" = true;

-- Add new unique constraint for provider-based lookups
ALTER TABLE "ParticipantAccount" ADD CONSTRAINT "ParticipantAccount_provider_providerAccountId_key" 
  UNIQUE ("provider", "providerAccountId") WHERE "provider" IS NOT NULL;

-- Add performance indexes
CREATE INDEX "ParticipantAccount_providerAccountId_isVerified_idx" 
  ON "ParticipantAccount"("providerAccountId", "isVerified");
CREATE INDEX "ParticipantAccount_type_isVerified_idx" 
  ON "ParticipantAccount"("type", "isVerified");
CREATE INDEX "Account_providerAccountId_isVerified_idx" 
  ON "Account"("providerAccountId", "isVerified");
CREATE INDEX "Account_type_isVerified_idx" 
  ON "Account"("type", "isVerified");

-- Create feature flag table for gradual rollout
CREATE TABLE "FeatureFlag" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL UNIQUE,
    "enabled" BOOLEAN DEFAULT false,
    "description" TEXT,
    "enabledFor" JSONB, -- User/domain restrictions
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

-- Insert feature flag for affiliations
INSERT INTO "FeatureFlag" ("name", "enabled", "description") 
VALUES ('ENABLE_AFFILIATION_LOGIN', false, 'Enable login with affiliated emails');

-- Create AccountMerge table
CREATE TABLE "AccountMerge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceAccountType" TEXT NOT NULL,
    "sourceAccountId" UUID NOT NULL,
    "targetAccountType" TEXT NOT NULL,
    "targetAccountId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "transferredData" JSONB NOT NULL,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

-- Existing SSO records work as-is with isVerified=true
```

#### 1.3 Create Enhanced Affiliation Service
```typescript
// packages/graphql/src/services/affiliations.ts
export class AffiliationService {
  // Find user by any VERIFIED affiliated identifier (including primary email)
  static async findUserByAffiliation(identifier: string): Promise<User | null> {
    const cleanId = identifier.toLowerCase().trim();
    
    // Check feature flag first
    const featureEnabled = await this.isAffiliationLoginEnabled();
    if (!featureEnabled) {
      // Fall back to primary email only
      return await prisma.user.findUnique({
        where: { email: cleanId }
      });
    }
    
    // First check primary email
    let user = await prisma.user.findUnique({
      where: { email: cleanId }
    });
    
    if (user) return user;
    
    // Then check Account table for VERIFIED affiliations only
    const account = await prisma.account.findFirst({
      where: {
        type: 'affiliation',
        providerAccountId: cleanId,
        isVerified: true // CRITICAL: Only verified affiliations
      },
      include: { user: true }
    });
    
    return account?.user || null;
  }
  
  // Find participant by any VERIFIED affiliated identifier (including primary email)
  static async findParticipantByAffiliation(identifier: string): Promise<Participant | null> {
    const cleanId = identifier.toLowerCase().trim();
    
    // Check feature flag first
    const featureEnabled = await this.isAffiliationLoginEnabled();
    if (!featureEnabled) {
      // Fall back to primary email only
      return await prisma.participant.findUnique({
        where: { email: cleanId }
      });
    }
    
    // First check primary email
    let participant = await prisma.participant.findUnique({
      where: { email: cleanId }
    });
    
    if (participant) return participant;
    
    // Then check ParticipantAccount table for VERIFIED affiliations only
    const account = await prisma.participantAccount.findFirst({
      where: {
        type: 'affiliation',
        providerAccountId: cleanId,
        isVerified: true // CRITICAL: Only verified affiliations
      },
      include: { participant: true }
    });
    
    return account?.participant || null;
  }
  
  // Add new affiliation to user (using existing Account pattern with validation)
  static async addUserAffiliation(
    userId: string, 
    identifier: string, 
    provider?: string,
    source: 'SSO' | 'MANUAL' = 'MANUAL'
  ) {
    const cleanId = identifier.toLowerCase().trim();
    const derivedProvider = provider || this.deriveProvider(cleanId);
    
    // Use database transaction to prevent race conditions
    return await prisma.$transaction(async (tx) => {
      // Check for conflicts
      const existingUser = await this.findUserByAffiliation(cleanId);
      if (existingUser && existingUser.id !== userId) {
        throw new Error(`Affiliation ${cleanId} already belongs to another user`);
      }
      
      // Determine if verification is needed
      const isVerified = source === 'SSO'; // SSO affiliations are pre-verified
      const needsVerification = source === 'MANUAL';
      
      // Use existing Account table pattern
      const affiliation = await tx.account.upsert({
        where: {
          provider_providerAccountId: {
            provider: derivedProvider,
            providerAccountId: cleanId,
          },
        },
        create: {
          type: 'affiliation',
          provider: derivedProvider,
          providerAccountId: cleanId,
          userId: userId,
          isVerified,
          isPrimary: false, // New affiliations are never primary by default
        },
        update: {
          isVerified, // Update verification status if source changes
        },
      });
      
      // Send verification email for manual affiliations
      if (needsVerification) {
        await this.sendVerificationEmail(cleanId, userId, 'USER');
      }
      
      // Log the affiliation creation for audit trail
      await this.logAffiliationEvent('CREATED', userId, cleanId, source);
      
      return affiliation;
    });
  }
  
  // Add new affiliation to participant (using enhanced ParticipantAccount)
  static async addParticipantAffiliation(participantId: string, identifier: string, provider?: string) {
    const cleanId = identifier.toLowerCase().trim();
    const derivedProvider = provider || this.deriveProvider(cleanId);
    
    // Check for conflicts
    const existingParticipant = await this.findParticipantByAffiliation(cleanId);
    if (existingParticipant && existingParticipant.id !== participantId) {
      throw new Error(`Affiliation ${cleanId} already belongs to another participant`);
    }
    
    // Use enhanced ParticipantAccount table
    return await prisma.participantAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: derivedProvider,
          providerAccountId: cleanId,
        },
      },
      create: {
        type: 'affiliation',
        provider: derivedProvider,
        providerAccountId: cleanId,
        participantId: participantId,
      },
      update: {}, // No-op if already exists
    });
  }
  
  // Derive provider from email domain
  private static deriveProvider(identifier: string): string {
    if (identifier.includes('@')) {
      const domain = identifier.split('@')[1];
      const parts = domain?.split('.') || [];
      return parts[0] || 'unknown';
    }
    return 'eduid'; // For numeric Edu-ID identifiers
  }
  
  // Get all affiliations for a user
  static async getUserAffiliations(userId: string) {
    return await prisma.account.findMany({
      where: { 
        userId,
        type: 'affiliation'
      },
      orderBy: { createdAt: 'asc' }
    });
  }
  
  // Get all affiliations for a participant
  static async getParticipantAffiliations(participantId: string) {
    return await prisma.participantAccount.findMany({
      where: { 
        participantId,
        type: 'affiliation'
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  }
  
  // Feature flag management
  static async isAffiliationLoginEnabled(userId?: string, domain?: string): Promise<boolean> {
    const flag = await prisma.featureFlag.findUnique({
      where: { name: 'ENABLE_AFFILIATION_LOGIN' }
    });
    
    if (!flag?.enabled) return false;
    
    // Check domain/user restrictions
    if (flag.enabledFor && (userId || domain)) {
      const restrictions = flag.enabledFor as any;
      
      if (domain && restrictions.domains) {
        return restrictions.domains.includes(domain);
      }
      
      if (userId && restrictions.users) {
        return restrictions.users.includes(userId);
      }
    }
    
    return flag.enabled;
  }
  
  // Email verification for manual affiliations
  static async sendVerificationEmail(email: string, accountId: string, accountType: 'USER' | 'PARTICIPANT') {
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Store verification token (you'd create a separate table for this)
    // For now, store in a simple verification table
    await prisma.emailVerification.create({
      data: {
        email,
        token: verificationToken,
        accountId,
        accountType,
        expiresAt,
      }
    });
    
    // Send email (integrate with your email service)
    await this.sendEmail({
      to: email,
      subject: 'Verify your email address - KlickerUZH',
      template: 'email-verification',
      data: {
        verificationUrl: `${process.env.APP_URL}/verify-email?token=${verificationToken}`,
        email,
      }
    });
  }
  
  // Verify email affiliation
  static async verifyEmailAffiliation(token: string): Promise<boolean> {
    return await prisma.$transaction(async (tx) => {
      // Find and validate token
      const verification = await tx.emailVerification.findUnique({
        where: { token },
      });
      
      if (!verification || verification.expiresAt < new Date()) {
        return false;
      }
      
      // Mark affiliation as verified
      if (verification.accountType === 'USER') {
        await tx.account.updateMany({
          where: {
            userId: verification.accountId,
            providerAccountId: verification.email,
            type: 'affiliation',
          },
          data: { isVerified: true }
        });
      } else {
        await tx.participantAccount.updateMany({
          where: {
            participantId: verification.accountId,
            providerAccountId: verification.email,
            type: 'affiliation',
          },
          data: { isVerified: true }
        });
      }
      
      // Delete verification token
      await tx.emailVerification.delete({
        where: { id: verification.id }
      });
      
      // Log verification event
      await this.logAffiliationEvent('VERIFIED', verification.accountId, verification.email, 'MANUAL');
      
      return true;
    });
  }
  
  // Set primary affiliation
  static async setPrimaryAffiliation(
    accountId: string,
    affiliationId: string,
    accountType: 'USER' | 'PARTICIPANT'
  ) {
    return await prisma.$transaction(async (tx) => {
      if (accountType === 'USER') {
        // Remove existing primary
        await tx.account.updateMany({
          where: { userId: accountId, isPrimary: true },
          data: { isPrimary: false }
        });
        
        // Set new primary
        const affiliation = await tx.account.update({
          where: { id: affiliationId },
          data: { isPrimary: true }
        });
        
        // Update User.email for backward compatibility
        await tx.user.update({
          where: { id: accountId },
          data: { email: affiliation.providerAccountId }
        });
        
        return affiliation;
      } else {
        // Similar logic for participants
        await tx.participantAccount.updateMany({
          where: { participantId: accountId, isPrimary: true },
          data: { isPrimary: false }
        });
        
        const affiliation = await tx.participantAccount.update({
          where: { id: affiliationId },
          data: { isPrimary: true }
        });
        
        await tx.participant.update({
          where: { id: accountId },
          data: { email: affiliation.providerAccountId }
        });
        
        return affiliation;
      }
    });
  }
  
  // Audit logging
  static async logAffiliationEvent(
    event: 'CREATED' | 'VERIFIED' | 'DELETED' | 'PRIMARY_CHANGED',
    accountId: string,
    email: string,
    source: string,
    metadata?: any
  ) {
    // Store in audit log table for compliance and debugging
    await prisma.auditLog.create({
      data: {
        event: `AFFILIATION_${event}`,
        accountId,
        details: {
          email,
          source,
          ...metadata,
        },
      }
    });
  }
  
  // Utility functions
  private static deriveProvider(identifier: string): string {
    if (identifier.includes('@')) {
      const domain = identifier.split('@')[1];
      const parts = domain?.split('.') || [];
      return parts[0] || 'unknown';
    }
    return 'eduid'; // For numeric Edu-ID identifiers
  }
  
  private static async sendEmail(emailData: any) {
    // Integrate with your email service (SendGrid, SES, etc.)
    console.log('Would send email:', emailData);
  }
}
```

### Phase 2: Authentication Flow Updates

#### 2.1 Update User Authentication
```typescript
// Update apps/auth/src/pages/api/auth/[...nextauth].ts

// Enhanced version of existing createUserAffiliations function
async function createUserAffiliationsEnhanced(
  userId: string,
  affiliationIds?: string[]
) {
  if (!affiliationIds?.length) return;
  
  for (const affiliationId of affiliationIds) {
    try {
      await AffiliationService.addUserAffiliation(
        userId,
        affiliationId,
        // Provider derived from domain (e.g., "uzh" from "user@uzh.ch")
        affiliationId.split('@')[1]?.split('.')[0]
      );
    } catch (error) {
      console.error(`Failed to add affiliation ${affiliationId}:`, error);
      // Continue with other affiliations
    }
  }
}

// Update sign-in callback (builds on existing pattern)
callbacks: {
  async signIn({ user, account, profile }) {
    if (!profile) return true;
    
    const profileData = profile as ExtendedProfile;
    
    if (profileData?.sub && account?.provider) {
      // Try to find existing user by SSO ID first (existing logic)
      const userAccount = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: profileData.sub,
          },
        },
      });

      if (userAccount) {
        // Existing user - add new affiliations
        const user = await prisma.user.update({
          where: { id: userAccount.userId },
          data: {
            email: profileData.email,
            lastLoginAt: new Date(),
            catalystInstitutional:
              (profileData.email?.endsWith('uzh.ch') ||
                profileData.swissEduIDLinkedAffiliation?.reduce<boolean>(
                  reduceCatalyst,
                  false
                )) ?? false,
          },
        });

        // Add affiliations using enhanced service
        await createUserAffiliationsEnhanced(
          user.id,
          profileData.swissEduIDLinkedAffiliationUniqueID
        );

        return true;
      } else {
        // New user - check if email exists as affiliation
        const existingUser = await AffiliationService.findUserByAffiliation(
          profileData.email || ''
        );
        
        if (existingUser) {
          // Link existing user to new OAuth account
          await prisma.account.create({
            data: {
              type: 'oauth',
              provider: account.provider,
              providerAccountId: profileData.sub,
              userId: existingUser.id,
              // Copy OAuth tokens
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
            }
          });
          
          // Add new affiliations
          await createUserAffiliationsEnhanced(
            existingUser.id,
            profileData.swissEduIDLinkedAffiliationUniqueID
          );
          
          return true;
        }
      }
    }

    return true; // Continue with normal user creation flow
  },
}
```

#### 2.2 Update Participant Authentication
```typescript
// Enhanced createOrLinkParticipant function
async function createOrLinkParticipantEnhanced(profile: ExtendedProfile) {
  // First, try to find by SSO ID (existing logic)
  const existing = await prisma.participantAccount.findUnique({
    where: { ssoId: profile.sub },
    include: { participant: true }
  });
  
  if (existing) {
    // Update affiliations for existing participant
    if (profile.swissEduIDLinkedAffiliationUniqueID) {
      for (const affiliationId of profile.swissEduIDLinkedAffiliationUniqueID) {
        try {
          await AffiliationService.addParticipantAffiliation(
            existing.participantId,
            affiliationId,
            affiliationId.split('@')[1]?.split('.')[0]
          );
        } catch (error) {
          console.error(`Failed to add participant affiliation ${affiliationId}:`, error);
        }
      }
    }
    
    await prisma.participant.update({
      where: { id: existing.participantId },
      data: { lastLoginAt: new Date() }
    });
    
    return existing.participant;
  }
  
  // Check for existing participant by any affiliation (including primary email)
  if (profile.email) {
    const existingParticipant = await AffiliationService.findParticipantByAffiliation(
      profile.email
    );
    
    if (existingParticipant) {
      // Link existing participant to new SSO account
      await prisma.participantAccount.create({
        data: {
          ssoType: 'EDUID',
          ssoId: profile.sub,
          participantId: existingParticipant.id,
          // Also populate new fields for consistency
          type: 'sso',
          provider: 'eduid',
          providerAccountId: profile.sub,
        }
      });
      
      // Add new affiliations using enhanced service
      if (profile.swissEduIDLinkedAffiliationUniqueID) {
        for (const affiliationId of profile.swissEduIDLinkedAffiliationUniqueID) {
          try {
            await AffiliationService.addParticipantAffiliation(
              existingParticipant.id,
              affiliationId,
              affiliationId.split('@')[1]?.split('.')[0]
            );
          } catch (error) {
            console.error(`Failed to add participant affiliation ${affiliationId}:`, error);
          }
        }
      }
      
      return existingParticipant;
    }
  }
  
  // Create new participant (existing logic with enhanced SSO account creation)
  if (!participant) {
    const username = generateRandomString(10);
    participant = await prisma.participant.create({
      data: {
        username,
        email: profile.email?.toLowerCase(),
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        isEmailValid: true,
        isSSOAccount: true,
        lastLoginAt: new Date(),
      },
    });
  }

  // Create enhanced ParticipantAccount link
  await prisma.participantAccount.create({
    data: {
      ssoType: 'EDUID',
      ssoId: profile.sub,
      participantId: participant.id,
      // New fields for enhanced structure
      type: 'sso',
      provider: 'eduid', 
      providerAccountId: profile.sub,
    },
  });
  
  // Add affiliations for new participant
  if (profile.swissEduIDLinkedAffiliationUniqueID) {
    for (const affiliationId of profile.swissEduIDLinkedAffiliationUniqueID) {
      try {
        await AffiliationService.addParticipantAffiliation(
          participant.id,
          affiliationId,
          affiliationId.split('@')[1]?.split('.')[0]
        );
      } catch (error) {
        console.error(`Failed to add participant affiliation ${affiliationId}:`, error);
      }
    }
  }

  return participant;
}
```

#### 2.3 Update Login Services
```typescript
// Update packages/graphql/src/services/accounts.ts

export async function loginParticipant(
  { usernameOrEmail, password }: LoginParticipantArgs,
  ctx: Context
) {
  const identifier = usernameOrEmail.trim();
  
  // Try username lookup first (existing logic)
  let participant = await ctx.prisma.participant.findUnique({
    where: { username: identifier },
  });
  
  // If not found by username, try affiliation lookup (including primary email)
  if (!participant) {
    participant = await AffiliationService.findParticipantByAffiliation(identifier);
  }
  
  if (!participant) return null;
  
  const isLoginValid = await bcrypt.compare(password, participant.password);
  if (!isLoginValid) return null;
  
  await doParticipantLogin({
    participantId: participant.id,
    participantLocale: participant.locale,
  }, ctx);
  
  return participant.id;
}

// Add similar enhancement for magic link login
export async function sendMagicLink(
  { usernameOrEmail }: SendMagicLinkArgs,
  ctx: Context
) {
  const identifier = usernameOrEmail.trim();
  
  // Try to find participant by username or any affiliation
  let participant = await ctx.prisma.participant.findUnique({
    where: { username: identifier },
  });
  
  if (!participant) {
    participant = await AffiliationService.findParticipantByAffiliation(identifier);
  }
  
  if (!participant || !participant.email) {
    return false; // Don't reveal if account exists
  }
  
  // Continue with existing magic link logic...
  // Generate token, send email, etc.
  
  return true;
}
```

### Phase 3: Simplified Account Merging System

#### 3.1 Merge Detection Logic
```typescript
export class AccountMergeService {
  // Detect potential merge candidates when adding affiliations
  static async detectMergeCandidates(
    newAffiliation: string,
    currentUserId?: string,
    currentParticipantId?: string
  ) {
    if (currentUserId) {
      const existingUser = await AffiliationService.findUserByAffiliation(newAffiliation);
      if (existingUser && existingUser.id !== currentUserId) {
        return {
          conflictType: 'USER',
          existingAccount: existingUser,
          currentAccountId: currentUserId
        };
      }
    }
    
    if (currentParticipantId) {
      const existingParticipant = await AffiliationService.findParticipantByAffiliation(newAffiliation);
      if (existingParticipant && existingParticipant.id !== currentParticipantId) {
        return {
          conflictType: 'PARTICIPANT', 
          existingAccount: existingParticipant,
          currentAccountId: currentParticipantId
        };
      }
    }
    
    return null;
  }
  
  // Merge participant accounts
  static async mergeParticipantAccounts(
    sourceId: string,
    targetId: string,
    reason: string,
    performedBy?: string
  ) {
    const sourceParticipant = await prisma.participant.findUnique({
      where: { id: sourceId },
      include: {
        accounts: true, // ParticipantAccount records
        participations: true,
        questionResponses: true,
        detailQuestionResponses: true,
        feedbacks: true,
        // ... other relations as needed
      }
    });
    
    if (!sourceParticipant) throw new Error('Source participant not found');
    
    const transferredData: any = {};
    
    // Merge ParticipantAccount records (both SSO and affiliations)
    await prisma.participantAccount.updateMany({
      where: { participantId: sourceId },
      data: { participantId: targetId }
    });
    transferredData.accounts = sourceParticipant.accounts.length;
    
    // Merge participations (avoiding duplicates)
    let mergedParticipations = 0;
    for (const participation of sourceParticipant.participations) {
      const existingParticipation = await prisma.participation.findUnique({
        where: {
          courseId_participantId: {
            courseId: participation.courseId,
            participantId: targetId
          }
        }
      });
      
      if (!existingParticipation) {
        await prisma.participation.update({
          where: { id: participation.id },
          data: { participantId: targetId }
        });
        mergedParticipations++;
      } else {
        // Could merge participation data here if needed
        console.log(`Skipping duplicate participation for course ${participation.courseId}`);
      }
    }
    transferredData.participations = mergedParticipations;
    
    // Merge responses, feedbacks, etc.
    await prisma.questionResponse.updateMany({
      where: { participantId: sourceId },
      data: { participantId: targetId }
    });
    transferredData.responses = sourceParticipant.questionResponses.length;
    
    await prisma.questionResponseDetail.updateMany({
      where: { participantId: sourceId },
      data: { participantId: targetId }  
    });
    transferredData.detailResponses = sourceParticipant.detailQuestionResponses.length;
    
    await prisma.feedback.updateMany({
      where: { participantId: sourceId },
      data: { participantId: targetId }
    });
    transferredData.feedbacks = sourceParticipant.feedbacks.length;
    
    // Record the merge
    await prisma.accountMerge.create({
      data: {
        sourceAccountType: 'PARTICIPANT',
        sourceAccountId: sourceId,
        targetAccountType: 'PARTICIPANT', 
        targetAccountId: targetId,
        reason,
        transferredData,
        performedBy
      }
    });
    
    // Soft delete source account
    await prisma.participant.update({
      where: { id: sourceId },
      data: {
        isActive: false,
        email: null, // Clear email to avoid constraint issues
      }
    });
    
    return transferredData;
  }
  
  // Merge user accounts  
  static async mergeUserAccounts(
    sourceId: string,
    targetId: string,
    reason: string,
    performedBy?: string
  ) {
    const sourceUser = await prisma.user.findUnique({
      where: { id: sourceId },
      include: {
        accounts: true,
        courses: true,
        questions: true,
        // ... other User relations
      }
    });
    
    if (!sourceUser) throw new Error('Source user not found');
    
    const transferredData: any = {};
    
    // Merge Account records (both OAuth and affiliations)
    await prisma.account.updateMany({
      where: { userId: sourceId },
      data: { userId: targetId }
    });
    transferredData.accounts = sourceUser.accounts.length;
    
    // Merge courses, questions, etc.
    await prisma.course.updateMany({
      where: { userId: sourceId },
      data: { userId: targetId }
    });
    transferredData.courses = sourceUser.courses.length;
    
    await prisma.element.updateMany({
      where: { userId: sourceId },
      data: { userId: targetId }
    });
    transferredData.questions = sourceUser.questions.length;
    
    // Record the merge
    await prisma.accountMerge.create({
      data: {
        sourceAccountType: 'USER',
        sourceAccountId: sourceId,
        targetAccountType: 'USER',
        targetAccountId: targetId, 
        reason,
        transferredData,
        performedBy
      }
    });
    
    // Soft delete source account
    await prisma.user.update({
      where: { id: sourceId },
      data: {
        email: `deleted_${sourceId}@merged.local`, // Clear email constraint
        deletionToken: crypto.randomUUID(),
        deletionRequestedAt: new Date(),
      }
    });
    
    return transferredData;
  }
}
```

#### 3.2 Interactive Merge Resolution
```typescript
// GraphQL mutations for handling merge scenarios
export const MergeParticipantAccounts = t.field({
  type: 'Boolean',
  args: {
    sourceParticipantId: t.arg.string({ required: true }),
    targetParticipantId: t.arg.string({ required: true }),
    reason: t.arg.string({ required: true }),
  },
  authScopes: { $granted: 'ADMIN' }, // Admin only
  resolve: async (parent, args, ctx) => {
    await AccountMergeService.mergeParticipantAccounts(
      args.sourceParticipantId,
      args.targetParticipantId, 
      args.reason,
      ctx.user?.id
    );
    return true;
  },
});

// Query to find merge candidates
export const GetMergeCandidates = t.field({
  type: [MergeCandidateType],
  args: {
    affiliationIdentifier: t.arg.string({ required: true }),
  },
  authScopes: { $granted: 'ADMIN' },
  resolve: async (parent, args, ctx) => {
    return await AccountMergeService.detectMergeCandidates(
      args.affiliationIdentifier
    );
  },
});
```

### Phase 4: API & Frontend Updates

#### 4.1 GraphQL Schema Updates
```typescript
// Add affiliation queries and mutations
export const AffiliationType = builder.objectType('Affiliation', {
  fields: (t) => ({
    id: t.exposeString('id'),
    identifier: t.exposeString('identifier'),
    type: t.expose('type', { type: AffiliationTypeEnum }),
    isPrimary: t.exposeBoolean('isPrimary'),
    isVerified: t.exposeBoolean('isVerified'),
    source: t.expose('source', { type: AffiliationSourceEnum }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
  }),
});

export const GetUserAffiliations = t.field({
  type: [AffiliationType],
  resolve: async (parent, args, ctx) => {
    if (!ctx.user) throw new Error('Not authenticated');
    
    return await prisma.affiliation.findMany({
      where: { userId: ctx.user.id },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' }
      ]
    });
  },
});

export const AddUserAffiliation = t.field({
  type: AffiliationType,
  args: {
    identifier: t.arg.string({ required: true }),
    type: t.arg({ type: AffiliationTypeEnum, required: true }),
  },
  resolve: async (parent, args, ctx) => {
    if (!ctx.user) throw new Error('Not authenticated');
    
    const mergeCandidates = await AccountMergeService.detectMergeCandidates(
      args.identifier,
      ctx.user.id
    );
    
    if (mergeCandidates) {
      throw new Error(`Account merge required: ${mergeCandidates.conflictType}`);
    }
    
    return await AffiliationService.addAffiliation({
      identifier: args.identifier,
      type: args.type,
      source: 'MANUAL',
      userId: ctx.user.id,
    });
  },
});
```

#### 4.2 Frontend Components
```typescript
// Add affiliation management components
export function AffiliationManager({ userId, participantId }: Props) {
  const [affiliations] = useQuery(GetAffiliationsDocument, {
    variables: { userId, participantId }
  });
  
  const [addAffiliation] = useMutation(AddAffiliationDocument);
  
  return (
    <div>
      <H3>Email Addresses & Identifiers</H3>
      
      {affiliations.data?.affiliations.map(affiliation => (
        <div key={affiliation.id} className="flex items-center justify-between">
          <div>
            <span className={affiliation.isPrimary ? 'font-bold' : ''}>
              {affiliation.identifier}
            </span>
            {affiliation.isPrimary && <Badge>Primary</Badge>}
            {!affiliation.isVerified && <Badge variant="warning">Unverified</Badge>}
          </div>
          
          <div>
            <Button onClick={() => setPrimary(affiliation.id)}>
              Set Primary
            </Button>
            <Button variant="danger" onClick={() => remove(affiliation.id)}>
              Remove
            </Button>
          </div>
        </div>
      ))}
      
      <AddAffiliationForm onSubmit={addAffiliation} />
    </div>
  );
}
```

---

## Migration Strategy

### Phase 1: Foundation (Week 1-2)
1. ✅ Create database schema and migrations
2. ✅ Implement AffiliationService core functionality
3. ✅ Migrate existing data to new schema
4. ✅ Add basic GraphQL queries and mutations

### Phase 2: Authentication Integration (Week 3-4)
1. ✅ Update authentication flows to use affiliations
2. ✅ Modify login services for affiliation lookup
3. ✅ Test authentication with multiple emails
4. ✅ Update error handling and messaging

### Phase 3: Account Merging (Week 5-6)
1. ✅ Implement merge detection logic
2. ✅ Create account merging services
3. ✅ Add admin interfaces for merge resolution
4. ✅ Test merge scenarios thoroughly

### Phase 4: Frontend & Polish (Week 7-8)
1. ✅ Build affiliation management UI
2. ✅ Add user-facing merge resolution flows
3. ✅ Update documentation and help text
4. ✅ Performance optimization and monitoring

---

## Enhanced Auto-Linking Policy & Conflict Resolution

### Secure Auto-Linking Rules

1. **SSO Email Exact Match**: 
   - Auto-link when SSO email exactly matches existing account primary email
   - Only for verified SSO providers (Edu-ID, LTI)
   - Log all auto-linking events for audit

2. **Manual Affiliation Conflicts**:
   - Never auto-merge manual affiliations without verification
   - Queue conflicts for admin review
   - Provide clear error messages to users

3. **Verification Required**:
   - Manual affiliations must be verified before any linking
   - Unverified affiliations cannot be used for authentication
   - Clear UI indication of verification status

### Error Messages & User Communication

```typescript
// Enhanced error handling with clear user messages
export const AffiliationErrors = {
  ALREADY_EXISTS: {
    code: 'AFFILIATION_EXISTS',
    message: 'This email address is already associated with another account.',
    actions: ['Login to existing account', 'Request account merge'],
  },
  
  VERIFICATION_REQUIRED: {
    code: 'VERIFICATION_REQUIRED', 
    message: 'Please verify your email address before you can use it to log in.',
    actions: ['Resend verification email', 'Use different email'],
  },
  
  FEATURE_DISABLED: {
    code: 'FEATURE_DISABLED',
    message: 'Multiple email login is not yet available for your account.',
    actions: ['Use primary email', 'Contact support'],
  },
  
  INVALID_EMAIL: {
    code: 'INVALID_EMAIL',
    message: 'Please enter a valid email address.',
    actions: ['Check email format', 'Try different email'],
  },
};
```

### Monitoring & Metrics Requirements

```typescript
// Metrics to track for production readiness
export const AffiliationMetrics = {
  // Performance metrics
  'affiliation_lookup_duration_ms': 'histogram',
  'primary_email_sync_duration_ms': 'histogram',
  
  // Success/failure rates
  'affiliation_login_attempts_total': 'counter',
  'affiliation_login_success_total': 'counter', 
  'affiliation_verification_sent_total': 'counter',
  'affiliation_verification_completed_total': 'counter',
  
  // Conflict tracking
  'affiliation_conflicts_detected_total': 'counter',
  'account_merge_requests_total': 'counter',
  'account_merge_completed_total': 'counter',
  
  // Feature adoption
  'users_with_multiple_affiliations_total': 'gauge',
  'feature_flag_enabled_users_total': 'gauge',
};

// Alerting thresholds
export const AffiliationAlerts = {
  'high_login_failure_rate': {
    condition: 'affiliation_login_success_rate < 0.95',
    severity: 'warning',
  },
  
  'slow_affiliation_lookups': {
    condition: 'affiliation_lookup_duration_p95 > 200ms',
    severity: 'warning', 
  },
  
  'verification_email_failures': {
    condition: 'verification_email_failure_rate > 0.1',
    severity: 'critical',
  },
};
```

---

## Testing Strategy

### Unit Tests
- AffiliationService methods
- Authentication flow modifications
- Account merging logic
- Data validation and constraints

### Integration Tests  
- Full authentication flows with multiple affiliations
- Account creation and linking scenarios
- Merge detection and resolution
- API endpoint functionality

### End-to-End Tests
- User registration with Edu-ID affiliations
- Login with different email addresses
- Primary email changes
- Account merging workflows

### Load Testing
- Affiliation lookup performance
- Authentication scaling
- Database query optimization

---

## Security Considerations

### Data Protection
- Encrypt sensitive affiliation data
- Audit trail for all affiliation changes
- Rate limiting on affiliation modifications
- Secure merge approval process

### Access Control
- Admin-only access to merge functionality
- User consent for account merging
- Verification requirements for new affiliations
- Proper session management across contexts

### Privacy
- Clear data retention policies
- User control over affiliation visibility
- Compliance with institutional policies
- Secure handling of Edu-ID data

---

## Rollback Plan

### Emergency Rollback
1. Revert authentication flow changes
2. Fall back to original User.email/Participant.email lookup
3. Disable new affiliation features
4. Preserve data in new tables for later reactivation

### Gradual Rollback
1. Disable new user interfaces
2. Stop creating new affiliations
3. Continue using existing affiliation data
4. Plan data consolidation if needed

---

## Success Metrics

### Functionality
- ✅ Users can authenticate with any affiliated email
- ✅ Primary email changes don't break access
- ✅ Account merging resolves conflicts successfully
- ✅ No data loss during migrations

### Performance
- Affiliation lookups < 100ms
- Authentication flows maintain current speed
- Database queries remain optimized
- No significant memory impact

### User Experience
- Reduced support tickets about login issues
- Smooth onboarding for new users
- Clear merge resolution process
- Intuitive affiliation management

---

## Future Enhancements

### Advanced Features
- ORCID integration for researchers
- Automatic affiliation discovery
- Cross-institutional account linking
- Bulk account management for admins

### Monitoring & Analytics
- Affiliation usage patterns
- Login method preferences
- Merge frequency and reasons
- Performance monitoring dashboards

---

## Conclusion

This generic affiliations system will provide a robust foundation for handling multiple identifiers per user while maintaining security and user experience. The phased implementation approach minimizes risk while delivering immediate value for both lecturers and students.

The system is designed to be:
- **Scalable**: Handles growth in users and affiliations
- **Flexible**: Supports various identifier types and sources
- **Secure**: Maintains data protection and access controls
- **User-friendly**: Provides clear interfaces and error handling
- **Maintainable**: Uses consistent patterns across user types

By implementing this system, KlickerUZH will be prepared for complex authentication scenarios while providing users with the flexibility they need for modern educational environments.