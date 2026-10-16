import { createFlashcardGenerationBlueprint } from '../src/services/flashcardGenerationBlueprint.js'
import {
  FlashcardGenerationConfigurationError,
  normalizeFlashcardGenerationConfiguration,
} from '../src/services/flashcardGenerationConfiguration.js'

const GRAPH = { language: 'de' }

describe('flashcard generation configuration', () => {
  it('normalizes the separate flashcard build contract deterministically', () => {
    const normalized = normalizeFlashcardGenerationConfiguration(
      {
        language: 'de',
        flashcardCount: 6,
        objectives: [
          { text: '  Liquidität erklären.  ' },
          { text: 'Liquiditätskennzahlen anwenden.' },
        ],
      },
      GRAPH
    )
    const repeated = normalizeFlashcardGenerationConfiguration(
      {
        language: 'de',
        flashcardCount: 6,
        objectives: [
          { text: 'Liquidität erklären.' },
          { text: 'Liquiditätskennzahlen anwenden.' },
        ],
      },
      GRAPH
    )

    expect(normalized.configuration).toEqual({
      language: 'de',
      flashcardCount: 6,
      objectives: [
        { id: 'OBJ-01', text: 'Liquidität erklären.' },
        { id: 'OBJ-02', text: 'Liquiditätskennzahlen anwenden.' },
      ],
    })
    expect(normalized.configurationHash).toBe(repeated.configurationHash)
  })

  it.each([
    [{ language: 'en', flashcardCount: 6 }, /language/i],
    [{ language: 'de', flashcardCount: 0 }, /1-20/],
    [{ language: 'de', flashcardCount: 21 }, /1-20/],
    [
      {
        language: 'de',
        flashcardCount: 6,
        objectives: [{ text: '   ' }],
      },
      /objective/i,
    ],
    [
      {
        language: 'de',
        flashcardCount: 6,
        objectives: [{ text: 'Line one\nLine two' }],
      },
      /objective/i,
    ],
  ])('rejects invalid build input %#', (input, message) => {
    expect(() =>
      normalizeFlashcardGenerationConfiguration(input, GRAPH)
    ).toThrow(FlashcardGenerationConfigurationError)
    expect(() =>
      normalizeFlashcardGenerationConfiguration(input, GRAPH)
    ).toThrow(message)
  })
})

describe('flashcard generation blueprint', () => {
  it('emits the worker JSON-v3 module and objective contract', () => {
    const { configuration } = normalizeFlashcardGenerationConfiguration(
      {
        language: 'de',
        flashcardCount: 3,
        objectives: [
          { text: 'Liquidität erklären.' },
          { text: 'Kennzahlen anwenden.' },
        ],
      },
      GRAPH
    )

    const blueprint = JSON.parse(
      createFlashcardGenerationBlueprint(configuration).toString('utf8')
    )

    expect(blueprint).toEqual({
      assignment_seed: 0,
      slot_objective_overrides: [],
      modules: [
        {
          module_id: 'M1',
          module_name: 'All material',
          flashcard_count: 3,
        },
      ],
      objectives: [
        {
          module_id: 'M1',
          objective_id: 'OBJ-01',
          objective_text: 'Liquidität erklären.',
        },
        {
          module_id: 'M1',
          objective_id: 'OBJ-02',
          objective_text: 'Kennzahlen anwenden.',
        },
      ],
    })
  })
})
