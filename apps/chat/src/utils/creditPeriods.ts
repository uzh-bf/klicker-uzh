/**
 * Credit period utilities for fixed reset times
 *
 * This module provides functions to calculate fixed reset points for credit periods,
 * ensuring all users reset at the same calendar times (e.g., every Monday for weekly)
 * rather than individual rolling periods.
 */

import { CreditResetPeriod } from '@klicker-uzh/prisma/client'

/**
 * Get the start of the current credit period for a given reset type
 * All times are in UTC to ensure consistency across timezones
 */
export function getCurrentPeriodStart(resetPeriod: CreditResetPeriod): Date {
  const now = new Date()

  switch (resetPeriod) {
    case CreditResetPeriod.DAILY:
      // Start of current day in UTC
      return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      )

    case CreditResetPeriod.WEEKLY: {
      // Start of current week (Monday 00:00 UTC)
      const startOfWeek = new Date(now)
      const dayOfWeek = startOfWeek.getUTCDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Sunday = 0, so 6 days back to Monday
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
      // Start of current biweekly period (every other Monday)
      // Use a reference date to ensure consistent biweekly periods
      const referenceDate = new Date('2025-09-15T00:00:00.000Z') // Semester Start 2025
      const weekStart = getCurrentPeriodStart(CreditResetPeriod.WEEKLY)
      const weeksSinceReference = Math.floor(
        (weekStart.getTime() - referenceDate.getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      )
      const biweeklyPeriod = Math.floor(weeksSinceReference / 2)
      const biweeklyStart = new Date(
        referenceDate.getTime() + biweeklyPeriod * 2 * 7 * 24 * 60 * 60 * 1000
      )
      return biweeklyStart
    }

    case CreditResetPeriod.MONTHLY: {
      // Start of current month (1st day 00:00 UTC)
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    }

    case CreditResetPeriod.NONE:
    default:
      // No reset period - return epoch
      return new Date(0)
  }
}

/**
 * Get the next reset time for a given period, or null when it never resets
 */
export function getNextResetTime(resetPeriod: CreditResetPeriod): Date | null {
  const currentPeriodStart = getCurrentPeriodStart(resetPeriod)

  switch (resetPeriod) {
    case CreditResetPeriod.DAILY:
      return new Date(currentPeriodStart.getTime() + 24 * 60 * 60 * 1000)

    case CreditResetPeriod.WEEKLY:
      return new Date(currentPeriodStart.getTime() + 7 * 24 * 60 * 60 * 1000)

    case CreditResetPeriod.BIWEEKLY:
      return new Date(currentPeriodStart.getTime() + 14 * 24 * 60 * 60 * 1000)

    case CreditResetPeriod.MONTHLY: {
      // Handle month-end dates properly (e.g., Jan 31 + 1 month = Feb 28/29, not Mar 3)
      const year = currentPeriodStart.getUTCFullYear()
      const month = currentPeriodStart.getUTCMonth() + 1
      const nextYear = month > 11 ? year + 1 : year
      const nextMonth = month > 11 ? 0 : month
      return new Date(Date.UTC(nextYear, nextMonth, 1))
    }

    case CreditResetPeriod.NONE:
    default:
      return null
  }
}

/**
 * Check if a period has expired and credits should be reset
 */
export function isPeriodExpired(
  periodStartedAt: Date,
  resetPeriod: CreditResetPeriod
): boolean {
  if (resetPeriod === CreditResetPeriod.NONE) {
    return false
  }

  const currentPeriodStart = getCurrentPeriodStart(resetPeriod)

  // If the user's period started before the current period, they need a reset
  return periodStartedAt.getTime() < currentPeriodStart.getTime()
}

/**
 * Calculate how many reset periods have passed since a given date
 * Useful for batch processing and determining missed resets
 */
export function getPeriodsElapsed(
  since: Date,
  resetPeriod: CreditResetPeriod
): number {
  if (resetPeriod === CreditResetPeriod.NONE) {
    return 0
  }

  const currentPeriodStart = getCurrentPeriodStart(resetPeriod)
  const timeDiff = currentPeriodStart.getTime() - since.getTime()

  if (timeDiff <= 0) {
    return 0
  }

  switch (resetPeriod) {
    case CreditResetPeriod.DAILY:
      return Math.floor(timeDiff / (24 * 60 * 60 * 1000))
    case CreditResetPeriod.WEEKLY:
      return Math.floor(timeDiff / (7 * 24 * 60 * 60 * 1000))
    case CreditResetPeriod.BIWEEKLY:
      return Math.floor(timeDiff / (14 * 24 * 60 * 60 * 1000))
    case CreditResetPeriod.MONTHLY: {
      // Calculate full months between dates
      const sinceDate = new Date(since)
      const currentDate = new Date(currentPeriodStart)
      const yearDiff = currentDate.getUTCFullYear() - sinceDate.getUTCFullYear()
      const monthDiff = currentDate.getUTCMonth() - sinceDate.getUTCMonth()
      return yearDiff * 12 + monthDiff
    }
    default:
      return 0
  }
}
