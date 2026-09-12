import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { resolveElearningThreadOrigin } from '@/src/services/elearningContext'
import { ThreadService } from '@/src/services/threads'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * Retrieves all chat threads for the authenticated participant ordered by most recently updated.
 * Used by the frontend to display threads in the sidebar.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const authResult = await withChatbotAuth(req, chatbotId)
  if ('response' in authResult) {
    return authResult.response
  }
  const { participantId } = authResult

  try {
    const threads = await ThreadService.getAllThreads(participantId, chatbotId)
    return NextResponse.json(threads)
  } catch (error) {
    console.error('Failed to fetch threads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch threads' },
      { status: 500 }
    )
  }
}

/**
 * Creates a new chat thread with an optional title for the authenticated participant.
 * Used when explicitly creating a thread or starting a new conversation.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const authResult = await withChatbotAuth(req, chatbotId)
  if ('response' in authResult) {
    return authResult.response
  }
  const { participantId } = authResult

  try {
    const body = z
      .object({
        title: z.string().max(200).nullable().optional(),
        origin: z.enum(['elearning']).optional(),
      })
      .parse(await req.json())
    // The eLearning launcher creates its conversation through this route before
    // it can send a verified snapshot, so the scoped session learner binding —
    // not the client's optional label — is what tags a thread. A caller without
    // that identity cannot claim the origin.
    const origin =
      resolveElearningThreadOrigin({
        learnerBinding: authResult.learnerBinding,
      }) ?? undefined
    const thread = await ThreadService.createThread(
      participantId,
      chatbotId,
      body.title,
      undefined,
      origin
    )
    return NextResponse.json(thread)
  } catch (error) {
    console.error('Failed to create thread:', error)
    return NextResponse.json(
      { error: 'Failed to create thread' },
      { status: 500 }
    )
  }
}
