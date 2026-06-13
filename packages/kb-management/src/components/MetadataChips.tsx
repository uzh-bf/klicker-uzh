import { twMerge } from 'tailwind-merge'
import type {
  KnowledgeMetadataFieldDefinition,
  KnowledgeMetadataValue,
} from '../types.js'
import {
  formatMetadataValue,
  getMetadataOptionClassName,
  getVisibleMetadataFields,
} from '../utils.js'

interface MetadataChipsProps {
  schema: KnowledgeMetadataFieldDefinition[]
  values?: Record<string, KnowledgeMetadataValue>
  visibility: 'sidebar' | 'header' | 'table' | 'popover' | 'settings'
  maxInline?: number
  maxVisible?: number
  className?: string
  emptyLabel?: string
}

export function MetadataChips({
  schema,
  values,
  visibility,
  maxInline = 3,
  maxVisible,
  className,
  emptyLabel = 'No metadata',
}: MetadataChipsProps) {
  const fields = getVisibleMetadataFields(schema, visibility)
  const rows = fields
    .map((field) => ({
      field,
      value: formatMetadataValue(field, values?.[field.id]),
    }))
    .filter((row) => row.value || row.field.recommended)

  if (rows.length === 0) {
    if (!emptyLabel) {
      return null
    }

    return <span className="text-xs text-slate-400">{emptyLabel}</span>
  }

  const inlineLimit = maxVisible ?? maxInline
  const inlineRows = rows.slice(0, inlineLimit)

  return (
    <span
      className={twMerge(
        'group relative inline-flex max-w-full flex-wrap gap-1',
        className
      )}
      tabIndex={0}
    >
      {inlineRows.map(({ field, value }) => (
        <span
          key={field.id}
          className={twMerge(
            'inline-flex max-w-40 items-center gap-1 truncate rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-700',
            value &&
              !Array.isArray(values?.[field.id]) &&
              getMetadataOptionClassName(field, String(values?.[field.id]))
          )}
          title={`${field.label}: ${value ?? 'Not set'}`}
        >
          {field.retrievalKey && <span className="text-primary-100">R</span>}
          <span className="truncate">{value ?? 'Not set'}</span>
        </span>
      ))}
      {rows.length > inlineLimit && (
        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
          +{rows.length - inlineLimit}
        </span>
      )}

      <span className="invisible absolute left-0 top-full z-30 mt-2 w-72 rounded-md border border-slate-200 bg-white p-3 text-left text-xs opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <span className="mb-2 block font-bold uppercase tracking-wide text-slate-500">
          Metadata
        </span>
        <span className="space-y-2">
          {rows.map(({ field, value }) => (
            <span
              key={field.id}
              className="flex items-start justify-between gap-3 border-b border-slate-100 pb-1 last:border-0 last:pb-0"
            >
              <span className="text-slate-500">
                {field.label}
                {field.retrievalKey && (
                  <span className="text-primary-100 ml-1">retrieval</span>
                )}
              </span>
              <span className="max-w-40 text-right font-semibold text-slate-800">
                {value ?? 'Not set'}
              </span>
            </span>
          ))}
        </span>
      </span>
    </span>
  )
}
