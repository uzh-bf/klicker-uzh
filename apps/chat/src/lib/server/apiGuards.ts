import { prisma } from '@klicker-uzh/prisma'
import {
  ChatbotStatus,
  type Prisma,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { decodeJWT } from '@klicker-uzh/util'
import { extractBearerToken } from '@klicker-uzh/util/auth'
import { jwtVerify } from 'jose'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  PWA_CHAT_EMBED_SESSION_COOKIE,
  PWA_CHAT_EMBED_SESSION_SCOPE,
} from '@/src/lib/pwaEmbedAuth'
import {
  type AuthMode,
  GUEST_ACCOUNT_TYPE,
  verifyChatGuestToken,
} from '@/src/lib/server/ltiGuest'
import { verifyPwaEmbedSessionToken } from '@/src/lib/server/pwaEmbed'

export type { AuthMode }

export interface ParticipantIdentity {
  participantId: string
  authMode: AuthMode
  pwaEmbedScope?: {
    chatbotId: string
    courseId: string
  }
}

// The identity transports a participant request can carry. Every consumer (API
// routes, the page render and the proxy) resolves them in the same order so
// they reach the same decision.
export interface ChatTransportTokens {
  /** Account session cookie (`participant_token`). */
  participantToken?: string
  /** Anonymous LTI guest cookie (`chat_participant_token`). */
  chatGuestToken?: string
  /** Course/chatbot-scoped PWA embed cookie (`chat_pwa_embed_token`). */
  pwaEmbedToken?: string
  /**
   * Scoped token handed to the server render in the reserved proxy header when
   * the cookie path is unavailable. Treated as untrusted input: it is verified
   * exactly like a cookie, so it can carry a signature but never a bare
   * identity.
   */
  scopedFallbackToken?: string
}

/** Collect the identity transports carried by a participant request. */
export function extractChatTransportTokens(
  req: NextRequest
): ChatTransportTokens {
  return {
    participantToken: req.cookies.get('participant_token')?.value,
    chatGuestToken: req.cookies.get('chat_participant_token')?.value,
    pwaEmbedToken: req.cookies.get(PWA_CHAT_EMBED_SESSION_COOKIE)?.value,
    // The Authorization header carries a scoped token for the
    // CHIPS-unsupported-browser path: client-side `authedFetch` reads a
    // chat-owned token from sessionStorage and attaches it to API calls. A raw
    // account session token in this header stays unsupported.
    scopedFallbackToken:
      extractBearerToken(req.headers.get('authorization')) ?? undefined,
  }
}

// Token order: chat_participant_token, scoped PWA embed token, then
// participant_token.
// Forward-compat: Phase C "switch to anonymous" only sets the guest cookie;
// account cookie stays. Guest-first ordering means the switch takes effect
// without clearing the account cookie or changing this code.
export async function getParticipantId(
  req: NextRequest
): Promise<ParticipantIdentity | { response: NextResponse }> {
  return resolveParticipantIdentity(extractChatTransportTokens(req))
}

/**
 * Resolve a participant identity from the request's transports. Every branch
 * verifies a signature; none trusts a caller-supplied identity value.
 */
export async function resolveParticipantIdentity({
  participantToken,
  chatGuestToken,
  pwaEmbedToken,
  scopedFallbackToken,
}: ChatTransportTokens): Promise<
  ParticipantIdentity | { response: NextResponse }
> {
  if (chatGuestToken) {
    try {
      const payload = await verifyChatGuestToken(chatGuestToken)
      if (payload.sub) {
        return { participantId: payload.sub, authMode: 'anonymous' }
      }
    } catch (error) {
      console.error('Chat guest token verification failed:', error)
      // Fall through to the scoped PWA embed / account session below.
    }
  }

  if (pwaEmbedToken) {
    try {
      const payload = await verifyPwaEmbedSessionToken(pwaEmbedToken)
      return {
        participantId: payload.sub,
        authMode: 'account',
        pwaEmbedScope: {
          chatbotId: payload.chatbotId,
          courseId: payload.courseId,
        },
      }
    } catch (error) {
      console.error('PWA embed session token verification failed:', error)
      // Fall through to the scoped fallback token / account session below.
    }
  }

  if (scopedFallbackToken) {
    const fallbackIdentity = await getScopedTokenIdentity(scopedFallbackToken)
    if (fallbackIdentity) return fallbackIdentity
  }

  return getParticipantIdFromToken(participantToken)
}

export async function getParticipantIdFromToken(
  participantToken: string | undefined
): Promise<ParticipantIdentity | { response: NextResponse }> {
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

  // The account session token is a bearer credential, so verify every claim
  // the backend signs into it: signature, issuer, expiry (enforced by
  // `jwtVerify`) and the participant role. A token minted for another
  // audience, such as a lecturer session, is not a participant identity.
  const issuer = process.env.APP_ORIGIN_API
  if (!issuer) {
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
      new TextEncoder().encode(appSecret),
      { issuer, algorithms: ['HS256'], requiredClaims: ['exp'] }
    )
    const participantId =
      typeof jwtPayload.payload.sub === 'string' && jwtPayload.payload.sub
        ? jwtPayload.payload.sub
        : null

    if (!participantId || jwtPayload.payload.role !== UserRole.PARTICIPANT) {
      return {
        response: NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        ),
      }
    }

    // A signature alone is not an identity: the subject must still name a real,
    // active participant. Anonymous LTI guests have their own token family and
    // must never be reachable through the account transport.
    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      select: {
        isActive: true,
        accounts: { select: { type: true } },
      },
    })
    const isGuestPersona = participant?.accounts.some(
      (account) => account.type === GUEST_ACCOUNT_TYPE
    )
    if (!participant || !participant.isActive || isGuestPersona) {
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

// Decode the scope first so only the two chat-owned scoped token families are
// even attempted; the signature check below remains the actual gate.
async function getScopedTokenIdentity(
  token: string
): Promise<ParticipantIdentity | null> {
  const scope = decodeScopedTokenScope(token)

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

function decodeScopedTokenScope(token: string): unknown {
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
  chatbotId: string
): Promise<
  | { participantId: string; authMode: AuthMode; chatbot: { courseId: string } }
  | { response: NextResponse }
> {
  const participantResult = await getParticipantId(req)
  if ('response' in participantResult) {
    return participantResult
  }

  return authorizeIdentityForChatbot(participantResult, chatbotId)
}

/**
 * Apply the shared identity-to-chatbot authorization: publication and course
 * existence, scoped-token binding to this exact chatbot and course, and course
 * participation. Both the API routes and the page render call this, so every
 * transport reaches the same decision.
 */
export async function authorizeIdentityForChatbot(
  participantResult: ParticipantIdentity,
  chatbotId: string
): Promise<
  | { participantId: string; authMode: AuthMode; chatbot: { courseId: string } }
  | { response: NextResponse }
> {
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
      select: { id: true },
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
