import {
  KbDataFragment,
  KbResourceDataFragment,
  KbResourceKind,
  KbStatus,
  KbWebsiteStrategy,
} from '@klicker-uzh/graphql/dist/ops'
import {
  KnowledgeBaseSummary,
  KnowledgeRefreshPolicy,
  KnowledgeResource,
} from '@klicker-uzh/kb-management'

const STATUS_MAP: Record<KbStatus, KnowledgeResource['status']> = {
  [KbStatus.Ready]: 'ready',
  [KbStatus.Indexing]: 'indexing',
  [KbStatus.Queued]: 'queued',
  [KbStatus.Stale]: 'stale',
  [KbStatus.Error]: 'error',
  [KbStatus.Disabled]: 'disabled',
}

const KIND_MAP: Record<KbResourceKind, KnowledgeResource['type']> = {
  [KbResourceKind.Document]: 'document',
  [KbResourceKind.Website]: 'website',
  [KbResourceKind.Snippet]: 'text',
  [KbResourceKind.KlickerObject]: 'internal',
}

const RUN_STATUS_MAP: Record<string, KnowledgeResource['status']> = {
  SUCCEEDED: 'ready',
  FAILED: 'error',
  RUNNING: 'indexing',
  QUEUED: 'queued',
}

const STRATEGY_MAP = {
  [KbWebsiteStrategy.ScrapeSubsites]: {
    strategy: 'S' as const,
    label: 'Scrape subsites',
  },
  [KbWebsiteStrategy.IndexPage]: {
    strategy: 'I' as const,
    label: 'Index this page',
  },
  [KbWebsiteStrategy.ReferenceOnly]: {
    strategy: 'K' as const,
    label: 'Reference only',
  },
}

function formatDate(value?: string | null) {
  if (!value) return undefined

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: 'Europe/Zurich',
  }).format(new Date(value))
}

function bytesLabel(value?: string | number | null) {
  if (value == null) return undefined

  const bytes = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(bytes)) return undefined
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function toRefreshPolicy(
  intervalMinutes?: number | null
): KnowledgeRefreshPolicy {
  return {
    mode: intervalMinutes ? 'interval' : 'manual',
    intervalMinutes: intervalMinutes ?? null,
    intervalLabel: intervalMinutes ? `Every ${intervalMinutes} min` : undefined,
  }
}

export function toKnowledgeBaseSummary(
  kb: KbDataFragment
): KnowledgeBaseSummary {
  return {
    id: kb.id,
    name: kb.name,
    description: kb.description ?? undefined,
    resourceCount: kb.resourceCount,
    status: STATUS_MAP[kb.status],
    statusLabel: kb.status,
    updatedAtLabel: formatDate(kb.updatedAt),
    metadata: (kb.metadata as KnowledgeBaseSummary['metadata']) ?? undefined,
    metrics: [
      { id: 'resources', label: 'Resources', value: kb.resourceCount },
      { id: 'chunks', label: 'Chunks', value: kb.chunkCount },
      { id: 'size', label: 'Size', value: bytesLabel(kb.sizeBytes) ?? '-' },
    ],
    refreshPolicy: toRefreshPolicy(kb.refreshIntervalMinutes),
  }
}

export function toKnowledgeResource(
  resource: KbResourceDataFragment
): KnowledgeResource {
  const strategy = resource.websiteStrategy
    ? STRATEGY_MAP[resource.websiteStrategy]
    : undefined

  const metadata =
    (resource.metadata as Record<string, unknown> | null | undefined) ?? null
  const metadataChunkCount =
    typeof metadata?.chunkCount === 'number' ? metadata.chunkCount : undefined
  const metadataSizeBytes =
    typeof metadata?.sizeBytes === 'number' ? metadata.sizeBytes : undefined
  const subsites = Array.isArray(metadata?.subresources)
    ? (metadata.subresources as Array<Record<string, unknown>>)
    : []

  return {
    id: resource.id,
    knowledgeBaseId: resource.kbId,
    title: resource.title,
    type: KIND_MAP[resource.kind],
    originLabel: resource.kind,
    originDetail: resource.websiteUrl ?? undefined,
    sizeLabel: bytesLabel(metadataSizeBytes),
    chunkCount: metadataChunkCount,
    updatedAtLabel: formatDate(resource.updatedAt),
    status: STATUS_MAP[resource.status],
    statusLabel: resource.status,
    statusMessage: resource.statusDetail ?? undefined,
    metadata:
      (metadata as KnowledgeResource['metadata'] | undefined) ?? undefined,
    websiteMetadata:
      resource.kind === KbResourceKind.Website
        ? {
            strategy: strategy?.strategy ?? 'I',
            strategyLabel: strategy?.label,
            subsites: subsites.map((sub, index) => ({
              id: typeof sub.id === 'string' ? sub.id : `sub-${index}`,
              title:
                typeof sub.title === 'string'
                  ? sub.title
                  : typeof sub.url === 'string'
                    ? sub.url
                    : '',
              url: typeof sub.url === 'string' ? sub.url : '',
              status: STATUS_MAP[KbStatus.Ready],
              chunkCount:
                typeof sub.chunkCount === 'number' ? sub.chunkCount : undefined,
            })),
          }
        : undefined,
    snippetMetadata:
      resource.kind === KbResourceKind.Snippet
        ? {
            characterCount: resource.snippetText?.length,
          }
        : undefined,
    internalMetadata:
      resource.kind === KbResourceKind.KlickerObject
        ? {
            provider: 'KlickerUZH',
            objectType: 'Klicker object',
          }
        : undefined,
    freshness: {
      lastIndexedAtLabel: formatDate(resource.lastIndexedAt),
      nextCheckAtLabel: formatDate(resource.nextRefreshAt),
      changeStatus: 'unknown',
      changeStatusLabel: 'Unknown',
      refreshPolicy: toRefreshPolicy(resource.refreshIntervalMinutes),
      inheritedFromKnowledgeBase: resource.refreshIntervalMinutes == null,
    },
    ingestionRuns: resource.ingestionRuns.map((run) => ({
      id: run.id,
      label: run.status,
      status: RUN_STATUS_MAP[run.status] ?? 'queued',
    })),
  }
}
