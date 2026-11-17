// Pure aggregation of an adaptive dry run (simulated students). Level errors
// are measured in levels of the competence tree (one step = one sublevel).

type DryRunStudent = PrismaJson.PrismaAdaptiveDryRunStudents[number]
type DryRunMetrics = PrismaJson.PrismaAdaptiveDryRunMetrics

const MOST_USED_ITEMS = 10

type Pair = {
  trueOrder: number
  reportedOrder: number | null
  classified: boolean
}

function metricsOf(pairs: Pair[]): DryRunMetrics {
  const reported = pairs.filter(
    (pair): pair is Pair & { reportedOrder: number } =>
      pair.reportedOrder !== null
  )
  const share = (count: number) =>
    pairs.length === 0 ? 0 : count / pairs.length
  const errors = reported.map(
    ({ trueOrder, reportedOrder }) => reportedOrder - trueOrder
  )
  const mean = (values: number[]) =>
    values.length === 0
      ? 0
      : values.reduce((sum, value) => sum + value, 0) / values.length
  return {
    count: pairs.length,
    exactShare: share(errors.filter((error) => error === 0).length),
    withinOneShare: share(
      errors.filter((error) => Math.abs(error) <= 1).length
    ),
    bias: mean(errors),
    meanAbsoluteError: mean(errors.map(Math.abs)),
    determinedShare: share(pairs.filter(({ classified }) => classified).length),
  }
}

type DryRunSubcompetenceSummary = NonNullable<
  PrismaJson.PrismaAdaptiveDryRunSummary['subcompetences']
>[number]

type DryRunPoolItem = {
  id: number
  leafNodeId: number
  additionalLeafNodeIds?: readonly number[]
  levelId: number
}

/**
 * Per subcompetence: answers, coverage and question-pool gaps. A simulated
 * student has one true level per competence, so the leaf deviation is only a
 * rough indicator from the few answers a leaf gets.
 */
export function summarizeAdaptiveDryRunSubcompetences({
  students,
  levels,
  leaves,
  pool,
}: {
  students: PrismaJson.PrismaAdaptiveDryRunStudents
  levels: ReadonlyArray<{ id: number; order: number }>
  leaves: ReadonlyArray<{ nodeId: number; rootId: number }>
  pool: ReadonlyArray<DryRunPoolItem>
}): DryRunSubcompetenceSummary[] {
  const orderById = new Map(levels.map(({ id, order }) => [id, order]))
  const used = new Set(
    students.flatMap(({ answers }) =>
      answers.map(({ poolItemId }) => poolItemId)
    )
  )
  return leaves.map(({ nodeId, rootId }) => {
    const rows = students.flatMap((student) => {
      const row = student.subcompetences?.find((leaf) => leaf.nodeId === nodeId)
      if (!row) return []
      const trueLevelId = student.trueLevels.find(
        (level) => level.nodeId === rootId
      )?.levelId
      return [{ ...row, trueLevelId }]
    })
    const coverage: DryRunSubcompetenceSummary['coverage'] = {
      COVERED: 0,
      SAMPLED_PENDING: 0,
      NOT_SAMPLED: 0,
      OUT_OF_RANGE: 0,
      NONE: 0,
    }
    for (const { coverageStatus } of rows) {
      const key =
        coverageStatus !== null && coverageStatus in coverage
          ? (coverageStatus as keyof typeof coverage)
          : 'NONE'
      coverage[key]++
    }
    const deviations = rows.flatMap(({ levelId, trueLevelId }) =>
      levelId === null || trueLevelId === undefined
        ? []
        : [orderById.get(levelId)! - orderById.get(trueLevelId)!]
    )
    const counts = rows.map(({ responseCount }) => responseCount)
    const items = pool.filter(
      (item) =>
        item.leafNodeId === nodeId ||
        (item.additionalLeafNodeIds ?? []).includes(nodeId)
    )
    return {
      nodeId,
      rootId,
      meanAnswers:
        counts.length === 0
          ? 0
          : counts.reduce((sum, value) => sum + value, 0) / counts.length,
      minAnswers: counts.length === 0 ? 0 : Math.min(...counts),
      coverage,
      estimatedCount: deviations.length,
      meanDeviation:
        deviations.length === 0
          ? null
          : deviations.reduce((sum, value) => sum + value, 0) /
            deviations.length,
      pool: [...levels]
        .sort((a, b) => a.order - b.order)
        .map(({ id }) => {
          const atLevel = items.filter(({ levelId }) => levelId === id)
          return {
            levelId: id,
            count: atLevel.length,
            used: atLevel.filter((item) => used.has(item.id)).length,
          }
        }),
    }
  })
}

export function summarizeAdaptiveDryRun({
  students,
  levels,
  poolSize,
}: {
  students: PrismaJson.PrismaAdaptiveDryRunStudents
  levels: ReadonlyArray<{ id: number; order: number }>
  poolSize: number
}): PrismaJson.PrismaAdaptiveDryRunSummary {
  const orderById = new Map(levels.map(({ id, order }) => [id, order]))
  const pairsByRoot = new Map<number, Pair[]>()
  const confusion = new Map<number, Map<number | null, number>>()
  for (const student of students) {
    const trueByRoot = new Map(
      student.trueLevels.map(({ nodeId, levelId }) => [nodeId, levelId])
    )
    for (const estimate of student.competences) {
      const trueLevelId = trueByRoot.get(estimate.nodeId)
      if (trueLevelId === undefined) continue
      const pairs = pairsByRoot.get(estimate.nodeId) ?? []
      pairs.push({
        trueOrder: orderById.get(trueLevelId)!,
        reportedOrder:
          estimate.levelId === null
            ? null
            : (orderById.get(estimate.levelId) ?? null),
        classified: estimate.classified,
      })
      pairsByRoot.set(estimate.nodeId, pairs)
      const row = confusion.get(trueLevelId) ?? new Map()
      row.set(estimate.levelId, (row.get(estimate.levelId) ?? 0) + 1)
      confusion.set(trueLevelId, row)
    }
  }

  const counts = students.map(({ questionCount }) => questionCount)
  const sorted = counts.slice().sort((a, b) => a - b)
  const median =
    sorted.length === 0
      ? 0
      : sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2]!
        : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2
  const stopReasons = new Map<string, number>()
  const itemCounts = new Map<number, number>()
  let answerCount = 0
  let flippedCount = 0
  for (const student of students) {
    stopReasons.set(
      student.stopReason,
      (stopReasons.get(student.stopReason) ?? 0) + 1
    )
    for (const answer of student.answers) {
      answerCount++
      if (answer.flipped) flippedCount++
      itemCounts.set(
        answer.poolItemId,
        (itemCounts.get(answer.poolItemId) ?? 0) + 1
      )
    }
  }
  const byLevelOrder = (a: number | null, b: number | null) =>
    (a === null ? -1 : (orderById.get(a) ?? -1)) -
    (b === null ? -1 : (orderById.get(b) ?? -1))

  return {
    studentCount: students.length,
    answerCount,
    flippedShare: answerCount === 0 ? 0 : flippedCount / answerCount,
    metrics: metricsOf([...pairsByRoot.values()].flat()),
    competences: [...pairsByRoot].map(([nodeId, pairs]) => ({
      nodeId,
      ...metricsOf(pairs),
    })),
    questions: {
      min: sorted[0] ?? 0,
      median,
      mean:
        counts.length === 0
          ? 0
          : counts.reduce((sum, value) => sum + value, 0) / counts.length,
      max: sorted.at(-1) ?? 0,
    },
    stopReasons: [...stopReasons]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    confusion: [...confusion]
      .sort(([a], [b]) => byLevelOrder(a, b))
      .map(([trueLevelId, reported]) => ({
        trueLevelId,
        reported: [...reported]
          .sort(([a], [b]) => byLevelOrder(a, b))
          .map(([levelId, count]) => ({ levelId, count })),
      })),
    itemUse: {
      poolSize,
      usedCount: itemCounts.size,
      top: [...itemCounts]
        .sort(([idA, a], [idB, b]) => b - a || idA - idB)
        .slice(0, MOST_USED_ITEMS)
        .map(([poolItemId, count]) => ({ poolItemId, count })),
    },
  }
}

/** Compact per-student rows stored with a run. */
export function toAdaptiveDryRunStudent(student: {
  index: number
  trueLevels: Array<{ nodeId: number; levelId: number; theta?: number }>
  answers: DryRunStudent['answers']
  stopReason: string
  questionCount: number
  estimates: {
    overall: {
      theta: number | null
      standardError: number | null
      levelId: number | null
    }
    nodes: Array<{
      nodeKind: string
      nodeId: number | null
      theta: number | null
      standardError: number | null
      levelId: number | null
      stopReason: string | null
      responseCount: number
      coverageStatus?: string | null
    }>
  }
}): DryRunStudent {
  const roots = new Set(student.trueLevels.map(({ nodeId }) => nodeId))
  return {
    index: student.index,
    trueLevels: student.trueLevels,
    stopReason: student.stopReason,
    questionCount: student.questionCount,
    answers: student.answers,
    overall: {
      theta: student.estimates.overall.theta,
      standardError: student.estimates.overall.standardError,
      levelId: student.estimates.overall.levelId,
    },
    competences: student.estimates.nodes
      .filter(
        (node): node is typeof node & { nodeId: number } =>
          node.nodeKind === 'COMPETENCE' &&
          node.nodeId !== null &&
          roots.has(node.nodeId)
      )
      .map((node) => ({
        nodeId: node.nodeId,
        theta: node.theta,
        standardError: node.standardError,
        levelId: node.levelId,
        classified: node.stopReason === 'CLASSIFIED',
      })),
    subcompetences: student.estimates.nodes
      .filter(
        (node): node is typeof node & { nodeId: number } =>
          node.nodeKind === 'SUBCOMPETENCE' && node.nodeId !== null
      )
      .map((node) => ({
        nodeId: node.nodeId,
        responseCount: node.responseCount,
        levelId: node.levelId,
        coverageStatus: node.coverageStatus ?? null,
      })),
  }
}
