import type { Prisma } from '@klicker-uzh/prisma/client'
import {
  authorizeIdentityForChatbot,
  type ChatTransportTokens,
  type ParticipantIdentity,
  resolveParticipantIdentity,
  getChatbotOr404 as sharedGetChatbotOr404,
  getParticipantIdFromToken as sharedGetParticipantIdFromToken,
  requireParticipation as sharedRequireParticipation,
} from '../host/lib/server/apiGuards.js'

export type { ChatTransportTokens } from '../host/lib/server/apiGuards.js'
export type AuthFailure = { error: string; status: 401 | 403 | 404 | 500 }
export type AuthSuccess = ParticipantIdentity & { courseId: string }
export function isFailure(value: object): value is AuthFailure {
  return 'error' in value
}

async function authFailure(response: Response): Promise<AuthFailure> {
  const body = (await response.json()) as { error: string }
  return { error: body.error, status: response.status as AuthFailure['status'] }
}

export async function getParticipantIdFromToken(
  participantToken: string | undefined
): Promise<ParticipantIdentity | AuthFailure> {
  const result = await sharedGetParticipantIdFromToken(participantToken)
  return 'response' in result ? authFailure(result.response) : result
}

export async function getChatbotOr404<TSelect extends Prisma.ChatbotSelect>(
  chatbotId: string,
  select: TSelect
): Promise<
  { chatbot: Prisma.ChatbotGetPayload<{ select: TSelect }> } | AuthFailure
> {
  const result = await sharedGetChatbotOr404(chatbotId, select)
  return 'response' in result ? authFailure(result.response) : result
}

export async function requireParticipation(
  participantId: string,
  courseId: string
): Promise<{ ok: true } | AuthFailure> {
  const result = await sharedRequireParticipation(participantId, courseId)
  return 'response' in result ? authFailure(result.response) : result
}

export async function authenticateParticipant(
  tokens: ChatTransportTokens,
  chatbotId: string
): Promise<AuthSuccess | AuthFailure> {
  const participant = await resolveParticipantIdentity(tokens, {
    targetChatbotId: chatbotId,
  })
  if ('response' in participant) return authFailure(participant.response)
  const result = await authorizeIdentityForChatbot(participant, chatbotId)
  if ('response' in result) return authFailure(result.response)
  return { ...participant, courseId: result.chatbot.courseId }
}
