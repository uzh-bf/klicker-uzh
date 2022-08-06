import { PrismaClient } from '@prisma/client'

async function main(prisma: PrismaClient) {
  await prisma.user.upsert({
    create: {
      email: 'roland.schlaefli@bf.uzh.ch',
      password: 'abcd',
      shortname: 'rschlaefli',
    },
    update: {},
    where: {
      email: 'roland.schlaefli@bf.uzh.ch',
    },
  })
}

const prismaClient = new PrismaClient()

main(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })
