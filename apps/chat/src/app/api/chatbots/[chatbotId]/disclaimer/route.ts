import { DisclaimersService } from '@/src/services/disclaimers'
import { prisma } from '@klicker-uzh/prisma'
import { jwtVerify, type JWTPayload } from 'jose'
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
  const participantToken = req.cookies.get('participant_token')?.value

  if (!participantToken) {
    return NextResponse.json(
      { error: 'No authentication token found' },
      { status: 401 }
    )
  }

  let participantData: JWTPayload
  let participantId: string | null = null
  try {
    const jwtPayload = await jwtVerify(
      participantToken,
      new TextEncoder().encode(process.env.APP_SECRET || '')
    )
    participantData = jwtPayload.payload
    participantId =
      typeof participantData.sub === 'string' && participantData.sub
        ? participantData.sub
        : null
    if (!participantId) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('JWT verification failed:', error)
    return NextResponse.json(
      { error: 'Invalid authentication token' },
      { status: 401 }
    )
  }

  // check participation
  try {
    const participation = await prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId:
            (
              await prisma.chatbot.findUnique({
                where: { id: chatbotId },
                select: { courseId: true },
              })
            )?.courseId ?? '',
          participantId: participantId,
        },
      },
    })

    if (!participation) {
      return NextResponse.json(
        { error: 'No valid participation found for this chatbot' },
        { status: 403 }
      )
    }
  } catch (error) {
    console.error('Error checking participation:', error)
    return NextResponse.json(
      { error: 'Error checking participation' },
      { status: 500 }
    )
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
  const participantToken = req.cookies.get('participant_token')?.value

  if (!participantToken) {
    return NextResponse.json(
      { error: 'No authentication token found' },
      { status: 401 }
    )
  }

  let participantData: JWTPayload
  let participantId: string | null = null
  try {
    const jwtPayload = await jwtVerify(
      participantToken,
      new TextEncoder().encode(process.env.APP_SECRET || '')
    )
    participantData = jwtPayload.payload
    participantId =
      typeof participantData.sub === 'string' && participantData.sub
        ? participantData.sub
        : null
    if (!participantId) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('JWT verification failed:', error)
    return NextResponse.json(
      { error: 'Invalid authentication token' },
      { status: 401 }
    )
  }

  // check participation
  try {
    const participation = await prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId:
            (
              await prisma.chatbot.findUnique({
                where: { id: chatbotId },
                select: { courseId: true },
              })
            )?.courseId ?? '',
          participantId: participantId,
        },
      },
    })

    if (!participation) {
      return NextResponse.json(
        { error: 'No valid participation found for this chatbot' },
        { status: 403 }
      )
    }
  } catch (error) {
    console.error('Error checking participation:', error)
    return NextResponse.json(
      { error: 'Error checking participation' },
      { status: 500 }
    )
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
