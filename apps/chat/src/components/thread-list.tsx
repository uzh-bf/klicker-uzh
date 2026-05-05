'use client'

import { CheckIcon, EditIcon, Trash2, XIcon } from 'lucide-react'
import type { FC } from 'react'
import { useState } from 'react'

import { TextField } from '@uzh-bf/design-system'
import { useParams, useRouter } from 'next/navigation'
import { useChatStore, type Thread } from '../stores/chatStore'

export const ThreadList: FC = () => {
  return (
    <div className="flex flex-col items-stretch gap-1">
      <ThreadListItems />
    </div>
  )
}

const ThreadListItems: FC = () => {
  const { chatbotId, threadId } = useParams<{
    chatbotId: string
    threadId?: string
  }>()
  const router = useRouter()
  const { threads, deleteThread } = useChatStore()

  return (
    <div className="flex flex-col gap-0.5 p-1">
      {threads.map((thread) => (
        <ThreadListItem
          key={thread.id}
          thread={thread}
          isActive={thread.id === threadId}
          onSelect={() => router.push(`/${chatbotId}/threads/${thread.id}`)}
          onDelete={async () => {
            const deleted = await deleteThread(chatbotId, thread.id)
            if (deleted && thread.id === threadId) {
              router.replace(`/${chatbotId}`)
            }
          }}
        />
      ))}
    </div>
  )
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
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const [isEditing, setIsEditing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
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
          : 'New Chat'
      }
    }
    return 'New Chat'
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`focus-visible:bg-muted focus-visible:ring-ring flex items-center gap-1 rounded-lg p-1 transition-all focus-visible:outline-none focus-visible:ring-2 ${isActive ? 'bg-primary/15' : 'hover:bg-accent'}`}
    >
      {isEditing ? (
        <>
          <TextField
            value={editTitle}
            onChange={setEditTitle}
            onKeyDown={handleKeyDown}
            className={{ input: 'mx-2 h-8 flex-grow bg-white text-sm' }}
            autoFocus
          />
          <button
            onClick={handleEditSave}
            aria-label="Save"
            className="text-foreground focus-visible:ring-ring mr-1 inline-flex size-6 shrink-0 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors hover:text-green-600 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4"
          >
            <CheckIcon />
            <span className="sr-only">Save</span>
          </button>
          <button
            onClick={handleEditCancel}
            aria-label="Cancel"
            className="text-foreground focus-visible:ring-ring mr-2 inline-flex size-6 shrink-0 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors hover:text-red-600 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4"
          >
            <XIcon />
            <span className="sr-only">Cancel</span>
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onSelect}
            className="min-w-0 flex-grow px-3 py-1 text-start"
          >
            <p className="truncate text-sm">{getThreadTitle()}</p>
          </button>
          <button
            onClick={handleEditStart}
            aria-label="Edit name"
            style={{
              display: isHovered || isActive ? 'inline-flex' : 'none',
            }}
            className="text-foreground hover:text-primary focus-visible:ring-ring mr-1 size-6 shrink-0 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4"
          >
            <EditIcon />
            <span className="sr-only">Edit name</span>
          </button>
          <button
            onClick={onDelete}
            aria-label="Delete chat"
            style={{
              display: isHovered || isActive ? 'inline-flex' : 'none',
            }}
            className="text-foreground hover:text-destructive focus-visible:ring-ring mr-2 size-6 shrink-0 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4"
          >
            <Trash2 />
            <span className="sr-only">Delete chat</span>
          </button>
        </>
      )}
    </div>
  )
}
