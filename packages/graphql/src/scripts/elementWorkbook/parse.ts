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
const MAX_POINTS_MULTIPLIER = 4
const MAX_NUMERICAL_VALUE = 1e30
const MAX_NUMERICAL_ACCURACY = 100

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

export type Choice = {
  ix: number
  value: string
  correct?: boolean
  feedback?: string
}

export type ChoicesOptions = {
  displayMode: 'LIST' | 'GRID'
  hasSampleSolution: boolean
  hasAnswerFeedbacks: boolean
  choices: Choice[]
}

export type MultipleChoiceOptions = ChoicesOptions

export type NumericalOptions = {
  hasSampleSolution: boolean
  unit: string
  accuracy?: number
  placeholder: string
  restrictions: { min?: number; max?: number }
  exactSolutions?: number[]
  solutionRanges?: Array<{ min?: number; max?: number }>
}

export type FreeTextOptions = {
  hasSampleSolution: boolean
  restrictions: { maxLength?: number }
  solutions?: string[]
}

type WorkbookElementBase = {
  sheet: string
  row: number
  name: string
  content: string
  explanation: string | null
  basePoints: boolean
  pointsMultiplier: number
  tags: string[]
}

export type WorkbookElement =
  | (WorkbookElementBase & {
      type: 'SC' | 'MC' | 'KPRIM'
      options: ChoicesOptions
    })
  | (WorkbookElementBase & { type: 'NUMERICAL'; options: NumericalOptions })
  | (WorkbookElementBase & { type: 'FREE_TEXT'; options: FreeTextOptions })
  | (WorkbookElementBase & {
      type: 'CONTENT' | 'FLASHCARD'
      options: Record<string, never>
    })

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
  const trimmed = value.trim()
  if (!trimmed || /^(?:<br\s*\/?>\s*)+$/iu.test(trimmed))
    fail('REQUIRED_VALUE', sheet, row, column)
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

function headerColumn(headers: readonly string[], header: string) {
  const column = headers.indexOf(header) + 1
  if (!column) throw new Error('Invalid parser header configuration')
  return column
}

function rawNumber(
  sheet: ExcelJS.Worksheet,
  row: number,
  column: number,
  fallback?: number
) {
  const value = sheet.getRow(row).getCell(column).value
  if (isEmpty(value)) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value))
    fail('INVALID_NUMBER', sheet.name, row, column)
  return value
}

function commonScoredValues(
  sheet: ExcelJS.Worksheet,
  row: number,
  headers: readonly string[],
  values: string[]
) {
  const baseColumn = headerColumn(headers, 'Participation points')
  const multiplierColumn = headerColumn(headers, 'Points multiplier')
  const displayColumn = headers.indexOf('Answer layout') + 1
  const pointsMultiplier = rawNumber(sheet, row, multiplierColumn, 1)!
  if (
    !Number.isInteger(pointsMultiplier) ||
    pointsMultiplier < 1 ||
    pointsMultiplier > MAX_POINTS_MULTIPLIER
  )
    fail('INVALID_MULTIPLIER', sheet.name, row, multiplierColumn)
  const displayMode = displayColumn
    ? values[displayColumn - 1] || 'LIST'
    : undefined
  if (displayMode && displayMode !== 'LIST' && displayMode !== 'GRID')
    fail('INVALID_DISPLAY_MODE', sheet.name, row, displayColumn)
  return {
    basePoints: booleanValue(
      values[baseColumn - 1]!,
      sheet.name,
      row,
      baseColumn,
      true
    ),
    pointsMultiplier,
    displayMode: displayMode as 'LIST' | 'GRID' | undefined,
  }
}

function parseChoices(
  sheet: ExcelJS.Worksheet,
  row: number,
  type: 'SC' | 'MC' | 'KPRIM'
): WorkbookElement {
  const headers =
    type === 'SC'
      ? ELEMENT_WORKBOOK_HEADERS['Single choice']
      : type === 'MC'
        ? ELEMENT_WORKBOOK_HEADERS['Multiple choice']
        : ELEMENT_WORKBOOK_HEADERS.Kprim
  const values = rowValues(sheet, row, headers)
  const answerPrefix = type === 'KPRIM' ? 'Statement' : 'Answer'
  const slots = type === 'KPRIM' ? 4 : 10
  const sampleColumn = headerColumn(headers, 'Sample solution?')
  const feedbackFlagColumn = headerColumn(headers, 'Answer feedback?')
  const hasSampleSolution = booleanValue(
    values[sampleColumn - 1]!,
    sheet.name,
    row,
    sampleColumn,
    false
  )
  const hasAnswerFeedbacks = booleanValue(
    values[feedbackFlagColumn - 1]!,
    sheet.name,
    row,
    feedbackFlagColumn,
    false
  )
  if (hasAnswerFeedbacks && !hasSampleSolution)
    fail('DISABLED_SOLUTION_DATA', sheet.name, row, feedbackFlagColumn)
  const choices: Choice[] = []
  for (let slot = 1; slot <= slots; slot++) {
    const answerColumn = headerColumn(headers, `${answerPrefix} ${slot}`)
    const correctColumn = headerColumn(
      headers,
      type === 'KPRIM' ? `Statement ${slot} true?` : `Correct ${slot}?`
    )
    const feedbackColumn = headerColumn(headers, `Feedback ${slot}`)
    const answer = values[answerColumn - 1]!
    const correct = values[correctColumn - 1]!
    const feedback = values[feedbackColumn - 1]!
    if (!answer) {
      if (type === 'KPRIM')
        fail('KPRIM_FOUR_ANSWERS', sheet.name, row, answerColumn)
      if (correct || feedback)
        fail(
          'ORPHAN_CHOICE_DATA',
          sheet.name,
          row,
          correct ? correctColumn : feedbackColumn
        )
      continue
    }
    if (!hasSampleSolution && correct)
      fail('DISABLED_SOLUTION_DATA', sheet.name, row, correctColumn)
    if (!hasAnswerFeedbacks && feedback)
      fail('DISABLED_SOLUTION_DATA', sheet.name, row, feedbackColumn)
    if (hasSampleSolution && !correct)
      fail('REQUIRED_VALUE', sheet.name, row, correctColumn)
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
  }
  if (!choices.length) fail('REQUIRED_VALUE', sheet.name, row, 4)
  const correctCount = choices.filter((choice) => choice.correct).length
  if (hasSampleSolution && type === 'SC' && correctCount !== 1)
    fail('SC_ONE_CORRECT', sheet.name, row, headerColumn(headers, 'Correct 1?'))
  if (hasSampleSolution && type === 'MC' && correctCount === 0)
    fail(
      'MC_CORRECT_REQUIRED',
      sheet.name,
      row,
      headerColumn(headers, 'Correct 1?')
    )
  const common = commonScoredValues(sheet, row, headers, values)
  return {
    sheet: sheet.name,
    row,
    name: nameValue(values[0]!, sheet.name, row),
    content: required(values[1]!, sheet.name, row, 2),
    explanation: values[headerColumn(headers, 'Explanation') - 1] || null,
    type,
    basePoints: common.basePoints,
    pointsMultiplier: common.pointsMultiplier,
    options: {
      displayMode: common.displayMode!,
      hasSampleSolution,
      hasAnswerFeedbacks,
      choices,
    },
    tags: parseTags(
      values[headerColumn(headers, 'Tags') - 1]!,
      sheet.name,
      row,
      headerColumn(headers, 'Tags')
    ),
  }
}

function parseFreeText(sheet: ExcelJS.Worksheet, row: number): WorkbookElement {
  const headers = ELEMENT_WORKBOOK_HEADERS['Free text']
  const values = rowValues(sheet, row, headers)
  const sampleColumn = headerColumn(headers, 'Sample solution?')
  const hasSampleSolution = booleanValue(
    values[sampleColumn - 1]!,
    sheet.name,
    row,
    sampleColumn,
    false
  )
  const maxColumn = headerColumn(headers, 'Maximum answer length')
  const maxLength = rawNumber(sheet, row, maxColumn)
  if (
    maxLength !== undefined &&
    (!Number.isInteger(maxLength) || maxLength <= 0)
  )
    fail('INVALID_NUMBER', sheet.name, row, maxColumn)
  const solutions: string[] = []
  for (let slot = 1; slot <= 6; slot++) {
    const column = headerColumn(headers, `Accepted answer ${slot}`)
    const value = values[column - 1]!
    if (!value) continue
    if (!hasSampleSolution)
      fail('DISABLED_SOLUTION_DATA', sheet.name, row, column)
    if (maxLength !== undefined && value.trim().length > maxLength)
      fail('INVALID_VALUE', sheet.name, row, column)
    solutions.push(required(value, sheet.name, row, column))
  }
  if (hasSampleSolution && !solutions.length)
    fail(
      'REQUIRED_VALUE',
      sheet.name,
      row,
      headerColumn(headers, 'Accepted answer 1')
    )
  const common = commonScoredValues(sheet, row, headers, values)
  return {
    sheet: sheet.name,
    row,
    name: nameValue(values[0]!, sheet.name, row),
    content: required(values[1]!, sheet.name, row, 2),
    explanation: values[headerColumn(headers, 'Explanation') - 1] || null,
    type: 'FREE_TEXT',
    basePoints: common.basePoints,
    pointsMultiplier: common.pointsMultiplier,
    options: {
      hasSampleSolution,
      restrictions: maxLength === undefined ? {} : { maxLength },
      ...(hasSampleSolution ? { solutions } : {}),
    },
    tags: parseTags(values.at(-1)!, sheet.name, row, headers.length),
  }
}

function parseNumerical(
  sheet: ExcelJS.Worksheet,
  row: number
): WorkbookElement {
  const headers = ELEMENT_WORKBOOK_HEADERS.Numerical
  const values = rowValues(sheet, row, headers)
  const sampleColumn = headerColumn(headers, 'Sample solution?')
  const modeColumn = headerColumn(headers, 'Solution type')
  const hasSampleSolution = booleanValue(
    values[sampleColumn - 1]!,
    sheet.name,
    row,
    sampleColumn,
    false
  )
  const mode = values[modeColumn - 1]!
  const solutionColumns = Array.from({ length: 6 }, (_, index) =>
    headerColumn(headers, `Accepted answer ${index + 1}`)
  )
  const rangeColumns = Array.from(
    { length: 6 },
    (_, index) =>
      [
        headerColumn(headers, `Range minimum ${index + 1}`),
        headerColumn(headers, `Range maximum ${index + 1}`),
      ] as const
  )
  if (!hasSampleSolution) {
    if (mode) fail('DISABLED_SOLUTION_DATA', sheet.name, row, modeColumn)
    for (const column of [...solutionColumns, ...rangeColumns.flat()])
      if (!isEmpty(sheet.getRow(row).getCell(column).value))
        fail('DISABLED_SOLUTION_DATA', sheet.name, row, column)
  } else if (mode !== 'EXACT' && mode !== 'RANGE') {
    fail('INVALID_VALUE', sheet.name, row, modeColumn)
  }
  const minColumn = headerColumn(headers, 'Minimum allowed')
  const maxColumn = headerColumn(headers, 'Maximum allowed')
  const min = rawNumber(sheet, row, minColumn)
  const max = rawNumber(sheet, row, maxColumn)
  for (const [value, column] of [
    [min, minColumn],
    [max, maxColumn],
  ] as const)
    if (value !== undefined && Math.abs(value) > MAX_NUMERICAL_VALUE)
      fail('INVALID_NUMBER', sheet.name, row, column)
  if (min !== undefined && max !== undefined && min > max)
    fail('INVALID_VALUE', sheet.name, row, maxColumn)
  const bounded = (column: number) => {
    const value = rawNumber(sheet, row, column)
    if (value === undefined) return undefined
    if (
      Math.abs(value) > MAX_NUMERICAL_VALUE ||
      (min !== undefined && value < min) ||
      (max !== undefined && value > max)
    )
      fail('INVALID_NUMBER', sheet.name, row, column)
    return value
  }
  let exactSolutions: number[] | undefined
  let solutionRanges: Array<{ min?: number; max?: number }> | undefined
  if (mode === 'EXACT') {
    for (const columns of rangeColumns)
      for (const column of columns)
        if (!isEmpty(sheet.getRow(row).getCell(column).value))
          fail('AMBIGUOUS_SOLUTION', sheet.name, row, column)
    exactSolutions = solutionColumns
      .map(bounded)
      .filter((value): value is number => value !== undefined)
  } else if (mode === 'RANGE') {
    for (const column of solutionColumns)
      if (!isEmpty(sheet.getRow(row).getCell(column).value))
        fail('AMBIGUOUS_SOLUTION', sheet.name, row, column)
    solutionRanges = rangeColumns.flatMap(([minColumn, maxColumn]) => {
      const rangeMin = bounded(minColumn)
      const rangeMax = bounded(maxColumn)
      if (rangeMin === undefined && rangeMax === undefined) return []
      if (
        rangeMin !== undefined &&
        rangeMax !== undefined &&
        rangeMin > rangeMax
      )
        fail('INVALID_VALUE', sheet.name, row, maxColumn)
      return [{ min: rangeMin, max: rangeMax }]
    })
  }
  if (hasSampleSolution && !(exactSolutions?.length || solutionRanges?.length))
    fail(
      'REQUIRED_VALUE',
      sheet.name,
      row,
      mode === 'RANGE' ? rangeColumns[0]![0] : solutionColumns[0]!
    )
  const accuracyColumn = headerColumn(headers, 'Decimal places')
  const accuracy = rawNumber(sheet, row, accuracyColumn)
  if (
    accuracy !== undefined &&
    (!Number.isInteger(accuracy) ||
      accuracy < 0 ||
      accuracy > MAX_NUMERICAL_ACCURACY)
  )
    fail('INVALID_NUMBER', sheet.name, row, accuracyColumn)
  const common = commonScoredValues(sheet, row, headers, values)
  return {
    sheet: sheet.name,
    row,
    name: nameValue(values[0]!, sheet.name, row),
    content: required(values[1]!, sheet.name, row, 2),
    explanation: values[headerColumn(headers, 'Explanation') - 1] || null,
    type: 'NUMERICAL',
    basePoints: common.basePoints,
    pointsMultiplier: common.pointsMultiplier,
    options: {
      hasSampleSolution,
      unit: values[headerColumn(headers, 'Unit') - 1] || '',
      ...(accuracy === undefined ? {} : { accuracy }),
      placeholder: values[headerColumn(headers, 'Input hint') - 1] || '',
      restrictions: {
        ...(min === undefined ? {} : { min }),
        ...(max === undefined ? {} : { max }),
      },
      ...(exactSolutions === undefined ? {} : { exactSolutions }),
      ...(solutionRanges === undefined ? {} : { solutionRanges }),
    },
    tags: parseTags(values.at(-1)!, sheet.name, row, headers.length),
  }
}

function parseContent(sheet: ExcelJS.Worksheet, row: number): WorkbookElement {
  const headers = ELEMENT_WORKBOOK_HEADERS.Content
  const values = rowValues(sheet, row, headers)
  return {
    sheet: sheet.name,
    row,
    name: nameValue(values[0]!, sheet.name, row),
    content: required(values[1]!, sheet.name, row, 2),
    explanation: values[2] || null,
    type: 'CONTENT',
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
      switch (name) {
        case 'Single choice':
          elements.push(parseChoices(sheet, row, 'SC'))
          break
        case 'Multiple choice':
          elements.push(parseChoices(sheet, row, 'MC'))
          break
        case 'Kprim':
          elements.push(parseChoices(sheet, row, 'KPRIM'))
          break
        case 'Numerical':
          elements.push(parseNumerical(sheet, row))
          break
        case 'Free text':
          elements.push(parseFreeText(sheet, row))
          break
        case 'Content':
          elements.push(parseContent(sheet, row))
          break
        case 'Flashcards':
          elements.push(parseFlashcard(sheet, row))
          break
      }
      if (elements.length > MAX_ELEMENT_WORKBOOK_ELEMENTS)
        fail('WORKBOOK_TOO_LARGE', sheet.name, row, 1)
    }
  }
  return elements
}
