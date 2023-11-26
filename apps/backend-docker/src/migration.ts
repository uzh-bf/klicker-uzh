// ref: https://github.com/prisma/prisma/discussions/10854

import type { PrismaMigrationClient } from '@klicker-uzh/graphql/src/types/app.js'
import { PrismaClient } from '@klicker-uzh/prisma'
import UpgradeQuestionDataMigration from '../scripts/2023-11-13_upgrade_question_data.js'

interface Migration {
  id: string
  isIdempotent?: true
  migrate: (tx: PrismaMigrationClient) => Promise<void>
}

const migrations: Migration[] = [
  {
    id: '2023-11-13_upgrade_question_data',
    isIdempotent: true,
    migrate: UpgradeQuestionDataMigration,
  },
]

export async function migrate(prisma: PrismaClient) {
  for (const { id, isIdempotent, migrate } of migrations) {
    const migration = await prisma.migration.findFirst({ where: { id } })
    if (migration === null) {
      if (isIdempotent) {
        console.log(`Migrating ${id} (idempotent mode without transaction)`)

        await migrate(prisma)
        await prisma.migration.create({ data: { id } })
      } else {
        console.log(`Migrating ${id} (with transaction)`)

        await prisma.$transaction(
          async (tx) => {
            await migrate(tx)
            await tx.migration.create({ data: { id } })
          },
          {
            timeout: 60000,
          }
        )
      }

      console.log(`Migrated ${id}`)
    }
  }
}

// const prisma = new PrismaClient()

// await migrate(prisma)
