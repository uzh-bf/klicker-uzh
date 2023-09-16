import { UserLoginScope, UserRole } from '@klicker-uzh/prisma'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import JWT from 'jsonwebtoken'
import type { NextAuthOptions, Profile } from 'next-auth'
import NextAuth from 'next-auth'
import { DefaultJWT, JWTDecodeParams, JWTEncodeParams } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import { Provider } from 'next-auth/providers/index'

import prisma from 'src/lib/prisma'

interface ExtendedProfile extends Profile {
  swissEduPersonUniqueID: string
  swissEduIDLinkedAffiliation?: string[]
}

function reduceCatalyst(acc: boolean, affiliation: string) {
  try {
    if (affiliation.split('@')[1].includes('uzh.ch')) {
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
          swissEduIDLinkedAffiliation: { essential: false },
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
      catalystInstitutional: profile.swissEduIDLinkedAffiliation?.reduce(
        reduceCatalyst,
        false
      ),
    }
  },
}

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
          scope: login.scope,
          catalystInstitutional: user.catalystInstitutional,
          catalystIndividual: user.catalystIndividual,
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
    async signIn({ user, account, profile, email }) {
      if (profile?.sub && account?.provider) {
        const userAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: profile.sub,
            },
          },
        })

        if (userAccount) {
          await prisma.user.update({
            where: { id: userAccount.userId },
            data: {
              email: profile.email,
              lastLoginAt: new Date(),
              catalystInstitutional:
                profile.swissEduIDLinkedAffiliation?.reduce<boolean>(
                  reduceCatalyst,
                  false
                ) ?? false,
            },
          })
        }
      }

      return true
    },

    async jwt({ token, user, account, profile }) {
      token.role = UserRole.USER

      if (typeof profile?.swissEduPersonUniqueID === 'string') {
        token.scope = UserLoginScope.ACCOUNT_OWNER
      } else {
        token.scope = (user as any).scope as UserLoginScope
      }

      token.catalystInstitutional = user.catalystInstitutional
      token.catalystIndividual = user.catalystIndividual

      return token
    },
    async redirect({ url, baseUrl }) {
      // allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`
      // allows callback URLs that end with valid klicker domains
      else if (
        url.includes(process.env.COOKIE_DOMAIN as string) ||
        url.includes('127.0.0.1')
      )
        return url
      // return the homepage for all other URLs
      return baseUrl
    },
  },
}

export default NextAuth(authOptions)
