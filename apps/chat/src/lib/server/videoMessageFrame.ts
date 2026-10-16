import { prisma } from '@klicker-uzh/prisma'
import { resolveEffectiveMCPConfigurations } from './effectiveChatModes'
import type { ChatSourcePart } from '../sources/normalizeSources'
import { selectedVideoFrames, type VideoFrame } from '../sources/videoFrames'
import { resolveMcpScope } from '../../services/mcpScope'

/** Resolve a selected frame only when the participant still owns its message and KB scope. */
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

  const frame = selectedVideoFrames(message.content as ChatSourcePart[]).find(
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
