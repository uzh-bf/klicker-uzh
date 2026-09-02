import { getChatbotOr404 } from '@/src/lib/server/apiGuards'
import { resolveEffectiveChatModeOptions } from '@/src/lib/server/effectiveChatModes'
import { NextRequest, NextResponse } from 'next/server'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'

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
      mcpConfigurations: {
        select: {
          allowedTools: true,
          chatMode: true,
          isEnabled: true,
          parameters: true,
          priority: true,
          mcpServer: { select: { id: true } },
        },
      },
    })

    if ('response' in chatbotResult) {
      return chatbotResult.response
    }

    const { mcpConfigurations, ...chatbot } = chatbotResult.chatbot
    return NextResponse.json({
      modelSelection: chatbot.modelSelection,
      modeOptions: resolveEffectiveChatModeOptions(
        chatbot.systemPrompts,
        mcpConfigurations
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
