import ExcelJS from 'exceljs'
import {
  ELEMENT_SPREADSHEET_TABLES,
  ELEMENT_SPREADSHEET_VERSION,
  type ElementSpreadsheetTable,
  type ElementSpreadsheetTables,
  emptyElementSpreadsheetTables,
  type SpreadsheetIssue,
  type SpreadsheetValue,
} from './elementSpreadsheetTables.js'
import { createZip, parseZip } from './zip.js'

const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024
const MAX_EXPANDED_BYTES = 20 * 1024 * 1024
const MAX_ROWS = 10_000
const MAX_CELLS = 100_000
const MAX_CELL_LENGTH = 32_767

export class InvalidElementWorkbookError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

/** Bound decompression before ExcelJS touches untrusted XML. Rebuild from the
 * verified entries so the downstream ZIP reader sees exactly the same bytes. */
export async function loadElementWorkbook(buffer: Buffer) {
  if (buffer.length === 0 || buffer.length > MAX_WORKBOOK_BYTES) {
    throw new InvalidElementWorkbookError('WORKBOOK_TOO_LARGE')
  }
  const entries = parseZip(buffer, {
    maxEntries: 250,
    maxUncompressedBytes: MAX_EXPANDED_BYTES,
    allowDirectories: true,
    allowDataDescriptors: true,
  }).filter((entry) => !entry.path.endsWith('/'))
  for (const entry of entries) {
    if (/vbaProject|externalLinks|embeddings/i.test(entry.path)) {
      throw new InvalidElementWorkbookError('UNSUPPORTED_WORKBOOK_CONTENT')
    }
    if (
      /\.(xml|rels)$/i.test(entry.path) &&
      /<!DOCTYPE|<!ENTITY/i.test(entry.data.toString('utf8'))
    ) {
      throw new InvalidElementWorkbookError('UNSUPPORTED_WORKBOOK_CONTENT')
    }
  }
  const workbook = new ExcelJS.Workbook()
  // ExcelJS 4.4 declares its Buffer as ArrayBuffer, although load accepts Node
  // Buffers at runtime. Keep the compatibility cast at this library boundary.
  await workbook.xlsx.load(
    createZip(entries) as unknown as Parameters<typeof workbook.xlsx.load>[0]
  )
  if (workbook.worksheets.length > 15) {
    throw new InvalidElementWorkbookError('WORKBOOK_TOO_LARGE')
  }
  let cells = 0
  for (const sheet of workbook.worksheets) {
    if (sheet.rowCount > MAX_ROWS || sheet.columnCount > 30) {
      throw new InvalidElementWorkbookError('WORKBOOK_TOO_LARGE')
    }
    sheet.eachRow((row) =>
      row.eachCell((cell) => {
        cells++
        if (cells > MAX_CELLS || cell.text.length > MAX_CELL_LENGTH) {
          throw new InvalidElementWorkbookError('WORKBOOK_TOO_LARGE')
        }
      })
    )
  }
  return workbook
}

export function readSpreadsheetCell(cell: ExcelJS.Cell): SpreadsheetValue {
  const value = cell.value
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  // Rich text is text styling, not Klicker Markdown. Never use formula caches
  // or hyperlink display text in place of the actual authored cell value.
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((run) => run.text).join('')
  }
  throw new InvalidElementWorkbookError('UNSUPPORTED_CELL')
}

export function readKlickerWorkbook(workbook: ExcelJS.Workbook) {
  if (
    workbook.getWorksheet('Instructions')?.getCell('A1').value !==
    ELEMENT_SPREADSHEET_VERSION
  ) {
    throw new InvalidElementWorkbookError('UNSUPPORTED_TEMPLATE_VERSION')
  }
  const tables = emptyElementSpreadsheetTables()
  const issues: SpreadsheetIssue[] = []
  for (const sheet of workbook.worksheets) {
    if (sheet.getImages().length > 0)
      throw new InvalidElementWorkbookError('EMBEDDED_IMAGES_UNSUPPORTED')
    if (
      sheet.name !== 'Instructions' &&
      !(sheet.name in ELEMENT_SPREADSHEET_TABLES)
    ) {
      throw new InvalidElementWorkbookError('UNEXPECTED_WORKSHEET')
    }
  }
  for (const [name, headers] of Object.entries(ELEMENT_SPREADSHEET_TABLES)) {
    const sheet = workbook.getWorksheet(name)
    if (!sheet) throw new InvalidElementWorkbookError('MISSING_WORKSHEET')
    if (
      headers.some(
        (header, index) => sheet.getRow(1).getCell(index + 1).value !== header
      )
    ) {
      throw new InvalidElementWorkbookError('INVALID_HEADERS')
    }
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const values: Record<string, SpreadsheetValue> = {}
      for (const [index, field] of headers.entries()) {
        try {
          values[field] = readSpreadsheetCell(row.getCell(index + 1))
        } catch {
          values[field] = null
          issues.push({
            sheet: name,
            row: rowNumber,
            ref: null,
            field,
            code: 'UNSUPPORTED_CELL',
          })
        }
      }
      row.eachCell((cell, column) => {
        if (column > headers.length && cell.value !== null) {
          issues.push({
            sheet: name,
            row: rowNumber,
            ref: null,
            field: cell.address,
            code: 'UNEXPECTED_COLUMN',
          })
        }
      })
      if (
        Object.values(values).some((value) => value !== null && value !== '')
      ) {
        tables[name as ElementSpreadsheetTable].push({
          sheet: name as ElementSpreadsheetTable,
          row: rowNumber,
          values,
        })
      }
    })
  }
  return { tables, issues }
}

export async function writeKlickerWorkbook(tables: ElementSpreadsheetTables) {
  const allRows = Object.values(tables)
  if (
    tables.Elements.length > 100 ||
    tables.Collections.length > 50 ||
    tables.Entries.length > 5000 ||
    allRows.some((rows) => rows.length + 1 > MAX_ROWS) ||
    Object.entries(tables).reduce(
      (total, [name, rows]) =>
        total +
        (rows.length + 1) *
          ELEMENT_SPREADSHEET_TABLES[name as ElementSpreadsheetTable].length,
      0
    ) > MAX_CELLS
  ) {
    throw new InvalidElementWorkbookError('WORKBOOK_TOO_LARGE')
  }
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'KlickerUZH'
  const instructions = workbook.addWorksheet('Instructions')
  instructions.getColumn(1).width = 110
  for (const value of [
    ELEMENT_SPREADSHEET_VERSION,
    'Enter one element per row in Elements. Keep worksheet names and headers unchanged.',
    'Types: SC, MC, KPRIM, NUMERICAL, FREE_TEXT, SELECTION, CASE_STUDY, CONTENT, FLASHCARD.',
    'Use unique refs such as question-1 and pool-1. Related tables refer to these refs.',
    'Order starts at 0. Boolean values are TRUE/FALSE. Enter numbers as numeric cells.',
    'Content, explanation, choices and case descriptions use Klicker Markdown. Flashcard back: explanation.',
    'Choices: one answer per row for SC/MC/KPRIM. Solutions: one free-text or numerical solution per row.',
    'Set hasSampleSolution to TRUE when supplying correct answers or solutions. For choice feedback, also set hasAnswerFeedbacks to TRUE.',
    'Numerical Solutions use either value or minimum/maximum, never both. Do not mix exact values and ranges.',
    'Selection/case study: fill Collections and Entries, then SelectedItems for the correct/selected entries.',
    'Case studies also need Criteria and Cases. With sample solutions, fill every case/entry/criterion combination.',
    'Image links retain their original public Klicker URL. Images depend on the original blob remaining available.',
    'Embedded images and formula cells are unsupported. Text starting with = remains literal text on export.',
    'Limit: 100 elements, 5 MiB workbook, 32767 characters per cell. Use ZIP for longer content.',
    'Imports create private REVIEW elements. Exact duplicates are skipped; names, tags and status do not affect equality.',
  ])
    instructions.addRow([value])
  for (const [name, headers] of Object.entries(ELEMENT_SPREADSHEET_TABLES)) {
    const sheet = workbook.addWorksheet(name, {
      views: [{ state: 'frozen', ySplit: 1 }],
    })
    sheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: ['content', 'explanation', 'value', 'description'].includes(header)
        ? 55
        : 22,
    }))
    sheet.getRow(1).font = { bold: true }
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    }
    for (const row of tables[name as ElementSpreadsheetTable]) {
      const values = headers.map((header) => row.values[header] ?? null)
      if (
        values.some(
          (value) => typeof value === 'string' && value.length > MAX_CELL_LENGTH
        )
      ) {
        throw new InvalidElementWorkbookError('CELL_TOO_LONG')
      }
      sheet.addRow(values).alignment = { vertical: 'top', wrapText: true }
    }
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  if (buffer.length > MAX_WORKBOOK_BYTES)
    throw new InvalidElementWorkbookError('WORKBOOK_TOO_LARGE')
  // Every workbook we emit must satisfy the same decompression budget on import.
  parseZip(buffer, {
    maxEntries: 250,
    maxUncompressedBytes: MAX_EXPANDED_BYTES,
    allowDirectories: true,
  })
  return buffer
}
