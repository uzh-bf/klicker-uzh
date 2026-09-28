import { PrismaAdapter } from '@auth/prisma-adapter'
import type { AppLogger } from '@klicker-uzh/logging/node'
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
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import type { Provider } from 'next-auth/providers/index'
import type { UserinfoEndpointHandler } from 'next-auth/providers/oauth'
import {
  type AuthAudience,
  audienceCookieNames,
  audienceCookieOptions,
  resolveSecureCookies,
} from '@/lib/authCookies'
import { MANAGER_COOKIE_NAME, PARTICIPANT_COOKIE_NAME } from '@/lib/constants'
import {
  isProviderErrorCallback,
  parseAuthAction,
  resolveCallbackAudience,
  resolveInitiationAudience,
} from '@/lib/dispatch'
import {
  authServiceBaseUrl,
  installParticipantFailureRecovery,
  participantRestartTarget,
} from '@/lib/errorRecovery'
import {
  createOrLinkParticipant,
  createUserAffiliations,
  type ExtendedProfile,
  type ExtendedUser,
  getLecturerHosts,
  getStudentHosts,
} from '@/lib/helpers'
import { decode as jwtDecode, encode as jwtEncode } from '@/lib/jwt'
import { isSameOriginRedirect } from '@/lib/redirect'
import { hostFromUrl, validateRedirectTarget } from '@/lib/redirectTarget'
import { logger } from '@/lib/server/logger'
import { authEvent } from '@/lib/telemetry'
import { sendTeamsNotifications } from '@/lib/util'

// Validate required environment variables
if (!process.env.APP_ORIGIN_AUTH) {
  console.error('APP_ORIGIN_AUTH is required but not defined')
  process.exit(1)
}

function eduIdProviderId(): string {
  return process.env.NEXT_PUBLIC_EDUID_ID || 'eduid'
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
    // Salt-bearing calls (temporary OAuth cookies) delegate to next-auth's
    // default A256GCM implementation keyed by (secret, salt); salt-free calls
    // keep the HS256 session contract the backend verifies.
    decode: jwtDecode,
    encode: jwtEncode,
  },
}

function secureCookies(): boolean {
  return resolveSecureCookies(
    process.env.NEXTAUTH_URL,
    process.env.AUTH_SECURE_COOKIES
  )
}

function participantFallbackUrl(): string {
  return (
    process.env.NEXT_PUBLIC_ASSESSMENT_URL ||
    'https://assessment.klicker.uzh.ch'
  )
}

// The audience-specific callback-URL cookie is the only stored destination the
// library consults on an OAuth callback (core/lib/callback-url.js). Without a
// valid stored value it keeps the auth origin — the lecturer-facing homepage —
// and never calls the application redirect callback, so the participant
// fallback there cannot run. Supplying the verified destination as the request
// parameter routes every successful participant callback through the
// participant redirect callback and gives a missing or invalid stored value the
// assessment root instead of the auth homepage. The value is always computed
// here; client-supplied parameters are stripped before dispatch.
function participantReturnTarget({
  requestId,
  secure,
  storedTarget,
}: {
  requestId: string
  secure: boolean
  storedTarget: string | undefined
}): string {
  const validation = validateRedirectTarget(storedTarget, getStudentHosts(), {
    secure,
  })

  if (validation.ok && validation.url) {
    authEvent('auth.callback_destination', requestId, {
      audience: 'participant',
      outcome: 'stored',
      destinationHost: hostFromUrl(validation.url),
    })
    return validation.url
  }

  const fallback = participantFallbackUrl()
  authEvent('auth.callback_destination', requestId, {
    audience: 'participant',
    outcome: 'default',
    destinationHost: hostFromUrl(fallback),
    errorCategory: validation.reason,
  })
  return fallback
}

function getParticipantConfig({
  requestId,
  log,
}: {
  requestId: string
  log: AppLogger
}): NextAuthOptions {
  // Derive shared cookie domain for NextAuth session cookies by removing the first
  // label from the NEXTAUTH_URL hostname (e.g., auth.klicker.com -> klicker.com).
  // Avoid setting Domain for localhost or IPs.
  const cookieDomain: string | undefined = deriveCookieDomainFromURL(
    process.env.NEXTAUTH_URL
  )
  const secure = secureCookies()

  // EduID Provider for Participant Authentication
  const EduIDParticipantProvider: Provider | null =
    typeof process.env.EDUID_CLIENT_SECRET !== 'undefined'
      ? {
          id: eduIdProviderId(),
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

    useSecureCookies: secure,

    providers: EduIDParticipantProvider ? [EduIDParticipantProvider] : [],

    cookies: {
      // Temporary OAuth cookies are namespaced per audience so overlapping
      // participant and lecturer attempts cannot overwrite each other.
      ...audienceCookieOptions('participant', secure),
      sessionToken: {
        name: PARTICIPANT_COOKIE_NAME,
        options: {
          // Scope cookie to auth host only (no sharing across apps)
          ...(cookieDomain ? { domain: cookieDomain } : {}),
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure,
        },
      },
    },

    callbacks: {
      async signIn({ user, account, profile, email }) {
        authEvent('auth.account_handling', requestId, {
          audience: 'participant',
          outcome: 'start',
          providerId: account?.provider,
        })

        if (!profile) {
          console.error('No profile provided for participant sign-in')
          return false
        }

        try {
          const participant = await createOrLinkParticipant(
            profile as ExtendedProfile,
            log
          )

          if (!participant) {
            console.error(
              'Failed to create/link participant: no participant returned'
            )
            return false
          }
          // Store participantId for jwt callback
          ;(profile as any).participantId = participant.id
          authEvent('auth.account_handling', requestId, {
            audience: 'participant',
            outcome: 'linked',
          })
          return true
        } catch (error) {
          console.error('Failed to create/link participant:', error)
          return false
        }
      },

      async jwt({ token, profile }) {
        token.scope = UserLoginScope.EDUID

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
        // Relative paths stay supported for internal hand-offs. The auth
        // service's own homepage is deliberately excluded: it renders the
        // lecturer login, so an assessment login must never return there.
        if (url.startsWith('/') && url !== '/') {
          const out = `${baseUrl}${url}`
          return out
        }

        // Parse and validate against allowed student hosts
        const validation = validateRedirectTarget(url, getStudentHosts(), {
          secure: secureCookies(),
        })
        if (validation.ok && validation.url) {
          authEvent('auth.redirect', requestId, {
            audience: 'participant',
            destinationHost: hostFromUrl(validation.url),
            outcome: 'allowed',
          })
          return validation.url
        }

        // A failed participant authentication must fall back to the
        // participant journey root, never to manage or the auth homepage.
        const fallback = participantFallbackUrl()
        authEvent('auth.redirect', requestId, {
          audience: 'participant',
          destinationHost: hostFromUrl(fallback),
          outcome: 'fallback',
          errorCategory: validation.reason,
        })
        return fallback
      },
    },
  }
}

function getLecturerConfig({
  requestId,
  log,
}: {
  requestId: string
  log: AppLogger
}): NextAuthOptions {
  // Derive shared cookie domain for NextAuth session cookies by removing the first
  // label from the NEXTAUTH_URL hostname (e.g., auth.klicker.com -> klicker.com).
  // Avoid setting Domain for localhost or IPs.
  const cookieDomain: string | undefined = deriveCookieDomainFromURL(
    process.env.NEXTAUTH_URL
  )
  const secure = secureCookies()

  // EduID Provider for Lecturer Authentication
  const EduIDLecturerProvider: Provider | null =
    typeof process.env.EDUID_CLIENT_SECRET !== 'undefined'
      ? {
          id: eduIdProviderId(),
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
      for (const login of user.logins) {
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

    useSecureCookies: secure,

    adapter: PrismaAdapter(prisma),
    providers: EduIDLecturerProvider
      ? [EduIDLecturerProvider, CredentialProvider]
      : [CredentialProvider],

    cookies: {
      ...audienceCookieOptions('lecturer', secure),
      sessionToken: {
        name: MANAGER_COOKIE_NAME,
        options: {
          // Scope cookie to auth host only (no sharing across apps)
          ...(cookieDomain ? { domain: cookieDomain } : {}),
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure,
        },
      },
    },

    callbacks: {
      async signIn({ user, account, profile, email }) {
        authEvent('auth.account_handling', requestId, {
          audience: 'lecturer',
          outcome: 'start',
          providerId: account?.provider,
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
              profileData.swissEduIDLinkedAffiliationUniqueID,
              log
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
        if (isSameOriginRedirect(url, baseUrl)) {
          return url
        }

        // Handle relative URLs (preserves internal handoffs such as
        // /discourse_handoff supplied by NextAuth as a same-origin path)
        if (url.startsWith('/')) {
          const out = `${baseUrl}${url}`
          return out
        }

        // Parse and validate against allowed lecturer hosts
        const validation = validateRedirectTarget(url, getLecturerHosts(), {
          secure: secureCookies(),
        })
        if (validation.ok && validation.url) {
          authEvent('auth.redirect', requestId, {
            audience: 'lecturer',
            destinationHost: hostFromUrl(validation.url),
            outcome: 'allowed',
          })
          return validation.url
        }

        const fallback = baseUrl
        authEvent('auth.redirect', requestId, {
          audience: 'lecturer',
          destinationHost: hostFromUrl(fallback),
          outcome: 'fallback',
          errorCategory: validation.reason,
        })
        return fallback
      },
    },
  }
}

function sendRestartRedirect(res: NextApiResponse) {
  res.writeHead(302, { Location: '/restart' })
  res.end()
}

// Dynamic NextAuth configuration based on strictly resolved transaction context.
//
// The intended account audience is resolved once per request:
//  - OAuth callbacks (eduid) from the audience-namespaced state cookies only.
//    Missing, expired, malformed, duplicated or contradictory context fails
//    safely to the neutral restart page without any account handling. The same
//    resolution covers a provider error response: a verified participant is
//    returned to the participant restart page with the bounded error code,
//    while lecturer and unverified attempts stay neutral.
//  - Initiation (signin/signout) from the explicit audience parameter.
//  - Generic actions (session, csrf, providers, error) stay on the lecturer
//    configuration; participants use /api/student-session instead.
// A participant callback destination is resolved from verified stored state
// with the assessment root as its default, and a failure inside the library is
// returned to the participant restart page instead of the generic sign-in
// journey (see lib/errorRecovery.ts and participantReturnTarget above).
// Callback-supplied audience/target parameters are stripped before the
// handler runs so a query can never replace verified transaction context.
export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  const startedAt = Date.now()
  const requestContext = resolveRequestContext({
    requestId: req.headers['x-request-id'],
    correlationId: req.headers['x-correlation-id'],
  })
  const requestId = requestContext.requestId
  res.setHeader('x-request-id', requestId)
  res.setHeader('x-correlation-id', requestContext.correlationId)
  const log = logger.child(requestContext)

  const { nextauth, ...query } = req.query as { nextauth?: string[] } & Record<
    string,
    string | string[] | undefined
  >
  const { action, providerId } = parseAuthAction(nextauth)

  authEvent('auth.request', requestId, {
    action,
    providerId,
    method: req.method,
    path: req.url?.split('?')[0],
  })

  if (action === 'callback' && providerId === eduIdProviderId()) {
    // Never let callback query parameters override verified context.
    delete req.query.participant
    delete req.query.callbackUrl

    const secure = secureCookies()
    const resolution = await resolveCallbackAudience({
      query,
      cookies: req.cookies,
      expectedProviderId: eduIdProviderId(),
      candidates: [
        {
          audience: 'participant',
          stateCookieName: audienceCookieNames('participant', secure).state,
        },
        {
          audience: 'lecturer',
          stateCookieName: audienceCookieNames('lecturer', secure).state,
        },
      ],
      decodeStateCookie: async (token, salt) =>
        jwtDecode({
          token,
          salt,
          secret: process.env.APP_SECRET ?? '',
        }),
    })

    if (isProviderErrorCallback(query)) {
      // Provider errors still echo state. Keep verified participant recovery
      // without exchanging a code or logging provider-supplied diagnostics.
      authEvent('auth.callback_rejected', requestId, {
        audience: resolution.audience,
        providerId,
        outcome: 'provider_error',
        errorCategory:
          resolution.audience === null ? resolution.reason : undefined,
        elapsedMs: Date.now() - startedAt,
      })

      if (resolution.audience === 'participant') {
        res.writeHead(302, {
          Location: participantRestartTarget(
            typeof query.error === 'string' ? query.error : undefined
          ),
        })
        res.end()
        return
      }

      return sendRestartRedirect(res)
    }

    if (!resolution.audience) {
      authEvent('auth.callback_rejected', requestId, {
        audience: null,
        providerId,
        outcome: resolution.reason,
        elapsedMs: Date.now() - startedAt,
      })
      return sendRestartRedirect(res)
    }

    authEvent('auth.callback_context', requestId, {
      audience: resolution.audience,
      providerId,
      outcome: 'resolved',
      elapsedMs: Date.now() - startedAt,
    })

    if (resolution.audience === 'participant') {
      req.query.callbackUrl = participantReturnTarget({
        requestId,
        secure,
        storedTarget:
          req.cookies[audienceCookieNames('participant', secure).callbackUrl],
      })
    }

    return runAudienceConfig(resolution.audience)
  }

  const audience = resolveInitiationAudience({
    action,
    providerId,
    query: req.query as Record<string, string | string[] | undefined>,
  })

  if (!audience) {
    authEvent('auth.initiation_rejected', requestId, {
      action,
      providerId,
      outcome: 'contradictory_audience',
    })
    res.status(400).end()
    return
  }

  authEvent('auth.initiation', requestId, {
    action,
    providerId,
    audience,
  })
  return runAudienceConfig(audience)

  function runAudienceConfig(audience: AuthAudience) {
    const authOptions =
      audience === 'participant'
        ? getParticipantConfig({ requestId, log })
        : getLecturerConfig({ requestId, log })

    if (audience === 'participant') {
      // A failure inside the library returns a redirect to its generic
      // endpoints instead of throwing, so participant recovery has to happen on
      // the response rather than in a try/catch around the handler.
      const authBase = authServiceBaseUrl(req.headers)
      installParticipantFailureRecovery(res, {
        authBase,
        onRewrite: (from, to) => {
          authEvent('auth.failure_recovery', requestId, {
            audience: 'participant',
            outcome: 'participant_restart',
            path: to,
            errorCategory:
              new URL(from, authBase).searchParams.get('error') ?? undefined,
          })
        },
      })
    }

    const handler = NextAuth(authOptions)
    return handler(req, res)
  }
}
