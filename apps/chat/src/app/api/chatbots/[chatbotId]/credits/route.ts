import { type NextRequest, NextResponse } from 'next/server'
import { getChatbotOr404, withChatbotAuth } from '@/src/lib/server/apiGuards'
import {
  getAutomaticModelId,
  getModelsForChatbot,
} from '@/src/lib/server/chatModelRegistry'
import { withRouteLogging } from '@/src/lib/server/requestLogging'
import { CreditsService } from '@/src/services/credits'
import { getNextResetTime } from '@/src/utils/creditPeriods'

/**
 * Retrieves usage credits for the authenticated participant and specific chatbot.
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

  const chatbotResult = await getChatbotOr404(chatbotId, {
    courseId: true,
    allowedModelIds: true,
    allowedReasoningEffortsByModel: true,
    creditResetPeriod: true,
  })
  if ('response' in chatbotResult) {
    return chatbotResult.response
  }

  try {
    const credits = await CreditsService.getUserCredits(
      participantId as string,
      chatbotId
    )

    const availableModels = getModelsForChatbot(chatbotResult.chatbot).map(
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

    // Resolve the refill moment server-side: the period maths lives here, and
    // sending an absolute timestamp lets the client render it in the reader's
    // own timezone instead of exposing the UTC period boundaries.
    const nextResetAt =
      getNextResetTime(
        chatbotResult.chatbot.creditResetPeriod
      )?.toISOString() ?? null

    return NextResponse.json({
      ...credits,
      nextResetAt,
      availableModels,
      automaticModelId: getAutomaticModelId(
        chatbotResult.chatbot.allowedModelIds
      ),
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch credits' },
      { status: 500 }
    )
  }
}

export function GET(
  req: NextRequest,
  context: { params: Promise<{ chatbotId: string }> }
) {
  return withRouteLogging(req, '/api/chatbots/:chatbotId/credits', () =>
    handleGET(req, context)
  )
}
