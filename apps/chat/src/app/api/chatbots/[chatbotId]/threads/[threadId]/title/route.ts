import {
  getChatbotOr404,
  getParticipantId,
  requireParticipation,
} from '@/src/lib/server/apiGuards'
import { NextRequest, NextResponse } from 'next/server'
import { ThreadService } from 'src/services/threads'

/**
 * Updates the title of a specific thread for the authenticated participant.
 * Used when user renames a thread or system auto-generates titles.
 */
export async function PUT(
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
