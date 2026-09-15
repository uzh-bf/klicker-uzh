import { type NextRequest, NextResponse } from 'next/server'
import { getChatbotOr404, withChatbotAuth } from '@/src/lib/server/apiGuards'
import { resolveEffectiveChatModeOptions } from '@/src/lib/server/effectiveChatModes'
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
