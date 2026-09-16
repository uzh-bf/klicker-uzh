// The workbook is an authoring template, not the portable export format.
export const ELEMENT_SPREADSHEET_VERSION = 'klicker-elements-3'
export const ELEMENT_SPREADSHEET_HEADER_ROW = 6
export const ELEMENT_SPREADSHEET_DATA_ROW = 8
export const ELEMENT_SPREADSHEET_EDIT_ROWS = 1000
const common = ['ref', 'name', 'content', 'explanation'] as const
const question = [
  ...common,
  'basePoints',
  'pointsMultiplier',
  'hasSampleSolution',
] as const
const choices = [
  ...question,
  'displayMode',
  'hasAnswerFeedbacks',
  'answer',
  'correct',
  'feedback',
] as const
export const ELEMENT_SPREADSHEET_TABLES = {
  'Single choice': choices,
  'Multiple choice': choices,
  Kprim: choices,
  Numerical: [
    ...question,
    'unit',
    'accuracy',
    'placeholder',
    'minimum',
    'maximum',
    'solutionMode',
    'solution',
    'solutionMinimum',
    'solutionMaximum',
  ],
  'Free text': [...question, 'maxLength', 'solution'],
  Content: common,
  Flashcards: common,
} as const
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
  if (value === 'TRUE') return true
  if (value === 'FALSE') return false
  throw new SpreadsheetCellError(field, 'INVALID_VALUE', row)
}
export function hasSpreadsheetValue(value: SpreadsheetValue | undefined) {
  return value !== undefined && value !== null && value !== ''
}
export const SPREADSHEET_DETAIL_FIELDS = new Set([
  'answer',
  'correct',
  'feedback',
  'solution',
  'solutionMinimum',
  'solutionMaximum',
])
