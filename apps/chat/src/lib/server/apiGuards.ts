import {
  type AuthMode,
  authorizeIdentityForChatbot,
  type ChatIdentityResolutionContext,
  type ChatTransportTokens,
  type ParticipantIdentity,
  resolveParticipantIdentity,
} from '@klicker-uzh/chat-api/host/lib/server/apiGuards'
import { extractBearerToken } from '@klicker-uzh/util/auth'
import type { NextRequest } from 'next/server'
import { PWA_CHAT_EMBED_SESSION_COOKIE } from '@/src/lib/pwaEmbedAuth'

export {
  type AuthMode,
  authorizeIdentityForChatbot,
  type ChatIdentityResolutionContext,
  type ChatTransportTokens,
  getChatbotOr404,
  getParticipantIdFromToken,
  type ParticipantIdentity,
  requireParticipation,
  resolveParticipantIdentity,
} from '@klicker-uzh/chat-api/host/lib/server/apiGuards'

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
): Promise<ParticipantIdentity | { response: Response }> {
  return resolveParticipantIdentity(extractChatTransportTokens(req), context)
}

export async function withChatbotAuth(
  req: NextRequest,
  chatbotId: string
): Promise<
  | {
      participantId: string
      authMode: AuthMode
      learnerBinding?: string
      chatbot: { courseId: string; knowledgeGraphVisible: boolean }
    }
  | { response: Response }
> {
  const participantResult = await getParticipantId(req, {
    targetChatbotId: chatbotId,
  })
  if ('response' in participantResult) {
    return participantResult
  }

  return authorizeIdentityForChatbot(participantResult, chatbotId)
}
