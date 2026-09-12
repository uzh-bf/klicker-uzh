import { createHash } from 'node:crypto'
import type {
  KBGraphSourceSnapshot,
  QuestionGenerationBloomLevel,
  QuestionGenerationConfiguration,
  QuestionGenerationDifficultyCounts,
  QuestionGenerationDifficultyPreset,
  QuestionGenerationItemType,
  QuestionGenerationLanguage,
} from '@klicker-uzh/types'
import {
  allocateQuestionGenerationDifficulty,
  QUESTION_GENERATION_CAPABILITIES,
} from '@klicker-uzh/types'

const MAX_OBJECTIVES = 20
const MAX_OBJECTIVE_LENGTH = 500

const GERMAN_BLOOM_LABELS: Record<QuestionGenerationBloomLevel, string> = {
  remember: 'Erinnern',
  understand: 'Verstehen',
  apply: 'Anwenden',
  analyze: 'Analysieren',
  evaluate: 'Bewerten',
}

export type QuestionGenerationConfigurationInput = {
  itemType?: string | null
  language: string
  questionCount: number
  difficultyPreset: string
  sourceScopes?: Array<{
    resourceId: string
    pageFrom?: number | null
    pageTo?: number | null
  }> | null
  objectives?: Array<{
    text: string
    bloomLevel?: string | null
  }> | null
  bloomLevels?: string[] | null
}

export type NormalizedQuestionGenerationConfiguration = {
  configuration: QuestionGenerationConfiguration
  configurationHash: string
}

export type QuestionGenerationGraphConfigurationSource = {
  language?: string | null
  sourceSnapshot: KBGraphSourceSnapshot
}

export class QuestionGenerationConfigurationError extends Error {
  readonly code = 'CONFIGURATION_INVALID'

  constructor(message: string) {
    super(message)
    this.name = 'QuestionGenerationConfigurationError'
  }
}

function configurationError(message: string): never {
  throw new QuestionGenerationConfigurationError(message)
}

function isLanguage(value: string): value is QuestionGenerationLanguage {
  return (
    QUESTION_GENERATION_CAPABILITIES.languages as readonly string[]
  ).includes(value)
}

function isItemType(value: string): value is QuestionGenerationItemType {
  return (
    QUESTION_GENERATION_CAPABILITIES.itemTypes as readonly string[]
  ).includes(value)
}

function isBloomLevel(value: string): value is QuestionGenerationBloomLevel {
  return (
    QUESTION_GENERATION_CAPABILITIES.bloomLevels as readonly string[]
  ).includes(value)
}

function isDifficultyPreset(
  value: string
): value is QuestionGenerationDifficultyPreset {
  return ['D1', 'D2', 'D3', 'D4', 'D5', 'EASY', 'MIXED', 'HARD'].includes(value)
}

export function allocateDifficulty(
  count: number,
  preset: QuestionGenerationDifficultyPreset
): QuestionGenerationDifficultyCounts {
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    return configurationError('Question count must be an integer from 1 to 20')
  }
  if (!isDifficultyPreset(preset)) {
    return configurationError('Difficulty preset is not supported')
  }

  return allocateQuestionGenerationDifficulty(count, preset)
}

function normalizeBloomLevels(
  values: string[] | null | undefined
): QuestionGenerationBloomLevel[] {
  const selected = new Set<QuestionGenerationBloomLevel>()
  for (const value of values ?? []) {
    if (!isBloomLevel(value)) {
      return configurationError('Bloom level is not supported')
    }
    selected.add(value)
  }

  return QUESTION_GENERATION_CAPABILITIES.bloomLevels.filter((level) =>
    selected.has(level)
  )
}

function neutralObjective(
  language: QuestionGenerationLanguage,
  bloomLevel: QuestionGenerationBloomLevel
): string {
  if (language === 'de') {
    return `Prüfe das ausgewählte Wissensbasismaterial auf der kognitiven Stufe ${GERMAN_BLOOM_LABELS[bloomLevel]}.`
  }

  return `Assess the selected knowledge-base material at the ${bloomLevel} cognitive level.`
}

function normalizeObjectives(
  values: QuestionGenerationConfigurationInput['objectives'],
  language: QuestionGenerationLanguage,
  bloomLevels: QuestionGenerationBloomLevel[]
): QuestionGenerationConfiguration['objectives'] {
  const objectives = values ?? []
  if (objectives.length > MAX_OBJECTIVES) {
    return configurationError(
      `At most ${MAX_OBJECTIVES} objectives are allowed`
    )
  }

  if (objectives.length === 0) {
    return bloomLevels.map((bloomLevel, index) => ({
      id: `OBJ-${String(index + 1).padStart(2, '0')}`,
      text: neutralObjective(language, bloomLevel),
      bloomLevel,
    }))
  }

  return objectives.map((objective, index) => {
    const text = objective.text.trim()
    if (!text || text.length > MAX_OBJECTIVE_LENGTH) {
      return configurationError(
        `Objective ${index + 1} must contain 1-${MAX_OBJECTIVE_LENGTH} characters`
      )
    }

    const bloomLevel = objective.bloomLevel ?? null
    if (bloomLevel !== null && !isBloomLevel(bloomLevel)) {
      return configurationError(
        `Objective ${index + 1} has an invalid Bloom level`
      )
    }

    return {
      id: `OBJ-${String(index + 1).padStart(2, '0')}`,
      text,
      bloomLevel,
    }
  })
}

function normalizePageBound(
  value: number | null | undefined,
  field: string
): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isInteger(value) || value < 1) {
    return configurationError(`${field} must be a positive integer`)
  }
  return value
}

function normalizeSourceScopes(
  values: QuestionGenerationConfigurationInput['sourceScopes'],
  sourceSnapshot: KBGraphSourceSnapshot
): QuestionGenerationConfiguration['sourceScopes'] {
  if (sourceSnapshot.length === 0) {
    return configurationError('The graph version has no registered sources')
  }

  const requested = values ?? []
  if (requested.length === 0) {
    return sourceSnapshot.map((source) => ({
      resourceId: source.resourceId,
      pageFrom: null,
      pageTo: null,
    }))
  }

  const byResourceId = new Map(
    sourceSnapshot.map((source) => [source.resourceId, source])
  )
  const normalized = new Map<
    string,
    QuestionGenerationConfiguration['sourceScopes'][number]
  >()

  for (const scope of requested) {
    const source = byResourceId.get(scope.resourceId)
    if (!source) {
      return configurationError(
        'Selected source is not part of the graph version'
      )
    }
    if (normalized.has(scope.resourceId)) {
      return configurationError('A source can only be selected once')
    }

    const pageFrom = normalizePageBound(scope.pageFrom, 'pageFrom')
    const pageTo = normalizePageBound(scope.pageTo, 'pageTo')
    if ((pageFrom === null) !== (pageTo === null)) {
      return configurationError('pageFrom and pageTo must be provided together')
    }
    if (pageFrom !== null && pageTo !== null) {
      if (pageFrom > pageTo) {
        return configurationError('pageFrom must not exceed pageTo')
      }
      if (source.pageCount !== null && pageTo > source.pageCount) {
        return configurationError('Selected page range exceeds the source')
      }
    }

    normalized.set(scope.resourceId, {
      resourceId: scope.resourceId,
      pageFrom,
      pageTo,
    })
  }

  return sourceSnapshot.flatMap((source) => {
    const scope = normalized.get(source.resourceId)
    return scope ? [scope] : []
  })
}

export function normalizeQuestionGenerationConfiguration(
  input: QuestionGenerationConfigurationInput,
  graphVersion: QuestionGenerationGraphConfigurationSource
): NormalizedQuestionGenerationConfiguration {
  const itemType = input.itemType ?? 'SC'
  if (!isItemType(itemType)) {
    return configurationError('Question type is not supported')
  }
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
  if (!isDifficultyPreset(input.difficultyPreset)) {
    return configurationError('Difficulty preset is not supported')
  }

  const bloomLevels = normalizeBloomLevels(input.bloomLevels)
  const configuration: QuestionGenerationConfiguration = {
    itemType,
    language: input.language,
    questionCount: input.questionCount,
    difficultyPreset: input.difficultyPreset,
    difficultyCounts: allocateDifficulty(
      input.questionCount,
      input.difficultyPreset
    ),
    sourceScopes: normalizeSourceScopes(
      input.sourceScopes,
      graphVersion.sourceSnapshot
    ),
    objectives: normalizeObjectives(
      input.objectives,
      input.language,
      bloomLevels
    ),
    bloomLevels,
  }
  const canonical = JSON.stringify(configuration)

  return {
    configuration,
    configurationHash: createHash('sha256').update(canonical).digest('hex'),
  }
}
