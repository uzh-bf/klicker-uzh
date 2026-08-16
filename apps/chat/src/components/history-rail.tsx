'use client'

import {
  CircleAlertIcon,
  HistoryIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  XIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  type FC,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'

import type {
  HistoryRailEntry,
  HistoryRailEntryKind,
  HistoryRailTickRange,
} from '../lib/history-rail'
import { getHistoryRailTickRanges } from '../lib/history-rail'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

type HistoryRailProps = {
  entries: readonly HistoryRailEntry[]
}

const DESKTOP_TICK_LIMIT = 12
const HISTORY_DIALOG_DESKTOP_ID = 'chat-history-rail-dialog-desktop'
const HISTORY_DIALOG_MOBILE_ID = 'chat-history-rail-dialog-mobile'

const findAnchor = (
  viewport: HTMLElement,
  anchor: string
): HTMLElement | undefined =>
  Array.from(
    viewport.querySelectorAll<HTMLElement>('[data-history-rail-anchor]')
  ).find((element) => element.dataset.historyRailAnchor === anchor)

const revealCurrentEntry = (
  container: HTMLElement,
  anchor: string,
  axis: 'block' | 'inline'
): void => {
  const list = container.querySelector<HTMLElement>('ol')
  const currentButton = Array.from(
    container.querySelectorAll<HTMLButtonElement>('[data-history-rail-entry]')
  ).find((button) => button.dataset.historyRailEntry === anchor)

  if (!list || !currentButton) return

  const listRect = list.getBoundingClientRect()
  const buttonRect = currentButton.getBoundingClientRect()
  if (listRect.width === 0 || listRect.height === 0) return

  if (axis === 'block') {
    if (buttonRect.top < listRect.top) {
      list.scrollTop -= listRect.top - buttonRect.top + 4
    } else if (buttonRect.bottom > listRect.bottom) {
      list.scrollTop += buttonRect.bottom - listRect.bottom + 4
    }
    return
  }

  if (buttonRect.left < listRect.left) {
    list.scrollLeft -= listRect.left - buttonRect.left + 4
  } else if (buttonRect.right > listRect.right) {
    list.scrollLeft += buttonRect.right - listRect.right + 4
  }
}

const getEntryIcon = (
  _kind: HistoryRailEntryKind,
  status: HistoryRailEntry['status']
): ReactNode => {
  if (status === 'running') {
    return (
      <LoaderCircleIcon
        className="size-3.5 animate-spin motion-reduce:animate-none"
        aria-hidden
      />
    )
  }
  if (status === 'error' || status === 'partial') {
    return <CircleAlertIcon className="size-3.5" aria-hidden />
  }

  return <MessageCircleIcon className="size-3.5" aria-hidden />
}

const HistoryRailTurnDetails: FC<{
  entry: HistoryRailEntry
}> = ({ entry }) => {
  const t = useTranslations()
  const statusLabel =
    entry.status === 'running'
      ? t('chat.historyRail.inProgress')
      : entry.status === 'partial'
        ? t('chat.historyRail.partial')
        : entry.status === 'error'
          ? t('chat.historyRail.error')
          : undefined

  return (
    <TooltipContent
      align="center"
      className="max-h-72 max-w-[min(24rem,calc(100vw-2rem))] overflow-y-auto p-3 text-left"
      data-cy="chat-history-rail-turn-popover"
      side="right"
      sideOffset={8}
    >
      <div className="space-y-2">
        {entry.userMessageId && (
          <div>
            <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
              {t('chat.historyRail.you')}
            </p>
            <p className="whitespace-pre-wrap break-words text-xs leading-4">
              {entry.userText ?? t('chat.historyRail.noText')}
            </p>
          </div>
        )}
        {entry.assistantMessageId && (
          <div>
            <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
              {t('chat.historyRail.assistant')}
            </p>
            <p className="whitespace-pre-wrap break-words text-xs leading-4">
              {entry.assistantText ?? t('chat.historyRail.noResponse')}
            </p>
          </div>
        )}
        {statusLabel && (
          <p className="text-muted-foreground text-[10px] leading-3">
            {statusLabel}
          </p>
        )}
      </div>
    </TooltipContent>
  )
}

const HistoryRailTick: FC<{
  dialogId?: string
  entry: HistoryRailEntry
  isCurrent: boolean
  isOpen?: boolean
  onNavigate: (anchor: string) => void
  onToggle?: (button: HTMLButtonElement) => void
  range: HistoryRailTickRange
  title: string
  total: number
}> = ({
  dialogId,
  entry,
  isCurrent,
  isOpen = false,
  onNavigate,
  onToggle,
  range,
  title,
  total,
}) => {
  const t = useTranslations()
  const statusLabel =
    entry.status === 'running'
      ? t('chat.historyRail.inProgress')
      : entry.status === 'partial'
        ? t('chat.historyRail.partial')
        : entry.status === 'error'
          ? t('chat.historyRail.error')
          : undefined
  const itemLabel =
    range.startIndex === range.endIndex
      ? t('chat.historyRail.item', {
          current: range.startIndex + 1,
          total,
        })
      : t('chat.historyRail.itemRange', {
          end: range.endIndex + 1,
          start: range.startIndex + 1,
          total,
        })
  const accessibleLabel = [
    itemLabel,
    `${title}${entry.preview ? `: ${entry.preview}` : ''}`,
    entry.userMessageId
      ? `${t('chat.historyRail.you')}: ${entry.userText ?? t('chat.historyRail.noText')}`
      : undefined,
    entry.assistantMessageId
      ? `${t('chat.historyRail.assistant')}: ${entry.assistantText ?? t('chat.historyRail.noResponse')}`
      : undefined,
    statusLabel,
    isCurrent
      ? t(
          isOpen
            ? 'chat.historyRail.closeHistory'
            : 'chat.historyRail.openHistory'
        )
      : undefined,
  ]
    .filter(Boolean)
    .join(' — ')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-controls={isCurrent ? dialogId : undefined}
          aria-current={isCurrent ? 'step' : undefined}
          aria-expanded={isCurrent ? isOpen : undefined}
          aria-haspopup={isCurrent ? 'dialog' : undefined}
          aria-label={accessibleLabel}
          data-history-rail-tick={entry.anchor}
          onClick={(event) => {
            if (isCurrent) {
              onToggle?.(event.currentTarget)
            } else {
              onNavigate(entry.anchor)
            }
          }}
          className={`group relative flex h-5 w-full touch-manipulation items-center justify-center rounded-full focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${isCurrent ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <span
            aria-hidden="true"
            className={`block rounded-full transition-[width,height,background-color] ${isCurrent ? 'bg-primary h-0.5 w-4' : 'bg-border/80 h-0.5 w-2 group-hover:bg-foreground group-hover:w-3 group-focus-visible:bg-foreground group-focus-visible:w-3'}`}
          />
        </button>
      </TooltipTrigger>
      <HistoryRailTurnDetails entry={entry} />
    </Tooltip>
  )
}

const HistoryDialog: FC<{
  desktop?: boolean
  entries: readonly HistoryRailEntry[]
  id: string
  currentAnchor: string | null
  onClose: () => void
  onNavigate: (anchor: string) => void
}> = ({ desktop = false, entries, id, currentAnchor, onClose, onNavigate }) => {
  const t = useTranslations()

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    const rows = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[data-history-dialog-entry]'
      )
    )
    const focusedIndex = rows.indexOf(
      document.activeElement as HTMLButtonElement
    )
    if (focusedIndex < 0) return

    let nextIndex: number | undefined
    switch (event.key) {
      case 'ArrowDown':
        nextIndex = Math.min(rows.length - 1, focusedIndex + 1)
        break
      case 'ArrowUp':
        nextIndex = Math.max(0, focusedIndex - 1)
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = rows.length - 1
        break
      case 'PageDown':
        nextIndex = Math.min(rows.length - 1, focusedIndex + 10)
        break
      case 'PageUp':
        nextIndex = Math.max(0, focusedIndex - 10)
        break
      default:
        return
    }

    event.preventDefault()
    rows[nextIndex]?.focus()
  }

  return (
    <div
      id={id}
      aria-labelledby={`${id}-title`}
      data-history-rail-dialog
      onKeyDown={handleKeyDown}
      role="dialog"
      tabIndex={-1}
      className={`border-border/70 bg-background/95 absolute z-40 flex max-h-[60vh] min-h-0 flex-col overflow-hidden rounded-xl border p-2 shadow-lg backdrop-blur-md ${desktop ? 'left-8 top-2 w-72 max-w-[calc(100vw-3rem)]' : 'right-0 top-full mt-2 w-[min(360px,calc(100vw-1rem))] max-h-[70dvh]'}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-2 pb-1">
        <h2 id={`${id}-title`} className="text-xs font-semibold">
          {t('chat.historyRail.label')}
        </h2>
        <button
          type="button"
          aria-label={t('chat.historyRail.closeHistory')}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          onClick={onClose}
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      </div>
      <ol className="min-h-0 overflow-y-auto">
        {entries.map((entry, index) => {
          const statusLabel =
            entry.status === 'running'
              ? t('chat.historyRail.inProgress')
              : entry.status === 'partial'
                ? t('chat.historyRail.partial')
                : entry.status === 'error'
                  ? t('chat.historyRail.error')
                  : undefined
          const itemLabel = t('chat.historyRail.item', {
            current: index + 1,
            total: entries.length,
          })
          const userLabel = entry.userMessageId
            ? `${t('chat.historyRail.you')}: ${entry.userText ?? t('chat.historyRail.noText')}`
            : undefined
          const assistantLabel = entry.assistantMessageId
            ? `${t('chat.historyRail.assistant')}: ${entry.assistantText ?? t('chat.historyRail.noResponse')}`
            : undefined
          const rowLabel = [itemLabel, userLabel, assistantLabel, statusLabel]
            .filter(Boolean)
            .join(' — ')

          return (
            <li key={entry.id}>
              <button
                type="button"
                data-history-dialog-entry
                aria-current={
                  entry.anchor === currentAnchor ? 'step' : undefined
                }
                aria-label={rowLabel}
                onClick={() => onNavigate(entry.anchor)}
                className={`hover:bg-accent flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${entry.anchor === currentAnchor ? 'bg-primary/10' : ''}`}
              >
                <span className="text-muted-foreground w-10 shrink-0 text-right text-[10px] tabular-nums">
                  {index + 1}/{entries.length}
                </span>
                <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full">
                  {getEntryIcon(entry.kind, entry.status)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">
                    {t('chat.historyRail.turn')}
                  </span>
                  {userLabel && (
                    <span className="text-muted-foreground line-clamp-1 block text-[11px] leading-4">
                      {userLabel}
                    </span>
                  )}
                  {assistantLabel && (
                    <span className="text-muted-foreground line-clamp-1 block text-[11px] leading-4">
                      {assistantLabel}
                    </span>
                  )}
                  {statusLabel && (
                    <span className="text-muted-foreground block text-[10px] leading-3">
                      {statusLabel}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export const HistoryRail: FC<HistoryRailProps> = ({ entries }) => {
  const t = useTranslations()
  const railRef = useRef<HTMLElement>(null)
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null)
  const navigationLockRef = useRef<{
    anchor: string
    token: number
  } | null>(null)
  const navigationTokenRef = useRef(0)
  const returnFocusRef = useRef(true)
  const wasHistoryOpenRef = useRef(false)
  const [currentAnchor, setCurrentAnchor] = useState<string | null>(
    entries[0]?.anchor ?? null
  )
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const currentIndex = Math.max(
    0,
    entries.findIndex((entry) => entry.anchor === currentAnchor)
  )
  useEffect(() => {
    if (
      navigationLockRef.current &&
      !entries.some(
        (entry) => entry.anchor === navigationLockRef.current?.anchor
      )
    ) {
      navigationTokenRef.current += 1
      navigationLockRef.current = null
    }

    setCurrentAnchor((previous) =>
      entries.some((entry) => entry.anchor === previous)
        ? previous
        : (entries[0]?.anchor ?? null)
    )
  }, [entries])

  useEffect(() => {
    if (!currentAnchor) return

    const revealEntries = () => {
      const desktopRail = document.querySelector<HTMLElement>(
        '[data-cy="chat-history-rail"]'
      )
      if (desktopRail) revealCurrentEntry(desktopRail, currentAnchor, 'block')
    }

    revealEntries()
    window.addEventListener('resize', revealEntries)
    return () => window.removeEventListener('resize', revealEntries)
  }, [currentAnchor])

  useEffect(() => {
    if (!isHistoryOpen) {
      if (!wasHistoryOpenRef.current) return
      wasHistoryOpenRef.current = false
      if (returnFocusRef.current) lastTriggerRef.current?.focus()
      returnFocusRef.current = true
      return
    }

    wasHistoryOpenRef.current = true
    const frame = requestAnimationFrame(() => {
      const currentRow = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          '[data-history-dialog-entry][aria-current="step"]'
        )
      ).find((row) => row.getClientRects().length > 0)
      currentRow?.focus()
    })

    return () => cancelAnimationFrame(frame)
  }, [isHistoryOpen])

  useEffect(() => {
    if (entries.length === 0) return

    const viewport = document.querySelector<HTMLElement>(
      '[data-cy="chat-thread-viewport"]'
    )
    if (!viewport) return

    let frame: number | undefined
    const updateCurrentAnchor = () => {
      const navigationLock = navigationLockRef.current
      if (navigationLock) {
        setCurrentAnchor((previous) =>
          previous === navigationLock.anchor ? previous : navigationLock.anchor
        )
        return
      }

      const anchorElements = new Map<string, HTMLElement>()
      for (const element of viewport.querySelectorAll<HTMLElement>(
        '[data-history-rail-anchor]'
      )) {
        const anchor = element.dataset.historyRailAnchor
        if (anchor) anchorElements.set(anchor, element)
      }

      const scrollBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
      const firstVisibleEntry = entries.find((entry) =>
        anchorElements.has(entry.anchor)
      )
      const lastVisibleEntry = [...entries]
        .reverse()
        .find((entry) => anchorElements.has(entry.anchor))
      let nextAnchor = firstVisibleEntry?.anchor ?? null

      if (scrollBottom <= 2) {
        nextAnchor = lastVisibleEntry?.anchor ?? nextAnchor
      } else if (viewport.scrollTop > 2) {
        const marker =
          viewport.getBoundingClientRect().top +
          Math.min(160, Math.max(80, viewport.clientHeight * 0.32))

        for (const entry of entries) {
          const element = anchorElements.get(entry.anchor)
          if (!element) continue
          if (element.getBoundingClientRect().top <= marker) {
            nextAnchor = entry.anchor
          } else {
            break
          }
        }
      }

      setCurrentAnchor((previous) =>
        previous === nextAnchor ? previous : nextAnchor
      )
    }
    const handleScroll = () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateCurrentAnchor)
    }

    const initialFrame = requestAnimationFrame(() => {
      updateCurrentAnchor()
      frame = requestAnimationFrame(updateCurrentAnchor)
    })
    viewport.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)

    return () => {
      cancelAnimationFrame(initialFrame)
      if (frame !== undefined) cancelAnimationFrame(frame)
      viewport.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [entries])

  if (entries.length === 0) return null

  const handleToggleHistory = (button: HTMLButtonElement) => {
    lastTriggerRef.current = button
    returnFocusRef.current = true
    setIsHistoryOpen((previous) => !previous)
  }

  const handleCloseHistory = () => {
    returnFocusRef.current = true
    setIsHistoryOpen(false)
  }

  const handleNavigate = (anchor: string) => {
    const viewport = document.querySelector<HTMLElement>(
      '[data-cy="chat-thread-viewport"]'
    )
    if (!viewport) return

    const target = findAnchor(viewport, anchor)
    if (!target) return

    const token = navigationTokenRef.current + 1
    navigationTokenRef.current = token
    navigationLockRef.current = { anchor, token }

    returnFocusRef.current = false
    setIsHistoryOpen(false)
    setCurrentAnchor(anchor)
    const viewportRect = viewport.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const mobileTopGutter = window.matchMedia('(max-width: 767px)').matches
      ? Number.parseFloat(window.getComputedStyle(viewport).paddingTop) || 0
      : 0
    const targetTop = Math.max(
      0,
      viewport.scrollTop + targetRect.top - viewportRect.top - mobileTopGutter
    )
    // The thread viewport sets CSS scroll-smooth, which makes a programmatic
    // scroll animate and could outlive the short navigation lock, letting the
    // scroll spy overwrite the selected turn mid-jump. Override the viewport's
    // scroll-behavior just for this instant reposition, then restore it so
    // ordinary scrolling keeps its smooth feel.
    const previousScrollBehavior = viewport.style.scrollBehavior
    viewport.style.scrollBehavior = 'auto'
    viewport.scrollTo({ top: targetTop })
    viewport.style.scrollBehavior = previousScrollBehavior
    target.focus({ preventScroll: true })

    const clearNavigationLock = (remainingFrames: number) => {
      if (navigationLockRef.current?.token !== token) return

      if (
        remainingFrames <= 0 ||
        Math.abs(viewport.scrollTop - targetTop) <= 1
      ) {
        navigationLockRef.current = null
        return
      }

      window.requestAnimationFrame(() =>
        clearNavigationLock(remainingFrames - 1)
      )
    }
    window.requestAnimationFrame(() => clearNavigationLock(12))
  }

  const desktopTickRanges = getHistoryRailTickRanges(
    entries.length,
    DESKTOP_TICK_LIMIT
  )
  const desktopCurrentTick = desktopTickRanges.findIndex(
    (range) =>
      currentIndex >= range.startIndex && currentIndex <= range.endIndex
  )

  return (
    <>
      <aside
        aria-label={t('chat.historyRail.label')}
        data-cy="chat-history-rail"
        ref={railRef}
        className="absolute inset-y-3 left-1 z-20 hidden w-8 overflow-visible md:block"
      >
        <nav
          className="relative flex h-full max-h-full flex-col items-center"
          aria-label={t('chat.historyRail.label')}
        >
          <span
            aria-hidden="true"
            className="bg-border/60 pointer-events-none absolute left-1/2 top-1/2 h-36 w-px -translate-x-1/2 -translate-y-1/2"
          />
          <ol className="relative flex h-36 w-full flex-col justify-between py-1">
            {desktopTickRanges.map((range, index) => {
              const isCurrent = index === desktopCurrentTick
              const representativeIndex = isCurrent
                ? currentIndex
                : range.representativeIndex
              const entry = entries[representativeIndex]
              if (!entry) return null

              return (
                <li
                  key={`desktop-tick-${range.startIndex}`}
                  className="relative flex min-h-0 flex-1 items-center justify-center"
                >
                  <HistoryRailTick
                    dialogId={HISTORY_DIALOG_DESKTOP_ID}
                    entry={entry}
                    isCurrent={isCurrent}
                    isOpen={isHistoryOpen}
                    onNavigate={handleNavigate}
                    onToggle={handleToggleHistory}
                    range={range}
                    title={t('chat.historyRail.turn')}
                    total={entries.length}
                  />
                </li>
              )
            })}
          </ol>
        </nav>
        {isHistoryOpen && (
          <HistoryDialog
            desktop
            entries={entries}
            id={HISTORY_DIALOG_DESKTOP_ID}
            currentAnchor={currentAnchor}
            onClose={handleCloseHistory}
            onNavigate={handleNavigate}
          />
        )}
      </aside>

      <nav
        aria-label={t('chat.historyRail.label')}
        data-cy="chat-history-rail-mobile"
        className="absolute right-2 top-2 z-20 md:hidden"
      >
        <button
          type="button"
          aria-controls={HISTORY_DIALOG_MOBILE_ID}
          aria-expanded={isHistoryOpen}
          aria-haspopup="dialog"
          aria-label={t('chat.historyRail.mobileLabel', {
            current: currentIndex + 1,
            total: entries.length,
          })}
          data-cy="chat-history-rail-mobile-trigger"
          onClick={(event) => handleToggleHistory(event.currentTarget)}
          className="border-border/70 bg-background/95 text-muted-foreground hover:text-foreground flex h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium tabular-nums shadow-sm backdrop-blur-md transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
        >
          <HistoryIcon className="size-4 shrink-0" aria-hidden />
          <span aria-hidden>
            {currentIndex + 1}/{entries.length}
          </span>
        </button>
        {isHistoryOpen && (
          <HistoryDialog
            entries={entries}
            id={HISTORY_DIALOG_MOBILE_ID}
            currentAnchor={currentAnchor}
            onClose={handleCloseHistory}
            onNavigate={handleNavigate}
          />
        )}
      </nav>
    </>
  )
}
