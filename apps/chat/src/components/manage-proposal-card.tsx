'use client'

import {
  CheckIcon,
  EyeIcon,
  FilePenLineIcon,
  LoaderCircleIcon,
} from 'lucide-react'
import { useState, type FC } from 'react'

export type ManageProposalResult = {
  kind: string
  summary?: string
  requiresConfirmation: boolean
  payload: unknown
}

type ManageProposalCardProps = {
  result: ManageProposalResult
  status: { type: string }
  toolName: string
}

export function isManageProposalResult(
  value: unknown
): value is ManageProposalResult {
  if (!value || typeof value !== 'object') return false

  const record = value as Record<string, unknown>
  return (
    typeof record.kind === 'string' &&
    typeof record.requiresConfirmation === 'boolean' &&
    'payload' in record &&
    (record.summary === undefined || typeof record.summary === 'string')
  )
}

export const ManageProposalCard: FC<ManageProposalCardProps> = ({
  result,
  status,
  toolName,
}) => {
  const [showPreview, setShowPreview] = useState(false)
  const payloadText = JSON.stringify(result.payload, null, 2)
  const waiting = status.type === 'running'

  return (
    <div className="my-2 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2">
          {waiting && (
            <LoaderCircleIcon
              className="text-muted-foreground size-3.5 animate-spin"
              aria-hidden
            />
          )}
          <span className="text-xs font-semibold uppercase text-slate-500">
            {result.requiresConfirmation ? 'Confirmation required' : 'Draft'}
          </span>
          <span className="rounded bg-white px-1.5 py-0.5 text-[11px] text-slate-500">
            {result.kind}
          </span>
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-900">
          {result.summary ?? formatToolName(toolName)}
        </div>
      </div>

      <div className="space-y-2 px-3 py-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((value) => !value)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <EyeIcon className="size-3.5" aria-hidden />
            Preview
          </button>
          <button
            type="button"
            disabled
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-400"
          >
            <FilePenLineIcon className="size-3.5" aria-hidden />
            Edit in form
          </button>
          <button
            type="button"
            disabled
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-400"
          >
            <CheckIcon className="size-3.5" aria-hidden />
            Create draft
          </button>
        </div>

        {showPreview && (
          <pre className="max-h-72 overflow-auto rounded bg-slate-950 p-3 text-xs leading-5 text-slate-50">
            {payloadText}
          </pre>
        )}
      </div>
    </div>
  )
}

function formatToolName(raw: string) {
  return raw.replace(/_/g, ' ')
}
