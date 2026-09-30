import { type NextRequest, NextResponse } from 'next/server'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { readVideoFrame } from '@/src/lib/server/videoFrameStore'
import { resolveAuthorizedVideoFrame } from '@/src/lib/server/videoMessageFrame'
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
    NextResponse.json(
      { error: 'Video frame unavailable' },
      { status: 404, headers }
    )
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
