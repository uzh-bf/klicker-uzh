import { type NextRequest, NextResponse } from 'next/server'
import {
  hasConfiguredModeDescriptions,
  resolveModeDescriptions,
} from '@/src/lib/config/modes'
import { getChatbotOr404, withChatbotAuth } from '@/src/lib/server/apiGuards'

/**
 * Retrieves model details for a specific chatbot.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params

  try {
    const authResult = await withChatbotAuth(req, chatbotId)
    if ('response' in authResult) {
      return authResult.response
    }

    const chatbotResult = await getChatbotOr404(chatbotId, {
      modelSelection: true,
      systemPrompts: true,
    })

    if ('response' in chatbotResult) {
      return chatbotResult.response
    }

    return NextResponse.json({
      modelSelection: chatbotResult.chatbot.modelSelection,
      modeDescriptions: resolveModeDescriptions(
        chatbotResult.chatbot.systemPrompts
      ),
      modeDescriptionsAreFallback: !hasConfiguredModeDescriptions(
        chatbotResult.chatbot.systemPrompts
      ),
    })
  } catch (error) {
    console.error('Failed to fetch model details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch model details' },
      { status: 500 }
    )
  }
}
