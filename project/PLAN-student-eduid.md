# Student Edu-ID Authentication Implementation Plan

## Overview
Add Edu-ID (OpenID Connect) authentication for students to the KlickerUZH platform, enabling students to authenticate via the Swiss educational identity federation. This will be deployed on a new assessment.klicker.uzh.ch instance, separate from the lecturer authentication on manage.klicker.uzh.ch.

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
- Students (assessment PWA only): add a separate NextAuth config at `/api/auth-student/[...nextauth].ts` WITHOUT PrismaAdapter (JWT sessions only), with its own cookie name (e.g., `student-auth.session-token`).
- Persistence for students happens via GraphQL in `/api/student` into `Participant` and `ParticipantAccount`. The NextAuth `Account` table is NOT used in the student flow.

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

### 2. Auth App - Student NextAuth Configuration

Create a new NextAuth instance for students that operates independently from the lecturer instance.

**New file: `/api/auth-student/[...nextauth].ts`**:
```typescript
// Student-only NextAuth configuration
// NO PrismaAdapter - all persistence via GraphQL
export const authOptions: NextAuthOptions = {
  secret: process.env.APP_SECRET,
  
  providers: [
    {
      id: 'eduid-student',  // Different ID from lecturer Edu-ID
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
              // Additional claims if needed for student context
            },
          },
          scope: 'openid email',
        },
      },
      idToken: true,
      checks: ['pkce', 'state'],
      
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.email,
        }
      },
    }
  ],
  
  session: {
    strategy: 'jwt',  // JWT only - no database sessions
  },
  
  cookies: {
    sessionToken: {
      name: 'student-auth.session-token',  // Different cookie name
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
    async jwt({ token, profile }) {
      if (profile) {
        token.sub = profile.sub
        token.email = profile.email
      }
      return token
    },
    async redirect({ url, baseUrl }) {
      // Only allow redirects to student_handoff
      if (url.includes('/student_handoff')) {
        return url
      }
      return baseUrl
    },
  },
}
```

### 3. Auth App - Student Routes

**New route: `/student` (pages/student.tsx)**:
```typescript
// Entry point for student Edu-ID authentication
export default function Student() {
  const router = useRouter()
  
  useEffect(() => {
    const redirectTo = router.query.redirectTo as string
    if (!redirectTo || !isValidRedirectUrl(redirectTo)) {
      // Invalid or missing redirect
      return
    }
    
    // Redirect to student NextAuth sign-in with callback
    const callbackUrl = `/student_handoff?redirectTo=${encodeURIComponent(redirectTo)}`
    router.replace(`/api/auth-student/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }, [router])
  
  return null
}
```

**New route: `/student_handoff` (pages/student_handoff.tsx)**:
```typescript
// Handles the callback from Edu-ID and exchanges for participant token
export default function StudentHandoff() {
  const router = useRouter()
  
  useEffect(() => {
    const redirectTo = router.query.redirectTo as string
    if (!redirectTo || !isValidRedirectUrl(redirectTo)) {
      return
    }
    
    const exchange = async () => {
      const response = await fetch('/api/student', {
        method: 'POST',
        body: JSON.stringify({ redirectTo }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        // Redirect back to PWA with participant_token set
        window.location.href = data.redirectURL
      }
    }
    
    exchange()
  }, [router])
  
  return <div>Completing authentication...</div>
}
```

**New API route: `/api/student` (pages/api/student.ts)**:
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get the student NextAuth session
  const session = await getToken({
    req,
    decode,
    cookieName: 'student-auth.session-token',
    secret: process.env.APP_SECRET,
  })
  
  if (!session || !session.sub) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const { redirectTo } = req.body
  
  // Validate redirect URL against whitelist
  if (!isValidStudentRedirectUrl(redirectTo)) {
    return res.status(400).json({ error: 'Invalid redirect URL' })
  }
  
  // Create signed payload for GraphQL
  const signedData = JWT.sign(
    {
      sub: session.sub,
      email: session.email,
      scope: 'EDUID',
    },
    process.env.APP_SECRET
  )
  
  // Call GraphQL mutation
  const result = await apolloClient.mutate({
    mutation: LoginParticipantWithEduIdDocument,
    variables: { signedEduIdData: signedData },
  })
  
  if (result.data?.loginParticipantWithEduId?.participantToken) {
    // Set participant_token cookie
    setCookie(res, 'participant_token', result.data.loginParticipantWithEduId.participantToken, {
      domain: process.env.COOKIE_DOMAIN,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 14, // 14 days
    })
    
    // Optional: Clear student NextAuth session to avoid confusion
    // await signOut({ req, res })
    
    return res.status(200).json({ redirectURL: redirectTo })
  }
  
  return res.status(500).json({ error: 'Authentication failed' })
}
```

### 4. GraphQL API Updates

**New mutation in schema/mutation.ts**:
```typescript
loginParticipantWithEduId: t.field({
  type: ParticipantTokenData,
  args: {
    signedEduIdData: t.arg.string({ required: true }),
  },
  resolve: async (_, args, ctx) => {
    return await AccountService.loginParticipantWithEduId(args, ctx)
  },
})
```

**New service function in services/accounts.ts**:
```typescript
async function loginParticipantWithEduId(
  { signedEduIdData }: { signedEduIdData: string },
  ctx: Context
) {
  // Verify signed payload from auth app
  const data = JWT.verify(signedEduIdData, process.env.APP_SECRET as string) as {
    sub: string
    email?: string
    scope: 'EDUID'
  }
  
  // Lookup existing account via ssoId (Edu-ID sub)
  const existing = await ctx.prisma.participantAccount.findUnique({
    where: { ssoId: data.sub },
    include: { participant: true },
  })
  
  if (existing) {
    await ctx.prisma.participant.update({
      where: { id: existing.participantId },
      data: { lastLoginAt: new Date() },
    })
    const token = await doParticipantLogin(
      {
        participantId: existing.participantId,
        participantLocale: existing.participant.locale,
      },
      ctx
    )
    return { participantToken: token, participant: existing.participant }
  }
  
  // Check for existing participant by email
  let participant: Participant | null = null
  
  if (data.email) {
    participant = await ctx.prisma.participant.findUnique({
      where: { email: data.email },
    })
  }
  
  // Create new participant if none exists
  if (!participant) {
    const username = await generateUniqueUsername(data.email)
    participant = await ctx.prisma.participant.create({
      data: {
        username,
        email: data.email,
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        isEmailValid: true,  // Edu-ID emails are pre-validated
        isSSOAccount: true,
        lastLoginAt: new Date(),
      },
    })
  }
  
  // Create ParticipantAccount link
  await ctx.prisma.participantAccount.create({
    data: {
      ssoType: 'EDUID',
      ssoId: data.sub,
      participant: { connect: { id: participant.id } },
    },
  })
  
  const token = await doParticipantLogin(
    {
      participantId: participant.id,
      participantLocale: participant.locale,
    },
    ctx
  )
  
  return { participantToken: token, participant }
}
```

### 5. Frontend PWA Updates

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

### 6. Cookie & Session Management

Cookie architecture:
- Lecturer NextAuth: `next-auth.session-token` (existing)
- Student NextAuth: `student-auth.session-token` (new, temporary)
- Student App: `participant_token` (existing, final token)

The student NextAuth session is only used temporarily during the authentication handoff and can optionally be cleared after setting the participant_token.

### 7. Environment Configuration

**Add to PWA assessment environment (.env.assessment)**:
```bash
NEXT_PUBLIC_AUTH_URL="https://auth.klicker.uzh.ch"
```

**Add to auth app for validation**:
```bash
APP_STUDENT_DOMAIN="assessment.klicker.uzh.ch"
```

### 8. Security Implementation

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

### 9. Testing Strategy

- Test redirect routing via `/student` and `/student_handoff`
- Verify `participant_token` cookie is set and readable by PWA
- Test participant creation with Edu-ID and linking to existing participant by email
- Validate username collision handling on new participant creation
- Verify backward compatibility (username/password, magic link, LTI, temporary participants)
- Ensure no `User`/`Account` rows are created during the student flow (adapterless NextAuth)
- Test cookie domain settings across subdomains
- Verify session isolation between lecturer and student logins

### 10. Migration & Backward Compatibility

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

1. GraphQL mutation `loginParticipantWithEduId`
2. Auth app: add student NextAuth config (no PrismaAdapter) at `/api/auth-student/[...nextauth].ts`
3. Auth app: add `/student`, `/student_handoff`, `/api/student`
4. PWA (assessment): add Edu-ID login button linking to `/student`
5. Testing and validation (including "no User/Account writes")
6. Edu-ID redirect configuration updates
7. Documentation and deployment

## Risks and Mitigations

**Risk**: Cookie conflicts between lecturer and student sessions
**Mitigation**: Use `participant_token` for students; optionally sign out NextAuth post-handoff

**Risk**: Confusion between lecturer and student login flows
**Mitigation**: Clear visual distinction and separate entry points

**Risk**: Existing LTI integration disruption
**Mitigation**: Keep legacy fields and gradual migration

**Risk**: Edu-ID configuration complexity
**Mitigation**: Reuse existing client with additional redirect URLs

## Success Criteria

- Students can authenticate via Edu-ID on assessment.klicker.uzh.ch
- Complete separation between student and lecturer authentication
- No disruption to existing authentication methods
- Smooth migration path for existing accounts
- Clear audit trail for authentication attempts
