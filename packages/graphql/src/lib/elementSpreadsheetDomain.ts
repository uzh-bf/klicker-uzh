import { ZodError } from 'zod'
import { ElementDomainValidationError } from './elementDomain/core.js'
import {
  booleanCell as boolean,
  ELEMENT_SPREADSHEET_ANSWER_SLOTS,
  ELEMENT_SPREADSHEET_SOLUTION_SLOTS,
  ELEMENT_SPREADSHEET_TABLES,
  ELEMENT_SPREADSHEET_TYPES,
  type ElementSpreadsheetTables,
  hasSpreadsheetValue as filled,
  numberCell as number,
  SpreadsheetCellError,
  type SpreadsheetIssue,
  type SpreadsheetRow,
  spreadsheetColumnLabel,
  spreadsheetSlots,
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
  fields: string[],
  code = 'DISABLED_SOLUTION_DATA'
) {
  for (const field of fields)
    if (filled(row.values[field])) throw new SpreadsheetCellError(field, code)
}
function requiredText(row: SpreadsheetRow, field: string) {
  const value = text(row, field, '')
  if (!value.trim()) throw new SpreadsheetCellError(field, 'REQUIRED_VALUE')
  return value
}
function choiceOptions(row: SpreadsheetRow) {
  const type = ELEMENT_SPREADSHEET_TYPES[row.sheet]
  const hasSampleSolution = boolean(row, 'hasSampleSolution')
  const hasAnswerFeedbacks = boolean(row, 'hasAnswerFeedbacks')
  if (!hasSampleSolution && hasAnswerFeedbacks)
    throw new SpreadsheetCellError(
      'hasAnswerFeedbacks',
      'DISABLED_SOLUTION_DATA'
    )
  const choices: Array<{
    ix: number
    value: string
    correct: boolean | undefined
    feedback: string | undefined
  }> = []
  for (const slot of spreadsheetSlots(
    type === 'KPRIM' ? 4 : ELEMENT_SPREADSHEET_ANSWER_SLOTS
  )) {
    const answer = `answer${slot}`
    const correct = `correct${slot}`
    const feedback = `feedback${slot}`
    if (!filled(row.values[answer])) {
      if (type === 'KPRIM')
        throw new SpreadsheetCellError(answer, 'KPRIM_FOUR_ANSWERS')
      if (filled(row.values[correct]) || filled(row.values[feedback]))
        throw new SpreadsheetCellError(answer, 'REQUIRED_VALUE')
      continue
    }
    if (!hasSampleSolution) rejectFilled(row, [correct])
    if (!hasAnswerFeedbacks) rejectFilled(row, [feedback])
    if (hasSampleSolution && !filled(row.values[correct]))
      throw new SpreadsheetCellError(correct, 'REQUIRED_VALUE')
    choices.push({
      ix: choices.length,
      value: requiredText(row, answer),
      correct: hasSampleSolution ? boolean(row, correct) : undefined,
      feedback: hasAnswerFeedbacks ? requiredText(row, feedback) : undefined,
    })
  }
  if (!choices.length)
    throw new SpreadsheetCellError('answer1', 'REQUIRED_VALUE')
  const count = choices.filter((choice) => choice.correct).length
  if (
    hasSampleSolution &&
    ((type === 'SC' && count !== 1) || (type === 'MC' && count === 0))
  )
    throw new SpreadsheetCellError(
      `correct${spreadsheetSlots(ELEMENT_SPREADSHEET_ANSWER_SLOTS).find((slot) => filled(row.values[`answer${slot}`]))}`,
      type === 'SC' ? 'SC_ONE_CORRECT' : 'MC_CORRECT_REQUIRED'
    )
  return {
    hasSampleSolution,
    hasAnswerFeedbacks,
    displayMode: text(row, 'displayMode', 'LIST'),
    choices,
  }
}
function freeTextOptions(row: SpreadsheetRow) {
  const hasSampleSolution = boolean(row, 'hasSampleSolution')
  const maxLength = number(row, 'maxLength')
  const fields = spreadsheetSlots(ELEMENT_SPREADSHEET_SOLUTION_SLOTS).map(
    (slot) => `solution${slot}`
  )
  if (!hasSampleSolution) rejectFilled(row, fields)
  const solutions = fields
    .filter((field) => filled(row.values[field]))
    .map((field) => {
      const value = requiredText(row, field)
      if (maxLength !== undefined && value.trim().length > maxLength)
        throw new SpreadsheetCellError(field, 'INVALID_VALUE')
      return value
    })
  if (hasSampleSolution && !solutions.length)
    throw new SpreadsheetCellError('solution1', 'REQUIRED_VALUE')
  return {
    hasSampleSolution,
    restrictions: { maxLength },
    solutions: hasSampleSolution ? solutions : undefined,
  }
}
function numericalOptions(row: SpreadsheetRow) {
  const hasSampleSolution = boolean(row, 'hasSampleSolution')
  const mode = text(row, 'solutionMode', '')
  const slots = spreadsheetSlots(ELEMENT_SPREADSHEET_SOLUTION_SLOTS)
  const exactFields = slots.map((slot) => `solution${slot}`)
  const rangeFields = slots.flatMap((slot) => [
    `solutionMinimum${slot}`,
    `solutionMaximum${slot}`,
  ])
  if (!hasSampleSolution)
    rejectFilled(row, ['solutionMode', ...exactFields, ...rangeFields])
  else if (mode !== 'EXACT' && mode !== 'RANGE')
    throw new SpreadsheetCellError('solutionMode', 'INVALID_VALUE')
  if (mode === 'EXACT') rejectFilled(row, rangeFields, 'AMBIGUOUS_SOLUTION')
  if (mode === 'RANGE') rejectFilled(row, exactFields, 'AMBIGUOUS_SOLUTION')
  const restrictions = {
    min: number(row, 'minimum'),
    max: number(row, 'maximum'),
  }
  if (
    restrictions.min !== undefined &&
    restrictions.max !== undefined &&
    restrictions.min > restrictions.max
  )
    throw new SpreadsheetCellError('maximum', 'INVALID_VALUE')
  const bounded = (field: string) => {
    const value = number(row, field)
    if (
      value !== undefined &&
      ((restrictions.min !== undefined && value < restrictions.min) ||
        (restrictions.max !== undefined && value > restrictions.max))
    )
      throw new SpreadsheetCellError(field, 'INVALID_VALUE')
    return value
  }
  const exactSolutions =
    mode === 'EXACT'
      ? exactFields
          .filter((field) => filled(row.values[field]))
          .map((field) => bounded(field)!)
      : undefined
  const solutionRanges =
    mode === 'RANGE'
      ? slots
          .filter(
            (slot) =>
              filled(row.values[`solutionMinimum${slot}`]) ||
              filled(row.values[`solutionMaximum${slot}`])
          )
          .map((slot) => {
            const min = bounded(`solutionMinimum${slot}`)
            const max = bounded(`solutionMaximum${slot}`)
            if (min !== undefined && max !== undefined && min > max)
              throw new SpreadsheetCellError(
                `solutionMaximum${slot}`,
                'INVALID_VALUE'
              )
            return { min, max }
          })
      : undefined
  if (hasSampleSolution && !exactSolutions?.length && !solutionRanges?.length)
    throw new SpreadsheetCellError(
      mode === 'EXACT' ? 'solution1' : 'solutionMinimum1',
      'REQUIRED_VALUE'
    )
  return {
    hasSampleSolution,
    unit: text(row, 'unit', ''),
    accuracy: number(row, 'accuracy'),
    placeholder: text(row, 'placeholder', ''),
    restrictions,
    exactSolutions,
    solutionRanges,
  }
}
function optionsForRow(row: SpreadsheetRow) {
  switch (ELEMENT_SPREADSHEET_TYPES[row.sheet]) {
    case 'CONTENT':
    case 'FLASHCARD':
      return {}
    case 'SC':
    case 'MC':
    case 'KPRIM':
      return choiceOptions(row)
    case 'FREE_TEXT':
      return freeTextOptions(row)
    case 'NUMERICAL':
      return numericalOptions(row)
  }
}
function diagnostic(
  error: unknown,
  row: SpreadsheetRow,
  ref: string
): SpreadsheetIssue {
  let field = 'content'
  let code = 'INVALID_ELEMENT'
  if (error instanceof SpreadsheetCellError) {
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
    const index = path?.find((key): key is number => typeof key === 'number')
    const collection = keys.find((key) =>
      ['choices', 'solutions', 'exactSolutions', 'solutionRanges'].includes(key)
    )
    const slots = spreadsheetSlots(
      collection === 'choices'
        ? row.sheet === 'Kprim'
          ? 4
          : ELEMENT_SPREADSHEET_ANSWER_SLOTS
        : ELEMENT_SPREADSHEET_SOLUTION_SLOTS
    )
    const populated = slots.filter((slot) =>
      collection === 'choices'
        ? filled(row.values[`answer${slot}`])
        : collection === 'solutionRanges'
          ? filled(row.values[`solutionMinimum${slot}`]) ||
            filled(row.values[`solutionMaximum${slot}`])
          : filled(row.values[`solution${slot}`])
    )
    if (collection && index !== undefined) {
      const slot = populated[index] ?? 1
      const leaf = keys.at(-1)
      field =
        collection === 'choices'
          ? `${leaf === 'correct' || leaf === 'feedback' ? leaf : 'answer'}${slot}`
          : collection === 'solutionRanges'
            ? `solution${leaf === 'max' ? 'Maximum' : 'Minimum'}${slot}`
            : `solution${slot}`
    } else {
      const aliases: Record<string, string> = {
        min: 'minimum',
        max: 'maximum',
        choices: 'answer1',
        value: 'answer1',
        solutions: 'solution1',
        exactSolutions: 'solution1',
        solutionRanges: 'solutionMinimum1',
      }
      field =
        keys
          .reverse()
          .map((key) => aliases[key] ?? key)
          .find((key) => ELEMENT_SPREADSHEET_TABLES[row.sheet].includes(key)) ??
        'content'
    }
  }
  return {
    sheet: row.sheet,
    row: row.row,
    ref,
    field: spreadsheetColumnLabel(field, row.sheet),
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
    issues: cellIssues.map((issue) => ({
      ...issue,
      field: spreadsheetColumnLabel(issue.field, issue.sheet),
    })),
  }
  const rows = Object.values(tables).flat()
  if (rows.length > 100)
    throw new InvalidElementWorkbookError('WORKBOOK_TOO_LARGE')
  for (const row of rows) {
    const type = ELEMENT_SPREADSHEET_TYPES[row.sheet]
    // Internal transport identity only. Users never enter or maintain references.
    const ref = `excel-${type.toLowerCase()}-${row.row}`
    result.sources.push({
      ref,
      sheet: row.sheet,
      row: row.row,
      name: typeof row.values.name === 'string' ? row.values.name : '',
    })
    if (
      cellIssues.some(
        (issue) => issue.sheet === row.sheet && issue.row === row.row
      )
    )
      continue
    try {
      result.elements.push(
        elementSchema.parse({
          ref,
          type,
          name: requiredText(row, 'name'),
          content: requiredText(row, 'content'),
          explanation:
            type === 'FLASHCARD'
              ? requiredText(row, 'explanation')
              : text(row, 'explanation', '') || null,
          basePoints:
            type === 'CONTENT' || type === 'FLASHCARD'
              ? false
              : boolean(row, 'basePoints', true),
          pointsMultiplier:
            type === 'CONTENT' || type === 'FLASHCARD'
              ? 1
              : number(row, 'pointsMultiplier', 1),
          options: optionsForRow(row),
        })
      )
    } catch (error) {
      result.issues.push(diagnostic(error, row, ref))
    }
  }
  return result
}
