// Authentication for the forwarded participant_token cookie. Duplicated from
// apps/chat/src/lib/server/apiGuards.ts (the Next route forwards the cookie raw;
// this service authenticates it itself — no trust boundary, per the plan). The
// only adaptation is framework shape: instead of returning a NextResponse, the
// helpers return a plain { error, status } tuple the Hono handler renders with
// c.json(error, status), keeping the same messages and status codes for wire
// parity. The three-step chain — JWT verify -> chatbot lookup -> participation —
// is identical to withChatbotAuth.
import { prisma } from '@klicker-uzh/prisma'
import { jwtVerify } from 'jose'
import { z } from 'zod'

export type AuthError = { error: string; status: 401 | 403 | 404 | 500 }
export type AuthSuccess = { participantId: string; courseId: string }

function isAuthError<T extends object>(
  result: AuthError | T
): result is AuthError {
  return 'error' in result
}

async function getParticipantId(
  participantToken: string | undefined
): Promise<{ participantId: string } | AuthError> {
  if (!participantToken) {
    return { error: 'No authentication token found', status: 401 }
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
      return { error: 'Invalid authentication token', status: 401 }
    }

    return { participantId }
  } catch (error) {
    console.error('JWT verification failed:', error)
    return { error: 'Invalid authentication token', status: 401 }
  }
}

async function getChatbotCourseId(
  chatbotId: string
): Promise<{ courseId: string } | AuthError> {
  const parsedId = z.string().uuid().safeParse(chatbotId)
  if (!parsedId.success) {
    return { error: 'Chatbot not found', status: 404 }
  }

  const chatbot = await prisma.chatbot.findUnique({
    where: { id: parsedId.data },
    select: { courseId: true },
  })

  if (!chatbot) {
    return { error: 'Chatbot not found', status: 404 }
  }

  return { courseId: chatbot.courseId }
}

async function requireParticipation(
  participantId: string,
  courseId: string
): Promise<{ ok: true } | AuthError> {
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
        error: 'No valid participation found for this chatbot',
        status: 403,
      }
    }

    return { ok: true }
  } catch (error) {
    console.error('Error checking participation:', error)
    return { error: 'Error checking participation', status: 500 }
  }
}

// Mirror of withChatbotAuth: verify the cookie, resolve the chatbot's course,
// enforce participation. Returns the authenticated participant + course on
// success, or an { error, status } tuple to render verbatim.
export async function withChatbotAuth(
  participantToken: string | undefined,
  chatbotId: string
): Promise<AuthSuccess | AuthError> {
  const participantResult = await getParticipantId(participantToken)
  if (isAuthError(participantResult)) {
    return participantResult
  }
  const { participantId } = participantResult

  const chatbotResult = await getChatbotCourseId(chatbotId)
  if (isAuthError(chatbotResult)) {
    return chatbotResult
  }

  const participationResult = await requireParticipation(
    participantId,
    chatbotResult.courseId
  )
  if (isAuthError(participationResult)) {
    return participationResult
  }

  return { participantId, courseId: chatbotResult.courseId }
}
