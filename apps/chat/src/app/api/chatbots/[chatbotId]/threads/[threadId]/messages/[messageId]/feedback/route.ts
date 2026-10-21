import { type AppLogger, toSafeError } from '@klicker-uzh/logging/node'
import { prisma } from '@klicker-uzh/prisma'
import { ChatMessageRating } from '@klicker-uzh/prisma/client'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { withRouteLogging } from '@/src/lib/server/requestLogging'

// null clears a previous vote, so a participant can take their rating back.
const FeedbackSchema = z.object({
  rating: z.nativeEnum(ChatMessageRating).nullable(),
})

async function handlePOST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      chatbotId: string
      threadId: string
      messageId: string
    }>
  },
  log: AppLogger
) {
  const { chatbotId, threadId, messageId } = await params
  const authResult = await withChatbotAuth(req, chatbotId, log)
  if ('response' in authResult) {
    return authResult.response
  }
  const { participantId } = authResult

  let rating: ChatMessageRating | null
  try {
    rating = FeedbackSchema.parse(await req.json()).rating
  } catch {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 400 })
  }

  try {
    // Scope the lookup by participant AND chatbot, not just by message id: the
    // id alone is a bearer token for anyone who learns it. A message belonging
    // to someone else is reported as missing rather than forbidden, so this
    // cannot be used to probe which message ids exist.
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        threadId,
        role: 'assistant',
        thread: {
          participantId,
          chatbotId,
        },
      },
      select: { id: true },
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    await prisma.chatMessage.update({
      where: { id: message.id },
      data: { rating },
    })

    return NextResponse.json({ rating })
  } catch {
    log.error(
      {
        event: 'chat.feedback.persist_failed',
        err: toSafeError('Failed to persist chat feedback'),
      },
      'Failed to persist chat feedback'
    )
    return NextResponse.json(
      { error: 'Failed to save message feedback' },
      { status: 500 }
    )
  }
}

export function POST(
  req: NextRequest,
  context: {
    params: Promise<{
      chatbotId: string
      threadId: string
      messageId: string
    }>
  }
) {
  return withRouteLogging(
    req,
    '/api/chatbots/:chatbotId/threads/:threadId/messages/:messageId/feedback',
    (log) => handlePOST(req, context, log)
  )
}
