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
  const text = typeof value === 'number' ? String(value) : String(value)
  return /[",;\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(rows: Cell[][]): string {
  // BOM so spreadsheet tools read UTF-8 (level labels, umlauts) correctly.
  return `﻿${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

const round = (value: number | null | undefined, digits = 3) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(digits))
    : null

const date = (value: unknown) =>
  value ? new Date(value as string).toISOString() : null

const reasonText = (
  reasons: AdaptiveAttemptSummaryData['ratingReasons']
): string =>
  reasons
    .map(({ code, nodeName, value }) =>
      [code, nodeName, value ?? undefined]
        .filter((part) => part != null)
        .join(':')
    )
    .join(' | ')

/** One row per attempt; one column group per competence (by name). */
export function buildAttemptSummaryCsv(
  attempts: readonly AdaptiveAttemptSummaryData[]
): string {
  const competenceNames = [
    ...new Set(
      attempts.flatMap(({ competences }) => competences.map(({ name }) => name))
    ),
  ]
  const header: Cell[] = [
    'attempt_code',
    'participant_code',
    'attempt_number',
    'started_at',
    'completed_at',
    'elapsed_seconds',
    'stop_reason',
    'answers',
    'rating',
    'rating_reasons',
    'overall_level',
    'overall_lower_level',
    'overall_upper_level',
    'overall_determined',
    'overall_theta',
    'overall_standard_error',
    ...competenceNames.flatMap((name) => [
      `${name} level`,
      `${name} lower_level`,
      `${name} upper_level`,
      `${name} determined`,
      `${name} answers`,
      `${name} theta`,
      `${name} standard_error`,
      `${name} weight_share`,
    ]),
  ]
  const rows = attempts.map((attempt) => {
    const byName = new Map(
      attempt.competences.map((competence) => [competence.name, competence])
    )
    return [
      attempt.attemptCode,
      attempt.participantCode,
      attempt.attemptNumber,
      date(attempt.startedAt),
      date(attempt.completedAt),
      attempt.elapsedSeconds,
      attempt.stopReason,
      attempt.answerCount,
      attempt.rating,
      reasonText(attempt.ratingReasons),
      attempt.overall.levelLabel,
      attempt.overall.lowerLevelLabel,
      attempt.overall.upperLevelLabel,
      attempt.overall.determined,
      round(attempt.overall.theta),
      round(attempt.overall.standardError),
      ...competenceNames.flatMap((name) => {
        const competence = byName.get(name)
        return [
          competence?.levelLabel,
          competence?.lowerLevelLabel,
          competence?.upperLevelLabel,
          competence?.determined,
          competence?.responseCount,
          round(competence?.theta),
          round(competence?.standardError),
          round(competence?.weightShare),
        ]
      }),
    ]
  })
  return toCsv([header, ...rows])
}

/** One row per answer of one attempt, with the replay columns when present. */
export function buildAttemptAnswersCsv(
  detail: AdaptiveAttemptDetailData
): string {
  const replayByOrder = new Map(
    (detail.replay?.answers ?? []).map((answer) => [answer.order, answer])
  )
  const header: Cell[] = [
    'attempt_code',
    'order',
    'competence',
    'subcompetence',
    'node_path',
    'element',
    'item_level',
    'difficulty',
    'discrimination',
    'guessing',
    'correct',
    'score',
    'overall_theta_after',
    'distance_to_final_competence_level',
    'phase_derived',
    'competence_level_before',
    'competence_theta_before',
    'distance_to_competence_level_before',
    'competence_level_after',
    'competence_theta_after',
    'competence_standard_error_after',
    'competence_lower_level_after',
    'competence_upper_level_after',
    'replay_matches',
  ]
  const rows = detail.answers.map((answer) => {
    const replay = replayByOrder.get(answer.order)
    return [
      detail.summary.attemptCode,
      answer.order,
      answer.competenceName,
      answer.subcompetenceName,
      answer.nodeNamePath.join(' > '),
      answer.elementTitle,
      answer.itemLevelLabel,
      round(answer.difficulty),
      round(answer.discrimination),
      round(answer.guessing),
      answer.correct,
      round(answer.score),
      round(answer.overallThetaAfter),
      answer.levelDistance,
      replay?.phase,
      replay?.competenceLevelBefore,
      round(replay?.competenceThetaBefore),
      replay?.levelDistanceBefore,
      replay?.competenceLevelAfter,
      round(replay?.competenceThetaAfter),
      round(replay?.competenceStandardErrorAfter),
      replay?.competenceLowerLevelAfter,
      replay?.competenceUpperLevelAfter,
      replay ? replay.replayMatches : null,
    ]
  })
  return toCsv([header, ...rows])
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
