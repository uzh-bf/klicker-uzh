export const CORRELATED_LIVE_QUIZ_EXPORT_WARNING =
  'Respondent labels in this export are randomly assigned; names, account identifiers, usernames, temporary pseudonyms, timestamps, and free-text answers are not included.'

export const DEFAULT_CORRELATED_LIVE_QUIZ_EXPORT_MAX_BYTES = 5 * 1024 * 1024

export class CorrelatedLiveQuizExportSizeError extends Error {}

export interface CorrelatedLiveQuizExportQuestion {
  blockOrder: number
  questionOrder: number
  instanceId: number
  executions: number[]
}

export interface CorrelatedLiveQuizExportResponse {
  respondentLabel: number
  instanceId: number
  blockExecution: number
  response: unknown
  correctness: string
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
}

const CORRELATED_LIVE_QUIZ_EXPORT_COLUMN_SUFFIXES = [
  'response',
  'correct',
  'points',
] as const

function getColumnPrefix({
  blockOrder,
  questionOrder,
  execution,
}: {
  blockOrder: number
  questionOrder: number
  execution: number
}) {
  return `block_${String(blockOrder + 1).padStart(2, '0')}_question_${String(questionOrder + 1).padStart(2, '0')}_execution_${String(execution + 1).padStart(2, '0')}`
}

export function getCorrelatedLiveQuizResponseCsvHeaderByteLength({
  questions,
}: {
  questions: CorrelatedLiveQuizExportQuestion[]
}) {
  let byteLength = Buffer.byteLength('\uFEFFrespondent', 'utf8')
  for (const question of questions) {
    for (const execution of question.executions) {
      const prefix = getColumnPrefix({ ...question, execution })
      for (const suffix of CORRELATED_LIVE_QUIZ_EXPORT_COLUMN_SUFFIXES) {
        byteLength += Buffer.byteLength(`,${prefix}_${suffix}`, 'utf8')
      }
    }
  }
  return byteLength + Buffer.byteLength('\r\n', 'utf8')
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    )
  }
  return value
}

function encodeResponse(response: unknown): string {
  if (!response || typeof response !== 'object') {
    return response == null ? '' : String(response)
  }

  if ('choices' in response) {
    const choices = Array.isArray(response.choices)
      ? response.choices.map((choice) => {
          if (!choice || typeof choice !== 'object' || Array.isArray(choice)) {
            return null
          }

          const { ix, selected } = choice as {
            ix?: unknown
            selected?: unknown
          }
          return {
            ix,
            ...(typeof selected === 'undefined' ? {} : { selected }),
          }
        })
      : []
    return JSON.stringify(canonicalize(choices))
  }
  if ('selection' in response) {
    return JSON.stringify(canonicalize(response.selection))
  }
  if ('assessment' in response) {
    return JSON.stringify(canonicalize(response.assessment))
  }
  if ('viewed' in response) {
    return String(response.viewed)
  }
  if ('value' in response) {
    const value = response.value
    return value == null ? '' : String(value)
  }

  return JSON.stringify(canonicalize(response))
}

function escapeCsvValue(value: unknown): string {
  if (value == null) return ''

  const stringValue = String(value)
  const sanitized =
    typeof value === 'string' && /^\s*[=+\-@]/.test(stringValue)
      ? `'${stringValue}`
      : stringValue
  if (/[\r\n",]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`
  }
  return sanitized
}

function sanitizeFilenamePart(value: string) {
  const sanitized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return sanitized || 'quiz'
}

export function createCorrelatedLiveQuizResponseCsv({
  quizName,
  questions,
  responses,
}: {
  quizName: string
  questions: CorrelatedLiveQuizExportQuestion[]
  responses: CorrelatedLiveQuizExportResponse[]
}) {
  const columns = questions
    .flatMap((question) =>
      question.executions.map((execution) => ({
        ...question,
        execution,
        key: `${question.instanceId}:${execution}`,
        prefix: getColumnPrefix({ ...question, execution }),
      }))
    )
    .sort(
      (left, right) =>
        left.blockOrder - right.blockOrder ||
        left.questionOrder - right.questionOrder ||
        left.execution - right.execution
    )

  const orderedRespondentLabels = [
    ...new Set(responses.map(({ respondentLabel }) => respondentLabel)),
  ].sort((left, right) => left - right)

  const responseByRespondentAndColumn = new Map<
    string,
    CorrelatedLiveQuizExportResponse
  >()
  for (const response of responses) {
    const key = `${response.respondentLabel}:${response.instanceId}:${response.blockExecution}`
    if (!responseByRespondentAndColumn.has(key)) {
      responseByRespondentAndColumn.set(key, response)
    }
  }

  const headers = [
    'respondent',
    ...columns.flatMap(({ prefix }) =>
      CORRELATED_LIVE_QUIZ_EXPORT_COLUMN_SUFFIXES.map(
        (suffix) => `${prefix}_${suffix}`
      )
    ),
  ]

  const lines = [headers.map(escapeCsvValue).join(',')]
  let byteLength = Buffer.byteLength(`\uFEFF${lines[0]}\r\n`, 'utf8')
  if (byteLength > DEFAULT_CORRELATED_LIVE_QUIZ_EXPORT_MAX_BYTES) {
    throw new CorrelatedLiveQuizExportSizeError(
      `Correlated live quiz export exceeds ${DEFAULT_CORRELATED_LIVE_QUIZ_EXPORT_MAX_BYTES} bytes`
    )
  }

  for (const label of orderedRespondentLabels) {
    const row = [
      `respondent_${String(label).padStart(3, '0')}`,
      ...columns.flatMap(({ key }) => {
        const response = responseByRespondentAndColumn.get(`${label}:${key}`)
        if (!response) return ['', '', '']

        const totalPoints =
          response.basePoints +
          response.correctnessPoints +
          response.bonusPoints
        return [
          encodeResponse(response.response),
          response.correctness,
          Number.isFinite(totalPoints) ? totalPoints : 0,
        ]
      }),
    ]
    const line = row.map(escapeCsvValue).join(',')
    byteLength += Buffer.byteLength(`${line}\r\n`, 'utf8')
    if (byteLength > DEFAULT_CORRELATED_LIVE_QUIZ_EXPORT_MAX_BYTES) {
      throw new CorrelatedLiveQuizExportSizeError(
        `Correlated live quiz export exceeds ${DEFAULT_CORRELATED_LIVE_QUIZ_EXPORT_MAX_BYTES} bytes`
      )
    }
    lines.push(line)
  }

  const csv = `\uFEFF${lines.join('\r\n')}\r\n`

  return {
    csv,
    filename: `live-quiz-${sanitizeFilenamePart(quizName)}-responses.csv`,
    warning: CORRELATED_LIVE_QUIZ_EXPORT_WARNING,
  }
}
