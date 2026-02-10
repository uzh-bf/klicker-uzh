import { prisma } from '@klicker-uzh/prisma'
import { Prisma } from '@klicker-uzh/prisma/client'
import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { type AuthMode, verifyChatGuestToken } from './ltiGuest'

export type { AuthMode }

type ParticipantIdentity = {
  participantId: string
  authMode: AuthMode
}

/**
 * Extracts the participant identity from the request cookies.
 *
 * Checks in order:
 * 1. `chat_participant_token` (anonymous/LTI-guest, signed with CHAT_GUEST_SECRET)
 * 2. `participant_token` (regular account, signed with APP_SECRET)
 *
 * Returns the participantId and the authMode ('account' or 'anonymous').
 */
export async function getParticipantId(
  req: NextRequest
): Promise<ParticipantIdentity | { response: NextResponse }> {
  // 1. Try chat_participant_token first (anonymous LTI guest)
  const chatGuestToken = req.cookies.get('chat_participant_token')?.value
  if (chatGuestToken) {
    try {
      const payload = await verifyChatGuestToken(chatGuestToken)
      if (payload.sub) {
        return { participantId: payload.sub, authMode: 'anonymous' }
      }
    } catch (error) {
      console.error('Chat guest token verification failed:', error)
      // Fall through to try participant_token
    }
  }

  // 2. Try regular participant_token
  const participantToken = req.cookies.get('participant_token')?.value

  if (!participantToken) {
    return {
      response: NextResponse.json(
        { error: 'No authentication token found' },
        { status: 401 }
      ),
    }
  }

  try {
    const jwtPayload = await jwtVerify(
      participantToken,
      new TextEncoder().encode(process.env.APP_SECRET || '')
    )
    const participantId =
      typeof jwtPayload.payload.sub === 'string' && jwtPayload.payload.sub
        ? jwtPayload.payload.sub
        : null

    if (!participantId) {
      return {
        response: NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        ),
      }
    }

    return { participantId, authMode: 'account' }
  } catch (error) {
    console.error('JWT verification failed:', error)
    return {
      response: NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      ),
    }
  }
}

export async function getChatbotOr404<TSelect extends Prisma.ChatbotSelect>(
  chatbotId: string,
  select: TSelect
): Promise<
  | { chatbot: Prisma.ChatbotGetPayload<{ select: TSelect }> }
  | { response: NextResponse }
> {
  const parsedId = z.string().uuid().safeParse(chatbotId)
  if (!parsedId.success) {
    return {
      response: NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      ),
    }
  }

  const chatbot = await prisma.chatbot.findUnique({
    where: { id: parsedId.data },
    select,
  })

  if (!chatbot) {
    return {
      response: NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      ),
    }
  }

  return { chatbot }
}

export async function withChatbotAuth(
  req: NextRequest,
  chatbotId: string
): Promise<
  | { participantId: string; chatbot: { courseId: string }; authMode: AuthMode }
  | { response: NextResponse }
> {
  const participantResult = await getParticipantId(req)
  if ('response' in participantResult) {
    return participantResult
  }
  const { participantId, authMode } = participantResult

  const chatbotResult = await getChatbotOr404(chatbotId, { courseId: true })
  if ('response' in chatbotResult) {
    return chatbotResult
  }

  const participationResult = await requireParticipation(
    participantId,
    chatbotResult.chatbot.courseId
  )
  if ('response' in participationResult) {
    return participationResult
  }

  return { participantId, chatbot: chatbotResult.chatbot, authMode }
}

export async function requireParticipation(
  participantId: string,
  courseId: string
): Promise<{ ok: true } | { response: NextResponse }> {
  try {
    const participation = await prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId,
          participantId,
        },
      },
    })

    if (!participation) {
      return {
        response: NextResponse.json(
          { error: 'No valid participation found for this chatbot' },
          { status: 403 }
        ),
      }
    }

    return { ok: true }
  } catch (error) {
    console.error('Error checking participation:', error)
    return {
      response: NextResponse.json(
        { error: 'Error checking participation' },
        { status: 500 }
      ),
    }
  }
}
