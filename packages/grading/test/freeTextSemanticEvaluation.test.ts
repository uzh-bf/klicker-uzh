import {
  computeFreeTextAggregate,
  getDefaultFreeTextOutcomeBands,
  mapFreeTextOutcome,
  matchesAcceptedExactAnswer,
  normalizeFreeTextAnswer,
  validateEvaluateFreeTextResponse,
  validateFreeTextOutcomeBands,
  validateFreeTextRubricSchema,
  validateSemanticFreeTextConfig,
} from '../src/freeTextSemanticEvaluation.js'

const validSchema = {
  schema_version: '1',
  name: 'Open-ended practice quiz',
  description: 'Evaluate a short formative response.',
  rubrics: [
    {
      id: 'conceptual_accuracy',
      name: 'Conceptual accuracy',
      description: 'The response uses the relevant concepts correctly.',
      weight: 0.45,
      achievement_levels: [
        {
          name: 'excellent',
          description: 'Fully accurate.',
          normalized_score: 100,
        },
        {
          name: 'adequate',
          description: 'Partially accurate.',
          normalized_score: 50,
        },
      ],
    },
    {
      id: 'example_quality',
      name: 'Example quality',
      description: 'The example supports the answer.',
      weight: 0.3,
      achievement_levels: [
        {
          name: 'excellent',
          description: 'Highly relevant.',
          normalized_score: 100,
        },
        {
          name: 'good',
          description: 'Relevant.',
          normalized_score: 75,
        },
      ],
    },
    {
      id: 'communication_clarity',
      name: 'Communication clarity',
      description: 'The response is clear and concise.',
      weight: 0.25,
      achievement_levels: [
        {
          name: 'excellent',
          description: 'Exceptionally clear.',
          normalized_score: 100,
        },
        {
          name: 'adequate',
          description: 'Understandable.',
          normalized_score: 50,
        },
      ],
    },
  ],
} as const

const validResponse = {
  contract_version: '1',
  task_bundle_id: 'attempt-1',
  evaluator_version: 'evaluator-v1',
  model_version: 'model-v1',
  rubric_assessments: validSchema.rubrics.map((rubric) => ({
    task_bundle_id: 'attempt-1',
    rubric_id: rubric.id,
    rubric_name: rubric.name,
    proposed_level: rubric.achievement_levels[0].name,
    normalized_score: rubric.achievement_levels[0].normalized_score,
    justification: 'The answer demonstrates this criterion.',
    evidence_ids: [],
    confidence: 0.9,
    needs_review: false,
    review_flags: [],
    used_evidence_ids: [],
    unsupported_claims: [],
    evidence_sufficiency: 'sufficient',
    uncertainty_reason: null,
    rationale: 'The criterion is supported by the submitted answer.',
  })),
} as const

describe('semantic free-text evaluation', () => {
  it('accepts the required uzh-bf/agents rubric fields', () => {
    expect(validateFreeTextRubricSchema(validSchema)).toEqual([])
  })

  it('rejects incomplete, duplicated, and incorrectly weighted rubrics', () => {
    const invalidSchema = {
      ...validSchema,
      rubrics: [
        validSchema.rubrics[0],
        {
          ...validSchema.rubrics[0],
          weight: 0.4,
          achievement_levels: [
            validSchema.rubrics[0].achievement_levels[0],
            validSchema.rubrics[0].achievement_levels[0],
          ],
        },
      ],
    }

    expect(validateFreeTextRubricSchema(invalidSchema)).toEqual(
      expect.arrayContaining([
        'rubric ids must be unique',
        'rubric names must be unique',
        'achievement level names must be unique within a rubric',
        'rubric weights must sum to 1',
      ])
    )
  })

  it('validates complete, non-overlapping outcome bands', () => {
    expect(
      validateFreeTextOutcomeBands([
        {
          id: 'retry',
          label: 'Try once more',
          min_score: 0,
          max_score: 60,
          category: 'INCORRECT',
        },
        {
          id: 'close',
          label: 'Nearly there',
          min_score: 60,
          max_score: 85,
          category: 'PARTIAL',
        },
        {
          id: 'mastered',
          label: 'Mastered',
          min_score: 85,
          max_score: 100,
          category: 'CORRECT',
        },
      ])
    ).toEqual([])

    expect(
      validateFreeTextOutcomeBands([
        {
          id: 'low',
          label: 'Low',
          min_score: 10,
          max_score: 70,
          category: 'INCORRECT',
        },
        {
          id: 'high',
          label: 'High',
          min_score: 60,
          max_score: 90,
          category: 'CORRECT',
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        'outcome bands must cover scores from 0 through 100',
        'outcome bands must not overlap or leave gaps',
      ])
    )
  })

  it('validates the lecturer-configurable semantic evaluation settings', () => {
    expect(
      validateSemanticFreeTextConfig({
        contract_version: '1',
        question_language: 'de',
        attempt_limit: 2,
        solution_reveal_enabled: true,
        accepted_exact_answers: ['Opportunitätskosten'],
        reference_solution: 'Eine vollständige Referenzlösung.',
        rubric_schema: validSchema,
      })
    ).toEqual([])

    expect(
      validateSemanticFreeTextConfig({
        contract_version: '1',
        question_language: 'en',
        attempt_limit: 1,
        solution_reveal_enabled: false,
        accepted_exact_answers: [],
        reference_solution: null,
        outcome_bands: null,
        rubric_schema: validSchema,
      })
    ).toEqual([])

    expect(
      validateSemanticFreeTextConfig({
        contract_version: '1',
        question_language: 'fr',
        attempt_limit: 11,
        solution_reveal_enabled: true,
        accepted_exact_answers: [42],
        reference_solution: ' ',
        rubric_schema: validSchema,
      })
    ).toEqual(
      expect.arrayContaining([
        'question_language must be en or de',
        'attempt_limit must be an integer from 1 through 10',
        'accepted_exact_answers must be a string array',
        'reference_solution is required when solution reveal is enabled',
      ])
    )
  })

  it('computes the weighted aggregate from one assessment per rubric', () => {
    expect(
      computeFreeTextAggregate({
        rubricSchema: validSchema,
        assessments: [
          { rubric_id: 'conceptual_accuracy', normalized_score: 100 },
          { rubric_id: 'example_quality', normalized_score: 75 },
          { rubric_id: 'communication_clarity', normalized_score: 50 },
        ],
      })
    ).toBe(80)

    expect(
      computeFreeTextAggregate({
        rubricSchema: validSchema,
        assessments: [
          { rubric_id: 'conceptual_accuracy', normalized_score: 100 },
          { rubric_id: 'example_quality', normalized_score: 75 },
        ],
      })
    ).toBeNull()
  })

  it('accepts a complete evaluator response for the requested task and rubrics', () => {
    expect(
      validateEvaluateFreeTextResponse({
        value: validResponse,
        taskBundleId: 'attempt-1',
        rubricSchema: validSchema,
      })
    ).toEqual([])
  })

  it('rejects mismatched, uncertain, and out-of-range evaluator output', () => {
    const invalidResponse = {
      ...validResponse,
      task_bundle_id: 'another-attempt',
      rubric_assessments: [
        {
          ...validResponse.rubric_assessments[0],
          task_bundle_id: 'another-attempt',
          normalized_score: 101,
          confidence: 1.1,
          needs_review: true,
        },
        validResponse.rubric_assessments[0],
      ],
    }

    expect(
      validateEvaluateFreeTextResponse({
        value: invalidResponse,
        taskBundleId: 'attempt-1',
        rubricSchema: validSchema,
      })
    ).toEqual(
      expect.arrayContaining([
        'response task_bundle_id does not match the request',
        'rubric assessments must contain every configured rubric exactly once',
        'rubric assessment 1 task_bundle_id does not match the request',
        'rubric assessment 1 score must be between 0 and 100',
        'rubric assessment 1 confidence must be between 0 and 1',
        'rubric assessment 1 requires human review',
      ])
    )
  })

  it('maps default outcomes at the confirmed 50 and 75 boundaries', () => {
    const bands = getDefaultFreeTextOutcomeBands()

    expect(bands.map((band) => band.label)).toEqual([
      'Not yet correct',
      'Partially correct',
      'Correct',
    ])
    expect(
      getDefaultFreeTextOutcomeBands('de').map((band) => band.label)
    ).toEqual(['Noch nicht korrekt', 'Teilweise korrekt', 'Korrekt'])

    expect(
      mapFreeTextOutcome({ score: 49.99, outcomeBands: bands })
    ).toMatchObject({ id: 'not-yet-correct', category: 'INCORRECT' })
    expect(
      mapFreeTextOutcome({ score: 50, outcomeBands: bands })
    ).toMatchObject({
      id: 'partially-correct',
      category: 'PARTIAL',
    })
    expect(
      mapFreeTextOutcome({ score: 75, outcomeBands: bands })
    ).toMatchObject({
      id: 'correct',
      category: 'CORRECT',
    })
    expect(
      mapFreeTextOutcome({ score: 100, outcomeBands: bands })
    ).toMatchObject({
      id: 'correct',
      category: 'CORRECT',
    })
  })

  it('keeps the legacy trim and case-insensitive exact-match semantics', () => {
    expect(normalizeFreeTextAnswer('  Opportunity COST  ')).toBe(
      'opportunity cost'
    )
    expect(
      matchesAcceptedExactAnswer({
        response: '  Opportunity COST  ',
        acceptedExactAnswers: ['opportunity cost'],
      })
    ).toBe(true)
    expect(
      matchesAcceptedExactAnswer({
        response: 'A semantically plausible variant',
        acceptedExactAnswers: ['opportunity cost'],
      })
    ).toBe(false)
    expect(
      matchesAcceptedExactAnswer({
        response: 'anything',
        acceptedExactAnswers: [],
      })
    ).toBe(false)
  })
})
