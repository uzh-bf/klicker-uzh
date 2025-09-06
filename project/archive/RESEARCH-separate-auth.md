# Multiple NextAuth configurations in v4 won't work with separate files

NextAuth v4's **catch-all route architecture prevents separate authentication files from functioning**. When you define `pages/api/auth/[...nextauth].ts`, it creates a catch-all API route that intercepts ALL requests to `/api/auth/*`, making your `pages/api/auth/eduid-participant.ts` file unreachable. This is a fundamental architectural constraint, not a configuration issue. The solution requires working within NextAuth's provider system through dynamic configuration rather than attempting to create separate API endpoints.

## Why your separate file approach fails

The `[...nextauth].ts` file establishes a **routing monopoly** over all authentication endpoints. When you call `signIn('eduid-participant')`, NextAuth looks for a provider with that ID within the main configuration—it doesn't route to a separate file. The provider name is simply a configuration identifier that NextAuth uses internally to route to `POST /api/auth/signin/eduid-participant`, which is still processed by your main authentication file.

Next.js routing prioritizes catch-all routes over static routes at the same level. Once the catch-all matches `/api/auth/*`, no other files in that directory can be accessed. This explains why your custom flow defaults to the main sign-in: NextAuth can't find a provider named 'eduid-participant' in the main configuration, so it falls back to the default behavior.

The internal routing mechanism works like this: NextAuth parses the `req.query.nextauth` array to determine the action (signin, callback, session) and provider. All processing happens within a single entry point, maintaining unified session management, CSRF protection, and callback handling across all authentication flows.

## The correct implementation approach

Instead of separate files, NextAuth v4 requires configuring multiple authentication flows within a single instance. Here's the proper implementation using **dynamic configuration with advanced initialization**:

```typescript
// pages/api/auth/[...nextauth].ts
import type { NextApiRequest, NextApiResponse } from "next"
import NextAuth, { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  // Extract context from request to determine auth flow
  const { query, headers, method } = req
  const authType = query.type || headers.referer?.includes('/eduid') ? 'eduid' : 'main'

  // Build providers dynamically based on auth flow
  let providers: any[] = []

  if (authType === 'eduid') {
    // EduID participant authentication flow
    providers = [
      CredentialsProvider({
        id: "eduid-participant",
        name: "EduID Participant Login",
        credentials: {
          participantId: { label: "Participant ID", type: "text" },
          password: { label: "Password", type: "password" }
        },
        async authorize(credentials) {
          // Your EduID authentication logic
          const user = await validateEduIDCredentials(credentials)
          return user ? { ...user, authType: 'eduid' } : null
        }
      })
    ]
  } else {
    // Main authentication flow
    providers = [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
      CredentialsProvider({
        id: "credentials",
        name: "Email Login",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" }
        },
        async authorize(credentials) {
          const user = await validateMainCredentials(credentials)
          return user ? { ...user, authType: 'main' } : null
        }
      })
    ]
  }

  const authOptions: NextAuthOptions = {
    providers,
    pages: {
      signIn: authType === 'eduid' ? '/eduid/signin' : '/auth/signin',
      error: '/auth/error'
    },
    callbacks: {
      async signIn({ user, account }) {
        // Validate based on auth type
        if (authType === 'eduid' && user.authType !== 'eduid') {
          return false
        }
        return true
      },
      async session({ session, token }) {
        session.authType = token.authType
        return session
      },
      async jwt({ token, user }) {
        if (user) {
          token.authType = user.authType
        }
        return token
      }
    }
  }

  return await NextAuth(req, res, authOptions)
}
```

For a **simpler approach with multiple providers** in a single configuration:

```typescript
// pages/api/auth/[...nextauth].ts
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"

export default NextAuth({
  providers: [
    // Main flow providers
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // EduID participant provider
    CredentialsProvider({
      id: "eduid-participant",  // This ID is what you use in signIn()
      name: "EduID Participant",
      credentials: {
        participantId: { label: "Participant ID", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Your EduID authentication logic
        return await authenticateEduIDParticipant(credentials)
      }
    }),
    // Regular credentials provider
    CredentialsProvider({
      id: "credentials",
      name: "Email Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        return await authenticateRegularUser(credentials)
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === 'eduid-participant') {
        token.isEduIDParticipant = true
      }
      return token
    },
    async session({ session, token }) {
      session.user.isEduIDParticipant = token.isEduIDParticipant
      return session
    }
  }
})
```

## Properly routing to different authentication flows

To route users to different authentication flows, use these client-side patterns:

```typescript
// components/auth/AuthButtons.tsx
import { signIn } from "next-auth/react"

export function MainAuthButton() {
  return (
    <button onClick={() => signIn('credentials', {
      callbackUrl: '/dashboard'
    })}>
      Main Login
    </button>
  )
}

export function EduIDAuthButton() {
  return (
    <button onClick={() => signIn('eduid-participant', {
      callbackUrl: '/eduid/dashboard'
    })}>
      EduID Participant Login
    </button>
  )
}

// For dynamic routing with additional parameters
export function DynamicAuthButton({ authType }) {
  const handleSignIn = () => {
    // Pass additional context through the sign-in URL
    signIn(authType === 'eduid' ? 'eduid-participant' : 'credentials', {
      callbackUrl: authType === 'eduid' ? '/eduid/dashboard' : '/dashboard',
      // Additional parameters can be passed
      type: authType
    })
  }

  return <button onClick={handleSignIn}>Sign In</button>
}
```

For custom sign-in pages with different flows:

```typescript
// pages/eduid/signin.tsx
import { getProviders, signIn } from "next-auth/react"
import { useEffect, useState } from "react"

export default function EduIDSignIn() {
  const [providers, setProviders] = useState(null)

  useEffect(() => {
    async function fetchProviders() {
      const res = await getProviders()
      // Filter to show only EduID provider
      const eduIDProvider = res?.['eduid-participant']
      setProviders(eduIDProvider ? { 'eduid-participant': eduIDProvider } : null)
    }
    fetchProviders()
  }, [])

  return (
    <div>
      <h1>EduID Participant Login</h1>
      {providers && (
        <button onClick={() => signIn('eduid-participant', {
          callbackUrl: '/eduid/dashboard'
        })}>
          Sign in as EduID Participant
        </button>
      )}
    </div>
  )
}
```

## Multiple [...nextauth].ts endpoints aren't possible

You **cannot have multiple `[...nextauth].ts` endpoints** at different paths in NextAuth v4 without significant workarounds. The framework is designed around a single authentication entry point. However, there are advanced patterns to simulate multiple endpoints:

### Middleware-based routing workaround

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Route different auth paths to the main handler with context
  if (pathname.startsWith('/api/auth-eduid')) {
    const url = request.nextUrl.clone()
    // Rewrite to main auth endpoint with type parameter
    url.pathname = url.pathname.replace('/api/auth-eduid', '/api/auth')
    url.searchParams.set('type', 'eduid')
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*'
}
```

This allows you to call `/api/auth-eduid/signin` which gets rewritten to `/api/auth/signin?type=eduid`, maintaining the illusion of separate endpoints while using a single NextAuth instance.

## Comprehensive working implementation

Here's a complete, production-ready implementation supporting multiple authentication configurations:

```typescript
// pages/api/auth/[...nextauth].ts
import type { NextApiRequest, NextApiResponse } from "next"
import NextAuth, { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import AzureADProvider from "next-auth/providers/azure-ad"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "../../../lib/prisma"

// Helper to determine auth context
function getAuthContext(req: NextApiRequest) {
  const { type } = req.query
  const referer = req.headers.referer || ''

  if (type === 'eduid' || referer.includes('/eduid')) {
    return 'eduid'
  }
  if (type === 'admin' || referer.includes('/admin')) {
    return 'admin'
  }
  return 'main'
}

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  const context = getAuthContext(req)

  // Base configuration
  const baseConfig: Partial<NextAuthOptions> = {
    adapter: PrismaAdapter(prisma),
    session: {
      strategy: "jwt",
      maxAge: context === 'admin' ? 30 * 60 : 24 * 60 * 60 // 30min for admin, 24h for others
    },
    jwt: {
      secret: process.env.NEXTAUTH_SECRET,
    },
    cookies: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true,
    }
  }

  // Context-specific providers
  let providers = []
  let pages = {}

  switch (context) {
    case 'eduid':
      providers = [
        CredentialsProvider({
          id: "eduid-participant",
          name: "EduID Participant",
          credentials: {
            participantId: { label: "Participant ID", type: "text" },
            accessCode: { label: "Access Code", type: "password" }
          },
          async authorize(credentials) {
            if (!credentials) return null

            // Validate EduID credentials
            const participant = await prisma.eduIDParticipant.findFirst({
              where: {
                participantId: credentials.participantId,
                accessCode: credentials.accessCode,
                active: true
              }
            })

            if (participant) {
              return {
                id: participant.id,
                email: participant.email,
                name: participant.name,
                role: 'participant',
                context: 'eduid'
              }
            }
            return null
          }
        })
      ]
      pages = {
        signIn: '/eduid/login',
        signOut: '/eduid/logout',
        error: '/eduid/error'
      }
      break

    case 'admin':
      providers = [
        AzureADProvider({
          clientId: process.env.AZURE_AD_CLIENT_ID!,
          clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
          tenantId: process.env.AZURE_AD_TENANT_ID,
        }),
        CredentialsProvider({
          id: "admin-credentials",
          name: "Admin Login",
          credentials: {
            username: { label: "Username", type: "text" },
            password: { label: "Password", type: "password" },
            totp: { label: "2FA Code", type: "text" }
          },
          async authorize(credentials) {
            // Validate admin with 2FA
            const admin = await validateAdminWith2FA(credentials)
            return admin ? { ...admin, role: 'admin', context: 'admin' } : null
          }
        })
      ]
      pages = {
        signIn: '/admin/login',
        signOut: '/admin/logout',
        error: '/admin/error'
      }
      break

    default: // main
      providers = [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        CredentialsProvider({
          id: "credentials",
          name: "Email Login",
          credentials: {
            email: { label: "Email", type: "email" },
            password: { label: "Password", type: "password" }
          },
          async authorize(credentials) {
            const user = await validateUserCredentials(credentials)
            return user ? { ...user, role: 'user', context: 'main' } : null
          }
        })
      ]
      pages = {
        signIn: '/auth/signin',
        signOut: '/auth/signout',
        error: '/auth/error'
      }
  }

  const authOptions: NextAuthOptions = {
    ...baseConfig,
    providers,
    pages,
    callbacks: {
      async signIn({ user, account, profile }) {
        // Context-specific validation
        if (context === 'admin' && user.role !== 'admin') {
          return false
        }
        if (context === 'eduid' && user.context !== 'eduid') {
          return false
        }
        return true
      },
      async jwt({ token, user, account, trigger }) {
        if (user) {
          token.id = user.id
          token.role = user.role
          token.context = user.context
        }

        // Handle token refresh
        if (trigger === "update") {
          const updatedUser = await prisma.user.findUnique({
            where: { id: token.id as string }
          })
          if (updatedUser) {
            token.role = updatedUser.role
          }
        }

        return token
      },
      async session({ session, token }) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.context = token.context as string
        return session
      },
      async redirect({ url, baseUrl }) {
        // Context-aware redirects
        if (url.startsWith(baseUrl)) return url

        switch (context) {
          case 'eduid':
            return `${baseUrl}/eduid/dashboard`
          case 'admin':
            return `${baseUrl}/admin/dashboard`
          default:
            return `${baseUrl}/dashboard`
        }
      }
    },
    events: {
      async signIn({ user, account }) {
        // Log authentication events
        await prisma.authLog.create({
          data: {
            userId: user.id,
            provider: account?.provider || 'credentials',
            context,
            timestamp: new Date()
          }
        })
      }
    }
  }

  return await NextAuth(req, res, authOptions)
}
```

## Limitations and best practices for multiple auth configurations

NextAuth v4 has **significant architectural limitations** for complex multi-authentication scenarios. The framework assumes a single configuration source, unified session management, and consistent security model across all providers. You cannot have simultaneous sessions with different providers or truly independent authentication flows.

**Performance considerations** are critical. NextAuth v4 suffers from 5-9 second cold boot times in serverless environments, with each authentication check involving JWT decryption and potential database lookups. For multi-tenant scenarios, implement caching strategies and use JWT sessions rather than database sessions to minimize latency.

**Security best practices** include validating tenant access in all callbacks, using environment-specific secrets with rotation policies, and implementing defense in depth—don't rely solely on middleware for authentication. Recent vulnerabilities like CVE-2025-29927 highlight the importance of keeping Next.js updated (14.2.25+ or 15.2.3+) to prevent authentication bypass attacks.

For production applications with complex requirements, **consider these alternatives**:

- **NextAuth v5 (Auth.js)**: Offers better multi-tenant support with improved environment variable handling and Edge runtime compatibility
- **Clerk**: Provides built-in multi-tenant support with organization management, ideal for B2B SaaS applications
- **Custom implementation**: For highly specific requirements that NextAuth cannot accommodate

The key limitation to understand is that NextAuth v4 **fundamentally requires all authentication to flow through a single entry point**. While you can implement sophisticated routing logic and dynamic configuration within that constraint, you cannot create truly separate authentication systems within the same application without significant architectural changes or moving to alternative solutions.
