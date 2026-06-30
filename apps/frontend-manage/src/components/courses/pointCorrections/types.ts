import type { PointCorrectionType } from '../../../lib/assessmentResultsTypes'

export type CorrectionScope = 'instance' | 'quiz'

export interface PointCorrectionsFormValues {
  scopeType: CorrectionScope | ''
  quizId: string
  instanceId: string
  participantScope: PointCorrectionType | ''
  participantId: string
  participantIds: string[]
  lecturerReason: string
  studentReason: string
  useSameReasonForStudents: boolean
  adjustments: {
    baseAward: boolean
    baseDeduct: boolean
    correctnessAward: boolean
    correctnessDeduct: boolean
    bonusAward: boolean
    bonusDeduct: boolean
  }
}
