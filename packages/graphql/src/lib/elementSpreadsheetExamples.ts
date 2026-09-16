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
  for (const [sheet, ref, content, answers] of [
    [
      'Single choice',
      'example-sc',
      'Which city is the federal capital of Switzerland?',
      [
        ['Bern', true],
        ['Zurich', false],
      ],
    ],
    [
      'Multiple choice',
      'example-mc',
      'Which numbers are even?',
      [
        ['2', true],
        ['4', true],
        ['5', false],
      ],
    ],
    [
      'Kprim',
      'example-kprim',
      'Decide whether each statement is true or false.',
      [
        ['A triangle has three sides.', true],
        ['A square has five sides.', false],
        ['Ten is even.', true],
        ['One hour has 100 minutes.', false],
      ],
    ],
  ] as const) {
    answers.forEach(
      ([answer, correct]: readonly [string, boolean], index: number) => {
        add(sheet, {
          ref,
          ...(index === 0
            ? {
                name: `Example — ${sheet}`,
                content,
                hasSampleSolution: true,
                hasAnswerFeedbacks: false,
                displayMode: 'LIST',
                basePoints: true,
                pointsMultiplier: 1,
              }
            : {}),
          answer,
          correct,
        })
      }
    )
  }
  add('Numerical', {
    ref: 'example-number',
    name: 'Example — Numerical',
    content: 'How many minutes are in an hour?',
    unit: 'minutes',
    accuracy: 0,
    hasSampleSolution: true,
    solutionMode: 'EXACT',
    solution: 60,
    basePoints: true,
    pointsMultiplier: 1,
  })
  add('Free text', {
    ref: 'example-text',
    name: 'Example — Free text',
    content: 'What is the largest planet in our solar system?',
    hasSampleSolution: true,
    solution: 'Jupiter',
    basePoints: true,
    pointsMultiplier: 1,
  })
  add('Content', {
    ref: 'example-content',
    name: 'Example — Content',
    content: 'Water can exist as a solid, a liquid or a gas.',
  })
  add('Flashcards', {
    ref: 'example-card',
    name: 'Example — Flashcard',
    content: 'What is photosynthesis?',
    explanation:
      'Plants use light energy to turn water and carbon dioxide into sugars, releasing oxygen.',
  })
  return tables
}
