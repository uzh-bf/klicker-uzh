import * as Prisma from '@klicker-uzh/prisma/client'
import {
  USER_ID_TEST,
  USER_ID_TEST2,
  USER_ID_TEST3,
  USER_ID_TEST4,
  USER_ID_TEST5,
} from './constants.js'
import { prepareUser } from './helpers.js'

export async function seedUsers(prisma: Prisma.PrismaClient) {
  await prisma.user.upsert(
    await prepareUser({
      id: USER_ID_TEST,
      name: 'Lecturer',
      email: 'lecturer@df.uzh.ch',
      shortname: 'lecturer',
      password: 'abcd',
      catalystIndividual: true,
      catalystInstitutional: true,
      publicPreview: true,
      privatePreview: true,
      // The one seeded account enabled for the AI features, so local work can
      // exercise both sides of that gate without editing the database.
      aiFeaturesEnabled: true,
      role: 'ADMIN',
    })
  )

  await prisma.user.upsert(
    await prepareUser({
      id: USER_ID_TEST2,
      name: 'Free Tier User',
      email: 'free@df.uzh.ch',
      shortname: 'free',
      password: 'abcd',
    })
  )

  await prisma.user.upsert(
    await prepareUser({
      id: USER_ID_TEST3,
      name: 'Individual Pro User',
      email: 'pro1@df.uzh.ch',
      shortname: 'pro1',
      password: 'abcd',
      catalystIndividual: true,
      publicPreview: true,
      privatePreview: true,
    })
  )

  await prisma.user.upsert(
    await prepareUser({
      id: USER_ID_TEST4,
      name: 'Institutional Pro User',
      email: 'pro2@df.uzh.ch',
      shortname: 'pro2',
      password: 'abcd',
      catalystInstitutional: true,
      publicPreview: true,
      privatePreview: true,
    })
  )

  await prisma.user.upsert(
    await prepareUser({
      id: USER_ID_TEST5,
      name: 'Institutional Pro User 2',
      email: 'pro3@df.uzh.ch',
      shortname: 'pro3',
      password: 'abcd',
      catalystInstitutional: true,
      publicPreview: true,
      privatePreview: true,
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
