import { UserRole } from '@klicker-uzh/prisma'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcrypt'
import JWT from 'jsonwebtoken'
import type { NextAuthOptions } from 'next-auth'
import NextAuth from 'next-auth'
import { DefaultJWT, JWTDecodeParams, JWTEncodeParams } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
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

const EduIDProvider: Provider = {
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
    }
  },
}

const CredentialProvider: Provider = CredentialsProvider({
  name: 'Delegation',

  credentials: {
    identifier: {
      label: 'Identifier',
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
          scope: login.scope,
        }
      }
    }

    return null
  },
})

export const authOptions: NextAuthOptions = {
  secret: process.env.APP_SECRET,

  adapter: PrismaAdapter(prisma),

  providers: [EduIDProvider, CredentialProvider],
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
        domain: process.env.COOKIE_DOMAIN,
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
        token.scope = (user as any).scope
      }
      return token
    },
    async redirect({ url, baseUrl }) {
      // allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`
      // allows callback URLs that end with valid klicker domains
      else if (url.includes('klicker.local') || url.includes('127.0.0.1'))
        return url
      // return the homepage for all other URLs
      return baseUrl
    },
  },
}

export default NextAuth(authOptions)
