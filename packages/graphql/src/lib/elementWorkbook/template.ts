import ExcelJS from 'exceljs'
import {
  ELEMENT_WORKBOOK_DATA_ROW,
  ELEMENT_WORKBOOK_HEADER_ROW,
  MAX_ELEMENT_WORKBOOK_BYTES,
  MAX_ELEMENT_WORKBOOK_ELEMENTS,
} from './parse.js'
import {
  ANSWER_SLOTS,
  ELEMENT_WORKBOOK_FIELDS,
  type ElementWorkbookSheet,
  emptyTemplateRows,
  SOLUTION_SLOTS,
  type TemplateRow,
  type TemplateRows,
  templateColumnLabel,
} from './templateFields.js'
import {
  addTemplateValidation,
  addTemplateValidationLists,
} from './templateValidation.js'

const BLUE = 'FF0028A5'
const INK = 'FF121212'
const WHITE = 'FFFFFFFF'
const LIGHT_BLUE = 'FFF5F5FB'

const GUIDES: Record<ElementWorkbookSheet, [string, string]> = {
  'Single choice': [
    `One row = one question. Enter up to ${ANSWER_SLOTS} answers across the row; leave unused slots empty.`,
    'With a sample solution, exactly one answer must be correct. Mark used answers Yes or No. Optional settings and feedback follow the answers.',
  ],
  'Multiple choice': [
    `One row = one question. Enter up to ${ANSWER_SLOTS} answers across the row; leave unused slots empty.`,
    'With a sample solution, at least one answer must be correct. Mark used answers Yes or No. Optional settings and feedback follow the answers.',
  ],
  Kprim: [
    'One row = one question with exactly four statements, as in KlickerUZH.',
    'With a sample solution, mark each statement Yes (true) or No (false). Without a solution, leave these cells blank.',
  ],
  Numerical: [
    `One row = one question. Provide up to ${SOLUTION_SLOTS} accepted numbers OR ranges. Leave unused slots blank.`,
    'With a sample solution, choose EXACT for numbers or RANGE for intervals. Fill only the enabled columns. Optional units, bounds and settings follow the solutions.',
  ],
  'Free text': [
    `One row = one question. Provide up to ${SOLUTION_SLOTS} accepted wordings in the numbered answer columns.`,
    'Accepted answers need a sample solution. Leave unused slots blank. Optional explanation, points and answer-length settings follow the answers.',
  ],
  Content: [
    'One row = one learning item. Enter its name and content.',
    'An explanation is optional. No answers or scoring settings are needed.',
  ],
  Flashcards: [
    'One row = one flashcard. Enter a name, the front and the back.',
    'Both sides need text. No answers or scoring settings are needed.',
  ],
}

const HELP: Record<string, string> = {
  name: 'Required. A short name for your library. Names do not need to be unique.',
  content:
    'Required. The question or learning text; for flashcards, the front. Plain text or KlickerUZH Markdown.',
  explanation:
    'Optional explanation. Required for flashcards: the back of the card.',
  basePoints:
    'Optional. Yes enables participation points; No disables them. Blank means Yes.',
  pointsMultiplier: 'Optional. Whole number from 1 to 4. Blank means 1.',
  hasSampleSolution:
    'Yes: add a solution. No or blank: leave solution fields empty.',
  displayMode: 'Optional answer layout: LIST or GRID. Blank means LIST.',
  hasAnswerFeedbacks:
    'Optional. Yes requires a sample solution and feedback for every used answer. Otherwise No or blank.',
  answer:
    'One answer. Leave unused answer, correctness and feedback cells blank.',
  correct: 'Yes = correct. No = incorrect. Leave blank without a solution.',
  feedback:
    'Required for each used answer only when Answer feedback? is Yes. Otherwise leave blank.',
  unit: 'Optional unit displayed with the number, e.g. minutes or kg.',
  accuracy: 'Optional decimal places: whole number from 0 to 100.',
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
  tags: 'Optional. Separate tags with semicolons, e.g. Week 1; Microeconomics. Existing tags are reused.',
}

function addInstructions(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Instructions', {
    properties: { tabColor: { argb: BLUE } },
    views: [{ showGridLines: false }],
  })
  sheet.columns = [{ width: 26 }, { width: 110 }]
  const lines = [
    [
      'KlickerUZH element template',
      'Create, edit and share questions in Excel, then import them into your KlickerUZH library.',
    ],
    [
      '1  Choose a type tab',
      'Seven element types are supported. Selection and case-study elements cannot be imported or exported with Excel.',
    ],
    [
      '2  Enter your questions',
      'One row is one complete question or learning item. Enter answers across the row. Keep tab names and rows 1–7 unchanged; start in row 8.',
    ],
    [
      '3  Follow the field rules',
      'Use the Yes/No dropdowns. Leave unused answer slots and grey cells blank. Orange cells need attention. KlickerUZH checks every row again on upload.',
    ],
    [
      '4  Save and import',
      'Save as .xlsx and choose Import from Excel in your question pool. Review the preview, then import. Elements already in your library are skipped.',
    ],
    [
      'Limits and images',
      `Up to ${MAX_ELEMENT_WORKBOOK_ELEMENTS} elements and 5 MB per file. Use image links in Markdown; pasted images, formulas and hyperlinks are not allowed.`,
    ],
  ]
  for (const [index, values] of lines.entries()) {
    const row = sheet.addRow(values)
    row.height = index === 0 ? 30 : 60
    row.font = {
      name: 'Aptos',
      size: 11,
      color: { argb: index === 0 ? WHITE : INK },
    }
    row.alignment = { vertical: 'middle', wrapText: true }
    row.getCell(1).font = { ...row.font, bold: true }
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: index === 0 ? BLUE : index % 2 ? WHITE : LIGHT_BLUE },
      }
    })
  }
}

function addTableGuide(
  sheet: ExcelJS.Worksheet,
  name: ElementWorkbookSheet,
  hasRows: boolean
) {
  const fields = ELEMENT_WORKBOOK_FIELDS[name]
  const color =
    name === 'Content' || name === 'Flashcards'
      ? 'FF536B18'
      : name === 'Numerical' || name === 'Free text'
        ? 'FF147082'
        : BLUE
  sheet.properties.tabColor = { argb: color }
  const end = Math.min(4, fields.length)
  const lines = [
    name,
    GUIDES[name][0],
    GUIDES[name][1],
    hasRows
      ? 'Edit the rows below or add new ones. Each new question goes on a new row.'
      : 'Enter your first question in row 8. Each new question goes on a new row.',
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
  sheet.getRow(ELEMENT_WORKBOOK_HEADER_ROW).height = 34
  sheet.getRow(ELEMENT_WORKBOOK_HEADER_ROW + 1).height = 105
  for (const [index, field] of fields.entries()) {
    const cell = sheet.getRow(ELEMENT_WORKBOOK_HEADER_ROW).getCell(index + 1)
    cell.value = templateColumnLabel(name, field)
    cell.font = { name: 'Aptos', size: 11, bold: true, color: { argb: WHITE } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    const help = sheet
      .getRow(ELEMENT_WORKBOOK_HEADER_ROW + 1)
      .getCell(index + 1)
    const kind = field.replace(/\d+$/, '')
    help.value =
      name === 'Kprim' && kind === 'correct'
        ? 'Yes = true. No = false. Leave blank without a solution.'
        : name === 'Kprim' && kind === 'answer'
          ? 'Required. Enter one statement; all four are needed.'
          : HELP[kind]!
    help.font = { name: 'Aptos', size: 10, color: { argb: INK } }
    help.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: LIGHT_BLUE },
    }
    help.alignment = { vertical: 'top', wrapText: true }
  }
}

function styleDataRow(row: ExcelJS.Row) {
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

const TEXT_FIELDS = [
  'name',
  'content',
  'explanation',
  'unit',
  'placeholder',
  'tags',
]

/** Writes the KlickerUZH element template, optionally filled with rows. */
export async function writeElementWorkbook(rows: TemplateRows) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'KlickerUZH'
  addInstructions(workbook)
  addTemplateValidationLists(workbook)
  for (const [name, fields] of Object.entries(ELEMENT_WORKBOOK_FIELDS) as Array<
    [ElementWorkbookSheet, string[]]
  >) {
    const sheet = workbook.addWorksheet(name, {
      views: [{ state: 'frozen', xSplit: 2, ySplit: 7 }],
    })
    sheet.columns = fields.map((field) => ({
      key: field,
      style: {
        font: { name: 'Aptos', size: 11 },
        // Keep authored text literal so Excel doesn't coerce "1/2" to a date.
        numFmt:
          TEXT_FIELDS.includes(field) ||
          /^(answer|feedback)\d+$/.test(field) ||
          (name === 'Free text' && /^solution\d+$/.test(field))
            ? '@'
            : 'General',
      },
      width: /^correct\d+$/.test(field)
        ? 14
        : /^(answer|feedback)\d+$/.test(field)
          ? 32
          : ['content', 'explanation'].includes(field)
            ? 40
            : ['hasSampleSolution', 'hasAnswerFeedbacks'].includes(field)
              ? 20
              : 22,
    }))
    addTableGuide(sheet, name, rows[name].length > 0)
    sheet.autoFilter = {
      from: { row: ELEMENT_WORKBOOK_HEADER_ROW, column: 1 },
      to: { row: ELEMENT_WORKBOOK_HEADER_ROW, column: fields.length },
    }
    for (const [index, row] of rows[name].entries()) {
      const excelRow = sheet.getRow(ELEMENT_WORKBOOK_DATA_ROW + index)
      fields.forEach((field, column) => {
        const value = row[field]
        if (value !== null && value !== undefined && value !== '')
          excelRow.getCell(column + 1).value = value
      })
      styleDataRow(excelRow)
    }
    addTemplateValidation(sheet, name)
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  if (buffer.length > MAX_ELEMENT_WORKBOOK_BYTES)
    throw new Error('WORKBOOK_TOO_LARGE')
  return buffer
}

/** One complete, editable example per element type. */
export function createTemplateExamples(): TemplateRows {
  const rows = emptyTemplateRows()
  for (const [sheet, content, answers] of [
    [
      'Single choice',
      'Which city is the federal capital of Switzerland?',
      [
        ['Bern', true],
        ['Zurich', false],
      ],
    ],
    [
      'Multiple choice',
      'Which numbers are even?',
      [
        ['2', true],
        ['4', true],
        ['5', false],
      ],
    ],
    [
      'Kprim',
      'Decide whether each statement is true or false.',
      [
        ['A triangle has three sides.', true],
        ['A square has five sides.', false],
        ['Ten is even.', true],
        ['One hour has 100 minutes.', false],
      ],
    ],
  ] as const) {
    const row: TemplateRow = {
      name: `Example: ${sheet}`,
      content,
      hasSampleSolution: 'Yes',
      hasAnswerFeedbacks: 'No',
      displayMode: 'LIST',
      basePoints: 'Yes',
      pointsMultiplier: 1,
      tags: 'Examples',
    }
    answers.forEach(
      ([answer, correct]: readonly [string, boolean], index: number) => {
        row[`answer${index + 1}`] = answer
        row[`correct${index + 1}`] = correct ? 'Yes' : 'No'
      }
    )
    rows[sheet].push(row)
  }
  rows.Numerical.push({
    name: 'Example: Numerical',
    content: 'How many minutes are in an hour?',
    unit: 'minutes',
    accuracy: 0,
    hasSampleSolution: 'Yes',
    solutionMode: 'EXACT',
    solution1: 60,
    basePoints: 'Yes',
    pointsMultiplier: 1,
    tags: 'Examples',
  })
  rows['Free text'].push({
    name: 'Example: Free text',
    content: 'What is the largest planet in our solar system?',
    hasSampleSolution: 'Yes',
    solution1: 'Jupiter',
    basePoints: 'Yes',
    pointsMultiplier: 1,
    tags: 'Examples',
  })
  rows.Content.push({
    name: 'Example: Content',
    content: 'Water can exist as a solid, a liquid or a gas.',
    tags: 'Examples',
  })
  rows.Flashcards.push({
    name: 'Example: Flashcard',
    content: 'What is photosynthesis?',
    explanation:
      'Plants use light energy to turn water and carbon dioxide into sugars, releasing oxygen.',
    tags: 'Examples',
  })
  return rows
}
