import {
  type LevelMappingRule,
  levelMasteryOfEstimate,
  levelRangeMasteryOfEstimate,
} from '@klicker-uzh/adaptive-contract'
import {
  type DryRunLevel,
  type DryRunStudent,
  type DryRunWorkspace,
  mainLevelOf,
} from './adaptiveDryRunTypes'

export type DryRunMainLevel = {
  label: string
  fromOrder: number
  toOrder: number
}

/** Main levels (A2, B1, ...) as consecutive runs of sublevels, by label. */
export function dryRunMainLevels(levels: DryRunLevel[]): DryRunMainLevel[] {
  const groups: DryRunMainLevel[] = []
  for (const level of levels.slice().sort((a, b) => a.order - b.order)) {
    const label = mainLevelOf(level.label)
    const last = groups.at(-1)
    if (last && last.label === label) last.toOrder = level.order
    else groups.push({ label, fromOrder: level.order, toOrder: level.order })
  }
  return groups
}

export type DryRunMainMastery = {
  label: string
  probability: number
  mastered: boolean
  /** The main level if mastered, else the one below (null below the scale). */
  highestMastered: string | null
}

/** Main-level mastery for one reported competence estimate. */
export function dryRunMainMastery(
  estimate: {
    theta: number | null
    standardError: number | null
    levelId: number | null
  },
  workspace: Pick<DryRunWorkspace, 'levels' | 'scale'>,
  settings: DryRunMasterySettings
): DryRunMainMastery | null {
  const { levels, scale } = workspace
  const reported = levels.find(({ id }) => id === estimate.levelId)
  if (!scale || estimate.theta === null || !reported) return null
  const groups = dryRunMainLevels(levels)
  const index = groups.findIndex(
    (group) =>
      reported.order >= group.fromOrder && reported.order <= group.toOrder
  )
  const group = groups[index]
  if (!group) return null
  const mastery = levelRangeMasteryOfEstimate(
    { theta: estimate.theta, standardError: estimate.standardError },
    levels,
    group,
    { min: scale.thetaMin, max: scale.thetaMax },
    scale.levelMappingRule as LevelMappingRule,
    settings.masteryPoint
  )
  if (!mastery) return null
  const mastered = mastery.probability >= settings.probability
  return {
    label: group.label,
    probability: mastery.probability,
    mastered,
    highestMastered: mastered
      ? group.label
      : (groups[index - 1]?.label ?? null),
  }
}

export type DryRunMasterySettings = {
  /** Where "mastered" begins inside a band, 0-1 (client: 0.7). */
  masteryPoint: number
  /** Probability needed to show a level as mastered, 0-1. */
  probability: number
}

export type DryRunMastery = {
  /** Position of the estimate inside the reported level, 0-1. */
  position: number | null
  /** Probability that the reported level is mastered. */
  probability: number | null
  mastered: boolean
  /** Reported level if mastered, else the level below (null below the scale). */
  highestMasteredLevelId: number | null
}

const NONE: DryRunMastery = {
  position: null,
  probability: null,
  mastered: false,
  highestMasteredLevelId: null,
}

/** Mastery statement for one reported competence estimate. */
export function dryRunMastery(
  estimate: {
    theta: number | null
    standardError: number | null
    levelId: number | null
  },
  workspace: Pick<DryRunWorkspace, 'levels' | 'scale'>,
  settings: DryRunMasterySettings
): DryRunMastery {
  const { levels, scale } = workspace
  const reported = levels.find(({ id }) => id === estimate.levelId)
  if (!scale || estimate.theta === null || !reported) return NONE
  const mastery = levelMasteryOfEstimate(
    { theta: estimate.theta, standardError: estimate.standardError },
    levels,
    { min: scale.thetaMin, max: scale.thetaMax },
    scale.levelMappingRule as LevelMappingRule,
    settings.masteryPoint
  )
  // Only when the estimate maps to the reported level (always, unless the
  // engine reported a level that the plain mapping would not give).
  if (!mastery || mastery.levelOrder !== reported.order) return NONE
  const mastered = mastery.probability >= settings.probability
  const below = levels.find(({ order }) => order === reported.order - 1)
  return {
    position: mastery.position,
    probability: mastery.probability,
    mastered,
    highestMasteredLevelId: mastered ? reported.id : (below?.id ?? null),
  }
}

export type DryRunMasterySummary = {
  count: number
  /** Results that show their level as mastered. */
  masteredShare: number
  /** Of those, the true level is at least the reported one. */
  masteredRightShare: number | null
  /** Highest mastered level (client reading) equals the true level. */
  highestExactShare: number
  highestWithinOneShare: number
  /** The same for main levels; true: the last sublevel of a main level reached. */
  main: {
    masteredShare: number
    masteredRightShare: number | null
    highestExactShare: number
  }
}

/**
 * Over all (student, competence) results of a run, in the client reading: a
 * simulated student with true level k has mastered k but not k + 1.
 */
export function summarizeDryRunMastery(
  students: Pick<DryRunStudent, 'trueLevels' | 'competences'>[],
  workspace: Pick<DryRunWorkspace, 'levels' | 'scale'>,
  settings: DryRunMasterySettings
): DryRunMasterySummary {
  const order = new Map(
    workspace.levels.map((level: DryRunLevel) => [level.id, level.order])
  )
  const lowest = Math.min(...workspace.levels.map((level) => level.order))
  let count = 0
  let mastered = 0
  let masteredRight = 0
  let exact = 0
  let withinOne = 0
  const groups = dryRunMainLevels(workspace.levels)
  const groupIndexOf = (levelOrder: number) =>
    groups.findIndex(
      (group) => levelOrder >= group.fromOrder && levelOrder <= group.toOrder
    )
  let mainMastered = 0
  let mainMasteredRight = 0
  let mainExact = 0
  for (const student of students)
    for (const competence of student.competences) {
      const trueLevelId = student.trueLevels.find(
        ({ nodeId }) => nodeId === competence.nodeId
      )?.levelId
      if (trueLevelId === undefined || competence.levelId === null) continue
      count++
      const statement = dryRunMastery(competence, workspace, settings)
      const trueOrder = order.get(trueLevelId)!
      if (statement.mastered) {
        mastered++
        if (trueOrder >= order.get(competence.levelId)!) masteredRight++
      }
      // Nothing mastered reads as one below the lowest level.
      const highest =
        statement.highestMasteredLevelId === null
          ? lowest - 1
          : order.get(statement.highestMasteredLevelId)!
      if (highest === trueOrder) exact++
      if (Math.abs(highest - trueOrder) <= 1) withinOne++

      // Main levels: a student has mastered the main level of its true
      // sublevel only when that sublevel is the main level's last one.
      const trueGroup = groupIndexOf(trueOrder)
      const trueMainIndex =
        trueOrder === groups[trueGroup]!.toOrder ? trueGroup : trueGroup - 1
      const main = dryRunMainMastery(competence, workspace, settings)
      if (main) {
        const reportedGroup = groups.findIndex(
          (group) => group.label === main.label
        )
        if (main.mastered) {
          mainMastered++
          if (trueMainIndex >= reportedGroup) mainMasteredRight++
        }
        const highestMain =
          main.highestMastered === null
            ? -1
            : groups.findIndex((group) => group.label === main.highestMastered)
        if (highestMain === trueMainIndex) mainExact++
      }
    }
  const share = (value: number) => (count === 0 ? 0 : value / count)
  return {
    count,
    masteredShare: share(mastered),
    masteredRightShare: mastered === 0 ? null : masteredRight / mastered,
    highestExactShare: share(exact),
    highestWithinOneShare: share(withinOne),
    main: {
      masteredShare: share(mainMastered),
      masteredRightShare:
        mainMastered === 0 ? null : mainMasteredRight / mainMastered,
      highestExactShare: share(mainExact),
    },
  }
}
