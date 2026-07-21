import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { recordFeedbackScore } from '@/src/lib/server/langfuseFeedback'
import { prisma } from '@klicker-uzh/prisma'
import { ChatMessageRating } from '@klicker-uzh/prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// null clears a previous vote, so a participant can take their rating back.
const FeedbackSchema = z.object({
  rating: z.nativeEnum(ChatMessageRating).nullable(),
})

export async function POST(
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

    // Mirrored onto the message's Langfuse trace so answer quality can be
    // reviewed next to the generation. Awaited but non-throwing: the vote is
    // already stored, and telemetry problems must not fail a student's click.
    await recordFeedbackScore(message.id, rating)

    return NextResponse.json({ rating })
  } catch (error) {
    console.error('Failed to save message feedback:', error)
    return NextResponse.json(
      { error: 'Failed to save message feedback' },
      { status: 500 }
    )
  }
}
