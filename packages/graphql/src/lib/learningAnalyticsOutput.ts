import { randomInt } from 'node:crypto'

export const LEARNING_ANALYTICS_MIN_SAMPLE_SIZE = 5

export type LearningAnalyticsCoverage = 'COMPLETE' | 'PARTIAL'

export type LearningAnalyticsParticipantActivity = {
  id: number
  activityId: string
  totalScore: number
  completion: number
}

export type LearningAnalyticsParticipantRow = {
  participantId: string
  coverage: LearningAnalyticsCoverage
  activityPerformances: LearningAnalyticsParticipantActivity[]
}

export type DeidentifiedLearningAnalyticsRow = {
  studentLabel: string
  coverage: LearningAnalyticsCoverage
  activityPerformances: LearningAnalyticsParticipantActivity[]
}

export type DeidentifiedLearningAnalyticsSummary = {
  studentLabel: string
  coverage: LearningAnalyticsCoverage
  completedActivities: number
  meanCompletion: number
}

type UnlabelledLearningAnalyticsRow = Omit<
  DeidentifiedLearningAnalyticsRow,
  'studentLabel'
>

export function meetsLearningAnalyticsMinimumSampleSize(effectiveN: number) {
  return effectiveN >= LEARNING_ANALYTICS_MIN_SAMPLE_SIZE
}

export function deidentifyLearningAnalyticsRows({
  rows,
  activityIds,
  includePartial = true,
  nextRandomInt = randomInt,
}: {
  rows: LearningAnalyticsParticipantRow[]
  activityIds: string[]
  includePartial?: boolean
  nextRandomInt?: (max: number) => number
}): {
  effectiveN: number
  rows: DeidentifiedLearningAnalyticsRow[]
} {
  const selectedActivityIds = new Set(activityIds)
  const filteredRows = rows.flatMap((row) => {
    const activityPerformances = row.activityPerformances.filter(
      (performance) => selectedActivityIds.has(performance.activityId)
    )
    if (activityPerformances.length === 0) {
      return []
    }

    if (!includePartial && row.coverage === 'PARTIAL') {
      return []
    }

    return [{ activityPerformances, coverage: row.coverage }]
  })

  if (!meetsLearningAnalyticsMinimumSampleSize(filteredRows.length)) {
    return { effectiveN: filteredRows.length, rows: [] }
  }

  return randomizeLearningAnalyticsRows(filteredRows, nextRandomInt)
}

export function randomizeLearningAnalyticsRows(
  rows: UnlabelledLearningAnalyticsRow[],
  nextRandomInt: (max: number) => number = randomInt
) {
  const labelledRows = assignLearningAnalyticsStudentLabels(rows, nextRandomInt)
  return {
    effectiveN: labelledRows.length,
    rows: labelledRows,
  }
}

export function assignLearningAnalyticsStudentLabels<T extends object>(
  rows: T[],
  nextRandomInt: (max: number) => number = randomInt
): (T & { studentLabel: string })[] {
  const shuffledRows = [...rows]
  for (let index = shuffledRows.length - 1; index > 0; index--) {
    const swapIndex = nextRandomInt(index + 1)
    const current = shuffledRows[index]!
    shuffledRows[index] = shuffledRows[swapIndex]!
    shuffledRows[swapIndex] = current
  }

  return shuffledRows.map((row, index) => ({
    studentLabel: `Student ${index + 1}`,
    ...row,
  }))
}

function escapeCsvCell(value: string | number) {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function summarizeLearningAnalyticsRows(
  rows: DeidentifiedLearningAnalyticsRow[]
): DeidentifiedLearningAnalyticsSummary[] {
  return rows.map((row) => {
    const completedActivities = row.activityPerformances.filter(
      (performance) => performance.completion === 1
    ).length
    const meanCompletion =
      row.activityPerformances.reduce(
        (sum, performance) => sum + performance.completion,
        0
      ) / row.activityPerformances.length

    return {
      studentLabel: row.studentLabel,
      coverage: row.coverage,
      completedActivities,
      meanCompletion: Math.round(meanCompletion * 10) / 10,
    }
  })
}

export function buildLearningAnalyticsCsv({
  rows,
  effectiveN,
  includesPartial,
}: {
  rows: DeidentifiedLearningAnalyticsSummary[]
  effectiveN: number
  includesPartial: boolean
}) {
  const header = [
    'studentLabel',
    'coverage',
    'completedActivities',
    'meanCompletion',
  ]
  const dataRows = rows.map((row) => [
    row.studentLabel,
    row.coverage,
    row.completedActivities,
    row.meanCompletion,
  ])

  return [
    ['metadata', 'value'],
    ['coverage', includesPartial ? 'complete_and_partial' : 'complete_only'],
    ['effectiveN', effectiveN],
    [],
    header,
    ...dataRows,
  ]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n')
}
