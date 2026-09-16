import {
  ELEMENT_SPREADSHEET_DATA_ROW,
  type ElementSpreadsheetTable,
  emptyElementSpreadsheetTables,
  type SpreadsheetValue,
} from './elementSpreadsheetTables.js'
/** One complete, editable example per supported type. */
export function createElementSpreadsheetExamples() {
  const tables = emptyElementSpreadsheetTables()
  const add = (
    sheet: ElementSpreadsheetTable,
    values: Record<string, SpreadsheetValue>
  ) => {
    tables[sheet].push({
      sheet,
      row: ELEMENT_SPREADSHEET_DATA_ROW + tables[sheet].length,
      values,
    })
  }
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
    const values: Record<string, SpreadsheetValue> = {
      name: `Example — ${sheet}`,
      content,
      hasSampleSolution: 'Yes',
      hasAnswerFeedbacks: 'No',
      displayMode: 'LIST',
      basePoints: 'Yes',
      pointsMultiplier: 1,
    }
    answers.forEach(
      ([answer, correct]: readonly [string, boolean], index: number) => {
        values[`answer${index + 1}`] = answer
        values[`correct${index + 1}`] = correct ? 'Yes' : 'No'
      }
    )
    add(sheet, values)
  }
  add('Numerical', {
    name: 'Example — Numerical',
    content: 'How many minutes are in an hour?',
    unit: 'minutes',
    accuracy: 0,
    hasSampleSolution: 'Yes',
    solutionMode: 'EXACT',
    solution1: 60,
    basePoints: 'Yes',
    pointsMultiplier: 1,
  })
  add('Free text', {
    name: 'Example — Free text',
    content: 'What is the largest planet in our solar system?',
    hasSampleSolution: 'Yes',
    solution1: 'Jupiter',
    basePoints: 'Yes',
    pointsMultiplier: 1,
  })
  add('Content', {
    name: 'Example — Content',
    content: 'Water can exist as a solid, a liquid or a gas.',
  })
  add('Flashcards', {
    name: 'Example — Flashcard',
    content: 'What is photosynthesis?',
    explanation:
      'Plants use light energy to turn water and carbon dioxide into sugars, releasing oxygen.',
  })
  return tables
}
