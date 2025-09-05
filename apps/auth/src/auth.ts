import { sendTeamsNotifications } from '@/lib/util'
import { prisma } from '@klicker-uzh/prisma'
import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import bcrypt from 'bcryptjs'
import type { Profile } from 'next-auth'
import NextAuth, { Account } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { Provider } from 'next-auth/providers/index'
import authOptions from './auth.config'

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

const EduIDProvider: Provider | null =
  typeof process.env.EDUID_CLIENT_SECRET !== 'undefined'
    ? {
        id: process.env.NEXT_PUBLIC_EDUID_ID as string,
        // wellKnown: process.env.EDUID_WELL_KNOWN as string,
        clientId: process.env.EDUID_CLIENT_ID as string,
        clientSecret: process.env.EDUID_CLIENT_SECRET as string,
        issuer: 'https://login.test.eduid.ch/',
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authOptions,

  providers: EduIDProvider
    ? [EduIDProvider, CredentialProvider]
    : [CredentialProvider],
  callbacks: {
    async signIn({ user, account, profile, email }) {
      console.log('signIn', user, account, profile, email)

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
})
