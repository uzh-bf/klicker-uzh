import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { type NextRequest, NextResponse } from 'next/server'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { resolveAuthorizedVideoFrame } from '@/src/lib/server/videoMessageFrame'
import {
  parseVideoByteRange,
  readLocalVideo,
  signedVideoPlaybackUrl,
} from '@/src/lib/server/videoPlaybackStore'
import { videoAssetIdSchema } from '@/src/lib/sources/videoFrames'

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
  if (!videoAssetIdSchema.safeParse(assetId).success) return missing()
  try {
    const frame = await resolveAuthorizedVideoFrame({
      assetId,
      chatbotId,
      messageId,
      participantId: auth.participantId,
      threadId,
    })
    if (!frame) return missing()

    const directUrl = await signedVideoPlaybackUrl(frame)
    if (directUrl) return NextResponse.redirect(directUrl, 307)

    const { filename, size } = await readLocalVideo(frame)
    const range = parseVideoByteRange(req.headers.get('range'), size)
    if (!range)
      return new NextResponse(null, {
        status: 416,
        headers: { ...headers, 'Content-Range': `bytes */${size}` },
      })
    const { end, partial, start } = range
    const contentLength = end - start + 1
    const body = Readable.toWeb(createReadStream(filename, { start, end }))
    return new NextResponse(body as ReadableStream, {
      status: partial ? 206 : 200,
      headers: {
        ...headers,
        'Accept-Ranges': 'bytes',
        'Content-Type': frame.video_mime_type,
        'Content-Length': String(contentLength),
        ...(partial
          ? { 'Content-Range': `bytes ${start}-${end}/${size}` }
          : {}),
      },
    })
  } catch (error) {
    // Keep the client response non-enumerable while retaining the full server-side stack.
    console.error('[chat] video playback failed', error)
    return missing()
  }
}
