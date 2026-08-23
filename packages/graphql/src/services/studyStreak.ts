import type { PrismaClient } from '@klicker-uzh/prisma/client'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const COURSE_TIMEZONE = 'Europe/Zurich'

export const QUALIFIED_RESPONSES_PER_DAY = 5
export const FREEZE_EARN_THRESHOLD = 7
export const FREEZE_BALANCE_MAX = 3
export const FREEZE_BALANCE_START = 2

interface StreakState {
  current: number
  longest: number
  freezeBalance: number
  qualifiedDaysSinceFreeze: number
  lastQualifiedDate: string | null
  lastProcessedDate: string | null
}

function zurichDate(value: Date | string): string {
  return dayjs(value).tz(COURSE_TIMEZONE).format('YYYY-MM-DD')
}

function isWeekend(dateStr: string): boolean {
  const dow = dayjs.tz(dateStr, COURSE_TIMEZONE).day()
  return dow === 0 || dow === 6
}

/**
 * Count missed active weekdays strictly between prevQualified and nextDate.
 * Weekends are neutral and never counted as missed days.
 */
function missedActiveDays(prevQualified: string, nextDate: string): number {
  let count = 0
  let cursor = dayjs.tz(prevQualified, COURSE_TIMEZONE).add(1, 'day')
  const end = dayjs.tz(nextDate, COURSE_TIMEZONE)
  while (cursor.isBefore(end)) {
    const dow = cursor.day()
    if (dow !== 0 && dow !== 6) count += 1
    cursor = cursor.add(1, 'day')
  }
  return count
}

export function applyQualifiedDate(
  state: StreakState,
  dateStr: string
): StreakState {
  if (state.lastProcessedDate && dateStr <= state.lastProcessedDate) {
    return state
  }

  if (isWeekend(dateStr)) {
    return { ...state, lastProcessedDate: dateStr }
  }

  // first tracked qualified day ever
  if (!state.lastQualifiedDate) {
    return awardFreezeIfDue({
      ...state,
      current: 1,
      longest: Math.max(state.longest, 1),
      qualifiedDaysSinceFreeze: state.qualifiedDaysSinceFreeze + 1,
      lastQualifiedDate: dateStr,
      lastProcessedDate: dateStr,
    })
  }

  const missed = missedActiveDays(state.lastQualifiedDate, dateStr)
  const freezesUsed = Math.min(missed, state.freezeBalance)
  const uncoveredBreaks = missed - freezesUsed
  const nextCurrent = uncoveredBreaks > 0 ? 1 : state.current + 1

  return awardFreezeIfDue({
    ...state,
    current: nextCurrent,
    longest: Math.max(state.longest, nextCurrent),
    freezeBalance: state.freezeBalance - freezesUsed,
    qualifiedDaysSinceFreeze: state.qualifiedDaysSinceFreeze + 1,
    lastQualifiedDate: dateStr,
    lastProcessedDate: dateStr,
  })
}

function awardFreezeIfDue(state: StreakState): StreakState {
  if (
    state.freezeBalance < FREEZE_BALANCE_MAX &&
    state.qualifiedDaysSinceFreeze >= FREEZE_EARN_THRESHOLD
  ) {
    return {
      ...state,
      freezeBalance: state.freezeBalance + 1,
      qualifiedDaysSinceFreeze: 0,
    }
  }
  return state
}

interface ReconcileDeps {
  prisma: Pick<PrismaClient, '$transaction'>
}

interface ReconcileInput {
  courseId: string
  participantId: string
}

/**
 * Fail-open reconciliation: applies every qualifying response date since
 * tracking start exactly once under a row lock on the participation.
 * Errors are swallowed so a streak failure never affects response flow.
 */
export async function reconcileStudyStreak(
  deps: ReconcileDeps,
  input: ReconcileInput
): Promise<void> {
  try {
    await deps.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: number
          course_id: string
          participant_id: string
          is_active: boolean
          study_streak_tracking_started_at: Date | null
          study_streak_current: number
          study_streak_longest: number
          study_streak_freeze_balance: number
          study_streak_qualified_days_since_freeze: number
          study_streak_last_qualified_date: Date | null
          study_streak_last_processed_date: Date | null
          course_start_date: Date
          course_end_date: Date
          course_gamification_enabled: boolean
        }>
      >`
        SELECT p.id, p.course_id, p.participant_id, p.is_active,
               p.study_streak_tracking_started_at, p.study_streak_current,
               p.study_streak_longest, p.study_streak_freeze_balance,
               p.study_streak_qualified_days_since_freeze,
               p.study_streak_last_qualified_date,
               p.study_streak_last_processed_date,
               c.start_date AS course_start_date,
               c.end_date AS course_end_date,
               c.is_gamification_enabled AS course_gamification_enabled
          FROM "Participation" p
          JOIN "Course" c ON c.id = p.course_id
         WHERE p.course_id = ${input.courseId}
           AND p.participant_id = ${input.participantId}
           FOR UPDATE OF p
      `

      const p = rows[0]
      if (
        !p?.is_active ||
        !p.study_streak_tracking_started_at ||
        !p.course_gamification_enabled
      ) {
        return
      }

      const courseStart = zurichDate(p.course_start_date)
      const trackingStart = zurichDate(p.study_streak_tracking_started_at)
      const effectiveStart =
        trackingStart > courseStart ? trackingStart : courseStart

      const dateRows = await tx.$queryRaw<
        Array<{
          activity_date: Date
        }>
      >`
        SELECT (dr.created_at AT TIME ZONE 'UTC')
                    AT TIME ZONE ${COURSE_TIMEZONE}::text AS activity_date
          FROM question_response_detail dr
         WHERE dr.participation_id = ${p.id}
           AND dr.created_at >= ${p.study_streak_tracking_started_at}
           AND (dr.practice_quiz_id IS NOT NULL
                OR dr.micro_learning_id IS NOT NULL)
         GROUP BY activity_date
        HAVING COUNT(*) >= ${QUALIFIED_RESPONSES_PER_DAY}
         ORDER BY activity_date
      `

      let state: StreakState = {
        current: p.study_streak_current,
        longest: p.study_streak_longest,
        freezeBalance: p.study_streak_freeze_balance,
        qualifiedDaysSinceFreeze: p.study_streak_qualified_days_since_freeze,
        lastQualifiedDate: p.study_streak_last_qualified_date
          ? zurichDate(p.study_streak_last_qualified_date)
          : null,
        lastProcessedDate: p.study_streak_last_processed_date
          ? zurichDate(p.study_streak_last_processed_date)
          : null,
      }

      for (const row of dateRows) {
        const d = zurichDate(row.activity_date)
        if (d < effectiveStart || d > zurichDate(p.course_end_date)) continue
        state = applyQualifiedDate(state, d)
      }

      await tx.$executeRaw`
        UPDATE "Participation" SET
          study_streak_current = ${state.current},
          study_streak_longest = ${state.longest},
          study_streak_freeze_balance = ${state.freezeBalance},
          study_streak_qualified_days_since_freeze = ${state.qualifiedDaysSinceFreeze},
          study_streak_last_qualified_date = ${
            state.lastQualifiedDate
              ? dayjs.tz(state.lastQualifiedDate, COURSE_TIMEZONE).toDate()
              : null
          },
          study_streak_last_processed_date = ${
            state.lastProcessedDate
              ? dayjs.tz(state.lastProcessedDate, COURSE_TIMEZONE).toDate()
              : null
          },
          updated_at = NOW()
         WHERE id = ${p.id}
      `
    })
  } catch (error) {
    console.error('study streak reconciliation failed (fail-open)', {
      courseId: input.courseId,
      participantId: input.participantId,
      error,
    })
  }
}
