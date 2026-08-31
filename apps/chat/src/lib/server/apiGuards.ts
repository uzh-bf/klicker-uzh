import { prisma } from '@klicker-uzh/prisma'
import { ChatbotStatus, Prisma } from '@klicker-uzh/prisma/client'
import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export async function getParticipantId(
  req: NextRequest
): Promise<{ participantId: string } | { response: NextResponse }> {
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

    return { participantId }
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

  const row = (await prisma.chatbot.findUnique({
    where: {
      id: parsedId.data,
      course: { isDeleted: false, isDeletionPending: false },
    },
    // `status` is always selected on top of the caller's projection so this one
    // guard can enforce publication for every participant route.
    select: { ...select, status: true },
  })) as
    | (Prisma.ChatbotGetPayload<{ select: TSelect }> & {
        status: ChatbotStatus
      })
    | null

  // Participants may only reach a PUBLISHED chatbot. A draft, pending, paused,
  // or rejected bot 404s exactly like a missing one, so its existence is never
  // confirmed to a participant.
  if (!row || row.status !== ChatbotStatus.PUBLISHED) {
    return {
      response: NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      ),
    }
  }

  // Drop the guard-only status field unless the caller explicitly selected it,
  // so routes that serialize the chatbot wholesale (e.g. GET /api/chatbots/:id)
  // never expose owner-only lifecycle metadata on a participant surface (F7).
  if (select.status !== true) {
    delete (row as Record<string, unknown>).status
  }

  return { chatbot: row }
}

export async function withChatbotAuth(
  req: NextRequest,
  chatbotId: string
): Promise<
  | { participantId: string; chatbot: { courseId: string } }
  | { response: NextResponse }
> {
  const participantResult = await getParticipantId(req)
  if ('response' in participantResult) {
    return participantResult
  }
  const { participantId } = participantResult

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

  return { participantId, chatbot: chatbotResult.chatbot }
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
        course: { isDeleted: false, isDeletionPending: false },
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
