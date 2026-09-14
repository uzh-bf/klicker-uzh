import type { AppLogger } from '@klicker-uzh/logging/node'
import { type NextRequest, NextResponse } from 'next/server'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { createLoggedRoute } from '@/src/lib/server/requestLogging'
import { resolveElearningThreadOrigin } from '@/src/services/elearningContext'
import { ThreadService } from '@/src/services/threads'
import { z } from 'zod'

/**
 * Retrieves all chat threads for the authenticated participant ordered by most recently updated.
 * Used by the frontend to display threads in the sidebar.
 */
async function handleGET(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> },
  log: AppLogger
) {
  const { chatbotId } = await params
  const authResult = await withChatbotAuth(req, chatbotId, log)
  if ('response' in authResult) {
    return authResult.response
  }
  const { participantId } = authResult

  try {
    const threads = await ThreadService.getAllThreads(participantId, chatbotId)
    return NextResponse.json(threads)
  } catch {
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
async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> },
  log: AppLogger
) {
  const { chatbotId } = await params
  const authResult = await withChatbotAuth(req, chatbotId, log)
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
  } catch {
    return NextResponse.json(
      { error: 'Failed to create thread' },
      { status: 500 }
    )
  }
}

export const GET = createLoggedRoute(
  '/api/chatbots/:chatbotId/threads',
  handleGET
)
export const POST = createLoggedRoute(
  '/api/chatbots/:chatbotId/threads',
  handlePOST
)
