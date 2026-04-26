import { Button } from '@uzh-bf/design-system'
import { Plus, Search, Upload } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import type { KnowledgeResourceFilterState } from '../types.js'

interface ResourceFiltersProps {
  filterState: KnowledgeResourceFilterState
  className?: string
  onChange: (nextState: KnowledgeResourceFilterState) => void
  onAddResource?: () => void
  onUpload?: () => void
}

export function ResourceFilters({
  filterState,
  className,
  onChange,
  onAddResource,
  onUpload,
}: ResourceFiltersProps) {
  return (
    <div
      className={twMerge(
        'flex min-w-0 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5',
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <label className="relative min-w-44 flex-1 sm:max-w-64">
            <span className="sr-only">Search resources</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={filterState.query}
              onChange={(event) =>
                onChange({ ...filterState, query: event.currentTarget.value })
              }
              placeholder="Search resources"
              className="focus:border-primary-100 focus:ring-primary-20 h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2"
            />
          </label>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            onClick={onUpload}
            className={{
              root: 'h-9 w-full min-w-0 justify-center gap-2 whitespace-nowrap sm:w-auto',
            }}
          >
            <Upload className="size-4" />
            Upload
          </Button>
          <Button
            onClick={onAddResource}
            className={{
              root: 'h-9 w-full min-w-0 justify-center gap-2 whitespace-nowrap sm:w-auto',
            }}
          >
            <Plus className="size-4" />
            Add resource
          </Button>
        </div>
      </div>
    </div>
  )
}
