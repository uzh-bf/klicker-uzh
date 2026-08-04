import type { AdaptiveItemModel } from './calibration.js'
import type { AdaptiveItemType } from './core.js'
import {
  type AdaptivePosterior,
  assertAdaptiveScoredItem,
} from './posterior.js'
import type { AdaptiveRuntimePoolItem } from './runtime.js'

const UINT32_SPACE = 0x1_0000_0000

export const ADAPTIVE_V2_EXPOSURE_CEILING = 0.4 as const
export const ADAPTIVE_V2_RANDOMIZATION_VERSION = 'HASH32_JOINT_V1' as const

export type AdaptiveV2Mode = 'DIAGNOSTIC' | 'RESEARCH'

export type AdaptiveV2ItemRole = 'SCORING' | 'ANCHOR' | 'FIELD_TEST'

export type AdaptiveV2PoolItem = AdaptiveRuntimePoolItem & {
  itemType: AdaptiveItemType
  choiceCount: number | null
  model: AdaptiveItemModel
  calibrationId: string | null
  contributesToEstimate: boolean
  role: AdaptiveV2ItemRole
}

export type AdaptiveV2ResearchPolicy = {
  anchorResponsesPerLeafLevel: number
  fieldTestResponsesPerLeaf: number
  fieldTestInclusionProbability: number
  collectionDesignVersion: string
}

export type AdaptiveV2SelectionContext = {
  isExposureEligible?: (item: AdaptiveV2PoolItem) => boolean
  servedCountByPoolItem?: ReadonlyMap<number, number>
  priorAttemptPoolItemIds?: ReadonlySet<number>
}

export type AdaptiveV2LeafSelectionState = {
  rootId: number
  leafId: number
  stableOrder: number[]
  effectiveWeight: number
  administeredResponseCount: number
  evidenceResponseCount: number
  rootEvidenceResponseCount: number
  posterior: AdaptivePosterior
  eligibleItems: AdaptiveV2PoolItem[]
  anchorResponsesByLevel: ReadonlyMap<number, number>
  fieldTestResponseCount: number
}

export type AdaptiveV2Selection = {
  item: AdaptiveV2PoolItem
  role: AdaptiveV2ItemRole
  conditionalAdministrationProbability: number
  collectionDesignVersion: string | null
  randomizationVersion: typeof ADAPTIVE_V2_RANDOMIZATION_VERSION
  randomDraw: number
  candidateSetHash: string
}

export function expectedPosteriorInformation({
  posterior,
  item,
}: {
  posterior: AdaptivePosterior
  item: AdaptiveV2PoolItem
}): number {
  assertInformationItem(item)
  assertPosteriorMass(posterior)

  const total = posterior.probabilities.reduce((sum, value) => sum + value, 0)
  return posterior.points.reduce((sum, theta, index) => {
    const mass = posterior.probabilities[index]! / total
    return sum + mass * itemInformation(theta, item)
  }, 0)
}

export function selectAdaptiveV2Item({
  attemptId,
  responseOrder,
  mode,
  leaves,
  minQuestionsPerLeaf,
  totalQuestionCap,
  totalAdministeredResponses,
  topInformationRatio,
  researchPolicy,
  selectionContext = {},
}: {
  attemptId: string
  responseOrder: number
  mode: AdaptiveV2Mode
  leaves: AdaptiveV2LeafSelectionState[]
  minQuestionsPerLeaf: number
  totalQuestionCap: number
  totalAdministeredResponses: number
  topInformationRatio: number
  researchPolicy: AdaptiveV2ResearchPolicy | null
  selectionContext?: AdaptiveV2SelectionContext
}): AdaptiveV2Selection | null {
  if (attemptId.trim().length === 0) {
    throw new TypeError('Adaptive attempt ID must not be empty.')
  }
  if (!Number.isInteger(responseOrder) || responseOrder < 1) {
    throw new TypeError('Adaptive response order must be a positive integer.')
  }
  if (!Number.isInteger(minQuestionsPerLeaf) || minQuestionsPerLeaf < 0) {
    throw new TypeError('Minimum questions per leaf must be non-negative.')
  }
  if (!Number.isInteger(totalQuestionCap) || totalQuestionCap < 1) {
    throw new TypeError('Total question cap must be a positive integer.')
  }
  if (
    !Number.isInteger(totalAdministeredResponses) ||
    totalAdministeredResponses < 0 ||
    totalAdministeredResponses >= totalQuestionCap
  ) {
    throw new TypeError('Administered response count must be non-negative.')
  }
  if (
    !Number.isFinite(topInformationRatio) ||
    topInformationRatio < 0 ||
    topInformationRatio > 1
  ) {
    throw new TypeError('Top information ratio must be between 0 and 1.')
  }
  if (mode !== 'DIAGNOSTIC' && mode !== 'RESEARCH') {
    throw new TypeError('Adaptive v2 selection mode is not supported.')
  }
  if (mode === 'RESEARCH' && researchPolicy === null) {
    throw new TypeError('Research selection requires a research policy.')
  }
  if (mode === 'DIAGNOSTIC' && researchPolicy !== null) {
    throw new TypeError('Diagnostic selection must not use a research policy.')
  }
  if (researchPolicy !== null) assertResearchPolicy(researchPolicy)

  const seenLeafIds = new Set<number>()
  for (const leaf of leaves) {
    if (
      !Number.isInteger(leaf.rootId) ||
      !Number.isInteger(leaf.leafId) ||
      seenLeafIds.has(leaf.leafId) ||
      !Number.isFinite(leaf.effectiveWeight) ||
      leaf.effectiveWeight <= 0 ||
      !Number.isInteger(leaf.administeredResponseCount) ||
      leaf.administeredResponseCount < 0 ||
      !Number.isInteger(leaf.evidenceResponseCount) ||
      leaf.evidenceResponseCount < 0 ||
      !Number.isInteger(leaf.rootEvidenceResponseCount) ||
      leaf.rootEvidenceResponseCount < 0 ||
      !Number.isFinite(leaf.posterior.variance) ||
      leaf.posterior.variance < 0
    ) {
      throw new TypeError('Adaptive v2 leaf selection state is malformed.')
    }
    seenLeafIds.add(leaf.leafId)
  }

  let selectableLeaves = leaves.filter((leaf) => leaf.eligibleItems.length > 0)
  if (selectableLeaves.length === 0) return null

  let forceFieldTest = false
  if (mode === 'RESEARCH') {
    const anchorDeficitLeaves = selectableLeaves.filter((leaf) =>
      [...leaf.anchorResponsesByLevel].some(
        ([levelId, count]) =>
          count < researchPolicy!.anchorResponsesPerLeafLevel &&
          leaf.eligibleItems.some(
            (item) => item.role === 'ANCHOR' && item.levelId === levelId
          )
      )
    )
    if (anchorDeficitLeaves.length > 0) {
      selectableLeaves = anchorDeficitLeaves
    } else {
      const fieldTestDeficit = selectableLeaves.reduce(
        (total, leaf) =>
          total +
          Math.max(
            researchPolicy!.fieldTestResponsesPerLeaf -
              leaf.fieldTestResponseCount,
            0
          ),
        0
      )
      const remainingResponses = totalQuestionCap - totalAdministeredResponses
      forceFieldTest =
        fieldTestDeficit > 0 && remainingResponses <= fieldTestDeficit
      if (forceFieldTest) {
        selectableLeaves = selectableLeaves.filter(
          (leaf) =>
            leaf.fieldTestResponseCount <
              researchPolicy!.fieldTestResponsesPerLeaf &&
            leaf.eligibleItems.some((item) => item.role === 'FIELD_TEST')
        )
      }
    }
  }
  if (selectableLeaves.length === 0) return null

  const missingEvidence = selectableLeaves.filter(
    (leaf) => leaf.evidenceResponseCount < minQuestionsPerLeaf
  )
  const candidates =
    missingEvidence.length > 0 ? missingEvidence : selectableLeaves
  const selectedLeaf = candidates.slice().sort((left, right) => {
    const rootEvidenceOrder =
      Number(left.rootEvidenceResponseCount > 0) -
      Number(right.rootEvidenceResponseCount > 0)
    const leafEvidenceOrder =
      Number(left.evidenceResponseCount > 0) -
      Number(right.evidenceResponseCount > 0)
    const missingOrder =
      Math.max(minQuestionsPerLeaf - right.evidenceResponseCount, 0) -
      Math.max(minQuestionsPerLeaf - left.evidenceResponseCount, 0)
    const leftAllocationDeficit =
      left.effectiveWeight * (totalAdministeredResponses + 1) -
      left.administeredResponseCount
    const rightAllocationDeficit =
      right.effectiveWeight * (totalAdministeredResponses + 1) -
      right.administeredResponseCount
    const allocationOrder = rightAllocationDeficit - leftAllocationDeficit
    const varianceOrder =
      right.effectiveWeight * right.effectiveWeight * right.posterior.variance -
      left.effectiveWeight * left.effectiveWeight * left.posterior.variance

    return (
      rootEvidenceOrder ||
      leafEvidenceOrder ||
      missingOrder ||
      compareFinite(allocationOrder) ||
      compareFinite(varianceOrder) ||
      compareStableOrder(left.stableOrder, right.stableOrder) ||
      left.leafId - right.leafId
    )
  })[0]!

  const exposureEligible = selectedLeaf.eligibleItems.filter((item) => {
    const eligible = selectionContext.isExposureEligible?.(item) ?? true
    if (typeof eligible !== 'boolean') {
      throw new TypeError('Exposure eligibility must be boolean.')
    }
    return eligible
  })
  if (exposureEligible.length === 0) return null

  const randomDraw = stableHash(
    `${ADAPTIVE_V2_RANDOMIZATION_VERSION}:${attemptId}:${responseOrder}`
  )
  const roleSelection = selectRoleCandidates({
    mode,
    leaf: selectedLeaf,
    items: exposureEligible,
    researchPolicy,
    randomDraw,
    forceFieldTest,
  })
  if (roleSelection.items.length === 0) return null

  const informationScored = roleSelection.items.map((item) => ({
    item,
    information: expectedPosteriorInformation({
      posterior: selectedLeaf.posterior,
      item,
    }),
  }))
  const maximumInformation = Math.max(
    ...informationScored.map(({ information }) => information)
  )
  let approved = informationScored
    .filter(
      ({ information }) =>
        maximumInformation <= 0 ||
        information >= maximumInformation * topInformationRatio
    )
    .map(({ item }) => item)

  const unseen = approved.filter(
    (item) => !selectionContext.priorAttemptPoolItemIds?.has(item.id)
  )
  if (unseen.length > 0) approved = unseen
  const servedCounts = new Map(
    approved.map((item) => {
      const count = selectionContext.servedCountByPoolItem?.get(item.id) ?? 0
      if (!Number.isInteger(count) || count < 0) {
        throw new TypeError('Pool item served counts must be non-negative.')
      }
      return [item.id, count]
    })
  )
  const minimumServedCount = Math.min(
    ...approved.map((item) => servedCounts.get(item.id)!)
  )
  approved = approved
    .filter((item) => servedCounts.get(item.id) === minimumServedCount)
    .sort((left, right) => left.id - right.id)

  const index = roleSelection.itemDraw % approved.length
  const item = approved[index]!
  return {
    item,
    role: item.role,
    conditionalAdministrationProbability: jointSelectionProbability({
      index,
      candidateCount: approved.length,
      drawSpan: roleSelection.drawSpan,
    }),
    collectionDesignVersion:
      mode === 'RESEARCH' ? researchPolicy!.collectionDesignVersion : null,
    randomizationVersion: ADAPTIVE_V2_RANDOMIZATION_VERSION,
    randomDraw,
    candidateSetHash: candidateSetHash(approved),
  }
}

function assertResearchPolicy(policy: AdaptiveV2ResearchPolicy) {
  if (
    !Number.isInteger(policy.anchorResponsesPerLeafLevel) ||
    policy.anchorResponsesPerLeafLevel < 1 ||
    !Number.isInteger(policy.fieldTestResponsesPerLeaf) ||
    policy.fieldTestResponsesPerLeaf < 0 ||
    !Number.isFinite(policy.fieldTestInclusionProbability) ||
    policy.fieldTestInclusionProbability <= 0 ||
    policy.fieldTestInclusionProbability >= 1 ||
    typeof policy.collectionDesignVersion !== 'string' ||
    policy.collectionDesignVersion.trim().length === 0
  ) {
    throw new TypeError('Research selection policy is malformed.')
  }
}

function selectRoleCandidates({
  mode,
  leaf,
  items,
  researchPolicy,
  randomDraw,
  forceFieldTest,
}: {
  mode: AdaptiveV2Mode
  leaf: AdaptiveV2LeafSelectionState
  items: AdaptiveV2PoolItem[]
  researchPolicy: AdaptiveV2ResearchPolicy | null
  randomDraw: number
  forceFieldTest: boolean
}) {
  if (mode === 'DIAGNOSTIC') {
    return { items, itemDraw: randomDraw, drawSpan: UINT32_SPACE }
  }

  const policy = researchPolicy!
  const deficientAnchorLevels = [...leaf.anchorResponsesByLevel]
    .filter(([, count]) => count < policy.anchorResponsesPerLeafLevel)
    .sort(
      ([leftLevel, leftCount], [rightLevel, rightCount]) =>
        leftCount - rightCount || leftLevel - rightLevel
    )
  for (const [levelId] of deficientAnchorLevels) {
    const anchors = items.filter(
      (item) => item.role === 'ANCHOR' && item.levelId === levelId
    )
    if (anchors.length > 0) {
      return {
        items: anchors,
        itemDraw: randomDraw,
        drawSpan: UINT32_SPACE,
      }
    }
  }
  if (deficientAnchorLevels.length > 0) {
    return { items: [], itemDraw: 0, drawSpan: 0 }
  }

  const fieldTests = items.filter((item) => item.role === 'FIELD_TEST')
  const scoring = items.filter((item) => item.role !== 'FIELD_TEST')
  const fieldDeficit =
    leaf.fieldTestResponseCount < policy.fieldTestResponsesPerLeaf
  if (!fieldDeficit || fieldTests.length === 0) {
    return {
      items: scoring,
      itemDraw: randomDraw,
      drawSpan: UINT32_SPACE,
    }
  }
  if (forceFieldTest) {
    return {
      items: fieldTests,
      itemDraw: randomDraw,
      drawSpan: UINT32_SPACE,
    }
  }
  const threshold = Math.floor(
    policy.fieldTestInclusionProbability * UINT32_SPACE
  )
  return randomDraw < threshold
    ? { items: fieldTests, itemDraw: randomDraw, drawSpan: threshold }
    : {
        items: scoring,
        itemDraw: randomDraw - threshold,
        drawSpan: UINT32_SPACE - threshold,
      }
}

function assertInformationItem(item: AdaptiveV2PoolItem) {
  assertAdaptiveScoredItem({
    id: item.id,
    itemType: item.itemType,
    choiceCount: item.choiceCount,
    model: item.model,
    calibrationId: item.calibrationId ?? 'PROVISIONAL',
    discrimination: item.discrimination,
    difficulty: item.difficulty,
    guessing: item.guessing,
  })
}

function assertPosteriorMass(posterior: AdaptivePosterior) {
  if (
    posterior.points.length === 0 ||
    posterior.points.length !== posterior.probabilities.length
  ) {
    throw new TypeError('Posterior mass must use matching non-empty arrays.')
  }
  let previous = Number.NEGATIVE_INFINITY
  let total = 0
  for (let index = 0; index < posterior.points.length; index++) {
    const point = posterior.points[index]!
    const probability = posterior.probabilities[index]!
    if (!Number.isFinite(point) || point <= previous) {
      throw new TypeError('Posterior points must be finite and increasing.')
    }
    if (!Number.isFinite(probability) || probability < 0) {
      throw new TypeError('Posterior probabilities must be non-negative.')
    }
    previous = point
    total += probability
  }
  if (!Number.isFinite(total) || total <= 0) {
    throw new TypeError('Posterior probability mass must be positive.')
  }
}

function itemInformation(theta: number, item: AdaptiveV2PoolItem) {
  const predictor = item.discrimination * (theta - item.difficulty)
  const logistic =
    predictor >= 0
      ? 1 / (1 + Math.exp(-predictor))
      : Math.exp(predictor) / (1 + Math.exp(predictor))
  const probability = item.guessing + (1 - item.guessing) * logistic
  const incorrectProbability = 1 - probability
  const distanceFromGuessing = probability - item.guessing
  return (
    (item.discrimination *
      item.discrimination *
      incorrectProbability *
      distanceFromGuessing *
      distanceFromGuessing) /
    ((1 - item.guessing) * (1 - item.guessing) * probability)
  )
}

function jointSelectionProbability({
  index,
  candidateCount,
  drawSpan,
}: {
  index: number
  candidateCount: number
  drawSpan: number
}) {
  const preimageCount =
    index >= drawSpan
      ? 0
      : Math.floor((drawSpan - 1 - index) / candidateCount) + 1
  return preimageCount / UINT32_SPACE
}

function candidateSetHash(items: AdaptiveV2PoolItem[]) {
  return stableHash(
    items
      .map((item) => `${item.id}:${item.calibrationId ?? 'PROVISIONAL'}`)
      .join('|')
  )
    .toString(16)
    .padStart(8, '0')
}

function compareStableOrder(left: number[], right: number[]) {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index++) {
    const difference = (left[index] ?? -1) - (right[index] ?? -1)
    if (difference !== 0) return difference
  }
  return 0
}

function compareFinite(value: number) {
  return Number.isFinite(value) ? value : 0
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  return hash >>> 0
}
