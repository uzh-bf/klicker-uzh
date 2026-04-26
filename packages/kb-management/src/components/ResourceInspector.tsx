import { Button } from '@uzh-bf/design-system'
import { Eye, RefreshCw } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import type {
  KnowledgeMetadataFieldDefinition,
  KnowledgeRefreshMode,
  KnowledgeRefreshPolicy,
  KnowledgeResource,
  KnowledgeResourceTypeDefinition,
} from '../types.js'
import {
  DEFAULT_RESOURCE_TYPES,
  getRefreshPolicyLabel,
  getResourceTypeDefinition,
} from '../utils.js'
import { ActivityPanels } from './ActivityPanels.js'
import { MetadataChips } from './MetadataChips.js'
import { ResourceTypeIcon } from './ResourceTypeIcon.js'
import { StatusBadge } from './StatusBadge.js'

interface ResourceInspectorProps {
  resource?: KnowledgeResource
  metadataSchema?: KnowledgeMetadataFieldDefinition[]
  resourceTypes?: KnowledgeResourceTypeDefinition[]
  knowledgeBaseRefreshPolicy?: KnowledgeRefreshPolicy
  className?: string
  onReindexResource?: (resourceId: string) => void
  onUpdateResourceRefreshPolicy?: (
    resourceId: string,
    policy: KnowledgeRefreshPolicy
  ) => void
}

const RESOURCE_REFRESH_OPTIONS: {
  mode: KnowledgeRefreshMode
  label: string
  intervalLabel?: string
}[] = [
  { mode: 'inherit', label: 'Inherit KB default' },
  { mode: 'manual', label: 'Manual only' },
  { mode: 'interval', label: 'Daily', intervalLabel: 'Daily' },
  { mode: 'interval', label: 'Weekly', intervalLabel: 'Weekly' },
  { mode: 'disabled', label: 'Disabled' },
]

export function ResourceInspector({
  resource,
  metadataSchema = [],
  resourceTypes = DEFAULT_RESOURCE_TYPES,
  knowledgeBaseRefreshPolicy,
  className,
  onReindexResource,
  onUpdateResourceRefreshPolicy,
}: ResourceInspectorProps) {
  if (!resource) {
    return (
      <aside
        className={twMerge(
          'flex min-h-0 flex-col border-l border-slate-200 bg-slate-50',
          className
        )}
      >
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
          Select a resource to preview chunks and ingestion details.
        </div>
      </aside>
    )
  }

  const typeDefinition = getResourceTypeDefinition(resource.type, resourceTypes)
  const refreshPolicy = resource.freshness?.refreshPolicy
  const policyLabel =
    refreshPolicy?.mode === 'inherit'
      ? `Inherited: ${getRefreshPolicyLabel(knowledgeBaseRefreshPolicy)}`
      : getRefreshPolicyLabel(refreshPolicy)

  return (
    <aside
      className={twMerge(
        'flex min-h-0 flex-col border-l border-slate-200 bg-slate-50',
        className
      )}
    >
      <div className="border-b border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <ResourceTypeIcon definition={typeDefinition} className="size-8" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold text-slate-950">
              {resource.title}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{resource.originLabel}</span>
              {resource.chunkCount && <span>{resource.chunkCount} chunks</span>}
              {resource.updatedAtLabel && (
                <span>updated {resource.updatedAtLabel}</span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button className={{ root: 'h-8 flex-1 gap-2' }}>
            <Eye className="size-4" />
            Preview
          </Button>
          <Button
            onClick={() => onReindexResource?.(resource.id)}
            className={{ root: 'h-8 flex-1 gap-2' }}
          >
            <RefreshCw className="size-4" />
            Reindex
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Status
          </h3>
          <div className="mt-2 space-y-3 rounded-md border border-slate-200 bg-white p-3">
            <StatusBadge
              status={resource.status}
              label={resource.statusLabel}
            />
            {resource.statusMessage && (
              <p className="text-kb-error text-xs">{resource.statusMessage}</p>
            )}
            <ResourceSpecificMetadata resource={resource} />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Metadata
          </h3>
          <div className="mt-2 rounded-md border border-slate-200 bg-white p-3">
            <MetadataChips
              schema={metadataSchema}
              values={resource.metadata}
              visibility="popover"
              maxVisible={6}
              emptyLabel="No metadata configured"
            />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Freshness
          </h3>
          <div className="mt-2 space-y-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Fact
                label="Last checked"
                value={resource.freshness?.lastCheckedAtLabel ?? '-'}
              />
              <Fact
                label="Last indexed"
                value={resource.freshness?.lastIndexedAtLabel ?? '-'}
              />
              <Fact
                label="Remote changed"
                value={resource.freshness?.lastRemoteModifiedAtLabel ?? '-'}
              />
              <Fact
                label="Next check"
                value={resource.freshness?.nextCheckAtLabel ?? '-'}
              />
            </div>
            <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">
                Refresh policy:
              </span>{' '}
              {policyLabel}
            </div>
            {onUpdateResourceRefreshPolicy && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">
                  Override policy
                </span>
                <select
                  value={getRefreshOptionValue(refreshPolicy)}
                  onChange={(event) => {
                    const option = RESOURCE_REFRESH_OPTIONS.find(
                      (item) =>
                        getRefreshOptionValue(item) ===
                        event.currentTarget.value
                    )

                    if (option) {
                      onUpdateResourceRefreshPolicy(resource.id, {
                        mode: option.mode,
                        intervalLabel: option.intervalLabel,
                        label: option.label,
                      })
                    }
                  }}
                  className="focus:border-primary-100 focus:ring-primary-20 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:ring-2"
                >
                  {RESOURCE_REFRESH_OPTIONS.map((option) => (
                    <option
                      key={getRefreshOptionValue(option)}
                      value={getRefreshOptionValue(option)}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>

        {resource.chunkPreviews && resource.chunkPreviews.length > 0 && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Chunks preview
            </h3>
            <div className="mt-2 space-y-2">
              {resource.chunkPreviews.map((chunk) => (
                <article
                  key={chunk.id}
                  className="rounded-md border border-slate-200 bg-white p-3 text-sm"
                >
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>{chunk.label ?? chunk.id}</span>
                    {chunk.pageLabel && <span>{chunk.pageLabel}</span>}
                  </div>
                  <p className="leading-relaxed text-slate-700">
                    {chunk.content}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        <ActivityPanels
          linkedConsumers={resource.linkedConsumers}
          reindexSchedule={resource.reindexSchedule}
          ingestionRuns={resource.ingestionRuns}
        />
      </div>
    </aside>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-bold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 font-semibold text-slate-800">{value}</div>
    </div>
  )
}

function ResourceSpecificMetadata({
  resource,
}: {
  resource: KnowledgeResource
}) {
  const facts: { label: string; value?: string | number | boolean }[] = []

  if (resource.documentMetadata) {
    facts.push(
      { label: 'Pages', value: resource.documentMetadata.pageCount },
      { label: 'File size', value: resource.documentMetadata.fileSizeLabel },
      { label: 'MIME', value: resource.documentMetadata.mimeType },
      { label: 'Author', value: resource.documentMetadata.author }
    )
  }

  if (resource.websiteMetadata) {
    facts.push(
      { label: 'Strategy', value: resource.websiteMetadata.strategyLabel },
      {
        label: 'Sitemap',
        value: resource.websiteMetadata.sitemapFound
          ? `${resource.websiteMetadata.sitemapPageCount ?? 0} pages`
          : 'Not found',
      },
      {
        label: 'Scraped',
        value: resource.websiteMetadata.scrapedPageCount
          ? `${resource.websiteMetadata.scrapedPageCount} pages`
          : undefined,
      }
    )
  }

  if (resource.snippetMetadata) {
    facts.push(
      { label: 'Characters', value: resource.snippetMetadata.characterCount },
      { label: 'Language', value: resource.snippetMetadata.language },
      { label: 'Author', value: resource.snippetMetadata.author }
    )
  }

  if (resource.internalMetadata) {
    facts.push(
      { label: 'Provider', value: resource.internalMetadata.provider },
      { label: 'Object type', value: resource.internalMetadata.objectType },
      { label: 'Scope', value: resource.internalMetadata.scopeLabel },
      { label: 'Items', value: resource.internalMetadata.itemCount }
    )
  }

  const visibleFacts = facts.filter(
    (fact) =>
      fact.value !== undefined && fact.value !== null && fact.value !== ''
  )

  if (visibleFacts.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {visibleFacts.map((fact) => (
        <Fact key={fact.label} label={fact.label} value={String(fact.value)} />
      ))}
    </div>
  )
}

function getRefreshOptionValue(
  policy?: Pick<KnowledgeRefreshPolicy, 'mode' | 'intervalLabel'>
) {
  if (!policy || policy.mode === 'inherit') {
    return 'inherit'
  }

  if (policy.mode === 'interval' && policy.intervalLabel) {
    return `${policy.mode}:${policy.intervalLabel}`
  }

  return policy.mode
}
