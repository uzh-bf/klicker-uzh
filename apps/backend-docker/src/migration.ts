// ref: https://github.com/prisma/prisma/discussions/10854

import type { PrismaMigrationClient } from '@klicker-uzh/graphql/src/types/app.js'
import type { PrismaClient } from '@klicker-uzh/prisma/client'

const COURSE_TIMEZONE = 'Europe/Zurich'

interface Migration {
  id: string
  isIdempotent?: true
  migrate: (tx: PrismaMigrationClient) => Promise<void>
}

function zurichDayStart(date: Date): Date {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: COURSE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = Number(dateParts.find((part) => part.type === 'year')?.value)
  const month = Number(dateParts.find((part) => part.type === 'month')?.value)
  const day = Number(dateParts.find((part) => part.type === 'day')?.value)
  const utcMidnight = Date.UTC(year, month - 1, day)
  const localParts = new Intl.DateTimeFormat('en-US', {
    timeZone: COURSE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcMidnight))
  const localYear = Number(
    localParts.find((part) => part.type === 'year')?.value
  )
  const localMonth = Number(
    localParts.find((part) => part.type === 'month')?.value
  )
  const localDay = Number(localParts.find((part) => part.type === 'day')?.value)
  const localHour = Number(
    localParts.find((part) => part.type === 'hour')?.value
  )
  const localMinute = Number(
    localParts.find((part) => part.type === 'minute')?.value
  )
  const offset =
    Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute) -
    utcMidnight

  return new Date(utcMidnight - offset)
}

const migrations: Migration[] = [
  {
    id: '20260824_initialize_active_study_streaks',
    migrate: async (tx) => {
      const trackingStartedAt = new Date()
      const trackingDayStart = zurichDayStart(trackingStartedAt)

      await tx.participation.updateMany({
        where: {
          isActive: true,
          studyStreakTrackingStartedAt: null,
          course: {
            isGamificationEnabled: true,
            isAssessmentEnabled: false,
            endDate: { gte: trackingDayStart },
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
