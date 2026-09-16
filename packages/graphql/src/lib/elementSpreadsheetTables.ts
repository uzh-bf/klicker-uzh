// Template capacities keep Excel manageable; SC/MC have no application-wide cap.
export const ELEMENT_SPREADSHEET_VERSION = 'klicker-elements-4'
export const ELEMENT_SPREADSHEET_HEADER_ROW = 6
export const ELEMENT_SPREADSHEET_DATA_ROW = 8
export const ELEMENT_SPREADSHEET_EDIT_ROWS = 1000
export const ELEMENT_SPREADSHEET_ANSWER_SLOTS = 10
export const ELEMENT_SPREADSHEET_SOLUTION_SLOTS = 6
export const spreadsheetSlots = (count: number) =>
  Array.from({ length: count }, (_, index) => index + 1)
const common = ['name', 'content']
const settings = ['explanation', 'basePoints', 'pointsMultiplier']
const choices = (count: number) => [
  ...common,
  'hasSampleSolution',
  ...spreadsheetSlots(count).flatMap((slot) => [
    `answer${slot}`,
    `correct${slot}`,
  ]),
  ...settings,
  'displayMode',
  'hasAnswerFeedbacks',
  ...spreadsheetSlots(count).map((slot) => `feedback${slot}`),
]
export const ELEMENT_SPREADSHEET_TABLES = {
  'Single choice': choices(ELEMENT_SPREADSHEET_ANSWER_SLOTS),
  'Multiple choice': choices(ELEMENT_SPREADSHEET_ANSWER_SLOTS),
  Kprim: choices(4),
  Numerical: [
    ...common,
    'hasSampleSolution',
    'solutionMode',
    ...spreadsheetSlots(ELEMENT_SPREADSHEET_SOLUTION_SLOTS).flatMap((slot) => [
      `solution${slot}`,
      `solutionMinimum${slot}`,
      `solutionMaximum${slot}`,
    ]),
    ...settings,
    'unit',
    'accuracy',
    'placeholder',
    'minimum',
    'maximum',
  ],
  'Free text': [
    ...common,
    'hasSampleSolution',
    ...spreadsheetSlots(ELEMENT_SPREADSHEET_SOLUTION_SLOTS).map(
      (slot) => `solution${slot}`
    ),
    ...settings,
    'maxLength',
  ],
  Content: [...common, 'explanation'],
  Flashcards: [...common, 'explanation'],
} as const
export function spreadsheetColumnLabel(field: string, sheet?: string): string {
  const numbered =
    /^(answer|correct|feedback|solutionMinimum|solutionMaximum|solution)(\d+)$/.exec(
      field
    )
  if (numbered) {
    const label: Record<string, string> = {
      answer: sheet === 'Kprim' ? 'Statement' : 'Answer',
      correct: sheet === 'Kprim' ? 'Statement true?' : 'Correct?',
      feedback: 'Feedback',
      solution: 'Accepted answer',
      solutionMinimum: 'Range minimum',
      solutionMaximum: 'Range maximum',
    }
    return numbered[1] === 'correct'
      ? `${sheet === 'Kprim' ? 'Statement' : 'Correct'} ${numbered[2]}${sheet === 'Kprim' ? ' true' : ''}?`
      : `${label[numbered[1]!]} ${numbered[2]}`
  }
  const labels: Record<string, string> = {
    name: 'Name',
    content:
      sheet === 'Flashcards'
        ? 'Front'
        : sheet === 'Content'
          ? 'Content'
          : 'Question',
    explanation: sheet === 'Flashcards' ? 'Back' : 'Explanation',
    basePoints: 'Participation points',
    pointsMultiplier: 'Points multiplier',
    hasSampleSolution: 'Sample solution?',
    hasAnswerFeedbacks: 'Answer feedback?',
    displayMode: 'Answer layout',
    unit: 'Unit',
    accuracy: 'Decimal places',
    placeholder: 'Input hint',
    minimum: 'Minimum allowed',
    maximum: 'Maximum allowed',
    solutionMode: 'Solution type',
    maxLength: 'Maximum answer length',
  }
  return labels[field] ?? field
}
export const ELEMENT_SPREADSHEET_TYPES = {
  'Single choice': 'SC',
  'Multiple choice': 'MC',
  Kprim: 'KPRIM',
  Numerical: 'NUMERICAL',
  'Free text': 'FREE_TEXT',
  Content: 'CONTENT',
  Flashcards: 'FLASHCARD',
} as const
export type ElementSpreadsheetTable = keyof typeof ELEMENT_SPREADSHEET_TABLES
export type SpreadsheetValue = string | number | boolean | null
export type SpreadsheetRow = {
  sheet: ElementSpreadsheetTable
  row: number
  values: Record<string, SpreadsheetValue>
}
export type SpreadsheetIssue = {
  sheet: string
  row: number
  ref: string | null
  field: string
  code: string
}
export type ElementSpreadsheetTables = Record<
  ElementSpreadsheetTable,
  SpreadsheetRow[]
>
export function emptyElementSpreadsheetTables(): ElementSpreadsheetTables {
  return Object.fromEntries(
    Object.keys(ELEMENT_SPREADSHEET_TABLES).map((name) => [name, []])
  ) as unknown as ElementSpreadsheetTables
}
export class SpreadsheetCellError extends Error {
  constructor(
    readonly field: string,
    readonly code = 'INVALID_VALUE',
    readonly source?: SpreadsheetRow
  ) {
    super(code)
  }
}
export function textCell(
  row: SpreadsheetRow,
  field: string,
  fallback?: string
) {
  const value = row.values[field]
  if ((value == null || value === '') && fallback !== undefined) return fallback
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string')
    throw new SpreadsheetCellError(field, 'INVALID_VALUE', row)
  return value
}
export function numberCell(
  row: SpreadsheetRow,
  field: string,
  fallback?: number
) {
  const value = row.values[field]
  if (value == null || value === '') return fallback
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new SpreadsheetCellError(field, 'INVALID_VALUE', row)
  return value
}
export function booleanCell(
  row: SpreadsheetRow,
  field: string,
  fallback = false
) {
  const value = row.values[field]
  if (value == null || value === '') return fallback
  if (typeof value === 'boolean') return value
  if (value === 'TRUE' || value === 'Yes') return true
  if (value === 'FALSE' || value === 'No') return false
  throw new SpreadsheetCellError(field, 'INVALID_VALUE', row)
}
export function hasSpreadsheetValue(value: SpreadsheetValue | undefined) {
  return value !== undefined && value !== null && value !== ''
}
