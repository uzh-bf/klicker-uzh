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

const TAB_GUIDES: Record<ElementSpreadsheetTable, [string, string, string]> = {
  Elements: [
    'Every question or learning item starts here.',
    'One row per element. Give it a short reference, choose its type, then enter its name and content. Only fill settings that apply to that type.',
    BLUE,
  ],
  Choices: [
    'Answer options for single choice, multiple choice and Kprim.',
    'One row per answer option (or Kprim statement). Repeat the question reference in elementRef. Number the options 0, 1, 2, … in order.',
    'FF147082',
  ],
  Solutions: [
    'Accepted answers for numerical and free-text questions.',
    'One row per accepted answer. For numbers, use value for an exact answer OR minimum/maximum for a range. For text, put the accepted wording in value.',
    'FF147082',
  ],
  Collections: [
    'Reusable answer lists for selection and case-study questions.',
    'One row names an answer list, for example “Countries”. Give the list a ref such as countries. Its individual answers go in Entries.',
    'FF536B18',
  ],
  Entries: [
    'The individual answers inside an answer list.',
    'One row per item, for example “Switzerland”. collectionRef points to its list in Collections; ref identifies this particular item, for example country-ch.',
    'FF536B18',
  ],
  SelectedItems: [
    'Connect selected answer-list items to a question.',
    'For selection questions, list the correct items here when providing a solution. For case studies, list the items participants will assess. One elementRef / entryRef pair per row.',
    'FF536B18',
  ],
  Criteria: [
    'The rating scales used in a case study.',
    'One row per rating criterion, for example “Risk”. Set the lowest and highest rating and the step between ratings. Other element types leave this tab empty.',
    'FFA27200',
  ],
  Cases: [
    'The situations participants assess in a case study.',
    'One row per situation, with a title and description. Link it to the case-study question using elementRef. Other element types leave this tab empty.',
    'FFA27200',
  ],
  CaseSolutions: [
    'Accepted rating ranges for a case-study solution.',
    'Only needed when providing a sample solution. Add a row for every combination of case, selected item and criterion. minimum/maximum define its accepted rating range.',
    'FFA27200',
  ],
}

const FIELD_HELP: Record<string, string> = {
  ref: 'A short, unique label you choose, e.g. question-1. Other tabs use this label to link to this row. It is not a Klicker database ID.',
  elementRef: 'Copy the ref of the question from Elements, exactly as written.',
  collectionRef: 'Copy the ref of the answer list from Collections.',
  answerCollectionRef:
    'For selection and case-study questions: copy the answer-list ref from Collections.',
  entryRef: 'Copy the ref of the answer item from Entries.',
  caseRef: 'Copy the ref of the situation from Cases for this question.',
  criterionRef:
    'Copy the ref of the rating criterion from Criteria for this question.',
  type: 'Use a type code from the “Which tabs do I need?” section in Instructions, e.g. SC for single choice.',
  name: 'A short name that helps you recognise the element, answer list or criterion.',
  content:
    'The question or learning text participants see. For flashcards, this is the front. Plain text works; Klicker Markdown is also supported.',
  explanation:
    'Explanation or solution text for any element type. For flashcards, this is the back of the card.',
  basePoints:
    'Question types only: TRUE enables participation points; FALSE disables them. Blank defaults to TRUE. CONTENT and FLASHCARD never receive base points.',
  pointsMultiplier:
    'The element’s points multiplier. Leave blank for the default (1).',
  hasSampleSolution:
    'TRUE if you provide correct answers or a sample solution. Leave blank or use FALSE otherwise. Not used for CONTENT or FLASHCARD.',
  hasAnswerFeedbacks:
    'SC/MC/KPRIM only: TRUE to add answer-specific feedback. Also set hasSampleSolution to TRUE. Otherwise leave blank or FALSE.',
  displayMode: 'SC/MC/KPRIM only: LIST or GRID. Leave blank for LIST.',
  order:
    'Position within this question: start at 0, then 1, 2, … without gaps. Start again at 0 for the next question.',
  correct:
    'TRUE for a correct answer/statement, FALSE for an incorrect one. Only fill when hasSampleSolution is TRUE; otherwise leave blank.',
  feedback:
    'Optional feedback for this answer. Only fill when hasSampleSolution and hasAnswerFeedbacks are both TRUE.',
  value:
    'The answer text or number. See the description at the top of this tab for what belongs here.',
  description:
    'Text describing this answer list or case. Case descriptions support Klicker Markdown.',
  title: 'A short title for this case-study situation.',
  unit: 'Optional unit shown beside a number or rating, e.g. kg or %. Leave blank when there is no unit.',
  accuracy:
    'Numerical questions only: number of decimal places used for the answer.',
  placeholder:
    'Numerical questions only: optional hint in the empty answer field.',
  minimum:
    'Lowest allowed number or rating. In a solution tab, the lower end of an accepted range.',
  maximum:
    'Highest allowed number or rating. In a solution tab, the upper end of an accepted range.',
  maxLength:
    'Free-text questions only: optional maximum answer length in characters.',
  numberOfInputs:
    'Required for selection questions: how many answer items participants must select. Enter a positive whole number, e.g. 1.',
  step: 'Size of one step on the rating scale, e.g. 1 for whole-number ratings.',
  labelMin:
    'Optional text at the low end of the scale, e.g. “Low”. If using labels, fill both labelMin and labelMax.',
  labelMid: 'Optional text at the middle of the scale.',
  labelMax:
    'Optional text at the high end of the scale, e.g. “High”. If using labels, fill both labelMin and labelMax.',
}

const TYPE_GUIDES = [
  ['SC', 'Single choice — one correct answer', 'Elements + Choices'],
  [
    'MC',
    'Multiple choice — several answers can be correct',
    'Elements + Choices',
  ],
  [
    'KPRIM',
    'Kprim — four true/false statements',
    'Elements + Choices (exactly four statements)',
  ],
  [
    'NUMERICAL',
    'Numerical — participants enter a number',
    'Elements; add Solutions for accepted answers',
  ],
  [
    'FREE_TEXT',
    'Free text — participants type an answer',
    'Elements; add Solutions for accepted answers',
  ],
  [
    'CONTENT',
    'Content — text or information, without a question',
    'Elements only',
  ],
  [
    'FLASHCARD',
    'Flashcard — a front and a back',
    'Elements only; back goes in explanation',
  ],
  [
    'SELECTION',
    'Selection — choose from an answer list',
    'Elements + Collections + Entries; SelectedItems for correct answers',
  ],
  [
    'CASE_STUDY',
    'Case study — rate items in one or more situations',
    'Elements + Collections + Entries + SelectedItems + Criteria + Cases; CaseSolutions for solutions',
  ],
]

/** Keep the front page short; each data tab owns its instructions. */
export function addSpreadsheetInstructions(
  workbook: ExcelJS.Workbook,
  examples: boolean
) {
  const sheet = workbook.addWorksheet('Instructions', {
    properties: { tabColor: { argb: BLUE } },
    views: [{ state: 'frozen', ySplit: 2, showGridLines: false }],
  })
  sheet.columns = [{ width: 25 }, { width: 49 }, { width: 64 }]
  sheet.addRow([
    ELEMENT_SPREADSHEET_VERSION,
    'Template identifier — keep unchanged.',
  ])
  const line = (label: string, text: string, heading = false) => {
    const row = sheet.addRow([label, text])
    sheet.mergeCells(row.number, 2, row.number, 3)
    row.height = text.length > 130 ? 48 : 34
    row.font = {
      name: 'Aptos',
      size: 11,
      color: { argb: heading ? WHITE : INK },
    }
    row.alignment = { vertical: 'middle', wrapText: true }
    row.getCell(1).font = { ...row.font, bold: true }
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: heading ? BLUE : row.number % 2 ? LIGHT_BLUE : WHITE },
      }
    })
  }
  line(
    'Start here',
    'KlickerUZH • Questions and learning content in Excel',
    true
  )
  line(
    '1  Open Elements',
    examples
      ? 'This template contains nine editable examples, one per type. Importing it unchanged previews all nine. Replace them with your content or deselect unwanted examples in the import preview.'
      : 'This workbook contains your exported elements. Edit them in the data tabs; importing creates copies, not updates to the originals.'
  )
  line(
    '2  Follow each tab',
    'Dropdowns guide entry. Grey cells do not apply; clear orange cells after changing type. Blue headers are in row 6, column help in row 7, and editable data starts in row 8. Keep tab names and the first seven rows unchanged.'
  )
  line(
    '3  Save and upload',
    'Save as .xlsx, then use Excel in the Klicker library. Review the elements before importing. Exact duplicates are skipped and reported.'
  )
  line(
    'Which tabs do I need?',
    'Use only the tabs needed for your element type. Keep unused tabs, but leave their data rows empty.',
    true
  )
  for (const [code, meaning, tabs] of TYPE_GUIDES)
    line(code!, `${meaning}. ${tabs}.`)
  line(
    'Linking rows',
    'References are labels you choose, e.g. example-sc. Copy them exactly between tabs. Keep each element, collection and entry ref unique. Order starts at 0 for each question.'
  )
  line(
    'Text and images',
    'Use plain text or Klicker Markdown, numbers, and TRUE/FALSE. No Excel formulas or pasted images. Existing public Klicker image links depend on the original image remaining available.'
  )
  line(
    'Excel checks',
    'Supported dropdown and numeric fields have checks for 100 element rows and at least 1,000 rows on other checked tabs. Pasting may bypass checks; Klicker validates every row on upload.'
  )
  line(
    'Limits',
    '100 elements, 5 MiB per workbook, 32,767 characters per cell. Use ZIP for longer content or separately copied media. Imports are private copies in Review status.'
  )
}

export function addSpreadsheetTableGuide(
  sheet: ExcelJS.Worksheet,
  name: ElementSpreadsheetTable,
  examples: boolean
) {
  const [purpose, detail, color] = TAB_GUIDES[name]
  sheet.properties.tabColor = { argb: color }
  const end = Math.min(5, ELEMENT_SPREADSHEET_TABLES[name].length)
  for (const [index, text] of [
    name,
    purpose,
    detail,
    examples
      ? 'EDITABLE EXAMPLES BELOW • Replace or remove example data across linked tabs, or deselect unwanted examples in the import preview.'
      : 'YOUR EXPORTED DATA BELOW • Edit data from row 8. Keep references consistent across tabs. Import creates copies; exact duplicates are skipped.',
  ].entries()) {
    const row = sheet.getRow(index + 1)
    sheet.mergeCells(row.number, 1, row.number, end)
    row.getCell(1).value = text
    row.height = index === 0 ? 30 : index === 2 ? 58 : 44
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
  sheet.getRow(7).height = Math.max(
    ...ELEMENT_SPREADSHEET_TABLES[name].map(
      (header, index) =>
        Math.ceil(
          FIELD_HELP[header]!.length / (sheet.getColumn(index + 1).width! * 1.1)
        ) *
          13 +
        12
    )
  )
  for (const [index, header] of ELEMENT_SPREADSHEET_TABLES[name].entries()) {
    const cell = sheet.getRow(6).getCell(index + 1)
    cell.value = header
    cell.font = {
      name: 'Aptos',
      size: 11,
      bold: true,
      color: { argb: WHITE },
    }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    const help = sheet.getRow(7).getCell(index + 1)
    help.value = FIELD_HELP[header]!
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
