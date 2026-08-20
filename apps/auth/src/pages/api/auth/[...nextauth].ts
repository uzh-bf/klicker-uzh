import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@klicker-uzh/prisma'
import { UserLoginScope } from '@klicker-uzh/prisma/client'
import {
  deriveCookieDomainFromURL,
  generateRandomString,
  reduceCatalyst,
} from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { NextAuthOptions } from 'next-auth'
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { Provider } from 'next-auth/providers/index'
import { MANAGER_COOKIE_NAME, PARTICIPANT_COOKIE_NAME } from '@/lib/constants'
import {
  createOrLinkParticipant,
  createUserAffiliations,
  decode,
  ExtendedProfile,
  ExtendedUser,
  encode,
  getAuthContext,
  getLecturerHosts,
  getStudentHosts,
} from '@/lib/helpers'
import { sendTeamsNotifications } from '@/lib/util'

// Validate required environment variables
if (!process.env.APP_ORIGIN_AUTH) {
  console.error('APP_ORIGIN_AUTH is required but not defined')
  process.exit(1)
}

const SHARED_OPTIONS: Partial<NextAuthOptions> = {
  secret: process.env.APP_SECRET,

  session: {
    strategy: 'jwt',
  },

  jwt: {
    decode,
    encode,
  },
}

function getParticipantConfig({
  requestId,
}: {
  requestId: string
}): NextAuthOptions {
  // Derive shared cookie domain for NextAuth session cookies by removing the first
  // label from the NEXTAUTH_URL hostname (e.g., auth.klicker.com -> klicker.com).
  // Avoid setting Domain for localhost or IPs.
  const cookieDomain: string | undefined = deriveCookieDomainFromURL(
    process.env.NEXTAUTH_URL
  )

  // EduID Provider for Participant Authentication
  const EduIDParticipantProvider: Provider | null =
    typeof process.env.EDUID_CLIENT_SECRET !== 'undefined'
      ? {
          id: process.env.NEXT_PUBLIC_EDUID_ID || 'eduid',
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
                  given_name: { essential: true },
                  family_name: { essential: true },
                  swissEduPersonMatriculationNumber: { essential: false },
                  swissEduIDLinkedAffiliation: { essential: false },
                  swissEduIDLinkedAffiliationMail: { essential: false },
                  swissEduIDLinkedAffiliationUniqueID: { essential: false },
                },
              },
              scope: 'openid email https://login.eduid.ch/authz/User.Read',
            },
          },
          idToken: true,
          checks: ['pkce', 'state'],

          profile(profile) {
            // Ensure we have the required fields for NextAuth
            if (!profile.sub) {
              console.error('Missing sub in EduID profile')
              throw new Error('Missing sub in EduID profile')
            }

            return {
              id: profile.sub, // NextAuth requires an id field
              sub: profile.sub, // Preserve original sub
              email: profile.email || '',
              // Preserve all original profile data for callbacks
              ...profile,
            }
          },
        }
      : null

  return {
    ...SHARED_OPTIONS,

    providers: EduIDParticipantProvider ? [EduIDParticipantProvider] : [],

    cookies: {
      sessionToken: {
        name: PARTICIPANT_COOKIE_NAME,
        options: {
          // Scope cookie to auth host only (no sharing across apps)
          ...(cookieDomain ? { domain: cookieDomain } : {}),
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        },
      },
    },

    callbacks: {
      async signIn({ user, account, profile, email }) {
        console.log(`[AUTH ${requestId}] [participant] signIn`, {
          provider: account?.provider,
          hasProfile: Boolean(profile),
        })

        if (!profile) {
          console.error('No profile provided for participant sign-in')
          return false
        }

        try {
          const participant = await createOrLinkParticipant(
            profile as ExtendedProfile
          )

          if (!participant) {
            console.error(
              'Failed to create/link participant: no participant returned'
            )
            return false
          }
          // Store participantId for jwt callback
          ;(profile as any).participantId = participant.id
          console.log(
            `Participant ${participant.id} authenticated successfully`
          )
          return true
        } catch (error) {
          console.error('Failed to create/link participant:', error)
          return false
        }
      },

      async jwt({ token, profile }) {
        token.scope = UserLoginScope.EDUID
        console.log(`[AUTH ${requestId}] [participant] jwt`, {
          hasProfile: Boolean(profile),
          role: token?.role,
        })

        // Handle initial sign-in with participant profile
        if (profile && (profile as any).participantId) {
          token.sub = (profile as any).participantId
          token.role = 'PARTICIPANT'
          token.email = profile.email
        } else if (token.sub && token.role === 'PARTICIPANT') {
          // Always validate participant exists in database on subsequent calls
          const participant = await prisma.participant.findUnique({
            where: { id: token.sub as string },
          })

          if (!participant) {
            // Participant doesn't exist in current database - invalidate token
            console.warn(
              `Participant ${token.sub} not found in database, invalidating token`
            )
            // Return empty token to force re-authentication
            return { sub: '', role: '', scope: '', email: '', name: '' }
          }

          // Update token with current participant data
          token.role = 'PARTICIPANT'
          token.email = participant.email
        }

        return token
      },

      async redirect({ url, baseUrl }) {
        console.log(`[AUTH ${requestId}] [participant] redirect check`, {
          url,
          baseUrl,
        })
        // Handle relative URLs
        if (url.startsWith('/')) {
          const out = `${baseUrl}${url}`
          console.log(
            `[AUTH ${requestId}] [participant] redirect relative ->`,
            out
          )
          return out
        }

        // Parse and validate against allowed hostnames
        try {
          const parsedUrl = new URL(url)
          const allowedHosts = getStudentHosts()

          if (
            allowedHosts.includes(parsedUrl.host) ||
            allowedHosts.includes(parsedUrl.hostname)
          ) {
            console.log(
              `[AUTH ${requestId}] [participant] redirect allow ->`,
              url
            )
            return url
          }
        } catch {
          // Invalid URL, fall through to baseUrl
        }

        console.log(
          `[AUTH ${requestId}] [participant] redirect fallback ->`,
          baseUrl
        )
        return baseUrl
      },
    },
  }
}

function getLecturerConfig({
  requestId,
}: {
  requestId: string
}): NextAuthOptions {
  // Derive shared cookie domain for NextAuth session cookies by removing the first
  // label from the NEXTAUTH_URL hostname (e.g., auth.klicker.com -> klicker.com).
  // Avoid setting Domain for localhost or IPs.
  const cookieDomain: string | undefined = deriveCookieDomainFromURL(
    process.env.NEXTAUTH_URL
  )

  // EduID Provider for Lecturer Authentication
  const EduIDLecturerProvider: Provider | null =
    typeof process.env.EDUID_CLIENT_SECRET !== 'undefined'
      ? {
          id: process.env.NEXT_PUBLIC_EDUID_ID || 'eduid',
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
                  swissEduIDLinkedAffiliation: { essential: false },
                  swissEduIDLinkedAffiliationMail: { essential: false },
                  swissEduIDLinkedAffiliationUniqueID: { essential: false },
                },
              },
              scope: 'openid email https://login.eduid.ch/authz/User.Read',
            },
          },
          idToken: true,
          checks: ['pkce', 'state'],

          profile(profile) {
            return {
              id: profile.sub,
              email: profile.email,
              shortname: generateRandomString(8),
              lastLoginAt: new Date(),
              catalystInstitutional:
                profile.email?.endsWith('uzh.ch') ||
                profile.swissEduIDLinkedAffiliation?.reduce(
                  reduceCatalyst,
                  false
                ),
            }
          },
        }
      : null

  const CredentialProvider: Provider = CredentialsProvider({
    name: 'Delegation',

    credentials: {
      identifier: {
        label: 'Shortname of Main Account',
        type: 'text',
        placeholder: 'banking23',
        required: true,
        'data-cy': 'identifier-field',
      },
      password: {
        label: 'Password',
        type: 'password',
        required: true,
        'data-cy': 'password-field',
      },
    },

    async authorize(credentials) {
      if (!credentials) return null

      const user = await prisma.user.findUnique({
        where: { shortname: credentials.identifier },
        include: {
          logins: true,
        },
      })

      if (!user) return null

      // go through each login and compare credentials with the login password
      for (let login of user.logins) {
        const isLoginValid = await bcrypt.compare(
          credentials.password,
          login.password
        )

        if (isLoginValid) {
          await prisma.userLogin.update({
            where: { id: login.id },
            data: { lastLoginAt: new Date() },
          })

          return {
            id: user.id,
            email: user.email,
            role: user.role,
            shortname: user.shortname,
            scope: login.scope,
            catalystInstitutional: user.catalystInstitutional,
            catalystIndividual: user.catalystIndividual,
          }
        }
      }

      return null
    },
  })

  return {
    ...SHARED_OPTIONS,

    adapter: PrismaAdapter(prisma),
    providers: EduIDLecturerProvider
      ? [EduIDLecturerProvider, CredentialProvider]
      : [CredentialProvider],

    cookies: {
      sessionToken: {
        name: MANAGER_COOKIE_NAME,
        options: {
          // Scope cookie to auth host only (no sharing across apps)
          ...(cookieDomain ? { domain: cookieDomain } : {}),
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        },
      },
    },

    callbacks: {
      async signIn({ user, account, profile, email }) {
        console.log(`[AUTH ${requestId}] [lecturer] signIn`, {
          provider: account?.provider,
          hasProfile: Boolean(profile),
        })

        // Lecturer authentication flow (existing logic)
        const profileData = profile as ExtendedProfile
        if (profileData?.sub && account?.provider) {
          const userAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: profileData.sub,
              },
            },
          })

          if (userAccount) {
            // existing user login
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
                    )) ??
                  false,
              },
            })

            // upsert affiliations for existing user
            await createUserAffiliations(
              user.id,
              profileData.swissEduIDLinkedAffiliationUniqueID
            )

            if (user.firstLogin) {
              await sendTeamsNotifications(
                'eduId/signUp',
                `User ${user.shortname} with email ${user.email} logged in for the first time.`
              )
            }
          }
        }

        return true
      },

      async jwt({ token, user, profile }) {
        console.log(`[AUTH ${requestId}] [lecturer] jwt`, {
          hasProfile: Boolean(profile),
          hasUser: Boolean(user),
          role: token?.role,
        })
        // Lecturer JWT handling (existing logic)
        const profileData = profile as ExtendedProfile
        const userData = user as ExtendedUser

        if (typeof user !== 'undefined') {
          token.shortname = userData.shortname

          if (typeof profileData?.swissEduPersonUniqueID === 'string') {
            token.scope = UserLoginScope.ACCOUNT_OWNER
          } else {
            token.scope = (user as any).scope as UserLoginScope
          }

          token.catalystInstitutional = userData.catalystInstitutional
          token.catalystIndividual = userData.catalystIndividual
          token.role = userData.role

          // handle the affiliation creation after the creation of the actual user
          if (
            profileData &&
            profileData.swissEduIDLinkedAffiliationUniqueID &&
            userData.id
          ) {
            try {
              await createUserAffiliations(
                userData.id,
                profileData.swissEduIDLinkedAffiliationUniqueID
              )
            } catch (error) {
              console.error(
                'Error creating user affiliations in JWT callback:',
                error
              )
            }
          }
        }

        return token
      },

      async redirect({ url, baseUrl }) {
        console.log(`[AUTH ${requestId}] [lecturer] redirect check`, {
          url,
          baseUrl,
        })
        // Handle relative URLs
        if (url.startsWith('/')) {
          const out = `${baseUrl}${url}`
          console.log(
            `[AUTH ${requestId}] [lecturer] redirect relative ->`,
            out
          )
          return out
        }

        // Parse and validate against allowed hostnames
        try {
          const parsedUrl = new URL(url)
          const allowedHosts = getLecturerHosts()

          if (
            allowedHosts.includes(parsedUrl.host) ||
            allowedHosts.includes(parsedUrl.hostname)
          ) {
            console.log(`[AUTH ${requestId}] [lecturer] redirect allow ->`, url)
            return url
          }
        } catch {
          // Invalid URL, fall through to baseUrl
        }

        console.log(
          `[AUTH ${requestId}] [lecturer] redirect fallback ->`,
          baseUrl
        )
        return baseUrl
      },
    },
  }
}

// Dynamic NextAuth configuration based on context
export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  const headerRequestId = Array.isArray(req.headers['x-request-id'])
    ? req.headers['x-request-id'][0]
    : req.headers['x-request-id']
  const requestId =
    headerRequestId || `na-${crypto.randomBytes(6).toString('hex')}`

  console.log(`[AUTH ${requestId}] Request start`, {
    url: req.url,
    method: req.method,
    ua: req.headers['user-agent'],
  })

  const context = getAuthContext(req, requestId)
  console.log(`[AUTH ${requestId}] Using context: ${context}`)

  // Configure providers based on context
  let authOptions: NextAuthOptions

  if (context === 'participant') {
    authOptions = getParticipantConfig({ requestId })
  } else {
    authOptions = getLecturerConfig({ requestId })
  }

  const handler = NextAuth(authOptions)

  return handler(req, res)
}
