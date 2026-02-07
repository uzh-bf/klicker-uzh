import {
  getChatbotOr404,
  getParticipantId,
  requireParticipation,
} from '@/src/lib/server/apiGuards'
import { prisma } from '@klicker-uzh/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Retrieves all messages for a specific thread in chronological order.
 * Used by the frontend to load conversation history when switching threads.
 */
export async function GET(
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
    const messages = await prisma.chatMessage.findMany({
      where: {
        threadId,
        thread: {
          participantId,
          chatbotId,
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(
      messages.map((msg) => ({
        id: msg.id,
        threadId: msg.threadId,
        role: msg.role,
        content: msg.content,
        chatMode: msg.chatMode ?? null,
        modelId: msg.modelId ?? null,
        reasoningEffort: msg.reasoningEffort ?? null,
        reasoningContent: msg.reasoningContent ?? null,
        creditsUsed: msg.creditsUsed
          ? (
              msg.creditsUsed as unknown as { toNumber: () => number }
            ).toNumber()
          : null,
        parentId: (msg as { parentId?: string | null }).parentId || null,
        createdAt: msg.createdAt.toISOString(),
        updatedAt: msg.updatedAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error('Failed to fetch messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
