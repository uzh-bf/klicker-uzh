import type ExcelJS from 'exceljs'
import { ELEMENT_DOMAIN_LIMITS } from './elementDomain/core.js'
import {
  ELEMENT_SPREADSHEET_DATA_ROW,
  ELEMENT_SPREADSHEET_TABLES,
  ELEMENT_SPREADSHEET_TYPE_FIELDS,
  type ElementSpreadsheetTable,
} from './elementSpreadsheetTables.js'

/** Named ranges keep dependent lists compatible with Excel without macros. */
export function addSpreadsheetValidationLists(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet('Instructions')!
  for (const [column, name, values] of [
    ['E', 'KlickerBooleans', ['TRUE', 'FALSE']],
    ['F', 'KlickerDisplayModes', ['LIST', 'GRID']],
    ['G', 'KlickerUnused', [null]],
    ['H', 'KlickerFalse', ['FALSE']],
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

function applicable(field: string, row: number) {
  const types = Object.entries(ELEMENT_SPREADSHEET_TYPE_FIELDS)
    .filter(([, fields]) => fields.includes(field))
    .map(([type]) => type)
  if (!types.length) return undefined
  const typeCondition = `OR(${types.map((type) => `$B${row}="${type}"`).join(',')})`
  return typeCondition
}

function numberRule(field: string, cell: string) {
  const numeric = `ISNUMBER(${cell})`
  const integer = `AND(${numeric},MOD(${cell},1)=0)`
  switch (field) {
    case 'order':
      return `AND(${integer},${cell}>=0)`
    case 'numberOfInputs':
    case 'maxLength':
      return `AND(${integer},${cell}>0)`
    case 'accuracy':
      return `AND(${integer},${cell}>=0,${cell}<=${ELEMENT_DOMAIN_LIMITS.numericalAccuracyMax})`
    case 'pointsMultiplier':
      return `AND(${integer},${cell}>=${ELEMENT_DOMAIN_LIMITS.pointsMultiplierMin},${cell}<=${ELEMENT_DOMAIN_LIMITS.pointsMultiplierMax})`
    case 'step':
      return `AND(${numeric},${cell}>0)`
    case 'minimum':
    case 'maximum':
      return `AND(${numeric},ABS(${cell})<=${ELEMENT_DOMAIN_LIMITS.numericalMax})`
    default:
      return undefined
  }
}

/** Excel checks assist editing; server validation still checks every uploaded row. */
export function addSpreadsheetValidation(
  sheet: ExcelJS.Worksheet,
  name: ElementSpreadsheetTable
) {
  const first = ELEMENT_SPREADSHEET_DATA_ROW
  const capacity = name === 'Elements' ? 100 : name === 'Entries' ? 5000 : 1000
  const last = Math.max(sheet.rowCount, first + capacity - 1)
  for (const [index, field] of ELEMENT_SPREADSHEET_TABLES[name].entries()) {
    const column = sheet.getColumn(index + 1).letter
    const firstCell = `${column}${first}`
    const firstApplicable =
      name === 'Elements' ? applicable(field, first) : undefined
    if (firstApplicable) {
      sheet.addConditionalFormatting({
        ref: `${firstCell}:${column}${last}`,
        rules: [
          {
            type: 'expression',
            priority: 1,
            formulae: [
              `AND($B${first}<>"",NOT(${firstApplicable}),${firstCell}<>"")`,
            ],
            style: {
              fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFDBCC' },
                bgColor: { argb: 'FFFFDBCC' },
              },
            },
          },
          {
            type: 'expression',
            priority: 2,
            formulae: [`AND($B${first}<>"",NOT(${firstApplicable}))`],
            style: {
              fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE9E9E9' },
                bgColor: { argb: 'FFE9E9E9' },
              },
              font: { color: { argb: 'FF666666' } },
            },
          },
        ],
      })
    }
    if (name === 'Elements' && field === 'hasAnswerFeedbacks') {
      sheet.addConditionalFormatting({
        ref: `${firstCell}:${column}${last}`,
        rules: [
          {
            type: 'expression',
            priority: 1,
            formulae: [
              `AND(${firstApplicable},NOT(OR($H${first}=TRUE,$H${first}="TRUE")),${firstCell}<>"",NOT(OR(${firstCell}=FALSE,${firstCell}="FALSE")))`,
            ],
            style: {
              fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFDBCC' },
                bgColor: { argb: 'FFFFDBCC' },
              },
            },
          },
        ],
      })
    }
    for (let row = first; row <= last; row++) {
      const cell = `${column}${row}`
      const enabled = name === 'Elements' ? applicable(field, row) : undefined
      const numeric = numberRule(field, cell)
      const hasSolution = `OR($H${row}=TRUE,$H${row}="TRUE")`
      const list =
        field === 'type'
          ? `"${Object.keys(ELEMENT_SPREADSHEET_TYPE_FIELDS).join(',')}"`
          : field === 'displayMode'
            ? 'KlickerDisplayModes'
            : [
                  'basePoints',
                  'hasSampleSolution',
                  'hasAnswerFeedbacks',
                  'correct',
                ].includes(field)
              ? field === 'hasAnswerFeedbacks'
                ? `IF(${hasSolution},KlickerBooleans,KlickerFalse)`
                : 'KlickerBooleans'
              : undefined
      if (!enabled && !numeric && !list) continue
      const valueHint = list
        ? field === 'hasAnswerFeedbacks'
          ? 'Enable sample solutions before choosing TRUE.'
          : 'Choose a value from the dropdown.'
        : field === 'pointsMultiplier'
          ? 'Enter a whole number from 1 to 4.'
          : field === 'accuracy'
            ? 'Enter a whole number from 0 to 100.'
            : ['numberOfInputs', 'maxLength'].includes(field)
              ? 'Enter a positive whole number.'
              : field === 'order'
                ? 'Enter a whole number starting at 0.'
                : field === 'step'
                  ? 'Enter a number greater than 0.'
                  : numeric
                    ? 'Enter a number; Klicker also checks ranges on upload.'
                    : 'Enter text or leave blank.'
      const message = enabled
        ? `${valueHint} Choose the type first. Leave grey cells blank; clear orange cells. ${field === 'hasSampleSolution' ? 'Content and Flashcard must leave this blank.' : ''}`
        : `${valueHint} Optional fields may be left blank.`
      sheet.getCell(cell).dataValidation = {
        type: list ? 'list' : 'custom',
        // Ignore-blank must be off for a dependent list pointing to an empty
        // range, otherwise Excel can accept arbitrary text in a disabled field.
        allowBlank: !enabled,
        formulae: [
          list
            ? enabled
              ? `IF(${enabled},${list},KlickerUnused)`
              : list
            : `OR(${cell}="",AND(${enabled ?? 'TRUE'},${numeric ?? 'TRUE'}))`,
        ],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Check this value',
        error: message,
        showInputMessage: true,
        promptTitle: field,
        prompt: message,
      }
    }
  }
}
