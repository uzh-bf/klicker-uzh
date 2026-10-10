import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphSourceReference,
} from '@klicker-uzh/types'

import type { KnowledgeGraphSourceMetadata } from './publication.js'
import type { KnowledgeGraphEdgeRow, KnowledgeGraphNodeRow } from './queries.js'

export const KNOWLEDGE_GRAPH_CONTENT_MAX_LENGTH = 8_000
const KNOWLEDGE_GRAPH_SUMMARY_MAX_LENGTH = 1_000
const KNOWLEDGE_GRAPH_LABEL_MAX_LENGTH = 300
const KNOWLEDGE_GRAPH_EDGE_PROPERTY_MAX_LENGTH = 500

const SENSITIVE_PROPERTY_KEY =
  /embedding|vector|password|secret|token|credential|ingestion|workflow|internal|(?:^|_)(?:url|uri|href|blob|storage|path)(?:_|$)|^(?:source_id|created_at|truncate)$/i
const SENSITIVE_PROPERTY_VALUE =
  /(?:^|[^a-z\d])(?:embedding|vector|password|secret|token|credential|ingestion|workflow)(?:[^a-z\d]|$)/i
const SAS_QUERY_PARAMETER = /[?&](?:sig|se|sp|sv)=/i

type Properties = Record<string, unknown>

function containsSensitiveText(value: string): boolean {
  return SENSITIVE_PROPERTY_VALUE.test(
    value
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
  )
}

function isPlainProperties(value: unknown): value is Properties {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isSafeText(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !containsSensitiveText(value) &&
    !SAS_QUERY_PARAMETER.test(value)
  )
}

function safeText(value: unknown, maximumLength: number): string | undefined {
  if (!isSafeText(value)) {
    return undefined
  }

  return value.trim().slice(0, maximumLength)
}

function firstString(
  properties: Properties,
  keys: string[],
  maximumLength: number
): string | undefined {
  for (const key of keys) {
    const value = safeText(properties[key], maximumLength)
    if (value !== undefined) {
      return value
    }
  }

  return undefined
}

function internalId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return String(value)
  }

  if (typeof value === 'bigint' && value >= 0n) {
    return String(value)
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return value
  }

  return undefined
}

function normalizeLabels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .map((label) => safeText(label, KNOWLEDGE_GRAPH_LABEL_MAX_LENGTH))
        .filter((label): label is string => label !== undefined)
    )
  )
}

function normalizeDegree(value: unknown): number {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return value
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : 0
  }

  return 0
}

function sourceIds(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(
    (sourceId): sourceId is string =>
      typeof sourceId === 'string' && sourceId.length > 0
  )
}

function sourceReference(
  properties: Properties,
  sources: ReadonlyMap<string, KnowledgeGraphSourceMetadata>
): KnowledgeGraphSourceReference[] {
  const referenceValue =
    properties.reference ?? properties.page ?? properties.page_number
  const reference =
    typeof referenceValue === 'number' && Number.isFinite(referenceValue)
      ? String(referenceValue)
      : safeText(referenceValue, KNOWLEDGE_GRAPH_LABEL_MAX_LENGTH)

  const seen = new Set<string>()
  const references: KnowledgeGraphSourceReference[] = []
  for (const sourceId of sourceIds(properties.source_id)) {
    if (seen.has(sourceId)) {
      continue
    }

    const source = sources.get(sourceId)
    if (!source) {
      continue
    }

    seen.add(sourceId)
    references.push({
      resourceId: source.resourceId,
      title:
        safeText(source.title, KNOWLEDGE_GRAPH_LABEL_MAX_LENGTH) ?? 'Source',
      ...(reference === undefined ? {} : { reference }),
    })
  }

  return references
}

export function normalizeKnowledgeGraphNode(
  row: KnowledgeGraphNodeRow,
  sources: ReadonlyMap<string, KnowledgeGraphSourceMetadata>
): KnowledgeGraphNode | null {
  const id = internalId(row.id)
  if (id === undefined) {
    return null
  }

  const labels = normalizeLabels(row.labels)
  const properties = isPlainProperties(row.properties) ? row.properties : {}
  const displayLabel =
    firstString(
      properties,
      ['name', 'title', 'entity'],
      KNOWLEDGE_GRAPH_LABEL_MAX_LENGTH
    ) ?? `Concept ${id}`
  const kind =
    firstString(
      properties,
      ['entity_type'],
      KNOWLEDGE_GRAPH_LABEL_MAX_LENGTH
    ) ??
    labels[0] ??
    'Concept'
  const summary = firstString(
    properties,
    ['summary'],
    KNOWLEDGE_GRAPH_SUMMARY_MAX_LENGTH
  )
  const content = firstString(
    properties,
    ['description', 'summary', 'content', 'text'],
    KNOWLEDGE_GRAPH_CONTENT_MAX_LENGTH
  )

  return {
    id,
    labels,
    kind,
    displayLabel,
    ...(summary === undefined ? {} : { summary }),
    ...(content === undefined ? {} : { content }),
    degree: normalizeDegree(row.degree),
    sourceReferences: sourceReference(properties, sources),
  }
}

function safeEdgeProperties(
  value: unknown
): Record<string, string | number | boolean> {
  if (!isPlainProperties(value)) {
    return {}
  }

  const properties: Record<string, string | number | boolean> = {}
  for (const [key, propertyValue] of Object.entries(value)) {
    const normalizedKey = key
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .toLowerCase()
    if (SENSITIVE_PROPERTY_KEY.test(normalizedKey)) {
      continue
    }

    if (typeof propertyValue === 'string') {
      if (containsSensitiveText(propertyValue)) {
        continue
      }

      const normalized = safeText(
        propertyValue,
        KNOWLEDGE_GRAPH_EDGE_PROPERTY_MAX_LENGTH
      )
      if (normalized !== undefined) {
        properties[key] = normalized
      }
      continue
    }

    if (typeof propertyValue === 'boolean') {
      properties[key] = propertyValue
      continue
    }

    if (typeof propertyValue === 'number' && Number.isFinite(propertyValue)) {
      properties[key] = propertyValue
    }
  }

  return properties
}

export function normalizeKnowledgeGraphEdge(
  row: KnowledgeGraphEdgeRow
): KnowledgeGraphEdge | null {
  const id = internalId(row.id)
  const source = internalId(row.source)
  const target = internalId(row.target)
  if (id === undefined || source === undefined || target === undefined) {
    return null
  }

  const properties = isPlainProperties(row.properties) ? row.properties : {}
  const type =
    safeText(row.type, KNOWLEDGE_GRAPH_LABEL_MAX_LENGTH) ?? 'RELATED_TO'
  const label =
    firstString(
      properties,
      ['label', 'name', 'title'],
      KNOWLEDGE_GRAPH_LABEL_MAX_LENGTH
    ) ?? type

  return {
    id,
    source,
    target,
    type,
    label,
    properties: safeEdgeProperties(properties),
  }
}
