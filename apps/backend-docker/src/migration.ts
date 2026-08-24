// ref: https://github.com/prisma/prisma/discussions/10854

import type { PrismaMigrationClient } from '@klicker-uzh/graphql/src/types/app.js'
import type { PrismaClient } from '@klicker-uzh/prisma/client'

interface Migration {
  id: string
  isIdempotent?: true
  migrate: (tx: PrismaMigrationClient) => Promise<void>
}

const migrations: Migration[] = [
  {
    id: '20260824_initialize_active_study_streaks',
    migrate: async (tx) => {
      const trackingStartedAt = new Date()

      await tx.participation.updateMany({
        where: {
          isActive: true,
          studyStreakTrackingStartedAt: null,
          course: {
            isGamificationEnabled: true,
            isAssessmentEnabled: false,
            endDate: { gte: trackingStartedAt },
          },
        },
        data: { studyStreakTrackingStartedAt: trackingStartedAt },
      })
    },
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
          async (tx: PrismaMigrationClient) => {
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
