export const CORRELATED_LIVE_QUIZ_EXPORT_WARNING =
  'Export uses random respondent labels and does not include names, emails, account ids, usernames, or temporary pseudonyms. Free-text answers may still contain personal data entered by participants.'

export const DEFAULT_CORRELATED_LIVE_QUIZ_EXPORT_MAX_BYTES = 5 * 1024 * 1024

export class CorrelatedLiveQuizExportSizeError extends Error {}

export interface CorrelatedLiveQuizExportQuestion {
  blockOrder: number
  questionOrder: number
  instanceId: number
  executions: number[]
}

export interface CorrelatedLiveQuizExportResponse {
  identityKey: string
  respondentLabel: number
  instanceId: number
  blockExecution: number
  response: unknown
  correctness: string
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
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

  if ('value' in response) {
    const value = response.value
    return value == null ? '' : String(value)
  }
  if ('viewed' in response) {
    return String(response.viewed)
  }
  if ('choices' in response) {
    return JSON.stringify(canonicalize(response.choices))
  }
  if ('selection' in response) {
    return JSON.stringify(canonicalize(response.selection))
  }
  if ('assessment' in response) {
    return JSON.stringify(canonicalize(response.assessment))
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
        prefix: `block_${String(question.blockOrder + 1).padStart(2, '0')}_question_${String(question.questionOrder + 1).padStart(2, '0')}_execution_${String(execution + 1).padStart(2, '0')}`,
      }))
    )
    .sort(
      (left, right) =>
        left.blockOrder - right.blockOrder ||
        left.questionOrder - right.questionOrder ||
        left.execution - right.execution
    )

  const orderedRespondents = [
    ...new Map(
      responses.map(({ identityKey, respondentLabel }) => [
        identityKey,
        { identityKey, label: respondentLabel },
      ])
    ).values(),
  ].sort(
    (left, right) =>
      left.label - right.label ||
      left.identityKey.localeCompare(right.identityKey)
  )

  const responseByIdentityAndColumn = new Map<
    string,
    CorrelatedLiveQuizExportResponse
  >()
  for (const response of responses) {
    const key = `${response.identityKey}:${response.instanceId}:${response.blockExecution}`
    if (!responseByIdentityAndColumn.has(key)) {
      responseByIdentityAndColumn.set(key, response)
    }
  }

  const headers = [
    'respondent',
    ...columns.flatMap(({ prefix }) => [
      `${prefix}_response`,
      `${prefix}_correct`,
      `${prefix}_points`,
    ]),
  ]

  const lines = [headers.map(escapeCsvValue).join(',')]
  let byteLength = Buffer.byteLength(`\uFEFF${lines[0]}\r\n`, 'utf8')
  if (byteLength > DEFAULT_CORRELATED_LIVE_QUIZ_EXPORT_MAX_BYTES) {
    throw new CorrelatedLiveQuizExportSizeError(
      `Correlated live quiz export exceeds ${DEFAULT_CORRELATED_LIVE_QUIZ_EXPORT_MAX_BYTES} bytes`
    )
  }

  for (const { identityKey, label } of orderedRespondents) {
    const row = [
      `respondent_${String(label).padStart(3, '0')}`,
      ...columns.flatMap(({ key }) => {
        const response = responseByIdentityAndColumn.get(
          `${identityKey}:${key}`
        )
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
