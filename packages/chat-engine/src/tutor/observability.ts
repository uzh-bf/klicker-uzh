import type { TutorMemoryGateDecision } from './memoryGate.js'
import type { TutorPolicyState } from './policy.js'
import type {
  TutorOutputVerification,
  TutorVerifierPreflight,
} from './verifier.js'

export type TutorObservabilityInput = {
  chatbotId: string
  courseId?: string | null
  selectedMode: string
  modelId: string
  state?: TutorPolicyState | null
  verifierPreflight?: TutorVerifierPreflight | null
  outputVerification?: TutorOutputVerification | null
  memoryGate?: TutorMemoryGateDecision | null
  retrievedEvidenceIds?: string[]
}

export function buildTutorObservabilityAttributes({
  chatbotId,
  courseId,
  selectedMode,
  modelId,
  state,
  verifierPreflight,
  outputVerification,
  memoryGate,
  retrievedEvidenceIds,
}: TutorObservabilityInput) {
  return {
    'tutor.chatbot_id': chatbotId,
    'tutor.course_id': courseId ?? 'none',
    'tutor.mode': selectedMode,
    'tutor.model_id': modelId,
    'tutor.skill_pack_version': state?.skillPackVersion ?? selectedMode,
    'tutor.current_skill': state?.currentSkill ?? 'unknown',
    'tutor.student_state': state?.studentState ?? 'unknown',
    'tutor.move': state?.allowedMove ?? 'unknown',
    'tutor.hint_depth': state?.hintDepth ?? 0,
    'tutor.misconception_label': state?.misconception?.label ?? 'none',
    'tutor.retrieval_needed': state?.retrievalNeeded === true,
    'tutor.retrieved_evidence_count': retrievedEvidenceIds?.length ?? 0,
    'tutor.leakage_allowed': state?.leakageAllowed === true,
    'tutor.preflight_risk': verifierPreflight?.risk ?? 'unknown',
    'tutor.preflight_failures': verifierPreflight?.failures.join(',') ?? '',
    'tutor.output_verifier_passed': outputVerification?.passed ?? null,
    'tutor.output_verifier_failures':
      outputVerification?.failures.join(',') ?? '',
    'tutor.memory_status': memoryGate?.status ?? 'disabled',
  }
}
