import { prisma } from '@klicker-uzh/prisma'
import { readMessageKnowledgeBaseScope } from './currentChatModeSource'
import {
  type ChatSourcePart,
  normalizeSourcesFromParts,
} from '../sources/normalizeSources'
import { selectedVideoFrames, type VideoFrame } from '../sources/videoFrames'
import { withVideoSourceFrames } from '../sources/videoSourceMedia'

/** Resolve displayed or source-preview frames within the owned message and current KB scope. */
export async function resolveAuthorizedVideoFrame({
  assetId,
  chatbotId,
  messageId,
  participantId,
  threadId,
}: {
  assetId: string
  chatbotId: string
  messageId: string
  participantId: string
  threadId: string
}): Promise<VideoFrame | undefined> {
  const message = await prisma.chatMessage.findFirst({
    where: {
      id: messageId,
      threadId,
      role: 'assistant',
      thread: { participantId, chatbotId },
    },
    select: { content: true, chatMode: true, createdAt: true },
  })
  if (!message || !Array.isArray(message.content)) return undefined

  const parts = message.content as ChatSourcePart[]
  const previews = withVideoSourceFrames(
    normalizeSourcesFromParts(parts),
    parts
  ).flatMap((source) => (source.videoFrame ? [source.videoFrame] : []))
  const frame = [...selectedVideoFrames(parts), ...previews].find(
    (item) => item.asset_id === assetId
  )
  if (!frame) return undefined

  // The producing mode and its original live link must still resolve to the
  // frame's source; otherwise the stored marker alone cannot authorize a read.
  const kbIds = await readMessageKnowledgeBaseScope({
    chatbotId,
    chatMode: message.chatMode,
    content: message.content,
    createdAt: message.createdAt,
  })
  return kbIds?.includes(frame.kb_id) ? frame : undefined
}
