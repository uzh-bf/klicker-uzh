import type ExcelJS from 'exceljs'
import {
  ELEMENT_SPREADSHEET_ANSWER_SLOTS,
  ELEMENT_SPREADSHEET_SOLUTION_SLOTS,
  ELEMENT_SPREADSHEET_TABLES,
  ELEMENT_SPREADSHEET_VERSION,
  type ElementSpreadsheetTable,
  spreadsheetColumnLabel,
} from './elementSpreadsheetTables.js'

const BLUE = 'FF0028A5'
const INK = 'FF121212'
const WHITE = 'FFFFFFFF'
const LIGHT_BLUE = 'FFF5F5FB'
const GUIDES: Record<ElementSpreadsheetTable, [string, string]> = {
  'Single choice': [
    `One row = one question. Enter up to ${ELEMENT_SPREADSHEET_ANSWER_SLOTS} answers across the row; leave unused slots empty.`,
    'With a sample solution, exactly one answer must be correct. Mark used answers Yes or No. Optional settings and feedback follow the answers.',
  ],
  'Multiple choice': [
    `One row = one question. Enter up to ${ELEMENT_SPREADSHEET_ANSWER_SLOTS} answers across the row; leave unused slots empty.`,
    'With a sample solution, at least one answer must be correct. Mark used answers Yes or No. Optional settings and feedback follow the answers.',
  ],
  Kprim: [
    'One row = one question with exactly four statements, as in Klicker.',
    'With a sample solution, mark each statement Yes (true) or No (false). Without a solution, leave these cells blank.',
  ],
  Numerical: [
    `One row = one question. Provide up to ${ELEMENT_SPREADSHEET_SOLUTION_SLOTS} accepted numbers OR ranges. Leave unused slots blank.`,
    'With a sample solution, choose EXACT for numbers or RANGE for intervals. Fill only the enabled columns. Optional units, bounds and settings follow the solutions.',
  ],
  'Free text': [
    `One row = one question. Provide up to ${ELEMENT_SPREADSHEET_SOLUTION_SLOTS} accepted wordings in the numbered answer columns.`,
    'Accepted answers need a sample solution. Leave unused slots blank. Optional explanation, points and answer-length settings follow the answers.',
  ],
  Content: [
    'One row = one learning item. Enter its name and content.',
    'An explanation is optional. No answers, scoring settings or identifiers are needed.',
  ],
  Flashcards: [
    'One row = one flashcard. Enter a name, the front and the back.',
    'Both sides need text. No answer fields, scoring settings or identifiers are needed.',
  ],
}
const HELP: Record<string, string> = {
  name: 'Required. A short name for your library. Names do not need to be unique.',
  content:
    'Required. The question or learning text; for flashcards, the front. Plain text or Klicker Markdown.',
  explanation:
    'Optional explanation for any type. Required for flashcards: the back of the card.',
  basePoints:
    'Optional. Yes enables participation points; No disables them. Blank means Yes.',
  pointsMultiplier:
    'Optional. Whole number from 1 to 4, as in Klicker. Blank means 1.',
  hasSampleSolution:
    'Yes: add a solution. No or blank: leave solution fields empty.',
  displayMode: 'Optional answer layout: LIST or GRID. Blank means LIST.',
  hasAnswerFeedbacks:
    'Optional. Yes requires a sample solution and feedback for every used answer. Otherwise No or blank.',
  answer:
    'One answer. Leave unused answer, correctness and feedback cells blank.',
  correct: 'Yes = correct. No = incorrect. Leave blank without a solution.',
  feedback:
    'Optional feature: required for each used answer only when Answer feedback? is Yes. Otherwise leave blank.',
  unit: 'Optional unit displayed with the number, e.g. minutes or kg.',
  accuracy:
    'Optional decimal places: whole number from 0 to 100, as in Klicker.',
  placeholder: 'Optional hint in the empty numerical answer field.',
  minimum: 'Optional lowest allowed answer. Must not exceed Maximum allowed.',
  maximum:
    'Optional highest allowed answer. Must not be below Minimum allowed.',
  solutionMode:
    'With a sample solution: EXACT for numbers or RANGE for intervals. Otherwise leave blank.',
  solution:
    'One accepted answer. Numerical: a number in EXACT mode. Free text: accepted wording. Leave unused slots blank.',
  solutionMinimum:
    'RANGE only: lower accepted bound. Fill at least one bound per used range. Leave unused ranges blank.',
  solutionMaximum:
    'RANGE only: upper accepted bound. Must not be below the matching minimum. Leave unused ranges blank.',
  maxLength:
    'Optional positive whole number limiting answer length. Every accepted wording must fit.',
}
export function addSpreadsheetInstructions(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Instructions', {
    properties: { tabColor: { argb: BLUE } },
    views: [{ showGridLines: false }],
  })
  sheet.columns = [{ width: 26 }, { width: 110 }]
  const lines = [
    [ELEMENT_SPREADSHEET_VERSION, 'Template identifier — keep unchanged.'],
    [
      'KlickerUZH import template',
      'Create questions in Excel. Exporting from Klicker uses JSON ZIP packages.',
    ],
    [
      '1  Choose a type tab',
      'Seven types are supported here. Selection and case-study elements use JSON import instead. Each tab contains one editable example.',
    ],
    [
      '2  Enter your questions',
      'One row is one complete question or learning item. Enter answers across the row. No identifiers or repeated rows are needed. Keep tab names and rows 1–7 unchanged; start in row 8.',
    ],
    [
      '3  Follow the field rules',
      'Use Yes/No dropdowns. Leave unused answer slots and grey cells blank. Orange cells need attention. Klicker also checks pasted data on upload.',
    ],
    [
      '4  Save and import',
      'Save as .xlsx and upload in Import elements. Review the preview and deselect examples you do not want. Exact duplicates are skipped and reported.',
    ],
    [
      'Limits and images',
      `Up to 100 elements and 5 MiB per file. ${ELEMENT_SPREADSHEET_ANSWER_SLOTS} SC/MC answer slots are an Excel-template limit; Klicker itself has no cap. Kprim requires four statements. Use JSON for more answers. Use public Klicker image links in Markdown; no pasted images or formulas.`,
    ],
  ]
  for (const [index, values] of lines.entries()) {
    const row = sheet.addRow(values)
    row.height = index === 0 ? 25 : 60
    row.font = {
      name: 'Aptos',
      size: 11,
      color: { argb: index === 1 ? WHITE : INK },
    }
    row.alignment = { vertical: 'middle', wrapText: true }
    row.getCell(1).font = { ...row.font, bold: true }
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: index === 1 ? BLUE : index % 2 ? WHITE : LIGHT_BLUE },
      }
    })
  }
}
export function addSpreadsheetTableGuide(
  sheet: ExcelJS.Worksheet,
  name: ElementSpreadsheetTable
) {
  const headers = ELEMENT_SPREADSHEET_TABLES[name]
  const color =
    name === 'Content' || name === 'Flashcards'
      ? 'FF536B18'
      : name === 'Numerical' || name === 'Free text'
        ? 'FF147082'
        : BLUE
  sheet.properties.tabColor = { argb: color }
  const end = Math.min(4, headers.length)
  const lines = [
    name,
    GUIDES[name][0],
    GUIDES[name][1],
    'EDITABLE EXAMPLE BELOW • Replace it with your content, or delete the example row. Add each new question on a new row.',
  ]
  for (const [index, value] of lines.entries()) {
    const row = sheet.getRow(index + 1)
    sheet.mergeCells(row.number, 1, row.number, end)
    row.getCell(1).value = value
    row.height = index === 0 ? 30 : 48
    row.font = {
      name: 'Aptos',
      size: index === 0 ? 14 : 11,
      bold: index < 2,
      color: { argb: index === 0 ? WHITE : INK },
    }
    row.alignment = { vertical: 'middle', wrapText: true }
    row.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: index === 0 ? color : index === 3 ? 'FFFFF4DA' : LIGHT_BLUE,
      },
    }
  }
  sheet.getRow(5).height = 12
  sheet.getRow(6).height = 34
  sheet.getRow(7).height = 105
  for (const [index, header] of headers.entries()) {
    const cell = sheet.getRow(6).getCell(index + 1)
    cell.value = spreadsheetColumnLabel(header, name)
    cell.font = { name: 'Aptos', size: 11, bold: true, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    const help = sheet.getRow(7).getCell(index + 1)
    const field = header.replace(/\d+$/, '')
    help.value =
      name === 'Kprim' && field === 'correct'
        ? 'Yes = true. No = false. Leave blank without a solution.'
        : name === 'Kprim' && field === 'answer'
          ? 'Required. Enter one statement; all four are needed.'
          : HELP[field]!
    help.font = { name: 'Aptos', size: 10, color: { argb: INK } }
    help.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: LIGHT_BLUE },
    }
    help.alignment = { vertical: 'top', wrapText: true }
  }
}
export function styleSpreadsheetDataRow(row: ExcelJS.Row) {
  row.height = 60
  row.font = { name: 'Aptos', size: 11, color: { argb: INK } }
  row.alignment = { vertical: 'top', wrapText: true }
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: row.number % 2 ? LIGHT_BLUE : WHITE },
    }
  })
}
