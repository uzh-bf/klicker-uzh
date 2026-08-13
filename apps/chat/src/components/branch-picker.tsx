'use client'

import { getBranches } from '@/src/lib/api/utils'
import {
  type ExtendedThreadMessageLike,
  useChatStore,
} from '@/src/stores/chatStore'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useMemo } from 'react'
import { actionBarButtonClassName } from './ui/action-bar-button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

const EMPTY_MESSAGES: ExtendedThreadMessageLike[] = []

interface BranchPickerProps {
  messageId: string
  className?: string
}

export function BranchPicker({ messageId, className }: BranchPickerProps) {
  const t = useTranslations()
  const switchToBranch = useChatStore((state) => state.switchToBranch)

  // get all messages from the active thread to compute branches
  const allMessages = useChatStore((state) => {
    const activeThread = state.threads.find(
      (t) => t.id === state.activeThreadId
    )
    return activeThread?.allMessages ?? EMPTY_MESSAGES
  })

  const branches = useMemo(
    () => getBranches(allMessages, messageId),
    [allMessages, messageId]
  )

  const currentIndex = useMemo(() => {
    const directIndex = branches.findIndex((branch) => branch.id === messageId)
    if (directIndex !== -1) {
      return directIndex
    }

    // if no direct match, might be an assistant message, find corresponding user message
    const currentMessage = allMessages.find((m) => m.id === messageId)
    if (currentMessage?.role === 'assistant' && currentMessage.parentId) {
      return branches.findIndex(
        (branch) => branch.id === currentMessage.parentId
      )
    }

    return -1
  }, [branches, messageId, allMessages])

  const switchToBranchHandler = useCallback(
    (branchIndex: number) => {
      const targetBranch = branches[branchIndex]
      if (!targetBranch || !targetBranch.id || branchIndex === currentIndex)
        return

      switchToBranch(targetBranch.id)
    },
    [branches, currentIndex, switchToBranch]
  )

  const goToPrevious = useCallback(() => {
    if (currentIndex <= 0) return
    switchToBranchHandler(currentIndex - 1)
  }, [currentIndex, switchToBranchHandler])

  const goToNext = useCallback(() => {
    if (currentIndex >= branches.length - 1) return
    switchToBranchHandler(currentIndex + 1)
  }, [currentIndex, branches.length, switchToBranchHandler])

  if (branches.length <= 1 || currentIndex === -1) {
    return null
  }

  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex < branches.length - 1

  return (
    <div
      data-cy="chat-branch-picker"
      className={`flex items-center gap-1 ${className}`}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-cy="chat-branch-previous"
            disabled={!hasPrevious}
            onClick={goToPrevious}
            className={actionBarButtonClassName}
          >
            <ChevronLeftIcon />
            <span className="sr-only">{t('chat.branchPicker.previous')}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('chat.branchPicker.previous')}</TooltipContent>
      </Tooltip>

      <span
        data-cy="chat-branch-indicator"
        className="flex items-center whitespace-nowrap px-1 text-xs"
      >
        {currentIndex + 1} / {branches.length}
      </span>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-cy="chat-branch-next"
            disabled={!hasNext}
            onClick={goToNext}
            className={actionBarButtonClassName}
          >
            <ChevronRightIcon />
            <span className="sr-only">{t('chat.branchPicker.next')}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('chat.branchPicker.next')}</TooltipContent>
      </Tooltip>
    </div>
  )
}
