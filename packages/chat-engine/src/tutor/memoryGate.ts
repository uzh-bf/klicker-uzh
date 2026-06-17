export const TUTOR_MEMORY_CATEGORIES = [
  'current_course_topic',
  'mastered_skills',
  'prerequisite_gaps',
  'repeated_misconceptions',
  'preferred_language',
  'preferred_explanation_depth',
  'unresolved_questions',
] as const

export type TutorMemoryCategory = (typeof TUTOR_MEMORY_CATEGORIES)[number]

export type TutorMemoryGateConfig = {
  enabled: boolean
  privacyApproved: boolean
  retentionDays?: number
  deletionSupported: boolean
  studentTransparencyEnabled: boolean
  embeddingEndpointApproved: boolean
  allowedCategories?: TutorMemoryCategory[]
}

export type TutorMemoryGateDecision = {
  status: 'disabled' | 'blocked' | 'enabled'
  reason: string
  scope: 'participant_chatbot_course'
  allowedCategories: TutorMemoryCategory[]
  missingRequirements: string[]
  retentionDays?: number
}

const DEFAULT_RETENTION_DAYS = 180

export function evaluateTutorMemoryGate(
  config: TutorMemoryGateConfig
): TutorMemoryGateDecision {
  const allowedCategories =
    config.allowedCategories && config.allowedCategories.length > 0
      ? config.allowedCategories
      : [...TUTOR_MEMORY_CATEGORIES]

  if (!config.enabled) {
    return {
      status: 'disabled',
      reason: 'Persistent tutor memory is disabled by feature flag.',
      scope: 'participant_chatbot_course',
      allowedCategories: [],
      missingRequirements: [],
    }
  }

  const missingRequirements = [
    !config.privacyApproved ? 'privacy_approval' : null,
    !config.deletionSupported ? 'participant_deletion_path' : null,
    !config.studentTransparencyEnabled ? 'student_view_delete_ui' : null,
    !config.embeddingEndpointApproved ? 'embedding_endpoint_approval' : null,
  ].filter((value): value is string => value !== null)

  if (missingRequirements.length > 0) {
    return {
      status: 'blocked',
      reason:
        'Persistent tutor memory requested but privacy gate is incomplete.',
      scope: 'participant_chatbot_course',
      allowedCategories: [],
      missingRequirements,
      retentionDays: config.retentionDays ?? DEFAULT_RETENTION_DAYS,
    }
  }

  return {
    status: 'enabled',
    reason: 'Persistent tutor memory passed the configured privacy gate.',
    scope: 'participant_chatbot_course',
    allowedCategories,
    missingRequirements: [],
    retentionDays: config.retentionDays ?? DEFAULT_RETENTION_DAYS,
  }
}

export function composeTutorMemoryInstructionsSuffix(
  decision: TutorMemoryGateDecision
) {
  if (decision.status !== 'enabled') {
    return `\n\nPrivate tutor memory policy:\n- Persistent learner memory is ${decision.status}.\n- Do not claim to remember student facts across turns unless they are visible in the current conversation.\n- Do not write, infer, or request sensitive personal facts.\n`
  }

  return `\n\nPrivate tutor memory policy:\n- Persistent learner memory is enabled only for participant+chatbot+course scope.\n- Allowed memory categories: ${decision.allowedCategories.join(', ')}.\n- Retention days: ${decision.retentionDays}.\n- Do not store sensitive personal facts, psychological profiles, or cross-course observations.\n`
}
