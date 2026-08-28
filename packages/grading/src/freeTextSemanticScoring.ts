import type {
  FreeTextOutcomeBand,
  FreeTextRubricAssessment,
  FreeTextRubricSchema,
  SemanticFreeTextConfig,
} from '@klicker-uzh/types'
import {
  approximatelyEqual,
  hasDuplicates,
  isFiniteNumber,
  isNonEmptyString,
  isRecord,
  SCORE_MAX,
  SCORE_MIN,
} from './freeTextSemanticPrimitives.js'
import { validateFreeTextRubricSchema } from './freeTextSemanticValidation.js'

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
