import { CheckIcon, EditIcon, PlusIcon, Trash2, XIcon } from 'lucide-react'
import type { FC } from 'react'
import { useState } from 'react'

import { useChatStore, type Thread } from '@/app/stores/chatStore'
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const ThreadList: FC = () => {
  return (
    <div className="flex flex-col items-stretch gap-1.5">
      <ThreadListNew />
      <ThreadListItems />
    </div>
  )
}

const ThreadListNew: FC = () => {
  const createThread = useChatStore((state) => state.createThread)

  const handleNewThread = () => {
    createThread()
  }

  return (
    <Button
      onClick={handleNewThread}
      className="data-[active]:bg-muted hover:bg-muted flex items-center justify-start gap-1 rounded-lg px-2.5 py-2 text-start"
      variant="ghost"
    >
      <PlusIcon />
      New Chat
    </Button>
  )
}

const ThreadListItems: FC = () => {
  const threads = useChatStore((state) => state.threads)
  const activeThreadId = useChatStore((state) => state.activeThreadId)
  const switchToThread = useChatStore((state) => state.switchToThread)
  const deleteThread = useChatStore((state) => state.deleteThread)

  return (
    <div className="flex flex-col gap-1">
      {threads.map((thread) => (
        <ThreadListItem
          key={thread.id}
          thread={thread}
          isActive={thread.id === activeThreadId}
          onSelect={() => switchToThread(thread.id)}
          onDelete={() => deleteThread(thread.id)}
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
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const updateThreadTitle = useChatStore((state) => state.updateThreadTitle)

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
      await updateThreadTitle(thread.id, editTitle.trim())
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
      className={`data-[active]:bg-muted hover:bg-muted focus-visible:bg-muted focus-visible:ring-ring flex items-center gap-2 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 ${isActive ? 'bg-muted' : ''}`}
    >
      {isEditing ? (
        <>
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className="mx-2 h-8 flex-grow text-sm"
            autoFocus
          />
          <TooltipIconButton
            onClick={handleEditSave}
            className="text-foreground mr-1 size-4 p-0 hover:text-green-600"
            variant="ghost"
            tooltip="Save"
          >
            <CheckIcon />
          </TooltipIconButton>
          <TooltipIconButton
            onClick={handleEditCancel}
            className="text-foreground mr-3 size-4 p-0 hover:text-red-600"
            variant="ghost"
            tooltip="Cancel"
          >
            <XIcon />
          </TooltipIconButton>
        </>
      ) : (
        <>
          <button onClick={onSelect} className="flex-grow px-3 py-2 text-start">
            <p className="text-sm">{getThreadTitle()}</p>
          </button>
          <TooltipIconButton
            onClick={handleEditStart}
            className="hover:text-primary text-foreground mr-1 size-4 p-0"
            variant="ghost"
            tooltip="Edit name"
          >
            <EditIcon />
          </TooltipIconButton>
          <TooltipIconButton
            onClick={onDelete}
            className="hover:text-destructive text-foreground mr-3 size-4 p-0"
            variant="ghost"
            tooltip="Delete chat"
          >
            <Trash2 />
          </TooltipIconButton>
        </>
      )}
    </div>
  )
}
