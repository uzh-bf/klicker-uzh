import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { ThreadService } from '@/src/services/threads'
import { NextRequest, NextResponse } from 'next/server'

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
    const { title } = await req.json()
    const thread = await ThreadService.createThread(
      participantId,
      chatbotId,
      title
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
