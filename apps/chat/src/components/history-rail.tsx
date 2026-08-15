'use client'

import {
  BotIcon,
  BrainCircuitIcon,
  CircleAlertIcon,
  CircleIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  WrenchIcon,
  XIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  type FC,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type {
  HistoryRailEntry,
  HistoryRailEntryKind,
  HistoryRailTickRange,
} from '../lib/history-rail'
import {
  getHistoryRailMessageAnchor,
  getHistoryRailTickRanges,
} from '../lib/history-rail'

type HistoryRailProps = {
  entries: readonly HistoryRailEntry[]
}

const DESKTOP_COLLAPSE_THRESHOLD = 12
const MOBILE_COLLAPSE_THRESHOLD = 6
const DESKTOP_TICK_LIMIT = 12
const MOBILE_TICK_LIMIT = 6
const HISTORY_DIALOG_DESKTOP_ID = 'chat-history-rail-dialog-desktop'
const HISTORY_DIALOG_MOBILE_ID = 'chat-history-rail-dialog-mobile'

const findAnchor = (
  viewport: HTMLElement,
  anchor: string
): HTMLElement | undefined =>
  Array.from(
    viewport.querySelectorAll<HTMLElement>('[data-history-rail-anchor]')
  ).find((element) => element.dataset.historyRailAnchor === anchor)

const revealCollapsedToolGroups = (
  viewport: HTMLElement,
  messageId: string
): void => {
  const message = findAnchor(viewport, getHistoryRailMessageAnchor(messageId))
  if (!message) return

  for (const button of message.querySelectorAll<HTMLButtonElement>(
    '[data-cy="chat-tool-group-toggle"][aria-expanded="false"]'
  )) {
    button.click()
  }
}

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

const formatToolName = (value: string): string =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const getEntryIcon = (
  kind: HistoryRailEntryKind,
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

  switch (kind) {
    case 'user':
      return <MessageCircleIcon className="size-3.5" aria-hidden />
    case 'assistant':
      return <BotIcon className="size-3.5" aria-hidden />
    case 'reasoning':
      return <BrainCircuitIcon className="size-3.5" aria-hidden />
    case 'tool':
      return <WrenchIcon className="size-3.5" aria-hidden />
    case 'error':
      return <CircleAlertIcon className="size-3.5" aria-hidden />
    default:
      return <CircleIcon className="size-3.5" aria-hidden />
  }
}

const HistoryRailEntryButton: FC<{
  entry: HistoryRailEntry
  index: number
  isCurrent: boolean
  mobile?: boolean
  onNavigate: (anchor: string) => void
  title: string
}> = ({ entry, index, isCurrent, mobile = false, onNavigate, title }) => {
  const t = useTranslations()
  const statusLabel =
    entry.status === 'running'
      ? t('chat.historyRail.inProgress')
      : entry.status === 'partial'
        ? t('chat.historyRail.partial')
        : entry.status === 'error'
          ? t('chat.historyRail.error')
          : undefined
  const preview = entry.preview ? `: ${entry.preview}` : ''
  const accessibleLabel = [title + preview, statusLabel]
    .filter(Boolean)
    .join(' — ')

  return (
    <button
      type="button"
      data-cy="chat-history-rail-entry"
      data-history-rail-entry={entry.id}
      aria-current={isCurrent ? 'step' : undefined}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      onClick={() => onNavigate(entry.anchor)}
      className={
        mobile
          ? `border-border/70 flex size-7 shrink-0 touch-manipulation items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${isCurrent ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`
          : `group relative flex size-8 shrink-0 touch-manipulation items-center justify-center rounded-lg transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${isCurrent ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`
      }
    >
      <span
        className={`relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full ${isCurrent ? 'bg-primary text-primary-foreground' : entry.status === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground group-hover:bg-background'}`}
      >
        {getEntryIcon(entry.kind, entry.status)}
      </span>
      <span className="sr-only">
        {mobile ? `${index + 1}. ` : ''}
        {accessibleLabel}
      </span>
    </button>
  )
}

const HistoryRailCollapsedTick: FC<{
  dialogId?: string
  entry: HistoryRailEntry
  index: number
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
  index,
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
  const detailClassName = isCurrent
    ? 'max-h-8 max-w-40 rounded-full group-hover:max-h-28 group-hover:w-72 group-hover:max-w-[calc(100vw-3rem)] group-hover:rounded-lg group-hover:px-3 group-focus-visible:max-h-28 group-focus-visible:w-72 group-focus-visible:max-w-[calc(100vw-3rem)] group-focus-visible:rounded-lg group-focus-visible:px-3'
    : 'max-h-28 w-72 max-w-[calc(100vw-3rem)] rounded-lg opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
  const detailTextClassName = isCurrent
    ? 'max-h-0 overflow-hidden opacity-0 transition-[max-height,opacity] group-hover:max-h-12 group-hover:opacity-100 group-focus-visible:max-h-12 group-focus-visible:opacity-100'
    : 'line-clamp-2'

  return (
    <button
      type="button"
      aria-controls={isCurrent ? dialogId : undefined}
      aria-current={isCurrent ? 'step' : undefined}
      aria-expanded={isCurrent ? isOpen : undefined}
      aria-haspopup={isCurrent ? 'dialog' : undefined}
      aria-label={accessibleLabel}
      data-history-rail-tick={entry.anchor}
      title={accessibleLabel}
      onClick={(event) => {
        if (isCurrent) {
          onToggle?.(event.currentTarget)
        } else {
          onNavigate(entry.anchor)
        }
      }}
      className={`group relative flex h-4 w-full touch-manipulation items-center justify-center rounded-full focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${isCurrent ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
    >
      <span
        aria-hidden="true"
        className={`block rounded-full transition-[width,height,background-color] ${isCurrent ? 'bg-primary h-0.5 w-4' : 'bg-border/80 h-0.5 w-2 group-hover:bg-foreground group-hover:w-3 group-focus-visible:bg-foreground group-focus-visible:w-3'}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-7 top-1/2 z-30 flex -translate-y-1/2 flex-col overflow-hidden border border-border/70 bg-background/95 px-2 py-1 shadow-sm backdrop-blur-md transition-[max-height,opacity,width,padding] ${detailClassName}`}
      >
        <span className="block truncate text-left text-[11px] font-medium leading-4">
          {title} · {isCurrent ? `${index + 1}/${total}` : itemLabel}
        </span>
        {entry.preview && (
          <span
            className={`text-muted-foreground block text-left text-[11px] leading-4 ${detailTextClassName}`}
          >
            {entry.preview}
          </span>
        )}
        {statusLabel && (
          <span
            className={`text-muted-foreground block text-left text-[10px] leading-3 ${detailTextClassName}`}
          >
            {statusLabel}
          </span>
        )}
      </span>
    </button>
  )
}

const HistoryCurrentButton: FC<{
  dialogId: string
  entry: HistoryRailEntry
  index: number
  isOpen: boolean
  mobile?: boolean
  onToggle: (button: HTMLButtonElement) => void
  title: string
  total: number
  top?: number | null
}> = ({
  dialogId,
  entry,
  index,
  isOpen,
  mobile = false,
  onToggle,
  title,
  total,
  top,
}) => {
  const t = useTranslations()
  const itemLabel = t('chat.historyRail.item', {
    current: index + 1,
    total,
  })
  const accessibleLabel = [
    t('chat.historyRail.label'),
    `${title}, ${itemLabel}`,
    t(
      isOpen ? 'chat.historyRail.closeHistory' : 'chat.historyRail.openHistory'
    ),
  ].join('. ')

  return (
    <button
      type="button"
      aria-controls={dialogId}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      aria-label={accessibleLabel}
      title={accessibleLabel}
      onClick={(event) => onToggle(event.currentTarget)}
      className={
        mobile
          ? 'border-border/70 bg-background text-muted-foreground flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center gap-1 rounded-full border px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700'
          : 'pointer-events-auto absolute left-8 z-30 max-w-40 -translate-y-1/2 touch-manipulation truncate rounded-full border border-border/70 bg-background/95 px-2 py-1 text-[11px] font-medium leading-4 shadow-sm backdrop-blur-md transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700'
      }
      style={mobile ? undefined : { top: top ?? 0 }}
    >
      {mobile && (
        <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full">
          {getEntryIcon(entry.kind, entry.status)}
        </span>
      )}
      <span className={mobile ? 'text-[11px] font-semibold' : 'truncate'}>
        {mobile ? `${index + 1}/${total}` : `${title} · ${index + 1}/${total}`}
      </span>
    </button>
  )
}

const HistoryDialog: FC<{
  desktop?: boolean
  entries: readonly HistoryRailEntry[]
  entryTitles: readonly string[]
  id: string
  currentAnchor: string | null
  onClose: () => void
  onNavigate: (anchor: string) => void
}> = ({
  desktop = false,
  entries,
  entryTitles,
  id,
  currentAnchor,
  onClose,
  onNavigate,
}) => {
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
      className={`border-border/70 bg-background/95 absolute z-40 flex max-h-[60vh] min-h-0 flex-col overflow-hidden rounded-xl border p-2 shadow-lg backdrop-blur-md ${desktop ? 'left-8 top-2 w-72 max-w-[calc(100vw-3rem)]' : 'left-0 top-full mt-2 w-[min(360px,calc(100vw-1rem))] max-h-[70dvh]'}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-2 pb-1">
        <h2 id={`${id}-title`} className="text-xs font-semibold">
          {t('chat.historyRail.label')}
        </h2>
        <button
          type="button"
          aria-label={t('chat.historyRail.closeHistory')}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
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
          const preview = entry.preview ? `: ${entry.preview}` : ''
          const itemLabel = t('chat.historyRail.item', {
            current: index + 1,
            total: entries.length,
          })
          const rowLabel = [
            itemLabel,
            `${entryTitles[index]}${preview}`,
            statusLabel,
          ]
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
                    {entryTitles[index]}
                  </span>
                  {entry.preview && (
                    <span className="text-muted-foreground line-clamp-1 block text-[11px] leading-4">
                      {entry.preview}
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
  const returnFocusRef = useRef(true)
  const wasHistoryOpenRef = useRef(false)
  const [currentAnchor, setCurrentAnchor] = useState<string | null>(
    entries[0]?.anchor ?? null
  )
  const [currentLabelTop, setCurrentLabelTop] = useState<number | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const entryTitles = useMemo(
    () =>
      entries.map((entry) => {
        switch (entry.kind) {
          case 'user':
            return t('chat.historyRail.you')
          case 'assistant':
            return t('chat.historyRail.assistant')
          case 'reasoning':
            return t('chat.historyRail.reasoning')
          case 'tool':
            return t('chat.historyRail.tool', {
              tool: formatToolName(
                entry.toolName ?? t('chat.historyRail.toolFallback')
              ),
            })
          case 'error':
            return t('chat.historyRail.error')
          default:
            return t('chat.historyRail.assistant')
        }
      }),
    [entries, t]
  )

  const currentIndex = Math.max(
    0,
    entries.findIndex((entry) => entry.anchor === currentAnchor)
  )
  const isDesktopCollapsed = entries.length > DESKTOP_COLLAPSE_THRESHOLD
  const isMobileCollapsed = entries.length > MOBILE_COLLAPSE_THRESHOLD

  useEffect(() => {
    setCurrentAnchor((previous) =>
      entries.some((entry) => entry.anchor === previous)
        ? previous
        : (entries[0]?.anchor ?? null)
    )
  }, [entries])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return

    const updateCurrentLabelPosition = () => {
      const railRect = rail.getBoundingClientRect()
      if (isDesktopCollapsed) {
        setCurrentLabelTop(null)
        return
      }

      const currentButton = Array.from(
        rail.querySelectorAll<HTMLButtonElement>('[data-history-rail-entry]')
      ).find((button) => button.dataset.historyRailEntry === currentAnchor)

      if (!currentButton) {
        setCurrentLabelTop(null)
        return
      }

      const buttonRect = currentButton.getBoundingClientRect()
      setCurrentLabelTop(buttonRect.top - railRect.top + buttonRect.height / 2)
    }

    updateCurrentLabelPosition()
    const scrollList = isDesktopCollapsed
      ? null
      : rail.querySelector<HTMLElement>('ol')
    scrollList?.addEventListener('scroll', updateCurrentLabelPosition, {
      passive: true,
    })
    window.addEventListener('resize', updateCurrentLabelPosition)

    return () => {
      scrollList?.removeEventListener('scroll', updateCurrentLabelPosition)
      window.removeEventListener('resize', updateCurrentLabelPosition)
    }
  }, [currentAnchor, isDesktopCollapsed])

  useEffect(() => {
    if (!currentAnchor) return

    const revealEntries = () => {
      const desktopRail = document.querySelector<HTMLElement>(
        '[data-cy="chat-history-rail"]'
      )
      if (desktopRail) revealCurrentEntry(desktopRail, currentAnchor, 'block')

      const mobileRail = document.querySelector<HTMLElement>(
        '[data-cy="chat-history-rail-mobile"]'
      )
      if (mobileRail) revealCurrentEntry(mobileRail, currentAnchor, 'inline')
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
    if (isDesktopCollapsed || isMobileCollapsed) return
    setIsHistoryOpen(false)
  }, [isDesktopCollapsed, isMobileCollapsed])

  useEffect(() => {
    if (entries.length === 0) return

    const viewport = document.querySelector<HTMLElement>(
      '[data-cy="chat-thread-viewport"]'
    )
    if (!viewport) return

    let frame: number | undefined
    const updateCurrentAnchor = () => {
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

    const navigateToTarget = (): boolean => {
      const target = findAnchor(viewport, anchor)
      if (!target) return false

      returnFocusRef.current = false
      setIsHistoryOpen(false)
      setCurrentAnchor(anchor)
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
      const viewportRect = viewport.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      viewport.scrollTo({
        top: Math.max(
          0,
          viewport.scrollTop + targetRect.top - viewportRect.top
        ),
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      })
      target.focus({ preventScroll: true })
      return true
    }

    if (navigateToTarget()) return

    const entry = entries.find((candidate) => candidate.anchor === anchor)
    if (entry?.kind !== 'tool') return

    revealCollapsedToolGroups(viewport, entry.messageId)
    window.requestAnimationFrame(navigateToTarget)
  }

  const currentEntry = entries[currentIndex] ?? entries[0]
  if (!currentEntry) return null

  const currentTitle =
    entryTitles[currentIndex] ?? t('chat.historyRail.assistant')
  const desktopTickRanges = getHistoryRailTickRanges(
    entries.length,
    DESKTOP_TICK_LIMIT
  )
  const mobileTickRanges = getHistoryRailTickRanges(
    entries.length,
    MOBILE_TICK_LIMIT
  )
  const desktopCurrentTick = desktopTickRanges.findIndex(
    (range) =>
      currentIndex >= range.startIndex && currentIndex <= range.endIndex
  )
  const mobileCurrentTick = mobileTickRanges.findIndex(
    (range) =>
      currentIndex >= range.startIndex && currentIndex <= range.endIndex
  )

  return (
    <>
      <aside
        aria-label={t('chat.historyRail.label')}
        data-cy="chat-history-rail"
        ref={railRef}
        className="absolute inset-y-3 left-1 z-20 hidden w-8 overflow-visible sm:block"
      >
        <nav
          className={`relative flex h-full max-h-full flex-col items-center ${isDesktopCollapsed ? 'justify-center' : ''}`}
          aria-label={t('chat.historyRail.label')}
        >
          <span
            aria-hidden="true"
            className={`bg-border/60 pointer-events-none absolute left-1/2 w-px -translate-x-1/2 ${isDesktopCollapsed ? 'top-1/2 h-36 -translate-y-1/2' : 'inset-y-3'}`}
          />
          {isDesktopCollapsed ? (
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
                    <HistoryRailCollapsedTick
                      dialogId={HISTORY_DIALOG_DESKTOP_ID}
                      entry={entry}
                      index={representativeIndex}
                      isCurrent={isCurrent}
                      isOpen={isHistoryOpen}
                      onNavigate={handleNavigate}
                      onToggle={handleToggleHistory}
                      range={range}
                      title={
                        entryTitles[representativeIndex] ??
                        t('chat.historyRail.assistant')
                      }
                      total={entries.length}
                    />
                  </li>
                )
              })}
            </ol>
          ) : (
            <ol className="relative flex max-h-full flex-col items-center gap-0.5 overflow-y-auto py-1 scrollbar-none">
              {entries.map((entry, index) => (
                <li key={entry.id}>
                  <HistoryRailEntryButton
                    entry={entry}
                    index={index}
                    isCurrent={entry.anchor === currentAnchor}
                    onNavigate={handleNavigate}
                    title={
                      entryTitles[index] ?? t('chat.historyRail.assistant')
                    }
                  />
                </li>
              ))}
            </ol>
          )}
        </nav>
        {!isDesktopCollapsed && currentLabelTop !== null && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-8 z-30 max-w-40 -translate-y-1/2 rounded-full border border-border/70 bg-background/95 px-2 py-1 shadow-sm backdrop-blur-md"
            style={{ top: currentLabelTop }}
          >
            <span className="block max-w-36 truncate text-[11px] font-medium leading-4">
              {currentTitle}
            </span>
          </span>
        )}
        {isHistoryOpen && isDesktopCollapsed && (
          <HistoryDialog
            desktop
            entries={entries}
            entryTitles={entryTitles}
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
        className="absolute left-2 top-2 z-20 sm:hidden"
      >
        {isMobileCollapsed ? (
          <>
            <div className="border-border/70 bg-background/95 flex w-fit max-w-[calc(100vw-1rem)] items-center gap-1 rounded-lg border px-1 py-1 shadow-sm backdrop-blur-md">
              <ol
                aria-hidden="true"
                className="flex h-5 w-20 items-center justify-between gap-1 px-1"
              >
                {mobileTickRanges.map((range, index) => (
                  <li
                    key={`mobile-tick-${range.startIndex}`}
                    className="flex items-center"
                  >
                    <span
                      className={`block rounded-full ${index === mobileCurrentTick ? 'bg-primary size-1.5' : 'bg-border size-1'}`}
                    />
                  </li>
                ))}
              </ol>
              <HistoryCurrentButton
                dialogId={HISTORY_DIALOG_MOBILE_ID}
                entry={currentEntry}
                index={currentIndex}
                isOpen={isHistoryOpen}
                mobile
                onToggle={handleToggleHistory}
                title={currentTitle}
                total={entries.length}
              />
            </div>
            {isHistoryOpen && (
              <HistoryDialog
                entries={entries}
                entryTitles={entryTitles}
                id={HISTORY_DIALOG_MOBILE_ID}
                currentAnchor={currentAnchor}
                onClose={handleCloseHistory}
                onNavigate={handleNavigate}
              />
            )}
          </>
        ) : (
          <div className="border-border/70 bg-background/95 flex w-fit max-w-[calc(100vw-1rem)] items-center gap-1 rounded-lg border px-1 py-1 shadow-sm backdrop-blur-md">
            <span className="text-muted-foreground shrink-0 px-1 text-[10px] font-semibold uppercase tracking-wide">
              {t('chat.historyRail.mobileLabel', {
                current: currentIndex + 1,
                total: entries.length,
              })}
            </span>
            <ol className="flex min-w-0 gap-0.5 overflow-x-auto">
              {entries.map((entry, index) => (
                <li key={entry.id}>
                  <HistoryRailEntryButton
                    entry={entry}
                    index={index}
                    isCurrent={entry.anchor === currentAnchor}
                    mobile
                    onNavigate={handleNavigate}
                    title={
                      entryTitles[index] ?? t('chat.historyRail.assistant')
                    }
                  />
                </li>
              ))}
            </ol>
          </div>
        )}
      </nav>
    </>
  )
}
