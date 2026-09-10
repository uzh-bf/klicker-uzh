import type { AppLogger } from '@klicker-uzh/logging/node'
import { toSafeError } from '@klicker-uzh/logging/node'
import { prisma } from '@klicker-uzh/prisma'
import { ChatbotStatus, type Prisma } from '@klicker-uzh/prisma/client'
import { decodeJWT } from '@klicker-uzh/util'
import { extractBearerToken } from '@klicker-uzh/util/auth'
import { jwtVerify } from 'jose'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  PWA_CHAT_EMBED_SESSION_COOKIE,
  PWA_CHAT_EMBED_SESSION_SCOPE,
} from '@/src/lib/pwaEmbedAuth'
import { type AuthMode, verifyChatGuestToken } from '@/src/lib/server/ltiGuest'
import { verifyPwaEmbedSessionToken } from '@/src/lib/server/pwaEmbed'
import { getRouteLogger } from './requestLogging'

export type { AuthMode }

type ParticipantIdentity = {
  participantId: string
  authMode: AuthMode
  pwaEmbedScope?: {
    chatbotId: string
    courseId: string
  }
}

// Token order: chat_participant_token, scoped PWA embed token, then
// participant_token.
// Forward-compat: Phase C "switch to anonymous" only sets the guest cookie;
// account cookie stays. Guest-first ordering means the switch takes effect
// without clearing the account cookie or changing this code.
//
// Authorization header fallback (`Bearer <token>`) supports the
// CHIPS-unsupported-browser path: client-side `authedFetch` reads a chat-owned
// scoped token from sessionStorage and attaches it to API calls. Raw
// participant_token header fallback remains unsupported.
export async function getParticipantId(
  req: NextRequest,
  log: AppLogger = getRouteLogger()
): Promise<ParticipantIdentity | { response: NextResponse }> {
  const headerToken = extractBearerToken(req.headers.get('authorization'))
  const chatGuestCookieToken = req.cookies.get('chat_participant_token')?.value
  if (chatGuestCookieToken) {
    try {
      const payload = await verifyChatGuestToken(chatGuestCookieToken)
      if (payload.sub) {
        return { participantId: payload.sub, authMode: 'anonymous' }
      }
    } catch (error) {
      log.info(
        {
          event: 'chat.authentication.rejected',
          outcome: 'invalid_guest_token',
        },
        'Rejected chat guest token'
      )
      // Fall through to PWA embed / participant_token below.
    }
  }

  const pwaEmbedCookieToken = req.cookies.get(
    PWA_CHAT_EMBED_SESSION_COOKIE
  )?.value
  if (pwaEmbedCookieToken) {
    try {
      const payload = await verifyPwaEmbedSessionToken(pwaEmbedCookieToken)
      return {
        participantId: payload.sub,
        authMode: 'account',
        pwaEmbedScope: {
          chatbotId: payload.chatbotId,
          courseId: payload.courseId,
        },
      }
    } catch (error) {
      log.info(
        {
          event: 'chat.authentication.rejected',
          outcome: 'invalid_embed_token',
        },
        'Rejected PWA embed token'
      )
      // Fall through to header / participant_token below.
    }
  }

  if (headerToken) {
    const headerIdentity = await getHeaderTokenIdentity(headerToken)
    if (headerIdentity) return headerIdentity
  }

  return getParticipantIdFromToken(
    req.cookies.get('participant_token')?.value,
    log
  )
}

export async function getParticipantIdFromToken(
  participantToken: string | undefined,
  log: AppLogger = getRouteLogger()
): Promise<ParticipantIdentity | { response: NextResponse }> {
  if (!participantToken) {
    log.info(
      { event: 'chat.authentication.rejected', outcome: 'missing_token' },
      'Rejected chat authentication'
    )
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
      log.info(
        { event: 'chat.authentication.rejected', outcome: 'missing_subject' },
        'Rejected chat authentication'
      )
      return {
        response: NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        ),
      }
    }

    return { participantId, authMode: 'account' }
  } catch {
    log.info(
      { event: 'chat.authentication.rejected', outcome: 'invalid_token' },
      'Rejected chat authentication'
    )
    return {
      response: NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      ),
    }
  }
}

async function getHeaderTokenIdentity(
  token: string
): Promise<ParticipantIdentity | null> {
  const scope = decodeHeaderTokenScope(token)

  if (scope === 'CHAT_GUEST') {
    try {
      const payload = await verifyChatGuestToken(token)
      if (payload.sub) {
        return { participantId: payload.sub, authMode: 'anonymous' }
      }
    } catch {
      return null
    }
  }

  if (scope === PWA_CHAT_EMBED_SESSION_SCOPE) {
    try {
      const payload = await verifyPwaEmbedSessionToken(token)
      return {
        participantId: payload.sub,
        authMode: 'account',
        pwaEmbedScope: {
          chatbotId: payload.chatbotId,
          courseId: payload.courseId,
        },
      }
    } catch {
      return null
    }
  }

  return null
}

function decodeHeaderTokenScope(token: string): unknown {
  try {
    return decodeJWT(token).scope
  } catch {
    return null
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
      course: { deletionRequestedAt: null },
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
  chatbotId: string,
  log: AppLogger = getRouteLogger()
): Promise<
  | { participantId: string; authMode: AuthMode; chatbot: { courseId: string } }
  | { response: NextResponse }
> {
  return withChatbotTokenAuth(
    req.cookies.get('participant_token')?.value,
    chatbotId,
    log
  )
}

export async function withChatbotTokenAuth(
  participantToken: string | undefined,
  chatbotId: string,
  log: AppLogger = getRouteLogger()
): Promise<
  | { participantId: string; authMode: AuthMode; chatbot: { courseId: string } }
  | { response: NextResponse }
> {
  const participantResult = await getParticipantIdFromToken(
    participantToken,
    log
  )
  if ('response' in participantResult) {
    return participantResult
  }
  const { participantId, authMode } = participantResult

  const chatbotResult = await getChatbotOr404(chatbotId, { courseId: true })
  if ('response' in chatbotResult) {
    return chatbotResult
  }

  if (
    participantResult.pwaEmbedScope &&
    (participantResult.pwaEmbedScope.chatbotId !== chatbotId ||
      participantResult.pwaEmbedScope.courseId !==
        chatbotResult.chatbot.courseId)
  ) {
    return {
      response: NextResponse.json(
        { error: 'Embed session is not valid for this chatbot' },
        { status: 403 }
      ),
    }
  }

  const participationResult = await requireParticipation(
    participantId,
    chatbotResult.chatbot.courseId,
    log
  )
  if ('response' in participationResult) {
    return participationResult
  }

  return { participantId, authMode, chatbot: chatbotResult.chatbot }
}

export async function requireParticipation(
  participantId: string,
  courseId: string,
  log: AppLogger = getRouteLogger()
): Promise<{ ok: true } | { response: NextResponse }> {
  try {
    const participation = await prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId,
          participantId,
        },
      },
      select: { id: true },
    })

    if (!participation) {
      log.info(
        {
          event: 'chat.authorization.rejected',
          outcome: 'missing_participation',
        },
        'Rejected chat authorization'
      )
      return {
        response: NextResponse.json(
          { error: 'No valid participation found for this chatbot' },
          { status: 403 }
        ),
      }
    }

    return { ok: true }
  } catch {
    log.error(
      {
        event: 'chat.authorization.failed',
        outcome: 'failure',
        err: toSafeError('Failed to verify chat participation'),
      },
      'Failed to check participation'
    )
    return {
      response: NextResponse.json(
        { error: 'Error checking participation' },
        { status: 500 }
      ),
    }
  }
}
