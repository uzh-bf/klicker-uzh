// ref: https://github.com/prisma/prisma/discussions/10854

import { Prisma, PrismaClient } from '@klicker-uzh/prisma'

interface Migration {
  id: string
  migrate: (
    tx: Omit<
      PrismaClient<Prisma.PrismaClientOptions, never>,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >
  ) => Promise<void>
}

const migrations: Migration[] = [
  {
    id: '<migration-id>',
    migrate: async (tx) => {
      console.log('test migration script')
    },
  },
]

export async function migrate(prisma: PrismaClient) {
  for (const { id, migrate } of migrations) {
    console.log(id)
    const migration = await prisma.migration.findFirst({ where: { id } })
    if (migration === null) {
      console.log(`Migrating ${id}`)
      await prisma.$transaction(async (tx) => {
        await migrate(tx)
        await tx.migration.create({ data: { id } })
      })
      console.log(`Migrated ${id}`)
    }
  }
  return prisma
}
