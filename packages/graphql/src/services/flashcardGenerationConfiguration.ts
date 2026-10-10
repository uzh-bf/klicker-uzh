import { createHash } from 'node:crypto'
import type {
  FlashcardGenerationConfiguration,
  FlashcardGenerationLanguage,
} from '@klicker-uzh/types'

const MAX_FLASHCARDS = 20
const MAX_OBJECTIVES = 20
const MAX_OBJECTIVE_LENGTH = 500

export type FlashcardGenerationConfigurationInput = {
  language: string
  flashcardCount: number
  objectives?: Array<{ text: string }> | null
}

export type FlashcardGenerationGraphConfigurationSource = {
  language?: string | null
}

export class FlashcardGenerationConfigurationError extends Error {
  readonly code = 'CONFIGURATION_INVALID'

  constructor(message: string) {
    super(message)
    this.name = 'FlashcardGenerationConfigurationError'
  }
}

function configurationError(message: string): never {
  throw new FlashcardGenerationConfigurationError(message)
}

function isLanguage(value: string): value is FlashcardGenerationLanguage {
  return value === 'de' || value === 'en'
}

export function normalizeFlashcardGenerationConfiguration(
  input: FlashcardGenerationConfigurationInput,
  graphVersion: FlashcardGenerationGraphConfigurationSource
): {
  configuration: FlashcardGenerationConfiguration
  configurationHash: string
} {
  if (!isLanguage(input.language)) {
    return configurationError('Language is not supported')
  }
  if (
    graphVersion.language !== null &&
    graphVersion.language !== undefined &&
    input.language !== graphVersion.language
  ) {
    return configurationError(
      'Language must match the selected knowledge graph version'
    )
  }
  if (
    !Number.isInteger(input.flashcardCount) ||
    input.flashcardCount < 1 ||
    input.flashcardCount > MAX_FLASHCARDS
  ) {
    return configurationError(
      `Flashcard count must be an integer from 1-${MAX_FLASHCARDS}`
    )
  }

  const values = input.objectives ?? []
  if (values.length > MAX_OBJECTIVES) {
    return configurationError(
      `At most ${MAX_OBJECTIVES} objectives are allowed`
    )
  }
  const objectives = values.map((objective, index) => {
    const text = objective.text.trim()
    if (!text || text.length > MAX_OBJECTIVE_LENGTH || /\p{C}/u.test(text)) {
      return configurationError(
        `Objective ${index + 1} must contain 1-${MAX_OBJECTIVE_LENGTH} characters`
      )
    }
    return {
      id: `OBJ-${String(index + 1).padStart(2, '0')}`,
      text,
    }
  })
  const configuration: FlashcardGenerationConfiguration = {
    language: input.language,
    flashcardCount: input.flashcardCount,
    objectives,
  }

  return {
    configuration,
    configurationHash: createHash('sha256')
      .update(JSON.stringify(configuration))
      .digest('hex'),
  }
}
