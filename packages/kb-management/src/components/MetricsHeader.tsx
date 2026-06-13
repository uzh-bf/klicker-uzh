import { Button } from '@uzh-bf/design-system'
import { Plus, RefreshCw, Settings } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import type {
  KnowledgeBaseSummary,
  KnowledgeMetadataFieldDefinition,
} from '../types.js'
import { getRefreshPolicyLabel } from '../utils.js'
import { MetadataChips } from './MetadataChips.js'
import { StatusBadge } from './StatusBadge.js'

interface MetricsHeaderProps {
  knowledgeBase?: KnowledgeBaseSummary
  metadataSchema?: KnowledgeMetadataFieldDefinition[]
  className?: string
  onAddResource?: () => void
  onOpenSettings?: () => void
  onReindex?: () => void
}

export function MetricsHeader({
  knowledgeBase,
  metadataSchema = [],
  className,
  onAddResource,
  onOpenSettings,
  onReindex,
}: MetricsHeaderProps) {
  if (!knowledgeBase) {
    return null
  }

  const schema = knowledgeBase.metadataSchema ?? metadataSchema

  return (
    <header
      className={twMerge(
        'flex min-w-0 flex-col gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-5',
        className
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-950">
              {knowledgeBase.name}
            </h1>
            <StatusBadge
              status={knowledgeBase.status}
              label={knowledgeBase.statusLabel}
            />
          </div>
          {knowledgeBase.description && (
            <p className="mt-2 text-sm text-slate-600">
              {knowledgeBase.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {schema.length > 0 && (
              <MetadataChips
                schema={schema}
                values={knowledgeBase.metadata}
                visibility="header"
                maxVisible={4}
                emptyLabel=""
              />
            )}
            {knowledgeBase.refreshPolicy && (
              <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
                Refresh {getRefreshPolicyLabel(knowledgeBase.refreshPolicy)}
              </span>
            )}
            {knowledgeBase.updatedAtLabel && (
              <span className="text-xs text-slate-500">
                Updated {knowledgeBase.updatedAtLabel}
              </span>
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            onClick={onReindex}
            className={{
              root: 'h-9 w-full min-w-0 justify-center gap-2 whitespace-nowrap sm:w-auto',
            }}
          >
            <RefreshCw className="size-4" />
            Reindex all
          </Button>
          <Button
            onClick={onOpenSettings}
            className={{
              root: 'h-9 w-full min-w-0 justify-center gap-2 whitespace-nowrap sm:w-auto',
            }}
          >
            <Settings className="size-4" />
            Settings
          </Button>
          <Button
            onClick={onAddResource}
            className={{
              root: 'bg-primary-100 hover:bg-primary-100/90 h-9 w-full min-w-0 justify-center gap-2 whitespace-nowrap text-white sm:w-auto',
            }}
          >
            <Plus className="size-4" />
            Add resource
          </Button>
        </div>
      </div>
      {knowledgeBase.metrics && knowledgeBase.metrics.length > 0 && (
        <dl className="grid min-w-0 grid-cols-2 gap-4 text-sm sm:grid-cols-3 xl:flex xl:flex-wrap">
          {knowledgeBase.metrics.map((metric) => (
            <div key={metric.id} className="min-w-0 xl:min-w-24">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {metric.label}
              </dt>
              <dd className="mt-1 break-words text-lg font-bold leading-none text-slate-950">
                {metric.value}
              </dd>
              {metric.hint && (
                <div className="mt-1 text-xs text-slate-500">{metric.hint}</div>
              )}
            </div>
          ))}
        </dl>
      )}
    </header>
  )
}
