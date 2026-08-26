// ref: https://github.com/prisma/prisma/discussions/10854

import type { PrismaMigrationClient } from '@klicker-uzh/graphql/src/types/app.js'
import type { PrismaClient } from '@klicker-uzh/prisma/client'

const COURSE_TIMEZONE = 'Europe/Zurich'

interface Migration {
  id: string
  isIdempotent?: true
  migrate: (tx: PrismaMigrationClient) => Promise<void>
}

const MIGRATION_RETRY_ATTEMPTS = 3
const MIGRATION_RETRY_BASE_DELAY_MS = 2000

function isTransientDatabaseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('database unavailable') ||
    message.includes('too many connections')
  )
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  )
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
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

async function initializeActiveStudyStreaks(
  tx: PrismaMigrationClient
): Promise<void> {
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
}

const migrations: Migration[] = [
  {
    id: '20260824_initialize_active_study_streaks',
    migrate: initializeActiveStudyStreaks,
  },
  {
    id: '20260824_repair_active_study_streaks',
    migrate: initializeActiveStudyStreaks,
  },
]

export async function migrate(prisma: PrismaClient) {
  for (const { id, isIdempotent, migrate: runMigration } of migrations) {
    let lastError: unknown = null

    for (let attempt = 1; attempt <= MIGRATION_RETRY_ATTEMPTS; attempt++) {
      try {
        if (isIdempotent) {
          const migration = await prisma.migration.findFirst({ where: { id } })
          if (migration !== null) break

          console.log(`Migrating ${id} (idempotent mode without transaction)`)

          await runMigration(prisma)
          try {
            await prisma.migration.create({ data: { id } })
          } catch (error) {
            // Another replica recorded this migration concurrently; the
            // migration itself is idempotent so this is safe to skip.
            if (!isUniqueConstraintViolation(error)) throw error
          }
        } else {
          // The advisory lock serializes concurrent replicas: a second pod
          // blocks until the first pod's transaction commits, then sees the
          // migration record and skips the work. hashtext maps the migration
          // id to the bigint key PostgreSQL advisory locks require.
          await prisma.$transaction(
            async (tx: PrismaMigrationClient) => {
              await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`

              const migration = await tx.migration.findFirst({ where: { id } })
              if (migration !== null) return

              console.log(`Migrating ${id} (with transaction)`)
              await runMigration(tx)
              await tx.migration.create({ data: { id } })
            },
            {
              timeout: 120000,
            }
          )
        }

        console.log(`Migrated ${id}`)
        lastError = null
        break
      } catch (error) {
        lastError = error

        if (isUniqueConstraintViolation(error)) {
          // Another replica completed this migration while we were checking.
          console.log(`Migration ${id} already applied by another replica`)
          lastError = null
          break
        }

        if (
          attempt < MIGRATION_RETRY_ATTEMPTS &&
          isTransientDatabaseError(error)
        ) {
          const delay = MIGRATION_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)
          console.warn(
            `Migration ${id} attempt ${attempt}/${MIGRATION_RETRY_ATTEMPTS} failed (transient), retrying in ${delay}ms: `,
            error
          )
          await sleep(delay)
          continue
        }

        throw error
      }
    }

    if (lastError !== null) throw lastError
  }
}
