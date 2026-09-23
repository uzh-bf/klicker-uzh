import { parse } from 'csv-parse/sync'
import ExcelJS from 'exceljs'

export const ELEMENT_WORKBOOK_VERSION = 'klicker-elements-6'
export const MAX_ELEMENT_WORKBOOK_BYTES = 5 * 1024 * 1024
export const MAX_ELEMENT_WORKBOOK_ELEMENTS = 500
export const ELEMENT_WORKBOOK_HEADER_ROW = 6
export const ELEMENT_WORKBOOK_DATA_ROW = 8

const MAX_WORKSHEETS = 8
const MAX_ROWS = 10_000
const MAX_COLUMNS = 64
const MAX_CELLS = 100_000
const MAX_CELL_TEXT_LENGTH = 32_767
const MAX_EXPANDED_BYTES = 20 * 1024 * 1024
const MAX_ZIP_ENTRIES = 250
const MAX_TAGS = 50

const choiceFields = [
  'Name',
  'Question',
  'Sample solution?',
  ...Array.from({ length: 10 }, (_, index) => [
    `Answer ${index + 1}`,
    `Correct ${index + 1}?`,
  ]).flat(),
  'Explanation',
  'Participation points',
  'Points multiplier',
  'Answer layout',
  'Answer feedback?',
  ...Array.from({ length: 10 }, (_, index) => `Feedback ${index + 1}`),
  'Tags',
] as const

const flashcardFields = ['Name', 'Front', 'Back', 'Tags'] as const

export const ELEMENT_WORKBOOK_HEADERS = {
  'Single choice': [
    'Name',
    'Question',
    'Sample solution?',
    ...Array.from({ length: 10 }, (_, index) => [
      `Answer ${index + 1}`,
      `Correct ${index + 1}?`,
    ]).flat(),
    'Explanation',
    'Participation points',
    'Points multiplier',
    'Answer layout',
    'Answer feedback?',
    ...Array.from({ length: 10 }, (_, index) => `Feedback ${index + 1}`),
    'Tags',
  ],
  'Multiple choice': choiceFields,
  Kprim: [
    'Name',
    'Question',
    'Sample solution?',
    ...Array.from({ length: 4 }, (_, index) => [
      `Statement ${index + 1}`,
      `Statement ${index + 1} true?`,
    ]).flat(),
    'Explanation',
    'Participation points',
    'Points multiplier',
    'Answer layout',
    'Answer feedback?',
    ...Array.from({ length: 4 }, (_, index) => `Feedback ${index + 1}`),
    'Tags',
  ],
  Numerical: [
    'Name',
    'Question',
    'Sample solution?',
    'Solution type',
    ...Array.from({ length: 6 }, (_, index) => [
      `Accepted answer ${index + 1}`,
      `Range minimum ${index + 1}`,
      `Range maximum ${index + 1}`,
    ]).flat(),
    'Explanation',
    'Participation points',
    'Points multiplier',
    'Unit',
    'Decimal places',
    'Input hint',
    'Minimum allowed',
    'Maximum allowed',
    'Tags',
  ],
  'Free text': [
    'Name',
    'Question',
    'Sample solution?',
    ...Array.from({ length: 6 }, (_, index) => `Accepted answer ${index + 1}`),
    'Explanation',
    'Participation points',
    'Points multiplier',
    'Maximum answer length',
    'Tags',
  ],
  Content: ['Name', 'Content', 'Explanation', 'Tags'],
  Flashcards: flashcardFields,
} as const

type Choice = {
  ix: number
  value: string
  correct?: boolean
  feedback?: string
}

export type MultipleChoiceOptions = {
  displayMode: 'LIST' | 'GRID'
  hasSampleSolution: boolean
  hasAnswerFeedbacks: boolean
  choices: Choice[]
}

export type WorkbookElement = {
  sheet: string
  row: number
  name: string
  content: string
  explanation: string | null
  type: 'MC' | 'FLASHCARD'
  basePoints: boolean
  pointsMultiplier: number
  options: MultipleChoiceOptions | Record<string, never>
  tags: string[]
}

export class ElementWorkbookParseError extends Error {
  constructor(
    readonly code: string,
    readonly sheet?: string,
    readonly row?: number,
    readonly column?: string
  ) {
    super(
      [code, sheet && row && column ? `at ${sheet}!${column}${row}` : '']
        .filter(Boolean)
        .join(' ')
    )
  }
}

function columnName(column: number) {
  let value = column
  let name = ''
  while (value > 0) {
    value--
    name = String.fromCharCode(65 + (value % 26)) + name
    value = Math.floor(value / 26)
  }
  return name
}

function fail(
  code: string,
  sheet?: string,
  row?: number,
  column?: number
): never {
  throw new ElementWorkbookParseError(
    code,
    sheet,
    row,
    column === undefined ? undefined : columnName(column)
  )
}

/** Check ZIP metadata before ExcelJS expands any untrusted XML. */
function validateZip(buffer: Buffer) {
  if (buffer.length === 0 || buffer.length > MAX_ELEMENT_WORKBOOK_BYTES)
    fail('WORKBOOK_TOO_LARGE')

  const eocd = 0x06054b50
  let end = -1
  for (
    let offset = buffer.length - 22;
    offset >= Math.max(0, buffer.length - 65_557);
    offset--
  ) {
    if (buffer.readUInt32LE(offset) === eocd) {
      const commentLength = buffer.readUInt16LE(offset + 20)
      if (offset + 22 + commentLength === buffer.length) {
        end = offset
        break
      }
    }
  }
  if (end < 0) fail('INVALID_WORKBOOK')

  const entries = buffer.readUInt16LE(end + 10)
  const directorySize = buffer.readUInt32LE(end + 12)
  let offset = buffer.readUInt32LE(end + 16)
  if (entries > MAX_ZIP_ENTRIES || offset + directorySize !== end)
    fail('WORKBOOK_TOO_LARGE')

  let expanded = 0
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50)
      fail('INVALID_WORKBOOK')
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const uncompressedSize = buffer.readUInt32LE(offset + 24)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const nameEnd = offset + 46 + nameLength
    const next = nameEnd + extraLength + commentLength
    if (next > end || compressedSize > buffer.length) fail('INVALID_WORKBOOK')
    expanded += uncompressedSize
    if (expanded > MAX_EXPANDED_BYTES) fail('WORKBOOK_TOO_LARGE')
    const path = buffer.subarray(offset + 46, nameEnd).toString('utf8')
    if (/vbaProject|(?:^|\/)(?:embeddings|media)\//i.test(path))
      fail('UNSUPPORTED_WORKBOOK_CONTENT')
    offset = next
  }
  if (offset !== end) fail('INVALID_WORKBOOK')
}

function isEmpty(value: unknown) {
  return value === null || value === undefined || value === ''
}

function cellText(
  cell: ExcelJS.Cell,
  sheet: string,
  row: number,
  column: number
) {
  const value = cell.value
  if (isEmpty(value)) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'object' && value && 'richText' in value) {
    const text = value.richText.map((run) => run.text).join('')
    if (text.length > MAX_CELL_TEXT_LENGTH)
      fail('CELL_TOO_LONG', sheet, row, column)
    return text
  }
  fail('UNSUPPORTED_CELL', sheet, row, column)
}

function visibleCellValue(
  cell: ExcelJS.Cell,
  sheet: string,
  row: number,
  column: number
) {
  const value = cellText(cell, sheet, row, column)
  if (value.length > MAX_CELL_TEXT_LENGTH)
    fail('CELL_TOO_LONG', sheet, row, column)
  return value
}

function booleanValue(
  value: string,
  sheet: string,
  row: number,
  column: number,
  fallback: boolean
) {
  if (!value) return fallback
  if (value === 'Yes' || value === 'TRUE') return true
  if (value === 'No' || value === 'FALSE') return false
  fail('INVALID_BOOLEAN', sheet, row, column)
}

function required(value: string, sheet: string, row: number, column: number) {
  if (!value.trim()) fail('REQUIRED_VALUE', sheet, row, column)
  return value
}

function nameValue(value: string, sheet: string, row: number) {
  const name = required(value, sheet, row, 1)
  if (name.length > 255) fail('NAME_TOO_LONG', sheet, row, 1)
  return name
}

function parseTags(value: string, sheet: string, row: number, column: number) {
  if (!value.trim()) return []
  let values: string[]
  try {
    const records = parse(value, {
      delimiter: ';',
      quote: '"',
      escape: '"',
      relax_column_count: true,
      trim: true,
    })
    if (records.length !== 1) fail('INVALID_TAGS', sheet, row, column)
    values = records[0] ?? []
  } catch {
    fail('INVALID_TAGS', sheet, row, column)
  }
  const tags = [...new Set(values.map((tag) => tag.trim()).filter(Boolean))]
  if (tags.length > MAX_TAGS || tags.some((tag) => tag.length > 255))
    fail('INVALID_TAGS', sheet, row, column)
  return tags
}

function rowValues(
  sheet: ExcelJS.Worksheet,
  row: number,
  headers: readonly string[]
) {
  const values = headers.map((_, index) =>
    visibleCellValue(
      sheet.getRow(row).getCell(index + 1),
      sheet.name,
      row,
      index + 1
    )
  )
  sheet.getRow(row).eachCell((cell, column) => {
    if (column > headers.length && !isEmpty(cell.value))
      fail('UNEXPECTED_COLUMN', sheet.name, row, column)
  })
  return values
}

function validateSheet(
  workbook: ExcelJS.Workbook,
  name: keyof typeof ELEMENT_WORKBOOK_HEADERS
) {
  const sheet = workbook.getWorksheet(name)
  if (!sheet) fail('MISSING_WORKSHEET', name)
  const headers = ELEMENT_WORKBOOK_HEADERS[name]
  if (sheet.getImages().length) fail('EMBEDDED_IMAGES_UNSUPPORTED', name)
  if (sheet.rowCount > MAX_ROWS || sheet.columnCount > MAX_COLUMNS)
    fail('WORKBOOK_TOO_LARGE', name)
  let cells = 0
  sheet.eachRow((row, rowNumber) =>
    row.eachCell((cell, column) => {
      cells++
      if (cells > MAX_CELLS) fail('WORKBOOK_TOO_LARGE', name, rowNumber, column)
      visibleCellValue(cell, name, rowNumber, column)
    })
  )
  for (const [index, header] of headers.entries()) {
    if (
      visibleCellValue(
        sheet.getRow(ELEMENT_WORKBOOK_HEADER_ROW).getCell(index + 1),
        name,
        ELEMENT_WORKBOOK_HEADER_ROW,
        index + 1
      ) !== header
    )
      fail('INVALID_HEADERS', name, ELEMENT_WORKBOOK_HEADER_ROW, index + 1)
  }
  sheet.getRow(ELEMENT_WORKBOOK_HEADER_ROW).eachCell((cell, column) => {
    if (column > headers.length && !isEmpty(cell.value))
      fail('UNEXPECTED_COLUMN', name, ELEMENT_WORKBOOK_HEADER_ROW, column)
  })
  return sheet
}

function parseMultipleChoice(
  sheet: ExcelJS.Worksheet,
  row: number
): WorkbookElement {
  const values = rowValues(sheet, row, choiceFields)
  if (!values.some(Boolean)) fail('INVALID_ROW', sheet.name, row, 1)
  const hasSampleSolution = booleanValue(values[2]!, sheet.name, row, 3, false)
  const hasAnswerFeedbacks = booleanValue(
    values[27]!,
    sheet.name,
    row,
    28,
    false
  )
  if (hasAnswerFeedbacks && !hasSampleSolution)
    fail('DISABLED_SOLUTION_DATA', sheet.name, row, 28)
  const choices: Choice[] = []
  let gap = false
  for (let slot = 1; slot <= 10; slot++) {
    const answerColumn = 4 + (slot - 1) * 2
    const correctColumn = answerColumn + 1
    const feedbackColumn = 29 + slot - 1
    const answer = values[answerColumn - 1]!
    const correct = values[correctColumn - 1]!
    const feedback = values[feedbackColumn - 1]!
    if (!answer) {
      gap = true
      if (correct || feedback)
        fail(
          'ORPHAN_CHOICE_DATA',
          sheet.name,
          row,
          correct ? correctColumn : feedbackColumn
        )
      continue
    }
    if (gap) fail('NON_CONTIGUOUS_CHOICES', sheet.name, row, answerColumn)
    if (!hasSampleSolution && correct)
      fail('DISABLED_SOLUTION_DATA', sheet.name, row, correctColumn)
    if (!hasAnswerFeedbacks && feedback)
      fail('DISABLED_SOLUTION_DATA', sheet.name, row, feedbackColumn)
    choices.push({
      ix: choices.length,
      value: required(answer, sheet.name, row, answerColumn),
      ...(hasSampleSolution
        ? {
            correct: booleanValue(
              correct,
              sheet.name,
              row,
              correctColumn,
              false
            ),
          }
        : {}),
      ...(hasAnswerFeedbacks
        ? { feedback: required(feedback, sheet.name, row, feedbackColumn) }
        : {}),
    })
    if (hasSampleSolution && !correct)
      fail('REQUIRED_VALUE', sheet.name, row, correctColumn)
  }
  if (!choices.length) fail('REQUIRED_VALUE', sheet.name, row, 4)
  if (hasSampleSolution && !choices.some((choice) => choice.correct))
    fail('MC_CORRECT_REQUIRED', sheet.name, row, 5)
  const multiplierText = values[25]!
  const pointsMultiplier = multiplierText ? Number(multiplierText) : 1
  if (
    !Number.isInteger(pointsMultiplier) ||
    pointsMultiplier <= 0 ||
    pointsMultiplier > 2_147_483_647
  )
    fail('INVALID_MULTIPLIER', sheet.name, row, 26)
  const displayMode = values[26] || 'LIST'
  if (displayMode !== 'LIST' && displayMode !== 'GRID')
    fail('INVALID_DISPLAY_MODE', sheet.name, row, 27)
  return {
    sheet: sheet.name,
    row,
    name: nameValue(values[0]!, sheet.name, row),
    content: required(values[1]!, sheet.name, row, 2),
    explanation: values[23] || null,
    type: 'MC',
    basePoints: booleanValue(values[24]!, sheet.name, row, 25, true),
    pointsMultiplier,
    options: { hasSampleSolution, hasAnswerFeedbacks, displayMode, choices },
    tags: parseTags(values.at(-1)!, sheet.name, row, choiceFields.length),
  }
}

function parseFlashcard(
  sheet: ExcelJS.Worksheet,
  row: number
): WorkbookElement {
  const values = rowValues(sheet, row, flashcardFields)
  if (!values.some(Boolean)) fail('INVALID_ROW', sheet.name, row, 1)
  return {
    sheet: sheet.name,
    row,
    name: nameValue(values[0]!, sheet.name, row),
    content: required(values[1]!, sheet.name, row, 2),
    explanation: required(values[2]!, sheet.name, row, 3),
    type: 'FLASHCARD',
    basePoints: false,
    pointsMultiplier: 1,
    options: {},
    tags: parseTags(values[3]!, sheet.name, row, 4),
  }
}

export async function parseElementWorkbook(
  buffer: Buffer
): Promise<WorkbookElement[]> {
  validateZip(buffer)
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
    )
  } catch {
    fail('INVALID_WORKBOOK')
  }
  if (
    workbook.getWorksheet('Instructions')?.getCell('A1').value !==
    ELEMENT_WORKBOOK_VERSION
  )
    fail('UNSUPPORTED_TEMPLATE_VERSION', 'Instructions', 1, 1)
  let workbookCells = 0
  for (const sheet of workbook.worksheets) {
    if (
      sheet.name !== 'Instructions' &&
      !(sheet.name in ELEMENT_WORKBOOK_HEADERS)
    )
      fail('UNEXPECTED_WORKSHEET', sheet.name)
  }
  if (workbook.worksheets.length > MAX_WORKSHEETS) fail('WORKBOOK_TOO_LARGE')
  for (const sheet of workbook.worksheets) {
    if (sheet.rowCount > MAX_ROWS || sheet.columnCount > MAX_COLUMNS)
      fail('WORKBOOK_TOO_LARGE', sheet.name)
    if (sheet.getImages().length)
      fail('EMBEDDED_IMAGES_UNSUPPORTED', sheet.name)
    sheet.eachRow((row, rowNumber) =>
      row.eachCell((cell, column) => {
        workbookCells++
        if (workbookCells > MAX_CELLS)
          fail('WORKBOOK_TOO_LARGE', sheet.name, rowNumber, column)
        visibleCellValue(cell, sheet.name, rowNumber, column)
      })
    )
  }
  const sheets = Object.fromEntries(
    (
      Object.keys(ELEMENT_WORKBOOK_HEADERS) as Array<
        keyof typeof ELEMENT_WORKBOOK_HEADERS
      >
    ).map((name) => [name, validateSheet(workbook, name)])
  ) as Record<keyof typeof ELEMENT_WORKBOOK_HEADERS, ExcelJS.Worksheet>

  const elements: WorkbookElement[] = []
  for (const [name, sheet] of Object.entries(sheets) as Array<
    [keyof typeof sheets, ExcelJS.Worksheet]
  >) {
    for (let row = ELEMENT_WORKBOOK_DATA_ROW; row <= sheet.rowCount; row++) {
      const values = rowValues(sheet, row, ELEMENT_WORKBOOK_HEADERS[name])
      if (!values.some(Boolean)) continue
      if (name === 'Multiple choice')
        elements.push(parseMultipleChoice(sheet, row))
      else if (name === 'Flashcards') elements.push(parseFlashcard(sheet, row))
      else fail('UNSUPPORTED_POPULATED_SHEET', sheet.name, row, 1)
      if (elements.length > MAX_ELEMENT_WORKBOOK_ELEMENTS)
        fail('WORKBOOK_TOO_LARGE', sheet.name, row, 1)
    }
  }
  return elements
}
