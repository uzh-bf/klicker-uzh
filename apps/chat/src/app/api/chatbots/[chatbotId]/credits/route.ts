import { getChatbotOr404, withChatbotAuth } from '@/src/lib/server/apiGuards'
import {
  getAutomaticModelId,
  getModelsForChatbot,
} from '@/src/lib/server/chatModelRegistry'
import { CreditsService } from '@/src/services/credits'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Retrieves usage credits for the authenticated participant and specific chatbot.
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

  const chatbotResult = await getChatbotOr404(chatbotId, {
    courseId: true,
    allowedModelIds: true,
    allowedReasoningEffortsByModel: true,
  })
  if ('response' in chatbotResult) {
    return chatbotResult.response
  }

  try {
    const credits = await CreditsService.getUserCredits(
      participantId as string,
      chatbotId
    )

    const availableModels = getModelsForChatbot(
      chatbotResult.chatbot,
      credits
    ).map(
      ({
        id,
        name,
        description,
        fallback,
        supportsReasoning,
        supportsImageAttachments,
        supportedReasoningEfforts,
      }) => ({
        id,
        name,
        description,
        fallback,
        supportsReasoning,
        supportsImageAttachments,
        allowedReasoningEfforts: supportedReasoningEfforts,
      })
    )

    return NextResponse.json({
      ...credits,
      availableModels,
      automaticModelId: getAutomaticModelId(
        credits,
        chatbotResult.chatbot.allowedModelIds
      ),
    })
  } catch (error) {
    console.error('Failed to fetch credits:', error)
    return NextResponse.json(
      { error: 'Failed to fetch credits' },
      { status: 500 }
    )
  }
}
