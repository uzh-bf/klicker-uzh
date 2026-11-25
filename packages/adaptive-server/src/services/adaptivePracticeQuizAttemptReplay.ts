import type {
  AdaptiveRuntimeResponse,
  AdaptiveRuntimeRoutingPoolItem,
} from './adaptivePracticeQuizRuntime.js'

/**
 * Estimate replay of one IRT_V1 attempt for the lecturer diagnostics
 * backfill (testing environments only). The engine is stateless, so `decide`
 * on the first k answers returns its own estimates after answer k and the
 * item it would serve next. Per answer this yields the competence (root)
 * estimate before and after it, the values new answers store directly.
 * `replayMatches` tells whether the current engine would have served the
 * same item; when it would not, the engine changed since the attempt and the
 * estimates are the current engine's view of the same answers.
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
  competenceBefore: AdaptiveReplayEstimate
  competenceAfter: AdaptiveReplayEstimate
  replayMatches: boolean
}

export async function replayAdaptiveAttempt({
  responses,
  decide,
}: {
  responses: Array<
    AdaptiveRuntimeResponse & { poolItem: AdaptiveRuntimeRoutingPoolItem }
  >
  decide: AdaptiveReplayDecide
}): Promise<{ exact: boolean; answers: AdaptiveAnswerReplay[] }> {
  const ordered = responses.slice().sort((a, b) => a.order - b.order)
  // decisions[k] is the engine decision after the first k answers. Calls
  // run sequentially: the engine limits concurrent computations per pod.
  const decisions: AdaptiveReplayDecision[] = []
  for (let k = 0; k <= ordered.length; k++) {
    decisions.push(await decide(ordered.slice(0, k)))
  }
  const empty = { theta: null, standardError: null }
  const answers = ordered.map((response, index) => {
    const rootId = response.poolItem.nodePath[0]!
    return {
      order: response.order,
      competenceBefore: decisions[index]!.nodes.get(rootId) ?? empty,
      competenceAfter: decisions[index + 1]!.nodes.get(rootId) ?? empty,
      replayMatches: decisions[index]!.nextPoolItemId === response.poolItemId,
    }
  })
  return {
    exact: answers.every(({ replayMatches }) => replayMatches),
    answers,
  }
}
