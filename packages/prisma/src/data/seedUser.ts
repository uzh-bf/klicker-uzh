import Prisma from '../client/index.js'
import { prepareCourse, prepareUser } from './helpers.js'

async function seedUser(prisma: Prisma.PrismaClient) {
  const user = await prisma.user.upsert(
    await prepareUser({
      id: '',
      email: '',
      name: '',
      shortname: '',
      password: '',
    })
  )

  const course = await prisma.course.upsert(
    prepareCourse({
      id: '',
      name: '',
      displayName: '',
      ownerId: user.id,
    })
  )
}

const prismaClient = new Prisma.PrismaClient()

await seedUser(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })
