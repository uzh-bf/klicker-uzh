import type { DryRunLevel, DryRunStudent } from './adaptiveDryRunTypes'

export type DryRunAnswerStep = DryRunStudent['answers'][number] & {
  order: number
  /** What the ideal pattern for the true level predicts. */
  expectedCorrect: boolean
  /** Level after this answer changed compared to the previous answer. */
  levelChange: 'UP' | 'DOWN' | 'SAME' | 'FIRST'
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
  let previous: number | null | undefined
  const steps = student.answers.flatMap((answer, index) => {
    if (rootOfItem(answer.poolItemId) !== nodeId) return []
    const after = answer.after?.levelId ?? answer.after?.roughLevelId ?? null
    const step: DryRunAnswerStep = {
      ...answer,
      order: index + 1,
      expectedCorrect:
        trueLevelId !== null &&
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
  }
}
