import type ExcelJS from 'exceljs'
import { ELEMENT_DOMAIN_LIMITS } from './elementDomain/core.js'
import {
  ELEMENT_SPREADSHEET_DATA_ROW,
  ELEMENT_SPREADSHEET_EDIT_ROWS,
  ELEMENT_SPREADSHEET_TABLES,
  type ElementSpreadsheetTable,
  SPREADSHEET_DETAIL_FIELDS,
} from './elementSpreadsheetTables.js'

export function addSpreadsheetValidationLists(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet('Instructions')!
  for (const [column, name, values] of [
    ['E', 'KlickerBooleans', ['TRUE', 'FALSE']],
    ['F', 'KlickerDisplayModes', ['LIST', 'GRID']],
    ['G', 'KlickerUnused', [null]],
    ['H', 'KlickerFalse', ['FALSE']],
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
function and(...conditions: string[]) {
  return `AND(${conditions.join(',')})`
}
function or(...conditions: string[]) {
  return `OR(${conditions.join(',')})`
}

/** Rules share the type-tab contract. No formulas are stored in authored cells. */
export function addSpreadsheetValidation(
  sheet: ExcelJS.Worksheet,
  name: ElementSpreadsheetTable
) {
  const headers: readonly string[] = ELEMENT_SPREADSHEET_TABLES[name]
  const first = ELEMENT_SPREADSHEET_DATA_ROW
  const last = first + ELEMENT_SPREADSHEET_EDIT_ROWS - 1
  const letter = (field: string) =>
    sheet.getColumn(headers.indexOf(field) + 1).letter
  const range = (field: string) =>
    `$${letter(field)}$${first}:$${letter(field)}$${last}`
  for (const field of headers) {
    const column = letter(field)
    const row = first
    const cell = `${column}${row}`
    const ref = `$A${row}`
    const refRange = range('ref')
    const isFirst = `MATCH(${ref},${refRange},0)=ROW()-${first - 1}`
    const head = (key: string) =>
      `INDEX(${range(key)},MATCH(${ref},${refRange},0))`
    const present = (key: string) =>
      `COUNTIFS(${refRange},${ref},${range(key)},"<>")>0`
    const yes = (key: string) =>
      headers.includes(key)
        ? or(`${head(key)}=TRUE`, `${head(key)}="TRUE"`)
        : 'FALSE'
    const hasSolution = yes('hasSampleSolution')
    const hasFeedback = and(hasSolution, yes('hasAnswerFeedbacks'))
    const isDetail = SPREADSHEET_DETAIL_FIELDS.has(field)
    let enabled = field === 'ref' || isDetail ? 'TRUE' : isFirst
    let required =
      ['ref', 'name', 'content', 'answer'].includes(field) ||
      (name === 'Flashcards' && field === 'explanation')
    let list: string | undefined
    let valid = `ISTEXT(${cell})`
    const numeric = and(
      `ISNUMBER(${cell})`,
      `ABS(${cell})<=${ELEMENT_DOMAIN_LIMITS.numericalMax}`
    )
    const integer = and(`ISNUMBER(${cell})`, `MOD(${cell},1)=0`)
    if (field === 'correct') {
      enabled = hasSolution
      required = true
      list = 'KlickerBooleans'
      valid = or(
        `${cell}=TRUE`,
        `${cell}=FALSE`,
        `${cell}="TRUE"`,
        `${cell}="FALSE"`
      )
    } else if (field === 'feedback') {
      enabled = hasFeedback
      required = true
    } else if (
      ['basePoints', 'hasSampleSolution', 'hasAnswerFeedbacks'].includes(field)
    ) {
      list =
        field === 'hasAnswerFeedbacks'
          ? `IF(${hasSolution},KlickerBooleans,KlickerFalse)`
          : 'KlickerBooleans'
      valid = and(
        or(
          `${cell}=TRUE`,
          `${cell}=FALSE`,
          `${cell}="TRUE"`,
          `${cell}="FALSE"`
        ),
        field === 'hasAnswerFeedbacks'
          ? or(hasSolution, `${cell}=FALSE`, `${cell}="FALSE"`)
          : 'TRUE'
      )
    } else if (field === 'displayMode') {
      list = 'KlickerDisplayModes'
      valid = or(`${cell}="LIST"`, `${cell}="GRID"`)
    } else if (field === 'solutionMode') {
      enabled = and(isFirst, hasSolution)
      required = true
      list = 'KlickerSolutionModes'
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
          `${cell}${field === 'minimum' ? '<=' : '>='}${head(other)}`
        )
      )
    } else if (field === 'solution' && name === 'Free text') {
      enabled = hasSolution
      required = true
      valid = and(
        `ISTEXT(${cell})`,
        or(
          `NOT(${present('maxLength')})`,
          `LEN(TRIM(${cell}))<=${head('maxLength')}`
        )
      )
    } else if (
      field === 'solution' ||
      field === 'solutionMinimum' ||
      field === 'solutionMaximum'
    ) {
      enabled = and(
        hasSolution,
        `${head('solutionMode')}="${field === 'solution' ? 'EXACT' : 'RANGE'}"`
      )
      required = field === 'solution'
      const bounds = [
        numeric,
        or(`NOT(${present('minimum')})`, `${cell}>=${head('minimum')}`),
        or(`NOT(${present('maximum')})`, `${cell}<=${head('maximum')}`),
      ]
      if (field !== 'solution') {
        const other = `${letter(field === 'solutionMinimum' ? 'solutionMaximum' : 'solutionMinimum')}${row}`
        bounds.push(
          or(
            `${other}=""`,
            `${cell}${field === 'solutionMinimum' ? '<=' : '>='}${other}`
          )
        )
      }
      valid = and(...bounds)
    }
    const nonempty = required ? `LEN(TRIM(${cell}&""))>0` : 'TRUE'
    const allowed = `IFERROR(IF(${enabled},OR(${cell}="",AND(${valid},${nonempty})),${cell}=""),FALSE)`
    // ExcelJS exposes this range API at runtime, but omits it from Worksheet's types.
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
        'Follow the field instructions in row 7. Leave grey cells blank; clear orange cells. Klicker checks all rows on upload.',
      showInputMessage: true,
      promptTitle: field,
      prompt: String(sheet.getRow(7).getCell(column).value ?? '').slice(0, 250),
      formulae: [
        list
          ? `IFERROR(IF(${enabled},${list},KlickerUnused),KlickerUnused)`
          : allowed,
      ],
    })
    const invalid = or(
      and(`${cell}<>""`, `NOT(${allowed})`),
      ...(required ? [and(enabled, `${cell}=""`)] : []),
      ...(field === 'correct' && name === 'Single choice'
        ? [
            and(
              hasSolution,
              `COUNTIFS(${refRange},${ref},${range('correct')},TRUE)<>1`
            ),
          ]
        : []),
      ...(field === 'correct' && name === 'Multiple choice'
        ? [
            and(
              hasSolution,
              `COUNTIFS(${refRange},${ref},${range('correct')},TRUE)<1`
            ),
          ]
        : []),
      ...(field === 'answer' && name === 'Kprim'
        ? [`COUNTIF(${refRange},${ref})<>4`]
        : []),
      ...(field === 'solutionMinimum'
        ? [and(enabled, `${cell}=""`, `${letter('solutionMaximum')}${row}=""`)]
        : [])
    )
    const formatting = (formula: string, color: string, priority: number) => ({
      type: 'expression' as const,
      priority,
      formulae: [formula],
      style: {
        fill: {
          type: 'pattern' as const,
          pattern: 'solid' as const,
          fgColor: { argb: color },
          bgColor: { argb: color },
        },
      },
    })
    sheet.addConditionalFormatting({
      ref: `${column}${first}:${column}${last}`,
      rules: [
        formatting(
          `IFERROR(IF(${field === 'ref' ? `COUNTA($A${row}:$${letter(headers[headers.length - 1]!)}${row})>0` : `${ref}<>""`},${invalid},FALSE),TRUE)`,
          'FFFFDBCC',
          1
        ),
        formatting(
          `IFERROR(AND(${ref}<>"",NOT(${enabled})),FALSE)`,
          'FFE9E9E9',
          2
        ),
      ],
    })
  }
}
