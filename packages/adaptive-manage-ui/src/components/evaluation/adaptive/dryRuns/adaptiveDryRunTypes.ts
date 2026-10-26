import type { QAdaptivePracticeQuizDryRunsQuery } from '@klicker-uzh/graphql/dist/ops'

// Shapes of the Json fields of a dry run (see the host's PrismaAdaptiveDryRun*
// types). The server writes them; the UI only reads them.

export type DryRunWorkspace = NonNullable<
  QAdaptivePracticeQuizDryRunsQuery['adaptivePracticeQuizDryRuns']
>
export type DryRunLevel = DryRunWorkspace['levels'][number]

export type DryRunSpec = {
  students: number
  seed: string
  noiseProbability: number
  trueLevels:
    | { kind: 'FIXED'; levelId: number }
    | { kind: 'EVEN'; fromLevelId: number; toLevelId: number }
  competences: 'SAME_LEVEL' | 'INDEPENDENT'
}

export type DryRunSettings = {
  totalQuestionCap: number
  minQuestionsPerLeaf: number
  classificationZ: number
  classificationToleranceBands: number
}

export type DryRunMetrics = {
  count: number
  exactShare: number
  withinOneShare: number
  bias: number
  meanAbsoluteError: number
  determinedShare: number
}

export type DryRunSummary = {
  studentCount: number
  answerCount: number
  flippedShare: number
  metrics: DryRunMetrics
  competences: Array<DryRunMetrics & { nodeId: number }>
  questions: { min: number; median: number; mean: number; max: number }
  stopReasons: Array<{ reason: string; count: number }>
  confusion: Array<{
    trueLevelId: number
    reported: Array<{ levelId: number | null; count: number }>
  }>
  itemUse: {
    poolSize: number
    usedCount: number
    top: Array<{ poolItemId: number; count: number }>
  }
}

export type DryRunStudent = {
  index: number
  trueLevels: Array<{ nodeId: number; levelId: number }>
  stopReason: string
  questionCount: number
  answers: Array<{
    poolItemId: number
    levelId: number
    correct: boolean
    flipped: boolean
  }>
  overall: {
    theta: number | null
    standardError: number | null
    levelId: number | null
  }
  competences: Array<{
    nodeId: number
    theta: number | null
    standardError: number | null
    levelId: number | null
    classified: boolean
  }>
}

export type DryRun = {
  id: string
  number: number
  publicationId: string
  durationMs: number
  createdAt: string
  spec: DryRunSpec
  effectiveSettings: DryRunSettings
  summary: DryRunSummary
  students?: DryRunStudent[] | null
}

export const CONFIDENCE_OPTIONS = [
  { z: 1.28, percent: 80 },
  { z: 1.645, percent: 90 },
  { z: 1.96, percent: 95 },
] as const

export function confidencePercent(z: number) {
  const match = CONFIDENCE_OPTIONS.find(
    (option) => Math.abs(option.z - z) < 0.01
  )
  return match?.percent ?? null
}

/** "B2.3" → "B2"; labels without a sublevel suffix are their own group. */
export function mainLevelOf(label: string) {
  return label.replace(/\.\d+$/, '')
}

export const percent = (share: number) => `${Math.round(share * 100)}%`

const STOP_REASONS = [
  'CLASSIFIED',
  'ALL_ROOTS_CLASSIFIED',
  'TOTAL_QUESTION_CAP',
  'NODE_QUESTION_CAP',
  'POOL_EXHAUSTED',
  'INSUFFICIENT_DATA',
  'ABANDONED',
] as const
export type DryRunStopReason = (typeof STOP_REASONS)[number]

/** Known engine stop reasons; anything else is shown as insufficient data. */
export function toDryRunStopReason(reason: string): DryRunStopReason {
  return (STOP_REASONS as readonly string[]).includes(reason)
    ? (reason as DryRunStopReason)
    : 'INSUFFICIENT_DATA'
}
