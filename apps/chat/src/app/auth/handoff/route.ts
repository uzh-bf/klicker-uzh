import { cookieSecurityOptions } from '@klicker-uzh/util/auth'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PWA_CHAT_EMBED_SESSION_COOKIE } from '@/src/lib/pwaEmbedAuth'
import { authorizeIdentityForChatbot } from '@/src/lib/server/apiGuards'
import {
  chatLaunchResponse,
  hasSeparateChatApiHostname,
} from '@/src/lib/server/chatLaunchResponse'
import { signChatGuestToken } from '@/src/lib/server/ltiGuest'
import {
  type ChatTabHandoffPayload,
  signPwaEmbedSessionToken,
  verifyChatTabHandoffToken,
} from '@/src/lib/server/pwaEmbed'

const LOG_PREFIX = '[chat:auth/handoff]'

// Same lifetimes as the LTI launch issues for these cookies.
const GUEST_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14
const EMBED_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12

const querySchema = z.object({
  token: z.string().min(1),
  threadId: z.string().guid().optional(),
})

function noLoginRedirect(chatbotId: string | null) {
  // Path-relative `Location`: behind the ingress `req.nextUrl` resolves to an
  // in-cluster address the browser cannot reach (see `/auth/lti`).
  const search = new URLSearchParams()
  if (chatbotId) search.set('redirectTo', `/${chatbotId}`)
  const query = search.toString()
  const response = new NextResponse(null, {
    status: 307,
    headers: { location: query ? `/noLogin?${query}` : '/noLogin' },
  })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

/**
 * Turn a handoff token minted by `POST /api/chatbots/:id/handoff` into a
 * first-party chat session for a new top-level tab, then open the chatbot.
 */
export async function GET(req: NextRequest) {
  const query = querySchema.safeParse({
    token: req.nextUrl.searchParams.get('token'),
    threadId: req.nextUrl.searchParams.get('threadId') ?? undefined,
  })
  if (!query.success) {
    return noLoginRedirect(null)
  }

  let payload: ChatTabHandoffPayload
  try {
    payload = await verifyChatTabHandoffToken(query.data.token)
  } catch (error) {
    console.error(LOG_PREFIX, 'Handoff token verification failed:', error)
    return noLoginRedirect(null)
  }

  const {
    sub: participantId,
    kind,
    chatbotId,
    courseId,
    learnerBinding,
  } = payload

  // Re-check access at exchange time: publication, course binding and
  // participation may have changed since the token was minted.
  const authorization = await authorizeIdentityForChatbot(
    {
      participantId,
      authMode: kind === 'guest' ? 'anonymous' : 'account',
      ...(kind === 'account' ? { pwaEmbedScope: { chatbotId, courseId } } : {}),
      ...(learnerBinding ? { learnerBinding } : {}),
    },
    chatbotId
  )
  if ('response' in authorization) {
    return noLoginRedirect(chatbotId)
  }

  const destination = req.nextUrl.clone()
  destination.pathname = query.data.threadId
    ? `/${chatbotId}/threads/${query.data.threadId}`
    : `/${chatbotId}`
  destination.search = ''

  const isProduction =
    process.env.NODE_ENV === 'production' &&
    process.env.COOKIE_DOMAIN !== '127.0.0.1'
  const cookieOptions = {
    httpOnly: true,
    ...cookieSecurityOptions({ isProduction }),
    path: '/',
  }

  try {
    const sessionToken =
      kind === 'guest'
        ? await signChatGuestToken(participantId, learnerBinding)
        : await signPwaEmbedSessionToken({
            chatbotId,
            courseId,
            participantId,
            learnerBinding,
          })
    const response = chatLaunchResponse(
      destination,
      hasSeparateChatApiHostname(destination.hostname)
        ? { kind: kind === 'guest' ? 'guest' : 'embed', token: sessionToken }
        : undefined
    )
    if (kind === 'guest') {
      response.cookies.set('chat_participant_token', sessionToken, {
        ...cookieOptions,
        maxAge: GUEST_SESSION_MAX_AGE_SECONDS,
      })
      response.cookies.set(PWA_CHAT_EMBED_SESSION_COOKIE, '', {
        ...cookieOptions,
        maxAge: 0,
      })
    } else {
      response.cookies.set(PWA_CHAT_EMBED_SESSION_COOKIE, sessionToken, {
        ...cookieOptions,
        maxAge: EMBED_SESSION_MAX_AGE_SECONDS,
      })
      // The guest cookie takes precedence in identity resolution, so a stale
      // one would replace the account identity being handed over.
      response.cookies.set('chat_participant_token', '', {
        ...cookieOptions,
        maxAge: 0,
      })
    }
    return response
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to sign the new-tab session:', error)
    return noLoginRedirect(chatbotId)
  }
}
