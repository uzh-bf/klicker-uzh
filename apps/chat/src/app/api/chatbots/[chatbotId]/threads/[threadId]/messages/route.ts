import {
  buildHistoryAttachmentDto,
  IMAGE_ROW_FILTER,
} from '@/src/lib/attachments/attachmentState'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { isParticipantReasoningVisible } from '@/src/lib/server/effectiveChatModes'
import { withoutReasoningParts } from '@/src/lib/server/persistedAssistantContent'
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
  const authResult = await withChatbotAuth(req, chatbotId)
  if ('response' in authResult) {
    return authResult.response
  }
  const { participantId } = authResult

  try {
    // Reasoning visibility follows the live approved mode config, so a mode
    // the lecturer switches to hidden also hides its earlier turns.
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { customModeConfig: true },
    })
    const messages = await prisma.chatMessage.findMany({
      where: {
        threadId,
        lifecycleStatus: 'COMPLETED',
        thread: {
          participantId,
          chatbotId,
        },
      },
      include: {
        attachments: {
          where: IMAGE_ROW_FILTER,
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // A thread uses few modes, so decide each mode once instead of
    // re-normalizing the whole mode config for every message.
    const reasoningVisibleByMode = new Map<string | null, boolean>()
    const isReasoningVisible = (mode: string | null) => {
      let visible = reasoningVisibleByMode.get(mode)
      if (visible === undefined) {
        visible = isParticipantReasoningVisible(chatbot?.customModeConfig, mode)
        reasoningVisibleByMode.set(mode, visible)
      }
      return visible
    }

    return NextResponse.json(
      messages.map((msg) => {
        const showReasoning = isReasoningVisible(msg.chatMode)
        return {
          id: msg.id,
          threadId: msg.threadId,
          role: msg.role,
          content: showReasoning
            ? msg.content
            : withoutReasoningParts(msg.content),
          chatMode: msg.chatMode ?? null,
          modelId: msg.modelId ?? null,
          reasoningEffort: msg.reasoningEffort ?? null,
          reasoningContent: showReasoning
            ? (msg.reasoningContent ?? null)
            : null,
          // Persisted verified learning-context snapshot; null for turns
          // without eLearning provenance.
          learningContext: msg.learningContext ?? null,
          rating: msg.rating ?? null,
          creditsUsed:
            msg.creditsUsed != null
              ? (
                  msg.creditsUsed as unknown as { toNumber: () => number }
                ).toNumber()
              : null,
          imageAttachments: msg.attachments.map((att) =>
            buildHistoryAttachmentDto(att)
          ),
          parentId: (msg as { parentId?: string | null }).parentId || null,
          createdAt: msg.createdAt.toISOString(),
          updatedAt: msg.updatedAt.toISOString(),
        }
      })
    )
  } catch (error) {
    console.error('Failed to fetch messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
