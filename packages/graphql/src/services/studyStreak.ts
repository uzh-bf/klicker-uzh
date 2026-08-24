import * as DB from '@klicker-uzh/prisma/client'
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
const TRANSACTION_RETRY_LIMIT = 3

interface StreakState {
  current: number
  longest: number
  freezeBalance: number
  qualifiedDaysSinceFreeze: number
  lastQualifiedDate: string | null
  lastProcessedDate: string | null
}

export function zurichDate(value: Date | string): string {
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

function isPrismaError(error: unknown, code: 'P2034') {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  )
}

interface ReconcileDeps {
  prisma: DB.PrismaClient
}

interface ReconcileInput {
  courseId: string
  participantId: string
}

/**
 * Fail-open reconciliation: applies every qualifying response date since
 * tracking start exactly once in a serializable Prisma transaction.
 * Errors are swallowed so a streak failure never affects response flow.
 */
export async function reconcileStudyStreak(
  deps: ReconcileDeps,
  input: ReconcileInput
): Promise<void> {
  try {
    for (let attempt = 0; attempt < TRANSACTION_RETRY_LIMIT; attempt++) {
      try {
        await deps.prisma.$transaction(
          async (tx) => {
            const participation = await tx.participation.findUnique({
              where: {
                courseId_participantId: {
                  courseId: input.courseId,
                  participantId: input.participantId,
                },
              },
              include: {
                course: {
                  select: {
                    startDate: true,
                    endDate: true,
                    isGamificationEnabled: true,
                  },
                },
              },
            })

            if (
              !participation?.isActive ||
              !participation.studyStreakTrackingStartedAt ||
              !participation.course.isGamificationEnabled
            ) {
              return
            }

            const courseStart = zurichDate(participation.course.startDate)
            const trackingStart = zurichDate(
              participation.studyStreakTrackingStartedAt
            )
            const courseEnd = zurichDate(participation.course.endDate)
            const effectiveStart =
              trackingStart > courseStart ? trackingStart : courseStart

            const detailResponses = await tx.questionResponseDetail.findMany({
              where: {
                participationId: participation.id,
                createdAt: {
                  gte: participation.studyStreakTrackingStartedAt,
                },
                OR: [
                  { practiceQuizId: { not: null } },
                  { microLearningId: { not: null } },
                ],
              },
              select: { createdAt: true },
              orderBy: { createdAt: 'asc' },
            })

            const responsesByDate = new Map<string, number>()
            for (const response of detailResponses) {
              const responseDate = zurichDate(response.createdAt)
              if (responseDate < effectiveStart || responseDate > courseEnd) {
                continue
              }
              responsesByDate.set(
                responseDate,
                (responsesByDate.get(responseDate) ?? 0) + 1
              )
            }

            const qualifiedDates = [...responsesByDate.entries()]
              .filter(
                ([, responseCount]) =>
                  responseCount >= QUALIFIED_RESPONSES_PER_DAY
              )
              .map(([responseDate]) => responseDate)
              .sort((left, right) => left.localeCompare(right))

            let state: StreakState = {
              current: participation.studyStreakCurrent,
              longest: participation.studyStreakLongest,
              freezeBalance: participation.studyStreakFreezeBalance,
              qualifiedDaysSinceFreeze:
                participation.studyStreakQualifiedDaysSinceFreeze,
              lastQualifiedDate: participation.studyStreakLastQualifiedDate
                ? zurichDate(participation.studyStreakLastQualifiedDate)
                : null,
              lastProcessedDate: participation.studyStreakLastProcessedDate
                ? zurichDate(participation.studyStreakLastProcessedDate)
                : null,
            }

            for (const responseDate of qualifiedDates) {
              state = applyQualifiedDate(state, responseDate)
            }

            await tx.participation.update({
              where: { id: participation.id },
              data: {
                studyStreakCurrent: state.current,
                studyStreakLongest: state.longest,
                studyStreakFreezeBalance: state.freezeBalance,
                studyStreakQualifiedDaysSinceFreeze:
                  state.qualifiedDaysSinceFreeze,
                studyStreakLastQualifiedDate: state.lastQualifiedDate
                  ? dayjs.tz(state.lastQualifiedDate, COURSE_TIMEZONE).toDate()
                  : null,
                studyStreakLastProcessedDate: state.lastProcessedDate
                  ? dayjs.tz(state.lastProcessedDate, COURSE_TIMEZONE).toDate()
                  : null,
              },
            })
          },
          {
            isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable,
          }
        )
        return
      } catch (error) {
        if (
          !isPrismaError(error, 'P2034') ||
          attempt === TRANSACTION_RETRY_LIMIT - 1
        ) {
          throw error
        }
      }
    }
  } catch (error) {
    console.error('study streak reconciliation failed (fail-open)', {
      courseId: input.courseId,
      participantId: input.participantId,
      error,
    })
  }
}
