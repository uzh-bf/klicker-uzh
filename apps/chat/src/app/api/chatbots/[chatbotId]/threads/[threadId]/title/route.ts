import { type NextRequest, NextResponse } from 'next/server'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { withRouteLogging } from '@/src/lib/server/requestLogging'
import { ThreadService } from '@/src/services/threads'

/**
 * Updates the title of a specific thread for the authenticated participant.
 * Used when user renames a thread or system auto-generates titles.
 */
async function handlePUT(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string; threadId: string }> }
) {
  const { chatbotId, threadId } = await params
  const authResult = await withChatbotAuth(req, chatbotId)
  if ('response' in authResult) {
    return authResult.response
  }
  const { participantId } = authResult

  try {
    const { title } = await req.json()

    const updatedThread = await ThreadService.updateThreadTitle(
      threadId,
      participantId,
      chatbotId,
      title
    )

    if (!updatedThread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'Thread title updated',
      thread: updatedThread,
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to update thread title' },
      { status: 500 }
    )
  }
}

export function PUT(
  req: NextRequest,
  context: {
    params: Promise<{ chatbotId: string; threadId: string }>
  }
) {
  return withRouteLogging(
    req,
    '/api/chatbots/:chatbotId/threads/:threadId/title',
    () => handlePUT(req, context)
  )
}
