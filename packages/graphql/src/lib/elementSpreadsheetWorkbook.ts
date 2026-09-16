import ExcelJS from 'exceljs'
import {
  addSpreadsheetInstructions,
  addSpreadsheetTableGuide,
  styleSpreadsheetDataRow,
} from './elementSpreadsheetGuide.js'
import {
  ELEMENT_SPREADSHEET_DATA_ROW,
  ELEMENT_SPREADSHEET_HEADER_ROW,
  ELEMENT_SPREADSHEET_TABLES,
  ELEMENT_SPREADSHEET_VERSION,
  type ElementSpreadsheetTable,
  type ElementSpreadsheetTables,
  emptyElementSpreadsheetTables,
  type SpreadsheetIssue,
  type SpreadsheetValue,
  spreadsheetColumnLabel,
} from './elementSpreadsheetTables.js'
import {
  addSpreadsheetValidation,
  addSpreadsheetValidationLists,
} from './elementSpreadsheetValidation.js'
import { createZip, parseZip } from './zip.js'

const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024
const MAX_EXPANDED_BYTES = 20 * 1024 * 1024
const MAX_COLUMNS = Math.max(
  ...Object.values(ELEMENT_SPREADSHEET_TABLES).map((headers) => headers.length)
)
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
    if (sheet.rowCount > MAX_ROWS || sheet.columnCount > MAX_COLUMNS) {
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
  const version = workbook.getWorksheet('Instructions')?.getCell('A1').value
  if (version !== ELEMENT_SPREADSHEET_VERSION) {
    throw new InvalidElementWorkbookError('UNSUPPORTED_TEMPLATE_VERSION')
  }
  const headerRow = ELEMENT_SPREADSHEET_HEADER_ROW
  const dataRow = ELEMENT_SPREADSHEET_DATA_ROW
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
        (header, index) =>
          sheet.getRow(headerRow).getCell(index + 1).value !==
          spreadsheetColumnLabel(header, name)
      )
    ) {
      throw new InvalidElementWorkbookError('INVALID_HEADERS')
    }
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber < dataRow) return
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
    allRows.some(
      (rows) => rows.length + ELEMENT_SPREADSHEET_DATA_ROW - 1 > MAX_ROWS
    ) ||
    Object.entries(tables).reduce(
      (total, [name, rows]) =>
        total +
        (rows.length + ELEMENT_SPREADSHEET_DATA_ROW - 1) *
          ELEMENT_SPREADSHEET_TABLES[name as ElementSpreadsheetTable].length,
      0
    ) > MAX_CELLS
  ) {
    throw new InvalidElementWorkbookError('WORKBOOK_TOO_LARGE')
  }
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'KlickerUZH'
  addSpreadsheetInstructions(workbook)
  addSpreadsheetValidationLists(workbook)
  for (const [name, headers] of Object.entries(ELEMENT_SPREADSHEET_TABLES)) {
    const sheet = workbook.addWorksheet(name, {
      views: [{ state: 'frozen', xSplit: 2, ySplit: 7 }],
    })
    sheet.columns = headers.map((header) => ({
      key: header,
      style: {
        font: { name: 'Aptos', size: 11 },
        numFmt:
          ['name', 'content', 'explanation', 'unit', 'placeholder'].includes(
            header
          ) ||
          /^(answer|feedback)\d+$/.test(header) ||
          (name === 'Free text' && /^solution\d+$/.test(header))
            ? '@'
            : 'General',
      },
      width: /^(correct)\d+$/.test(header)
        ? 14
        : /^(answer|feedback)\d+$/.test(header)
          ? 32
          : ['content', 'explanation'].includes(header)
            ? 40
            : ['hasSampleSolution', 'hasAnswerFeedbacks'].includes(header)
              ? 20
              : 22,
    }))
    addSpreadsheetTableGuide(sheet, name as ElementSpreadsheetTable)
    sheet.autoFilter = {
      from: { row: ELEMENT_SPREADSHEET_HEADER_ROW, column: 1 },
      to: { row: ELEMENT_SPREADSHEET_HEADER_ROW, column: headers.length },
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
      styleSpreadsheetDataRow(sheet.addRow(values))
    }
    addSpreadsheetValidation(sheet, name as ElementSpreadsheetTable)
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
