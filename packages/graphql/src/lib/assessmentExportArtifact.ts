import { createHash } from 'node:crypto'
import type { StudentAssessmentResultsItem } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'

export const assessmentExportColumns = [
  'participantEmail',
  'assessmentGivenName',
  'assessmentSurname',
  'assessmentMatriculationNumber',
  'basePoints',
  'correctnessPoints',
  'bonusPoints',
  'totalPoints',
] as const

type AssessmentExportColumn = (typeof assessmentExportColumns)[number]

function csvCell(value: string | number | null) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new GraphQLError('DATA_EXPORT_INVALID_RESULT', {
        extensions: { code: 'DATA_EXPORT_INVALID_RESULT' },
      })
    }
    return String(value)
  }
  let text = value ?? ''
  // Quoting alone does not prevent spreadsheet formula evaluation.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Spreadsheet formula prefixes can be preceded by control characters.
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) {
    text = `'${text}`
  }
  return `"${text.replaceAll('"', '""')}"`
}

export function buildAssessmentExportArtifact({
  rows,
  labels,
}: {
  rows: StudentAssessmentResultsItem[]
  labels: Record<AssessmentExportColumn, string>
}) {
  const lines = [
    assessmentExportColumns.map((key) => csvCell(labels[key])).join(';'),
  ]
  for (const row of rows) {
    const values = {
      ...row,
      totalPoints: row.basePoints + row.correctnessPoints + row.bonusPoints,
    }
    lines.push(
      assessmentExportColumns.map((key) => csvCell(values[key])).join(';')
    )
  }
  const body = `\uFEFF${lines.join('\r\n')}\r\n`
  return {
    body,
    sha256: createHash('sha256').update(body).digest('hex'),
    byteCount: Buffer.byteLength(body),
    recordCount: rows.length,
  }
}
