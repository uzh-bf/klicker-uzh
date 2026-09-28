export type ExplicitAdaptiveLevel = {
  id: number
  label: string
  order: number
  lowerBound: number
  upperBound: number
  itemDifficultyPrior: number
}

export type AdaptiveScaleDefinition = {
  priorMean: number
  priorStandardDeviation: number
  gridMin: number
  gridMax: number
  gridStep: number
  classificationPolicyVersion: number
  levels: ExplicitAdaptiveLevel[]
}
