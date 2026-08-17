'use client'

import { CheckIcon, EditIcon, Trash2, XIcon } from 'lucide-react'
import type { FC } from 'react'
import { createElement, useEffect, useMemo, useRef, useState } from 'react'

import { TextField, useSidebar } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { formatModeLabel, getModeIcon } from '../lib/config/modes'
import { useChatStore, type Thread } from '../stores/chatStore'
import {
  transitionDeleteConfirm,
  type DeleteConfirmPhase,
} from './thread-list-state'

export const ThreadList: FC = () => {
  return (
    <div className="flex flex-col items-stretch gap-1">
      <ThreadListItems />
    </div>
  )
}

const ThreadListItems: FC = () => {
  const t = useTranslations()
  const { chatbotId, threadId } = useParams<{
    chatbotId: string
    threadId?: string
  }>()
  const router = useRouter()
  const { threads, deleteThread, isLoading, threadsLoadError, loadThreads } =
    useChatStore()
  const { setOpenMobile } = useSidebar()

  const groupedThreads = useMemo(() => groupThreadsByDate(threads), [threads])

  if (groupedThreads.length === 0) {
    // While threads are still being fetched, an empty array means "unknown",
    // not "no history" — showing the first-conversation hint then would
    // wrongly greet returning users during the loadThreads round-trip. Show
    // row skeletons instead of nothing (M4) — the S5b error state above
    // still wins once threadsLoadError is set, even if isLoading lingers.
    if (isLoading) {
      return (
        <div
          data-cy="chat-thread-list-skeleton"
          role="status"
          className="flex flex-col gap-1.5 p-1"
        >
          <span className="sr-only">{t('chat.threadList.loading')}</span>
          {[...Array(5)].map((_, index) => (
            <div
              key={index}
              aria-hidden="true"
              style={{ width: `${85 - index * 8}%` }}
              className="bg-muted h-8 animate-pulse rounded motion-reduce:animate-none"
            />
          ))}
        </div>
      )
    }

    if (threadsLoadError) {
      return (
        <div data-cy="chat-thread-list" className="flex flex-col gap-2 p-1">
          <p
            data-cy="chat-thread-list-error"
            className="text-destructive px-2 text-sm"
          >
            {t('chat.threadList.loadError')}
          </p>
          <button
            type="button"
            data-cy="chat-thread-list-retry"
            onClick={() => loadThreads(chatbotId)}
            className="text-foreground hover:bg-accent focus-visible:ring-ring mx-2 inline-flex w-fit items-center justify-center rounded-md border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1"
          >
            {t('chat.threadList.retry')}
          </button>
        </div>
      )
    }

    return (
      <div data-cy="chat-thread-list" className="flex flex-col gap-2 p-1">
        <p
          data-cy="chat-thread-list-empty"
          className="text-muted-foreground px-2 text-sm"
        >
          {t('chat.threadList.emptyState')}
        </p>
      </div>
    )
  }

  return (
    <div data-cy="chat-thread-list" className="flex flex-col gap-2 p-1">
      {groupedThreads.map(({ key, items }) => (
        <div key={key} className="flex flex-col gap-0.5">
          <p className="text-muted-foreground px-2 text-xs font-semibold uppercase">
            {t(`chat.threadList.${key}`)}
          </p>
          {items.map((thread) => (
            <ThreadListItem
              key={thread.id}
              thread={thread}
              isActive={thread.id === threadId}
              onSelect={() => {
                router.push(`/${chatbotId}/threads/${thread.id}`)
                setOpenMobile(false)
              }}
              onDelete={async () => {
                const deleted = await deleteThread(chatbotId, thread.id)
                if (deleted && thread.id === threadId) {
                  router.replace(`/${chatbotId}`)
                }
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

const groupThreadsByDate = (threads: Thread[]) => {
  const todayStart = startOfDay(new Date())
  const yesterdayStart = addDays(todayStart, -1)
  const weekStart = startOfWeek(todayStart)

  const today: Thread[] = []
  const yesterday: Thread[] = []
  const thisWeek: Thread[] = []
  const earlier: Thread[] = []

  const sortedThreads = [...threads].sort((a, b) => {
    const aTime = new Date(a.updatedAt).getTime()
    const bTime = new Date(b.updatedAt).getTime()
    return bTime - aTime
  })

  sortedThreads.forEach((thread) => {
    const updatedAt = startOfDay(new Date(thread.updatedAt))

    if (updatedAt >= todayStart) {
      today.push(thread)
      return
    }

    if (updatedAt >= yesterdayStart) {
      yesterday.push(thread)
      return
    }

    if (updatedAt >= weekStart) {
      thisWeek.push(thread)
      return
    }

    earlier.push(thread)
  })

  return (
    [
      { key: 'groupToday', items: today },
      { key: 'groupYesterday', items: yesterday },
      { key: 'groupThisWeek', items: thisWeek },
      { key: 'groupEarlier', items: earlier },
    ] as const
  ).filter(({ items }) => items.length > 0)
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const startOfWeek = (date: Date) => {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return startOfDay(addDays(date, diff))
}

// How long the row stays armed after the first delete click before it
// auto-reverts (T2.3).
const DELETE_CONFIRM_TIMEOUT_MS = 4000

interface ThreadListItemProps {
  thread: Thread
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}

const ThreadListItem: FC<ThreadListItemProps> = ({
  thread,
  isActive,
  onSelect,
  onDelete,
}) => {
  const t = useTranslations()
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const { updateThreadTitle } = useChatStore()

  const [deletePhase, setDeletePhase] = useState<DeleteConfirmPhase>('idle')
  // Holds the pending auto-revert timeout so a second click, an explicit
  // cancel, or unmount can all clear it before it fires.
  const deleteRevertTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearDeleteRevertTimer = () => {
    if (deleteRevertTimer.current !== null) {
      clearTimeout(deleteRevertTimer.current)
      deleteRevertTimer.current = null
    }
  }

  // Timer cleanup on unmount — reads the ref directly rather than calling
  // clearDeleteRevertTimer so the effect has no external dependency.
  useEffect(() => {
    return () => {
      if (deleteRevertTimer.current !== null) {
        clearTimeout(deleteRevertTimer.current)
      }
    }
  }, [])

  const revertDeleteConfirm = () => {
    clearDeleteRevertTimer()
    setDeletePhase('idle')
  }

  const handleDeleteClick = () => {
    clearDeleteRevertTimer()
    const { phase, shouldDelete } = transitionDeleteConfirm(
      deletePhase,
      'click'
    )
    setDeletePhase(phase)
    if (shouldDelete) {
      // Always the current onDelete prop for this render, so this never
      // deletes a stale/wrong thread even if the row re-renders while armed.
      onDelete()
      return
    }
    deleteRevertTimer.current = setTimeout(
      revertDeleteConfirm,
      DELETE_CONFIRM_TIMEOUT_MS
    )
  }

  const handleDeleteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && deletePhase === 'confirming') {
      revertDeleteConfirm()
    }
  }

  // Covers both mouse (pointer truly leaving the row) and keyboard/touch
  // (focus moving to something outside the row) — either one cancels a
  // pending confirm, matching the "focus/pointer leaves the row" requirement.
  const handleRowMouseLeave = () => {
    if (deletePhase === 'confirming') {
      revertDeleteConfirm()
    }
  }

  const handleRowBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (
      deletePhase === 'confirming' &&
      !e.currentTarget.contains(e.relatedTarget)
    ) {
      revertDeleteConfirm()
    }
  }

  const getThreadTitle = () => {
    if (thread.title) return thread.title
    if (thread.messages.length > 0) {
      const firstUserMessage = thread.messages.find((m) => m.role === 'user')
      if (firstUserMessage) {
        const content = Array.isArray(firstUserMessage.content)
          ? firstUserMessage.content.find(
              (c: { type: string; text?: string }) => c.type === 'text'
            )?.text
          : firstUserMessage.content
        return content
          ? content.slice(0, 30) + (content.length > 30 ? '...' : '')
          : t('chat.threadList.newChatTitle')
      }
    }
    return t('chat.threadList.newChatTitle')
  }

  const handleEditStart = () => {
    // Switching to the edit UI hides the delete button entirely, so drop any
    // pending delete confirm rather than leave its timer running unseen.
    revertDeleteConfirm()
    setEditTitle(getThreadTitle())
    setIsEditing(true)
  }

  const handleEditSave = async () => {
    if (editTitle.trim()) {
      await updateThreadTitle(chatbotId, thread.id, editTitle.trim())
    }
    setIsEditing(false)
  }

  const handleEditCancel = () => {
    setIsEditing(false)
    setEditTitle('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSave()
    } else if (e.key === 'Escape') {
      handleEditCancel()
    }
  }

  return (
    <div
      data-cy="chat-thread-item"
      // The row itself is never focused (its buttons/input are), so
      // focus-visible: here would be dead CSS. focus-within: highlights the
      // row when a child (select/edit/delete button, title input) has focus.
      className={`group/thread focus-within:bg-muted focus-within:ring-ring flex items-center rounded-lg py-1 transition-all focus-within:outline-none focus-within:ring-2 ${isActive ? 'bg-primary/15' : 'hover:bg-accent'}`}
      // A pending delete confirm reverts as soon as the pointer or focus
      // leaves the row (T2.3) — covers both moving the mouse away and
      // tabbing/tapping to a different row.
      onMouseLeave={handleRowMouseLeave}
      onBlur={handleRowBlur}
    >
      {isEditing ? (
        <>
          <TextField
            data-cy="chat-thread-title-input"
            // The field carries no visible label, so without this it has no
            // accessible name at all and screen-reader users hear only the
            // current title read as a value.
            aria-label={t('chat.threadList.editName')}
            value={editTitle}
            onChange={setEditTitle}
            onKeyDown={handleKeyDown}
            className={{ input: 'bg-background mx-2 h-8 flex-grow text-sm' }}
            autoFocus
          />
          <button
            type="button"
            data-cy="chat-thread-title-save"
            onClick={handleEditSave}
            aria-label={t('chat.threadList.save')}
            // TODO success token: no semantic "success" color exists in the
            // token system yet; hover:text-green-600 stays hardcoded until one
            // is added (D1/S6 — do not invent a token here).
            className="text-foreground focus-visible:ring-ring mr-1 inline-flex size-6 shrink-0 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors hover:text-green-600 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4"
          >
            <CheckIcon />
            <span className="sr-only">{t('chat.threadList.save')}</span>
          </button>
          <button
            type="button"
            data-cy="chat-thread-title-cancel"
            onClick={handleEditCancel}
            aria-label={t('chat.threadList.cancel')}
            className="text-foreground focus-visible:ring-ring hover:text-destructive mr-2 inline-flex size-6 shrink-0 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4"
          >
            <XIcon />
            <span className="sr-only">{t('chat.threadList.cancel')}</span>
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            data-cy="chat-thread-select"
            onClick={onSelect}
            aria-current={isActive ? 'page' : undefined}
            className="flex min-w-0 flex-grow flex-col gap-0.5 px-3 py-1 text-start"
          >
            <p className="truncate text-sm">{getThreadTitle()}</p>
            {/* Second line: the icon + name of the mode the thread was last
                used in (D6). Rendered via createElement rather than bound to a
                capitalized local: assigning the looked-up icon in the render
                body reads to the React Compiler lint as defining a new
                component on every render. Omitted entirely (no empty line)
                when the thread has no stored mode, e.g. threads created
                before mode tracking shipped. */}
            {thread.lastChatMode && (
              <p
                data-cy="chat-thread-mode"
                className="text-muted-foreground flex items-center gap-1 text-xs"
              >
                {createElement(getModeIcon(thread.lastChatMode), {
                  className: 'size-3 shrink-0',
                })}
                <span className="truncate">
                  {formatModeLabel(t, thread.lastChatMode)}
                </span>
              </p>
            )}
          </button>
          <button
            type="button"
            data-cy="chat-thread-edit-button"
            onClick={handleEditStart}
            aria-label={t('chat.threadList.editName')}
            className={`text-foreground hover:text-primary focus-visible:ring-ring mr-1 size-6 shrink-0 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4 ${isActive ? 'inline-flex' : 'hidden group-focus-within/thread:inline-flex group-hover/thread:inline-flex'}`}
          >
            <EditIcon />
            <span className="sr-only">{t('chat.threadList.editName')}</span>
          </button>
          <button
            type="button"
            data-cy="chat-thread-delete-button"
            onClick={handleDeleteClick}
            onKeyDown={handleDeleteKeyDown}
            // Confirm state gets the deleteConfirmAria name ("Confirm
            // deleting this chat") rather than the plain "Delete chat" —
            // the visible "Delete?"/"Löschen?" label alone doesn't convey
            // that a second click is destructive.
            aria-label={
              deletePhase === 'confirming'
                ? t('chat.threadList.deleteConfirmAria')
                : t('chat.threadList.deleteChat')
            }
            className={`focus-visible:ring-ring mr-2 shrink-0 items-center justify-center whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 ${
              deletePhase === 'confirming'
                ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 h-6 gap-1 px-2 text-xs font-semibold'
                : 'text-foreground hover:text-destructive size-6 p-1 [&>svg]:size-4'
            } ${isActive ? 'inline-flex' : 'hidden group-focus-within/thread:inline-flex group-hover/thread:inline-flex'}`}
          >
            {deletePhase === 'confirming' ? (
              // aria-label above already carries the accessible name here, so
              // this visible label doesn't need an sr-only mirror alongside it.
              <span>{t('chat.threadList.deleteConfirm')}</span>
            ) : (
              <>
                <Trash2 />
                <span className="sr-only">
                  {t('chat.threadList.deleteChat')}
                </span>
              </>
            )}
          </button>
        </>
      )}
      {/* Row-local live region for the armed delete. The button's swapped
          aria-label is the only other carrier of that state, and a label
          change while focus already sits on the button is announced
          unreliably. Rendered empty rather than conditionally so the region
          exists before the state flips. */}
      <span role="status" className="sr-only">
        {deletePhase === 'confirming'
          ? t('chat.threadList.deleteArmedStatus')
          : ''}
      </span>
    </div>
  )
}
