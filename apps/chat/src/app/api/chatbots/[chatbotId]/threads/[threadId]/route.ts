import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { ThreadService } from '@/src/services/threads'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Deletes a specific thread and all its associated messages permanently for the authenticated participant.
 * Used when user wants to remove a conversation thread entirely.
 */
export async function DELETE(
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
    const deleted = await ThreadService.deleteThread(
      threadId,
      participantId,
      chatbotId
    )
    if (!deleted) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Thread deleted' })
  } catch (error) {
    console.error('Failed to delete thread:', error)
    return NextResponse.json(
      { error: 'Failed to delete thread' },
      { status: 500 }
    )
  }
}
