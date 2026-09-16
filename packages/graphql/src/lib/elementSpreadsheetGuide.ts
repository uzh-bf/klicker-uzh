import type ExcelJS from 'exceljs'
import {
  ELEMENT_SPREADSHEET_TABLES,
  ELEMENT_SPREADSHEET_VERSION,
  type ElementSpreadsheetTable,
} from './elementSpreadsheetTables.js'

const BLUE = 'FF0028A5'
const INK = 'FF121212'
const WHITE = 'FFFFFFFF'
const LIGHT_BLUE = 'FFF5F5FB'
const GUIDES: Record<ElementSpreadsheetTable, [string, string]> = {
  'Single choice': [
    'One row per answer option. Repeat the question ref for additional answers.',
    'With a sample solution, mark exactly one answer TRUE and all others FALSE. Feedback needs a sample solution and text for every answer.',
  ],
  'Multiple choice': [
    'One row per answer option. Repeat the question ref for additional answers.',
    'With a sample solution, mark at least one answer TRUE and all others FALSE. Feedback needs a sample solution and text for every answer.',
  ],
  Kprim: [
    'Exactly four answer rows per question. Repeat the same ref on all four rows.',
    'With a sample solution, mark each statement TRUE or FALSE. Without one, leave correct and feedback blank.',
  ],
  Numerical: [
    'One row per accepted number or range. Repeat the question ref for additional solutions.',
    'Choose EXACT or RANGE when sample solutions are enabled. Do not mix modes. Solutions must fit the question’s minimum/maximum; each range must be ordered.',
  ],
  'Free text': [
    'One row per accepted answer. Repeat the question ref for alternative answers.',
    'Enter solutions only when sample solutions are enabled. If maxLength is set, every accepted answer must fit. Without a solution, use one row per question.',
  ],
  Content: [
    'One row per learning item. No answers, sample-solution switch or scoring fields are needed.',
    'Give every item a unique ref, a name and content. An explanation is optional.',
  ],
  Flashcards: [
    'One row per flashcard. content is the front; explanation is the back.',
    'Give every card a unique ref and name. Both the front and back must contain text. No sample-solution switch or scoring fields are needed.',
  ],
}
const HELP: Record<string, string> = {
  ref: 'Required on every row. A short question label you choose, e.g. question-1. Repeat it for additional answers on this tab; use a new label for a new question.',
  name: 'Required on the first row for this ref. A short name for your library. Leave blank on additional answer rows.',
  content:
    'Required on the first row. The question or learning text; for flashcards, the front. Plain text or Klicker Markdown.',
  explanation:
    'First row only. Optional explanation for any type. Required for flashcards: the back of the card.',
  basePoints:
    'First row only. TRUE enables participation points; FALSE disables them. Blank defaults to TRUE.',
  pointsMultiplier:
    'First row only. Whole number from 1 to 4. Blank defaults to 1.',
  hasSampleSolution:
    'First row only. TRUE enables correct answers / accepted solutions. FALSE or blank means no sample solution; clear solution fields.',
  displayMode: 'First row only. LIST or GRID. Blank defaults to LIST.',
  hasAnswerFeedbacks:
    'First row only. TRUE requires a sample solution and feedback for every answer. Otherwise FALSE or blank.',
  answer:
    'Required on every choice row. One answer option or Kprim statement per row. The row order is the answer order.',
  correct:
    'When sample solutions are enabled: TRUE for correct, FALSE for incorrect. Otherwise leave blank. SC needs exactly one TRUE; MC needs at least one.',
  feedback:
    'Required on every answer row when answer feedback is enabled. Otherwise leave blank.',
  unit: 'First row only. Optional unit displayed with the number, e.g. minutes or kg.',
  accuracy:
    'First row only. Decimal places for numerical answers: whole number from 0 to 100.',
  placeholder:
    'First row only. Optional hint in the empty numerical answer field.',
  minimum:
    'First row only. Optional lowest allowed numerical answer. Must not exceed maximum.',
  maximum:
    'First row only. Optional highest allowed numerical answer. Must not be below minimum.',
  solutionMode:
    'First row only. With a sample solution choose EXACT for numbers or RANGE for accepted intervals. Otherwise leave blank.',
  solution:
    'An accepted answer. Numerical: a number in EXACT mode. Free text: accepted wording. Leave blank when sample solutions are disabled.',
  solutionMinimum:
    'RANGE mode only: lower accepted bound. At least one bound is required. Must fit the question bounds and not exceed solutionMaximum.',
  solutionMaximum:
    'RANGE mode only: upper accepted bound. At least one bound is required. Must fit the question bounds and not be below solutionMinimum.',
  maxLength:
    'First row only. Optional positive whole number limiting answer length. Accepted solutions must fit.',
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
      'Keep tab names and rows 1–7 unchanged. Data starts in row 8. On question tabs, repeat a ref to add answers; fill question settings only on its first row.',
    ],
    [
      '3  Follow the field rules',
      'Dropdowns guide entry. Grey cells should stay blank. Orange cells need attention. Pasting can bypass Excel checks; Klicker checks every uploaded row.',
    ],
    [
      '4  Save and import',
      'Save as .xlsx and upload in Import elements. Review the preview and deselect examples you do not want. Exact duplicates are skipped and reported.',
    ],
    [
      'Limits and images',
      'Up to 100 elements and 5 MiB per file. Editing checks cover 1,000 data rows per tab. Use public Klicker image URLs in Markdown; no pasted images, macros or Excel formulas. Images depend on their source remaining available.',
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
    'EDITABLE EXAMPLE BELOW • Replace it with your content, or deselect it in the import preview. Fill question settings only on the first row of each ref.',
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
  sheet.getRow(7).height = 145
  for (const [index, header] of headers.entries()) {
    const cell = sheet.getRow(6).getCell(index + 1)
    cell.value = header
    cell.font = { name: 'Aptos', size: 11, bold: true, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    const help = sheet.getRow(7).getCell(index + 1)
    help.value = HELP[header]!
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
