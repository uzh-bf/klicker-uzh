import type {
  FreeTextOutcomeBand,
  FreeTextRubricAssessment,
  FreeTextRubricSchema,
  SemanticFreeTextConfig,
} from '@klicker-uzh/types'

const SCORE_MIN = 0
const SCORE_MAX = 100
const FLOAT_TOLERANCE = 1e-9

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  )
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= FLOAT_TOLERANCE
}

export function validateFreeTextRubricSchema(value: unknown): string[] {
  if (!isRecord(value)) return ['rubric schema must be an object']

  const errors: string[] = []
  if (!isNonEmptyString(value.schema_version)) {
    errors.push('schema_version is required')
  }
  if (!isNonEmptyString(value.name)) errors.push('schema name is required')
  if (!isNonEmptyString(value.description)) {
    errors.push('schema description is required')
  }
  if (!Array.isArray(value.rubrics) || value.rubrics.length === 0) {
    errors.push('at least one rubric is required')
    return errors
  }

  const rubricIds: string[] = []
  const rubricNames: string[] = []
  let weightTotal = 0

  value.rubrics.forEach((rubric, rubricIndex) => {
    if (!isRecord(rubric)) {
      errors.push(`rubric ${rubricIndex + 1} must be an object`)
      return
    }

    if (isNonEmptyString(rubric.id)) rubricIds.push(rubric.id)
    else errors.push(`rubric ${rubricIndex + 1} id is required`)

    if (isNonEmptyString(rubric.name)) rubricNames.push(rubric.name)
    else errors.push(`rubric ${rubricIndex + 1} name is required`)

    if (!isNonEmptyString(rubric.description)) {
      errors.push(`rubric ${rubricIndex + 1} description is required`)
    }

    if (
      !isFiniteNumber(rubric.weight) ||
      rubric.weight < 0 ||
      rubric.weight > 1
    ) {
      errors.push(`rubric ${rubricIndex + 1} weight must be between 0 and 1`)
    } else {
      weightTotal += rubric.weight
    }

    if (
      !Array.isArray(rubric.achievement_levels) ||
      rubric.achievement_levels.length === 0
    ) {
      errors.push(
        `rubric ${rubricIndex + 1} must have at least one achievement level`
      )
      return
    }

    const levelNames: string[] = []
    rubric.achievement_levels.forEach((level, levelIndex) => {
      if (!isRecord(level)) {
        errors.push(
          `rubric ${rubricIndex + 1} achievement level ${levelIndex + 1} must be an object`
        )
        return
      }

      if (isNonEmptyString(level.name)) levelNames.push(level.name)
      else {
        errors.push(
          `rubric ${rubricIndex + 1} achievement level ${levelIndex + 1} name is required`
        )
      }

      if (!isNonEmptyString(level.description)) {
        errors.push(
          `rubric ${rubricIndex + 1} achievement level ${levelIndex + 1} description is required`
        )
      }

      if (
        !isFiniteNumber(level.normalized_score) ||
        level.normalized_score < SCORE_MIN ||
        level.normalized_score > SCORE_MAX
      ) {
        errors.push(
          `rubric ${rubricIndex + 1} achievement level ${levelIndex + 1} score must be between 0 and 100`
        )
      }
    })

    if (hasDuplicates(levelNames)) {
      errors.push('achievement level names must be unique within a rubric')
    }
  })

  if (hasDuplicates(rubricIds)) errors.push('rubric ids must be unique')
  if (hasDuplicates(rubricNames)) errors.push('rubric names must be unique')
  if (!approximatelyEqual(weightTotal, 1)) {
    errors.push('rubric weights must sum to 1')
  }

  return errors
}

export function validateEvaluateFreeTextResponse({
  value,
  taskBundleId,
  rubricSchema,
}: {
  value: unknown
  taskBundleId: string
  rubricSchema: unknown
}): string[] {
  if (!isRecord(value)) return ['evaluator response must be an object']
  if (validateFreeTextRubricSchema(rubricSchema).length > 0) {
    return ['rubric schema is invalid']
  }

  const schema = rubricSchema as FreeTextRubricSchema
  const errors: string[] = []
  if (value.contract_version !== '1') {
    errors.push('response contract_version must be 1')
  }
  if (value.task_bundle_id !== taskBundleId) {
    errors.push('response task_bundle_id does not match the request')
  }
  if (!isNonEmptyString(value.evaluator_version)) {
    errors.push('response evaluator_version is required')
  }
  if (!isNonEmptyString(value.model_version)) {
    errors.push('response model_version is required')
  }
  if (!Array.isArray(value.rubric_assessments)) {
    errors.push('rubric assessments are required')
    return errors
  }

  const configuredRubricById = new Map(
    schema.rubrics.map((rubric) => [rubric.id, rubric])
  )
  const assessedRubricIds: string[] = []
  value.rubric_assessments.forEach((assessment, index) => {
    const prefix = `rubric assessment ${index + 1}`
    if (!isRecord(assessment)) {
      errors.push(`${prefix} must be an object`)
      return
    }

    if (assessment.task_bundle_id !== taskBundleId) {
      errors.push(`${prefix} task_bundle_id does not match the request`)
    }

    const rubricId = assessment.rubric_id
    if (!isNonEmptyString(rubricId)) {
      errors.push(`${prefix} rubric_id is required`)
    } else {
      assessedRubricIds.push(rubricId)
      const configuredRubric = configuredRubricById.get(rubricId)
      if (!configuredRubric) {
        errors.push(`${prefix} rubric_id is not configured`)
      } else {
        if (assessment.rubric_name !== configuredRubric.name) {
          errors.push(`${prefix} rubric_name does not match the rubric`)
        }
        if (
          !isNonEmptyString(assessment.proposed_level) ||
          !configuredRubric.achievement_levels.some(
            (level) => level.name === assessment.proposed_level
          )
        ) {
          errors.push(`${prefix} proposed_level is not configured`)
        }
      }
    }

    if (
      !isFiniteNumber(assessment.normalized_score) ||
      assessment.normalized_score < SCORE_MIN ||
      assessment.normalized_score > SCORE_MAX
    ) {
      errors.push(`${prefix} score must be between 0 and 100`)
    }
    if (
      !isFiniteNumber(assessment.confidence) ||
      assessment.confidence < 0 ||
      assessment.confidence > 1
    ) {
      errors.push(`${prefix} confidence must be between 0 and 1`)
    }
    if (assessment.needs_review === true) {
      errors.push(`${prefix} requires human review`)
    } else if (assessment.needs_review !== false) {
      errors.push(`${prefix} needs_review must be false`)
    }

    for (const [field, fieldValue] of [
      ['evidence_ids', assessment.evidence_ids],
      ['review_flags', assessment.review_flags],
      ['used_evidence_ids', assessment.used_evidence_ids],
      ['unsupported_claims', assessment.unsupported_claims],
    ] as const) {
      if (!isStringArray(fieldValue)) {
        errors.push(`${prefix} ${field} must be a string array`)
      }
    }
    if (!isNonEmptyString(assessment.justification)) {
      errors.push(`${prefix} justification is required`)
    }
    if (!isNonEmptyString(assessment.rationale)) {
      errors.push(`${prefix} rationale is required`)
    }
  })

  const containsEveryRubricExactlyOnce =
    assessedRubricIds.length === schema.rubrics.length &&
    schema.rubrics.every((rubric) => {
      return assessedRubricIds.filter((id) => id === rubric.id).length === 1
    })
  if (!containsEveryRubricExactlyOnce) {
    errors.push(
      'rubric assessments must contain every configured rubric exactly once'
    )
  }

  if (
    value.feedback_proposals !== undefined &&
    !Array.isArray(value.feedback_proposals)
  ) {
    errors.push('feedback proposals must be an array')
  }

  return errors
}

export function getDefaultFreeTextOutcomeBands(
  language: SemanticFreeTextConfig['question_language'] = 'en'
): FreeTextOutcomeBand[] {
  const labels =
    language === 'de'
      ? {
          incorrect: 'Noch nicht korrekt',
          partial: 'Teilweise korrekt',
          correct: 'Korrekt',
        }
      : {
          incorrect: 'Not yet correct',
          partial: 'Partially correct',
          correct: 'Correct',
        }

  return [
    {
      id: 'not-yet-correct',
      label: labels.incorrect,
      min_score: 0,
      max_score: 50,
      category: 'INCORRECT',
    },
    {
      id: 'partially-correct',
      label: labels.partial,
      min_score: 50,
      max_score: 75,
      category: 'PARTIAL',
    },
    {
      id: 'correct',
      label: labels.correct,
      min_score: 75,
      max_score: 100,
      category: 'CORRECT',
    },
  ]
}

export function validateFreeTextOutcomeBands(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return ['at least one outcome band is required']
  }

  const errors: string[] = []
  const bands: FreeTextOutcomeBand[] = []
  const ids: string[] = []

  value.forEach((band, index) => {
    if (!isRecord(band)) {
      errors.push(`outcome band ${index + 1} must be an object`)
      return
    }

    if (isNonEmptyString(band.id)) ids.push(band.id)
    else errors.push(`outcome band ${index + 1} id is required`)

    if (!isNonEmptyString(band.label)) {
      errors.push(`outcome band ${index + 1} label is required`)
    }

    const category = band.category
    const validCategory =
      category === 'CORRECT' ||
      category === 'PARTIAL' ||
      category === 'INCORRECT'
    if (!validCategory) {
      errors.push(`outcome band ${index + 1} category is invalid`)
    }

    const minScore = band.min_score
    const maxScore = band.max_score
    const validMin =
      isFiniteNumber(minScore) && minScore >= SCORE_MIN && minScore <= SCORE_MAX
    const validMax =
      isFiniteNumber(maxScore) && maxScore >= SCORE_MIN && maxScore <= SCORE_MAX

    if (!validMin || !validMax || minScore >= maxScore) {
      errors.push(
        `outcome band ${index + 1} must have increasing bounds from 0 through 100`
      )
      return
    }

    if (
      validCategory &&
      isNonEmptyString(band.id) &&
      isNonEmptyString(band.label)
    ) {
      bands.push({
        id: band.id,
        label: band.label,
        min_score: minScore,
        max_score: maxScore,
        category,
      })
    }
  })

  if (hasDuplicates(ids)) errors.push('outcome band ids must be unique')

  const orderedBands = [...bands].sort((left, right) => {
    return left.min_score - right.min_score
  })
  const firstBand = orderedBands[0]
  const lastBand = orderedBands.at(-1)
  if (
    !firstBand ||
    !lastBand ||
    !approximatelyEqual(firstBand.min_score, SCORE_MIN) ||
    !approximatelyEqual(lastBand.max_score, SCORE_MAX)
  ) {
    errors.push('outcome bands must cover scores from 0 through 100')
  }
  if (
    lastBand &&
    approximatelyEqual(lastBand.max_score, SCORE_MAX) &&
    lastBand.category !== 'CORRECT'
  ) {
    errors.push('the outcome band covering score 100 must be correct')
  }

  const hasGapOrOverlap = orderedBands.some((band, index) => {
    const nextBand = orderedBands[index + 1]
    return nextBand
      ? !approximatelyEqual(band.max_score, nextBand.min_score)
      : false
  })
  if (hasGapOrOverlap) {
    errors.push('outcome bands must not overlap or leave gaps')
  }

  return errors
}

export function validateSemanticFreeTextConfig(value: unknown): string[] {
  if (!isRecord(value)) return ['semantic evaluation config must be an object']

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

export function computeFreeTextAggregate({
  rubricSchema,
  assessments,
}: {
  rubricSchema: unknown
  assessments: ReadonlyArray<
    Pick<FreeTextRubricAssessment, 'rubric_id' | 'normalized_score'>
  >
}): number | null {
  if (validateFreeTextRubricSchema(rubricSchema).length > 0) return null

  const schema = rubricSchema as FreeTextRubricSchema
  if (assessments.length !== schema.rubrics.length) return null

  const assessmentByRubric = new Map<
    string,
    Pick<FreeTextRubricAssessment, 'rubric_id' | 'normalized_score'>
  >()
  for (const assessment of assessments) {
    if (
      assessmentByRubric.has(assessment.rubric_id) ||
      !isFiniteNumber(assessment.normalized_score) ||
      assessment.normalized_score < SCORE_MIN ||
      assessment.normalized_score > SCORE_MAX
    ) {
      return null
    }
    assessmentByRubric.set(assessment.rubric_id, assessment)
  }

  let aggregate = 0
  for (const rubric of schema.rubrics) {
    const assessment = assessmentByRubric.get(rubric.id)
    if (!assessment) return null
    aggregate += rubric.weight * assessment.normalized_score
  }

  return Math.round(aggregate * 1_000_000) / 1_000_000
}

export function mapFreeTextOutcome({
  score,
  outcomeBands,
}: {
  score: number
  outcomeBands?: ReadonlyArray<FreeTextOutcomeBand>
}): FreeTextOutcomeBand | null {
  if (!isFiniteNumber(score) || score < SCORE_MIN || score > SCORE_MAX) {
    return null
  }

  const bands = outcomeBands ?? getDefaultFreeTextOutcomeBands()
  if (validateFreeTextOutcomeBands(bands).length > 0) return null

  return (
    bands.find((band) => {
      const includesUpperBound =
        approximatelyEqual(score, SCORE_MAX) &&
        approximatelyEqual(band.max_score, SCORE_MAX)
      return (
        score >= band.min_score &&
        (score < band.max_score || includesUpperBound)
      )
    }) ?? null
  )
}

export function normalizeFreeTextAnswer(value: string): string {
  return value.trim().toLowerCase()
}

export function matchesAcceptedExactAnswer({
  response,
  acceptedExactAnswers,
}: {
  response: string
  acceptedExactAnswers: ReadonlyArray<string>
}): boolean {
  const normalizedResponse = normalizeFreeTextAnswer(response)
  return acceptedExactAnswers.some((answer) => {
    return normalizeFreeTextAnswer(answer) === normalizedResponse
  })
}
