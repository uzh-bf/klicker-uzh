import Prisma, { PublicationStatus } from '../../dist'
import { COURSE_ID_AMI_HS23 } from './constants'

const COURSE_ID = COURSE_ID_AMI_HS23

async function seed(prisma: Prisma.PrismaClient) {
  if (process.env.ENV !== 'development') process.exit(1)
  const uniqueQuestionIds = new Set<number>()

  const microSessions = await prisma.microSession.findMany({
    where: {
      courseId: COURSE_ID,
      status: PublicationStatus.PUBLISHED,
    },
    include: {
      instances: true,
    },
  })

  microSessions.forEach((microSession) => {
    microSession.instances.forEach((instance) => {
      if (instance.questionId !== null) {
        uniqueQuestionIds.add(instance.questionId)
      }
    })
  })

  console.log(uniqueQuestionIds)
}

const prismaClient = new Prisma.PrismaClient()

await seed(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })
