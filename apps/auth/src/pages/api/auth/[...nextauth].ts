import {
  DEFAULT_LECTURER_HOSTS,
  DEFAULT_STUDENT_HOSTS,
  LECTURER_REDIRECT_COOKIE_NAME,
  MANAGER_COOKIE_NAME,
  PARTICIPANT_COOKIE_NAME,
  STUDENT_REDIRECT_COOKIE_NAME,
} from '@/lib/constants'
import { sendTeamsNotifications } from '@/lib/util'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@klicker-uzh/prisma'
import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import {
  collectAllEmails,
  deriveCookieDomainFromURL,
  extractProviderFromAffiliationId,
  generateRandomString,
  JWTPayload,
  parseCookiesHeader,
  parseCsvHosts,
  reduceCatalyst,
  signJWT,
  verifyJWT,
} from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { NextAuthOptions, Profile } from 'next-auth'
import NextAuth, { Account } from 'next-auth'
import { DefaultJWT, JWTDecodeParams, JWTEncodeParams } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import { Provider } from 'next-auth/providers/index'

// Validate required environment variables
if (!process.env.APP_ORIGIN_AUTH) {
  console.error('APP_ORIGIN_AUTH is required but not defined')
  process.exit(1)
}

// Context detection: prefer explicit URL params and paths; fall back to
// referer and an ephemeral redirect cookie set by middleware on signin.

function getStudentHosts(): string[] {
  const env = parseCsvHosts(process.env.AUTH_STUDENT_ALLOWED_HOSTS)
  return env.length ? env : DEFAULT_STUDENT_HOSTS
}
function getLecturerHosts(): string[] {
  const env = parseCsvHosts(process.env.AUTH_LECTURER_ALLOWED_HOSTS)
  return env.length ? env : DEFAULT_LECTURER_HOSTS
}

function isAssessmentHost(host: string): boolean {
  return getStudentHosts().includes(host)
}

function isManageHost(host: string): boolean {
  return getLecturerHosts().includes(host)
}

function getAuthContext(
  req: NextApiRequest,
  reqId: string
): 'lecturer' | 'participant' {
  const { participant, callbackUrl } = req.query as {
    participant?: string
    callbackUrl?: string
  }
  const cookies = parseCookiesHeader(req.headers.cookie)
  const studentRedirect = cookies[STUDENT_REDIRECT_COOKIE_NAME]
  const lecturerRedirect = cookies[LECTURER_REDIRECT_COOKIE_NAME]

  const hostFrom = (val?: string) => {
    if (!val) return null
    try {
      return new URL(val).host
    } catch {
      return null
    }
  }

  const hosts = {
    student: hostFrom(studentRedirect),
    lecturer: hostFrom(lecturerRedirect),
    callback: hostFrom(callbackUrl),
  }

  console.log(`[AUTH ${reqId}] Context detection input:`, {
    url: req.url,
    method: req.method,
    participant,
    hasStudentCookie: Boolean(studentRedirect),
    hasLecturerCookie: Boolean(lecturerRedirect),
    hosts,
  })

  // 1) Explicit participant flag wins
  if (participant === 'true') {
    console.log(`[AUTH ${reqId}] Context: participant (explicit param)`)
    return 'participant'
  }

  // 2) callbackUrl host is authoritative when present
  if (hosts.callback) {
    if (isAssessmentHost(hosts.callback)) {
      console.log(`[AUTH ${reqId}] Context: participant (callbackUrl host)`)
      return 'participant'
    }
    if (isManageHost(hosts.callback)) {
      console.log(`[AUTH ${reqId}] Context: lecturer (callbackUrl host)`)
      return 'lecturer'
    }
  }

  // 3) Specific cookies (student first)
  if (hosts.student && isAssessmentHost(hosts.student)) {
    console.log(`[AUTH ${reqId}] Context: participant (student cookie host)`)
    return 'participant'
  }
  if (hosts.lecturer && isManageHost(hosts.lecturer)) {
    console.log(`[AUTH ${reqId}] Context: lecturer (lecturer cookie host)`)
    return 'lecturer'
  }

  // 4) Default to lecturer
  console.log(`[AUTH ${reqId}] Context: lecturer (default)`)
  return 'lecturer'
}

export interface ExtendedProfile extends Profile {
  swissEduPersonUniqueID: string
  swissEduIDLinkedAffiliation?: string[]
  swissEduIDLinkedAffiliationMail?: string[]
  swissEduIDLinkedAffiliationUniqueID?: string[]
}

export interface ExtendedAccount extends Account {
  affiliationIds?: string[]
}

export interface ExtendedUser {
  id: string
  email: string
  role: UserRole
  shortname: string
  scope: string
  catalystInstitutional: boolean
  catalystIndividual: boolean
}

export async function decode({ token, secret }: JWTDecodeParams) {
  if (!token) return null
  const secretString = typeof secret === 'string' ? secret : secret.toString()
  return (await verifyJWT(token, secretString)) as DefaultJWT
}

export async function encode({ token, secret }: JWTEncodeParams) {
  const secretString = typeof secret === 'string' ? secret : secret.toString()

  return signJWT((token as JWTPayload) ?? {}, secretString, {
    issuer: process.env.APP_ORIGIN_AUTH,
  })
}

// extractProviderFromAffiliationId moved to @klicker-uzh/util

// generateRandomString moved to @klicker-uzh/util

async function autoAcceptInvitations(emails: string[], participantId?: string) {
  let matchingParticipantId: string | undefined = participantId

  try {
    if (!participantId) {
      // Find participant account for any of the provided emails
      const participant = await prisma.participant.findFirst({
        where: {
          email: {
            in: emails.map((email) => email.toLowerCase()),
          },
        },
      })

      if (!participant) {
        console.log('No participant found for emails:', emails)
        return 0
      }

      matchingParticipantId = participant.id
    }

    // Find all pending invitations for any of the provided emails
    const pendingInvitations = await prisma.participantInvitation.findMany({
      where: {
        email: { in: emails.map((email) => email.toLowerCase()) },
        status: 'PENDING',
      },
    })

    console.log(
      `Found ${pendingInvitations.length} pending invitations for emails:`,
      emails
    )

    let acceptedCount = 0
    for (const invitation of pendingInvitations) {
      try {
        await prisma.$transaction(async (tx) => {
          // Create or activate participation
          await tx.participation.upsert({
            where: {
              courseId_participantId: {
                courseId: invitation.courseId,
                participantId: matchingParticipantId!,
              },
            },
            create: {
              courseId: invitation.courseId,
              participantId: matchingParticipantId!,
              isActive: false,
            },
            update: {},
          })

          // Mark invitation as accepted
          await tx.participantInvitation.update({
            where: { id: invitation.id },
            data: {
              status: 'ACCEPTED',
              participantId,
              acceptedAt: new Date(),
            },
          })
        })

        acceptedCount++
      } catch (error) {
        console.error(`Error accepting invitation ${invitation.id}:`, error)
      }
    }

    if (acceptedCount > 0) {
      await sendTeamsNotifications(
        'auth/invitationAutoAccept',
        `User with emails [${emails.join(', ')}] was automatically enrolled in ${acceptedCount} course(s) via invitations.`
      )
    }

    return acceptedCount
  } catch (error) {
    console.error('Error in autoAcceptInvitations:', error)
    return 0
  }
}

// Helper function to create user affiliations
async function createUserAffiliations(
  userId: string,
  affiliationIds?: string[]
) {
  // if affiliations are present, add corresponding accounts for the user
  if (affiliationIds && affiliationIds.length > 0) {
    for (const affiliationId of affiliationIds) {
      try {
        const provider = extractProviderFromAffiliationId(affiliationId)
        if (!provider) continue

        // upsert accounts for every affiliation
        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider,
              providerAccountId: affiliationId,
            },
          },
          create: {
            provider,
            providerAccountId: affiliationId,
            user: { connect: { id: userId } },
            type: 'affiliation',
            isVerified: true, // SSO affiliations are auto-verified
            isPrimary: false, // New affiliations are never primary by default
          },
          update: {
            isVerified: true, // Update verification status for SSO
          },
        })
      } catch (error) {
        console.error(`Failed to add affiliation ${affiliationId}:`, error)
        // Continue with other affiliations
      }
    }
  }
}

// Helper function to create participant affiliations
async function createParticipantAffiliations(
  participantId: string,
  affiliationIds: string[],
  affiliationEmails?: string[] // Make emails optional
) {
  let processedAffiliations = new Set<string>()

  for (let i = 0; i < affiliationIds.length; i++) {
    const affiliationId = affiliationIds[i]
    const affiliationEmail = affiliationEmails?.[i]?.toLowerCase() || null

    if (!affiliationId) continue // Only skip if ID is missing

    try {
      const provider = extractProviderFromAffiliationId(affiliationId)
      if (!provider) continue

      // upsert participant accounts for every affiliation
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
          ssoEmail: affiliationEmail, // Store email if available
          participant: { connect: { id: participantId } },
          type: 'affiliation',
          isVerified: true, // SSO affiliations are auto-verified
          isPrimary: false, // New affiliations are never primary by default
        },
        update: {
          ssoEmail: affiliationEmail, // Update email if changed (can be null)
          isVerified: true, // Update verification status for SSO
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

// Enhanced participant authentication helper function
async function createOrLinkParticipant(profile: ExtendedProfile) {
  // Lookup existing account via ssoId (Edu-ID sub)
  const existing = await prisma.participantAccount.findUnique({
    where: { ssoId: profile.sub },
    include: { participant: true },
  })

  if (existing) {
    // Update affiliations for existing participant
    if (profile.swissEduIDLinkedAffiliationUniqueID) {
      const participantAffiliations = await createParticipantAffiliations(
        existing.participantId,
        profile.swissEduIDLinkedAffiliationUniqueID,
        profile.swissEduIDLinkedAffiliationMail // Pass undefined if not available
      )
    }

    // auto-accept invitations for existing users
    try {
      // Extract all relevant emails for invitation checking
      const allEmails = collectAllEmails(
        profile.email,
        profile.swissEduIDLinkedAffiliationMail
      )

      const acceptedCount = await autoAcceptInvitations(
        allEmails,
        existing.participantId
      )
      console.log(
        `Auto-accepted ${acceptedCount} invitations for existing user with emails:`,
        allEmails
      )
    } catch (error) {
      console.error(
        'Error auto-accepting invitations for existing user:',
        error
      )
    }

    await prisma.participant.update({
      where: { id: existing.participantId },
      data: { lastLoginAt: new Date() },
    })

    return existing.participant
  }

  // Check for existing participant by any affiliation (including primary email)
  let participant: any = null
  if (profile.email) {
    // Try to find by primary email first
    participant = await prisma.participant.findUnique({
      where: {
        email_isSSOAccount: {
          email: profile.email.toLowerCase(),
          isSSOAccount: true,
        },
      },
    })

    // If not found by primary email, check affiliations
    if (!participant) {
      const affiliatedAccount = await prisma.participantAccount.findFirst({
        where: {
          type: 'affiliation',
          ssoId: profile.email.toLowerCase(),
          isVerified: true,
        },
        include: { participant: true },
      })

      if (affiliatedAccount) {
        participant = affiliatedAccount.participant
      }
    }
  }

  // Create new participant if none exists
  if (!participant) {
    const username = generateRandomString(10)
    participant = await prisma.participant.create({
      data: {
        username,
        email: profile.email?.toLowerCase(),
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        isEmailValid: true, // Edu-ID emails are pre-validated
        isSSOAccount: true,
        lastLoginAt: new Date(),
      },
    })
  }

  // Create enhanced ParticipantAccount link
  await prisma.participantAccount.create({
    data: {
      ssoType: 'EDUID',
      ssoId: profile.sub as string,
      ssoEmail: profile.email?.toLowerCase(), // Store primary email
      participant: { connect: { id: participant.id } },
      type: 'sso',
      isVerified: true, // SSO accounts are pre-verified
      isPrimary: true, // SSO accounts are not necessarily primary
    },
  })

  // Add affiliations for participant
  if (profile.swissEduIDLinkedAffiliationUniqueID) {
    await createParticipantAffiliations(
      participant.id,
      profile.swissEduIDLinkedAffiliationUniqueID,
      profile.swissEduIDLinkedAffiliationMail
    )
  }

  // auto-accept invitations for newly created participants
  try {
    // Extract all relevant emails for invitation checking
    const allEmails = collectAllEmails(
      profile.email,
      profile.swissEduIDLinkedAffiliationMail
    )

    const acceptedCount = await autoAcceptInvitations(allEmails, participant.id)
    console.log(
      `Auto-accepted ${acceptedCount} invitations for new participant with emails:`,
      allEmails
    )
  } catch (error) {
    console.error(
      'Error auto-accepting invitations for new participant:',
      error
    )
  }

  return participant
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

  // Derive shared cookie domain for NextAuth session cookies by removing the first
  // label from the NEXTAUTH_URL hostname (e.g., auth.klicker.com -> klicker.com).
  // Avoid setting Domain for localhost or IPs.
  const cookieDomain: string | undefined = (() => {
    return deriveCookieDomainFromURL(process.env.NEXTAUTH_URL)
  })()

  let sharedOptions: Partial<NextAuthOptions> = {
    secret: process.env.APP_SECRET,

    session: {
      strategy: 'jwt',
    },

    jwt: {
      decode,
      encode,
    },
  }

  if (context === 'participant') {
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
                console.error('Missing sub in EduID profile:', profile)
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

    authOptions = {
      ...sharedOptions,

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
  } else {
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

    authOptions = {
      ...sharedOptions,

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
              console.log(
                `[AUTH ${requestId}] [lecturer] redirect allow ->`,
                url
              )
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

  const handler = NextAuth(authOptions)

  return handler(req, res)
}
