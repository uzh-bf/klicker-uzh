import { prisma } from '@klicker-uzh/prisma'
import { ChatbotStatus, Prisma, UserRole } from '@klicker-uzh/prisma/client'
import { type JWTPayload, jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Every participant guard starts from the same three questions: is there a
// cookie, does its signature verify, and does the payload name a subject. The
// answers and their 401 responses are identical everywhere, so they live here
// once; a guard that needs more adds its own checks to the verified payload.
async function verifyParticipantToken(
  req: NextRequest
): Promise<
  { participantId: string; payload: JWTPayload } | { response: NextResponse }
> {
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
    const { payload } = await jwtVerify(
      participantToken,
      new TextEncoder().encode(process.env.APP_SECRET || '')
    )

    const participantId =
      typeof payload.sub === 'string' && payload.sub ? payload.sub : null

    if (!participantId) {
      return {
        response: NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        ),
      }
    }

    return { participantId, payload }
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

export async function getParticipantId(
  req: NextRequest
): Promise<{ participantId: string } | { response: NextResponse }> {
  const result = await verifyParticipantToken(req)
  if ('response' in result) {
    return result
  }

  return { participantId: result.participantId }
}

// Announcements and guided tours are addressed to people who own a persistent
// account, so the caller must be a full participant. `getParticipantId`
// deliberately accepts any token that carries a subject, which includes the
// temporary accounts issued for anonymous live-quiz participation; the guards
// below are the only thing that keeps those out. They mirror `resolveActor` in
// the matching GraphQL services, which reject such accounts outright instead of
// answering with empty state, so a misdirected caller learns it is on the wrong
// surface. Each surface names itself in the refusal, hence the message
// parameter.
async function getFullParticipantId(
  req: NextRequest,
  wrongAccountTypeMessage: string
): Promise<{ participantId: string } | { response: NextResponse }> {
  const result = await verifyParticipantToken(req)
  if ('response' in result) {
    return result
  }

  // Participant tokens carry no scope claim, so unlike the lecturer path there
  // is no further write floor to apply: the role is the whole check.
  if (result.payload.role !== UserRole.PARTICIPANT) {
    return {
      response: NextResponse.json(
        { error: wrongAccountTypeMessage },
        { status: 403 }
      ),
    }
  }

  return { participantId: result.participantId }
}

export async function getProductUpdateParticipantId(
  req: NextRequest
): Promise<{ participantId: string } | { response: NextResponse }> {
  return await getFullParticipantId(
    req,
    'This account type does not receive product updates'
  )
}

// The refusal repeats the wording of the GraphQL tour service so that both
// writers of the tour-state tables turn the same accounts away with the same
// explanation.
export async function getTourParticipantId(
  req: NextRequest
): Promise<{ participantId: string } | { response: NextResponse }> {
  return await getFullParticipantId(
    req,
    'This account type does not receive guided tours'
  )
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
    where: { id: parsedId.data },
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
