'use client'

import { useAui, useAuiState } from '@assistant-ui/react'
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  SaveIcon,
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useChatUi } from './chat-ui-context'

type ResponseExampleCaptureReceipt = {
  token: string
  question: string
  answer: string
}

export type ResponseExampleCapturePhase =
  | 'hidden'
  | 'unavailable'
  | 'available'
  | 'pending'
  | 'created'
  | 'duplicate'
  | 'stale'
  | 'expired'
  | 'failure'

type CaptureActionStateInput = {
  hasReceipt: boolean
  isComplete: boolean
  phase: Exclude<ResponseExampleCapturePhase, 'hidden'>
}

/**
 * Keeps the visibility rule independent from the assistant-ui rendering
 * primitives. The server only issues this part for a grounded first answer.
 */
export function resolveResponseExampleCapturePhase({
  hasReceipt,
  isComplete,
  phase,
}: CaptureActionStateInput): ResponseExampleCapturePhase {
  if (!isComplete) return 'hidden'
  if (!hasReceipt) return 'unavailable'
  return phase
}

export function resolveResponseExampleCaptureErrorPhase(
  code: unknown
): Extract<ResponseExampleCapturePhase, 'stale' | 'expired' | 'failure'> {
  if (code === 'RESPONSE_EXAMPLE_RECEIPT_EXPIRED') {
    return 'expired'
  }
  if (code === 'RESPONSE_EXAMPLE_CAPTURE_STALE') {
    return 'stale'
  }
  return 'failure'
}

function parseReceiptData(
  value: unknown
): ResponseExampleCaptureReceipt | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const data = value as Record<string, unknown>
  if (
    typeof data.token !== 'string' ||
    data.token.length === 0 ||
    typeof data.question !== 'string' ||
    data.question.length === 0 ||
    typeof data.answer !== 'string' ||
    data.answer.length === 0
  ) {
    return null
  }

  return {
    token: data.token,
    question: data.question,
    answer: data.answer,
  }
}

function useChatbotId(): string | null {
  const params = useParams<{ chatbotId?: string | string[] }>()
  const chatbotId = params?.chatbotId
  if (Array.isArray(chatbotId)) return chatbotId[0] ?? null
  return typeof chatbotId === 'string' ? chatbotId : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function ResponseExampleCaptureAction({ data }: { data: unknown }) {
  const t = useTranslations('chat.ownerPreview.responseExample')
  const { variant } = useChatUi()
  const aui = useAui()
  const chatbotId = useChatbotId()
  const receipt = parseReceiptData(data)
  const [phase, setPhase] =
    useState<Exclude<ResponseExampleCapturePhase, 'hidden'>>('available')
  const [reviewUrl, setReviewUrl] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  const isComplete = useAuiState(
    (state) =>
      state.message.role === 'assistant' &&
      state.message.status?.type === 'complete'
  )
  const currentPhase = resolveResponseExampleCapturePhase({
    hasReceipt: receipt !== null,
    isComplete,
    phase,
  })

  if (variant !== 'owner-preview' || currentPhase === 'hidden') {
    return null
  }

  async function capture() {
    if (
      !chatbotId ||
      !receipt ||
      (phase !== 'available' && phase !== 'failure')
    ) {
      return
    }

    setPhase('pending')
    try {
      const response = await fetch(
        `/api/manage/chatbots/${encodeURIComponent(chatbotId)}/preview/capture`,
        {
          body: JSON.stringify({
            answer: receipt.answer,
            question: receipt.question,
            receipt: receipt.token,
          }),
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        }
      )
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok || !isRecord(payload)) {
        setPhase(
          resolveResponseExampleCaptureErrorPhase(
            isRecord(payload) ? payload.code : undefined
          )
        )
        return
      }

      if (
        typeof payload.reviewUrl !== 'string' ||
        payload.reviewUrl.length === 0 ||
        typeof payload.created !== 'boolean'
      ) {
        setPhase('failure')
        return
      }

      setReviewUrl(payload.reviewUrl)
      setPhase(payload.created ? 'created' : 'duplicate')
    } catch {
      setPhase('failure')
    }
  }

  async function startNewPreview() {
    if (resetting) return
    setResetting(true)
    try {
      await aui.composer.reset()
      aui.thread.reset()
    } finally {
      setResetting(false)
    }
  }

  if (currentPhase === 'pending') {
    return (
      <CaptureActionShell>
        <div
          data-cy="owner-preview-response-example-status"
          role="status"
          className="text-muted-foreground inline-flex items-center gap-2 text-sm"
        >
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
          {t('capturePending')}
        </div>
      </CaptureActionShell>
    )
  }

  if (currentPhase === 'created' || currentPhase === 'duplicate') {
    return (
      <CaptureActionShell>
        <div
          data-cy="owner-preview-response-example-status"
          role="status"
          className="text-foreground flex flex-wrap items-center gap-2 text-sm"
        >
          <CheckCircle2Icon className="text-primary size-4" aria-hidden />
          <span>
            {t(
              currentPhase === 'created' ? 'captureCreated' : 'captureDuplicate'
            )}
          </span>
          {reviewUrl && (
            <a
              data-cy="owner-preview-response-example-review"
              href={reviewUrl}
              className="text-primary hover:text-primary/80 focus-visible:ring-ring inline-flex min-h-8 items-center rounded-md px-2 font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2"
            >
              {t('reviewNow')}
            </a>
          )}
        </div>
      </CaptureActionShell>
    )
  }

  if (
    currentPhase === 'unavailable' ||
    currentPhase === 'stale' ||
    currentPhase === 'expired'
  ) {
    return (
      <CaptureActionShell>
        <div
          data-cy="owner-preview-response-example-status"
          role="alert"
          className="text-foreground flex flex-wrap items-center gap-2 text-sm"
        >
          <AlertCircleIcon className="text-destructive size-4" aria-hidden />
          <span>
            {t(
              currentPhase === 'unavailable'
                ? 'captureUnavailable'
                : currentPhase === 'stale'
                  ? 'captureStale'
                  : 'captureExpired'
            )}
          </span>
          <button
            type="button"
            data-cy="owner-preview-response-example-new-preview"
            disabled={resetting}
            onClick={() => void startNewPreview()}
            className="text-primary hover:text-primary/80 focus-visible:ring-ring inline-flex min-h-8 items-center rounded-md px-2 font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {t('startNewPreview')}
          </button>
        </div>
      </CaptureActionShell>
    )
  }

  if (currentPhase === 'failure') {
    return (
      <CaptureActionShell>
        <div
          data-cy="owner-preview-response-example-status"
          role="alert"
          className="text-foreground flex flex-wrap items-center gap-2 text-sm"
        >
          <AlertCircleIcon className="text-destructive size-4" aria-hidden />
          <span>{t('captureFailed')}</span>
          <button
            type="button"
            data-cy="owner-preview-response-example-retry"
            onClick={() => void capture()}
            className="text-primary hover:text-primary/80 focus-visible:ring-ring inline-flex min-h-8 items-center rounded-md px-2 font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2"
          >
            {t('captureRetry')}
          </button>
        </div>
      </CaptureActionShell>
    )
  }

  return (
    <CaptureActionShell>
      <button
        type="button"
        data-cy="owner-preview-response-example-capture"
        onClick={() => void capture()}
        className="border-border bg-background text-foreground hover:bg-accent focus-visible:ring-ring inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
      >
        <SaveIcon className="size-4" aria-hidden />
        {t('captureAction')}
      </button>
    </CaptureActionShell>
  )
}

function CaptureActionShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-cy="owner-preview-response-example-action"
      className="border-border bg-muted/30 mt-3 rounded-md border px-3 py-2"
    >
      {children}
    </div>
  )
}
