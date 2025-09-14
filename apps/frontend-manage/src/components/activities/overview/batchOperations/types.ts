export type ActivityBatchOperationActions = {
  multiplier?: string
  course?: {
    id?: string
    isGamificationEnabled: boolean
    isAssessmentEnabled: boolean
    isGroupCreationEnabled: boolean
    startDate: Date | null
    endDate: Date | null
    groupDeadlineDate: Date | null
  }
  liveQuizPoints?: {
    basePoints: number
    correctnessPoints: number
    bonusPoints: number
    bonusTime: number
  }
}

export const INITIAL_ACTIVITY_BATCH_OPERATIONS: ActivityBatchOperationActions =
  {
    multiplier: undefined,
    course: undefined,
    liveQuizPoints: undefined,
  }
