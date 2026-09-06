import type ExcelJS from 'exceljs'
import type { ParsedElementSpreadsheet } from './elementSpreadsheetDomain.js'
import {
  InvalidElementWorkbookError,
  readSpreadsheetCell,
} from './elementSpreadsheetWorkbook.js'
import { elementSchema } from './importExportPackageContract.js'

// Verified against the official downloadable template on 2026-09-05. Its
// current 120/75 limits differ from the 95/60 limits in the help article.
const layouts = [
  { question: 120, answer: 75 },
  { question: 95, answer: 60 },
] as const

export function parseKahootWorkbook(
  workbook: ExcelJS.Workbook
): ParsedElementSpreadsheet {
  if (workbook.worksheets.length !== 1)
    throw new InvalidElementWorkbookError('UNEXPECTED_WORKSHEET')
  const sheet = workbook.worksheets[0]!
  const layout = layouts.find(({ question, answer }) => {
    const headers = [
      `Question - ${question} max length`,
      ...[1, 2, 3, 4].map((index) => `Answer ${index} - ${answer} max length`),
      'Time limit',
      'Correct answer(s)',
    ]
    return headers.every(
      (value, index) =>
        sheet
          .getRow(8)
          .getCell(index + 2)
          .text.trim() === value
    )
  })
  if (!layout) throw new InvalidElementWorkbookError('INVALID_KAHOOT_TEMPLATE')
  const result: ParsedElementSpreadsheet = {
    elements: [],
    answerCollections: [],
    sources: [],
    issues: [],
  }
  let count = 0
  // The official template includes branding. Allow it, but make omission of
  // worksheet images explicit rather than implying image portability.
  if (sheet.getImages().length > 0)
    result.issues.push({
      sheet: sheet.name,
      row: 1,
      ref: null,
      field: '',
      code: 'KAHOOT_IMAGES_NOT_IMPORTED',
    })
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 8) return
    // The official template prepopulates column A with question numbers.
    if (
      ![2, 3, 4, 5, 6, 7, 8].some(
        (column) => row.getCell(column).value !== null
      )
    )
      return
    if (++count > 100)
      throw new InvalidElementWorkbookError('WORKBOOK_TOO_LARGE')
    const ref = `kahoot-${rowNumber}`
    try {
      const question = readSpreadsheetCell(row.getCell(2))
      const answers = [3, 4, 5, 6].map((column) =>
        readSpreadsheetCell(row.getCell(column))
      )
      const timer = readSpreadsheetCell(row.getCell(7))
      const correctCell = readSpreadsheetCell(row.getCell(8))
      if (
        typeof question !== 'string' ||
        !question.trim() ||
        question.length > layout.question
      )
        throw new Error()
      const choices = answers.flatMap((value, ix) => {
        if (value === null || value === '') return []
        if (
          typeof value !== 'string' ||
          !value.trim() ||
          value.length > layout.answer
        )
          throw new Error()
        return [{ originalIndex: ix + 1, value }]
      })
      if (choices.length < 2) throw new Error()
      if (
        timer !== null &&
        (typeof timer !== 'number' ||
          ![5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240].includes(timer))
      )
        throw new Error()
      if (typeof correctCell !== 'number' && typeof correctCell !== 'string')
        throw new Error()
      const correctText = String(correctCell).trim()
      if (!/^[1-4](\s*,\s*[1-4])*$/.test(correctText)) throw new Error()
      const correct = correctText.split(',').map(Number)
      if (
        new Set(correct).size !== correct.length ||
        correct.some(
          (index) => !choices.some((choice) => choice.originalIndex === index)
        )
      )
        throw new Error()
      // Kahoot template values are plain text, not Markdown. Escape Markdown
      // punctuation so imported answers cannot acquire unintended image links.
      const escapeMarkdown = (value: string) =>
        value.replace(/([\\`*_{}[\]()#+\-.!|<>])/g, '\\$1')
      const element = elementSchema.parse({
        ref,
        type: correct.length === 1 ? 'SC' : 'MC',
        name: question,
        content: escapeMarkdown(question),
        explanation: null,
        basePoints: true,
        pointsMultiplier: 1,
        options: {
          displayMode: 'LIST',
          hasSampleSolution: true,
          hasAnswerFeedbacks: false,
          choices: choices.map((choice, ix) => ({
            ix,
            value: escapeMarkdown(choice.value),
            correct: correct.includes(choice.originalIndex),
          })),
        },
      })
      result.elements.push(element)
      result.sources.push({
        ref,
        name: question,
        sheet: sheet.name,
        row: rowNumber,
      })
      if (timer !== null)
        result.issues.push({
          sheet: sheet.name,
          row: rowNumber,
          ref,
          field: 'Time limit',
          code: 'TIMER_NOT_IMPORTED',
        })
    } catch {
      result.issues.push({
        sheet: sheet.name,
        row: rowNumber,
        ref,
        field: '',
        code: 'INVALID_KAHOOT_ROW',
      })
    }
  })
  return result
}
