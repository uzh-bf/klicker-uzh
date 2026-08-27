import { randomInt } from 'node:crypto'
import type { ActivityType } from '@klicker-uzh/types'

export const LEARNING_ANALYTICS_MINIMUM_CELL_SIZE = 5

export type LearningAnalyticsWeeklyActivityV2 = {
  periodIndex: number
  effectiveN: number
}

export type CourseActivityAnalyticsV2 = {
  isSuppressed: boolean
  effectiveN: number | null
  weeklyActivity: LearningAnalyticsWeeklyActivityV2[]
}

export type LearningAnalyticsActivitySummaryV2 = {
  activityIndex: number
  activityType: ActivityType.PRACTICE_QUIZ | ActivityType.MICRO_LEARNING
  effectiveN: number
  completionPercent: number
  correctPercent: number | null
}

export type LearningAnalyticsStudentSummaryV2 = {
  studentLabel: string
  completedActivities: number
  meanCompletionPercent: number
}

export type LearningAnalyticsStudentReportV2 = {
  isSuppressed: boolean
  effectiveN: number | null
  students: LearningAnalyticsStudentSummaryV2[]
}

export type CoursePerformanceAnalyticsV2 = {
  isSuppressed: boolean
  effectiveN: number | null
  activitySummaries: LearningAnalyticsActivitySummaryV2[]
  studentReport: LearningAnalyticsStudentReportV2
}

export type LearningAnalyticsExportFormatV2 = 'CSV' | 'JSON'

export type LearningAnalyticsExportV2 = {
  format: LearningAnalyticsExportFormatV2
  filename: string
  mimeType: string
  effectiveN: number
  content: string
}

export type WeeklyActivityInputV2 = {
  participantKey: string
  period: Date
}

export type ActivitySummaryInputV2 = {
  activityType: ActivityType.PRACTICE_QUIZ | ActivityType.MICRO_LEARNING
  participantCompletions: {
    participantKey: string
    completion: number
  }[]
}

export type StudentReportInput = {
  participantKey: string
  completions: number[]
}

function hasMinimumCellSize(count: number) {
  return count >= LEARNING_ANALYTICS_MINIMUM_CELL_SIZE
}

export function roundPercentToTen(value: number) {
  if (!Number.isFinite(value)) return 0

  return Math.round(Math.min(100, Math.max(0, value)) / 10) * 10
}

function mean(values: number[]) {
  if (values.length === 0) return 0

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function normalizeCompletion(value: number) {
  if (!Number.isFinite(value)) return 0

  return Math.min(1, Math.max(0, value))
}

export function buildCourseActivityAnalyticsV2({
  eligibleParticipantKeys,
  weeklyActivity,
}: {
  eligibleParticipantKeys: string[]
  weeklyActivity: WeeklyActivityInputV2[]
}): CourseActivityAnalyticsV2 {
  const eligibleParticipants = new Set(eligibleParticipantKeys)
  if (!hasMinimumCellSize(eligibleParticipants.size)) {
    return { isSuppressed: true, effectiveN: null, weeklyActivity: [] }
  }

  const weeklyCells = Array.from(
    weeklyActivity.reduce<Map<number, Set<string>>>((cells, row) => {
      if (!eligibleParticipants.has(row.participantKey)) return cells

      const period = row.period.getTime()
      const participants = cells.get(period) ?? new Set<string>()
      participants.add(row.participantKey)
      cells.set(period, participants)
      return cells
    }, new Map())
  )
    .sort(([firstPeriod], [secondPeriod]) => firstPeriod - secondPeriod)
    .map(([, participants]) => participants.size)
    .filter(hasMinimumCellSize)

  return {
    isSuppressed: false,
    effectiveN: eligibleParticipants.size,
    weeklyActivity: weeklyCells.map((effectiveN, index) => ({
      periodIndex: index + 1,
      effectiveN,
    })),
  }
}

export function buildLearningAnalyticsStudentReportV2(
  rows: StudentReportInput[],
  nextRandomInt: (max: number) => number = randomInt
): LearningAnalyticsStudentReportV2 {
  const reportRows = Array.from(
    rows.reduce<Map<string, number[]>>((participants, row) => {
      if (row.completions.length === 0) return participants

      const completions = participants.get(row.participantKey) ?? []
      completions.push(...row.completions)
      participants.set(row.participantKey, completions)
      return participants
    }, new Map()),
    ([participantKey, completions]) => ({ participantKey, completions })
  )
  if (!hasMinimumCellSize(reportRows.length)) {
    return { isSuppressed: true, effectiveN: null, students: [] }
  }

  const shuffledRows = [...reportRows]
  for (let index = shuffledRows.length - 1; index > 0; index--) {
    const randomIndex = nextRandomInt(index + 1)
    ;[shuffledRows[index], shuffledRows[randomIndex]] = [
      shuffledRows[randomIndex]!,
      shuffledRows[index]!,
    ]
  }

  return {
    isSuppressed: false,
    effectiveN: reportRows.length,
    students: shuffledRows.map((row, index) => ({
      studentLabel: `Student ${index + 1}`,
      completedActivities: row.completions.filter(
        (completion) => normalizeCompletion(completion) >= 1
      ).length,
      meanCompletionPercent: roundPercentToTen(
        mean(
          row.completions.map(
            (completion) => normalizeCompletion(completion) * 100
          )
        )
      ),
    })),
  }
}

export function buildCoursePerformanceAnalyticsV2({
  eligibleParticipantKeys,
  activities,
  nextRandomInt,
}: {
  eligibleParticipantKeys: string[]
  activities: ActivitySummaryInputV2[]
  nextRandomInt?: (max: number) => number
}): CoursePerformanceAnalyticsV2 {
  const eligibleParticipants = new Set(eligibleParticipantKeys)
  if (!hasMinimumCellSize(eligibleParticipants.size)) {
    return {
      isSuppressed: true,
      effectiveN: null,
      activitySummaries: [],
      studentReport: {
        isSuppressed: true,
        effectiveN: null,
        students: [],
      },
    }
  }

  const studentCompletions = new Map<string, number[]>()
  const eligibleActivities = activities.map((activity) => {
    const completions = Array.from(
      activity.participantCompletions.reduce<Map<string, number>>(
        (participantCompletions, row) => {
          if (!eligibleParticipants.has(row.participantKey)) {
            return participantCompletions
          }

          participantCompletions.set(
            row.participantKey,
            normalizeCompletion(row.completion)
          )
          return participantCompletions
        },
        new Map()
      )
    )

    for (const [participantKey, completion] of completions) {
      const participantCompletions =
        studentCompletions.get(participantKey) ?? []
      participantCompletions.push(completion)
      studentCompletions.set(participantKey, participantCompletions)
    }

    return { activityType: activity.activityType, completions }
  })
  const disclosedActivities = eligibleActivities.filter((activity) =>
    hasMinimumCellSize(activity.completions.length)
  )
  const studentReport = buildLearningAnalyticsStudentReportV2(
    Array.from(studentCompletions, ([participantKey, completions]) => ({
      participantKey,
      completions,
    })),
    nextRandomInt
  )

  if (studentReport.isSuppressed) {
    return {
      isSuppressed: true,
      effectiveN: null,
      activitySummaries: [],
      studentReport,
    }
  }

  return {
    isSuppressed: false,
    effectiveN: studentReport.effectiveN,
    activitySummaries: disclosedActivities.map((activity, index) => ({
      activityIndex: index + 1,
      activityType: activity.activityType,
      effectiveN: activity.completions.length,
      completionPercent: roundPercentToTen(
        mean(activity.completions.map(([, completion]) => completion * 100))
      ),
      // Existing aggregate correctness rows cannot prove identity-equivalent
      // membership with this currently eligible activity cohort.
      correctPercent: null,
    })),
    studentReport,
  }
}

export function buildLearningAnalyticsExportV2(
  report: LearningAnalyticsStudentReportV2,
  format: LearningAnalyticsExportFormatV2
): LearningAnalyticsExportV2 | null {
  if (report.isSuppressed || report.effectiveN === null) return null

  if (format === 'JSON') {
    return {
      format,
      filename: 'learning-analytics-student-report.json',
      mimeType: 'application/json',
      effectiveN: report.effectiveN,
      content: JSON.stringify({
        schemaVersion: 'v2',
        effectiveN: report.effectiveN,
        students: report.students.map((student) => ({
          studentLabel: student.studentLabel,
          completedActivities: student.completedActivities,
          meanCompletionPercent: student.meanCompletionPercent,
        })),
      }),
    }
  }

  const header = 'studentLabel,completedActivities,meanCompletionPercent'
  const rows = report.students.map(
    (student) =>
      `${student.studentLabel},${student.completedActivities},${student.meanCompletionPercent}`
  )

  return {
    format,
    filename: 'learning-analytics-student-report.csv',
    mimeType: 'text/csv',
    effectiveN: report.effectiveN,
    content: [
      'schemaVersion,v2',
      `effectiveN,${report.effectiveN}`,
      header,
      ...rows,
    ].join('\n'),
  }
}
