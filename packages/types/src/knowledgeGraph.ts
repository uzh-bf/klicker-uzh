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

export type CanonicalInputReference = {
  contract_version: 'canonical-document/v1'
  producer_id: string
  project_id: string
  kb_id: string
  external_resource_id: string
  resource_version: number
  source_sha256: string
  canonical_sha256: string
  parser_recipe_sha256: string
  byte_count: number
}

export function isCanonicalInputReference(
  value: unknown
): value is CanonicalInputReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const reference = value as Record<string, unknown>
  const keys = [
    'contract_version',
    'producer_id',
    'project_id',
    'kb_id',
    'external_resource_id',
    'resource_version',
    'source_sha256',
    'canonical_sha256',
    'parser_recipe_sha256',
    'byte_count',
  ]
  return (
    Object.keys(reference).length === keys.length &&
    keys.every((key) => Object.hasOwn(reference, key)) &&
    reference.contract_version === 'canonical-document/v1' &&
    ['producer_id', 'project_id', 'kb_id', 'external_resource_id'].every(
      (key) =>
        typeof reference[key] === 'string' &&
        (reference[key] as string).length > 0 &&
        (reference[key] as string).length <=
          (key === 'external_resource_id' ? 512 : 255)
    ) &&
    ['source_sha256', 'canonical_sha256', 'parser_recipe_sha256'].every(
      (key) =>
        typeof reference[key] === 'string' &&
        /^[a-f0-9]{64}$/.test(reference[key] as string)
    ) &&
    typeof reference.resource_version === 'number' &&
    Number.isSafeInteger(reference.resource_version) &&
    reference.resource_version > 0 &&
    reference.resource_version <= 2_147_483_647 &&
    typeof reference.byte_count === 'number' &&
    Number.isSafeInteger(reference.byte_count) &&
    reference.byte_count > 0 &&
    reference.byte_count <= 64 * 1024 * 1024
  )
}

export type ServingSourceMetadata = {
  byte_count: number
  mime_type: string
}

export function isServingSourceMetadata(
  value: unknown
): value is ServingSourceMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const metadata = value as Record<string, unknown>
  return (
    Object.keys(metadata).length === 2 &&
    typeof metadata.byte_count === 'number' &&
    Number.isSafeInteger(metadata.byte_count) &&
    metadata.byte_count > 0 &&
    metadata.byte_count <= 25 * 1024 * 1024 &&
    typeof metadata.mime_type === 'string' &&
    ['application/pdf', 'text/plain', 'text/html'].includes(metadata.mime_type)
  )
}
