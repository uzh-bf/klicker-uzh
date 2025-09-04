# Student Edu-ID Authentication Implementation Plan

## Overview
Add Edu-ID (OpenID Connect) authentication for students to the KlickerUZH platform, enabling students to authenticate via the Swiss educational identity federation. This will be deployed on a new assessment.klicker.uzh.ch instance with a dedicated assessment backend, separate from the lecturer authentication on manage.klicker.uzh.ch.

## Key Requirements
- Reuse the existing Edu-ID client (add assessment redirect URLs)
- Maintain separation between student and lecturer authentication
- No V1 DB schema changes; reuse existing `Participant`/`ParticipantAccount`
- Unify on Edu-ID `sub` as `ssoId` (not `providerAccountId` as in User/Account)
- Keep backward compatibility with existing authentication methods
- Ensure strict separation of identities: Lecturers use `User/Account`, Students use `Participant/ParticipantAccount`
- Do NOT use NextAuth PrismaAdapter or the `User/Account` tables for students

## Separation Strategy
- Lecturers: keep existing NextAuth config at `/api/auth/[...nextauth].ts` with `PrismaAdapter(prisma)`, persisting to `User` and `Account`.
- Students (assessment PWA only): use NextAuth config at `/api/auth/eduid-participant.ts` WITHOUT PrismaAdapter (JWT sessions only), with cookie name `next-auth.participant-session-token`.
- Assessment backend (with `ASSESSMENT_MODE=true`): directly accepts and validates the NextAuth participant session cookie - no token exchange needed.
- Persistence for students happens directly in NextAuth callbacks into `Participant` and `ParticipantAccount`. The NextAuth `Account` table is NOT used in the student flow.

## Implementation Steps

### 1. Database Schema (V1: No Changes)

Use the existing participant tables as-is:

```prisma
model ParticipantAccount {
  id String @id @default(uuid()) @db.Uuid

  ssoId   String @unique           // will store Edu-ID 'sub'
  ssoType String @default("LTI1.1") // will store 'EDUID' for Edu-ID logins

  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  participantId String      @db.Uuid

  createdAt DateTime @default(now())

  @@unique([participantId, ssoType])
}
```

Identifier choice:
- Store Edu-ID `sub` in `ssoId` and `'EDUID'` in `ssoType`.
- This maintains consistency with existing LTI authentication pattern.

### 2. Backend - Assessment Mode Configuration

**Update `apps/backend-docker/src/app.ts`**:
```typescript
// Update JWT strategy's jwtFromRequest function
if (process.env.ASSESSMENT_MODE === 'true') {
  // Assessment mode: Only check for student NextAuth cookie
  token = req.cookies?.['next-auth.participant-session-token']
} else {
  // Regular mode: Check all existing tokens (participant_token, etc.)
  // ... existing logic
}
```

### 3. Auth App - Enhanced NextAuth Configuration

**Update existing `/api/auth/eduid-participant.ts`**:
```typescript
// Student-only NextAuth configuration
// NO PrismaAdapter - participant persistence via callbacks
export const authOptions: NextAuthOptions = {
  secret: process.env.APP_SECRET,
  
  providers: [
    {
      id: 'eduid-participant',  // Same as existing
      wellKnown: process.env.EDUID_WELL_KNOWN,
      clientId: process.env.EDUID_CLIENT_ID,
      clientSecret: process.env.EDUID_CLIENT_SECRET,
      
      name: 'EduID',
      type: 'oauth',
      authorization: {
        params: {
          claims: {
            id_token: {
              sub: { essential: true },
              email: { essential: true },
              swissEduPersonUniqueID: { essential: true },
            },
          },
          scope: 'openid email https://login.eduid.ch/authz/User.Read',
        },
      },
      idToken: true,
      checks: ['pkce', 'state'],
      
      profile(profile) {
        return profile
      },
    }
  ],
  
  session: {
    strategy: 'jwt',  // JWT only - no database sessions
  },
  
  cookies: {
    sessionToken: {
      name: 'next-auth.participant-session-token',
      options: {
        domain: process.env.COOKIE_DOMAIN,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  
  callbacks: {
    async signIn({ user, account, profile }) {
      // Create/link Participant and ParticipantAccount directly
      await createOrLinkParticipant(profile)
      return true
    },
    
    async jwt({ token, profile }) {
      if (profile) {
        // Look up participant by Edu-ID sub
        const participantAccount = await prisma.participantAccount.findUnique({
          where: { ssoId: profile.sub },
          include: { participant: true }
        })
        
        // Structure token for participant authentication
        token.sub = participantAccount.participantId
        token.role = 'PARTICIPANT'
        token.scope = 'PARTICIPANT'
        token.email = profile.email
      }
      return token
    },
    
    async redirect({ url, baseUrl }) {
      // Allow redirects to assessment PWA
      if (url.includes('assessment.klicker.uzh.ch')) {
        return url
      }
      return baseUrl
    },
  },
}
```

### 4. Auth App - Simple Entry Point

**Create `/student.tsx` page**:
```typescript
// Simple entry point for student Edu-ID authentication
export default function Student() {
  const router = useRouter()
  
  useEffect(() => {
    const redirectTo = router.query.redirectTo as string
    if (!redirectTo || !isValidStudentRedirectUrl(redirectTo)) {
      // Invalid or missing redirect
      return
    }
    
    // Directly trigger NextAuth sign-in with callback to PWA
    signIn('eduid-participant', {
      callbackUrl: redirectTo
    })
  }, [router])
  
  return <div>Redirecting to Edu-ID...</div>
}
```

### 5. NextAuth Helper Function

**Add to `/api/auth/eduid-participant.ts`**:
```typescript
async function createOrLinkParticipant(profile: ExtendedProfile) {
  // Lookup existing account via ssoId (Edu-ID sub)
  const existing = await prisma.participantAccount.findUnique({
    where: { ssoId: profile.sub },
    include: { participant: true },
  })
  
  if (existing) {
    await prisma.participant.update({
      where: { id: existing.participantId },
      data: { lastLoginAt: new Date() },
    })
    return existing.participant
  }
  
  // Check for existing participant by email
  let participant: Participant | null = null
  
  if (profile.email) {
    participant = await prisma.participant.findUnique({
      where: { email: profile.email },
    })
  }
  
  // Create new participant if none exists
  if (!participant) {
    const username = await generateUniqueUsername(profile.email)
    participant = await prisma.participant.create({
      data: {
        username,
        email: profile.email,
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        isEmailValid: true,  // Edu-ID emails are pre-validated
        isSSOAccount: true,
        lastLoginAt: new Date(),
      },
    })
  }
  
  // Create ParticipantAccount link
  await prisma.participantAccount.create({
    data: {
      ssoType: 'EDUID',
      ssoId: profile.sub,
      participant: { connect: { id: participant.id } },
    },
  })
  
  return participant
}
```

### 6. Frontend PWA Updates

**Update login.tsx for assessment instance**:
```typescript
function Login() {
  const t = useTranslations()
  const router = useRouter()
  
  // Check if this is the assessment instance
  const isAssessmentInstance = process.env.NEXT_PUBLIC_PWA_URL?.includes('assessment')
  
  const handleEduIdLogin = () => {
    const redirectTo = encodeURIComponent(window.location.origin + '/')
    window.location.href = `${process.env.NEXT_PUBLIC_AUTH_URL}/student?redirectTo=${redirectTo}`
  }
  
  if (isAssessmentInstance) {
    // Assessment instance: Only show Edu-ID login
    return (
      <div className="flex h-full flex-col items-center md:justify-center">
        <Head>
          <title>Student Login - Assessment</title>
        </Head>
        <div className="w-full max-w-md">
          <h1>Login with Edu-ID</h1>
          <Button onClick={handleEduIdLogin}>
            Login with Edu-ID
          </Button>
        </div>
      </div>
    )
  }
  
  // Regular instance: Show existing login methods
  // ... existing login form code ...
}
```

### 7. Cookie & Session Management

Simplified cookie architecture:
- Lecturer NextAuth: `next-auth.session-token` (existing, regular backend)
- Student NextAuth: `next-auth.participant-session-token` (new, assessment backend)
- Assessment backend directly validates the NextAuth participant session token

No cookie exchange or handoff mechanism needed. The assessment backend (with `ASSESSMENT_MODE=true`) only handles student authentication via the NextAuth participant session cookie.

### 8. Environment Configuration

**Add to PWA assessment environment (.env.assessment)**:
```bash
NEXT_PUBLIC_AUTH_URL="https://auth.klicker.uzh.ch"
```

**Add to assessment backend environment**:
```bash
ASSESSMENT_MODE="true"
```

**Add to auth app for validation**:
```bash
APP_STUDENT_DOMAIN="assessment.klicker.uzh.ch"
```

### 9. Security Implementation

**URL validation helper**:
```typescript
function isValidStudentRedirectUrl(url: string): boolean {
  if (!url) return false
  
  try {
    const parsed = new URL(url)
    const allowedDomains = [
      process.env.APP_STUDENT_DOMAIN,
      'assessment.klicker.uzh.ch',
      // Development
      '127.0.0.1:3000',
      'localhost:3000',
    ]
    
    return allowedDomains.some(domain => 
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}
```

### 10. Testing Strategy

- Test redirect routing via `/student` entry point
- Verify `next-auth.participant-session-token` cookie is set and readable by assessment backend
- Test participant creation with Edu-ID and linking to existing participant by email
- Validate username collision handling on new participant creation
- Verify backward compatibility (existing methods work on regular backend)
- Ensure no `User`/`Account` rows are created during the student flow (adapterless NextAuth)
- Test cookie domain settings across subdomains
- Verify session isolation between lecturer and student authentication
- Test assessment backend only processes student authentication when `ASSESSMENT_MODE=true`

### 11. Migration & Backward Compatibility

**Phase 1**: Add new authentication alongside existing
- Deploy new auth routes without removing existing methods
- Test with pilot group of students

**Phase 2**: Gradual migration
- Encourage Edu-ID adoption through UI prompts
- Maintain existing authentication methods

**Phase 3**: Optional consolidation
- Consider deprecating username/password for assessment instance
- Keep magic link and LTI as alternatives

## Implementation Order

1. ✅ **Backend**: Update JWT strategy in `apps/backend-docker/src/app.ts` for assessment mode
2. ✅ **Auth app**: Enhance NextAuth callbacks in `/api/auth/eduid-participant.ts` for participant creation  
3. ✅ **Auth app**: Add `/student.tsx` entry point page
4. ✅ **PWA (assessment)**: Add Edu-ID login button linking to `/student`
5. ✅ **Development Scripts**: Add `dev:assessment` commands across all apps with Doppler integration
6. 📋 **Doppler Configuration**: Create `dev_assessment` config with assessment-specific variables
7. 📋 **Edu-ID Configuration**: Register callback URLs in Switch Edu-ID client
8. 📋 **Testing**: Validate end-to-end flow and cookie handling
9. 📋 **Deployment**: Assessment backend and PWA instances

## Implementation Status

### ✅ Completed
1. **Backend Assessment Mode Configuration** - `apps/backend-docker/src/app.ts` updated with `ASSESSMENT_MODE` environment variable check
2. **NextAuth Enhanced Configuration** - `/api/auth/eduid-participant.ts` with:
   - Participant creation/linking in signIn callback
   - JWT structuring with participant data
   - Helper function `createOrLinkParticipant`
3. **Student Entry Point** - `/student.tsx` page created with URL validation and NextAuth integration
4. **PWA Assessment Mode Updates** - Login form enhanced with:
   - Environment-based Edu-ID login button
   - Assessment mode detection via `NEXT_PUBLIC_IS_ASSESSMENT`
   - Proper redirect handling to auth app
5. **Development Scripts Setup** - Added `dev:assessment` commands to:
   - Root package.json with Doppler `dev_assessment` config
   - Backend-docker, frontend-pwa, auth, frontend-manage, frontend-control
   - Fallback scripts for all other apps
6. **Environment Configuration** - Assessment-specific environment files created:
   - `.env.assessment` for production
   - `.env.assessment.development` for local development

### 🔄 In Progress  
- Remaining app `dev:assessment` scripts (handled by user)

### 📋 Pending
1. **Doppler Configuration** - Create `dev_assessment` branch with:
   - `ASSESSMENT_MODE=true`
   - `NEXT_PUBLIC_IS_ASSESSMENT=true`
   - `NEXT_PUBLIC_AUTH_URL=https://auth.klicker.com` (dev) / `https://auth.klicker.uzh.ch` (prod)
2. **Edu-ID Redirect URLs** - Register in Switch Edu-ID client:
   - `https://auth.klicker.com/api/auth/callback/eduid-participant` (dev)
   - `https://auth.klicker.uzh.ch/api/auth/callback/eduid-participant` (prod)
3. **End-to-End Testing** - Verify complete authentication flow
4. **Production Deployment** - Assessment backend and PWA instances with proper environment configuration

## Development Setup

### Normal Mode
```bash
# Start all apps in normal mode
pnpm dev

# Individual apps
cd apps/backend-docker && pnpm dev:doppler
cd apps/frontend-pwa && pnpm dev:doppler
```

### Assessment Mode
```bash  
# Start all apps in assessment mode (requires dev_assessment Doppler config)
pnpm dev:assessment

# Individual apps
cd apps/backend-docker && pnpm dev:assessment
cd apps/frontend-pwa && pnpm dev:assessment
```

**Prerequisites for Assessment Mode:**
1. Create `dev_assessment` Doppler config branched from `dev`
2. Set required environment variables in Doppler (see Pending section above)
3. All apps have `dev:assessment` scripts (completed or fallback to normal dev)

## Risks and Mitigations

**Risk**: Cookie conflicts between lecturer and student sessions
**Mitigation**: Different cookie names and separate backend instances (assessment mode)

**Risk**: Confusion between lecturer and student login flows
**Mitigation**: Clear visual distinction, separate entry points, and dedicated assessment instance

**Risk**: Existing authentication methods disruption
**Mitigation**: Assessment backend is separate - no impact on existing flows

**Risk**: JWT token structure mismatch
**Mitigation**: Careful validation that NextAuth JWT contains expected participant data structure

## Success Criteria

- Students can authenticate via Edu-ID on assessment.klicker.uzh.ch
- Assessment backend directly accepts NextAuth participant session cookies
- Complete separation between student and lecturer authentication (separate backends)
- No disruption to existing authentication methods (regular backend unchanged)
- Smooth migration path for existing student accounts via email linking
- Clear audit trail for authentication attempts via ParticipantAccount records

## Key Benefits of Streamlined Approach

- **Simplified Architecture**: No token exchange or handoff pages needed
- **Clean Separation**: Dedicated assessment backend with `ASSESSMENT_MODE=true`
- **Reduced Complexity**: NextAuth callbacks handle all participant creation/linking
- **Better Performance**: Direct cookie validation without additional API calls
- **Easier Testing**: Fewer moving parts and integration points
