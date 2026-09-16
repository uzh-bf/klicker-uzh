import {
  type ElementSpreadsheetTable,
  emptyElementSpreadsheetTables,
  type SpreadsheetValue,
} from './elementSpreadsheetTables.js'

/** Editable teaching examples, used only for the template download. */
export function createElementSpreadsheetExamples() {
  const tables = emptyElementSpreadsheetTables()
  const add = (
    sheet: ElementSpreadsheetTable,
    values: Record<string, SpreadsheetValue>
  ) => {
    tables[sheet].push({ sheet, row: tables[sheet].length + 8, values })
  }
  const element = (
    ref: string,
    type: string,
    name: string,
    content: string,
    settings: Record<string, SpreadsheetValue> = {}
  ) =>
    add('Elements', {
      ref,
      type,
      name: `Example — ${name}`,
      content,
      ...settings,
    })
  element(
    'example-sc',
    'SC',
    'Single choice',
    'What is the capital of Switzerland?',
    { hasSampleSolution: true }
  )
  element(
    'example-mc',
    'MC',
    'Multiple choice',
    'Which of these numbers are even?',
    { hasSampleSolution: true }
  )
  element(
    'example-kprim',
    'KPRIM',
    'Kprim',
    'Decide whether each statement is true or false.',
    { hasSampleSolution: true }
  )
  for (const [ref, choices] of [
    [
      'example-sc',
      [
        ['Bern', true],
        ['Zurich', false],
      ],
    ],
    [
      'example-mc',
      [
        ['2', true],
        ['4', true],
        ['5', false],
      ],
    ],
    [
      'example-kprim',
      [
        ['A triangle has three sides.', true],
        ['A square has five sides.', false],
        ['Ten is an even number.', true],
        ['One hour has 100 minutes.', false],
      ],
    ],
  ] as const) {
    for (const [order, [value, correct]] of choices.entries()) {
      add('Choices', { elementRef: ref, order, value, correct })
    }
  }
  element(
    'example-number',
    'NUMERICAL',
    'Numerical',
    'How many minutes are in one hour?',
    { hasSampleSolution: true, unit: 'minutes', accuracy: 0 }
  )
  add('Solutions', { elementRef: 'example-number', order: 0, value: 60 })
  element(
    'example-text',
    'FREE_TEXT',
    'Free text',
    'What is the largest planet in our solar system?',
    { hasSampleSolution: true }
  )
  add('Solutions', { elementRef: 'example-text', order: 0, value: 'Jupiter' })
  element(
    'example-content',
    'CONTENT',
    'Content',
    'Water can exist as a solid, a liquid or a gas.'
  )
  element(
    'example-card',
    'FLASHCARD',
    'Flashcard',
    'What does photosynthesis mean?',
    {
      explanation:
        'Plants use light energy to turn water and carbon dioxide into sugars, releasing oxygen.',
    }
  )
  add('Collections', {
    ref: 'example-countries',
    name: 'Example — Countries',
    description: 'Answer list for the selection example.',
  })
  add('Entries', {
    collectionRef: 'example-countries',
    ref: 'example-ch',
    value: 'Switzerland',
  })
  add('Entries', {
    collectionRef: 'example-countries',
    ref: 'example-fr',
    value: 'France',
  })
  element(
    'example-selection',
    'SELECTION',
    'Selection',
    'Which country has Bern as its capital?',
    {
      hasSampleSolution: true,
      numberOfInputs: 1,
      answerCollectionRef: 'example-countries',
    }
  )
  add('SelectedItems', {
    elementRef: 'example-selection',
    entryRef: 'example-ch',
  })
  add('Collections', {
    ref: 'example-transport',
    name: 'Example — Transport',
    description: 'Items to rate in the case study.',
  })
  add('Entries', {
    collectionRef: 'example-transport',
    ref: 'example-bike',
    value: 'Bicycle',
  })
  add('Entries', {
    collectionRef: 'example-transport',
    ref: 'example-car',
    value: 'Car',
  })
  element(
    'example-case',
    'CASE_STUDY',
    'Case study',
    'Rate how suitable each transport option is for the trip.',
    { hasSampleSolution: true, answerCollectionRef: 'example-transport' }
  )
  add('SelectedItems', { elementRef: 'example-case', entryRef: 'example-bike' })
  add('SelectedItems', { elementRef: 'example-case', entryRef: 'example-car' })
  add('Criteria', {
    elementRef: 'example-case',
    ref: 'example-suitability',
    order: 0,
    name: 'Suitability',
    minimum: 1,
    maximum: 5,
    step: 1,
    labelMin: 'Poor fit',
    labelMax: 'Good fit',
  })
  add('Cases', {
    elementRef: 'example-case',
    ref: 'example-short-trip',
    order: 0,
    title: 'A short city trip',
    description:
      'Travel one kilometre on a dry day, with no luggage and a safe cycle route.',
  })
  for (const [entryRef, minimum, maximum] of [
    ['example-bike', 4, 5],
    ['example-car', 1, 2],
  ] as const) {
    add('CaseSolutions', {
      elementRef: 'example-case',
      caseRef: 'example-short-trip',
      entryRef,
      criterionRef: 'example-suitability',
      minimum,
      maximum,
    })
  }
  return tables
}
