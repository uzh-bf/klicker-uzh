import Prisma from '../../dist/index.js'
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
      pinCode: 483726,
      startDate: new Date(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 10)),
      groupDeadlineDate: new Date(
        new Date().setFullYear(new Date().getFullYear() + 5)
      ),
      isGamificationEnabled: true,
    })
  )
}

const prismaClient = new Prisma.PrismaClient()

seedUser(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })
