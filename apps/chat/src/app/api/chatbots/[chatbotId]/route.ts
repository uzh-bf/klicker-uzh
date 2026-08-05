import { type NextRequest, NextResponse } from 'next/server'
import { getChatbotOr404 } from '@/src/lib/server/apiGuards'
import { withRouteLogging } from '@/src/lib/server/requestLogging'

/**
 * Retrieves model details for a specific chatbot.
 */
async function handleGET(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params

  try {
    const chatbotResult = await getChatbotOr404(chatbotId, {
      id: true,
      name: true,
      description: true,
      avatar: true,
      modelSelection: true,
      allowedReasoningEffortsByModel: true,
      systemPrompts: true,
      disclaimerId: true,
    })

    if ('response' in chatbotResult) {
      return chatbotResult.response
    }

    return NextResponse.json(chatbotResult.chatbot)
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch model details' },
      { status: 500 }
    )
  }
}

export function GET(
  req: NextRequest,
  context: { params: Promise<{ chatbotId: string }> }
) {
  return withRouteLogging(req, '/api/chatbots/:chatbotId', () =>
    handleGET(req, context)
  )
}
