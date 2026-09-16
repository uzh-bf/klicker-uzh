import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { parseElementSpreadsheetTables } from '../src/lib/elementSpreadsheetDomain.js'
import { createElementSpreadsheetExamples } from '../src/lib/elementSpreadsheetExamples.js'
import {
  ELEMENT_SPREADSHEET_ANSWER_SLOTS,
  ELEMENT_SPREADSHEET_SOLUTION_SLOTS,
  ELEMENT_SPREADSHEET_TABLES,
  emptyElementSpreadsheetTables,
} from '../src/lib/elementSpreadsheetTables.js'
import {
  loadElementWorkbook,
  readKlickerWorkbook,
  writeKlickerWorkbook,
} from '../src/lib/elementSpreadsheetWorkbook.js'

describe('one-row element import workbooks', () => {
  it('round-trips one editable example for all seven Excel types', async () => {
    const tables = createElementSpreadsheetExamples()
    const workbook = await loadElementWorkbook(
      await writeKlickerWorkbook(tables)
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
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: 'excel-sc-8',
          sheet: 'Single choice',
          row: 8,
        }),
        expect.objectContaining({
          ref: 'excel-kprim-8',
          sheet: 'Kprim',
          row: 8,
        }),
      ])
    )
    expect(result.answerCollections).toEqual([])
  })

  it.each([
    'klicker-elements-1',
    'klicker-elements-3',
    'kahoot',
  ])('rejects unsupported template %s', (version) => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('Instructions').getCell('A1').value = version
    expect(() => readKlickerWorkbook(workbook)).toThrow(
      'UNSUPPORTED_TEMPLATE_VERSION'
    )
  })

  it('uses rows, not authored references, for transport identity after reordering', () => {
    const tables = emptyElementSpreadsheetTables()
    tables.Content.push(
      { sheet: 'Content', row: 11, values: { name: 'Second', content: 'B' } },
      { sheet: 'Content', row: 8, values: { name: 'First', content: 'A' } }
    )
    const parsed = parseElementSpreadsheetTables(tables)
    expect(parsed.issues).toEqual([])
    expect(parsed.sources.map((source) => source.ref)).toEqual([
      'excel-content-11',
      'excel-content-8',
    ])
    expect(parsed.elements.map((element) => element.content)).toEqual([
      'B',
      'A',
    ])
  })

  it('accepts final SC/MC and solution slots while allowing unused slots', () => {
    const tables = createElementSpreadsheetExamples()
    const sc = tables['Single choice'][0]!.values
    Object.assign(sc, {
      answer2: null,
      correct2: null,
      answer10: 'Last answer',
      correct10: 'No',
    })
    Object.assign(tables.Numerical[0]!.values, {
      solution1: null,
      solution6: 60,
    })
    const result = parseElementSpreadsheetTables(tables)
    expect(result.issues).toEqual([])
    expect(
      result.elements.find((element) => element.type === 'SC')!.options
    ).toEqual(
      expect.objectContaining({
        choices: expect.arrayContaining([expect.anything(), expect.anything()]),
      })
    )
    expect(
      result.elements.find((element) => element.type === 'NUMERICAL')!.options
    ).toEqual(expect.objectContaining({ exactSolutions: [60] }))
    expect(ELEMENT_SPREADSHEET_ANSWER_SLOTS).toBe(10)
    expect(ELEMENT_SPREADSHEET_SOLUTION_SLOTS).toBe(6)
  })

  it.each([
    'Single choice',
    'Multiple choice',
  ] as const)('round-trips all ten answers and their feedback in %s', async (sheet) => {
    const tables = createElementSpreadsheetExamples()
    const values = tables[sheet][0]!.values
    values.hasAnswerFeedbacks = 'Yes'
    for (let slot = 1; slot <= 10; slot++) {
      values[`answer${slot}`] = `Answer ${slot}`
      values[`correct${slot}`] = slot === 1 ? 'Yes' : 'No'
      values[`feedback${slot}`] = `Feedback ${slot}`
    }
    const workbook = await loadElementWorkbook(
      await writeKlickerWorkbook(tables)
    )
    const read = readKlickerWorkbook(workbook)
    const result = parseElementSpreadsheetTables(read.tables, read.issues)
    expect(result.issues).toEqual([])
    expect(
      result.elements.find(
        (element) => element.type === (sheet === 'Single choice' ? 'SC' : 'MC')
      )!.options
    ).toEqual(
      expect.objectContaining({
        choices: Array.from({ length: 10 }, (_, index) => ({
          ix: index,
          value: `Answer ${index + 1}`,
          correct: index === 0,
          feedback: `Feedback ${index + 1}`,
        })),
      })
    )
    expect(workbook.getWorksheet('Kprim')!.getRow(6).values).not.toContain(
      'Statement 5'
    )
  })

  it('preserves numeric-looking choice and free-text wording as text', () => {
    const tables = createElementSpreadsheetExamples()
    tables['Single choice'][0]!.values.answer10 = 8
    tables['Single choice'][0]!.values.correct10 = 'No'
    tables['Free text'][0]!.values.solution6 = 42
    const result = parseElementSpreadsheetTables(tables)
    expect(result.issues).toEqual([])
    expect(
      result.elements.find((element) => element.type === 'SC')!.options
    ).toEqual(
      expect.objectContaining({
        choices: expect.arrayContaining([
          expect.objectContaining({ value: '8' }),
        ]),
      })
    )
    expect(
      result.elements.find((element) => element.type === 'FREE_TEXT')!.options
    ).toEqual(
      expect.objectContaining({ solutions: expect.arrayContaining(['42']) })
    )
  })

  it.each([
    ['Single choice', 'SC_ONE_CORRECT'],
    ['Multiple choice', 'MC_CORRECT_REQUIRED'],
  ] as const)('reports visible labels for invalid %s correctness', (sheet, code) => {
    const tables = createElementSpreadsheetExamples()
    const values = tables[sheet][0]!.values
    for (let slot = 1; slot <= ELEMENT_SPREADSHEET_ANSWER_SLOTS; slot++) {
      values[`answer${slot}`] = null
      values[`correct${slot}`] = null
    }
    values.answer10 = 'Only answer'
    values.correct10 = 'No'
    expect(parseElementSpreadsheetTables(tables).issues).toContainEqual(
      expect.objectContaining({ sheet, field: 'Correct 10?', code })
    )
  })

  it('rejects orphan data with its visible numbered column label', () => {
    const tables = createElementSpreadsheetExamples()
    tables['Single choice'][0]!.values.feedback10 = 'Orphan feedback'
    expect(parseElementSpreadsheetTables(tables).issues).toContainEqual(
      expect.objectContaining({ field: 'Answer 10', code: 'REQUIRED_VALUE' })
    )
  })

  it('requires four Kprim statements', () => {
    const tables = createElementSpreadsheetExamples()
    tables.Kprim[0]!.values.answer4 = null
    expect(parseElementSpreadsheetTables(tables).issues).toContainEqual(
      expect.objectContaining({
        field: 'Statement 4',
        code: 'KPRIM_FOUR_ANSWERS',
      })
    )
  })

  it('reports the numbered upper bound for an invalid sixth numerical range', () => {
    const tables = createElementSpreadsheetExamples()
    Object.assign(tables.Numerical[0]!.values, {
      solutionMode: 'RANGE',
      solution1: null,
      solutionMinimum6: 61,
      solutionMaximum6: 59,
    })
    expect(parseElementSpreadsheetTables(tables).issues).toContainEqual(
      expect.objectContaining({
        sheet: 'Numerical',
        field: 'Range maximum 6',
        code: 'INVALID_VALUE',
      })
    )
  })

  it('rejects copied formula cells while retaining unrelated rows', async () => {
    const workbook = await loadElementWorkbook(
      await writeKlickerWorkbook(createElementSpreadsheetExamples())
    )
    workbook.getWorksheet('Content')!.getCell('B8').value = {
      formula: '1+1',
      result: 2,
    }
    const read = readKlickerWorkbook(workbook)
    const result = parseElementSpreadsheetTables(read.tables, read.issues)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        sheet: 'Content',
        field: 'Content',
        code: 'UNSUPPORTED_CELL',
      })
    )
    expect(result.elements).toHaveLength(6)
  })
})
