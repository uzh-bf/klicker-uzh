'use client'

import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { CheckIcon, EditIcon, Trash2, XIcon } from 'lucide-react'
import type { FC } from 'react'
import { useState } from 'react'

import { Button, TextField } from '@uzh-bf/design-system'
import { useParams } from 'next/navigation'
import { useChatStore, type Thread } from '../stores/chatStore'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export const ThreadList: FC = () => {
  return (
    <div className="flex flex-col items-stretch gap-1.5">
      <ThreadListNew />
      <ThreadListItems />
    </div>
  )
}

const ThreadListNew: FC = () => {
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const { createThread } = useChatStore()

  const handleNewThread = () => {
    createThread(chatbotId)
  }

  return (
    <Button
      onClick={handleNewThread}
      basic
      className={{
        root: 'hover:bg-muted mx-6 my-2 flex items-center rounded-lg border-2 px-2.5 py-1',
      }}
    >
      <Button.Icon icon={faPlus} />
      <Button.Label>New Chat</Button.Label>
    </Button>
  )
}

const ThreadListItems: FC = () => {
  const { chatbotId } = useParams<{ chatbotId: string }>()
  const { threads, activeThreadId, switchToThread, deleteThread } =
    useChatStore()

  return (
    <div className="flex flex-col gap-1">
      {threads.map((thread) => (
        <ThreadListItem
          key={thread.id}
          thread={thread}
          isActive={thread.id === activeThreadId}
          onSelect={() => switchToThread(chatbotId, thread.id)}
          onDelete={() => deleteThread(chatbotId, thread.id)}
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
      className={`hover:bg-muted focus-visible:bg-muted focus-visible:ring-ring flex items-center gap-2 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 ${isActive ? 'bg-muted' : ''}`}
    >
      {isEditing ? (
        <>
          <TextField
            value={editTitle}
            onChange={setEditTitle}
            onKeyDown={handleKeyDown}
            className={{ input: 'mx-2 h-8 flex-grow text-sm' }}
            autoFocus
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleEditSave}
                className="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring mr-1 inline-flex size-4 items-center justify-center whitespace-nowrap rounded-md p-0 text-sm font-medium transition-colors hover:text-green-600 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
              >
                <CheckIcon />
                <span className="sr-only">Save</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Save</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleEditCancel}
                className="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring mr-3 inline-flex size-4 items-center justify-center whitespace-nowrap rounded-md p-0 text-sm font-medium transition-colors hover:text-red-600 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
              >
                <XIcon />
                <span className="sr-only">Cancel</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Cancel</TooltipContent>
          </Tooltip>
        </>
      ) : (
        <>
          <button onClick={onSelect} className="flex-grow px-3 py-2 text-start">
            <p className="text-sm">{getThreadTitle()}</p>
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleEditStart}
                className="hover:text-primary text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring mr-1 inline-flex size-4 items-center justify-center whitespace-nowrap rounded-md p-0 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
              >
                <EditIcon />
                <span className="sr-only">Edit name</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Edit name</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onDelete}
                className="hover:text-destructive text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring mr-3 inline-flex size-4 items-center justify-center whitespace-nowrap rounded-md p-0 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
              >
                <Trash2 />
                <span className="sr-only">Delete chat</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Delete chat</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  )
}
