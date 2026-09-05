export type AssessmentReportIdentitySource =
  | 'COURSE_INVITATION'
  | 'SWITCH_EDUID'

export type AssessmentReportHistogramBin = {
  binStart: number
  binEnd: number
  count: number
}

export type AssessmentReportSnapshotV1 = {
  version: 1
  subject: {
    email: string
    source: 'COURSE_INVITATION'
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

export type AssessmentReportSnapshotV2 = {
  version: 2
  subject: {
    email: string
    givenName: string | null
    surname: string | null
    matriculationNumber: string | null
    source: 'SWITCH_EDUID'
  }
  course: AssessmentReportSnapshotV1['course']
  results: AssessmentReportSnapshotV1['results']
  comparison: AssessmentReportSnapshotV1['comparison']
}

export type AssessmentReportSnapshot =
  | AssessmentReportSnapshotV1
  | AssessmentReportSnapshotV2

export type AssessmentReportPublicSnapshot = {
  version: AssessmentReportSnapshot['version']
  subject: {
    name: string | null
    source: AssessmentReportIdentitySource
  }
  course: AssessmentReportSnapshot['course']
  results: AssessmentReportSnapshot['results']
  comparison: AssessmentReportSnapshot['comparison']
}
