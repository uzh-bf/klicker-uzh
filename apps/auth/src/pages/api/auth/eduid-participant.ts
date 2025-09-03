import { UserRole } from '@klicker-uzh/prisma/client'
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

const EduIDProvider: Provider | null =
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
      }
    : null

export const authOptions: NextAuthOptions = {
  secret: process.env.APP_SECRET,

  providers: EduIDProvider,

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
    async signIn({ user, account, profile, email }) {
      return true
    },

    async jwt({ token, user, account, profile, trigger }) {
      return token
    },
    async redirect({ url, baseUrl }) {
      // allows relative callback URLs
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }

      // allows callback URLs that end with valid klicker domains
      if (
        url.includes(process.env.COOKIE_DOMAIN as string) ||
        url.includes('127.0.0.1')
      ) {
        return url
      }

      // return the homepage for all other URLs
      return baseUrl
    },
  },
}

export default NextAuth(authOptions)
