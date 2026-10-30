import { dryRunIsIdealStudent } from './adaptiveDryRunChart'
import type { DryRunLevel, DryRunStudent } from './adaptiveDryRunTypes'

export type DryRunAnswerStep = DryRunStudent['answers'][number] & {
  order: number
  /** What the ideal pattern for the true level predicts. */
  expectedCorrect: boolean
  /** Level after this answer changed compared to the previous answer. */
  levelChange: 'UP' | 'DOWN' | 'SAME' | 'FIRST'
  /**
   * Set while all answers of the competence so far are wrong (below the
   * easiest wrong question) or right (above the hardest right one): the
   * estimate then sits at the end of the scale, and how far the student goes
   * is not known yet. Absent when that question is at the end of the scale.
   */
  bound?: { kind: 'BELOW' | 'ABOVE'; levelId: number }
}

export type DryRunPattern =
  | 'NONE'
  | 'ALL_CORRECT'
  | 'ALL_WRONG'
  | 'CLEAR_BOUNDARY'
  | 'MIXED'

export type DryRunCompetenceTrace = {
  nodeId: number
  trueLevelId: number | null
  reportedLevelId: number | null
  classified: boolean
  steps: DryRunAnswerStep[]
  pattern: DryRunPattern
  /** Hardest correct and easiest wrong question level. */
  highestCorrectLevelId: number | null
  lowestWrongLevelId: number | null
  unexpectedCount: number
  /** Reported minus true level, in levels; null without a result. */
  difference: number | null
  /** Asked question level closest to the true level, and how far off. */
  closestLevelId: number | null
  closestDistance: number | null
  /** Questions within one level of the true level. */
  nearCount: number
  /** The competence's first question came after other competences' ones. */
  startsAfterOthers: boolean
}

/**
 * Explains one simulated competence result from its answers: which answers
 * the true level predicts, which ones the noise flipped, how the level moved,
 * and the answer pattern that bounds the estimate. An estimate is bounded
 * from above only by a wrong answer and from below only by a correct one.
 */
export function traceDryRunCompetence({
  student,
  nodeId,
  levels,
  rootOfItem,
}: {
  student: DryRunStudent
  nodeId: number
  levels: DryRunLevel[]
  rootOfItem: (poolItemId: number) => number | undefined
}): DryRunCompetenceTrace {
  const order = new Map(levels.map(({ id, order }) => [id, order]))
  const trueLevelId =
    student.trueLevels.find((level) => level.nodeId === nodeId)?.levelId ?? null
  const estimate = student.competences.find(
    (competence) => competence.nodeId === nodeId
  )
  const lastOrder = Math.max(...levels.map(({ order }) => order))
  const ideal = dryRunIsIdealStudent(student)
  let previous: number | null | undefined
  let rightSoFar = 0
  let wrongSoFar = 0
  let lowestWrong: number | null = null
  let highestRight: number | null = null
  const steps = student.answers.flatMap((answer, index) => {
    if (rootOfItem(answer.poolItemId) !== nodeId) return []
    const after = answer.after?.levelId ?? answer.after?.roughLevelId ?? null
    const levelOrder = order.get(answer.levelId)!
    if (answer.correct) {
      rightSoFar += 1
      if (highestRight === null || levelOrder > order.get(highestRight)!)
        highestRight = answer.levelId
    } else {
      wrongSoFar += 1
      if (lowestWrong === null || levelOrder < order.get(lowestWrong)!)
        lowestWrong = answer.levelId
    }
    const bound =
      rightSoFar === 0 && lowestWrong !== null && order.get(lowestWrong)! > 0
        ? { kind: 'BELOW' as const, levelId: lowestWrong }
        : wrongSoFar === 0 &&
            highestRight !== null &&
            order.get(highestRight)! < lastOrder
          ? { kind: 'ABOVE' as const, levelId: highestRight }
          : undefined
    const step: DryRunAnswerStep = {
      ...(bound ? { bound } : {}),
      ...answer,
      order: index + 1,
      // Ideal students answer the pattern unless the noise flipped the
      // answer; realistic ones are expected right up to their level.
      expectedCorrect: ideal
        ? answer.correct !== answer.flipped
        : trueLevelId !== null &&
          order.get(answer.levelId)! <= order.get(trueLevelId)!,
      levelChange:
        previous === undefined
          ? 'FIRST'
          : after === null || previous === null || after === previous
            ? 'SAME'
            : order.get(after)! > order.get(previous)!
              ? 'UP'
              : 'DOWN',
    }
    previous = after
    return [step]
  })
  const correct = steps.filter(({ correct }) => correct)
  const wrong = steps.filter(({ correct }) => !correct)
  const pick = (
    rows: DryRunAnswerStep[],
    better: (a: number, b: number) => boolean
  ) =>
    rows.reduce<number | null>(
      (best, { levelId }) =>
        best === null || better(order.get(levelId)!, order.get(best)!)
          ? levelId
          : best,
      null
    )
  const highestCorrectLevelId = pick(correct, (a, b) => a > b)
  const lowestWrongLevelId = pick(wrong, (a, b) => a < b)
  const reportedLevelId = estimate?.levelId ?? null
  const closest =
    trueLevelId === null
      ? null
      : steps.reduce<{ levelId: number; distance: number } | null>(
          (best, { levelId }) => {
            const distance = Math.abs(
              order.get(levelId)! - order.get(trueLevelId)!
            )
            return best === null || distance < best.distance
              ? { levelId, distance }
              : best
          },
          null
        )
  return {
    nodeId,
    trueLevelId,
    reportedLevelId,
    classified: estimate?.classified ?? false,
    steps,
    pattern:
      steps.length === 0
        ? 'NONE'
        : wrong.length === 0
          ? 'ALL_CORRECT'
          : correct.length === 0
            ? 'ALL_WRONG'
            : order.get(highestCorrectLevelId!)! <
                order.get(lowestWrongLevelId!)!
              ? 'CLEAR_BOUNDARY'
              : 'MIXED',
    highestCorrectLevelId,
    lowestWrongLevelId,
    unexpectedCount: steps.filter(({ flipped }) => flipped).length,
    difference:
      reportedLevelId === null || trueLevelId === null
        ? null
        : order.get(reportedLevelId)! - order.get(trueLevelId)!,
    closestLevelId: closest?.levelId ?? null,
    closestDistance: closest?.distance ?? null,
    nearCount:
      trueLevelId === null
        ? 0
        : steps.filter(
            ({ levelId }) =>
              Math.abs(order.get(levelId)! - order.get(trueLevelId)!) <= 1
          ).length,
    startsAfterOthers: (steps[0]?.order ?? 1) > 1,
  }
}
