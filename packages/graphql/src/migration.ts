// ref: https://github.com/prisma/prisma/discussions/10854

import type { PrismaClient } from '@klicker-uzh/prisma'
import { execute } from './scripts/2023-11-13_upgrade_question_data'
import type { PrismaMigrationClient } from './types/app'

interface Migration {
  id: string
  migrate: (tx: PrismaMigrationClient) => Promise<void>
}

const migrations: Migration[] = [
  {
    id: '2023-11-13_upgrade_question_data',
    migrate: execute,
  },
]

export async function migrate(prisma: PrismaClient) {
  for (const { id, migrate } of migrations) {
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
}
