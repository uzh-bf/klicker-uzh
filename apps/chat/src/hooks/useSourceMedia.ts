'use client'

import { useParams } from 'next/navigation'
import { useMessageSourcesContext } from '@/src/components/message-sources-context'
import type { ChatSource } from '@/src/lib/sources/types'
import { sourceMedia } from '@/src/lib/sources/videoSourceMedia'
import { useChatStore } from '@/src/stores/chatStore'

export function useSourceMedia(source: ChatSource | undefined) {
  const params = useParams<{ chatbotId: string }>()
  const threadId = useChatStore((state) => state.activeThreadId)
  const { messageId } = useMessageSourcesContext()
  return sourceMedia(source, {
    chatbotId: params?.chatbotId,
    threadId,
    messageId,
  })
}
