import { type NextRequest, NextResponse } from 'next/server'
import { withChatbotAuth } from '@/src/lib/server/apiGuards'
import { withRouteLogging } from '@/src/lib/server/requestLogging'
import { DisclaimersService } from '@/src/services/disclaimers'

export const maxDuration = 60

/**
 * Get disclaimer information for a chatbot and check acceptance status
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
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch disclaimer information' },
      { status: 500 }
    )
  }
}

/**
 * Accept or decline disclaimer
 */
async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params
  const authResult = await withChatbotAuth(req, chatbotId)
  if ('response' in authResult) {
    return authResult.response
  }
  const { participantId } = authResult

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
  } catch {
    return NextResponse.json(
      { error: 'Failed to update disclaimer status' },
      { status: 500 }
    )
  }
}

type RouteContext = { params: Promise<{ chatbotId: string }> }

export function GET(req: NextRequest, context: RouteContext) {
  return withRouteLogging(req, '/api/chatbots/:chatbotId/disclaimer', () =>
    handleGET(req, context)
  )
}

export function POST(req: NextRequest, context: RouteContext) {
  return withRouteLogging(req, '/api/chatbots/:chatbotId/disclaimer', () =>
    handlePOST(req, context)
  )
}
