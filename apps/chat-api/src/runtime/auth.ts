import { prisma } from '@klicker-uzh/prisma'
import { ChatbotStatus, type Prisma } from '@klicker-uzh/prisma/client'
import { jwtVerify } from 'jose'
import { z } from 'zod'

export type AuthFailure = { error: string; status: 401 | 403 | 404 | 500 }
export type AuthSuccess = { participantId: string; courseId: string }
export function isFailure(value: object): value is AuthFailure {
  return 'error' in value
}

export async function getParticipantIdFromToken(
  participantToken: string | undefined
): Promise<{ participantId: string } | AuthFailure> {
  if (!participantToken)
    return { error: 'No authentication token found', status: 401 }
  const secret = process.env.APP_SECRET?.trim()
  if (!secret) return { error: 'Authentication is not configured', status: 500 }
  try {
    const { payload } = await jwtVerify(
      participantToken,
      new TextEncoder().encode(secret)
    )
    if (typeof payload.sub !== 'string' || !payload.sub)
      return { error: 'Invalid authentication token', status: 401 }
    return { participantId: payload.sub }
  } catch {
    return { error: 'Invalid authentication token', status: 401 }
  }
}

export async function getChatbotOr404<TSelect extends Prisma.ChatbotSelect>(
  chatbotId: string,
  select: TSelect
): Promise<
  { chatbot: Prisma.ChatbotGetPayload<{ select: TSelect }> } | AuthFailure
> {
  const id = z.string().uuid().safeParse(chatbotId)
  if (!id.success) return { error: 'Chatbot not found', status: 404 }
  const row = (await prisma.chatbot.findUnique({
    where: { id: id.data, course: { deletionRequestedAt: null } },
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
  if (!row || row.status !== ChatbotStatus.PUBLISHED)
    return { error: 'Chatbot not found', status: 404 }
  // Drop the guard-only status field unless the caller explicitly selected it,
  // so routes that serialize the chatbot wholesale (e.g. GET /api/chatbots/:id)
  // never expose owner-only lifecycle metadata on a participant surface (F7).
  if (select.status !== true) delete (row as Record<string, unknown>).status
  return { chatbot: row }
}

export async function requireParticipation(
  participantId: string,
  courseId: string
): Promise<{ ok: true } | AuthFailure> {
  try {
    const row = await prisma.participation.findUnique({
      where: { courseId_participantId: { courseId, participantId } },
      select: { id: true },
    })
    return row
      ? { ok: true }
      : { error: 'No valid participation found for this chatbot', status: 403 }
  } catch {
    return { error: 'Error checking participation', status: 500 }
  }
}

export async function authenticateParticipant(
  participantToken: string | undefined,
  chatbotId: string
): Promise<AuthSuccess | AuthFailure> {
  const participant = await getParticipantIdFromToken(participantToken)
  if (isFailure(participant)) return participant
  try {
    const result = await getChatbotOr404(chatbotId, { courseId: true })
    if (isFailure(result)) return result
    const membership = await requireParticipation(
      participant.participantId,
      result.chatbot.courseId
    )
    if (isFailure(membership)) return membership
    return {
      participantId: participant.participantId,
      courseId: result.chatbot.courseId,
    }
  } catch {
    return { error: 'Error checking participation', status: 500 }
  }
}
