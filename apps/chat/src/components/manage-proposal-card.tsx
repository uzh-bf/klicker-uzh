'use client'

import {
  CheckIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  XIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type FC, useState } from 'react'
import {
  notifyManageParent,
  requestManageParentOpen,
} from '../services/manageParentNotify'
import type { ManageProposalResult } from '../services/manageProposalResult'
import { parseManageProposalPayload } from '../services/proposalToElementInstance'
import { useManageParentStore } from '../stores/manageParentStore'
import { useChatUi } from './chat-ui-context'
import { ManageProposalPreview } from './manage-proposal-preview'
import { formatToolName } from './tool-labels'

type ConfirmedElement = {
  id: number
  name: string
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

export const ManageProposalCard: FC<ManageProposalCardProps> = ({
  result,
  status,
  toolName,
}) => {
  const t = useTranslations('chat.manageAssistant.proposal')
  const { embedded } = useChatUi()
  const hasManageParent = useManageParentStore(
    (state) => embedded && Boolean(state.manageParentOrigin)
  )
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
        <span>{t('dismissed', { summary: result.summary ?? tool })}</span>
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
        throw new Error('confirmation-failed')
      }
      const element = parseConfirmedElement(data?.element)
      if (!element) throw new Error('confirmation-failed')

      setConfirmation({ type: 'success', element })
      notifyManageParent(element)
    } catch {
      setConfirmation({
        message: t('confirmationFailed'),
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
              ? t('draftCreated')
              : result.requiresConfirmation
                ? t('confirmationRequired')
                : t('draft')}
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
              {t('createDraft')}
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
              {t('dismiss')}
            </button>
          )}
        </div>

        <div aria-live="polite">
          {confirmation.type === 'success' && (
            <div className="flex items-start gap-2 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-900">
              <CheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <div>
                <div className="font-semibold">
                  {t('draftCreatedInQuestionPool')}
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

        {confirmation.type === 'success' && hasManageParent && (
          <button
            type="button"
            data-cy="chat-manage-proposal-open-draft"
            onClick={() =>
              requestManageParentOpen({ id: confirmation.element.id })
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <ExternalLinkIcon className="size-3.5" aria-hidden />
            {t('openDraft')}
          </button>
        )}

        <details>
          <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
            {t('showRawJson')}
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded bg-slate-950 p-3 text-xs leading-5 text-slate-50">
            {payloadText}
          </pre>
        </details>
      </div>
    </div>
  )
}

function parseConfirmedElement(value: unknown): ConfirmedElement | null {
  if (typeof value !== 'object' || value === null) return null

  const { id, name } = value as Record<string, unknown>
  if (
    typeof id !== 'number' ||
    !Number.isInteger(id) ||
    id <= 0 ||
    typeof name !== 'string' ||
    name.length === 0
  ) {
    return null
  }

  return { id, name }
}
