import {
  type LevelMappingRule,
  levelMasteryOfEstimate,
} from '@klicker-uzh/adaptive-contract'
import type {
  DryRunLevel,
  DryRunStudent,
  DryRunWorkspace,
} from './adaptiveDryRunTypes'

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
    }
  const share = (value: number) => (count === 0 ? 0 : value / count)
  return {
    count,
    masteredShare: share(mastered),
    masteredRightShare: mastered === 0 ? null : masteredRight / mastered,
    highestExactShare: share(exact),
    highestWithinOneShare: share(withinOne),
  }
}
