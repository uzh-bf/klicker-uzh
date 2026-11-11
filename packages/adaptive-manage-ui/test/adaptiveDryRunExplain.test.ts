import { describe, expect, it } from 'vitest'
import { traceDryRunCompetence } from '../src/components/evaluation/adaptive/dryRuns/adaptiveDryRunExplain'

// Six levels, ids 1..6 in order; items 1xx belong to competence 10, 2xx to 20.
const levels = [1, 2, 3, 4, 5, 6].map((id) => ({
  id,
  label: `L${id - 1}`,
  order: id - 1,
  __typename: 'AdaptiveDryRunLevel' as const,
}))
const rootOfItem = (poolItemId: number) => (poolItemId < 200 ? 10 : 20)
const answer = (poolItemId: number, levelId: number, correct: boolean) => ({
  poolItemId,
  levelId,
  correct,
  flipped: false,
})
const student = (answers: ReturnType<typeof answer>[]) =>
  ({
    index: 1,
    trueLevels: [
      { nodeId: 10, levelId: 6 },
      { nodeId: 20, levelId: 1 },
    ],
    stopReason: 'CAP',
    questionCount: answers.length,
    answers,
    overall: { theta: 0, standardError: 1, levelId: 3 },
    competences: [
      {
        nodeId: 10,
        theta: 3,
        standardError: 0.5,
        levelId: 6,
        classified: true,
      },
      {
        nodeId: 20,
        theta: -3,
        standardError: 4,
        levelId: 1,
        classified: false,
      },
    ],
  }) as never

describe('dry-run competence trace', () => {
  // Competence 20 (true L0) starts after competence 10 and only gets wrong
  // answers on questions at L5, L4 and L3.
  const trace = traceDryRunCompetence({
    student: student([
      answer(101, 5, true),
      answer(102, 6, true),
      answer(201, 6, false),
      answer(202, 5, false),
      answer(203, 4, false),
    ]),
    nodeId: 20,
    levels,
    rootOfItem,
  })

  it('marks results bounded only from one side', () => {
    expect(trace.steps.map((step) => step.bound)).toEqual([
      { kind: 'BELOW', levelId: 6 },
      { kind: 'BELOW', levelId: 5 },
      { kind: 'BELOW', levelId: 4 },
    ])
  })

  it('finds the closest question to the true level', () => {
    expect(trace.closestLevelId).toBe(4)
    expect(trace.closestDistance).toBe(3)
    expect(trace.startsAfterOthers).toBe(true)
  })

  it('needs no bound at the end of the scale or after mixed answers', () => {
    const first = traceDryRunCompetence({
      student: student([answer(101, 5, true), answer(102, 6, true)]),
      nodeId: 10,
      levels,
      rootOfItem,
    })
    // L4 right: above L4; L5 (the top) right: nothing above to report
    expect(first.steps.map((step) => step.bound)).toEqual([
      { kind: 'ABOVE', levelId: 5 },
      undefined,
    ])
    expect(first.startsAfterOthers).toBe(false)
    const mixed = traceDryRunCompetence({
      student: student([answer(201, 4, false), answer(202, 2, true)]),
      nodeId: 20,
      levels,
      rootOfItem,
    })
    expect(mixed.steps.map((step) => step.bound)).toEqual([
      { kind: 'BELOW', levelId: 4 },
      undefined,
    ])
  })
})
