import type {
  FreeTextRubricSchema,
  SemanticFreeTextConfig,
} from '@klicker-uzh/types'
import {
  isBoundedNonEmptyString,
  isBoundedStringArray,
  isFiniteNumber,
  isNonEmptyString,
  isRecord,
  isStringArray,
  isWithinFreeTextPayloadBounds,
  MAX_FREE_TEXT_CONFIG_TEXT_LENGTH,
  MAX_FREE_TEXT_EXACT_ANSWERS,
} from './freeTextSemanticPrimitives.js'
import {
  getDefaultFreeTextOutcomeBands,
  normalizeFreeTextAnswer,
  validateFreeTextOutcomeBands,
} from './freeTextSemanticScoring.js'
import { validateFreeTextRubricSchema } from './freeTextSemanticValidation.js'

export function createSemanticFreeTextConfig({
  language,
  legacySolutions = [],
}: {
  language: SemanticFreeTextConfig['question_language']
  legacySolutions?: string[]
}): SemanticFreeTextConfig {
  const copy =
    language === 'de'
      ? {
          schemaName: 'Freitext-Bewertung',
          schemaDescription:
            'Kriterien zur formativen Bewertung dieser Freitextantwort.',
          rubricName: 'Inhaltliche Qualität',
          rubricDescription:
            'Die Antwort behandelt die Frage korrekt und vollständig.',
          levels: [
            ['nicht erfüllt', 'Das Kriterium ist nicht erfüllt.', 0],
            ['teilweise erfüllt', 'Das Kriterium ist teilweise erfüllt.', 50],
            ['erfüllt', 'Das Kriterium ist erfüllt.', 100],
          ] as const,
          outcomeLabels: {
            INCORRECT: 'Nicht korrekt',
            PARTIAL: 'Teilweise korrekt',
            CORRECT: 'Korrekt',
          },
        }
      : {
          schemaName: 'Free-text evaluation',
          schemaDescription:
            'Criteria for the formative evaluation of this free-text response.',
          rubricName: 'Content quality',
          rubricDescription:
            'The answer addresses the question accurately and completely.',
          levels: [
            ['not met', 'The criterion is not met.', 0],
            ['partially met', 'The criterion is partially met.', 50],
            ['met', 'The criterion is met.', 100],
          ] as const,
          outcomeLabels: {
            INCORRECT: 'Incorrect',
            PARTIAL: 'Partially correct',
            CORRECT: 'Correct',
          },
        }

  return {
    contract_version: '1',
    question_language: language,
    attempt_limit: 2,
    solution_reveal_enabled: true,
    accepted_exact_answers: [...legacySolutions],
    reference_solution: '',
    outcome_bands: getDefaultFreeTextOutcomeBands().map((band) => ({
      ...band,
      label: copy.outcomeLabels[band.category],
    })),
    rubric_schema: {
      schema_version: '1',
      name: copy.schemaName,
      description: copy.schemaDescription,
      rubrics: [
        {
          id: 'content-quality',
          name: copy.rubricName,
          description: copy.rubricDescription,
          weight: 1,
          achievement_levels: copy.levels.map(
            ([name, description, normalizedScore]) => ({
              name,
              description,
              normalized_score: normalizedScore,
            })
          ),
        },
      ],
    },
  }
}

export function getSemanticFreeTextAdvancedMetadata(
  schema: FreeTextRubricSchema
): Record<string, unknown> {
  const { schema_version, name, description, rubrics, ...schemaMetadata } =
    schema

  const rubricMetadata = rubrics.flatMap((rubric) => {
    const {
      id,
      name: rubricName,
      description: rubricDescription,
      weight,
      achievement_levels,
      ...metadata
    } = rubric
    const levelMetadata = achievement_levels.flatMap((level) => {
      const {
        name: levelName,
        description: levelDescription,
        normalized_score,
        ...levelAdvanced
      } = level
      return Object.keys(levelAdvanced).length > 0
        ? [{ level: levelName, metadata: levelAdvanced }]
        : []
    })

    return Object.keys(metadata).length > 0 || levelMetadata.length > 0
      ? [
          {
            rubric: id,
            metadata,
            achievement_levels: levelMetadata,
          },
        ]
      : []
  })

  return {
    schema: schemaMetadata,
    rubrics: rubricMetadata,
  }
}

export function validateSemanticFreeTextConfig(value: unknown): string[] {
  if (!isRecord(value)) return ['semantic evaluation config must be an object']
  if (!isWithinFreeTextPayloadBounds(value)) {
    return ['semantic evaluation config exceeds payload limits']
  }

  const errors: string[] = []
  if (value.contract_version !== '1') {
    errors.push('contract_version must be 1')
  }
  if (value.question_language !== 'en' && value.question_language !== 'de') {
    errors.push('question_language must be en or de')
  }
  if (
    !isFiniteNumber(value.attempt_limit) ||
    !Number.isInteger(value.attempt_limit) ||
    value.attempt_limit < 1 ||
    value.attempt_limit > 10
  ) {
    errors.push('attempt_limit must be an integer from 1 through 10')
  }
  if (typeof value.solution_reveal_enabled !== 'boolean') {
    errors.push('solution_reveal_enabled must be a boolean')
  }
  if (!isStringArray(value.accepted_exact_answers)) {
    errors.push('accepted_exact_answers must be a string array')
  } else if (
    !isBoundedStringArray(value.accepted_exact_answers, {
      maxItems: MAX_FREE_TEXT_EXACT_ANSWERS,
      maxItemLength: MAX_FREE_TEXT_CONFIG_TEXT_LENGTH,
    })
  ) {
    errors.push(
      `accepted_exact_answers must contain at most ${MAX_FREE_TEXT_EXACT_ANSWERS} answers of at most ${MAX_FREE_TEXT_CONFIG_TEXT_LENGTH} characters`
    )
  } else if (
    value.accepted_exact_answers.some(
      (answer) => normalizeFreeTextAnswer(answer).length === 0
    )
  ) {
    errors.push('accepted_exact_answers must not contain empty answers')
  }
  if (
    value.solution_reveal_enabled === true &&
    !isNonEmptyString(value.reference_solution)
  ) {
    errors.push(
      'reference_solution is required when solution reveal is enabled'
    )
  } else if (
    value.reference_solution != null &&
    typeof value.reference_solution !== 'string'
  ) {
    errors.push('reference_solution must be a string')
  } else if (
    value.reference_solution != null &&
    !isBoundedNonEmptyString(
      value.reference_solution,
      MAX_FREE_TEXT_CONFIG_TEXT_LENGTH
    )
  ) {
    errors.push(
      `reference_solution must contain at most ${MAX_FREE_TEXT_CONFIG_TEXT_LENGTH} characters`
    )
  }

  errors.push(
    ...validateFreeTextRubricSchema(value.rubric_schema).map((error) => {
      return `rubric_schema: ${error}`
    })
  )
  if (value.outcome_bands != null) {
    errors.push(
      ...validateFreeTextOutcomeBands(value.outcome_bands).map((error) => {
        return `outcome_bands: ${error}`
      })
    )
  }

  return errors
}
