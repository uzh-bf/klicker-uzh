export type CorrectionScope = 'instance' | 'quiz'

export type ParticipantScope = 'single' | 'participating' | 'course'

export interface PointCorrectionsFormValues {
  scopeType: CorrectionScope | ''
  quizId: string
  instanceId: string
  participantScope: ParticipantScope | ''
  participantId: string
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

export interface PointCorrectionsQuizInstance {
  id: string
  name: string
}

export interface PointCorrectionsCorrectionHistoryItem {
  id: string
  description: string
  appliedAt: string
}

export interface PointCorrectionsQuiz {
  id: string
  name: string
  instances: PointCorrectionsQuizInstance[]
  previousCorrections: PointCorrectionsCorrectionHistoryItem[]
}

export interface PointCorrectionsParticipant {
  id: string
  name: string
}
