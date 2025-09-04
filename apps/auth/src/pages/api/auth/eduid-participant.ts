import { prisma } from '@klicker-uzh/prisma'
import { UserRole } from '@klicker-uzh/prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import JWT from 'jsonwebtoken'
import type { NextAuthOptions, Profile } from 'next-auth'
import NextAuth, { Account } from 'next-auth'
import { DefaultJWT, JWTDecodeParams, JWTEncodeParams } from 'next-auth/jwt'
import { Provider } from 'next-auth/providers/index'

export const COOKIE_NAME = 'next-auth.participant-session-token'

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
  return JWT.verify(token, secret) as DefaultJWT
}

export async function encode({ token, secret }: JWTEncodeParams) {
  return JWT.sign(token ?? '', secret)
}

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

const EduIDProvider: Provider | null = {
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
    return profile
  },
}

export const authOptions: NextAuthOptions = {
  secret: process.env.APP_SECRET,

  providers: [EduIDProvider],

  session: {
    strategy: 'jwt',
  },

  jwt: {
    decode,
    encode,
  },

  cookies: {
    // csrfToken: {
    //   name: 'next-auth.csrf-token',
    //   options: {
    //     domain: process.env.COOKIE_DOMAIN,
    //     // path: '/',
    //     // httpOnly: true,
    //     // sameSite: 'lax',
    //     // secure: process.env.NODE_ENV === 'production',
    //   },
    // },
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
    async signIn({ profile }) {
      if (!profile) return false

      try {
        // Create or link participant and store reference for jwt callback
        const participant = await createOrLinkParticipant(
          profile as ExtendedProfile
        )
        // Store participantId for jwt callback (temporary solution)
        ;(profile as any).participantId = participant.id
        return true
      } catch (error) {
        console.error('Failed to create/link participant:', error)
        return false
      }
    },

    async jwt({ token, profile }) {
      if (profile && (profile as any).participantId) {
        // Structure token for participant authentication
        token.sub = (profile as any).participantId
        token.role = 'PARTICIPANT'
        token.scope = 'PARTICIPANT'
        token.email = profile.email
      } else if (token.sub && !token.role) {
        // For subsequent calls, look up participant by ID
        const participant = await prisma.participant.findUnique({
          where: { id: token.sub as string },
        })
        if (participant) {
          token.role = 'PARTICIPANT'
          token.scope = 'PARTICIPANT'
          token.email = participant.email
        }
      }
      return token
    },

    async redirect({ url, baseUrl }) {
      // Allow redirects to assessment PWA (production and development)
      if (
        url.includes('assessment.klicker.uzh.ch') ||
        url.includes('assessment.klicker.com') ||
        url.includes('pwa.klicker.com')
      ) {
        return url
      }

      // allows relative callback URLs
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }

      // allows callback URLs that end with valid klicker domains
      if (url.includes(process.env.COOKIE_DOMAIN as string)) {
        return url
      }

      // return the homepage for all other URLs
      return baseUrl
    },
  },
}

export default NextAuth(authOptions)
