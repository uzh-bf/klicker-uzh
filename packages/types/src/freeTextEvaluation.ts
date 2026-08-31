export type FreeTextCorrectnessCategory = 'CORRECT' | 'PARTIAL' | 'INCORRECT'

export type FreeTextEvaluationAvailabilityReason =
  | 'CONFIGURATION_CHANGED'
  | 'CONSENT_DECLINED'
  | 'CONSENT_REQUIRED'
  | 'EVALUATION_STALLED'
  | 'EVALUATOR_FAILED'
  | 'EVALUATOR_REJECTED_REQUEST'
  | 'EVALUATOR_RESULT_UNAVAILABLE'
  | 'EVALUATOR_UNAVAILABLE'
  | 'LECTURER_ENTITLEMENT_UNAVAILABLE'
  | 'PARTICIPANT_ACCESS_UNAVAILABLE'
  | 'SCHEDULING_FAILED'

export type FreeTextRubricAchievementLevel = {
  name: string
  description: string
  normalized_score: number
  [key: string]: unknown
}

export type FreeTextRubric = {
  id: string
  name: string
  description: string
  weight: number
  achievement_levels: FreeTextRubricAchievementLevel[]
  score_scale?: unknown
  anchors?: unknown
  interpolation_policy?: unknown
  modalities?: unknown
  deterministic_caps?: unknown
  scoring_policy?: unknown
  components?: unknown
  adversarial_checks?: unknown
  evidence_mode_rules?: unknown
  binary_checklist?: unknown
  credit_unverifiable?: unknown
  [key: string]: unknown
}

export type FreeTextRubricSchema = {
  schema_version: string
  name: string
  description: string
  rubrics: FreeTextRubric[]
  evidence_contract?: unknown
  score_scale?: unknown
  interpolation_policy?: unknown
  segmentation?: unknown
  feedback_required?: unknown
  feedback_register?: unknown
  batch_comparison?: unknown
  adaptations?: unknown
  scoring_policy?: unknown
  [key: string]: unknown
}

export type FreeTextOutcomeBand = {
  id: string
  label: string
  min_score: number
  max_score: number
  category: FreeTextCorrectnessCategory
}

export type SemanticFreeTextConfig = {
  contract_version: '1'
  question_language: 'en' | 'de'
  attempt_limit: number
  solution_reveal_enabled: boolean
  accepted_exact_answers: string[]
  // Persisted authoring data may use null when reveal is disabled. Evaluator
  // requests must omit the field in that case; null is not part of the wire
  // contract.
  reference_solution?: string | null
  outcome_bands?: FreeTextOutcomeBand[] | null
  rubric_schema: FreeTextRubricSchema
}

export type FreeTextRubricAssessment = {
  task_bundle_id: string
  rubric_id: string
  rubric_name: string
  proposed_level: string
  normalized_score: number
  // Contract-facing explanation used for evaluator audit and validation.
  justification: string
  // Evidence identifiers supplied to the evaluator for this assessment.
  evidence_ids: string[]
  confidence: number
  needs_review: boolean
  review_flags: string[]
  // Subset of evidence identifiers the evaluator actually relied on.
  used_evidence_ids: string[]
  unsupported_claims: string[]
  evidence_sufficiency?: string | null
  uncertainty_reason?: string | null
  // Participant-facing explanation shown in the formative feedback UI.
  rationale: string
}

export type FreeTextFeedbackProposal = {
  task_bundle_id: string
  rubric_id: string
  rubric_name: string
  feedback: string
  strengths: string[]
  improvements: string[]
  action_items: string[]
  evidence_ids: string[]
  confidence: number
}

export type EvaluateFreeTextRequestV1 = {
  contract_version: '1'
  task_bundle_id: string
  question: {
    content: string
    language: SemanticFreeTextConfig['question_language']
  }
  response: { text: string }
  // Optional on the wire, but never nullable. Omit it when the persisted
  // semantic configuration has no reference solution.
  reference_solution?: string
  rubric_schema: FreeTextRubricSchema
}

export type EvaluateFreeTextResponseV1 = {
  contract_version: '1'
  task_bundle_id: string
  evaluator_version: string
  model_version: string
  rubric_assessments: FreeTextRubricAssessment[]
  feedback_proposals?: FreeTextFeedbackProposal[]
}

export type FreeTextEvaluationResult = {
  rubric_assessments: FreeTextRubricAssessment[]
  feedback_proposals?: FreeTextFeedbackProposal[]
}

export type FreeTextRubricFeedback = {
  rubricId: string
  rubricName: string
  proposedLevel: string
  normalizedScore: number
  criterionStatus: FreeTextCorrectnessCategory
  rationale: string
}

export type FreeTextFeedback = {
  rubricId: string
  rubricName: string
  feedback: string
}

export type FreeTextEvaluationFeedback = {
  rubricAssessments: FreeTextRubricFeedback[]
  feedbackProposals: FreeTextFeedback[]
}
