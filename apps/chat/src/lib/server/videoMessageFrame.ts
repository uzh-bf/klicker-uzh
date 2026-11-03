import { prisma } from '@klicker-uzh/prisma'
import { resolveMcpScope } from '../../services/mcpScope'
import {
  type ChatSourcePart,
  normalizeSourcesFromParts,
} from '../sources/normalizeSources'
import { selectedVideoFrames, type VideoFrame } from '../sources/videoFrames'
import { withVideoSourceFrames } from '../sources/videoSourceMedia'
import { resolveEffectiveMCPConfigurations } from './effectiveChatModes'

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
    select: { content: true, chatMode: true },
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

  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: { mcpConfigurations: { include: { mcpServer: true } } },
  })
  const configs = (chatbot?.mcpConfigurations ?? []).filter(
    (config) => config.isEnabled !== false
  )
  const mode = message.chatMode ?? 'tutor'
  const kbIds = resolveMcpScope(
    configs,
    mode,
    resolveEffectiveMCPConfigurations(configs, mode)
  )
  return kbIds?.includes(frame.kb_id) ? frame : undefined
}
