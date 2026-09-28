'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { type ReactNode, useEffect, useRef, useState } from 'react'

const controlClass =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border px-3 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40'

export function CourseImageViewer({
  src,
  alt,
  label,
  caption,
  width,
  height,
  children,
}: {
  src: string
  alt: string
  label: string
  caption?: string
  width: number
  height: number
  children: ReactNode
}) {
  const t = useTranslations('chat.courseImages')
  const [open, setOpen] = useState(false)
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          data-cy="course-image-expand"
          aria-label={t('expand')}
          className="block w-full cursor-zoom-in rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {children}
        </button>
      </Dialog.Trigger>
      {open && (
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
          <Dialog.Content
            data-cy="course-image-viewer"
            className="fixed inset-0 z-50 flex h-dvh flex-col bg-background text-foreground sm:inset-3 sm:h-[calc(100dvh-1.5rem)] sm:rounded-xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2">
              <Dialog.Title className="min-w-0 truncate text-sm font-medium">
                {label}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={controlClass}
                  aria-label={t('closeViewer')}
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
            <ZoomableFigure src={src} alt={alt} width={width} height={height} />
            <Dialog.Description className="max-h-[20dvh] shrink-0 overflow-y-auto border-t px-4 py-3 text-sm">
              {caption || label}
            </Dialog.Description>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  )
}

function ZoomableFigure({
  src,
  alt,
  width,
  height,
}: {
  src: string
  alt: string
  width: number
  height: number
}) {
  const t = useTranslations('chat.courseImages')
  const viewport = useRef<HTMLElement>(null)
  const [bounds, setBounds] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      setBounds({ width: element.clientWidth, height: element.clientHeight })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const fit = Math.min(bounds.width / width, bounds.height / height, 1)
  const displayWidth = Math.max(1, width * fit * zoom)
  const displayHeight = Math.max(1, height * fit * zoom)
  return (
    <>
      <div className="flex shrink-0 items-center justify-center gap-2 border-b p-2">
        <button
          type="button"
          className={controlClass}
          aria-label={t('zoomOut')}
          disabled={zoom <= 1 || failed}
          onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
        >
          <ZoomOut className="size-5" aria-hidden="true" />
        </button>
        <output
          className="w-14 text-center text-sm tabular-nums"
          aria-live="polite"
          aria-label={t('zoomLevel')}
        >
          {Math.round(zoom * 100)}%
        </output>
        <button
          type="button"
          className={controlClass}
          aria-label={t('zoomIn')}
          disabled={zoom >= 4 || failed}
          onClick={() => setZoom((value) => Math.min(4, value + 0.5))}
        >
          <ZoomIn className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={controlClass}
          onClick={() => {
            setZoom(1)
            viewport.current?.scrollTo(0, 0)
          }}
        >
          <RotateCcw className="mr-2 size-4" aria-hidden="true" />
          {t('fitImage')}
        </button>
      </div>
      <section
        ref={viewport}
        data-cy="course-image-viewport"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The scrollable image region must support keyboard panning.
        tabIndex={0}
        aria-label={t('panHint')}
        className="min-h-0 flex-1 overflow-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
      >
        {failed ? (
          <div
            role="alert"
            className="flex h-full flex-col items-center justify-center gap-3 p-4"
          >
            <p>{t('unavailable')}</p>
            <button
              type="button"
              className={controlClass}
              onClick={() => {
                setFailed(false)
                setAttempt((value) => value + 1)
              }}
            >
              {t('retry')}
            </button>
          </div>
        ) : (
          <div
            className="grid place-items-center"
            style={{
              width: `max(100%, ${displayWidth}px)`,
              height: `max(100%, ${displayHeight}px)`,
            }}
          >
            <Image
              unoptimized
              key={attempt}
              data-cy="course-image-viewer-image"
              src={src}
              alt={alt}
              width={width}
              height={height}
              draggable={false}
              onError={() => setFailed(true)}
              className="block max-w-none"
              style={{ width: displayWidth, height: displayHeight }}
            />
          </div>
        )}
      </section>
      <p className="shrink-0 px-4 py-1 text-center text-xs text-muted-foreground">
        {t('panHint')}
      </p>
    </>
  )
}
