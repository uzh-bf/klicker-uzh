import type {
  QAdaptivePracticeQuizAttemptDiagnosticQuery,
  QAdaptivePracticeQuizAttemptDiagnosticsQuery,
} from '@klicker-uzh/graphql/dist/ops'

export type AdaptiveAttemptSummaryData = NonNullable<
  QAdaptivePracticeQuizAttemptDiagnosticsQuery['adaptivePracticeQuizAttemptDiagnostics']
>['attempts'][number]

export type AdaptiveAttemptDetailData = NonNullable<
  QAdaptivePracticeQuizAttemptDiagnosticQuery['adaptivePracticeQuizAttemptDiagnostic']
>

type Cell = string | number | boolean | null | undefined

/** RFC 4180 cell: quoted when it contains a separator, quote or newline. */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",;\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(rows: Cell[][]): string {
  // BOM so spreadsheet tools read UTF-8 (level labels, accents) correctly.
  return `﻿${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

const round = (value: number | null | undefined, digits = 3) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(digits))
    : null

const range = (
  lower: string | null | undefined,
  upper: string | null | undefined
) => (lower && upper ? (lower === upper ? lower : `${lower} - ${upper}`) : null)

const date = (value: unknown) =>
  value ? new Date(value as string).toISOString() : null

const ANSWER_HEADER: Cell[] = [
  'participant_code',
  'attempt_code',
  'attempt_number',
  'completed_at',
  'order',
  'competence',
  'subcompetence',
  'element',
  'item_level',
  'item_difficulty',
  'correct',
  'score',
  'phase_derived',
  'theta_before',
  'standard_error_before',
  'level_before',
  'item_minus_level_before',
  'theta_after',
  'standard_error_after',
  'level_after',
  'likely_range_after',
  'competence_final_level',
  'competence_final_range',
  'competence_final_determined',
  'overall_final_level',
  'overall_final_range',
  'overall_final_determined',
  'rating',
  'review_verdict',
  'review_expected_overall_level',
  'review_expected_competence_level',
  'review_comment',
]

/**
 * One row per answered question, for every given attempt: the item, the
 * stored competence estimate before and after the answer (theta, standard
 * error, level), the attempt's final results and the lecturer review. Final
 * results and review repeat on each row so the sheet can be filtered freely.
 */
export function buildAttemptAnswersCsv(
  attempts: readonly AdaptiveAttemptSummaryData[]
): string {
  const rows = attempts.flatMap((attempt) => {
    const competenceByName = new Map(
      attempt.competences.map((competence) => [competence.name, competence])
    )
    const review = attempt.review
    return attempt.answers.map((answer) => {
      const competence = answer.competenceName
        ? competenceByName.get(answer.competenceName)
        : undefined
      const expectedCompetence = review?.expectedCompetenceLevels.find(
        ({ nodeId }) => nodeId === competence?.nodeId
      )
      return [
        attempt.participantCode,
        attempt.attemptCode,
        attempt.attemptNumber,
        date(attempt.completedAt),
        answer.order,
        answer.competenceName,
        answer.subcompetenceName,
        answer.elementTitle,
        answer.itemLevelLabel,
        round(answer.difficulty),
        answer.correct,
        round(answer.score),
        answer.phase,
        round(answer.competenceThetaBefore),
        round(answer.competenceStandardErrorBefore),
        answer.competenceLevelBefore,
        answer.levelDistanceBefore,
        round(answer.competenceThetaAfter),
        round(answer.competenceStandardErrorAfter),
        answer.competenceLevelAfter,
        range(
          answer.competenceLowerLevelAfter,
          answer.competenceUpperLevelAfter
        ),
        competence?.levelLabel,
        range(competence?.lowerLevelLabel, competence?.upperLevelLabel),
        competence?.determined,
        attempt.overall.levelLabel,
        range(attempt.overall.lowerLevelLabel, attempt.overall.upperLevelLabel),
        attempt.overall.determined,
        attempt.rating,
        review?.verdict,
        review?.expectedOverallLevelLabel,
        expectedCompetence?.levelLabel,
        review?.comment,
      ]
    })
  })
  return toCsv([ANSWER_HEADER, ...rows])
}

export function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/csv;charset=utf-8' })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
