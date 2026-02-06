import {
  getChatbotOr404,
  getParticipantId,
  requireParticipation,
} from '@/src/lib/server/apiGuards'
import { DisclaimersService } from '@/src/services/disclaimers'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

/**
 * Get disclaimer information for a chatbot and check acceptance status
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
    // Get disclaimer for chatbot
    const disclaimer =
      await DisclaimersService.getDisclaimerForChatbot(chatbotId)

    // Check acceptance status
    const status = await DisclaimersService.checkDisclaimerStatus(
      chatbotId,
      participantId
    )

    return NextResponse.json({
      disclaimer,
      status,
    })
  } catch (error) {
    console.error('Failed to fetch disclaimer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch disclaimer information' },
      { status: 500 }
    )
  }
}

/**
 * Accept or decline disclaimer
 */
export async function POST(
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
    const body = await req.json()
    const { action, disclaimerId } = body

    if (action === 'accept') {
      if (!disclaimerId) {
        return NextResponse.json(
          { error: 'Disclaimer ID is required for acceptance' },
          { status: 400 }
        )
      }

      const result = await DisclaimersService.acceptDisclaimer(
        chatbotId,
        participantId,
        disclaimerId
      )
      return NextResponse.json(result)
    } else if (action === 'decline') {
      const result = await DisclaimersService.declineDisclaimer(
        chatbotId,
        participantId
      )
      return NextResponse.json(result)
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "accept" or "decline"' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Failed to update disclaimer status:', error)
    return NextResponse.json(
      { error: 'Failed to update disclaimer status' },
      { status: 500 }
    )
  }
}
