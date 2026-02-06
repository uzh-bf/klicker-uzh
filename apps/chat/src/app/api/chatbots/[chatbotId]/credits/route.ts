import {
  getChatbotOr404,
  getParticipantId,
  requireParticipation,
} from '@/src/lib/server/apiGuards'
import {
  getAutomaticModelId,
  getChatModelRegistry,
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
  const participantResult = await getParticipantId(req)
  if ('response' in participantResult) {
    return participantResult.response
  }
  const { participantId } = participantResult

  const chatbotResult = await getChatbotOr404(chatbotId, { courseId: true })
  if ('response' in chatbotResult) {
    return chatbotResult.response
  }

  const participationResult = await requireParticipation(
    participantId,
    chatbotResult.chatbot.courseId
  )
  if ('response' in participationResult) {
    return participationResult.response
  }

  try {
    const credits = await CreditsService.getUserCredits(
      participantId as string,
      chatbotId
    )

    const allModels = getChatModelRegistry().map(
      ({ id, name, description, fallback, supportsReasoning }) => ({
        id,
        name,
        description,
        fallback,
        supportsReasoning,
      })
    )
    const availableModels =
      credits.current > 0 ? allModels : allModels.filter((m) => m.fallback)

    return NextResponse.json({
      ...credits,
      availableModels,
      automaticModelId: getAutomaticModelId(credits),
    })
  } catch (error) {
    console.error('Failed to fetch credits:', error)
    return NextResponse.json(
      { error: 'Failed to fetch credits' },
      { status: 500 }
    )
  }
}
