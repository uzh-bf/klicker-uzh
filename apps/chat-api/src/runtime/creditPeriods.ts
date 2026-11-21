import { CreditResetPeriod } from '@klicker-uzh/prisma/client'

export function getCurrentPeriodStart(period: CreditResetPeriod): Date {
  const now = new Date()
  switch (period) {
    case CreditResetPeriod.DAILY:
      return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      )
    case CreditResetPeriod.WEEKLY: {
      const startOfWeek = new Date(now)
      const dayOfWeek = startOfWeek.getUTCDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      startOfWeek.setUTCDate(startOfWeek.getUTCDate() - daysToMonday)
      return new Date(
        Date.UTC(
          startOfWeek.getUTCFullYear(),
          startOfWeek.getUTCMonth(),
          startOfWeek.getUTCDate()
        )
      )
    }
    case CreditResetPeriod.BIWEEKLY: {
      const referenceDate = new Date('2025-09-15T00:00:00.000Z')
      const weekStart = getCurrentPeriodStart(CreditResetPeriod.WEEKLY)
      const weeksSinceReference = Math.floor(
        (weekStart.getTime() - referenceDate.getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      )
      return new Date(
        referenceDate.getTime() +
          Math.floor(weeksSinceReference / 2) * 2 * 7 * 24 * 60 * 60 * 1000
      )
    }
    case CreditResetPeriod.MONTHLY:
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    case CreditResetPeriod.NONE:
    default:
      return new Date(0)
  }
}

export function isPeriodExpired(startedAt: Date, period: CreditResetPeriod) {
  if (period === CreditResetPeriod.NONE) return false
  return startedAt.getTime() < getCurrentPeriodStart(period).getTime()
}
