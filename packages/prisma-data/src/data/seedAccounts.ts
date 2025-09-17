import * as Prisma from '@klicker-uzh/prisma/client'
import { USER_ID_TEST } from './constants.js'

export async function seedAccounts(prisma: Prisma.PrismaClient) {
  const standardUser = await prisma.user.findUnique({
    where: { id: USER_ID_TEST },
  })

  if (!standardUser) {
    throw new Error(`User with id ${USER_ID_TEST} not found`)
  }

  const account = await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: 'eduid',
        providerAccountId: standardUser.id,
      },
    },
    create: {
      user: { connect: { id: standardUser.id } },
      type: 'oauth',
      provider: 'eduid',
      providerAccountId: '29440fb7-5347-4244-a83a-7ce8379d80e4@eduid.ch',
    },
    update: {},
  })

  return account
}
