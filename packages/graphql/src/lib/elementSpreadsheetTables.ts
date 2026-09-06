// These headers are the version-1 interchange contract. Keep them independent
// of UI translations so workbooks remain portable between lecturer locales.
export const ELEMENT_SPREADSHEET_VERSION = 'klicker-elements-1'
export const ELEMENT_SPREADSHEET_TABLES = {
  Elements: [
    'ref',
    'type',
    'name',
    'content',
    'explanation',
    'basePoints',
    'pointsMultiplier',
    'hasSampleSolution',
    'displayMode',
    'hasAnswerFeedbacks',
    'unit',
    'accuracy',
    'placeholder',
    'minimum',
    'maximum',
    'maxLength',
    'numberOfInputs',
    'answerCollectionRef',
  ],
  Choices: ['elementRef', 'order', 'value', 'correct', 'feedback'],
  Solutions: ['elementRef', 'order', 'value', 'minimum', 'maximum'],
  Collections: ['ref', 'name', 'description'],
  Entries: ['collectionRef', 'ref', 'value'],
  SelectedItems: ['elementRef', 'entryRef'],
  Criteria: [
    'elementRef',
    'ref',
    'order',
    'name',
    'minimum',
    'maximum',
    'step',
    'unit',
    'labelMin',
    'labelMid',
    'labelMax',
  ],
  Cases: ['elementRef', 'ref', 'order', 'title', 'description'],
  CaseSolutions: [
    'elementRef',
    'caseRef',
    'entryRef',
    'criterionRef',
    'minimum',
    'maximum',
  ],
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
    Object.keys(ELEMENT_SPREADSHEET_TABLES).map((name) => [
      name,
      [] as SpreadsheetRow[],
    ])
  ) as ElementSpreadsheetTables
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
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SpreadsheetCellError(field, 'INVALID_VALUE', row)
  }
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
