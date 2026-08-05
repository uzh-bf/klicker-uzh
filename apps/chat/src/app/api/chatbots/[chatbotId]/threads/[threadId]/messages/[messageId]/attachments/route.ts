import { prisma } from '@klicker-uzh/prisma'
import { type NextRequest, NextResponse } from 'next/server'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { withRouteLogging } from '@/src/lib/server/requestLogging'

async function handleGET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      chatbotId: string
      threadId: string
      messageId: string
    }>
  }
) {
  const { chatbotId, threadId, messageId } = await params
  const authResult = await withChatbotAuth(req, chatbotId)
  if ('response' in authResult) {
    return authResult.response
  }
  const { participantId } = authResult

  try {
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        threadId,
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
    })

    if (!message || message.attachments.length === 0) {
      return NextResponse.json(
        { error: 'Message attachments not found' },
        {
          status: 404,
          headers: {
            'Cache-Control': 'private, no-store',
          },
        }
      )
    }

    return NextResponse.json(
      message.attachments.map((attachment) => ({
        id: attachment.id,
        type: 'image' as const,
        position: attachment.position,
        imageBase64: attachment.imageBase64,
        imagePreviewBase64: attachment.imagePreviewBase64 ?? null,
        imageDescription: attachment.imageDescription ?? null,
        hasFullImage: true as const,
      })),
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    )
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch message attachments' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    )
  }
}

type RouteContext = {
  params: Promise<{
    chatbotId: string
    threadId: string
    messageId: string
  }>
}

export function GET(req: NextRequest, context: RouteContext) {
  return withRouteLogging(
    req,
    '/api/chatbots/:chatbotId/threads/:threadId/messages/:messageId/attachments',
    () => handleGET(req, context)
  )
}
