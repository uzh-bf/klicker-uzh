import { type NextRequest, NextResponse } from 'next/server'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { withRouteLogging } from '@/src/lib/server/requestLogging'
import { ThreadService } from '@/src/services/threads'

/**
 * Retrieves all chat threads for the authenticated participant ordered by most recently updated.
 * Used by the frontend to display threads in the sidebar.
 */
async function handleGET(
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
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const authResult = await withChatbotAuth(req, chatbotId)
  if ('response' in authResult) {
    return authResult.response
  }
  const { participantId } = authResult

  try {
    const { title } = await req.json()
    const thread = await ThreadService.createThread(
      participantId,
      chatbotId,
      title
    )
    return NextResponse.json(thread)
  } catch {
    return NextResponse.json(
      { error: 'Failed to create thread' },
      { status: 500 }
    )
  }
}

type RouteContext = { params: Promise<{ chatbotId: string }> }

export function GET(req: NextRequest, context: RouteContext) {
  return withRouteLogging(req, '/api/chatbots/:chatbotId/threads', () =>
    handleGET(req, context)
  )
}

export function POST(req: NextRequest, context: RouteContext) {
  return withRouteLogging(req, '/api/chatbots/:chatbotId/threads', () =>
    handlePOST(req, context)
  )
}
