import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { parseElementSpreadsheetTables } from '../src/lib/elementSpreadsheetDomain.js'
import { createElementSpreadsheetExamples } from '../src/lib/elementSpreadsheetExamples.js'
import {
  ELEMENT_SPREADSHEET_TABLES,
  type ElementSpreadsheetTable,
  emptyElementSpreadsheetTables,
} from '../src/lib/elementSpreadsheetTables.js'
import {
  loadElementWorkbook,
  readKlickerWorkbook,
  writeKlickerWorkbook,
} from '../src/lib/elementSpreadsheetWorkbook.js'

const parsed = () =>
  parseElementSpreadsheetTables(createElementSpreadsheetExamples())
describe('type-specific import workbooks', () => {
  it('has one valid example for every supported type and no collection-dependent types', async () => {
    const workbook = await loadElementWorkbook(
      await writeKlickerWorkbook(createElementSpreadsheetExamples())
    )
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Instructions',
      ...Object.keys(ELEMENT_SPREADSHEET_TABLES),
    ])
    const read = readKlickerWorkbook(workbook)
    const result = parseElementSpreadsheetTables(read.tables, read.issues)
    expect(result.issues).toEqual([])
    expect(result.elements.map((element) => element.type)).toEqual([
      'SC',
      'MC',
      'KPRIM',
      'NUMERICAL',
      'FREE_TEXT',
      'CONTENT',
      'FLASHCARD',
    ])
    expect(result.answerCollections).toEqual([])
    expect(result.sources.every((source) => source.row === 8)).toBe(true)
  })
  it.each([
    'klicker-elements-1',
    'klicker-elements-2',
    'kahoot',
  ])('rejects unsupported template %s', async (version) => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('Instructions').getCell('A1').value = version
    expect(() => readKlickerWorkbook(workbook)).toThrow(
      'UNSUPPORTED_TEMPLATE_VERSION'
    )
  })
  it('allows an empty template without inventing elements', () => {
    expect(
      parseElementSpreadsheetTables(emptyElementSpreadsheetTables()).elements
    ).toEqual([])
  })
  it.each([
    'Single choice',
    'Multiple choice',
    'Kprim',
    'Numerical',
    'Free text',
  ] as ElementSpreadsheetTable[])('rejects solution data after disabling the switch on %s', (sheet) => {
    const tables = createElementSpreadsheetExamples()
    tables[sheet][0]!.values.hasSampleSolution = false
    const result = parseElementSpreadsheetTables(tables)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ sheet, code: 'DISABLED_SOLUTION_DATA' })
    )
    expect(result.elements).toHaveLength(6)
  })
  it('requires every feedback and a sample solution', () => {
    const tables = createElementSpreadsheetExamples()
    tables['Single choice'][0]!.values.hasAnswerFeedbacks = true
    expect(parseElementSpreadsheetTables(tables).issues).toContainEqual(
      expect.objectContaining({
        sheet: 'Single choice',
        row: 8,
        field: 'feedback',
      })
    )
  })
  it('allows disabling feedback while keeping a sample solution', () => {
    expect(
      parsed().elements.find((element) => element.type === 'SC')?.options
        .hasSampleSolution
    ).toBe(true)
    expect(parsed().issues).toEqual([])
  })
  it.each([
    ['Single choice', 'SC_ONE_CORRECT'],
    ['Multiple choice', 'MC_CORRECT_REQUIRED'],
  ] as const)('checks correct-answer counts for %s', (sheet, code) => {
    const tables = createElementSpreadsheetExamples()
    for (const row of tables[sheet]) row.values.correct = false
    expect(parseElementSpreadsheetTables(tables).issues).toContainEqual(
      expect.objectContaining({ field: 'correct', code })
    )
  })
  it('requires four Kprim statements even without solutions', () => {
    const tables = createElementSpreadsheetExamples()
    tables.Kprim.pop()
    expect(parseElementSpreadsheetTables(tables).issues).toContainEqual(
      expect.objectContaining({
        sheet: 'Kprim',
        field: 'answer',
        code: 'KPRIM_FOUR_ANSWERS',
      })
    )
  })
  it('points at the actual answer row when a value is missing', () => {
    const tables = createElementSpreadsheetExamples()
    tables['Single choice'][1]!.values.answer = ''
    expect(parseElementSpreadsheetTables(tables).issues).toContainEqual(
      expect.objectContaining({
        sheet: 'Single choice',
        row: 9,
        field: 'answer',
      })
    )
  })
  it('rejects question settings on additional answer rows', () => {
    const tables = createElementSpreadsheetExamples()
    tables['Single choice'][1]!.values.content = 'A different question'
    expect(parseElementSpreadsheetTables(tables).issues).toContainEqual(
      expect.objectContaining({
        row: 9,
        field: 'content',
        code: 'FIRST_ROW_ONLY',
      })
    )
  })
  it('reports duplicate references across type tabs', () => {
    const tables = createElementSpreadsheetExamples()
    tables.Content[0]!.values.ref = tables.Flashcards[0]!.values.ref!
    expect(
      parseElementSpreadsheetTables(tables).issues.filter(
        (issue) => issue.code === 'DUPLICATE_REFERENCE'
      )
    ).toHaveLength(2)
  })
  it.each([
    ['pointsMultiplier', 5],
    ['accuracy', -1],
    ['maximum', -10],
  ] as const)('reports the numerical field %s', (field, value) => {
    const tables = createElementSpreadsheetExamples()
    tables.Numerical[0]!.values[field] = value
    const result = parseElementSpreadsheetTables(tables)
    expect(result.issues[0]?.field).toBe(
      field === 'maximum' ? 'solution' : field
    )
  })
  it('supports ordered numerical ranges and rejects mixed modes', () => {
    const tables = createElementSpreadsheetExamples()
    Object.assign(tables.Numerical[0]!.values, {
      solutionMode: 'RANGE',
      solution: null,
      solutionMinimum: 59,
      solutionMaximum: 61,
    })
    expect(parseElementSpreadsheetTables(tables).issues).toEqual([])
    tables.Numerical[0]!.values.solution = 60
    expect(parseElementSpreadsheetTables(tables).issues[0]?.code).toBe(
      'AMBIGUOUS_SOLUTION'
    )
  })
  it('checks free-text answer lengths', () => {
    const tables = createElementSpreadsheetExamples()
    tables['Free text'][0]!.values.maxLength = 2
    expect(parseElementSpreadsheetTables(tables).issues).toContainEqual(
      expect.objectContaining({ sheet: 'Free text', field: 'solution' })
    )
  })
  it('requires the flashcard back while allowing explanations on other types', () => {
    const tables = createElementSpreadsheetExamples()
    tables.Content[0]!.values.explanation = 'Additional context'
    tables.Flashcards[0]!.values.explanation = ''
    const result = parseElementSpreadsheetTables(tables)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ sheet: 'Flashcards', field: 'explanation' })
    )
    expect(
      result.elements.find((element) => element.type === 'CONTENT')?.explanation
    ).toBe('Additional context')
  })
  it('rejects formulas even with a cached result and keeps other types importable', async () => {
    const workbook = await loadElementWorkbook(
      await writeKlickerWorkbook(createElementSpreadsheetExamples())
    )
    workbook.getWorksheet('Content')!.getCell('C8').value = {
      formula: '1+1',
      result: 2,
    }
    const read = readKlickerWorkbook(workbook)
    const result = parseElementSpreadsheetTables(read.tables, read.issues)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        sheet: 'Content',
        field: 'content',
        code: 'UNSUPPORTED_CELL',
      })
    )
    expect(result.elements).toHaveLength(6)
  })
  it('preserves literal formula-like text and image URLs', async () => {
    const tables = emptyElementSpreadsheetTables()
    tables.Content.push({
      sheet: 'Content',
      row: 8,
      values: {
        ref: 'literal',
        name: 'Literal',
        content:
          '=not an Excel formula ![Image](https://synthetic.blob.core.windows.net/owner/file.png)',
      },
    })
    const workbook = await loadElementWorkbook(
      await writeKlickerWorkbook(tables)
    )
    expect(
      readKlickerWorkbook(workbook).tables.Content[0]!.values.content
    ).toBe(tables.Content[0]!.values.content)
  })
})
