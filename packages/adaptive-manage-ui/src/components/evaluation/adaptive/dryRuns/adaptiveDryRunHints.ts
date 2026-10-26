import {
  isNextLevelWithinReach,
  type LevelMappingRule,
  levelPositionOfTheta,
} from '@klicker-uzh/adaptive-contract'
import type {
  DryRunLevel,
  DryRunStudent,
  DryRunWorkspace,
} from './adaptiveDryRunTypes'

export type DryRunHint = {
  /** Position of the estimate inside the reported level, 0-1. */
  position: number | null
  /** The next level, when the estimate reaches the threshold. */
  nextLevelId: number | null
}

/** "Next level within reach" for one reported competence estimate. */
export function dryRunHint(
  estimate: { theta: number | null; levelId: number | null },
  workspace: Pick<DryRunWorkspace, 'levels' | 'scale'>,
  threshold: number
): DryRunHint {
  const levels = workspace.levels
  const scale = workspace.scale
  const reported = levels.find(({ id }) => id === estimate.levelId)
  if (!scale || estimate.theta === null || !reported)
    return { position: null, nextLevelId: null }
  const position = levelPositionOfTheta(
    estimate.theta,
    levels,
    { min: scale.thetaMin, max: scale.thetaMax },
    scale.levelMappingRule as LevelMappingRule
  )
  // Only when the estimate maps to the reported level (always, unless the
  // engine reported a level that the plain mapping would not give).
  if (!position || position.levelOrder !== reported.order)
    return { position: null, nextLevelId: null }
  const next = levels.find(({ order }) => order === reported.order + 1)
  return {
    position: position.position,
    nextLevelId:
      next && isNextLevelWithinReach(position, threshold) ? next.id : null,
  }
}

export type DryRunHintSummary = {
  count: number
  /** Results that show the hint. */
  hintShare: number
  /** Reported level equals the true level ("level reached"). */
  reachedShare: number
  /** Hinted level if shown, else the reported level, equals true + 1. */
  nextLevelShare: number
  /** The true level is the reported or the hinted level. */
  coveredShare: number
}

/** Hint numbers over all (student, competence) results of a run. */
export function summarizeDryRunHints(
  students: Pick<DryRunStudent, 'trueLevels' | 'competences'>[],
  workspace: Pick<DryRunWorkspace, 'levels' | 'scale'>,
  threshold: number
): DryRunHintSummary {
  const order = new Map(
    workspace.levels.map((level: DryRunLevel) => [level.id, level.order])
  )
  let count = 0
  let hinted = 0
  let reached = 0
  let nextLevel = 0
  let covered = 0
  for (const student of students)
    for (const competence of student.competences) {
      const trueLevelId = student.trueLevels.find(
        ({ nodeId }) => nodeId === competence.nodeId
      )?.levelId
      if (trueLevelId === undefined || competence.levelId === null) continue
      count++
      const hint = dryRunHint(competence, workspace, threshold)
      const trueOrder = order.get(trueLevelId)!
      const reportedOrder = order.get(competence.levelId)!
      const suggestedOrder =
        hint.nextLevelId === null ? reportedOrder : reportedOrder + 1
      if (hint.nextLevelId !== null) hinted++
      if (reportedOrder === trueOrder) reached++
      if (suggestedOrder === trueOrder + 1) nextLevel++
      if (
        reportedOrder === trueOrder ||
        (hint.nextLevelId !== null && reportedOrder + 1 === trueOrder)
      )
        covered++
    }
  const share = (value: number) => (count === 0 ? 0 : value / count)
  return {
    count,
    hintShare: share(hinted),
    reachedShare: share(reached),
    nextLevelShare: share(nextLevel),
    coveredShare: share(covered),
  }
}
