import { MANAGER_COOKIE_NAME, PARTICIPANT_COOKIE_NAME } from '@/lib/constants'
import {
  createOrLinkParticipant,
  createUserAffiliations,
  decode,
  encode,
  ExtendedProfile,
  ExtendedUser,
  getAuthContext,
  getLecturerHosts,
  getStudentHosts,
} from '@/lib/helpers'
import type { AppLogger } from '@/lib/logger/base'
import { getLogger } from '@/lib/logger/base'
import { withRequestLogging } from '@/lib/logger/request'
import { sendTeamsNotifications } from '@/lib/util'
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

const bootstrapLogger = getLogger()

// Validate required environment variables
if (!process.env.APP_ORIGIN_AUTH) {
  bootstrapLogger.fatal('APP_ORIGIN_AUTH is required but not defined')
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

function createNextAuthLogger(logger: AppLogger): NextAuthOptions['logger'] {
  return {
    debug(code, metadata) {
      logger.debug({ code, metadata }, 'nextauth debug')
    },
    info(code, metadata) {
      logger.info({ code, metadata }, 'nextauth info')
    },
    error(code, metadata) {
      logger.error({ code, metadata }, 'nextauth error')
    },
    warn(code, metadata) {
      logger.warn({ code, metadata }, 'nextauth warn')
    },
  }
}

function getParticipantConfig({
  logger,
}: {
  logger: AppLogger
}): NextAuthOptions {
  const participantLogger = logger.child({ authContext: 'participant' })
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
              participantLogger.error(
                { profile },
                'missing sub in EduID profile'
              )
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
        const signInLogger = participantLogger.child({ callback: 'signIn' })
        signInLogger.info(
          {
            provider: account?.provider,
            hasProfile: Boolean(profile),
          },
          'participant signIn'
        )

        if (!profile) {
          signInLogger.error('No profile provided for participant sign-in')
          return false
        }

        try {
          const participant = await createOrLinkParticipant(
            profile as ExtendedProfile,
            participantLogger
          )

          if (!participant) {
            signInLogger.error(
              'Failed to create/link participant: no participant returned'
            )
            return false
          }

          // Store participantId for jwt callback
          ;(profile as any).participantId = participant.id
          signInLogger.info(
            { participantId: participant.id },
            'participant authenticated successfully'
          )
          return true
        } catch (error) {
          signInLogger.error(
            { err: error },
            'Failed to create/link participant'
          )
          return false
        }
      },

      async jwt({ token, profile }) {
        const jwtLogger = participantLogger.child({ callback: 'jwt' })
        token.scope = UserLoginScope.EDUID
        jwtLogger.info(
          {
            hasProfile: Boolean(profile),
            role: token?.role,
          },
          'participant jwt'
        )

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
            jwtLogger.warn(
              {
                participantId: token.sub,
              },
              'participant not found in database; invalidating token'
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
        const redirectLogger = participantLogger.child({ callback: 'redirect' })
        redirectLogger.info({ url, baseUrl }, 'participant redirect check')
        // Handle relative URLs
        if (url.startsWith('/')) {
          const out = `${baseUrl}${url}`
          redirectLogger.info(
            { resolvedUrl: out },
            'participant redirect relative'
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
            redirectLogger.info(
              { resolvedUrl: url },
              'participant redirect allowed'
            )
            return url
          }
        } catch (error) {
          redirectLogger.warn(
            { err: error, url },
            'invalid participant redirect URL; falling back to baseUrl'
          )
        }

        redirectLogger.info(
          { fallback: baseUrl },
          'participant redirect fallback'
        )
        return baseUrl
      },
    },
  }
}

function getLecturerConfig({ logger }: { logger: AppLogger }): NextAuthOptions {
  const lecturerLogger = logger.child({ authContext: 'lecturer' })
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
        const signInLogger = lecturerLogger.child({ callback: 'signIn' })
        signInLogger.info(
          {
            provider: account?.provider,
            hasProfile: Boolean(profile),
          },
          'lecturer signIn'
        )

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
              profileData.swissEduIDLinkedAffiliationUniqueID,
              lecturerLogger
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
        const jwtLogger = lecturerLogger.child({ callback: 'jwt' })
        jwtLogger.info(
          {
            hasProfile: Boolean(profile),
            hasUser: Boolean(user),
            role: token?.role,
          },
          'lecturer jwt'
        )
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
                profileData.swissEduIDLinkedAffiliationUniqueID,
                lecturerLogger
              )
            } catch (error) {
              jwtLogger.error(
                { err: error, userId: userData.id },
                'error creating user affiliations in JWT callback'
              )
            }
          }
        }

        return token
      },

      async redirect({ url, baseUrl }) {
        const redirectLogger = lecturerLogger.child({ callback: 'redirect' })
        redirectLogger.info({ url, baseUrl }, 'lecturer redirect check')
        // Handle relative URLs
        if (url.startsWith('/')) {
          const out = `${baseUrl}${url}`
          redirectLogger.info(
            { resolvedUrl: out },
            'lecturer redirect relative'
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
            redirectLogger.info(
              { resolvedUrl: url },
              'lecturer redirect allowed'
            )
            return url
          }
        } catch (error) {
          redirectLogger.warn(
            { err: error, url },
            'invalid lecturer redirect URL; falling back to baseUrl'
          )
        }

        redirectLogger.info({ fallback: baseUrl }, 'lecturer redirect fallback')
        return baseUrl
      },
    },
  }
}

// Dynamic NextAuth configuration based on context
async function authHandler(req: NextApiRequest, res: NextApiResponse) {
  const headerRequestId = Array.isArray(req.headers['x-request-id'])
    ? req.headers['x-request-id'][0]
    : req.headers['x-request-id']
  const generatedRequestId = `na-${crypto.randomBytes(6).toString('hex')}`
  const requestId =
    ((req as any).requestId as string | undefined) ??
    headerRequestId ??
    generatedRequestId

  const baseLogger =
    ((req as any).logger as AppLogger | undefined) ??
    getLogger().child({
      context: 'nextauth',
      method: req.method,
      url: req.url,
      requestId,
    })

  ;(req as any).logger = baseLogger
  ;(req as any).requestId = requestId

  const requestLogger = baseLogger.child({ route: 'api/auth/[...nextauth]' })

  const context = getAuthContext(req, requestLogger)
  requestLogger.info({ context }, 'resolved auth context')

  // Configure providers based on context
  const authOptions =
    context === 'participant'
      ? getParticipantConfig({ logger: requestLogger })
      : getLecturerConfig({ logger: requestLogger })

  const handler = NextAuth({
    ...authOptions,
    logger: createNextAuthLogger(requestLogger),
  })

  return handler(req, res)
}

export default withRequestLogging(authHandler, { context: 'nextauth' })
