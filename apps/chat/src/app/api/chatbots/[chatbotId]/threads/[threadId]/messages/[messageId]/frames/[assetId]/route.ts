import { prisma } from '@klicker-uzh/prisma'
import { type NextRequest, NextResponse } from 'next/server'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { resolveEffectiveMCPConfigurations } from '@/src/lib/server/effectiveChatModes'
import { readVideoFrame } from '@/src/lib/server/videoFrameStore'
import type { ChatSourcePart } from '@/src/lib/sources/normalizeSources'
import { selectedVideoFrames } from '@/src/lib/sources/videoFrames'
import { resolveMcpScope } from '@/src/services/mcpScope'

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      chatbotId: string
      threadId: string
      messageId: string
      assetId: string
    }>
  }
) {
  const { chatbotId, threadId, messageId, assetId } = await params
  const auth = await withChatbotAuth(req, chatbotId)
  if ('response' in auth) return auth.response
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  }
  const missing = () =>
    NextResponse.json(
      { error: 'Video frame unavailable' },
      { status: 404, headers }
    )
  if (!/^[a-f0-9]{64}$/.test(assetId)) return missing()
  try {
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        threadId,
        role: 'assistant',
        thread: { participantId: auth.participantId, chatbotId },
      },
      select: { content: true, chatMode: true },
    })
    if (!message || !Array.isArray(message.content)) return missing()
    const frame = selectedVideoFrames(message.content as ChatSourcePart[]).find(
      (item) => item.asset_id === assetId
    )
    if (!frame) return missing()
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { mcpConfigurations: { include: { mcpServer: true } } },
    })
    const configs = (chatbot?.mcpConfigurations ?? []).filter(
      (config) => config.isEnabled !== false
    )
    const kbIds = resolveMcpScope(
      configs,
      message.chatMode ?? 'tutor',
      resolveEffectiveMCPConfigurations(configs, message.chatMode ?? 'tutor')
    )
    if (!kbIds?.includes(frame.kb_id)) return missing()
    const bytes = await readVideoFrame(frame)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        ...headers,
        'Content-Type': 'image/jpeg',
        'Content-Disposition': 'inline',
      },
    })
  } catch (error) {
    // Keep the client response non-enumerable while retaining the full server-side stack.
    console.error('[chat] video frame failed', error)
    return missing()
  }
}
