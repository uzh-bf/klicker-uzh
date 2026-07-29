export type AssessmentReportIdentitySource = 'COURSE_INVITATION'

export type AssessmentReportHistogramBin = {
  binStart: number
  binEnd: number
  count: number
}

export type AssessmentReportSnapshotV1 = {
  version: 1
  subject: {
    email: string
    source: AssessmentReportIdentitySource
  }
  course: {
    id: string
    name: string
    displayName: string
  }
  results: {
    basePoints: number
    availableBasePoints: number
    correctnessPoints: number
    availableCorrectnessPoints: number
    bonusPoints: number
    availableBonusPoints: number
    totalPoints: number
    availableTotalPoints: number
  }
  comparison: null | {
    cohortSize: number
    percentile: number
    histogram: AssessmentReportHistogramBin[]
  }
}
