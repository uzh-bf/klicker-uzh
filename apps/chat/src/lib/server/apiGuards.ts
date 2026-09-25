import { prisma } from '@klicker-uzh/prisma'
import {
  ChatbotStatus,
  type Prisma,
  UserRole,
} from '@klicker-uzh/prisma/client'
import {
  decodeJWT,
  isParticipantDataUseComplete,
  participantAccountDataUseSelect,
} from '@klicker-uzh/util'
import { extractBearerToken } from '@klicker-uzh/util/auth'
import { jwtVerify } from 'jose'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  type ChatDataUseState,
  PARTICIPANT_DATA_USE_COMPLETION_REQUIRED,
} from '@/src/lib/dataUse'
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

export type { AuthMode, ChatDataUseState }
/**
 * Error code shared with the response API and the PWA: the account has not
 * acknowledged the current data-use disclosure, so attributed data must not be
 * collected for it yet.
 */
export { PARTICIPANT_DATA_USE_COMPLETION_REQUIRED }

/**
 * Read the participant's stored data-use decisions. Guests whose chat persona
 * is a persisted participant account reach the same row as registered
 * participants, which is why the chat onboarding has to cover both.
 */
export async function loadChatDataUseState(
  participantId: string
): Promise<ChatDataUseState | null> {
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: {
      ...participantAccountDataUseSelect,
      researchConsent: true,
      learningAnalyticsConsent: true,
      dataUseRevision: true,
    },
  })
  if (!participant) return null

  return {
    complete: isParticipantDataUseComplete(participant),
    dataUseRevision: participant.dataUseRevision,
    researchConsent: participant.researchConsent,
    researchChoiceRecorded: participant.researchConsentChoiceAt !== null,
    learningAnalyticsConsent: participant.learningAnalyticsConsent,
    learningAnalyticsChoiceRecorded:
      participant.learningAnalyticsChoiceAt !== null,
  }
}

/**
 * Account-completion gate for every attributed chat route. A chatbot answers
 * on behalf of the participant and stores the exchange on their account, so the
 * acknowledgement and both purpose choices have to exist before the first turn
 * is accepted.
 */
export async function requireCompletedDataUse(
  participantId: string
): Promise<{ ok: true } | { response: NextResponse }> {
  const state = await loadChatDataUseState(participantId)
  if (state?.complete) return { ok: true }

  return {
    response: NextResponse.json(
      { error: PARTICIPANT_DATA_USE_COMPLETION_REQUIRED },
      { status: 403 }
    ),
  }
}

export interface ParticipantIdentity {
  participantId: string
  authMode: AuthMode
  pwaEmbedScope?: {
    chatbotId: string
    courseId: string
  }
  // Opaque eLearning learner pseudonym carried by handoff-minted tokens.
  learnerBinding?: string
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

export interface ChatIdentityResolutionContext {
  /**
   * Chatbot the request targets, when the caller knows it. A PWA embed
   * session is scoped to exactly one chatbot; when it was minted for a
   * different one, resolution prefers the account session over the stale
   * scoped session so a participant who used an embedded chat can still open
   * every other chatbot from the PWA. Without a target the transports keep
   * their order.
   */
  targetChatbotId?: string
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
// An embed-scoped transport bound to another chatbot defers to the account
// session when the caller supplies that target chatbot (see
// preferAccountOnScopeMiss).
export async function getParticipantId(
  req: NextRequest,
  context?: ChatIdentityResolutionContext
): Promise<ParticipantIdentity | { response: NextResponse }> {
  return resolveParticipantIdentity(extractChatTransportTokens(req), context)
}

/**
 * Resolve a participant identity from the request's transports. Every branch
 * verifies a signature; none trusts a caller-supplied identity value.
 */
export async function resolveParticipantIdentity(
  {
    participantToken,
    chatGuestToken,
    pwaEmbedToken,
    scopedFallbackToken,
  }: ChatTransportTokens,
  context?: ChatIdentityResolutionContext
): Promise<ParticipantIdentity | { response: NextResponse }> {
  if (chatGuestToken) {
    try {
      const payload = await verifyChatGuestToken(chatGuestToken)
      if (payload.sub) {
        return {
          participantId: payload.sub,
          authMode: 'anonymous',
          ...(payload.learnerBinding
            ? { learnerBinding: payload.learnerBinding }
            : {}),
        }
      }
    } catch (error) {
      console.error('Chat guest token verification failed:', error)
      // Fall through to the scoped PWA embed / account session below.
    }
  }

  if (pwaEmbedToken) {
    try {
      const payload = await verifyPwaEmbedSessionToken(pwaEmbedToken)
      // A scoped token is minted for the participant it names, so it carries an
      // account identity and gets the same liveness check as the account
      // session: a deactivated or guest persona must not keep access for the
      // life of the scoped token.
      if (payload.sub && (await isActiveAccountParticipant(payload.sub))) {
        return preferAccountOnScopeMiss(
          {
            participantId: payload.sub,
            authMode: 'account',
            pwaEmbedScope: {
              chatbotId: payload.chatbotId,
              courseId: payload.courseId,
            },
            ...(payload.learnerBinding
              ? { learnerBinding: payload.learnerBinding }
              : {}),
          },
          participantToken,
          context
        )
      }
      console.error('PWA embed session token subject is not an active account')
      // Fall through to the scoped fallback token / account session below.
    } catch (error) {
      console.error('PWA embed session token verification failed:', error)
      // Fall through to the scoped fallback token / account session below.
    }
  }

  if (scopedFallbackToken) {
    const fallbackIdentity = await getScopedTokenIdentity(scopedFallbackToken)
    if (fallbackIdentity) {
      return preferAccountOnScopeMiss(
        fallbackIdentity,
        participantToken,
        context
      )
    }
  }

  return getParticipantIdFromToken(participantToken)
}

/**
 * A PWA embed session is bound to one chatbot and course. On a request for a
 * different chatbot it can only fail the scope binding in authorization, so
 * when the caller targets a known chatbot and an account session also
 * resolves, prefer that account session: a stale embed session from another
 * chatbot must not shadow it. Guest transports carry no embed scope and keep
 * their precedence; without a resolvable account session the embed identity is
 * returned unchanged so authorization reports the scope failure as before.
 */
async function preferAccountOnScopeMiss(
  identity: ParticipantIdentity,
  participantToken: string | undefined,
  context: ChatIdentityResolutionContext | undefined
): Promise<ParticipantIdentity | { response: NextResponse }> {
  if (
    !identity.pwaEmbedScope ||
    !context?.targetChatbotId ||
    identity.pwaEmbedScope.chatbotId === context.targetChatbotId
  ) {
    return identity
  }

  const accountIdentity = await getParticipantIdFromToken(participantToken)
  if ('response' in accountIdentity) {
    return identity
  }
  return accountIdentity
}

/**
 * A signature alone is not an identity: the subject must still name a real,
 * active participant. Anonymous LTI guests have their own token family and must
 * never be reachable through an account-scoped transport.
 */
async function isActiveAccountParticipant(
  participantId: string
): Promise<boolean> {
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
  return Boolean(participant?.isActive) && !isGuestPersona
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

    if (!(await isActiveAccountParticipant(participantId))) {
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
        return {
          participantId: payload.sub,
          authMode: 'anonymous',
          ...(payload.learnerBinding
            ? { learnerBinding: payload.learnerBinding }
            : {}),
        }
      }
    } catch {
      return null
    }
  }

  if (scope === PWA_CHAT_EMBED_SESSION_SCOPE) {
    try {
      const payload = await verifyPwaEmbedSessionToken(token)
      if (!(await isActiveAccountParticipant(payload.sub))) return null
      return {
        participantId: payload.sub,
        authMode: 'account',
        pwaEmbedScope: {
          chatbotId: payload.chatbotId,
          courseId: payload.courseId,
        },
        ...(payload.learnerBinding
          ? { learnerBinding: payload.learnerBinding }
          : {}),
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
  chatbotId: string,
  options?: ChatAuthorizationOptions
): Promise<
  | {
      participantId: string
      authMode: AuthMode
      learnerBinding?: string
      chatbot: { courseId: string; knowledgeGraphVisible: boolean }
    }
  | { response: NextResponse }
> {
  const participantResult = await getParticipantId(req, {
    targetChatbotId: chatbotId,
  })
  if ('response' in participantResult) {
    return participantResult
  }

  return authorizeIdentityForChatbot(participantResult, chatbotId, options)
}

export interface ChatAuthorizationOptions {
  /**
   * The completion screen and its own API have to stay reachable while the
   * account is still incomplete, otherwise the participant could never supply
   * the missing acknowledgement.
   */
  allowIncompleteDataUse?: boolean
}

/**
 * Apply the shared identity-to-chatbot authorization: publication and course
 * existence, scoped-token binding to this exact chatbot and course, and course
 * participation. Both the API routes and the page render call this, so every
 * transport reaches the same decision.
 *
 * Every attributed route additionally requires a completed data-use
 * disclosure, because the chatbot stores the exchange on the participant's
 * account and answers on their behalf.
 */
export async function authorizeIdentityForChatbot(
  participantResult: ParticipantIdentity,
  chatbotId: string,
  options?: ChatAuthorizationOptions
): Promise<
  | {
      participantId: string
      authMode: AuthMode
      learnerBinding?: string
      chatbot: { courseId: string; knowledgeGraphVisible: boolean }
    }
  | { response: NextResponse }
> {
  const { participantId, authMode, learnerBinding } = participantResult

  const chatbotResult = await getChatbotOr404(chatbotId, {
    courseId: true,
    // Returned so the knowledge-graph route can enforce the map flag.
    knowledgeGraphVisible: true,
  })
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

  if (!options?.allowIncompleteDataUse) {
    const dataUseResult = await requireCompletedDataUse(participantId)
    if ('response' in dataUseResult) {
      return dataUseResult
    }
  }

  return {
    participantId,
    authMode,
    ...(learnerBinding ? { learnerBinding } : {}),
    chatbot: chatbotResult.chatbot,
  }
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
