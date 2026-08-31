import type { FreeTextRubricSchema } from '@klicker-uzh/types'
import {
  approximatelyEqual,
  hasDuplicates,
  isBoundedNonEmptyString,
  isBoundedStringArray,
  isFiniteNumber,
  isRecord,
  isWithinFreeTextPayloadBounds,
  MAX_FREE_TEXT_ACHIEVEMENT_LEVELS,
  MAX_FREE_TEXT_CONFIG_TEXT_LENGTH,
  MAX_FREE_TEXT_IDENTIFIER_LENGTH,
  MAX_FREE_TEXT_LIST_ITEM_LENGTH,
  MAX_FREE_TEXT_LIST_ITEMS,
  MAX_FREE_TEXT_RUBRICS,
  SCORE_MAX,
  SCORE_MIN,
} from './freeTextSemanticPrimitives.js'

function isIdentifier(value: unknown): value is string {
  return isBoundedNonEmptyString(value, MAX_FREE_TEXT_IDENTIFIER_LENGTH)
}

function isConfigText(value: unknown): value is string {
  return isBoundedNonEmptyString(value, MAX_FREE_TEXT_CONFIG_TEXT_LENGTH)
}

function isEvaluatorStringList(value: unknown): value is string[] {
  return isBoundedStringArray(value, {
    maxItems: MAX_FREE_TEXT_LIST_ITEMS,
    maxItemLength: MAX_FREE_TEXT_LIST_ITEM_LENGTH,
  })
}

export function validateFreeTextRubricSchema(value: unknown): string[] {
  if (!isRecord(value)) return ['rubric schema must be an object']
  if (!isWithinFreeTextPayloadBounds(value)) {
    return ['rubric schema exceeds payload limits']
  }

  const errors: string[] = []
  if (!isIdentifier(value.schema_version)) {
    errors.push('schema_version is required')
  }
  if (!isConfigText(value.name)) errors.push('schema name is required')
  if (!isConfigText(value.description)) {
    errors.push('schema description is required')
  }
  if (!Array.isArray(value.rubrics) || value.rubrics.length === 0) {
    errors.push('at least one rubric is required')
    return errors
  }
  if (value.rubrics.length > MAX_FREE_TEXT_RUBRICS) {
    errors.push(`rubrics must contain at most ${MAX_FREE_TEXT_RUBRICS} entries`)
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

    if (isIdentifier(rubric.id)) rubricIds.push(rubric.id)
    else errors.push(`rubric ${rubricIndex + 1} id is required`)

    if (isConfigText(rubric.name)) rubricNames.push(rubric.name)
    else errors.push(`rubric ${rubricIndex + 1} name is required`)

    if (!isConfigText(rubric.description)) {
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
    if (rubric.achievement_levels.length > MAX_FREE_TEXT_ACHIEVEMENT_LEVELS) {
      errors.push(
        `rubric ${rubricIndex + 1} must have at most ${MAX_FREE_TEXT_ACHIEVEMENT_LEVELS} achievement levels`
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

      if (isConfigText(level.name)) levelNames.push(level.name)
      else {
        errors.push(
          `rubric ${rubricIndex + 1} achievement level ${levelIndex + 1} name is required`
        )
      }

      if (!isConfigText(level.description)) {
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
  if (!isWithinFreeTextPayloadBounds(value)) {
    return ['evaluator response exceeds payload limits']
  }
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
  if (!isIdentifier(value.evaluator_version)) {
    errors.push('response evaluator_version is required')
  }
  if (!isIdentifier(value.model_version)) {
    errors.push('response model_version is required')
  }
  if (!Array.isArray(value.rubric_assessments)) {
    errors.push('rubric assessments are required')
    return errors
  }
  if (value.rubric_assessments.length > MAX_FREE_TEXT_RUBRICS) {
    errors.push(
      `rubric assessments must contain at most ${MAX_FREE_TEXT_RUBRICS} entries`
    )
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
    if (!isIdentifier(rubricId)) {
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
        const configuredLevel = isConfigText(assessment.proposed_level)
          ? configuredRubric.achievement_levels.find(
              (level) => level.name === assessment.proposed_level
            )
          : undefined
        if (!configuredLevel) {
          errors.push(`${prefix} proposed_level is not configured`)
        } else if (
          isFiniteNumber(assessment.normalized_score) &&
          !approximatelyEqual(
            assessment.normalized_score,
            configuredLevel.normalized_score
          )
        ) {
          errors.push(
            `${prefix} normalized_score does not match proposed_level`
          )
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
      if (!isEvaluatorStringList(fieldValue)) {
        errors.push(`${prefix} ${field} must be a string array`)
      }
    }
    if (!isConfigText(assessment.justification)) {
      errors.push(`${prefix} justification is required`)
    }
    if (!isConfigText(assessment.rationale)) {
      errors.push(`${prefix} rationale is required`)
    }
    for (const [field, fieldValue] of [
      ['evidence_sufficiency', assessment.evidence_sufficiency],
      ['uncertainty_reason', assessment.uncertainty_reason],
    ] as const) {
      if (
        fieldValue !== undefined &&
        fieldValue !== null &&
        !isConfigText(fieldValue)
      ) {
        errors.push(`${prefix} ${field} must be a string or null`)
      }
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
  } else if (Array.isArray(value.feedback_proposals)) {
    if (value.feedback_proposals.length > MAX_FREE_TEXT_RUBRICS) {
      errors.push(
        `feedback proposals must contain at most ${MAX_FREE_TEXT_RUBRICS} entries`
      )
      return errors
    }
    const proposedRubricIds: string[] = []
    value.feedback_proposals.forEach((proposal, index) => {
      const prefix = `feedback proposal ${index + 1}`
      if (!isRecord(proposal)) {
        errors.push(`${prefix} must be an object`)
        return
      }

      if (proposal.task_bundle_id !== taskBundleId) {
        errors.push(`${prefix} task_bundle_id does not match the request`)
      }

      const rubricId = proposal.rubric_id
      if (!isIdentifier(rubricId)) {
        errors.push(`${prefix} rubric_id is required`)
      } else {
        proposedRubricIds.push(rubricId)
        const configuredRubric = configuredRubricById.get(rubricId)
        if (!configuredRubric) {
          errors.push(`${prefix} rubric_id is not configured`)
        } else if (proposal.rubric_name !== configuredRubric.name) {
          errors.push(`${prefix} rubric_name does not match the rubric`)
        }
      }

      if (!isConfigText(proposal.feedback)) {
        errors.push(`${prefix} feedback is required`)
      }
      for (const [field, fieldValue] of [
        ['strengths', proposal.strengths],
        ['improvements', proposal.improvements],
        ['action_items', proposal.action_items],
        ['evidence_ids', proposal.evidence_ids],
      ] as const) {
        if (!isEvaluatorStringList(fieldValue)) {
          errors.push(`${prefix} ${field} must be a string array`)
        }
      }
      if (
        !isFiniteNumber(proposal.confidence) ||
        proposal.confidence < 0 ||
        proposal.confidence > 1
      ) {
        errors.push(`${prefix} confidence must be between 0 and 1`)
      }
    })

    const containsEveryRubricExactlyOnce =
      proposedRubricIds.length === schema.rubrics.length &&
      schema.rubrics.every((rubric) => {
        return proposedRubricIds.filter((id) => id === rubric.id).length === 1
      })
    if (!containsEveryRubricExactlyOnce) {
      errors.push(
        'feedback proposals must contain every configured rubric exactly once'
      )
    }
  }

  return errors
}
