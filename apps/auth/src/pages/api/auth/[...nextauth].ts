import { PrismaAdapter } from '@auth/prisma-adapter'
import type { AppLogger } from '@klicker-uzh/logging/node'
import { toSafeError } from '@klicker-uzh/logging/node'
import { resolveRequestContext } from '@klicker-uzh/logging/request'
import { prisma } from '@klicker-uzh/prisma'
import { UserLoginScope } from '@klicker-uzh/prisma/client'
import {
  deriveCookieDomainFromURL,
  generateRandomString,
  reduceCatalyst,
} from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { NextAuthOptions } from 'next-auth'
import type { UserinfoEndpointHandler } from 'next-auth/providers/oauth'
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
import { isSameOriginRedirect } from '@/lib/redirect'
import { logger } from '@/lib/server/logger'
import { sendTeamsNotifications } from '@/lib/util'

// Validate required environment variables
if (!process.env.APP_ORIGIN_AUTH) {
  logger.fatal(
    { event: 'configuration.invalid', variable: 'APP_ORIGIN_AUTH' },
    'Required configuration is missing'
  )
  process.exit(1)
}

// SWITCH edu-ID decides per attribute whether a claim is released in the ID token
// or only from the UserInfo endpoint, and that choice lives in the AAI Resource
// Registry rather than in this repository. NextAuth builds the profile purely from
// the ID token whenever a provider sets `idToken`, so any attribute that edu-ID
// only exposes through UserInfo would silently arrive as undefined.
//
// Setting EDUID_FETCH_USERINFO=true additionally calls the UserInfo endpoint and
// merges its claims over the ID token ones, which makes the Resource Registry's
// ID-token settings irrelevant. The ID token is still validated either way. The
// flag defaults to off so the deployed behaviour only changes when it is set.
const eduIdUserinfo: UserinfoEndpointHandler | undefined =
  process.env.EDUID_FETCH_USERINFO === 'true'
    ? {
        async request({ tokens, client }) {
          // NextAuth types `tokens` with its own loose TokenSet, but what arrives
          // here is the openid-client TokenSet holding the validated ID token.
          const oidcTokens = tokens as unknown as Parameters<
            typeof client.userinfo
          >[0] & { claims: () => Record<string, unknown> }
          return {
            ...oidcTokens.claims(),
            ...(await client.userinfo(oidcTokens)),
          }
        },
      }
    : undefined

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

function getParticipantConfig({ log }: { log: AppLogger }): NextAuthOptions {
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
              // SWITCH edu-ID does not advertise claims_parameter_supported in its
              // discovery document, so this claims request is not honoured: claim
              // release is driven purely by the requested scopes plus the attribute
              // settings registered in the AAI Resource Registry. It is kept as a
              // record of which claims the client depends on. The scope list follows
              // the SWITCH integration guide; `profile` is what releases given_name
              // and family_name, and `User.Read` the swissEduPerson* claims.
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
              scope:
                'openid email profile https://login.eduid.ch/authz/User.Read',
            },
          },
          idToken: true,
          userinfo: eduIdUserinfo,
          checks: ['pkce', 'state'],

          profile(profile) {
            // Ensure we have the required fields for NextAuth
            if (!profile.sub) {
              log.warn(
                {
                  event: 'auth.sign_in.rejected',
                  audience: 'participant',
                  outcome: 'missing_subject',
                },
                'Rejected authentication attempt'
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
        log.info(
          {
            event: 'auth.sign_in.started',
            audience: 'participant',
            providerKind: account?.provider,
          },
          'Participant sign-in started'
        )

        if (!profile) {
          log.warn(
            {
              event: 'auth.sign_in.rejected',
              audience: 'participant',
              outcome: 'missing_profile',
            },
            'Rejected authentication attempt'
          )
          return false
        }

        try {
          const participant = await createOrLinkParticipant(
            profile as ExtendedProfile,
            log
          )

          if (!participant) {
            log.warn(
              {
                event: 'auth.sign_in.rejected',
                audience: 'participant',
                outcome: 'participant_unavailable',
              },
              'Rejected authentication attempt'
            )
            return false
          }
          // Store participantId for jwt callback
          ;(profile as any).participantId = participant.id
          log.info(
            {
              event: 'auth.sign_in.completed',
              audience: 'participant',
              outcome: 'success',
            },
            'Participant sign-in completed'
          )
          return true
        } catch {
          log.error(
            {
              event: 'auth.sign_in.failed',
              audience: 'participant',
              err: toSafeError('Failed to create or link participant'),
            },
            'Participant sign-in failed'
          )
          return false
        }
      },

      async jwt({ token, profile }) {
        token.scope = UserLoginScope.EDUID
        log.debug(
          {
            event: 'auth.token.processed',
            audience: 'participant',
            hasProfile: Boolean(profile),
          },
          'Processed participant token'
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
            log.warn(
              {
                event: 'auth.token.rejected',
                audience: 'participant',
                outcome: 'participant_missing',
              },
              'Rejected participant token'
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
        log.debug(
          { event: 'auth.redirect.checked', audience: 'participant' },
          'Checked participant redirect'
        )
        if (isSameOriginRedirect(url, baseUrl)) {
          return url
        }

        // Handle relative URLs
        if (url.startsWith('/')) {
          const out = `${baseUrl}${url}`
          log.debug(
            { event: 'auth.redirect.accepted', audience: 'participant' },
            'Accepted participant redirect'
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
            log.debug(
              { event: 'auth.redirect.accepted', audience: 'participant' },
              'Accepted participant redirect'
            )
            return url
          }
        } catch {
          // Invalid URL, fall through to baseUrl
        }

        log.warn(
          {
            event: 'auth.redirect.rejected',
            audience: 'participant',
            outcome: 'fallback',
          },
          'Rejected participant redirect'
        )
        return baseUrl
      },
    },
  }
}

function getLecturerConfig({ log }: { log: AppLogger }): NextAuthOptions {
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
          userinfo: eduIdUserinfo,
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
        log.info(
          {
            event: 'auth.sign_in.started',
            audience: 'lecturer',
            providerKind: account?.provider,
          },
          'Lecturer sign-in started'
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
              log
            )

            if (user.firstLogin) {
              await sendTeamsNotifications(
                'eduId/signUp',
                `User ${user.shortname} with email ${user.email} logged in for the first time.`,
                log
              )
            }
          }
        }

        return true
      },

      async jwt({ token, user, profile }) {
        log.debug(
          {
            event: 'auth.token.processed',
            audience: 'lecturer',
            hasProfile: Boolean(profile),
            hasUser: Boolean(user),
          },
          'Processed lecturer token'
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
                log
              )
            } catch {
              log.warn(
                {
                  event: 'auth.affiliation.upsert_failed',
                  err: toSafeError('Failed to create user affiliations'),
                },
                'Failed to create user affiliations'
              )
            }
          }
        }

        return token
      },

      async redirect({ url, baseUrl }) {
        log.debug(
          { event: 'auth.redirect.checked', audience: 'lecturer' },
          'Checked lecturer redirect'
        )
        if (isSameOriginRedirect(url, baseUrl)) {
          return url
        }

        // Handle relative URLs
        if (url.startsWith('/')) {
          const out = `${baseUrl}${url}`
          log.debug(
            { event: 'auth.redirect.accepted', audience: 'lecturer' },
            'Accepted lecturer redirect'
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
            log.debug(
              { event: 'auth.redirect.accepted', audience: 'lecturer' },
              'Accepted lecturer redirect'
            )
            return url
          }
        } catch {
          // Invalid URL, fall through to baseUrl
        }

        log.warn(
          {
            event: 'auth.redirect.rejected',
            audience: 'lecturer',
            outcome: 'fallback',
          },
          'Rejected lecturer redirect'
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
  const requestContext = resolveRequestContext({
    requestId: headerRequestId,
    correlationId: req.headers['x-correlation-id'],
  })
  const requestId = requestContext.requestId
  const log = logger.child(requestContext)
  res.setHeader('x-request-id', requestId)
  res.setHeader('x-correlation-id', requestContext.correlationId)

  log.info(
    { event: 'http.request.started', route: '/api/auth' },
    'Auth request started'
  )

  const context = getAuthContext(req, log)
  log.info(
    { event: 'auth.audience.selected', audience: context },
    'Selected authentication audience'
  )

  // Configure providers based on context
  let authOptions: NextAuthOptions

  if (context === 'participant') {
    authOptions = getParticipantConfig({ log })
  } else {
    authOptions = getLecturerConfig({ log })
  }

  const handler = NextAuth(authOptions)

  return handler(req, res)
}
