import type {
  ColumnDef,
  ColumnFiltersState,
  ExpandedState,
  SortingState,
} from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Button } from '@uzh-bf/design-system'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Fragment, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import type {
  KnowledgeMetadataFieldDefinition,
  KnowledgeRefreshPolicy,
  KnowledgeResource,
  KnowledgeResourceFilterState,
  KnowledgeResourceStatus,
  KnowledgeResourceTypeDefinition,
  WebsiteSubsiteSummary,
} from '../types.js'
import {
  DEFAULT_RESOURCE_TYPES,
  formatMetadataValue,
  getRefreshPolicyLabel,
  getResourceTypeDefinition,
  getStatusLabel,
} from '../utils.js'
import { MetadataChips } from './MetadataChips.js'
import { ResourceTypeIcon } from './ResourceTypeIcon.js'
import { StatusBadge } from './StatusBadge.js'

interface ResourceTableProps {
  resources: KnowledgeResource[]
  selectedResourceId?: string
  selectedResourceIds: string[]
  metadataSchema?: KnowledgeMetadataFieldDefinition[]
  resourceTypes?: KnowledgeResourceTypeDefinition[]
  filterState: KnowledgeResourceFilterState
  knowledgeBaseRefreshPolicy?: KnowledgeRefreshPolicy
  className?: string
  onFilterStateChange: (nextState: KnowledgeResourceFilterState) => void
  onSelectResource?: (resourceId: string) => void
  onToggleResourceSelection: (resourceId: string) => void
  onDeleteSelected?: () => void
}

const STATUS_FILTERS: KnowledgeResourceStatus[] = [
  'ready',
  'queued',
  'indexing',
  'crawling',
  'stale',
  'error',
  'disabled',
]

export function ResourceTable({
  resources,
  selectedResourceId,
  selectedResourceIds,
  metadataSchema = [],
  resourceTypes = DEFAULT_RESOURCE_TYPES,
  filterState,
  knowledgeBaseRefreshPolicy,
  className,
  onFilterStateChange,
  onSelectResource,
  onToggleResourceSelection,
  onDeleteSelected,
}: ResourceTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'resource', desc: false },
  ])
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const columnFilters = useMemo(
    () => getColumnFilters(filterState),
    [filterState]
  )

  const columns = useMemo<ColumnDef<KnowledgeResource>[]>(
    () => [
      {
        id: 'select',
        header: '',
        size: 64,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => {
          const resource = row.original
          const expandable = row.getCanExpand()

          return (
            <div className="flex items-center gap-1">
              <input
                type="checkbox"
                aria-label={`Select ${resource.title}`}
                checked={selectedResourceIds.includes(resource.id)}
                onChange={() => onToggleResourceSelection(resource.id)}
                className="text-primary-100 focus:ring-primary-100 size-4 rounded border-slate-300"
              />
              {expandable ? (
                <button
                  type="button"
                  aria-label={
                    row.getIsExpanded()
                      ? `Collapse ${resource.title}`
                      : `Expand ${resource.title}`
                  }
                  onClick={row.getToggleExpandedHandler()}
                  className="rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  {row.getIsExpanded() ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </button>
              ) : (
                <span className="size-5" />
              )}
            </div>
          )
        },
      },
      {
        id: 'resource',
        header: 'Resource',
        accessorFn: (resource) => resource.title,
        size: 300,
        cell: ({ row }) => {
          const resource = row.original
          const typeDefinition = getResourceTypeDefinition(
            resource.type,
            resourceTypes
          )

          return (
            <button
              type="button"
              className="flex min-w-0 items-start gap-3 text-left"
              onClick={() => onSelectResource?.(resource.id)}
            >
              <ResourceTypeIcon definition={typeDefinition} />
              <span className="min-w-0">
                <span className="block truncate font-bold text-slate-950">
                  {resource.title}
                </span>
                <span className="mt-1 block truncate text-xs text-slate-500">
                  {resource.originLabel}
                  {resource.originDetail ? ` - ${resource.originDetail}` : ''}
                </span>
                {resource.updatedAtLabel && (
                  <span className="mt-1 block truncate text-xs text-slate-500">
                    Updated {resource.updatedAtLabel}
                  </span>
                )}
              </span>
            </button>
          )
        },
      },
      {
        id: 'type',
        header: 'Type',
        accessorFn: (resource) => resource.type,
        size: 145,
        filterFn: 'equals',
        sortingFn: (left, right) =>
          getResourceTypeDefinition(
            left.original.type,
            resourceTypes
          ).label.localeCompare(
            getResourceTypeDefinition(right.original.type, resourceTypes).label,
            undefined,
            { sensitivity: 'base' }
          ),
        cell: ({ row }) => {
          const resource = row.original
          const typeDefinition = getResourceTypeDefinition(
            resource.type,
            resourceTypes
          )

          return (
            <div className="text-slate-600">
              <span className="font-semibold text-slate-800">
                {typeDefinition.label}
              </span>
              <ResourceSpecificMetadata resource={resource} />
            </div>
          )
        },
      },
      {
        id: 'metadata',
        header: 'Metadata',
        accessorFn: (resource) =>
          metadataSchema
            .map((field) =>
              formatMetadataValue(field, resource.metadata?.[field.id])
            )
            .filter(Boolean)
            .join(' '),
        size: 210,
        filterFn: (row, _columnId, value) => {
          if (!value || typeof value !== 'string') return true
          const [fieldId, optionId] = value.split('::')
          if (!fieldId || !optionId) return true
          const fieldValue = row.original.metadata?.[fieldId]
          const values = Array.isArray(fieldValue)
            ? fieldValue.map(String)
            : [String(fieldValue)]

          return values.includes(optionId)
        },
        cell: ({ row }) => (
          <MetadataChips
            schema={metadataSchema}
            values={row.original.metadata}
            visibility="table"
            maxVisible={2}
            emptyLabel="No metadata"
          />
        ),
      },
      {
        id: 'freshness',
        header: 'Freshness',
        accessorFn: (resource) =>
          [
            resource.freshness?.lastCheckedAtLabel,
            resource.freshness?.nextCheckAtLabel,
          ]
            .filter(Boolean)
            .join(' '),
        size: 190,
        cell: ({ row }) => (
          <FreshnessSummary
            resource={row.original}
            knowledgeBaseRefreshPolicy={knowledgeBaseRefreshPolicy}
          />
        ),
      },
      {
        id: 'chunks',
        header: 'Chunks',
        accessorFn: (resource) => resource.chunkCount ?? -1,
        size: 86,
        cell: ({ row }) =>
          typeof row.original.chunkCount === 'number'
            ? row.original.chunkCount
            : '-',
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (resource) => resource.status,
        size: 150,
        filterFn: 'equals',
        sortingFn: (left, right) =>
          getStatusLabel(left.original.status).localeCompare(
            getStatusLabel(right.original.status),
            undefined,
            { sensitivity: 'base' }
          ),
        cell: ({ row }) => {
          const resource = row.original

          return (
            <div className="space-y-1">
              <StatusBadge
                status={resource.status}
                label={resource.statusLabel}
              />
              {typeof resource.progress === 'number' && (
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="bg-primary-100 h-full"
                    style={{ width: `${resource.progress}%` }}
                  />
                </div>
              )}
              {resource.statusMessage && (
                <div className="text-kb-error max-w-36 text-xs">
                  {resource.statusMessage}
                </div>
              )}
            </div>
          )
        },
      },
    ],
    [
      knowledgeBaseRefreshPolicy,
      metadataSchema,
      onSelectResource,
      onToggleResourceSelection,
      resourceTypes,
      selectedResourceIds,
    ]
  )

  const table = useReactTable({
    data: resources,
    columns,
    state: {
      sorting,
      expanded,
      columnFilters,
    },
    getRowId: (row) => row.id,
    getRowCanExpand: (row) =>
      Boolean(row.original.websiteMetadata?.subsites?.length),
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  })

  const rows = table.getRowModel().rows

  const setTypeFilter = (type: string) => {
    onFilterStateChange({ ...filterState, type })
  }

  const setStatusFilter = (status: string) => {
    onFilterStateChange({
      ...filterState,
      status: status === 'all' ? 'all' : (status as KnowledgeResourceStatus),
    })
  }

  const setMetadataFilter = (value: string) => {
    if (!value) {
      onFilterStateChange({ ...filterState, metadata: undefined })
      return
    }

    const [fieldId, optionId] = value.split('::')
    onFilterStateChange({
      ...filterState,
      metadata: fieldId && optionId ? { [fieldId]: [optionId] } : undefined,
    })
  }

  return (
    <div className={twMerge('min-h-0 flex-1 overflow-hidden', className)}>
      {selectedResourceIds.length > 0 && (
        <div className="flex h-11 items-center justify-between border-b border-slate-200 bg-blue-50 px-5 text-sm">
          <span className="font-semibold text-blue-900">
            {selectedResourceIds.length} selected
          </span>
          <Button
            onClick={onDeleteSelected}
            className={{
              root: 'h-8 gap-2 border-red-200 bg-white text-red-700 hover:bg-red-50',
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      )}
      <div className="h-full overflow-auto">
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <DataTableHeader
                    key={header.id}
                    className={getColumnClassName(header.column.id)}
                    canSort={header.column.getCanSort()}
                    sorted={header.column.getIsSorted()}
                    onSort={header.column.getToggleSortingHandler()}
                    label={
                      header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )
                    }
                    filter={
                      <>
                        {header.column.id === 'type' && (
                          <select
                            value={filterState.type}
                            onChange={(event) =>
                              setTypeFilter(event.currentTarget.value)
                            }
                            className="mt-1 h-7 w-full rounded border border-slate-300 bg-white px-1 text-xs normal-case tracking-normal text-slate-700"
                          >
                            <option value="all">All types</option>
                            {resourceTypes.map((resourceType) => (
                              <option
                                key={resourceType.id}
                                value={resourceType.id}
                              >
                                {resourceType.label}
                              </option>
                            ))}
                          </select>
                        )}
                        {header.column.id === 'metadata' && (
                          <select
                            value={getActiveMetadataFilter(
                              filterState.metadata
                            )}
                            onChange={(event) =>
                              setMetadataFilter(event.currentTarget.value)
                            }
                            className="mt-1 h-7 w-full rounded border border-slate-300 bg-white px-1 text-xs normal-case tracking-normal text-slate-700"
                          >
                            <option value="">Any metadata</option>
                            {metadataSchema
                              .filter((field) => field.options?.length)
                              .flatMap((field) =>
                                field.options!.map((option) => (
                                  <option
                                    key={`${field.id}::${option.id}`}
                                    value={`${field.id}::${option.id}`}
                                  >
                                    {field.label}: {option.label}
                                  </option>
                                ))
                              )}
                          </select>
                        )}
                        {header.column.id === 'status' && (
                          <select
                            value={filterState.status ?? 'all'}
                            onChange={(event) =>
                              setStatusFilter(event.currentTarget.value)
                            }
                            className="mt-1 h-7 w-full rounded border border-slate-300 bg-white px-1 text-xs normal-case tracking-normal text-slate-700"
                          >
                            <option value="all">All status</option>
                            {STATUS_FILTERS.map((status) => (
                              <option key={status} value={status}>
                                {getStatusLabel(status)}
                              </option>
                            ))}
                          </select>
                        )}
                      </>
                    }
                  ></DataTableHeader>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getAllLeafColumns().length}
                  className="px-5 py-16 text-center"
                >
                  <div className="font-semibold text-slate-800">
                    No resources match the current filters.
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Clear the search or add a new resource.
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const resource = row.original
                const selected = resource.id === selectedResourceId

                return (
                  <Fragment key={row.id}>
                    <tr
                      className={twMerge(
                        'border-t border-slate-100 bg-white transition hover:bg-slate-50',
                        selected && 'bg-blue-50 hover:bg-blue-50'
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={twMerge(
                            'px-2 py-3 align-middle',
                            cell.column.id === 'chunks' && 'text-slate-700'
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                    {row.getIsExpanded() && (
                      <tr className="border-t border-slate-100 bg-slate-50">
                        <td
                          colSpan={row.getVisibleCells().length}
                          className="px-6 py-3"
                        >
                          <SubsitesPanel
                            resource={resource}
                            subsites={resource.websiteMetadata?.subsites ?? []}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DataTableHeader({
  label,
  filter,
  canSort,
  sorted,
  className,
  onSort,
}: {
  label?: ReactNode
  filter?: ReactNode
  canSort?: boolean
  sorted: false | 'asc' | 'desc'
  className?: string
  onSort?: React.MouseEventHandler<HTMLButtonElement>
}) {
  return (
    <th className={twMerge('px-2 py-2 align-top', className)}>
      {canSort ? (
        <button
          type="button"
          className={twMerge(
            'flex items-center gap-1 text-left uppercase tracking-wide text-slate-500 hover:text-slate-800',
            sorted && 'text-primary-100'
          )}
          onClick={onSort}
        >
          <span>{label}</span>
          <span className="text-[10px]">
            {sorted ? sorted.toUpperCase() : 'SORT'}
          </span>
        </button>
      ) : (
        <span>{label}</span>
      )}
      {filter}
    </th>
  )
}

function SubsitesPanel({
  resource,
  subsites,
}: {
  resource: KnowledgeResource
  subsites: WebsiteSubsiteSummary[]
}) {
  if (!subsites.length) {
    return null
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-bold text-slate-950">Scraped subsites</div>
          <div className="mt-1 text-xs text-slate-500">
            {resource.websiteMetadata?.sitemapFound
              ? `${resource.websiteMetadata.sitemapPageCount ?? subsites.length} pages in sitemap`
              : `${resource.websiteMetadata?.scrapedPageCount ?? subsites.length} pages scraped`}
          </div>
        </div>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
          {subsites.length} shown
        </span>
      </div>
      <div className="mt-3 divide-y divide-slate-100">
        {subsites.map((subsite) => (
          <div
            key={subsite.id}
            className="grid gap-2 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_80px_90px_110px]"
          >
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-800">
                {subsite.title}
              </div>
              <div className="truncate text-slate-500">{subsite.url}</div>
            </div>
            <div className="text-slate-600">
              {typeof subsite.chunkCount === 'number'
                ? `${subsite.chunkCount} chunks`
                : '-'}
            </div>
            <div className="text-slate-600">
              {subsite.lastCheckedAtLabel ?? '-'}
            </div>
            <StatusBadge
              status={subsite.status ?? 'queued'}
              label={subsite.status ? getStatusLabel(subsite.status) : 'Queued'}
              className="text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function ResourceSpecificMetadata({
  resource,
}: {
  resource: KnowledgeResource
}) {
  const parts: string[] = []

  if (resource.documentMetadata) {
    if (resource.documentMetadata.pageCount) {
      parts.push(`${resource.documentMetadata.pageCount} pages`)
    }
    if (resource.documentMetadata.fileSizeLabel) {
      parts.push(resource.documentMetadata.fileSizeLabel)
    }
    if (resource.documentMetadata.language) {
      parts.push(resource.documentMetadata.language)
    }
  }

  if (resource.websiteMetadata) {
    const strategy =
      resource.websiteMetadata.strategyLabel ??
      getWebsiteStrategyLabel(resource.websiteMetadata.strategy)
    parts.push(strategy)

    if (resource.websiteMetadata.strategy === 'S') {
      if (resource.websiteMetadata.sitemapFound) {
        parts.push(
          `${resource.websiteMetadata.sitemapPageCount ?? 0} sitemap pages`
        )
      } else if (resource.websiteMetadata.scrapedPageCount) {
        parts.push(`${resource.websiteMetadata.scrapedPageCount} scraped`)
      } else {
        parts.push('no sitemap')
      }
    }
  }

  if (resource.snippetMetadata) {
    if (resource.snippetMetadata.characterCount) {
      parts.push(`${resource.snippetMetadata.characterCount} chars`)
    }
    if (resource.snippetMetadata.language) {
      parts.push(resource.snippetMetadata.language)
    }
  }

  if (resource.internalMetadata) {
    if (resource.internalMetadata.provider) {
      parts.push(resource.internalMetadata.provider)
    }
    if (resource.internalMetadata.objectType) {
      parts.push(resource.internalMetadata.objectType)
    }
    if (resource.internalMetadata.itemCount) {
      parts.push(`${resource.internalMetadata.itemCount} items`)
    }
  }

  if (parts.length === 0) {
    return null
  }

  return (
    <span className="mt-1 block truncate text-xs text-slate-500">
      {parts.join(' - ')}
    </span>
  )
}

function FreshnessSummary({
  resource,
  knowledgeBaseRefreshPolicy,
}: {
  resource: KnowledgeResource
  knowledgeBaseRefreshPolicy?: KnowledgeRefreshPolicy
}) {
  const freshness = resource.freshness
  const policy =
    freshness?.refreshPolicy?.mode === 'inherit'
      ? knowledgeBaseRefreshPolicy
      : freshness?.refreshPolicy

  return (
    <div className="space-y-1 text-xs">
      <div className="font-semibold text-slate-800">
        {freshness?.lastCheckedAtLabel
          ? `Checked ${freshness.lastCheckedAtLabel}`
          : 'Not checked'}
      </div>
      <div className="text-slate-500">
        {freshness?.lastContentChangedAtLabel
          ? `Changed ${freshness.lastContentChangedAtLabel}`
          : (freshness?.changeStatusLabel ?? 'Change status unknown')}
      </div>
      <div className="text-slate-500">
        {freshness?.nextCheckAtLabel
          ? `Next ${freshness.nextCheckAtLabel}`
          : getRefreshPolicyLabel(policy)}
      </div>
    </div>
  )
}

function getWebsiteStrategyLabel(strategy: 'S' | 'I' | 'K') {
  if (strategy === 'S') {
    return 'S scrape subsites'
  }

  if (strategy === 'I') {
    return 'I index only'
  }

  return 'K reference only'
}

function getColumnClassName(columnId: string) {
  if (columnId === 'select') return 'w-16'
  if (columnId === 'resource') return 'w-[28%]'
  if (columnId === 'type') return 'w-[13%]'
  if (columnId === 'metadata') return 'w-[19%]'
  if (columnId === 'freshness') return 'w-[17%]'
  if (columnId === 'chunks') return 'w-[8%]'
  return 'w-[15%]'
}

function getColumnFilters(
  filterState: KnowledgeResourceFilterState
): ColumnFiltersState {
  const filters: ColumnFiltersState = []

  if (filterState.type !== 'all') {
    filters.push({ id: 'type', value: filterState.type })
  }

  if (filterState.status && filterState.status !== 'all') {
    filters.push({ id: 'status', value: filterState.status })
  }

  const metadataFilter = getActiveMetadataFilter(filterState.metadata)

  if (metadataFilter) {
    filters.push({ id: 'metadata', value: metadataFilter })
  }

  return filters
}

function getActiveMetadataFilter(metadata?: Record<string, string[]>) {
  const [fieldId, values] = Object.entries(metadata ?? {})[0] ?? []
  const optionId = values?.[0]

  return fieldId && optionId ? `${fieldId}::${optionId}` : ''
}
