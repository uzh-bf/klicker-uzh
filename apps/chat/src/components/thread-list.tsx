'use client'

import { CheckIcon, EditIcon, Trash2, XIcon } from 'lucide-react'
import type { FC } from 'react'
import { createElement, useMemo, useState } from 'react'

import { TextField, useSidebar } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { getModeIcon } from '../lib/config/modes'
import { useChatStore, type Thread } from '../stores/chatStore'

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
  const { threads, deleteThread, isLoading } = useChatStore()
  const { setOpenMobile } = useSidebar()

  const groupedThreads = useMemo(() => groupThreadsByDate(threads), [threads])

  if (groupedThreads.length === 0) {
    // While threads are still being fetched, an empty array means "unknown",
    // not "no history" — showing the first-conversation hint then would
    // wrongly greet returning users during the loadThreads round-trip.
    if (isLoading) return null

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
            className="flex min-w-0 flex-grow items-center gap-2 px-3 py-1 text-start"
          >
            {/* Badge the row with the icon of the mode the thread was last
                used in (D6). Rendered via createElement rather than bound to a
                capitalized local: assigning the looked-up icon in the render
                body reads to the React Compiler lint as defining a new
                component on every render. */}
            {thread.lastChatMode &&
              createElement(getModeIcon(thread.lastChatMode), {
                className: 'text-muted-foreground size-4 shrink-0',
              })}
            <p className="truncate text-sm">{getThreadTitle()}</p>
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
            onClick={onDelete}
            aria-label={t('chat.threadList.deleteChat')}
            className={`text-foreground hover:text-destructive focus-visible:ring-ring mr-2 size-6 shrink-0 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4 ${isActive ? 'inline-flex' : 'hidden group-focus-within/thread:inline-flex group-hover/thread:inline-flex'}`}
          >
            <Trash2 />
            <span className="sr-only">{t('chat.threadList.deleteChat')}</span>
          </button>
        </>
      )}
    </div>
  )
}
