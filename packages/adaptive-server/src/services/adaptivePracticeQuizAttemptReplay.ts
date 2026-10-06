import type {
  AdaptiveRuntimeResponse,
  AdaptiveRuntimeRoutingPoolItem,
} from './adaptivePracticeQuizRuntime.js'

/**
 * Exact estimate replay of one IRT_V1 attempt for the lecturer diagnostics
 * (testing environments only). The engine is stateless, so `decide` on the
 * first k answers returns its own estimates after answer k and the item it
 * would serve next. Comparing that item with the one actually served tells
 * whether the attempt replays exactly under the current engine; when it does
 * not (the engine changed since), the estimates are still the current
 * engine's view of the same answers.
 *
 * The phase is derived on the host: an answer belongs to the coverage phase
 * while its subcompetence had fewer than `minQuestionsPerLeaf` earlier
 * answers, otherwise to the precision phase. The engine does not report it.
 */

export type AdaptiveReplayEstimate = {
  theta: number | null
  standardError: number | null
}

export type AdaptiveReplayDecision = {
  nextPoolItemId: number | null
  nodes: ReadonlyMap<number, AdaptiveReplayEstimate>
}

export type AdaptiveReplayDecide = (
  responses: AdaptiveRuntimeResponse[]
) => Promise<AdaptiveReplayDecision>

export type AdaptiveAnswerReplay = {
  order: number
  phase: 'COVERAGE' | 'PRECISION'
  competenceThetaBefore: number | null
  competenceLevelBefore: string | null
  competenceThetaAfter: number | null
  competenceStandardErrorAfter: number | null
  competenceLevelAfter: string | null
  competenceLowerLevelAfter: string | null
  competenceUpperLevelAfter: string | null
  /** Item level minus the competence level before the answer, in levels. */
  levelDistanceBefore: number | null
  /** Whether the replayed engine would serve this answer's item. */
  replayMatches: boolean
}

export type AdaptiveAttemptReplay = {
  exact: boolean
  answers: AdaptiveAnswerReplay[]
}

export async function replayAdaptiveAttempt({
  responses,
  minQuestionsPerLeaf,
  classificationZ,
  levelAt,
  levelIndexOf,
  decide,
}: {
  responses: Array<
    AdaptiveRuntimeResponse & { poolItem: AdaptiveRuntimeRoutingPoolItem }
  >
  minQuestionsPerLeaf: number
  classificationZ: number
  /** Level of a theta on the quiz scale (clamped). */
  levelAt: (theta: number) => { id: number; label: string } | undefined
  levelIndexOf: (levelId: number) => number | undefined
  decide: AdaptiveReplayDecide
}): Promise<AdaptiveAttemptReplay> {
  const ordered = responses.slice().sort((a, b) => a.order - b.order)
  // decisions[k] is the engine decision after the first k answers. Calls
  // run sequentially: the engine limits concurrent computations per pod.
  const decisions: AdaptiveReplayDecision[] = []
  for (let k = 0; k <= ordered.length; k++) {
    decisions.push(await decide(ordered.slice(0, k)))
  }

  const leafCounts = new Map<number, number>()
  const answers = ordered.map((response, index) => {
    const item = response.poolItem
    const rootId = item.nodePath[0]!
    const before = decisions[index]!.nodes.get(rootId)
    const after = decisions[index + 1]!.nodes.get(rootId)
    const answeredInLeaf = leafCounts.get(item.leafNodeId) ?? 0
    leafCounts.set(item.leafNodeId, answeredInLeaf + 1)

    const levelOf = (theta: number | null | undefined) =>
      typeof theta === 'number' && Number.isFinite(theta)
        ? levelAt(theta)
        : undefined
    const levelBefore = levelOf(before?.theta)
    const levelAfter = levelOf(after?.theta)
    const spread =
      typeof after?.standardError === 'number' &&
      Number.isFinite(after.standardError)
        ? classificationZ * after.standardError
        : null
    const itemIndex = levelIndexOf(item.levelId)
    const beforeIndex = levelBefore ? levelIndexOf(levelBefore.id) : undefined

    return {
      order: response.order,
      phase:
        answeredInLeaf < minQuestionsPerLeaf
          ? ('COVERAGE' as const)
          : ('PRECISION' as const),
      competenceThetaBefore: before?.theta ?? null,
      competenceLevelBefore: levelBefore?.label ?? null,
      competenceThetaAfter: after?.theta ?? null,
      competenceStandardErrorAfter: after?.standardError ?? null,
      competenceLevelAfter: levelAfter?.label ?? null,
      competenceLowerLevelAfter:
        spread !== null && levelAfter
          ? (levelAt(after!.theta! - spread)?.label ?? null)
          : null,
      competenceUpperLevelAfter:
        spread !== null && levelAfter
          ? (levelAt(after!.theta! + spread)?.label ?? null)
          : null,
      levelDistanceBefore:
        itemIndex !== undefined && beforeIndex !== undefined
          ? itemIndex - beforeIndex
          : null,
      replayMatches: decisions[index]!.nextPoolItemId === response.poolItemId,
    }
  })

  return {
    exact: answers.every(({ replayMatches }) => replayMatches),
    answers,
  }
}
