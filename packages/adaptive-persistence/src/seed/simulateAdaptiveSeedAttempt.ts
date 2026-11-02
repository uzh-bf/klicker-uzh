import type {
  createAdaptiveClient,
  DecisionResponse,
  EstimateResponse,
} from '@klicker-uzh/adaptive-client'
import type {
  AdaptiveRuntimeEstimate,
  AdaptiveRuntimeNode,
  AdaptiveRuntimeSettings,
} from '@klicker-uzh/adaptive-contract'

export type SeedPoolItem = {
  id: number
  leafNodeId: number
  nodePath: number[]
  levelId: number
  levelOrder: number
  discrimination: number
  difficulty: number
  guessing: number
  elementType: 'SC' | 'MC' | 'KPRIM' | 'NUMERICAL' | 'FREE_TEXT'
  elementData: {
    options: {
      choices?: { ix: number; correct?: boolean }[]
      exactSolutions?: number[]
      solutions?: string[]
    }
  }
}

export type AdaptiveSeedRuntime = {
  nodes: AdaptiveRuntimeNode[]
  levels: { id: number; order: number }[]
  pool: SeedPoolItem[]
  settings: AdaptiveRuntimeSettings
}

type SeedHistoryEntry = {
  item: SeedPoolItem
  order: number
  correct: boolean
  answer: { choiceIndices: number[] } | { value: string }
  before: number | null
  after: AdaptiveRuntimeEstimate
  elapsedSeconds: number
}

export function remapAdaptiveSeedEstimates({
  estimates,
  persistedNodeIdBySeedId,
  persistedLevelIdBySeedId,
}: {
  estimates: {
    overall: AdaptiveRuntimeEstimate
    nodes: Map<number, AdaptiveRuntimeEstimate>
  }
  persistedNodeIdBySeedId: ReadonlyMap<number, number>
  persistedLevelIdBySeedId: ReadonlyMap<number, number>
}) {
  const remap = (estimate: AdaptiveRuntimeEstimate) => ({
    ...estimate,
    nodeId:
      estimate.nodeId === null
        ? null
        : requireMappedId(persistedNodeIdBySeedId, estimate.nodeId, 'node'),
    levelId:
      estimate.levelId === null
        ? null
        : requireMappedId(persistedLevelIdBySeedId, estimate.levelId, 'level'),
  })
  return {
    overall: remap(estimates.overall),
    nodes: [...estimates.nodes.values()].map(remap),
  }
}

function requireMappedId(
  persistedIdBySeedId: ReadonlyMap<number, number>,
  seedId: number,
  kind: 'node' | 'level'
) {
  const persistedId = persistedIdBySeedId.get(seedId)
  if (!persistedId)
    throw new Error(`Cannot map synthetic ${kind} ID ${seedId}.`)
  return persistedId
}

// The engine receives only this numeric projection. Question text, answers,
// element identifiers, participant identifiers, and names remain local.
function decisionRequest({
  attemptId,
  runtime,
  responses,
}: {
  attemptId: string
  runtime: AdaptiveSeedRuntime
  responses: { order: number; poolItemId: number; correct: boolean }[]
}) {
  return {
    contractVersion: 1 as const,
    measurementVersion: 'IRT_V1' as const,
    routingSeed: attemptId,
    nodes: runtime.nodes,
    levels: runtime.levels.map(({ id, order }) => ({
      id,
      order,
      label: `level-${order}`,
    })),
    pool: runtime.pool.map(
      ({
        id,
        leafNodeId,
        nodePath,
        levelId,
        discrimination,
        difficulty,
        guessing,
      }) => ({
        id,
        leafNodeId,
        nodePath,
        levelId,
        discrimination,
        difficulty,
        guessing,
      })
    ),
    settings: runtime.settings,
    responses,
  }
}

function terminalEstimateRequest({
  runtime,
  responses,
  stopReason,
}: {
  runtime: AdaptiveSeedRuntime
  responses: { order: number; poolItemId: number; correct: boolean }[]
  stopReason: NonNullable<DecisionResponse['stopReason']>
}) {
  const { routingSeed: _routingSeed, ...request } = decisionRequest({
    attemptId: '00000000-0000-4000-8000-000000000000',
    runtime,
    responses,
  })
  return { ...request, terminalReason: stopReason }
}

function toEstimates(result: EstimateResponse) {
  if (result.measurementVersion !== 'IRT_V1')
    throw new Error(
      'Seed estimator returned an incompatible measurement version.'
    )
  return {
    overall: result.estimates.overall,
    nodes: new Map(
      result.estimates.nodes.map((estimate) => [estimate.nodeId!, estimate])
    ),
  }
}

// Exercise the production decision and terminal-estimate endpoints. The
// synthetic performance pattern and actual response values stay in-process.
export async function simulateAdaptiveSeedAttempt({
  attemptId,
  participantIndex,
  runtime,
  client,
}: {
  attemptId: string
  participantIndex: number
  runtime: AdaptiveSeedRuntime
  client: ReturnType<typeof createAdaptiveClient>
}) {
  const poolById = new Map(runtime.pool.map((item) => [item.id, item]))
  const responses: { order: number; poolItemId: number; correct: boolean }[] =
    []
  const history: SeedHistoryEntry[] = []
  let decision = await client.decide(
    decisionRequest({ attemptId, runtime, responses })
  )
  if (decision.measurementVersion !== 'IRT_V1')
    throw new Error(
      'Seed estimator returned an incompatible measurement version.'
    )

  while (decision.nextPoolItemId !== null) {
    const item = poolById.get(decision.nextPoolItemId)
    if (!item) throw new Error('Seed estimator selected an unknown pool item.')
    const order = responses.length + 1
    const correct =
      participantIndex % 3 === 0
        ? false
        : participantIndex % 3 === 2
          ? true
          : order % 3 !== 0 && item.levelOrder <= 1
    const answer = syntheticAnswer(item, correct)
    const before = decision.estimates.overall.theta
    responses.push({ order, poolItemId: item.id, correct })
    decision = await client.decide(
      decisionRequest({ attemptId, runtime, responses })
    )
    if (decision.measurementVersion !== 'IRT_V1')
      throw new Error(
        'Seed estimator returned an incompatible measurement version.'
      )
    history.push({
      item,
      order,
      correct,
      answer,
      before,
      after: decision.estimates.overall,
      elapsedSeconds: 15 + ((participantIndex + order) % 20),
    })
  }
  if (!decision.stopReason) throw new Error('Seed attempt did not terminate.')
  const estimates = toEstimates(
    await client.estimates(
      terminalEstimateRequest({
        runtime,
        responses,
        stopReason: decision.stopReason,
      })
    )
  )
  return { history, estimates, stopReason: decision.stopReason }
}

function syntheticAnswer(item: SeedPoolItem, correct: boolean) {
  const { options } = item.elementData
  if (options.choices) {
    const indices = options.choices
      .filter((choice) => (choice.correct === true) === correct)
      .map(({ ix }) => ix)
    return {
      choiceIndices: item.elementType === 'SC' ? indices.slice(0, 1) : indices,
    }
  }
  if (item.elementType === 'NUMERICAL') {
    const solution = options.exactSolutions?.[0]
    if (solution === undefined)
      throw new Error('Missing synthetic numerical solution.')
    return { value: String(correct ? solution : solution === 0 ? 1 : 0) }
  }
  const solution = options.solutions?.[0]
  if (!solution) throw new Error('Missing synthetic text solution.')
  return {
    value: correct ? solution.trim().toLowerCase() : 'synthetic wrong answer',
  }
}
