import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { prisma } from '@klicker-uzh/prisma'
import { type NextRequest, NextResponse } from 'next/server'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { resolveEffectiveMCPConfigurations } from '@/src/lib/server/effectiveChatModes'
import {
  readLocalVideo,
  signedVideoPlaybackUrl,
} from '@/src/lib/server/videoPlaybackStore'
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
    NextResponse.json({ error: 'Video unavailable' }, { status: 404, headers })
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
    const mode = message.chatMode ?? 'tutor'
    const kbIds = resolveMcpScope(
      configs,
      mode,
      resolveEffectiveMCPConfigurations(configs, mode)
    )
    if (!kbIds?.includes(frame.kb_id)) return missing()

    const directUrl = await signedVideoPlaybackUrl(frame)
    if (directUrl) return NextResponse.redirect(directUrl, 307)

    const { filename, size } = await readLocalVideo(frame)
    const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.get('range') ?? '')
    const start = match ? Number(match[1]) : 0
    const requestedEnd = match?.[2] ? Number(match[2]) : size - 1
    const end = Math.min(requestedEnd, size - 1)
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start ||
      start >= size
    )
      return new NextResponse(null, {
        status: 416,
        headers: { ...headers, 'Content-Range': `bytes */${size}` },
      })
    const contentLength = end - start + 1
    const body = Readable.toWeb(createReadStream(filename, { start, end }))
    return new NextResponse(body as ReadableStream, {
      status: match ? 206 : 200,
      headers: {
        ...headers,
        'Accept-Ranges': 'bytes',
        'Content-Type': frame.video_mime_type,
        'Content-Length': String(contentLength),
        ...(match ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
      },
    })
  } catch (error) {
    // Keep the client response non-enumerable while retaining the full server-side stack.
    console.error('[chat] video playback failed', error)
    return missing()
  }
}
