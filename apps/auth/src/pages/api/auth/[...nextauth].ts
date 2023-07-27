import { UserRole } from '@klicker-uzh/prisma'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import JWT from 'jsonwebtoken'
import type { NextAuthOptions } from 'next-auth'
import NextAuth from 'next-auth'
import { DefaultJWT, JWTDecodeParams, JWTEncodeParams } from 'next-auth/jwt'
import { Provider } from 'next-auth/providers/index'

import prisma from 'src/lib/prisma'

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
  for (var i = 0; i < length; i++) {
    if (i === 0 || i === length - 1) {
      characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    } else {
      characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    }
    const charactersLength = characters.length
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

export const authOptions: NextAuthOptions = {
  secret: process.env.APP_SECRET,

  adapter: PrismaAdapter(prisma),

  providers: [
    {
      id: process.env.NEXT_PUBLIC_EDUID_ID,
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
          password: bcrypt.hashSync(generateRandomString(8), 10),
          shortname: generateRandomString(8),
          lastLoginAt: new Date(),
        }
      },
    } as Provider,
  ],
  session: {
    strategy: 'jwt',
  },
  jwt: {
    decode,
    encode,
  },
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        domain: 'klicker.local',
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

  callbacks: {
    async jwt({ token, user, account }) {
      // if there are a user and account on the first invocation, we are logging in a user
      // otherwise, the login is related to a participant
      if (user && account) {
        token.role = UserRole.USER
      }
      return token
    },
    async redirect({ url, baseUrl }) {
      // allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`
      // allows callback URLs that end with valid klicker domains
      else if (url.endsWith('klicker.local')) return url
      // return the homepage for all other URLs
      return baseUrl
    },
  },
}

export default NextAuth(authOptions)
