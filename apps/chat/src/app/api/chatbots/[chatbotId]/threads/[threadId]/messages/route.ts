import type { AppLogger } from '@klicker-uzh/logging/node'
import { prisma } from '@klicker-uzh/prisma'
import { type NextRequest, NextResponse } from 'next/server'
import { buildHistoryAttachmentDto } from '@/src/lib/attachments/attachmentState'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { withRouteLogging } from '@/src/lib/server/requestLogging'

/**
 * Retrieves all messages for a specific thread in chronological order.
 * Used by the frontend to load conversation history when switching threads.
 */
async function handleGET(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string; threadId: string }> },
  log: AppLogger
) {
  const { chatbotId, threadId } = await params
  const authResult = await withChatbotAuth(req, chatbotId, log)
  if ('response' in authResult) {
    return authResult.response
  }
  const { participantId } = authResult

  try {
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
          orderBy: { position: 'asc' },
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
      }))
    )
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

export function GET(
  req: NextRequest,
  context: {
    params: Promise<{ chatbotId: string; threadId: string }>
  }
) {
  return withRouteLogging(
    req,
    '/api/chatbots/:chatbotId/threads/:threadId/messages',
    (log) => handleGET(req, context, log)
  )
}
