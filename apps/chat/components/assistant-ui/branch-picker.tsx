'use client'

import { useChatStore } from '@/app/stores/chatStore'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useCallback, useMemo } from 'react'

interface BranchPickerProps {
  messageId: string
  className?: string
}

export function BranchPicker({ messageId, className }: BranchPickerProps) {
  const { getMessageBranches, switchToBranch } = useChatStore()

  // get branches for current message
  const branches = useMemo(() => {
    return getMessageBranches(messageId)
  }, [getMessageBranches, messageId])

  const currentIndex = useMemo(() => {
    const directIndex = branches.findIndex((branch) => branch.id === messageId)
    if (directIndex !== -1) {
      return directIndex
    }

    // if no direct match, might be an assistant message, find corresponding user message
    const currentThread = useChatStore
      .getState()
      .threads.find((t) => t.id === useChatStore.getState().activeThreadId)
    if (currentThread) {
      const currentMessage = currentThread.allMessages.find(
        (m) => m.id === messageId
      )
      if (currentMessage?.role === 'assistant' && currentMessage.parentId) {
        return branches.findIndex(
          (branch) => branch.id === currentMessage.parentId
        )
      }
    }

    return -1
  }, [branches, messageId])

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
    <div className={`flex items-center gap-1 ${className}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            disabled={!hasPrevious}
            onClick={goToPrevious}
            className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
          >
            <ChevronLeftIcon />
            <span className="sr-only">Previous branch</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Previous branch</TooltipContent>
      </Tooltip>

      <span className="flex items-center whitespace-nowrap px-1 text-xs">
        {currentIndex + 1} / {branches.length}
      </span>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            disabled={!hasNext}
            onClick={goToNext}
            className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center whitespace-nowrap rounded-md p-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
          >
            <ChevronRightIcon />
            <span className="sr-only">Next branch</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Next branch</TooltipContent>
      </Tooltip>
    </div>
  )
}
