export type KnowledgeGraphSourceReference = {
  resourceId: string
  title: string
  reference?: string
}

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
