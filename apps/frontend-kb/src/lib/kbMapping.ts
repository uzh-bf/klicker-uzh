import {
  KbDataFragment,
  KbRefreshMode,
  KbRefreshScope,
  KbResourceDataFragment,
  KbResourceKind,
  KbResourceStatus,
  KbWebsiteStrategy,
} from '@klicker-uzh/graphql/dist/ops'
import {
  KnowledgeBaseSummary,
  KnowledgeRefreshPolicy,
  KnowledgeResource,
} from '@klicker-uzh/kb-management'

const STATUS_MAP: Record<KbResourceStatus, KnowledgeResource['status']> = {
  [KbResourceStatus.Ready]: 'ready',
  [KbResourceStatus.Indexing]: 'indexing',
  [KbResourceStatus.Crawling]: 'crawling',
  [KbResourceStatus.Queued]: 'queued',
  [KbResourceStatus.Stale]: 'stale',
  [KbResourceStatus.Error]: 'error',
  [KbResourceStatus.Disabled]: 'disabled',
}

const KIND_MAP: Record<KbResourceKind, KnowledgeResource['type']> = {
  [KbResourceKind.Document]: 'document',
  [KbResourceKind.Website]: 'website',
  [KbResourceKind.Snippet]: 'text',
  [KbResourceKind.KlickerObject]: 'internal',
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

function bytesLabel(value?: string | null) {
  if (!value) return undefined

  const bytes = Number(value)
  if (!Number.isFinite(bytes)) return undefined
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function toRefreshPolicy({
  mode,
  scope,
  intervalMinutes,
  cron,
  changeMonitoring,
}: {
  mode: KbRefreshMode
  scope?: KbRefreshScope | null
  intervalMinutes?: number | null
  cron?: string | null
  changeMonitoring?: boolean | null
}): KnowledgeRefreshPolicy {
  return {
    mode: mode.toLowerCase() as KnowledgeRefreshPolicy['mode'],
    scope: scope?.toLowerCase() as KnowledgeRefreshPolicy['scope'],
    intervalLabel: intervalMinutes ? `Every ${intervalMinutes} min` : undefined,
    cronLabel: cron ?? undefined,
    changeMonitoring: changeMonitoring ?? undefined,
  }
}

export function toKbRefreshMode(mode: KnowledgeRefreshPolicy['mode']) {
  if (mode === 'inherit') return KbRefreshMode.Inherit
  if (mode === 'interval') return KbRefreshMode.Interval
  if (mode === 'cron') return KbRefreshMode.Cron
  if (mode === 'disabled') return KbRefreshMode.Disabled
  return KbRefreshMode.Manual
}

export function toKbRefreshScope(scope?: KnowledgeRefreshPolicy['scope']) {
  if (scope === 'all') return KbRefreshScope.All
  if (scope === 'websites') return KbRefreshScope.Websites
  return KbRefreshScope.Refreshable
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
    metadata: kb.metadata ?? undefined,
    metrics: [
      { id: 'resources', label: 'Resources', value: kb.resourceCount },
      { id: 'chunks', label: 'Chunks', value: kb.chunkCount },
      { id: 'size', label: 'Size', value: bytesLabel(kb.sizeBytes) ?? '-' },
      { id: 'entities', label: 'Entities', value: kb.entityCount },
    ],
    refreshPolicy: toRefreshPolicy({
      mode: kb.refreshMode,
      scope: kb.refreshScope,
      intervalMinutes: kb.refreshIntervalMinutes,
      cron: kb.refreshCron,
      changeMonitoring: kb.changeMonitoring,
    }),
  }
}

export function toKnowledgeResource(
  resource: KbResourceDataFragment
): KnowledgeResource {
  const strategy = resource.websiteStrategy
    ? STRATEGY_MAP[resource.websiteStrategy]
    : undefined

  return {
    id: resource.id,
    knowledgeBaseId: resource.kbId,
    title: resource.title,
    type: KIND_MAP[resource.kind],
    originLabel: resource.originLabel ?? resource.kind,
    originDetail: resource.originDetail ?? resource.websiteUrl ?? undefined,
    sizeLabel: bytesLabel(resource.sizeBytes),
    chunkCount: resource.chunkCount ?? undefined,
    updatedAtLabel: formatDate(resource.updatedAt),
    status: STATUS_MAP[resource.status],
    statusLabel: resource.statusLabel ?? resource.status,
    statusMessage: resource.statusDetail ?? undefined,
    progress: resource.progress ?? undefined,
    metadata: resource.metadata ?? undefined,
    documentMetadata:
      resource.kind === KbResourceKind.Document
        ? {
            pageCount: resource.documentPageCount ?? undefined,
            fileSizeLabel: bytesLabel(resource.sizeBytes),
            mimeType: resource.documentMimeType ?? undefined,
            language: resource.documentLanguage ?? undefined,
          }
        : undefined,
    websiteMetadata:
      resource.kind === KbResourceKind.Website
        ? {
            strategy: strategy?.strategy ?? 'I',
            strategyLabel: strategy?.label,
            sitemapFound: resource.sitemapFound ?? undefined,
            sitemapPageCount: resource.sitemapPageCount ?? undefined,
            scrapedPageCount: resource.scrapedPageCount ?? undefined,
            depthLabel:
              resource.crawlDepth != null
                ? `depth ${resource.crawlDepth}`
                : undefined,
            subsites: resource.subresources.map((subresource) => ({
              id: subresource.id,
              title: subresource.title ?? subresource.url,
              url: subresource.url,
              status: STATUS_MAP[subresource.status],
              chunkCount: subresource.chunkCount ?? undefined,
              lastCheckedAtLabel: formatDate(subresource.lastCheckedAt),
              lastChangedAtLabel: formatDate(subresource.lastContentChangedAt),
            })),
          }
        : undefined,
    snippetMetadata:
      resource.kind === KbResourceKind.Snippet
        ? {
            characterCount: resource.snippetCharacterCount ?? undefined,
            language: resource.snippetLanguage ?? undefined,
            author: resource.snippetAuthor ?? undefined,
            note: resource.snippetNote ?? undefined,
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
      lastCheckedAtLabel: formatDate(resource.lastCheckedAt),
      lastRemoteModifiedAtLabel: formatDate(resource.lastRemoteModifiedAt),
      lastContentChangedAtLabel: formatDate(resource.lastContentChangedAt),
      nextCheckAtLabel: formatDate(resource.nextRefreshAt),
      changeStatus: 'unknown',
      changeStatusLabel: resource.changeStatus ?? 'Unknown',
      refreshPolicy: toRefreshPolicy({
        mode: resource.refreshMode,
        scope: resource.refreshScope,
        intervalMinutes: resource.refreshIntervalMinutes,
        cron: resource.refreshCron,
        changeMonitoring: resource.changeMonitoring,
      }),
      inheritedFromKnowledgeBase:
        resource.refreshMode === KbRefreshMode.Inherit,
    },
    ingestionRuns: resource.ingestionRuns.map((run) => ({
      id: run.id,
      label: run.trigger,
      status:
        run.status === 'SUCCEEDED'
          ? 'ready'
          : run.status === 'FAILED'
            ? 'error'
            : run.status === 'RUNNING'
              ? 'indexing'
              : 'queued',
    })),
  }
}
