import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { parseElementSpreadsheetTables } from '../src/lib/elementSpreadsheetDomain.js'
import { elementSpreadsheetTablesFromElements } from '../src/lib/elementSpreadsheetExport.js'
import { computeSpreadsheetElementIdentity } from '../src/lib/elementSpreadsheetIdentity.js'
import {
  loadElementWorkbook,
  readKlickerWorkbook,
  writeKlickerWorkbook,
} from '../src/lib/elementSpreadsheetWorkbook.js'
import { parseKahootWorkbook } from '../src/lib/kahootSpreadsheet.js'
import { parseElementImportPackage } from '../src/services/elementImportPackageParser.js'
import { createNineTypeImportPackage } from './fixtures/importExportNineTypes.js'

function fixtureTables() {
  const source = parseElementImportPackage(createNineTypeImportPackage().buffer)
  return {
    source,
    tables: elementSpreadsheetTablesFromElements(
      source.elements,
      source.answerCollections
    ),
  }
}

describe('fixed element workbooks', () => {
  it.each([
    'SC',
    'MC',
    'KPRIM',
    'NUMERICAL',
    'FREE_TEXT',
    'SELECTION',
    'CASE_STUDY',
  ])('rejects authored solutions when %s sample solutions are disabled', (type) => {
    const { tables } = fixtureTables()
    const row = tables.Elements.find((row) => row.values.type === type)!
    row.values.hasSampleSolution = false
    const result = parseElementSpreadsheetTables(tables)
    expect(
      result.elements.some((element) => element.ref === row.values.ref)
    ).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'DISABLED_SOLUTION_DATA' })
    )
  })

  it('rejects populated feedback when feedback is disabled', () => {
    const { tables } = fixtureTables()
    const row = tables.Elements.find((row) => row.values.type === 'SC')!
    row.values.hasAnswerFeedbacks = false
    const choice = tables.Choices.find(
      (choice) => choice.values.elementRef === row.values.ref
    )!
    choice.values.feedback = 'Authored feedback must not disappear'
    const result = parseElementSpreadsheetTables(tables)
    expect(
      result.elements.some((element) => element.ref === row.values.ref)
    ).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        sheet: 'Choices',
        row: choice.row,
        field: 'feedback',
        code: 'DISABLED_SOLUTION_DATA',
      })
    )
  })

  it('round-trips all nine element types through actual XLSX bytes', async () => {
    const { source, tables } = fixtureTables()
    const workbook = await loadElementWorkbook(
      await writeKlickerWorkbook(tables)
    )
    const read = readKlickerWorkbook(workbook)
    const parsed = parseElementSpreadsheetTables(read.tables, read.issues)
    expect(parsed.issues).toEqual([])
    expect(parsed.elements).toEqual(source.elements)
    expect(parsed.answerCollections).toEqual(source.answerCollections)
    expect(parsed.elements).toHaveLength(9)
  })

  it('rejects dependent invalid data while retaining unrelated elements and original row locations', () => {
    const { tables } = fixtureTables()
    const first = tables.Choices[0]!
    first.values.order = 'not a number'
    const result = parseElementSpreadsheetTables(tables)
    expect(
      result.elements.some((element) => element.ref === first.values.elementRef)
    ).toBe(false)
    expect(result.elements.length).toBeGreaterThan(0)
    expect(result.issues).not.toHaveLength(0)
  })

  it('invalidates every consumer of an invalid answer collection', () => {
    const { tables } = fixtureTables()
    tables.Entries[0]!.values.value = null
    const result = parseElementSpreadsheetTables(tables)
    expect(
      result.elements.some((element) =>
        ['SELECTION', 'CASE_STUDY'].includes(element.type)
      )
    ).toBe(false)
    expect(result.elements).toHaveLength(7)
  })

  it('does not accept cached formula results as authored content', async () => {
    const { tables } = fixtureTables()
    const workbook = await loadElementWorkbook(
      await writeKlickerWorkbook(tables)
    )
    workbook.getWorksheet('Elements')!.getCell('D2').value = {
      formula: '1+1',
      result: 'cached question',
    }
    const read = readKlickerWorkbook(workbook)
    const result = parseElementSpreadsheetTables(read.tables, read.issues)
    expect(result.elements).toHaveLength(8)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        sheet: 'Elements',
        row: 2,
        field: 'content',
        code: 'UNSUPPORTED_CELL',
      })
    )
  })

  it('preserves public image links and literal formula-like text on export', async () => {
    const { tables } = fixtureTables()
    tables.Elements[0]!.values.content =
      '=literal ![image](https://example.blob.core.windows.net/public/image.png)'
    const read = readKlickerWorkbook(
      await loadElementWorkbook(await writeKlickerWorkbook(tables))
    )
    expect(read.tables.Elements[0]!.values.content).toBe(
      tables.Elements[0]!.values.content
    )
    expect(read.issues).toEqual([])
  })

  it('keeps distinct unresolved image references distinct when comparing duplicates', () => {
    const input = {
      type: 'CONTENT' as const,
      content: '![image](https://example.blob.core.windows.net/public/one.png)',
      options: {},
      pointsMultiplier: 1,
      basePoints: true,
    }
    expect(computeSpreadsheetElementIdentity(input)).not.toBeNull()
    expect(computeSpreadsheetElementIdentity(input)).not.toEqual(
      computeSpreadsheetElementIdentity({
        ...input,
        content: input.content.replace('one.png', 'two.png'),
      })
    )
  })

  it('does not silently accept duplicate element refs', () => {
    const { tables } = fixtureTables()
    tables.Elements[1]!.values.ref = tables.Elements[0]!.values.ref!
    const result = parseElementSpreadsheetTables(tables)
    expect(
      result.issues.filter((issue) => issue.code === 'DUPLICATE_REFERENCE')
    ).toHaveLength(2)
  })

  it('maps the current Kahoot layout to SC and MC with row-level errors', () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Quiz')
    sheet.getRow(8).values = [
      null,
      'Question - 120 max length',
      ...[1, 2, 3, 4].map((index) => `Answer ${index} - 75 max length`),
      'Time limit',
      'Correct answer(s)',
    ]
    sheet.getRow(9).values = [1, 'One correct?', 'Yes', 'No', null, null, 15, 1]
    sheet.getRow(10).values = [
      2,
      'Two correct?',
      'First',
      'Second',
      null,
      null,
      45,
      '1,2',
    ]
    sheet.getRow(11).values = [
      3,
      'Invalid correct index',
      'First',
      'Second',
      null,
      null,
      20,
      4,
    ]
    const result = parseKahootWorkbook(workbook)
    expect(result.elements.map((element) => element.type)).toEqual(['SC', 'MC'])
    expect(result.issues).toContainEqual(
      expect.objectContaining({ row: 11, code: 'INVALID_KAHOOT_ROW' })
    )
    expect(result.sources.map((source) => source.row)).toEqual([9, 10])
  })
})
