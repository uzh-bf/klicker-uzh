import { type NextRequest, NextResponse } from 'next/server'
import { getChatbotOr404, withChatbotAuth } from '@/src/lib/server/apiGuards'
import { resolveEffectiveChatModeOptions } from '@/src/lib/server/effectiveChatModes'

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
      standardModeConfig: true,
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
        mcpConfigurations,
        chatbot.standardModeConfig
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
