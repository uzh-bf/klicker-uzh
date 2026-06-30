import { type AuthMode, verifyChatGuestToken } from '@/src/lib/server/ltiGuest'
import { prisma } from '@klicker-uzh/prisma'
import { Prisma } from '@klicker-uzh/prisma/client'
import { extractBearerToken } from '@klicker-uzh/util/auth'
import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export type { AuthMode }

type ParticipantIdentity = {
  participantId: string
  authMode: AuthMode
}

// Token order: chat_participant_token first, then participant_token.
// Forward-compat: Phase C "switch to anonymous" only sets the guest cookie;
// account cookie stays. Guest-first ordering means the switch takes effect
// without clearing the account cookie or changing this code.
//
// Authorization header fallback (`Bearer <token>`) supports the
// CHIPS-unsupported-browser path: client-side `authedFetch` reads the token
// from sessionStorage and attaches it to API calls. The header carries a
// chat-guest token (verified with the chat-guest secret); account-mode users
// in cookieless contexts are not yet supported here (would need a separate
// header handoff in PWA flow first).
export async function getParticipantId(
  req: NextRequest
): Promise<ParticipantIdentity | { response: NextResponse }> {
  const headerToken = extractBearerToken(req.headers.get('authorization'))
  const chatGuestToken =
    req.cookies.get('chat_participant_token')?.value ?? headerToken
  if (chatGuestToken) {
    try {
      const payload = await verifyChatGuestToken(chatGuestToken)
      if (payload.sub) {
        return { participantId: payload.sub, authMode: 'anonymous' }
      }
    } catch (error) {
      console.error('Chat guest token verification failed:', error)
      // Fall through to participant_token below.
    }
  }

  const participantToken = req.cookies.get('participant_token')?.value

  if (!participantToken) {
    return {
      response: NextResponse.json(
        { error: 'No authentication token found' },
        { status: 401 }
      ),
    }
  }

  const appSecret = process.env.APP_SECRET
  if (!appSecret) {
    return {
      response: NextResponse.json(
        { error: 'Server misconfigured' },
        { status: 500 }
      ),
    }
  }

  try {
    const jwtPayload = await jwtVerify(
      participantToken,
      new TextEncoder().encode(appSecret)
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
  | { participantId: string; authMode: AuthMode; chatbot: { courseId: string } }
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

  return { participantId, authMode, chatbot: chatbotResult.chatbot }
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
