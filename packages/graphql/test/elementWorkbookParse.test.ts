import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import {
  ELEMENT_WORKBOOK_DATA_ROW,
  ELEMENT_WORKBOOK_HEADERS,
  type MultipleChoiceOptions,
  parseElementWorkbook,
} from '../src/scripts/elementWorkbook/parse.js'

async function workbookBuffer(populate?: (workbook: ExcelJS.Workbook) => void) {
  const workbook = new ExcelJS.Workbook()
  workbook.addWorksheet('Instructions').getCell('A1').value =
    'Klicker Excel template'
  for (const [name, headers] of Object.entries(ELEMENT_WORKBOOK_HEADERS)) {
    const sheet = workbook.addWorksheet(name)
    headers.forEach((header, index) => {
      sheet.getCell(6, index + 1).value = header
    })
  }
  populate?.(workbook)
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

function setRow(
  workbook: ExcelJS.Workbook,
  sheetName: keyof typeof ELEMENT_WORKBOOK_HEADERS,
  values: Record<string, ExcelJS.CellValue>,
  row = ELEMENT_WORKBOOK_DATA_ROW
) {
  const sheet = workbook.getWorksheet(sheetName)!
  const headers = ELEMENT_WORKBOOK_HEADERS[sheetName]
  for (const [header, value] of Object.entries(values)) {
    const column = headers.indexOf(header as never) + 1
    if (!column) throw new Error(`Unknown fixture header: ${header}`)
    sheet.getCell(row, column).value = value
  }
}

function multipleChoiceRow(overrides: Record<string, ExcelJS.CellValue> = {}) {
  return {
    Name: 'MC name',
    Question: 'Which values are true?',
    'Sample solution?': 'Yes',
    'Answer 1': 'Yes',
    'Correct 1?': 'Yes',
    'Answer 2': 'No',
    'Correct 2?': 'No',
    ...overrides,
  }
}

describe('parseElementWorkbook', () => {
  it('rejects required fields that only contain rendered line breaks', async () => {
    for (const [sheet, values] of [
      ['Content', { Name: 'Content', Content: '<br> <BR />' }],
      ['Flashcards', { Name: 'Card', Front: 'Front', Back: '<br />' }],
      ['Multiple choice', multipleChoiceRow({ 'Answer 1': '<br>' })],
      [
        'Multiple choice',
        multipleChoiceRow({
          'Answer feedback?': 'Yes',
          'Feedback 1': '<br>',
          'Feedback 2': '-',
        }),
      ],
      [
        'Free text',
        {
          Name: 'Text',
          Question: 'Question',
          'Sample solution?': 'Yes',
          'Accepted answer 1': '<br>',
        },
      ],
    ] as const) {
      const buffer = await workbookBuffer((workbook) =>
        setRow(workbook, sheet, values)
      )
      await expect(parseElementWorkbook(buffer)).rejects.toThrow(
        'REQUIRED_VALUE'
      )
    }
  })

  it('parses multiple choice and flashcards while preserving placeholders and tag CSV', async () => {
    const buffer = await workbookBuffer((workbook) => {
      setRow(
        workbook,
        'Multiple choice',
        multipleChoiceRow({
          Explanation: 'Because [Bildplatzhalter: chart.png] is literal.',
          'Participation points': 'No',
          'Points multiplier': 3,
          'Answer layout': 'GRID',
          Tags: ' course ; "Teaching; learning"; "A ""quoted"" tag";course',
        })
      )
      setRow(workbook, 'Flashcards', {
        Name: 'Card',
        Front: 'Front [Bildplatzhalter: front.png]',
        Back: 'Back [Bildplatzhalter: back.png]',
        Tags: 'flashcards; course',
      })
    })

    await expect(parseElementWorkbook(buffer)).resolves.toEqual([
      expect.objectContaining({
        sheet: 'Multiple choice',
        row: 8,
        type: 'MC',
        explanation: 'Because [Bildplatzhalter: chart.png] is literal.',
        basePoints: false,
        pointsMultiplier: 3,
        tags: ['course', 'Teaching; learning', 'A "quoted" tag'],
        options: {
          hasSampleSolution: true,
          hasAnswerFeedbacks: false,
          displayMode: 'GRID',
          choices: [
            { ix: 0, value: 'Yes', correct: true },
            { ix: 1, value: 'No', correct: false },
          ],
        },
      }),
      {
        sheet: 'Flashcards',
        row: 8,
        name: 'Card',
        content: 'Front [Bildplatzhalter: front.png]',
        explanation: 'Back [Bildplatzhalter: back.png]',
        type: 'FLASHCARD',
        basePoints: false,
        pointsMultiplier: 1,
        options: {},
        tags: ['flashcards', 'course'],
      },
    ])
  })

  it.each([
    null,
    'klicker-elements-6',
    'klicker-elements-5',
    'My teaching material',
  ])('ignores the Instructions marker %s when the data layout is valid', async (marker) => {
    const buffer = await workbookBuffer((workbook) => {
      workbook.getWorksheet('Instructions')!.getCell('A1').value = marker
      setRow(workbook, 'Flashcards', {
        Name: 'Card',
        Front: 'Front',
        Back: 'Back',
      })
    })
    await expect(parseElementWorkbook(buffer)).resolves.toEqual([
      expect.objectContaining({
        type: 'FLASHCARD',
        content: 'Front',
        explanation: 'Back',
      }),
    ])
  })

  it('accepts the data tabs without an Instructions sheet', async () => {
    const buffer = await workbookBuffer((workbook) => {
      workbook.removeWorksheet(workbook.getWorksheet('Instructions')!.id)
      setRow(workbook, 'Multiple choice', multipleChoiceRow())
    })
    await expect(parseElementWorkbook(buffer)).resolves.toHaveLength(1)
  })

  it('requires the visible headers and rejects unknown columns', async () => {
    const wrongHeader = await workbookBuffer((workbook) => {
      workbook.getWorksheet('Multiple choice')!.getCell('A6').value = 'Title'
    })
    await expect(parseElementWorkbook(wrongHeader)).rejects.toThrow(
      'INVALID_HEADERS at Multiple choice!A6'
    )

    const unknownColumn = await workbookBuffer((workbook) => {
      workbook.getWorksheet('Flashcards')!.getCell('E6').value = 'Extra'
    })
    await expect(parseElementWorkbook(unknownColumn)).rejects.toThrow(
      'UNEXPECTED_COLUMN at Flashcards!E6'
    )
  })

  it('parses every template element type', async () => {
    const buffer = await workbookBuffer((workbook) => {
      setRow(workbook, 'Single choice', {
        Name: 'SC',
        Question: 'Question',
        'Sample solution?': 'Yes',
        'Answer 1': 'Correct',
        'Correct 1?': 'Yes',
      })
      setRow(workbook, 'Multiple choice', multipleChoiceRow())
      setRow(workbook, 'Kprim', {
        Name: 'Kprim',
        Question: 'Question',
        'Sample solution?': 'Yes',
        'Statement 1': 'One',
        'Statement 1 true?': 'No',
        'Statement 2': 'Two',
        'Statement 2 true?': 'No',
        'Statement 3': 'Three',
        'Statement 3 true?': 'No',
        'Statement 4': 'Four',
        'Statement 4 true?': 'No',
      })
      setRow(workbook, 'Numerical', {
        Name: 'Numerical',
        Question: 'Question',
        'Sample solution?': 'Yes',
        'Solution type': 'EXACT',
        'Accepted answer 1': 42,
        'Minimum allowed': 0,
        'Maximum allowed': 100,
        'Decimal places': 0,
      })
      setRow(workbook, 'Free text', {
        Name: 'Free text',
        Question: 'Question',
        'Sample solution?': 'Yes',
        'Accepted answer 1': 'Answer',
        'Maximum answer length': 12,
      })
      setRow(workbook, 'Content', { Name: 'Content', Content: 'Content' })
      setRow(workbook, 'Flashcards', {
        Name: 'Flashcard',
        Front: 'Front',
        Back: 'Back',
      })
    })
    await expect(parseElementWorkbook(buffer)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'SC' }),
        expect.objectContaining({ type: 'MC' }),
        expect.objectContaining({ type: 'KPRIM' }),
        expect.objectContaining({ type: 'NUMERICAL' }),
        expect.objectContaining({ type: 'FREE_TEXT' }),
        expect.objectContaining({ type: 'CONTENT', basePoints: false }),
        expect.objectContaining({ type: 'FLASHCARD', basePoints: false }),
      ])
    )
  })

  it('rejects invalid template element rules and unknown sheets', async () => {
    const invalidSingleChoice = await workbookBuffer((workbook) => {
      setRow(workbook, 'Single choice', {
        Name: 'SC',
        Question: 'Question',
        'Sample solution?': 'Yes',
        'Answer 1': 'One',
        'Correct 1?': 'Yes',
        'Answer 2': 'Two',
        'Correct 2?': 'Yes',
      })
    })
    await expect(parseElementWorkbook(invalidSingleChoice)).rejects.toThrow(
      'SC_ONE_CORRECT'
    )

    const missingKprim = await workbookBuffer((workbook) => {
      setRow(workbook, 'Kprim', { Name: 'Kprim', Question: 'Question' })
    })
    await expect(parseElementWorkbook(missingKprim)).rejects.toThrow(
      'KPRIM_FOUR_ANSWERS'
    )

    const ambiguousNumerical = await workbookBuffer((workbook) => {
      setRow(workbook, 'Numerical', {
        Name: 'Numerical',
        Question: 'Question',
        'Sample solution?': 'Yes',
        'Solution type': 'EXACT',
        'Accepted answer 1': 1,
        'Range minimum 1': 0,
      })
    })
    await expect(parseElementWorkbook(ambiguousNumerical)).rejects.toThrow(
      'AMBIGUOUS_SOLUTION'
    )

    const disabledFreeText = await workbookBuffer((workbook) => {
      setRow(workbook, 'Free text', {
        Name: 'Free text',
        Question: 'Question',
        'Accepted answer 1': 'Answer',
      })
    })
    await expect(parseElementWorkbook(disabledFreeText)).rejects.toThrow(
      'DISABLED_SOLUTION_DATA'
    )

    const invalidBounds = await workbookBuffer((workbook) => {
      setRow(workbook, 'Numerical', {
        Name: 'Numerical',
        Question: 'Question',
        'Minimum allowed': 2,
        'Maximum allowed': 1,
      })
    })
    await expect(parseElementWorkbook(invalidBounds)).rejects.toThrow(
      'INVALID_VALUE'
    )

    const invalidAccuracy = await workbookBuffer((workbook) => {
      setRow(workbook, 'Numerical', {
        Name: 'Numerical',
        Question: 'Question',
        'Decimal places': 101,
      })
    })
    await expect(parseElementWorkbook(invalidAccuracy)).rejects.toThrow(
      'INVALID_NUMBER'
    )

    const invalidMaxLength = await workbookBuffer((workbook) => {
      setRow(workbook, 'Free text', {
        Name: 'Free text',
        Question: 'Question',
        'Maximum answer length': 0,
      })
    })
    await expect(parseElementWorkbook(invalidMaxLength)).rejects.toThrow(
      'INVALID_NUMBER'
    )

    const unknownSheet = await workbookBuffer((workbook) => {
      workbook.addWorksheet('Surprise')
    })
    await expect(parseElementWorkbook(unknownSheet)).rejects.toThrow(
      'UNEXPECTED_WORKSHEET'
    )
  })

  it('uses canonical no-sample defaults for numerical and free-text rows', async () => {
    const buffer = await workbookBuffer((workbook) => {
      setRow(workbook, 'Numerical', { Name: 'Numerical', Question: 'Question' })
      setRow(workbook, 'Free text', { Name: 'Free text', Question: 'Question' })
    })
    await expect(parseElementWorkbook(buffer)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'NUMERICAL',
          basePoints: true,
          pointsMultiplier: 1,
          options: {
            hasSampleSolution: false,
            unit: '',
            placeholder: '',
            restrictions: {},
          },
        }),
        expect.objectContaining({
          type: 'FREE_TEXT',
          basePoints: true,
          pointsMultiplier: 1,
          options: {
            hasSampleSolution: false,
            restrictions: {},
          },
        }),
      ])
    )
  })

  it('rejects unsafe cells and validates choice dependencies', async () => {
    const formula = await workbookBuffer((workbook) => {
      setRow(
        workbook,
        'Multiple choice',
        multipleChoiceRow({
          Question: { formula: '1+1', result: 2 },
        })
      )
    })
    await expect(parseElementWorkbook(formula)).rejects.toThrow(
      'UNSUPPORTED_CELL at Multiple choice!B8'
    )

    const missingCorrectness = await workbookBuffer((workbook) => {
      setRow(
        workbook,
        'Multiple choice',
        multipleChoiceRow({ 'Correct 2?': '' })
      )
    })
    await expect(parseElementWorkbook(missingCorrectness)).rejects.toThrow(
      'REQUIRED_VALUE at Multiple choice!G8'
    )

    const missingFeedback = await workbookBuffer((workbook) => {
      setRow(
        workbook,
        'Multiple choice',
        multipleChoiceRow({ 'Answer feedback?': 'Yes' })
      )
    })
    await expect(parseElementWorkbook(missingFeedback)).rejects.toThrow(
      'REQUIRED_VALUE at Multiple choice!AC8'
    )

    const multilineTags = await workbookBuffer((workbook) => {
      setRow(workbook, 'Flashcards', {
        Name: 'Card',
        Front: 'Front',
        Back: 'Back',
        Tags: 'first\nsecond',
      })
    })
    await expect(parseElementWorkbook(multilineTags)).rejects.toThrow(
      'INVALID_TAGS at Flashcards!D8'
    )

    const image = await workbookBuffer((workbook) => {
      const imageId = workbook.addImage({
        base64:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9aQAAAABJRU5ErkJggg==',
        extension: 'png',
      })
      workbook.getWorksheet('Flashcards')!.addImage(imageId, 'A1:A1')
    })
    await expect(parseElementWorkbook(image)).rejects.toThrow(
      'UNSUPPORTED_WORKBOOK_CONTENT'
    )
  })

  it('keeps the tenth choice and its feedback', async () => {
    const buffer = await workbookBuffer((workbook) => {
      const answers = Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => [
          `Answer ${index + 1}`,
          `Answer ${index + 1}`,
        ])
      )
      const correctness = Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => [
          `Correct ${index + 1}?`,
          index === 9 ? 'Yes' : 'No',
        ])
      )
      const feedback = Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => [`Feedback ${index + 1}`, '-'])
      )
      setRow(workbook, 'Multiple choice', {
        ...multipleChoiceRow({
          'Answer feedback?': 'Yes',
          'Answer 2': '',
          'Correct 2?': '',
        }),
        ...answers,
        ...correctness,
        ...feedback,
      })
    })

    const [firstElement] = await parseElementWorkbook(buffer)
    if (!firstElement) throw new Error('Expected the synthetic MC row to parse')
    const element = firstElement
    expect(element.type).toBe('MC')
    const options = element.options as MultipleChoiceOptions
    expect(options.choices).toHaveLength(10)
    expect(options.choices[9]).toEqual({
      ix: 9,
      value: 'Answer 10',
      correct: true,
      feedback: '-',
    })
  })

  it('accepts gapped choice slots and compacts their indexes', async () => {
    const buffer = await workbookBuffer((workbook) => {
      setRow(
        workbook,
        'Multiple choice',
        multipleChoiceRow({
          'Answer 2': '',
          'Correct 2?': '',
          'Answer 3': 'Third slot',
          'Correct 3?': 'No',
        })
      )
    })
    const [element] = await parseElementWorkbook(buffer)
    expect(element).toMatchObject({
      type: 'MC',
      options: {
        choices: [
          { ix: 0, value: 'Yes', correct: true },
          { ix: 1, value: 'Third slot', correct: false },
        ],
      },
    })
  })

  it('enforces the 500-element bound without a fixture file', async () => {
    const allowed = await workbookBuffer((workbook) => {
      for (let index = 0; index < 500; index++) {
        setRow(
          workbook,
          'Flashcards',
          { Name: `Card ${index}`, Front: 'Front', Back: 'Back' },
          index + 8
        )
      }
    })
    await expect(parseElementWorkbook(allowed)).resolves.toHaveLength(500)

    const rejected = await workbookBuffer((workbook) => {
      for (let index = 0; index < 501; index++) {
        setRow(
          workbook,
          'Flashcards',
          { Name: `Card ${index}`, Front: 'Front', Back: 'Back' },
          index + 8
        )
      }
    })
    await expect(parseElementWorkbook(rejected)).rejects.toThrow(
      'WORKBOOK_TOO_LARGE'
    )

    await expect(
      parseElementWorkbook(Buffer.alloc(5 * 1024 * 1024 + 1))
    ).rejects.toThrow('WORKBOOK_TOO_LARGE')
  })
})
