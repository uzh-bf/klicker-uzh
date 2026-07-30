export type CompetenceTreeId = number | string

export type CompetenceTreeValidationNodeKind = 'COMPETENCE' | 'SUBCOMPETENCE'

export type CompetenceTreeValidationLevel = {
  id: CompetenceTreeId
  label: string
  order: number
}

export type CompetenceTreeValidationNode = {
  id: CompetenceTreeId
  kind: CompetenceTreeValidationNodeKind
  name?: string | null
  parentId?: CompetenceTreeId | null
  order: number
  depth: number
  weight?: number | null
  enabled?: boolean | null
}

export type CompetenceTreeValidationCoverage = {
  leafNodeId: CompetenceTreeId
  levelId: CompetenceTreeId
  targetItemCount?: number | null
  enabled?: boolean | null
}

export type CompetenceTreeValidationAssignment = {
  elementId: number
  type: string
  leafNodeId: CompetenceTreeId
  levelId: CompetenceTreeId
  discrimination?: number | null
  enablePercentInput?: boolean | null
  enabled?: boolean | null
  controlledAnswerReady?: boolean
}

export type CompetenceTreeValidationInput = {
  name?: string | null
  displayName?: string | null
  maxDepth?: number | null
  thetaMin?: number | null
  thetaMax?: number | null
  defaultDiscrimination?: number | null
  levels: CompetenceTreeValidationLevel[]
  nodes: CompetenceTreeValidationNode[]
  coverages?: CompetenceTreeValidationCoverage[]
  assignments?: CompetenceTreeValidationAssignment[]
}

export type CompetenceTreeValidationIssue = {
  code: string
  message: string
  path?: string
}

export type NormalizedCompetenceWeight = {
  nodeId: CompetenceTreeId
  weight: number
}

export type CompetenceTreeValidationResult = {
  valid: boolean
  effectiveMaxDepth: number
  errors: CompetenceTreeValidationIssue[]
  warnings: CompetenceTreeValidationIssue[]
  normalizedRootWeights: NormalizedCompetenceWeight[]
}
