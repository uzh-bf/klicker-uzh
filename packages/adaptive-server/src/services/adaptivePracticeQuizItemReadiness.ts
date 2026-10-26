import { MAX_DISCRIMINATION } from '@klicker-uzh/adaptive-contract'
import type { AdaptiveConfiguredAssignment } from './adaptivePracticeQuizReadinessTypes.js'

export function isUsableAdaptiveAssignment(
  assignment: AdaptiveConfiguredAssignment
) {
  return (
    assignment.available &&
    assignment.controlledAnswerReady &&
    hasValidAdaptiveItemParameters(assignment)
  )
}

export function hasValidAdaptiveItemParameters(
  assignment: AdaptiveConfiguredAssignment
) {
  return (
    Number.isFinite(assignment.discrimination) &&
    assignment.discrimination > 0 &&
    assignment.discrimination <= MAX_DISCRIMINATION &&
    Number.isFinite(assignment.difficulty) &&
    Number.isFinite(assignment.guessing) &&
    assignment.guessing >= 0 &&
    assignment.guessing < 1
  )
}
