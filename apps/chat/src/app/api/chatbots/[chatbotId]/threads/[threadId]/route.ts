import {
  getChatbotOr404,
  getParticipantId,
  requireParticipation,
} from '@/src/lib/server/apiGuards'
import { NextRequest, NextResponse } from 'next/server'
import { ThreadService } from 'src/services/threads'

/**
 * Deletes a specific thread and all its associated messages permanently for the authenticated participant.
 * Used when user wants to remove a conversation thread entirely.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string; threadId: string }> }
) {
  const { chatbotId, threadId } = await params
  const participantResult = await getParticipantId(req)
  if ('response' in participantResult) {
    return participantResult.response
  }
  const { participantId } = participantResult

  const chatbotResult = await getChatbotOr404(chatbotId, { courseId: true })
  if ('response' in chatbotResult) {
    return chatbotResult.response
  }

  const participationResult = await requireParticipation(
    participantId,
    chatbotResult.chatbot.courseId
  )
  if ('response' in participationResult) {
    return participationResult.response
  }

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
