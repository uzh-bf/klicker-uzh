import type {
  KnowledgeMetadataFieldDefinition,
  KnowledgeMetadataValue,
  KnowledgeMetadataVisibility,
  KnowledgeRefreshPolicy,
  KnowledgeResource,
  KnowledgeResourceStatus,
  KnowledgeResourceType,
  KnowledgeResourceTypeDefinition,
} from './types.js'

export const DEFAULT_RESOURCE_TYPES: KnowledgeResourceTypeDefinition[] = [
  {
    id: 'document',
    label: 'Document',
    shortLabel: 'PDF',
    icon: 'document',
    colorClassName: 'bg-orange-50 text-orange-700',
  },
  {
    id: 'website',
    label: 'Website',
    shortLabel: 'URL',
    icon: 'website',
    colorClassName: 'bg-cyan-50 text-cyan-800',
  },
  {
    id: 'snippet',
    label: 'Snippet',
    shortLabel: 'Text',
    icon: 'snippet',
    colorClassName: 'bg-yellow-50 text-yellow-800',
  },
  {
    id: 'internal',
    label: 'Internal',
    shortLabel: 'Library',
    icon: 'internal',
    colorClassName: 'bg-blue-50 text-blue-800',
  },
]

export function getResourceTypeDefinition(
  type: KnowledgeResourceType,
  resourceTypes: KnowledgeResourceTypeDefinition[] = DEFAULT_RESOURCE_TYPES
) {
  return (
    resourceTypes.find((resourceType) => resourceType.id === type) ?? {
      id: type,
      label: type,
      shortLabel: type.slice(0, 3).toUpperCase(),
      icon: 'default' as const,
      colorClassName: 'bg-slate-100 text-slate-700',
    }
  )
}

export function getStatusLabel(status: KnowledgeResourceStatus): string {
  switch (status) {
    case 'ready':
      return 'Ready'
    case 'indexing':
      return 'Indexing'
    case 'crawling':
      return 'Crawling'
    case 'queued':
      return 'Queued'
    case 'stale':
      return 'Stale'
    case 'error':
      return 'Error'
    case 'disabled':
      return 'Disabled'
    default:
      return status
  }
}

export function getStatusClassName(status: KnowledgeResourceStatus): string {
  switch (status) {
    case 'ready':
      return 'text-kb-ready'
    case 'indexing':
    case 'crawling':
    case 'queued':
      return 'text-kb-indexing'
    case 'stale':
      return 'text-kb-warning'
    case 'error':
      return 'text-kb-error'
    case 'disabled':
      return 'text-slate-500'
    default:
      return 'text-slate-700'
  }
}

export function getStatusDotClassName(status: KnowledgeResourceStatus): string {
  switch (status) {
    case 'ready':
      return 'bg-kb-ready'
    case 'indexing':
    case 'crawling':
    case 'queued':
      return 'bg-kb-indexing'
    case 'stale':
      return 'bg-kb-warning'
    case 'error':
      return 'bg-kb-error'
    case 'disabled':
      return 'bg-slate-400'
    default:
      return 'bg-slate-500'
  }
}

export function formatMetadataValue(
  field: KnowledgeMetadataFieldDefinition,
  value: KnowledgeMetadataValue
) {
  if (value == null || value === '') {
    return undefined
  }

  if (field.type === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => formatSingleMetadataValue(field, String(item)))
      .join(', ')
  }

  return formatSingleMetadataValue(field, String(value))
}

function formatSingleMetadataValue(
  field: KnowledgeMetadataFieldDefinition,
  value: string
) {
  return field.options?.find((option) => option.id === value)?.label ?? value
}

export function getMetadataOptionClassName(
  field: KnowledgeMetadataFieldDefinition,
  value: string
) {
  return field.options?.find((option) => option.id === value)?.colorClassName
}

export function getVisibleMetadataFields(
  schema: KnowledgeMetadataFieldDefinition[],
  visibility: KnowledgeMetadataVisibility
) {
  return [...schema]
    .filter(
      (field) =>
        !field.visibility?.includes('hidden') &&
        (!field.visibility || field.visibility.includes(visibility))
    )
    .sort(
      (left, right) =>
        (left.displayPriority ?? 100) - (right.displayPriority ?? 100)
    )
}

export function matchesMetadataFilters(
  resource: KnowledgeResource,
  schema: KnowledgeMetadataFieldDefinition[],
  metadataFilters?: Record<string, string[]>
) {
  if (!metadataFilters) return true

  return Object.entries(metadataFilters).every(([fieldId, acceptedValues]) => {
    if (acceptedValues.length === 0) return true
    const field = schema.find((candidate) => candidate.id === fieldId)
    const value = resource.metadata?.[fieldId]
    if (!field || value == null) return false
    const values = Array.isArray(value) ? value.map(String) : [String(value)]
    return values.some((candidate) => acceptedValues.includes(candidate))
  })
}

export function filterKnowledgeResources(
  resources: KnowledgeResource[],
  query: string,
  type: KnowledgeResourceType | 'all',
  schema: KnowledgeMetadataFieldDefinition[] = [],
  metadataFilters?: Record<string, string[]>,
  status: KnowledgeResourceStatus | 'all' = 'all'
) {
  const normalizedQuery = query.trim().toLowerCase()

  return resources.filter((resource) => {
    const matchesType = type === 'all' || resource.type === type
    const matchesStatus = status === 'all' || resource.status === status
    const searchableMetadata = schema
      .map((field) => formatMetadataValue(field, resource.metadata?.[field.id]))
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const matchesQuery =
      normalizedQuery.length === 0 ||
      resource.title.toLowerCase().includes(normalizedQuery) ||
      resource.originLabel.toLowerCase().includes(normalizedQuery) ||
      resource.originDetail?.toLowerCase().includes(normalizedQuery) ||
      searchableMetadata.includes(normalizedQuery)

    return (
      matchesType &&
      matchesStatus &&
      matchesQuery &&
      matchesMetadataFilters(resource, schema, metadataFilters)
    )
  })
}

export function safePrompt(
  message: string,
  defaultValue?: string
): string | null {
  if (typeof window === 'undefined') return null
  return window.prompt(message, defaultValue)
}

export function safeConfirm(message: string): boolean {
  if (typeof window === 'undefined') return false
  return window.confirm(message)
}

export function getRefreshPolicyLabel(policy?: KnowledgeRefreshPolicy) {
  if (!policy) return 'Manual'
  if (policy.label) return policy.label
  if (policy.mode === 'disabled') return 'Disabled'
  if (policy.mode === 'manual') return 'Manual'
  if (policy.mode === 'interval') return policy.intervalLabel ?? 'Interval'
  if (policy.mode === 'cron') return policy.cronLabel ?? 'Scheduled'
  return 'Inherited'
}
