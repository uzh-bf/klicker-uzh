import type { AdaptiveItemType } from './core.js'
import type { AdaptiveItemModel } from './posterior.js'
import type { AdaptiveRuntimePoolItem } from './runtime.js'

export const ADAPTIVE_V2_EXPOSURE_CEILING = 0.4 as const
export const ADAPTIVE_V2_RANDOMIZATION_VERSION = 'HASH32_JOINT_V1' as const

export type AdaptiveV2Mode = 'DIAGNOSTIC' | 'RESEARCH'

export type AdaptiveV2ItemRole = 'SCORING' | 'ANCHOR' | 'FIELD_TEST'

export type AdaptiveV2PoolItem = AdaptiveRuntimePoolItem & {
  /** Optional same-root secondary leaf targets from the immutable pool snapshot. */
  additionalLeafNodeIds?: readonly number[]
  /** Derived and frozen during runtime preparation; callers must not supply it. */
  additionalNodePaths?: readonly (readonly number[])[]
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
