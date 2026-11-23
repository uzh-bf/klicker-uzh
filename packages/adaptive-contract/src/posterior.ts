import type { AdaptiveItemType } from './core.js'
export type AdaptiveItemModel = 'TWO_PL' | 'THREE_PL_FIXED_C'

export type AdaptivePosterior = {
  points: number[]
  probabilities: number[]
  mean: number
  variance: number
  standardDeviation: number
  credibleLower: number
  credibleUpper: number
  bandProbabilities: Array<{
    levelId: number
    probability: number
  }>
}

export type AdaptiveScoredItem = {
  id: number | string
  itemType: AdaptiveItemType
  choiceCount: number | null
  model: AdaptiveItemModel
  calibrationId: string
  discrimination: number
  difficulty: number
  guessing: number
}

export type AdaptiveScoredResponse = {
  item: AdaptiveScoredItem
  correct: boolean
}
