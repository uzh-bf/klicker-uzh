'use client'

import { CheckIcon, LoaderCircleIcon, XIcon } from 'lucide-react'
import { useState, type FC } from 'react'
import { notifyManageParent } from '../services/manageParentNotify'
import { parseManageProposalPayload } from '../services/proposalToElementInstance'
import { unfenceToolResultText } from '../services/toolFenceSyntax'
import { ManageProposalPreview } from './manage-proposal-preview'
import { formatToolName } from './tool-labels'

export type ManageProposalResult = {
  kind: string
  proposalToken?: string
  summary?: string
  requiresConfirmation: boolean
  payload: unknown
}

type ConfirmedElement = {
  id: number
  name: string
  status: string
  type: string
}

type ConfirmationState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; element: ConfirmedElement }
  | { type: 'error'; message: string }
  | { type: 'dismissed' }

// Dismissing is only allowed while the card is still awaiting user action —
// it must not fire while a confirm request is in flight or after a draft
// was already created, so it can never race a real confirmation.
function isDismissible(confirmation: ConfirmationState, waiting: boolean) {
  return (
    !waiting &&
    confirmation.type !== 'loading' &&
    confirmation.type !== 'success'
  )
}

// Pure state transition so the dismiss behavior (idle/error -> terminal
// "dismissed"; no-op while loading/created) is unit-testable without
// rendering the component. No server call — dismissal is local-only.
export function applyDismiss(
  confirmation: ConfirmationState,
  waiting: boolean
): ConfirmationState {
  return isDismissible(confirmation, waiting)
    ? { type: 'dismissed' }
    : confirmation
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
    (record.proposalToken === undefined ||
      typeof record.proposalToken === 'string') &&
    (record.summary === undefined || typeof record.summary === 'string')
  )
}

export function getManageProposalResult(
  value: unknown
): ManageProposalResult | null {
  if (isManageProposalResult(value)) return value
  if (!value || typeof value !== 'object') return null

  const content = (value as { content?: unknown }).content
  if (!Array.isArray(content)) return null

  for (const item of content) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (record.type !== 'text' || typeof record.text !== 'string') continue

    try {
      // Tool results reach the browser fenced (X4 output fencing wraps every
      // MCP result, the proposal tool's included), so unwrap the envelope
      // before parsing — a bare JSON.parse throws on the marker line.
      const parsed = JSON.parse(unfenceToolResultText(record.text))
      if (isManageProposalResult(parsed)) return parsed
    } catch {
      // Ignore non-JSON MCP text payloads and keep looking.
    }
  }

  return null
}

export const ManageProposalCard: FC<ManageProposalCardProps> = ({
  result,
  status,
  toolName,
}) => {
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    type: 'idle',
  })
  const { tool } = formatToolName(toolName)

  // Dismissed is terminal: collapse the whole card into a muted note instead
  // of the full header/preview/actions layout.
  if (confirmation.type === 'dismissed') {
    return (
      <div
        data-cy="chat-manage-proposal-dismissed"
        className="my-2 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"
      >
        <XIcon className="size-3.5 shrink-0" aria-hidden />
        <span>Dismissed: {result.summary ?? tool}</span>
      </div>
    )
  }

  const previewPayload = parseManageProposalPayload(result)
  const payloadText = JSON.stringify(result.payload, null, 2)
  const waiting = status.type === 'running'
  const created = confirmation.type === 'success'
  const canConfirm =
    result.requiresConfirmation &&
    Boolean(result.proposalToken) &&
    !waiting &&
    confirmation.type !== 'loading' &&
    !created
  const canDismiss = isDismissible(confirmation, waiting)

  const confirmProposal = async () => {
    if (!result.proposalToken || !canConfirm) return

    setConfirmation({ type: 'loading' })
    try {
      const response = await fetch('/api/manage/proposals/confirm', {
        body: JSON.stringify({ proposalToken: result.proposalToken }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Draft creation failed'
        )
      }
      if (!data?.element) {
        throw new Error('Draft creation returned no element')
      }

      setConfirmation({ type: 'success', element: data.element })
      notifyManageParent({ id: data.element.id, name: data.element.name })
    } catch (error) {
      setConfirmation({
        message:
          error instanceof Error ? error.message : 'Draft creation failed',
        type: 'error',
      })
    }
  }

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
            {created
              ? 'Draft created'
              : result.requiresConfirmation
                ? 'Confirmation required'
                : 'Draft'}
          </span>
          <span className="rounded bg-white px-1.5 py-0.5 text-[11px] text-slate-500">
            {result.kind}
          </span>
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-900">
          {result.summary ?? tool}
        </div>
      </div>

      <div className="space-y-2 px-3 py-3">
        {previewPayload && <ManageProposalPreview payload={previewPayload} />}

        <div className="flex flex-wrap gap-2">
          {!created && (
            <button
              type="button"
              disabled={!canConfirm}
              onClick={confirmProposal}
              className={
                canConfirm
                  ? 'inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
                  : 'inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-400'
              }
            >
              {confirmation.type === 'loading' ? (
                <LoaderCircleIcon
                  className="size-3.5 animate-spin"
                  aria-hidden
                />
              ) : (
                <CheckIcon className="size-3.5" aria-hidden />
              )}
              Create draft
            </button>
          )}
          {!created && (
            <button
              type="button"
              disabled={!canDismiss}
              onClick={() =>
                setConfirmation((current) => applyDismiss(current, waiting))
              }
              data-cy="chat-manage-proposal-dismiss-button"
              className={
                canDismiss
                  ? 'inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
                  : 'inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-400'
              }
            >
              <XIcon className="size-3.5" aria-hidden />
              Dismiss
            </button>
          )}
        </div>

        <div aria-live="polite">
          {confirmation.type === 'success' && (
            <div className="flex items-start gap-2 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-900">
              <CheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <div>
                <div className="font-semibold">
                  Draft created in the question pool
                </div>
                <div className="mt-0.5">
                  {confirmation.element.name} (#{confirmation.element.id})
                </div>
              </div>
            </div>
          )}
          {confirmation.type === 'error' && (
            <div className="rounded border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800">
              {confirmation.message}
            </div>
          )}
        </div>

        <details>
          <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
            Show raw JSON
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded bg-slate-950 p-3 text-xs leading-5 text-slate-50">
            {payloadText}
          </pre>
        </details>
      </div>
    </div>
  )
}
