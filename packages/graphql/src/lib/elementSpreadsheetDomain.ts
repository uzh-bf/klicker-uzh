import { ZodError } from 'zod'
import { ElementDomainValidationError } from './elementDomain/core.js'
import {
  booleanCell as boolean,
  ELEMENT_SPREADSHEET_TABLES,
  ELEMENT_SPREADSHEET_TYPES,
  type ElementSpreadsheetTables,
  hasSpreadsheetValue as filled,
  numberCell as number,
  SPREADSHEET_DETAIL_FIELDS,
  SpreadsheetCellError,
  type SpreadsheetIssue,
  type SpreadsheetRow,
  textCell as text,
} from './elementSpreadsheetTables.js'
import { InvalidElementWorkbookError } from './elementSpreadsheetWorkbook.js'
import {
  elementSchema,
  type PackageAnswerCollection,
  type PackageElement,
} from './importExportPackageContract.js'

export type ParsedElementSpreadsheet = {
  elements: PackageElement[]
  answerCollections: PackageAnswerCollection[]
  sources: Array<{ ref: string; sheet: string; row: number; name: string }>
  issues: SpreadsheetIssue[]
}
function rejectFilled(
  row: SpreadsheetRow,
  fields: readonly string[],
  code = 'DISABLED_SOLUTION_DATA'
) {
  for (const field of fields)
    if (filled(row.values[field]))
      throw new SpreadsheetCellError(field, code, row)
}
function optionsForRows(rows: SpreadsheetRow[]) {
  const first = rows[0]!
  const type = ELEMENT_SPREADSHEET_TYPES[first.sheet]
  const hasSampleSolution = boolean(first, 'hasSampleSolution')
  if (type === 'CONTENT' || type === 'FLASHCARD') {
    if (rows.length !== 1)
      throw new SpreadsheetCellError('ref', 'DUPLICATE_REFERENCE', rows[1])
    return {}
  }
  if (type === 'SC' || type === 'MC' || type === 'KPRIM') {
    const hasAnswerFeedbacks = boolean(first, 'hasAnswerFeedbacks')
    if (!hasSampleSolution && hasAnswerFeedbacks)
      throw new SpreadsheetCellError(
        'hasAnswerFeedbacks',
        'DISABLED_SOLUTION_DATA',
        first
      )
    if (type === 'KPRIM' && rows.length !== 4)
      throw new SpreadsheetCellError('answer', 'KPRIM_FOUR_ANSWERS', first)
    const choices = rows.map((row, ix) => {
      if (!hasSampleSolution) rejectFilled(row, ['correct'])
      if (!hasAnswerFeedbacks) rejectFilled(row, ['feedback'])
      if (hasSampleSolution && !filled(row.values.correct))
        throw new SpreadsheetCellError('correct', 'REQUIRED_VALUE', row)
      const value = text(row, 'answer')
      if (!value.trim())
        throw new SpreadsheetCellError('answer', 'REQUIRED_VALUE', row)
      const feedback = hasAnswerFeedbacks ? text(row, 'feedback') : undefined
      if (hasAnswerFeedbacks && !feedback?.trim())
        throw new SpreadsheetCellError('feedback', 'REQUIRED_VALUE', row)
      return {
        ix,
        value,
        correct: hasSampleSolution ? boolean(row, 'correct') : undefined,
        feedback,
      }
    })
    const count = choices.filter((choice) => choice.correct).length
    if (
      hasSampleSolution &&
      ((type === 'SC' && count !== 1) || (type === 'MC' && count === 0))
    )
      throw new SpreadsheetCellError(
        'correct',
        type === 'SC' ? 'SC_ONE_CORRECT' : 'MC_CORRECT_REQUIRED',
        first
      )
    return {
      hasSampleSolution,
      hasAnswerFeedbacks,
      displayMode: text(first, 'displayMode', 'LIST'),
      choices,
    }
  }
  if (type === 'FREE_TEXT') {
    const maxLength = number(first, 'maxLength')
    if (!hasSampleSolution)
      for (const row of rows) rejectFilled(row, ['solution'])
    const solutions = hasSampleSolution
      ? rows.map((row) => {
          const value = text(row, 'solution')
          if (!value.trim())
            throw new SpreadsheetCellError('solution', 'REQUIRED_VALUE', row)
          if (maxLength !== undefined && value.trim().length > maxLength)
            throw new SpreadsheetCellError('solution', 'INVALID_VALUE', row)
          return value
        })
      : undefined
    return { hasSampleSolution, restrictions: { maxLength }, solutions }
  }
  const mode = text(first, 'solutionMode', '')
  if (!hasSampleSolution) {
    rejectFilled(first, ['solutionMode'])
    for (const row of rows)
      rejectFilled(row, ['solution', 'solutionMinimum', 'solutionMaximum'])
  } else if (mode !== 'EXACT' && mode !== 'RANGE')
    throw new SpreadsheetCellError('solutionMode', 'INVALID_VALUE', first)
  const restrictions = {
    min: number(first, 'minimum'),
    max: number(first, 'maximum'),
  }
  if (
    restrictions.min !== undefined &&
    restrictions.max !== undefined &&
    restrictions.min > restrictions.max
  )
    throw new SpreadsheetCellError('maximum', 'INVALID_VALUE', first)
  const bounds = (
    value: number | undefined,
    row: SpreadsheetRow,
    field: string
  ) => {
    if (
      value !== undefined &&
      ((restrictions.min !== undefined && value < restrictions.min) ||
        (restrictions.max !== undefined && value > restrictions.max))
    )
      throw new SpreadsheetCellError(field, 'INVALID_VALUE', row)
    return value
  }
  const exactSolutions =
    hasSampleSolution && mode === 'EXACT'
      ? rows.map((row) => {
          rejectFilled(
            row,
            ['solutionMinimum', 'solutionMaximum'],
            'AMBIGUOUS_SOLUTION'
          )
          const value = number(row, 'solution')
          if (value === undefined)
            throw new SpreadsheetCellError('solution', 'REQUIRED_VALUE', row)
          return bounds(value, row, 'solution')!
        })
      : undefined
  const solutionRanges =
    hasSampleSolution && mode === 'RANGE'
      ? rows.map((row) => {
          rejectFilled(row, ['solution'], 'AMBIGUOUS_SOLUTION')
          const min = bounds(
            number(row, 'solutionMinimum'),
            row,
            'solutionMinimum'
          )
          const max = bounds(
            number(row, 'solutionMaximum'),
            row,
            'solutionMaximum'
          )
          if (min === undefined && max === undefined)
            throw new SpreadsheetCellError(
              'solutionMinimum',
              'REQUIRED_VALUE',
              row
            )
          if (min !== undefined && max !== undefined && min > max)
            throw new SpreadsheetCellError(
              'solutionMaximum',
              'INVALID_VALUE',
              row
            )
          return { min, max }
        })
      : undefined
  return {
    hasSampleSolution,
    unit: text(first, 'unit', ''),
    accuracy: number(first, 'accuracy'),
    placeholder: text(first, 'placeholder', ''),
    restrictions,
    exactSolutions,
    solutionRanges,
  }
}
function diagnostic(
  error: unknown,
  first: SpreadsheetRow,
  rows: SpreadsheetRow[]
): SpreadsheetIssue {
  let source = first
  let field = 'content'
  let code = 'INVALID_ELEMENT'
  if (error instanceof SpreadsheetCellError) {
    source = error.source ?? first
    field = error.field
    code = error.code
  } else {
    const path =
      error instanceof ZodError
        ? error.issues[0]?.path
        : error instanceof ElementDomainValidationError
          ? error.issues[0]?.path
          : undefined
    const keys =
      path?.filter((key): key is string => typeof key === 'string') ?? []
    const index = path?.find((key) => typeof key === 'number')
    if (typeof index === 'number') source = rows[index] ?? first
    const aliases: Record<string, string> = {
      choices: 'answer',
      value: 'answer',
      exactSolutions: 'solution',
      solutions: 'solution',
      solutionRanges: 'solutionMinimum',
      maxLength: 'maxLength',
      min: 'minimum',
      max: 'maximum',
    }
    field =
      keys
        .reverse()
        .map((key) => aliases[key] ?? key)
        .find((key) =>
          (
            ELEMENT_SPREADSHEET_TABLES[first.sheet] as readonly string[]
          ).includes(key)
        ) ?? 'content'
  }
  return {
    sheet: source.sheet,
    row: source.row,
    ref: typeof first.values.ref === 'string' ? first.values.ref : null,
    field,
    code,
  }
}
export function parseElementSpreadsheetTables(
  tables: ElementSpreadsheetTables,
  cellIssues: SpreadsheetIssue[] = []
): ParsedElementSpreadsheet {
  const result: ParsedElementSpreadsheet = {
    elements: [],
    answerCollections: [],
    sources: [],
    issues: [...cellIssues],
  }
  const groups = new Map<string, SpreadsheetRow[]>()
  const refSheets = new Map<string, Set<string>>()
  for (const [sheet, rows] of Object.entries(tables)) {
    for (const row of rows) {
      try {
        const ref = text(row, 'ref')
        if (!ref.trim())
          throw new SpreadsheetCellError('ref', 'REQUIRED_VALUE', row)
        const key = `${sheet}\0${ref}`
        const group = groups.get(key) ?? []
        group.push(row)
        groups.set(key, group)
        const sheets = refSheets.get(ref) ?? new Set<string>()
        sheets.add(sheet)
        refSheets.set(ref, sheets)
      } catch (error) {
        result.issues.push(diagnostic(error, row, [row]))
      }
    }
  }
  if (groups.size > 100)
    throw new InvalidElementWorkbookError('WORKBOOK_TOO_LARGE')
  for (const rows of groups.values()) {
    const first = rows[0]!
    const ref = text(first, 'ref')
    result.sources.push({
      ref,
      sheet: first.sheet,
      row: first.row,
      name: typeof first.values.name === 'string' ? first.values.name : ref,
    })
    if (
      rows.some((row) =>
        cellIssues.some(
          (issue) => issue.sheet === row.sheet && issue.row === row.row
        )
      )
    )
      continue
    try {
      if (refSheets.get(ref)!.size > 1)
        throw new SpreadsheetCellError('ref', 'DUPLICATE_REFERENCE', first)
      const settings = ELEMENT_SPREADSHEET_TABLES[first.sheet].filter(
        (field) => field !== 'ref' && !SPREADSHEET_DETAIL_FIELDS.has(field)
      )
      for (const row of rows.slice(1))
        rejectFilled(row, settings, 'FIRST_ROW_ONLY')
      const type = ELEMENT_SPREADSHEET_TYPES[first.sheet]
      result.elements.push(
        elementSchema.parse({
          ref,
          type,
          name: text(first, 'name'),
          content: text(first, 'content'),
          explanation: text(first, 'explanation', '') || null,
          basePoints:
            type === 'CONTENT' || type === 'FLASHCARD'
              ? false
              : boolean(first, 'basePoints', true),
          pointsMultiplier:
            type === 'CONTENT' || type === 'FLASHCARD'
              ? 1
              : number(first, 'pointsMultiplier', 1),
          options: optionsForRows(rows),
        })
      )
    } catch (error) {
      result.issues.push(diagnostic(error, first, rows))
    }
  }
  return result
}
