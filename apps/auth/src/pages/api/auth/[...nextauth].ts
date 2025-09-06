import { sendTeamsNotifications } from '@/lib/util'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@klicker-uzh/prisma'
import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import JWT from 'jsonwebtoken'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { NextAuthOptions, Profile } from 'next-auth'
import NextAuth, { Account } from 'next-auth'
import { DefaultJWT, JWTDecodeParams, JWTEncodeParams } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import { Provider } from 'next-auth/providers/index'

export const COOKIE_NAME = 'next-auth.session-token'
export const PARTICIPANT_COOKIE_NAME = 'next-auth.participant-session-token'

// Export for discourse.ts and other consumers
export const APP_SECRET = process.env.APP_SECRET

// Simplified context detection - middleware handles most of the logic
function getAuthContext(req: NextApiRequest): 'lecturer' | 'participant' {
  const { participant, nextauth } = req.query
  const cookies = req.headers.cookie || ''

  console.log('NextAuth context detection:', {
    participant,
    nextauth,
    hasCookie: cookies.includes('auth-context=participant'),
    url: req.url,
    method: req.method,
  })

  // Check for explicit participant auth parameter (set by middleware)
  if (participant === 'true') {
    console.log('Context: participant (middleware param)')
    return 'participant'
  }

  // Check auth context cookie (set by middleware)
  if (cookies.includes('auth-context=participant')) {
    console.log('Context: participant (middleware cookie)')
    return 'participant'
  }

  // Check if this is a participant provider callback/signin
  if (
    Array.isArray(nextauth) &&
    (nextauth.includes('eduid-participant') ||
      (nextauth.includes('callback') &&
        nextauth.includes('eduid-participant')) ||
      (nextauth.includes('signin') && nextauth.includes('eduid-participant')))
  ) {
    console.log('Context: participant (provider route)')
    return 'participant'
  }

  // Default to lecturer authentication
  console.log('Context: lecturer (default)')
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

function reduceCatalyst(acc: boolean, affiliation: string) {
  try {
    const parts = affiliation.split('@')
    if (parts.length < 2) return acc || false

    const domain = parts[1]
    if (domain?.includes('uzh.ch') || domain?.includes('usz.ch')) {
      return true
    }

    return acc || false
  } catch (e) {
    return false
  }
}

export async function decode({ token, secret }: JWTDecodeParams) {
  if (!token) return null
  return JWT.verify(token, secret) as DefaultJWT
}

export async function encode({ token, secret }: JWTEncodeParams) {
  return JWT.sign(token ?? '', secret)
}

function generateRandomString(length: number) {
  let result = ''
  let characters
  for (let i = 0; i < length; i++) {
    if (i === 0 || i === length - 1) {
      characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    } else {
      // TODO: re-introduce allowance for hyphens and underscores again when they are fully supported by manipulation forms
      characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      // 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    }
    const charactersLength = characters.length
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

async function createUserAffiliations(
  userId: string,
  affiliationIds?: string[]
) {
  // if affiliations are present, add corresponding accounts for the user
  if (affiliationIds && affiliationIds.length > 0) {
    for (const affiliationId of affiliationIds) {
      // get provider as the string between @ and .ch
      const parts = affiliationId.split('@')
      if (parts.length < 2) continue

      const domainParts = parts[1]?.split('.')
      if (!domainParts || domainParts.length === 0) continue

      const provider = domainParts[0]
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
        },
        update: {},
      })
    }
  }
}

// Participant authentication helper function
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
  let participant: any = null

  if (profile.email) {
    participant = await prisma.participant.findUnique({
      where: { email: profile.email.toLowerCase() },
    })
  }

  // Create new participant if none exists
  if (!participant) {
    const username = `student_${crypto.randomBytes(4).toString('hex')}`
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

  // Create ParticipantAccount link
  await prisma.participantAccount.create({
    data: {
      ssoType: 'EDUID',
      ssoId: profile.sub as string,
      participant: { connect: { id: participant.id } },
    },
  })

  return participant
}

// Dynamic NextAuth configuration based on context
export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  const context = getAuthContext(req)

  // Configure providers based on context
  let authOptions: NextAuthOptions

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
            id: 'eduid-participant',
            wellKnown: process.env.EDUID_WELL_KNOWN as string,
            clientId: process.env.EDUID_CLIENT_ID as string,
            clientSecret: process.env.EDUID_CLIENT_SECRET as string,

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
                name: profile.email?.split('@')[0] || 'Student',
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
            domain: process.env.COOKIE_DOMAIN,
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
          },
        },
      },

      callbacks: {
        async signIn({ user, account, profile, email }) {
          console.log('signIn', user, account, profile, email)

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
          // Handle initial sign-in with participant profile
          if (profile && (profile as any).participantId) {
            token.sub = (profile as any).participantId
            token.role = 'PARTICIPANT'
            token.scope = 'PARTICIPANT'
            token.email = profile.email
            token.name =
              profile.name || profile.email?.split('@')[0] || 'Student'
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
            token.scope = 'PARTICIPANT'
            token.email = participant.email
            token.name =
              token.name || participant.email?.split('@')[0] || 'Student'
          }

          return token
        },

        async redirect({ url, baseUrl }) {
          if (
            url.includes('assessment.klicker.uzh.ch') ||
            url.includes('assessment.klicker.com')
          ) {
            return url
          }

          if (url.startsWith('/')) {
            return `${baseUrl}${url}`
          }

          if (url.includes(process.env.COOKIE_DOMAIN as string)) {
            return url
          }

          return baseUrl
        },
      },
    }
  } else {
    // EduID Provider for Lecturer Authentication
    const EduIDLecturerProvider: Provider | null =
      typeof process.env.EDUID_CLIENT_SECRET !== 'undefined'
        ? {
            id: process.env.NEXT_PUBLIC_EDUID_ID as string,
            wellKnown: process.env.EDUID_WELL_KNOWN as string,
            clientId: process.env.EDUID_CLIENT_ID as string,
            clientSecret: process.env.EDUID_CLIENT_SECRET as string,

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

      async authorize(credentials, req) {
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
          name: COOKIE_NAME,
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
        async signIn({ user, account, profile, email }) {
          console.log('signIn', user, account, profile, email)

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

        async jwt({ token, user, account, profile, trigger }) {
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
          // Lecturer redirect handling (existing logic)
          if (url.startsWith('/')) {
            return `${baseUrl}${url}`
          }

          if (
            url.includes(process.env.COOKIE_DOMAIN as string) ||
            url.includes('127.0.0.1')
          ) {
            return url
          }

          return baseUrl
        },
      },
    }
  }

  const handler = NextAuth(authOptions)

  return handler(req, res)
}
