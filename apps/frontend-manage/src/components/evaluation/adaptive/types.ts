import { QAdaptivePracticeQuizCohortResultsQuery } from '@klicker-uzh/graphql/dist/ops'

export type AdaptiveCohortResultsData = NonNullable<
  QAdaptivePracticeQuizCohortResultsQuery['adaptivePracticeQuizCohortResults']
>

export type AdaptiveCohortAttemptSummary =
  AdaptiveCohortResultsData['attemptSummary']

export type AdaptiveCohortDistribution =
  AdaptiveCohortResultsData['distributions'][number]

export type AdaptivePilotMetrics = AdaptiveCohortResultsData['pilotMetrics']
export type AdaptiveItemDiagnostic =
  AdaptiveCohortResultsData['itemDiagnostics'][number]
