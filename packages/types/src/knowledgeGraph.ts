export type KnowledgeGraphSourceReference = {
  resourceId: string
  title: string
  reference?: string
  pages?: number[]
}

export type KnowledgeGraphRelationType =
  | 'prerequisite_of'
  | 'part_of'
  | 'example_of'
  | 'applies_to'
  | 'contrasts_with'
  | 'related'

export type KnowledgeGraphRelationStatus = 'source' | 'inferred' | 'extracted'

export type KnowledgeGraphNode = {
  id: string
  labels: string[]
  kind: string
  displayLabel: string
  summary?: string
  content?: string
  degree: number
  sourceReferences: KnowledgeGraphSourceReference[]
}

export type KnowledgeGraphEdge = {
  id: string
  source: string
  target: string
  type: string
  label: string
  relationType: KnowledgeGraphRelationType
  relationStatus: KnowledgeGraphRelationStatus
  sourceReferences: KnowledgeGraphSourceReference[]
  properties: Record<string, string | number | boolean>
}

export type KnowledgeGraphResponse = {
  kbId: string
  buildId: string
  // stale graphs keep serving; only lecturer-facing views surface the label
  isStale: boolean
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
  truncated: boolean
}
