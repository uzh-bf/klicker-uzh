import Prisma from '../../dist/index.js'
import { prepareUser } from './helpers.js'
import {
  USER_ID_TEST,
  USER_ID_TEST2,
  USER_ID_TEST3,
  USER_ID_TEST4,
} from './constants.js'

export async function seedUsers(prisma: Prisma.PrismaClient) {
  const standardUser = await prisma.user.upsert(
    await prepareUser({
      id: USER_ID_TEST,
      name: 'Lecturer',
      email: 'lecturer@df.uzh.ch',
      shortname: 'lecturer',
      password: 'abcd',
      catalystIndividual: true,
      catalystInstitutional: true,
    })
  )

  const freeUser = await prisma.user.upsert(
    await prepareUser({
      id: USER_ID_TEST2,
      name: 'Free Tier User',
      email: 'free@df.uzh.ch',
      shortname: 'free',
      password: 'abcd',
    })
  )

  const individualProUser = await prisma.user.upsert(
    await prepareUser({
      id: USER_ID_TEST3,
      name: 'Individual Pro User',
      email: 'pro1@df.uzh.ch',
      shortname: 'pro1',
      password: 'abcd',
      catalystIndividual: true,
    })
  )

  const institutionalProUser = await prisma.user.upsert(
    await prepareUser({
      id: USER_ID_TEST4,
      name: 'Institutional Pro User',
      email: 'pro2@df.uzh.ch',
      shortname: 'pro2',
      password: 'abcd',
      catalystInstitutional: true,
    })
  )
}

// const prismaClient = new Prisma.PrismaClient()
// seedUsers(prismaClient)
//   .catch((e) => {
//     console.error(e)
//     process.exit(1)
//   })
//   .finally(async () => {
//     await prismaClient.$disconnect()
//   })
