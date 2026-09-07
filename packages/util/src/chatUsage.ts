// Europe/Zurich calendar-month boundary for account usage budgets. The database
// stores only the month key (first calendar day, DATE); these helpers derive
// the exact start and next-reset instants deterministically, including DST.

const ZURICH_TIME_ZONE = 'Europe/Zurich'

function zonedClockParts(date: Date): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZURICH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour) % 24,
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

/**
 * Returns the first calendar day of the month (Europe/Zurich) containing the
 * given instant, as a UTC Date at 00:00 UTC. This is the persisted month key.
 */
export function getZurichMonthStart(date: Date): Date {
  const { year, month } = zonedClockParts(date)
  return new Date(Date.UTC(year, month - 1, 1))
}

/**
 * Returns the instant at which the month starting at the given month key ends
 * and the next month begins: Zurich local midnight at the start of the next
 * month, as a UTC Date. DST shifts make this differ from the UTC month key.
 */
export function getZurichMonthEnd(monthStart: Date): Date {
  const nextMonthStart = new Date(monthStart)
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1)

  // Probe noon UTC on the next month's first day, then subtract the local
  // clock time to land exactly on Zurich midnight of that day.
  const probe = new Date(
    Date.UTC(
      nextMonthStart.getUTCFullYear(),
      nextMonthStart.getUTCMonth(),
      nextMonthStart.getUTCDate(),
      12
    )
  )
  const { hour, minute, second } = zonedClockParts(probe)
  const localMillis = (hour * 3600 + minute * 60 + second) * 1000
  return new Date(probe.getTime() - localMillis)
}

/**
 * Returns the UTC instant at which the current Zurich month resets (start of
 * the following month).
 */
export function getZurichMonthReset(now: Date): Date {
  return getZurichMonthEnd(getZurichMonthStart(now))
}

/**
 * Validates a budget or used-credit amount: a finite, non-negative number
 * with at most six decimal places (Decimal(18,6) credit precision) and at most
 * 12 integer digits. Returns null for malformed values; no rounding happens
 * here, the persistence boundary rounds at charge time.
 */
export function parseChatUsageCredits(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  if (value >= 1e12) return null
  const fixed = value.toFixed(6)
  if (Number(fixed) !== value) return null
  return value
}

/**
 * Deterministic default for a missing account/class/month row: no budget and
 * no usage. Counters start at zero at migration cutover; rows are created on
 * demand, so a missing row always projects to these values.
 */
export function getDefaultChatAccountUsage(): {
  budgetCredits: number
  usedCredits: number
} {
  return { budgetCredits: 0, usedCredits: 0 }
}
