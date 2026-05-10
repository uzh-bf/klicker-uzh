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
  const { participantId, authMode } = authResult

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

    let availableModels = getModelsForChatbot(chatbotResult.chatbot, credits)

    // Phase A: anonymous (LTI guest) restricted to fallback models only.
    // Phase B replaces this with reasoning-effort tier gating so guests can
    // use the flagship model at free effort levels.
    if (authMode === 'anonymous') {
      availableModels = availableModels.filter((m) => m.fallback)
    }

    const allowedIdsForAuto =
      authMode === 'anonymous'
        ? availableModels.map((m) => m.id)
        : chatbotResult.chatbot.allowedModelIds

    // When anonymous and no fallback is available for this chatbot, the
    // computed `automaticModelId` would otherwise come from the global
    // registry and contradict the empty `availableModels` list.
    const automaticModelId =
      authMode === 'anonymous' && availableModels.length === 0
        ? null
        : getAutomaticModelId(credits, allowedIdsForAuto)

    return NextResponse.json({
      ...credits,
      availableModels: availableModels.map(
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
      ),
      automaticModelId,
      authMode,
    })
  } catch (error) {
    console.error('Failed to fetch credits:', error)
    return NextResponse.json(
      { error: 'Failed to fetch credits' },
      { status: 500 }
    )
  }
}
