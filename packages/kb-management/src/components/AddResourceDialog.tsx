import { Button } from '@uzh-bf/design-system'
import { FileUp, Globe2, Layers3, TextCursorInput, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import type {
  AddInternalResourceInput,
  AddSnippetResourceInput,
  KnowledgeResourceType,
} from '../types.js'

interface AddResourceDialogProps {
  open: boolean
  defaultType?: KnowledgeResourceType
  onClose: () => void
  onAddResource?: (type: KnowledgeResourceType) => void
  onUploadResources?: (files: File[]) => void
  onAddWebsite?: (url: string) => void
  onAddSnippet?: (input: AddSnippetResourceInput) => void
  onAddInternalResource?: (input: AddInternalResourceInput) => void
}

const RESOURCE_TYPES: {
  type: KnowledgeResourceType
  label: string
  icon: typeof FileUp
}[] = [
  { type: 'document', label: 'Document', icon: FileUp },
  { type: 'website', label: 'Website', icon: Globe2 },
  { type: 'snippet', label: 'Snippet', icon: TextCursorInput },
  { type: 'internal', label: 'Internal', icon: Layers3 },
]

export function AddResourceDialog({
  open,
  defaultType = 'document',
  onClose,
  onAddResource,
  onUploadResources,
  onAddWebsite,
  onAddSnippet,
  onAddInternalResource,
}: AddResourceDialogProps) {
  const [type, setType] = useState<KnowledgeResourceType>(defaultType)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setType(defaultType)
    }
  }, [defaultType, open])

  if (!open) {
    return null
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (type === 'document') {
      if (onUploadResources) {
        onUploadResources(Array.from(fileInputRef.current?.files ?? []))
      } else {
        onAddResource?.(type)
      }
    } else if (type === 'website') {
      if (onAddWebsite) {
        onAddWebsite(url)
      } else {
        onAddResource?.(type)
      }
    } else if (type === 'snippet') {
      if (onAddSnippet) {
        onAddSnippet({ title: title || 'Untitled snippet', content })
      } else {
        onAddResource?.(type)
      }
    } else {
      if (onAddInternalResource) {
        onAddInternalResource({
          title: title || 'Internal resource',
          originLabel: content || 'Host library',
        })
      } else {
        onAddResource?.(type)
      }
    }

    setUrl('')
    setTitle('')
    setContent('')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="kb-add-resource-title"
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="kb-add-resource-title" className="text-lg font-bold">
            Add resource
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RESOURCE_TYPES.map((option) => {
              const Icon = option.icon

              return (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => setType(option.type)}
                  className={twMerge(
                    'flex h-16 flex-col items-center justify-center gap-1 rounded-md border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50',
                    type === option.type &&
                      'border-primary-100 bg-primary-20 text-primary-100'
                  )}
                >
                  <Icon className="size-5" />
                  {option.label}
                </button>
              )
            })}
          </div>

          {type === 'document' && (
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Files
              </span>
              <input
                ref={fileInputRef}
                type="file"
                required
                multiple
                className="mt-2 block w-full rounded-md border border-slate-300 text-sm file:mr-4 file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold"
              />
            </label>
          )}

          {type === 'website' && (
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">URL</span>
              <input
                required
                type="url"
                value={url}
                onChange={(event) => setUrl(event.currentTarget.value)}
                placeholder="https://example.com/reference"
                className="focus:border-primary-100 focus:ring-primary-20 mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2"
              />
            </label>
          )}

          {(type === 'snippet' || type === 'internal') && (
            <>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Title
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.currentTarget.value)}
                  className="focus:border-primary-100 focus:ring-primary-20 mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  {type === 'snippet' ? 'Snippet' : 'Origin label'}
                </span>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.currentTarget.value)}
                  rows={5}
                  className="focus:border-primary-100 focus:ring-primary-20 mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <Button type="button" onClick={onClose} className={{ root: 'h-9' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            className={{
              root: 'bg-primary-100 hover:bg-primary-100/90 h-9 text-white',
            }}
          >
            Add resource
          </Button>
        </div>
      </form>
    </div>
  )
}
