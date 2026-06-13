import { Button } from '@uzh-bf/design-system'
import { Database, Pencil, Plus, Trash2 } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import type {
  CreateKnowledgeBaseInput,
  KnowledgeBaseSummary,
  KnowledgeMetadataFieldDefinition,
  UpdateKnowledgeBaseInput,
} from '../types.js'
import { safeConfirm, safePrompt } from '../utils.js'
import { MetadataChips } from './MetadataChips.js'
import { StatusBadge } from './StatusBadge.js'

interface KnowledgeBaseSidebarProps {
  knowledgeBases: KnowledgeBaseSummary[]
  selectedKnowledgeBaseId?: string
  metadataSchema?: KnowledgeMetadataFieldDefinition[]
  className?: string
  onSelectKnowledgeBase?: (knowledgeBaseId: string) => void
  onCreateKnowledgeBase?: (input: CreateKnowledgeBaseInput) => void
  onUpdateKnowledgeBase?: (
    knowledgeBaseId: string,
    input: UpdateKnowledgeBaseInput
  ) => void
  onDeleteKnowledgeBase?: (knowledgeBaseId: string) => void
}

export function KnowledgeBaseSidebar({
  knowledgeBases,
  selectedKnowledgeBaseId,
  metadataSchema = [],
  className,
  onSelectKnowledgeBase,
  onCreateKnowledgeBase,
  onUpdateKnowledgeBase,
  onDeleteKnowledgeBase,
}: KnowledgeBaseSidebarProps) {
  const handleCreate = () => {
    if (!onCreateKnowledgeBase) return
    const name = safePrompt('Knowledge base name')
    if (!name) return
    onCreateKnowledgeBase({ name })
  }

  const handleRename = (kb: KnowledgeBaseSummary) => {
    if (!onUpdateKnowledgeBase) return
    const name = safePrompt('Rename knowledge base', kb.name)
    if (!name || name === kb.name) return
    onUpdateKnowledgeBase(kb.id, { name })
  }

  const handleDelete = (kb: KnowledgeBaseSummary) => {
    if (!onDeleteKnowledgeBase) return
    if (!safeConfirm(`Delete "${kb.name}"? This cannot be undone.`)) return
    onDeleteKnowledgeBase(kb.id)
  }
  return (
    <aside
      className={twMerge(
        'flex min-h-0 flex-col border-r border-slate-200 bg-slate-50',
        'max-h-72 lg:max-h-none',
        className
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <h2 className="text-sm font-bold text-slate-950">Knowledge bases</h2>
        <Button
          aria-label="Create knowledge base"
          className={{ root: 'size-8 rounded-md border-0 bg-transparent p-0' }}
          disabled={!onCreateKnowledgeBase}
          onClick={handleCreate}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {knowledgeBases.map((knowledgeBase) => {
          const selected = knowledgeBase.id === selectedKnowledgeBaseId
          const schema = knowledgeBase.metadataSchema ?? metadataSchema

          return (
            <button
              key={knowledgeBase.id}
              type="button"
              className={twMerge(
                'group w-full rounded-lg border-l-4 border-transparent px-3 py-2 text-left transition hover:bg-white hover:shadow-sm',
                selected && 'border-primary-100 bg-white shadow-sm'
              )}
              onClick={() => onSelectKnowledgeBase?.(knowledgeBase.id)}
            >
              <div className="flex items-start gap-2">
                <Database className="text-primary-100 mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-950">
                    {knowledgeBase.name}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">
                      {knowledgeBase.resourceCount} resources
                    </span>
                    <StatusBadge
                      status={knowledgeBase.status}
                      label={knowledgeBase.statusLabel}
                      className="text-xs"
                    />
                  </div>
                  {knowledgeBase.updatedAtLabel && (
                    <div className="mt-1 truncate text-xs text-slate-500">
                      Updated {knowledgeBase.updatedAtLabel}
                    </div>
                  )}
                  {schema.length > 0 && (
                    <div className="mt-2">
                      <MetadataChips
                        schema={schema}
                        values={knowledgeBase.metadata}
                        visibility="sidebar"
                        maxVisible={2}
                        emptyLabel=""
                      />
                    </div>
                  )}
                </div>
                {(onUpdateKnowledgeBase || onDeleteKnowledgeBase) && (
                  <div className="-mr-1 flex shrink-0 flex-col gap-1 opacity-0 transition group-hover:opacity-100">
                    {onUpdateKnowledgeBase && (
                      <button
                        type="button"
                        aria-label="Rename knowledge base"
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRename(knowledgeBase)
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                    {onDeleteKnowledgeBase && (
                      <button
                        type="button"
                        aria-label="Delete knowledge base"
                        className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(knowledgeBase)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
