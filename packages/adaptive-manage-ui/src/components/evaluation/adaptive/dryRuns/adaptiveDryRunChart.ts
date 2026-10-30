import {
  type LevelMappingRule,
  levelMasteryOf,
  mapLevelsToTheta,
  normalCdf,
} from '@klicker-uzh/adaptive-contract'
import type {
  DryRun,
  DryRunLevel,
  DryRunStudent,
  DryRunSummary,
  DryRunWorkspace,
} from './adaptiveDryRunTypes'
import { dryRunBandShift, dryRunMasteryFrom } from './adaptiveDryRunTypes'

// Ability scale of a run for the charts: where each level's questions sit,
// the bands the run reports with ("level reached from"), and where a
// simulated student truly is. A true level means what the run reports as
// that level, so true and reported levels share one set of bands.

export type DryRunChartLevel = {
  id: number
  label: string
  order: number
  /** Position of the level's questions. */
  theta: number
  /** Reporting band of the run, the open ends closed with one spacing. */
  lower: number
  upper: number
  /** True abilities of this level: its band, the open ends closed. */
  trueLower: number
  trueUpper: number
}

export type DryRunChartScale = {
  min: number
  max: number
  levels: DryRunChartLevel[]
}

export function dryRunChartScale(
  workspace: Pick<DryRunWorkspace, 'levels' | 'scale'>,
  run: Pick<DryRun, 'effectiveSettings'>
): DryRunChartScale | null {
  const { scale } = workspace
  if (!scale || workspace.levels.length < 2) return null
  const ordered = workspace.levels.slice().sort((a, b) => a.order - b.order)
  const range = { min: scale.thetaMin, max: scale.thetaMax }
  const rule = scale.levelMappingRule as LevelMappingRule
  const bands = mapLevelsToTheta(
    ordered,
    range,
    rule,
    dryRunBandShift(run.effectiveSettings)
  )
  const spacing = bands[1]!.theta - bands[0]!.theta
  const levels = bands.map((band, index) => {
    // As the engine closes the open outer bands for realistic students.
    const trueLower = Number.isFinite(band.lowerBound)
      ? band.lowerBound
      : band.upperBound - spacing
    const trueUpper = Number.isFinite(band.upperBound)
      ? band.upperBound
      : trueLower + spacing
    return {
      id: ordered[index]!.id,
      label: ordered[index]!.label,
      order: ordered[index]!.order,
      theta: band.theta,
      // Every level gets the same width, the outer ones included.
      lower: trueLower,
      upper: trueUpper,
      trueLower,
      trueUpper,
    }
  })
  return {
    // Covers every estimate (clamped to the range) and every level.
    min: Math.min(levels[0]!.lower, range.min),
    max: Math.max(levels.at(-1)!.upper, range.max),
    levels,
  }
}

/**
 * True ability of a student in a competence: the simulated one for realistic
 * students, otherwise the middle of the true level (spread a little by
 * `jitter`, -0.5..0.5, so equal students stay visible).
 */
export function dryRunTrueTheta(
  scale: DryRunChartScale,
  truth: { levelId: number; theta?: number },
  jitter = 0
) {
  if (typeof truth.theta === 'number') return truth.theta
  const level = scale.levels.find(({ id }) => id === truth.levelId)
  if (!level) return null
  const width = level.trueUpper - level.trueLower
  return level.trueLower + width * (0.5 + 0.6 * jitter)
}

/** Deterministic spread per student and competence, -0.5..0.5. */
export function dryRunJitter(index: number, nodeId: number) {
  return (((index * 37 + nodeId * 11) % 100) + 0.5) / 100 - 0.5
}

export type DryRunChartPoint = {
  index: number
  nodeId: number
  trueLevelId: number
  reportedLevelId: number
  trueTheta: number
  theta: number
  /** Reported minus true level, in level steps. */
  difference: number
}

/** One point per student and competence with a reported level. */
export function dryRunChartPoints(
  students: DryRunStudent[],
  levels: DryRunLevel[],
  scale: DryRunChartScale
): DryRunChartPoint[] {
  const order = new Map(levels.map((level) => [level.id, level.order]))
  return students.flatMap((student) =>
    student.competences.flatMap((competence) => {
      const truth = student.trueLevels.find(
        ({ nodeId }) => nodeId === competence.nodeId
      )
      if (!truth || competence.theta === null || competence.levelId === null)
        return []
      const trueTheta = dryRunTrueTheta(
        scale,
        truth,
        dryRunJitter(student.index, competence.nodeId)
      )
      if (trueTheta === null) return []
      return [
        {
          index: student.index,
          nodeId: competence.nodeId,
          trueLevelId: truth.levelId,
          reportedLevelId: competence.levelId,
          trueTheta,
          theta: competence.theta,
          difference:
            (order.get(competence.levelId) ?? 0) -
            (order.get(truth.levelId) ?? 0),
        },
      ]
    })
  )
}

export type DryRunLevelSplit = {
  /** Whole percentages that add up to 100. */
  lower: number
  exactly: number
  higher: number
  /** The neighbouring levels that most of `lower` and `higher` falls into. */
  belowLevelId: number | null
  aboveLevelId: number | null
}

/**
 * How likely the ability is below, inside or above the reported level: the
 * shares of a normal curve around the estimate (width: its standard error)
 * that fall below, inside and above the level's band. The lowest level has
 * nothing below, the highest nothing above.
 */
export function dryRunLevelSplit(
  scale: DryRunChartScale,
  estimate: {
    theta: number | null
    standardError: number | null
    levelId: number | null
  }
): DryRunLevelSplit | null {
  const index = scale.levels.findIndex(({ id }) => id === estimate.levelId)
  if (index === -1 || estimate.theta === null) return null
  const level = scale.levels[index]!
  const share = (edge: number) =>
    estimate.standardError && estimate.standardError > 0
      ? normalCdf((edge - estimate.theta!) / estimate.standardError)
      : estimate.theta! < edge
        ? 1
        : 0
  const below = index === 0 ? 0 : share(level.lower)
  const above = index === scale.levels.length - 1 ? 0 : 1 - share(level.upper)
  const lower = Math.round(below * 100)
  const higher = Math.round(above * 100)
  return {
    lower,
    higher,
    exactly: 100 - lower - higher,
    belowLevelId: scale.levels[index - 1]?.id ?? null,
    aboveLevelId: scale.levels[index + 1]?.id ?? null,
  }
}

/**
 * Answers against the ideal pattern (right up to the true level, wrong
 * above): the flips of ideal students, the surprises of realistic ones.
 */
export function dryRunUnexpectedAnswers(
  student: DryRunStudent,
  levels: DryRunLevel[],
  rootOfItem: (poolItemId: number) => number | undefined
) {
  const order = new Map(levels.map((level) => [level.id, level.order]))
  const truth = new Map(
    student.trueLevels.map(({ nodeId, levelId }) => [
      nodeId,
      order.get(levelId),
    ])
  )
  // Ideal students: the engine marks every answer against the pattern (also
  // the alternating own level of idealOwnLevel HALF) as flipped.
  if (dryRunIsIdealStudent(student))
    return student.answers.filter(({ flipped }) => flipped).length
  return student.answers.filter(({ poolItemId, levelId, correct }) => {
    const trueOrder = truth.get(rootOfItem(poolItemId) ?? -1)
    if (trueOrder === undefined) return false
    return correct !== (order.get(levelId) ?? 0) <= trueOrder
  }).length
}

/**
 * True × reported level counts of one competence, in the shape of the run
 * summary's (which pools all competences).
 */
export function dryRunConfusion(
  students: DryRunStudent[],
  nodeId: number
): DryRunSummary['confusion'] {
  const rows = new Map<number, Map<number | null, number>>()
  for (const student of students) {
    const truth = student.trueLevels.find((level) => level.nodeId === nodeId)
    const estimate = student.competences.find(
      (competence) => competence.nodeId === nodeId
    )
    if (!truth || !estimate) continue
    const row = rows.get(truth.levelId) ?? new Map<number | null, number>()
    row.set(estimate.levelId, (row.get(estimate.levelId) ?? 0) + 1)
    rows.set(truth.levelId, row)
  }
  return [...rows].map(([trueLevelId, reported]) => ({
    trueLevelId,
    reported: [...reported].map(([levelId, count]) => ({ levelId, count })),
  }))
}

/** The level whose band holds `theta`; the outer bands are open. */
export function dryRunLevelAt(scale: DryRunChartScale, theta: number) {
  return (
    scale.levels.find((level) => theta < level.upper) ?? scale.levels.at(-1)!
  )
}

// Means closer than this to a level border sit on it: either neighbour is a
// true overall level (floating point noise must not decide).
const BORDER_TOLERANCE = 1e-6

/**
 * True overall ability of a student: the mean of the true competence
 * abilities, as the engine's overall estimate is the mean of the competence
 * estimates. Its level is the band that mean falls into. A mean on a border
 * (e.g. two competences in adjacent levels) belongs to both neighbours; the
 * one nearer the reported level counts, so a tie is never an error.
 */
export function dryRunTrueOverall(
  scale: DryRunChartScale,
  student: DryRunStudent
) {
  const thetas = student.trueLevels.map((truth) =>
    dryRunTrueTheta(scale, truth)
  )
  if (thetas.length === 0 || thetas.some((theta) => theta === null)) return null
  const theta =
    (thetas as number[]).reduce((sum, value) => sum + value, 0) / thetas.length
  const index = scale.levels.indexOf(dryRunLevelAt(scale, theta))
  const below = scale.levels[index - 1]
  const onBorder =
    below !== undefined &&
    Math.abs(theta - scale.levels[index]!.lower) < BORDER_TOLERANCE
  const reported = scale.levels.findIndex(
    ({ id }) => id === student.overall.levelId
  )
  const level =
    onBorder && reported !== -1 && reported < index
      ? below
      : scale.levels[index]!
  return { theta, level }
}

/** One point per student: true overall ability against the overall estimate. */
export function dryRunOverallPoints(
  students: DryRunStudent[],
  scale: DryRunChartScale
): DryRunChartPoint[] {
  return students.flatMap((student) => {
    const truth = dryRunTrueOverall(scale, student)
    const { theta, levelId } = student.overall
    if (!truth || theta === null || levelId === null) return []
    const reported = scale.levels.findIndex(({ id }) => id === levelId)
    const actual = scale.levels.indexOf(truth.level)
    // Ideal students share the middle of their levels: spread them inside
    // their true level so equal students stay visible.
    const ideal = student.trueLevels.every(
      (level) => typeof level.theta !== 'number'
    )
    const width = truth.level.trueUpper - truth.level.trueLower
    const trueTheta = ideal
      ? Math.min(
          Math.max(
            truth.theta + width * 0.6 * dryRunJitter(student.index, 0),
            truth.level.trueLower
          ),
          truth.level.trueUpper
        )
      : truth.theta
    return [
      {
        index: student.index,
        nodeId: 0,
        trueLevelId: truth.level.id,
        reportedLevelId: levelId,
        trueTheta,
        theta,
        difference: reported - actual,
      },
    ]
  })
}

/** True × reported overall level counts, in the shape of the run summary's. */
export function dryRunOverallConfusion(
  students: DryRunStudent[],
  scale: DryRunChartScale
): DryRunSummary['confusion'] {
  const rows = new Map<number, Map<number | null, number>>()
  for (const student of students) {
    const truth = dryRunTrueOverall(scale, student)
    if (!truth) continue
    const { levelId } = student.overall
    const row = rows.get(truth.level.id) ?? new Map<number | null, number>()
    row.set(levelId, (row.get(levelId) ?? 0) + 1)
    rows.set(truth.level.id, row)
  }
  return [...rows].map(([trueLevelId, reported]) => ({
    trueLevelId,
    reported: [...reported].map(([levelId, count]) => ({ levelId, count })),
  }))
}

/** What the true-vs-reported view shows: the overall level, all competences pooled, or one competence. */
export type DryRunLevelsSelection = 'OVERALL' | 'POOLED' | number

export type DryRunAgreement = {
  total: number
  exact: number
  oneOff: number
  moreOff: number
  /** Results without a reported level. */
  notReported: number
}

/** How many results of a true × reported table are right, one off or further off. */
export function dryRunAgreement(
  confusion: DryRunSummary['confusion'],
  levels: DryRunLevel[]
): DryRunAgreement {
  const order = new Map(levels.map((level) => [level.id, level.order]))
  const agreement = {
    total: 0,
    exact: 0,
    oneOff: 0,
    moreOff: 0,
    notReported: 0,
  }
  for (const { trueLevelId, reported } of confusion) {
    for (const { levelId, count } of reported) {
      agreement.total += count
      if (levelId === null) {
        agreement.notReported += count
        continue
      }
      const difference = Math.abs(
        (order.get(levelId) ?? 0) - (order.get(trueLevelId) ?? 0)
      )
      if (difference === 0) agreement.exact += count
      else if (difference === 1) agreement.oneOff += count
      else agreement.moreOff += count
    }
  }
  return agreement
}

/**
 * Whether a run reports a competence level as mastered (at or above the run's
 * mastery mark of its plain band), and where that mark lies, for drawing.
 * Null without a reported level, with the mark off or in runs that shifted
 * the bands instead.
 */
export function dryRunMastery(
  workspace: Pick<DryRunWorkspace, 'levels' | 'scale'>,
  run: Pick<DryRun, 'effectiveSettings'>,
  estimate: { theta: number | null; levelId: number | null }
): { mastered: boolean; markTheta: number; share: number } | null {
  const masteryFrom = dryRunMasteryFrom(run.effectiveSettings)
  const { scale } = workspace
  const level = workspace.levels.find(({ id }) => id === estimate.levelId)
  if (!scale || !level || estimate.theta === null || !(masteryFrom > 0))
    return null
  const range = { min: scale.thetaMin, max: scale.thetaMax }
  const rule = scale.levelMappingRule as LevelMappingRule
  const mastery = levelMasteryOf({
    theta: estimate.theta,
    levels: workspace.levels,
    range,
    mappingRule: rule,
    masteryFrom,
  })
  const band = mapLevelsToTheta(workspace.levels, range, rule).find(
    ({ order }) => order === level.order
  )
  if (!mastery || mastery.order !== level.order || !band) return null
  const lower = Number.isFinite(band.lowerBound) ? band.lowerBound : range.min
  const upper = Number.isFinite(band.upperBound) ? band.upperBound : range.max
  return {
    mastered: mastery.mastered === true,
    markTheta: lower + masteryFrom * (upper - lower),
    share: mastery.share,
  }
}

/** Ideal-pattern students carry no true ability; realistic ones do. */
export function dryRunIsIdealStudent(
  student: Pick<DryRunStudent, 'trueLevels'>
) {
  return student.trueLevels.every(({ theta }) => typeof theta !== 'number')
}

/**
 * Chance (whole percent) that the ability lies within one level of the
 * reported level: the share of a normal curve around the estimate (width:
 * its standard error) between the bands below and above it. Null without a
 * reported level.
 */
export function dryRunWithinOneChance(
  scale: DryRunChartScale,
  estimate: {
    theta: number | null
    standardError: number | null
    levelId: number | null
  }
) {
  const index = scale.levels.findIndex(({ id }) => id === estimate.levelId)
  if (index === -1 || estimate.theta === null) return null
  const below = scale.levels[index - 1]
  const above = scale.levels[index + 1]
  const share = (edge: number) =>
    estimate.standardError && estimate.standardError > 0
      ? normalCdf((edge - estimate.theta!) / estimate.standardError)
      : estimate.theta! < edge
        ? 1
        : 0
  const lower = below ? share(below.lower) : 0
  const upper = above ? share(above.upper) : 1
  return Math.round((upper - lower) * 100)
}
