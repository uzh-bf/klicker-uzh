// ref: https://github.com/prisma/prisma/discussions/10854

import type { PrismaMigrationClient } from '@klicker-uzh/graphql/src/types/app.js'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import { logger } from './logger.js'

interface Migration {
  id: string
  isIdempotent?: true
  migrate: (tx: PrismaMigrationClient) => Promise<void>
}

const migrations: Migration[] = []

export async function migrate(prisma: PrismaClient) {
  for (const { id, isIdempotent, migrate } of migrations) {
    const migration = await prisma.migration.findFirst({ where: { id } })
    if (migration === null) {
      if (isIdempotent) {
        logger.info(
          { event: 'migration.started', migrationId: id, transactional: false },
          'Database migration started'
        )

        await migrate(prisma)
        await prisma.migration.create({ data: { id } })
      } else {
        logger.info(
          { event: 'migration.started', migrationId: id, transactional: true },
          'Database migration started'
        )

        await prisma.$transaction(
          async (tx: PrismaMigrationClient) => {
            await migrate(tx)
            await tx.migration.create({ data: { id } })
          },
          {
            timeout: 60000,
          }
        )
      }

      logger.info(
        { event: 'migration.completed', migrationId: id },
        'Database migration completed'
      )
    }
  }
}
