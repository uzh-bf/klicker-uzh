import type { SemanticFreeTextConfig } from '@klicker-uzh/types'
import { describe, expect, it } from 'vitest'
import { getSemanticFreeTextConfigHash } from '../src/services/freeTextEvaluationPolicy.js'
import { semanticConfig } from './freeTextEvaluation.fixture.js'

describe('semantic free-text evaluation policy', () => {
  it('hashes equivalent configurations independently of object key order', () => {
    const reordered = {
      rubric_schema: {
        rubrics: semanticConfig.rubric_schema.rubrics.map((rubric) => ({
          achievement_levels: rubric.achievement_levels.map((level) => ({
            normalized_score: level.normalized_score,
            description: level.description,
            name: level.name,
          })),
          weight: rubric.weight,
          description: rubric.description,
          name: rubric.name,
          id: rubric.id,
        })),
        description: semanticConfig.rubric_schema.description,
        name: semanticConfig.rubric_schema.name,
        schema_version: semanticConfig.rubric_schema.schema_version,
      },
      reference_solution: semanticConfig.reference_solution,
      accepted_exact_answers: semanticConfig.accepted_exact_answers,
      solution_reveal_enabled: semanticConfig.solution_reveal_enabled,
      attempt_limit: semanticConfig.attempt_limit,
      question_language: semanticConfig.question_language,
      contract_version: semanticConfig.contract_version,
    } satisfies SemanticFreeTextConfig

    expect(getSemanticFreeTextConfigHash(reordered)).toBe(
      getSemanticFreeTextConfigHash(semanticConfig)
    )
    expect(
      getSemanticFreeTextConfigHash({
        ...reordered,
        reference_solution: 'A materially different solution.',
      })
    ).not.toBe(getSemanticFreeTextConfigHash(semanticConfig))
  })
})
