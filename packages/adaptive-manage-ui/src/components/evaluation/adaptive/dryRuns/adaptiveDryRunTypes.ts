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
  /** Absent for the ideal pattern (and in older runs). */
  answerModel?: 'REALISTIC'
  /** Ideal pattern: own level answered right and wrong in turn. */
  idealOwnLevel?: 'HALF'
}

export type DryRunAnswerModel = 'IDEAL' | 'REALISTIC'

export type DryRunSettings = {
  totalQuestionCap: number
  minQuestionsPerLeaf: number
  classificationZ: number
  classificationToleranceBands: number
  /** Absent in runs stored before the setting (= 0). */
  levelReachedFrom?: number
  /**
   * True when `levelReachedFrom` is the mastery mark only; absent in earlier
   * runs, where it shifted the level bands.
   */
  masteryMark?: boolean
}

/** Band shift a run's levels were reported with (0 since the mastery mark). */
export function dryRunBandShift(settings: DryRunSettings) {
  return settings.masteryMark ? 0 : (settings.levelReachedFrom ?? 0)
}

/** Mastery mark of a run; 0 (off) for runs that shifted the bands instead. */
export function dryRunMasteryFrom(settings: DryRunSettings) {
  return settings.masteryMark ? (settings.levelReachedFrom ?? 0) : 0
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
  /** Absent in runs stored before the subcompetence breakdown. */
  subcompetences?: DryRunSubcompetenceSummary[]
  /** Levels and range the run used; absent in older runs. */
  scale?: {
    thetaMin: number
    thetaMax: number
    levelMappingRule: string
    levels: Array<{ id: number; label: string; order: number }>
  }
}

export type DryRunSubcompetenceSummary = {
  nodeId: number
  rootId: number
  meanAnswers: number
  minAnswers: number
  coverage: {
    COVERED: number
    SAMPLED_PENDING: number
    NOT_SAMPLED: number
    OUT_OF_RANGE: number
    NONE: number
  }
  estimatedCount: number
  meanDeviation: number | null
  pool: Array<{ levelId: number; count: number; used: number }>
}

export type DryRunStudent = {
  index: number
  /** `theta`: true ability of realistic students. */
  trueLevels: Array<{ nodeId: number; levelId: number; theta?: number }>
  stopReason: string
  questionCount: number
  answers: Array<{
    poolItemId: number
    levelId: number
    correct: boolean
    flipped: boolean
    after?: {
      theta: number | null
      standardError: number | null
      levelId: number | null
      /** Level the estimate maps to before a level is reported. */
      roughLevelId?: number | null
    }
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
  subcompetences?: Array<{
    nodeId: number
    responseCount: number
    levelId: number | null
    coverageStatus: string | null
  }>
}

export type DryRun = {
  id: string
  number: number
  publicationId: string
  engineRevision?: string | null
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

/**
 * The workspace as the run saw it: its own levels and range when stored, so a
 * run made before a republish is still drawn and labelled as it ran.
 */
export function dryRunWorkspaceOf(
  workspace: DryRunWorkspace,
  run: Pick<DryRun, 'summary'>
): DryRunWorkspace {
  const scale = run.summary.scale
  if (!scale) return workspace
  const { levels, ...range } = scale
  return {
    ...workspace,
    levels: levels.map((level) => ({
      ...level,
      __typename: 'AdaptiveDryRunLevel' as const,
    })),
    scale: { ...range, __typename: 'AdaptiveDryRunScale' as const },
  }
}
