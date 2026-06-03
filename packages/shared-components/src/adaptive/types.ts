export type AdaptiveLevel = {
  label: string
  order: number
}

export type AdaptiveCompetenceScore = {
  competenceId?: number
  competenceName: string
  theta: number | null
  standardError?: number | null
  levelLabel?: string | null
  weight?: number | null
  answeredQuestions?: number
}

export type AdaptiveDistributionBin = {
  levelLabel: string
  minTheta: number
  maxTheta: number
  count: number
}

export type AdaptiveItemCurve = {
  theta: number
  probability: number
  information: number
}
