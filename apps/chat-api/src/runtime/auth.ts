import { prisma } from '@klicker-uzh/prisma'
import { jwtVerify } from 'jose'
import { z } from 'zod'

export type AuthFailure = {
  error: string
  status: 401 | 403 | 404 | 500
}

export type AuthSuccess = { participantId: string; courseId: string }

function isFailure(value: AuthFailure | object): value is AuthFailure {
  return 'error' in value
}

export async function authenticateParticipant(
  participantToken: string | undefined,
  chatbotId: string
): Promise<AuthSuccess | AuthFailure> {
  if (!participantToken) {
    return { error: 'No authentication token found', status: 401 }
  }

  let participantId: string
  try {
    const payload = await jwtVerify(
      participantToken,
      new TextEncoder().encode(process.env.APP_SECRET ?? '')
    )
    participantId =
      typeof payload.payload.sub === 'string' ? payload.payload.sub : ''
    if (!participantId)
      return { error: 'Invalid authentication token', status: 401 }
  } catch (error) {
    console.error('[chat-api] JWT verification failed:', error)
    return { error: 'Invalid authentication token', status: 401 }
  }

  const parsedChatbotId = z.string().uuid().safeParse(chatbotId)
  if (!parsedChatbotId.success) {
    return { error: 'Chatbot not found', status: 404 }
  }

  try {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: parsedChatbotId.data },
      select: { courseId: true },
    })
    if (!chatbot) return { error: 'Chatbot not found', status: 404 }

    const participation = await prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId: chatbot.courseId,
          participantId,
        },
      },
    })
    if (!participation) {
      return {
        error: 'No valid participation found for this chatbot',
        status: 403,
      }
    }
    return { participantId, courseId: chatbot.courseId }
  } catch (error) {
    console.error('[chat-api] Authentication lookup failed:', error)
    return { error: 'Error checking participation', status: 500 }
  }
}

export { isFailure }
