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

function prismaDate(dateStr: string): Date {
  return dayjs.utc(dateStr).startOf('day').toDate()
}

function zurichDayStart(dateStr: string): Date {
  return dayjs.tz(dateStr, COURSE_TIMEZONE).startOf('day').toDate()
}

function isWeekend(dateStr: string): boolean {
  const dow = dayjs.tz(dateStr, COURSE_TIMEZONE).day()
  return dow === 0 || dow === 6
}

/**
 * Count missed active weekdays strictly between previousDate and nextDate.
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

export function applyMissedDate(
  state: StreakState,
  dateStr: string
): StreakState {
  if (state.lastProcessedDate && dateStr <= state.lastProcessedDate) {
    return state
  }

  if (isWeekend(dateStr) || !state.lastQualifiedDate || state.current === 0) {
    return { ...state, lastProcessedDate: dateStr }
  }

  if (state.freezeBalance > 0) {
    return {
      ...state,
      freezeBalance: state.freezeBalance - 1,
      lastProcessedDate: dateStr,
    }
  }

  return { ...state, current: 0, lastProcessedDate: dateStr }
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

  const previousProcessedDate =
    state.lastProcessedDate ?? state.lastQualifiedDate
  const missed = previousProcessedDate
    ? missedActiveDays(previousProcessedDate, dateStr)
    : 0
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
 * Count the eligible answers submitted today for a self-scoped participation.
 * Content views deliberately do not count toward the daily streak goal.
 */
export async function getStudyStreakResponsesToday(
  deps: ReconcileDeps,
  input: ReconcileInput
): Promise<number | null> {
  const participation = await deps.prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId: input.courseId,
        participantId: input.participantId,
      },
    },
    select: {
      id: true,
      isActive: true,
      studyStreakTrackingStartedAt: true,
      course: {
        select: {
          startDate: true,
          endDate: true,
          isGamificationEnabled: true,
          isAssessmentEnabled: true,
        },
      },
    },
  })

  if (
    !participation?.isActive ||
    !participation.studyStreakTrackingStartedAt ||
    !participation.course.isGamificationEnabled ||
    participation.course.isAssessmentEnabled
  ) {
    return null
  }

  const today = zurichDate(new Date())
  const courseStart = zurichDate(participation.course.startDate)
  const courseEnd = zurichDate(participation.course.endDate)
  if (today < courseStart || today > courseEnd || isWeekend(today)) return null

  const todayStart = zurichDayStart(today)
  const tomorrowStart = dayjs
    .tz(today, COURSE_TIMEZONE)
    .add(1, 'day')
    .startOf('day')
    .toDate()

  return deps.prisma.questionResponse.count({
    where: {
      participationId: participation.id,
      lastAnsweredAt: {
        gte:
          participation.studyStreakTrackingStartedAt > todayStart
            ? participation.studyStreakTrackingStartedAt
            : todayStart,
        lt: tomorrowStart,
      },
      OR: [
        { practiceQuizId: { not: null } },
        { microLearningId: { not: null } },
      ],
      elementInstance: {
        elementType: { not: DB.ElementType.CONTENT },
      },
    },
  })
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
                    isAssessmentEnabled: true,
                  },
                },
              },
            })

            if (
              !participation?.isActive ||
              !participation.studyStreakTrackingStartedAt ||
              !participation.course.isGamificationEnabled ||
              participation.course.isAssessmentEnabled
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
            const today = zurichDate(new Date())
            const todayStart = zurichDayStart(today)
            const tomorrowStart = dayjs
              .tz(today, COURSE_TIMEZONE)
              .add(1, 'day')
              .startOf('day')
              .toDate()
            const lastProcessedDate = participation.studyStreakLastProcessedDate
              ? zurichDate(participation.studyStreakLastProcessedDate)
              : null
            const repairStart = lastProcessedDate
              ? dayjs
                  .tz(lastProcessedDate, COURSE_TIMEZONE)
                  .add(1, 'day')
                  .startOf('day')
                  .toDate()
              : participation.studyStreakTrackingStartedAt
            const detailStart =
              repairStart > participation.studyStreakTrackingStartedAt
                ? repairStart
                : participation.studyStreakTrackingStartedAt

            const detailResponses = await tx.questionResponseDetail.findMany({
              where: {
                participationId: participation.id,
                createdAt: {
                  gte: detailStart,
                  lt: todayStart,
                },
                OR: [
                  { practiceQuizId: { not: null } },
                  { microLearningId: { not: null } },
                ],
                elementInstance: {
                  elementType: { not: DB.ElementType.CONTENT },
                },
              },
              select: { createdAt: true, elementInstanceId: true },
              orderBy: { createdAt: 'asc' },
            })

            const responsesByDate = new Map<string, Set<number>>()
            for (const response of detailResponses) {
              const responseDate = zurichDate(response.createdAt)
              if (responseDate < effectiveStart || responseDate > courseEnd) {
                continue
              }
              const instances =
                responsesByDate.get(responseDate) ?? new Set<number>()
              instances.add(response.elementInstanceId)
              responsesByDate.set(responseDate, instances)
            }

            let currentDayResponseCount = 0
            if (
              today >= courseStart &&
              today <= courseEnd &&
              !isWeekend(today)
            ) {
              currentDayResponseCount = await tx.questionResponse.count({
                where: {
                  participationId: participation.id,
                  lastAnsweredAt: {
                    gte:
                      participation.studyStreakTrackingStartedAt > todayStart
                        ? participation.studyStreakTrackingStartedAt
                        : todayStart,
                    lt: tomorrowStart,
                  },
                  OR: [
                    { practiceQuizId: { not: null } },
                    { microLearningId: { not: null } },
                  ],
                  elementInstance: {
                    elementType: { not: DB.ElementType.CONTENT },
                  },
                },
              })
            }

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

            const processingThrough =
              today > courseEnd
                ? courseEnd
                : today >= courseStart
                  ? dayjs
                      .tz(today, COURSE_TIMEZONE)
                      .subtract(1, 'day')
                      .format('YYYY-MM-DD')
                  : null
            const processingStart =
              state.lastProcessedDate &&
              state.lastProcessedDate >= effectiveStart
                ? dayjs
                    .tz(state.lastProcessedDate, COURSE_TIMEZONE)
                    .add(1, 'day')
                    .format('YYYY-MM-DD')
                : effectiveStart

            if (processingThrough && processingStart <= processingThrough) {
              let cursor = dayjs.tz(processingStart, COURSE_TIMEZONE)
              const end = dayjs.tz(processingThrough, COURSE_TIMEZONE)
              while (!cursor.isAfter(end)) {
                const responseDate = cursor.format('YYYY-MM-DD')
                const responseCount =
                  responsesByDate.get(responseDate)?.size ?? 0
                state =
                  responseCount >= QUALIFIED_RESPONSES_PER_DAY
                    ? applyQualifiedDate(state, responseDate)
                    : applyMissedDate(state, responseDate)
                cursor = cursor.add(1, 'day')
              }
            }

            if (
              currentDayResponseCount >= QUALIFIED_RESPONSES_PER_DAY &&
              today >= courseStart &&
              today <= courseEnd &&
              !isWeekend(today)
            ) {
              state = applyQualifiedDate(state, today)
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
                  ? prismaDate(state.lastQualifiedDate)
                  : null,
                studyStreakLastProcessedDate: state.lastProcessedDate
                  ? prismaDate(state.lastProcessedDate)
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
    console.error('study streak reconciliation failed (fail-open)', { error })
  }
}
