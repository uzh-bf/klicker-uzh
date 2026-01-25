import {
  getAutomaticModelId,
  getPublicChatModels,
} from '@/src/lib/server/chatModelRegistry'
import { prisma } from '@klicker-uzh/prisma'
import { JWTPayload, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_PROMPT } from 'src/lib/config/prompts'
import { CreditsService } from 'src/services/credits'

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

  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: {
      courseId: true,
      modelSelection: true,
      systemPrompts: true,
    },
  })

  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  // check participation
  try {
    const participation = await prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId: chatbot.courseId,
          participantId,
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

  // credits
  let credits
  try {
    credits = await CreditsService.getUserCredits(participantId, chatbotId)
  } catch (error) {
    console.error('Failed to fetch credits:', error)
    return NextResponse.json(
      { error: 'Failed to fetch credits' },
      { status: 500 }
    )
  }

  // mode options
  const modeOptions: Record<string, string> = {}
  const systemPrompts = chatbot.systemPrompts as Record<
    string,
    { description?: string }
  >

  if (systemPrompts) {
    for (const [key, value] of Object.entries(systemPrompts)) {
      if (value?.description) {
        modeOptions[key] = value.description
      }
    }
  }

  if (Object.keys(modeOptions).length === 0) {
    for (const [key, value] of Object.entries(DEFAULT_PROMPT)) {
      modeOptions[key] = (value as { description: string }).description
    }
  }

  // model options
  const allModels = getPublicChatModels()
  const availableModels =
    credits.current > 0 ? allModels : allModels.filter((m) => m.fallback)

  return NextResponse.json({
    credits,
    modelSelectionEnabled: chatbot.modelSelection ?? false,
    modeOptions,
    availableModels,
    automaticModelId: getAutomaticModelId(credits),
  })
}
