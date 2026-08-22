import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { ThreadService } from '@/src/services/threads'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Updates the title of a specific thread for the authenticated participant.
 * Used when user renames a thread or system auto-generates titles.
 */
export async function PUT(
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
  } catch (error) {
    console.error('Failed to update thread title:', error)
    return NextResponse.json(
      { error: 'Failed to update thread title' },
      { status: 500 }
    )
  }
}
