import type ExcelJS from 'exceljs'
import { ELEMENT_DOMAIN_LIMITS } from './elementDomain/core.js'
import {
  ELEMENT_SPREADSHEET_DATA_ROW,
  ELEMENT_SPREADSHEET_EDIT_ROWS,
  ELEMENT_SPREADSHEET_TABLES,
  type ElementSpreadsheetTable,
  spreadsheetColumnLabel,
} from './elementSpreadsheetTables.js'

export function addSpreadsheetValidationLists(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet('Instructions')!
  for (const [column, name, values] of [
    ['E', 'KlickerBooleans', ['Yes', 'No']],
    ['F', 'KlickerDisplayModes', ['LIST', 'GRID']],
    ['G', 'KlickerUnused', [null]],
    ['H', 'KlickerFalse', ['No']],
    ['I', 'KlickerSolutionModes', ['EXACT', 'RANGE']],
  ] as const) {
    values.forEach((value, index) => {
      sheet.getCell(`${column}${index + 1}`).value = value
    })
    sheet.getColumn(column).hidden = true
    workbook.definedNames.add(
      `Instructions!$${column}$1:$${column}$${values.length}`,
      name
    )
  }
}
const and = (...conditions: string[]) => `AND(${conditions.join(',')})`
const or = (...conditions: string[]) => `OR(${conditions.join(',')})`

/** All checks are local to one element row; there are no reference lookups. */
export function addSpreadsheetValidation(
  sheet: ExcelJS.Worksheet,
  name: ElementSpreadsheetTable
) {
  const headers: readonly string[] = ELEMENT_SPREADSHEET_TABLES[name]
  const first = ELEMENT_SPREADSHEET_DATA_ROW
  const last = first + ELEMENT_SPREADSHEET_EDIT_ROWS - 1
  const letter = (field: string) =>
    sheet.getColumn(headers.indexOf(field) + 1).letter
  const cellFor = (field: string) => `$${letter(field)}${first}`
  const yes = (field: string) =>
    headers.includes(field)
      ? or(
          `${cellFor(field)}="Yes"`,
          `${cellFor(field)}=TRUE`,
          `${cellFor(field)}="TRUE"`
        )
      : 'FALSE'
  const present = (field: string) => `${cellFor(field)}<>""`
  const answerFields = headers.filter((field) => /^answer\d+$/.test(field))
  const solutionFields = headers.filter((field) => /^solution\d+$/.test(field))
  const rangeFields = headers.filter((field) =>
    /^solution(Minimum|Maximum)\d+$/.test(field)
  )
  const any = (fields: readonly string[]) =>
    fields.length ? or(...fields.map(present)) : 'FALSE'
  const correctCount =
    headers
      .filter((field) => /^correct\d+$/.test(field))
      .map(
        (field) =>
          `IF(${and(present(field.replace('correct', 'answer')), yes(field))},1,0)`
      )
      .join('+') || '0'
  const hasSolution = yes('hasSampleSolution')
  const hasFeedback = and(hasSolution, yes('hasAnswerFeedbacks'))
  const active = `COUNTA($A${first}:$${sheet.getColumn(headers.length).letter}${first})>0`
  for (const field of headers) {
    const column = letter(field)
    const cell = cellFor(field)
    const numbered =
      /^(answer|correct|feedback|solutionMinimum|solutionMaximum|solution)(\d+)$/.exec(
        field
      )
    const kind = numbered?.[1]
    const slot = numbered?.[2]
    let enabled = 'TRUE'
    let required =
      ['name', 'content'].includes(field) ||
      (name === 'Flashcards' && field === 'explanation')
    let list: string | undefined
    let valid = and(
      or(`ISTEXT(${cell})`, `ISNUMBER(${cell})`),
      `LEN(TRIM(${cell}&""))>0`
    )
    const numeric = and(
      `ISNUMBER(${cell})`,
      `ABS(${cell})<=${ELEMENT_DOMAIN_LIMITS.numericalMax}`
    )
    const integer = and(`ISNUMBER(${cell})`, `MOD(${cell},1)=0`)
    const boolean = or(
      `${cell}="Yes"`,
      `${cell}="No"`,
      `${cell}=TRUE`,
      `${cell}=FALSE`,
      `${cell}="TRUE"`,
      `${cell}="FALSE"`
    )
    if (kind === 'correct') {
      enabled = and(hasSolution, present(`answer${slot}`))
      required = true
      list = '"KlickerBooleans"'
      valid = boolean
    } else if (kind === 'feedback') {
      enabled = and(hasFeedback, present(`answer${slot}`))
      required = true
    } else if (kind === 'answer') {
      required = name === 'Kprim'
    } else if (
      ['basePoints', 'hasSampleSolution', 'hasAnswerFeedbacks'].includes(field)
    ) {
      list =
        field === 'hasAnswerFeedbacks'
          ? `IF(${hasSolution},"KlickerBooleans","KlickerFalse")`
          : '"KlickerBooleans"'
      valid = and(
        boolean,
        field === 'hasAnswerFeedbacks'
          ? or(hasSolution, `NOT(${yes(field)})`)
          : 'TRUE'
      )
    } else if (field === 'displayMode') {
      list = '"KlickerDisplayModes"'
      valid = or(`${cell}="LIST"`, `${cell}="GRID"`)
    } else if (field === 'solutionMode') {
      enabled = hasSolution
      required = true
      list = '"KlickerSolutionModes"'
      valid = or(`${cell}="EXACT"`, `${cell}="RANGE"`)
    } else if (field === 'pointsMultiplier') {
      valid = and(integer, `${cell}>=1`, `${cell}<=4`)
    } else if (field === 'accuracy') {
      valid = and(
        integer,
        `${cell}>=0`,
        `${cell}<=${ELEMENT_DOMAIN_LIMITS.numericalAccuracyMax}`
      )
    } else if (field === 'maxLength') {
      valid = and(integer, `${cell}>0`)
    } else if (field === 'minimum' || field === 'maximum') {
      const other = field === 'minimum' ? 'maximum' : 'minimum'
      valid = and(
        numeric,
        or(
          `NOT(${present(other)})`,
          `${cell}${field === 'minimum' ? '<=' : '>='}${cellFor(other)}`
        )
      )
    } else if (kind === 'solution' && name === 'Free text') {
      enabled = hasSolution
      valid = and(
        valid,
        or(
          `NOT(${present('maxLength')})`,
          `LEN(TRIM(${cell}))<=${cellFor('maxLength')}`
        )
      )
    } else if (
      kind === 'solution' ||
      kind === 'solutionMinimum' ||
      kind === 'solutionMaximum'
    ) {
      enabled = and(
        hasSolution,
        `${cellFor('solutionMode')}="${kind === 'solution' ? 'EXACT' : 'RANGE'}"`
      )
      const bounds = [
        numeric,
        or(`NOT(${present('minimum')})`, `${cell}>=${cellFor('minimum')}`),
        or(`NOT(${present('maximum')})`, `${cell}<=${cellFor('maximum')}`),
      ]
      if (kind !== 'solution') {
        const other = `${kind === 'solutionMinimum' ? 'solutionMaximum' : 'solutionMinimum'}${slot}`
        bounds.push(
          or(
            `NOT(${present(other)})`,
            `${cell}${kind === 'solutionMinimum' ? '<=' : '>='}${cellFor(other)}`
          )
        )
      }
      valid = and(...bounds)
    }
    const allowed = `IFERROR(IF(${enabled},OR(${cell}="",${valid}),${cell}=""),FALSE)`
    // ExcelJS's range API keeps the XLSX compact; its Worksheet types omit it.
    const validations = (
      sheet as ExcelJS.Worksheet & {
        dataValidations: {
          add: (range: string, rule: ExcelJS.DataValidation) => void
        }
      }
    ).dataValidations
    validations.add(`${column}${first}:${column}${last}`, {
      type: list ? 'list' : 'custom',
      allowBlank: !list,
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Check this field',
      error:
        'Follow the field instructions in row 7. Leave grey cells blank; correct orange cells. Klicker checks every row on upload.',
      showInputMessage: true,
      promptTitle: spreadsheetColumnLabel(field, name).slice(0, 32),
      prompt: String(sheet.getRow(7).getCell(column).value ?? '').slice(0, 250),
      // Excel needs a range reference here; IFERROR over a range returns an
      // array and rejects valid dropdown entries in native Excel.
      formulae: [
        list
          ? `INDIRECT(IFERROR(IF(${enabled},${list},"KlickerUnused"),"KlickerUnused"))`
          : allowed,
      ],
    })
    const extra: string[] = []
    if (kind === 'answer' && field === 'answer1')
      extra.push(`NOT(${any(answerFields)})`)
    if (kind === 'correct' && name !== 'Kprim')
      extra.push(
        and(
          enabled,
          `(${correctCount})${name === 'Single choice' ? '<>1' : '<1'}`
        )
      )
    if (field === 'solution1')
      extra.push(and(enabled, `NOT(${any(solutionFields)})`))
    if (field === 'solutionMinimum1')
      extra.push(and(enabled, `NOT(${any(rangeFields)})`))
    const invalid = or(
      and(`${cell}<>""`, `NOT(${allowed})`),
      ...(required ? [and(enabled, `${cell}=""`)] : []),
      ...extra
    )
    sheet.addConditionalFormatting({
      ref: `${column}${first}:${column}${last}`,
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: [`IFERROR(IF(${active},${invalid},FALSE),TRUE)`],
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              bgColor: { argb: 'FFFFDBCC' },
            },
          },
        },
        {
          type: 'expression',
          priority: 2,
          formulae: [`IFERROR(NOT(${enabled}),FALSE)`],
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              bgColor: { argb: 'FFE9E9E9' },
            },
          },
        },
      ],
    })
  }
}
