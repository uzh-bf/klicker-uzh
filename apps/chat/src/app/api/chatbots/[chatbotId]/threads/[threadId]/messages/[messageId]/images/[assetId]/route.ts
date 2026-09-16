import { prisma } from '@klicker-uzh/prisma'
import { type NextRequest, NextResponse } from 'next/server'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { readCourseImage } from '@/src/lib/server/courseImageStore'
import { resolveEffectiveMCPConfigurations } from '@/src/lib/server/effectiveChatModes'
import { selectedCourseImages } from '@/src/lib/sources/courseImages'
import type { ChatSourcePart } from '@/src/lib/sources/normalizeSources'
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
      { error: 'Course image unavailable' },
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
    const image = selectedCourseImages(
      message.content as ChatSourcePart[]
    ).find((item) => item.asset_id === assetId)
    if (!image) return missing()
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
    if (!kbIds?.includes(image.kb_id)) return missing()
    const resource = await prisma.kBResource.findFirst({
      where: {
        id: image.external_resource_id,
        kbId: image.kb_id,
        resourceVersion: image.resource_version,
        activeResourceVersion: image.resource_version,
        status: 'READY',
        deletedAt: null,
      },
      select: { id: true },
    })
    if (!resource) return missing()
    const bytes = await readCourseImage(image)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        ...headers,
        'Content-Type': 'image/png',
        'Content-Disposition': 'inline',
      },
    })
  } catch {
    return missing()
  }
}
