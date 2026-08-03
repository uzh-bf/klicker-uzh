import type { AdaptivePresetName } from '@klicker-uzh/adaptive-learning'

export type AdaptiveConfiguredNode = {
  id: number
  parentId: number | null
  kind: 'COMPETENCE' | 'SUBCOMPETENCE'
  name: string
  depth: number
  enabled: boolean
  weight: number | null
  questionCap: number | null
}

export type AdaptiveConfiguredCoverage = {
  id: number
  leafNodeId: number
  levelId: number
  targetItemCount: number
  enabled: boolean
}

export type AdaptiveConfiguredLevel = {
  id: number
  theta: number
  lowerBound: number
  upperBound: number
}

export type AdaptiveConfiguredAssignment = {
  id: number
  elementId: number
  elementName: string
  elementType: string
  leafNodeId: number
  levelId: number
  enabled: boolean
  available: boolean
  availabilityReason?: 'DELETED' | 'OWNER_ACCESS_REVOKED' | null
  discrimination: number
  difficulty: number
  guessing: number
  controlledAnswerReady: boolean
}

export type AdaptiveConfiguredSettings = {
  preset: AdaptivePresetName
  totalQuestionCap: number
  perLeafQuestionCap: number | null
  minQuestionsPerLeaf: number
  classificationZ: number
  topInformationRatio: number
  defaultDiscrimination: number
}
