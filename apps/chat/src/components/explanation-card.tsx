'use client'

import {
  LoaderCircleIcon,
  Maximize2Icon,
  WrenchIcon,
  XCircleIcon,
  XIcon,
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { ExplanationToolResult } from '@/src/lib/explanations'

/* Tall enough for the compact layout's diagram, inputs and panel at chat width. */
const FRAME_HEIGHT = 640

function asResult(value: unknown): ExplanationToolResult | null {
  const v =
    value && typeof value === 'object' && 'result' in value
      ? (value as { result: unknown }).result
      : value
  if (!v || typeof v !== 'object' || !('kind' in v)) return null
  const kind = (v as { kind: unknown }).kind
  return kind === 'explanation' ||
    kind === 'explanation-invalid' ||
    kind === 'explanation-unavailable'
    ? (v as ExplanationToolResult)
    : null
}

function Chip({
  tone,
  icon,
  text,
}: {
  tone: 'muted' | 'error'
  icon: React.ReactNode
  text: string
}) {
  return (
    <div
      className={
        'my-2 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ' +
        (tone === 'error'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-slate-200 bg-white text-slate-600')
      }
    >
      {icon}
      <span>{text}</span>
    </div>
  )
}

/**
 * The page runs its own scripts in an opaque origin: no same-origin access to
 * the chat, its cookies or storage, and its own policy forbids network requests.
 */
function ExplanationFrame({
  html,
  title,
  className,
  style,
}: {
  html: string
  title: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <iframe
      title={title}
      srcDoc={html}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className={className}
      style={style}
    />
  )
}

export function ExplanationCard({
  result,
  status,
}: {
  result?: unknown
  status: { type: string }
}) {
  const params = useParams<{ chatbotId?: string }>()
  const parsed = asResult(result)
  const content = parsed?.kind === 'explanation' ? parsed.content : null
  const [page, setPage] = useState<{ html: string } | { failed: true } | null>(
    null
  )
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!content || !params.chatbotId) return
    let cancelled = false
    fetch(`/api/chatbots/${params.chatbotId}/explanations/page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
      .then(async (response) => {
        const data = (await response.json()) as { html?: string }
        if (cancelled) return
        setPage(
          response.ok && typeof data.html === 'string'
            ? { html: data.html }
            : { failed: true }
        )
      })
      .catch(() => !cancelled && setPage({ failed: true }))
    return () => {
      cancelled = true
    }
    // The content of a stored tool result never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.chatbotId, content === null])

  if (status.type === 'running' && !parsed)
    return (
      <Chip
        tone="muted"
        icon={<LoaderCircleIcon className="size-4 animate-spin" />}
        text="Preparing an interactive explanation..."
      />
    )
  if (parsed?.kind === 'explanation-invalid')
    return (
      <Chip
        tone="muted"
        icon={<WrenchIcon className="size-4" />}
        text="Correcting the interactive explanation..."
      />
    )
  if (!content || (page && 'failed' in page))
    return (
      <Chip
        tone="error"
        icon={<XCircleIcon className="size-4" />}
        text="Interactive explanation unavailable"
      />
    )

  const title =
    typeof content.title === 'string'
      ? content.title
      : 'Interactive explanation'
  return (
    <div className="my-3 w-full overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-1.5 text-xs text-slate-600">
        <span>Interactive explanation · AI-generated draft, not reviewed</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-50"
          disabled={!page}
          onClick={() => dialogRef.current?.showModal()}
        >
          <Maximize2Icon className="size-3.5" />
          Open large
        </button>
      </div>
      {page && 'html' in page ? (
        <ExplanationFrame
          html={page.html}
          title={title}
          className="block w-full border-0"
          style={{ height: FRAME_HEIGHT }}
        />
      ) : (
        <div
          className="flex items-center justify-center text-sm text-slate-500"
          style={{ height: FRAME_HEIGHT }}
        >
          <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
          Loading...
        </div>
      )}
      <dialog
        ref={dialogRef}
        className="m-auto h-[90vh] w-[min(1200px,95vw)] max-w-none rounded-md p-0 backdrop:bg-black/40"
        aria-label={title}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-end border-b border-slate-200 px-2 py-1">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm hover:bg-slate-100"
              onClick={() => dialogRef.current?.close()}
            >
              <XIcon className="size-4" />
              Close
            </button>
          </div>
          {page && 'html' in page ? (
            <ExplanationFrame
              html={page.html}
              title={title}
              className="min-h-0 w-full flex-1 border-0"
            />
          ) : null}
        </div>
      </dialog>
    </div>
  )
}
