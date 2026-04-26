import { CalendarDays, CheckCircle2, Circle } from 'lucide-react'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import type {
  KnowledgeBaseSettingsData,
  KnowledgeBaseSummary,
  KnowledgeMetadataFieldDefinition,
  KnowledgeRefreshMode,
  KnowledgeRefreshPolicy,
} from '../types.js'
import { getRefreshPolicyLabel } from '../utils.js'

interface KnowledgeBaseSettingsViewProps {
  knowledgeBase?: KnowledgeBaseSummary
  settingsData?: KnowledgeBaseSettingsData
  metadataSchema?: KnowledgeMetadataFieldDefinition[]
  resourceMetadataSchema?: KnowledgeMetadataFieldDefinition[]
  className?: string
  onUpdateKnowledgeBaseRefreshPolicy?: (
    knowledgeBaseId: string,
    policy: KnowledgeRefreshPolicy
  ) => void
}

const KNOWLEDGE_BASE_REFRESH_OPTIONS: {
  mode: KnowledgeRefreshMode
  label: string
  intervalLabel?: string
}[] = [
  { mode: 'manual', label: 'Manual only' },
  { mode: 'interval', label: 'Daily', intervalLabel: 'Daily' },
  { mode: 'interval', label: 'Weekly', intervalLabel: 'Weekly' },
  { mode: 'interval', label: 'Monthly', intervalLabel: 'Monthly' },
  { mode: 'disabled', label: 'Disabled' },
]

export function KnowledgeBaseSettingsView({
  knowledgeBase,
  settingsData,
  metadataSchema = [],
  resourceMetadataSchema = [],
  className,
  onUpdateKnowledgeBaseRefreshPolicy,
}: KnowledgeBaseSettingsViewProps) {
  if (!knowledgeBase) {
    return null
  }

  return (
    <div
      className={twMerge(
        'min-h-0 flex-1 overflow-auto bg-white p-4 sm:p-5',
        className
      )}
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Generation model" description="The LLM used for answers">
          <ModelOptions options={settingsData?.generationModels ?? []} />
        </Panel>

        <Panel
          title="Retrieval"
          description="How context is pulled per student message"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(settingsData?.retrievalSettings ?? []).map((setting) => (
              <label key={setting.id} className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">
                  {setting.label}
                </span>
                <input
                  readOnly
                  value={setting.value}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800"
                />
              </label>
            ))}
          </div>
        </Panel>

        <Panel title="Embedding model" description="Used to chunk and index">
          <ModelOptions options={settingsData?.embeddingModels ?? []} />
        </Panel>

        <Panel
          title="Cost"
          description="Live spend across this knowledge base"
          actionLabel="Set budget"
        >
          {settingsData?.costSummary ? (
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-3xl font-bold text-slate-950">
                    {settingsData.costSummary.currentSpendLabel}
                  </div>
                  <div className="text-xs text-slate-500">this month</div>
                </div>
                {settingsData.costSummary.budgetLabel && (
                  <div className="text-kb-ready text-right text-xs font-semibold">
                    {settingsData.costSummary.budgetLabel}
                  </div>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-primary-100 h-full w-[45%]" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {settingsData.costSummary.categories?.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-1 text-slate-600">
                      <span
                        className={twMerge(
                          'size-2 rounded-sm bg-slate-400',
                          category.colorClassName
                        )}
                      />
                      {category.label}
                    </span>
                    <span className="font-bold text-slate-800">
                      {category.valueLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptySetting>No cost data configured.</EmptySetting>
          )}
        </Panel>

        <Panel
          title="Refresh defaults"
          description="Default re-scrape and monitoring behavior"
        >
          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-950">
                {getRefreshPolicyLabel(knowledgeBase.refreshPolicy)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Resources can override this default when monitoring needs
                differ.
              </div>
            </div>
            {onUpdateKnowledgeBaseRefreshPolicy && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">
                  Default refresh cadence
                </span>
                <select
                  value={getRefreshOptionValue(knowledgeBase.refreshPolicy)}
                  onChange={(event) => {
                    const option = KNOWLEDGE_BASE_REFRESH_OPTIONS.find(
                      (item) =>
                        getRefreshOptionValue(item) ===
                        event.currentTarget.value
                    )

                    if (option) {
                      onUpdateKnowledgeBaseRefreshPolicy(knowledgeBase.id, {
                        mode: option.mode,
                        intervalLabel: option.intervalLabel,
                        label: option.label,
                        scope: 'refreshable',
                        changeMonitoring: true,
                      })
                    }
                  }}
                  className="focus:border-primary-100 focus:ring-primary-20 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:ring-2"
                >
                  {KNOWLEDGE_BASE_REFRESH_OPTIONS.map((option) => (
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
            {settingsData?.indexingSchedule && (
              <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                <div className="flex items-center gap-2 font-bold text-slate-950">
                  <CalendarDays className="text-primary-100 size-4" />
                  {settingsData.indexingSchedule.label}
                </div>
                {settingsData.indexingSchedule.nextRunLabel && (
                  <div className="mt-2 text-xs text-slate-600">
                    {settingsData.indexingSchedule.nextRunLabel}
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>

        <Panel
          title="Metadata"
          description="Fields available for retrieval filters and governance"
        >
          <MetadataSchemaList title="Knowledge base" fields={metadataSchema} />
          <div className="mt-4">
            <MetadataSchemaList
              title="Resources"
              fields={resourceMetadataSchema}
            />
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Panel({
  title,
  description,
  actionLabel,
  children,
}: {
  title: string
  description?: string
  actionLabel?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-950">{title}</h2>
          {description && (
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          )}
        </div>
        {actionLabel && (
          <button
            type="button"
            className="text-primary-100 text-xs font-semibold hover:underline"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

function ModelOptions({
  options,
}: {
  options: NonNullable<KnowledgeBaseSettingsData['generationModels']>
}) {
  if (options.length === 0) {
    return <EmptySetting>No model options configured.</EmptySetting>
  }

  return (
    <div className="space-y-2">
      {options.map((option) => {
        const active = option.active

        return (
          <div
            key={option.id}
            className={twMerge(
              'flex items-center gap-3 rounded-md border border-slate-200 p-3',
              active && 'border-primary-40 bg-primary-20'
            )}
          >
            {active ? (
              <CheckCircle2 className="text-primary-100 size-5 shrink-0" />
            ) : (
              <Circle className="size-5 shrink-0 text-slate-300" />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-950">{option.name}</span>
                {active && (
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                    Active
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {option.description}
                {option.costLabel ? ` - ${option.costLabel}` : ''}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MetadataSchemaList({
  title,
  fields,
}: {
  title: string
  fields: KnowledgeMetadataFieldDefinition[]
}) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      {fields.length === 0 ? (
        <EmptySetting>No metadata fields configured.</EmptySetting>
      ) : (
        <div className="mt-2 space-y-2">
          {fields.map((field) => (
            <div
              key={field.id}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800">
                  {field.label}
                </span>
                <span className="text-xs text-slate-500">{field.type}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-semibold">
                {field.retrievalKey && (
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">
                    retrieval
                  </span>
                )}
                {field.filterable && (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700">
                    filterable
                  </span>
                )}
                {field.required && (
                  <span className="rounded bg-orange-100 px-1.5 py-0.5 text-orange-700">
                    required
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptySetting({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
      {children}
    </div>
  )
}

function getRefreshOptionValue(
  policy?: Pick<KnowledgeRefreshPolicy, 'mode' | 'intervalLabel'>
) {
  if (!policy) {
    return 'manual'
  }

  if (policy.mode === 'interval' && policy.intervalLabel) {
    return `${policy.mode}:${policy.intervalLabel}`
  }

  return policy.mode
}
