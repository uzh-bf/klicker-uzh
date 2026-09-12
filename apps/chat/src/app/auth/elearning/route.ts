import hashes from '@klicker-uzh/graphql/dist/client.json'
import {
  cookieSecurityOptions,
  cookiesAvailableViaLtiProbe,
  LTI_PROBE_COOKIE_NAME,
} from '@klicker-uzh/util/auth'
import {
  deriveElearningLearnerBinding,
  getElearningChatHandoffSecret,
  verifyElearningChatGrant,
} from '@klicker-uzh/util'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  PWA_CHAT_EMBED_QUERY_KEY,
  PWA_CHAT_EMBED_SESSION_COOKIE,
} from '@/src/lib/pwaEmbedAuth'
import {
  findOrCreateGuestPersona,
  signChatGuestToken,
} from '@/src/lib/server/ltiGuest'
import { signPwaEmbedSessionToken } from '@/src/lib/server/pwaEmbed'

const LOG_PREFIX = '[chat:auth/elearning]'

const querySchema = z.object({
  grant: z.string().min(1),
  courseId: z.string().uuid(),
  chatbotId: z.string().uuid(),
  // Optional deep link to the conversation the host remembers for this
  // learner, chatbot and course; ownership is enforced by the chat UI.
  threadId: z.string().uuid().optional(),
})

function noLoginRedirect(chatbotId: string | null) {
  // A route handler resolves `req.nextUrl` against the origin the server is
  // bound to, which behind the ingress is an in-cluster service address. An
  // absolute redirect built from it is unreachable from the browser, so the
  // refusal is issued as a path-relative `Location` that the browser resolves
  // against the origin it actually requested.
  const search = new URLSearchParams({ elearning: '1' })
  if (chatbotId) search.set('redirectTo', `/${chatbotId}`)
  const response = new NextResponse(null, {
    status: 307,
    headers: { location: `/noLogin?${search.toString()}` },
  })
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

// Clear previous Chat transport state before choosing this launch's identity.
function launchResponse(destination: URL) {
  const path = `${destination.pathname}${destination.search}`
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><script>try { sessionStorage.removeItem('chat_participant_token'); sessionStorage.removeItem('chat_pwa_embed_token') } catch {} window.location.replace(${JSON.stringify(path).replaceAll('<', '\\u003c')})</script>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    }
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const queryResult = querySchema.safeParse({
    grant: searchParams.get('grant'),
    courseId: searchParams.get('courseId'),
    chatbotId: searchParams.get('chatbotId'),
  })

  if (!queryResult.success) {
    console.error(
      LOG_PREFIX,
      'Invalid query params:',
      queryResult.error.flatten()
    )
    return NextResponse.json(
      {
        error:
          'Missing or invalid query parameters (grant, courseId, chatbotId)',
      },
      { status: 400 }
    )
  }

  const { grant, courseId, chatbotId, threadId } = queryResult.data

  let verified: Awaited<ReturnType<typeof verifyElearningChatGrant>>
  try {
    verified = await verifyElearningChatGrant(
      grant,
      getElearningChatHandoffSecret()
    )
  } catch (error) {
    console.error(LOG_PREFIX, 'eLearning grant verification failed:', error)
    return noLoginRedirect(chatbotId)
  }

  if (
    verified.klickerCourseId !== courseId ||
    verified.chatbotId !== chatbotId
  ) {
    return NextResponse.json(
      { error: 'Invalid launch target' },
      { status: 403 }
    )
  }

  const apiOrigin = process.env.APP_ORIGIN_API
  if (!apiOrigin)
    return NextResponse.json({ error: 'Login unavailable' }, { status: 503 })

  let decision: {
    status: 'ACCOUNT' | 'GUEST'
    participantId?: string
    participantToken?: string
  }
  try {
    const result = await fetch(`${apiOrigin.replace(/\/$/, '')}/api/graphql`, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'x-graphql-yoga-csrf': '1',
      },
      body: JSON.stringify({
        operationName: 'LoginParticipantForElearningChatbot',
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: hashes.LoginParticipantForElearningChatbot,
          },
        },
        variables: {
          grant,
          courseId,
          chatbotId,
          participantToken: req.cookies.get('participant_token')?.value,
        },
      }),
    })
    if (!result.ok) throw new Error('Login unavailable')
    const body = await result.json()
    const parsed = z
      .object({
        status: z.enum(['ACCOUNT', 'GUEST', 'DENIED']),
        participantId: z.string().uuid().nullable(),
        participantToken: z.string().nullable(),
      })
      .parse(body.data?.loginParticipantForElearningChatbot)
    if (body.errors) throw new Error('Login unavailable')
    if (parsed.status === 'DENIED') return noLoginRedirect(chatbotId)
    if (
      parsed.status === 'ACCOUNT' &&
      (!parsed.participantId || !parsed.participantToken)
    )
      throw new Error('Login unavailable')
    decision = {
      status: parsed.status,
      participantId: parsed.participantId ?? undefined,
      participantToken: parsed.participantToken ?? undefined,
    }
    if (decision.status === 'GUEST') {
      // The eLearning learner id is the OLAT LTI subject, so the guest
      // persona derivation and later account-claiming stay on the existing
      // (ltiSub, courseId) identity. Guests remain chat-only.
      const guest = await findOrCreateGuestPersona(
        verified.learnerId,
        'LTI1.3',
        courseId
      )
      decision.participantId = guest.participantId
    }
  } catch {
    return NextResponse.json(
      { error: 'Unable to establish chatbot session' },
      { status: 503 }
    )
  }

  // Probe whether third-party cookies survived the LMS iframe context.
  // Mirrors the LTI pattern in `auth/lti/route.ts`.
  const cookiesAvailable = cookiesAvailableViaLtiProbe({
    [LTI_PROBE_COOKIE_NAME]: req.cookies.get(LTI_PROBE_COOKIE_NAME)?.value,
  })

  const chatbotUrl = req.nextUrl.clone()
  chatbotUrl.pathname = threadId
    ? `/${chatbotId}/threads/${threadId}`
    : `/${chatbotId}`
  chatbotUrl.search = ''

  const isProduction =
    process.env.NODE_ENV === 'production' &&
    process.env.COOKIE_DOMAIN !== '127.0.0.1'

  // Opaque per-learner pseudonym that binds chat-context envelopes to this
  // session without exposing the raw learner id to the chat client.
  let learnerBinding: string
  try {
    learnerBinding = deriveElearningLearnerBinding(
      getElearningChatHandoffSecret(),
      verified.learnerId
    )
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to derive learner binding:', error)
    return NextResponse.json(
      { error: 'Failed to create handoff session' },
      { status: 500 }
    )
  }

  if (decision.status === 'ACCOUNT') {
    const scopedToken = await signPwaEmbedSessionToken({
      chatbotId,
      courseId,
      participantId: decision.participantId!,
      learnerBinding,
    })
    if (!cookiesAvailable)
      chatbotUrl.searchParams.set(PWA_CHAT_EMBED_QUERY_KEY, scopedToken)
    const response = launchResponse(chatbotUrl)
    response.cookies.set(LTI_PROBE_COOKIE_NAME, '', {
      ...cookieSecurityOptions({ isProduction }),
      domain: process.env.COOKIE_DOMAIN,
      path: '/',
      maxAge: 0,
    })
    response.cookies.set('chat_participant_token', '', {
      httpOnly: true,
      ...cookieSecurityOptions({ isProduction }),
      path: '/',
      maxAge: 0,
    })
    response.cookies.set(PWA_CHAT_EMBED_SESSION_COOKIE, scopedToken, {
      httpOnly: true,
      ...cookieSecurityOptions({ isProduction }),
      path: '/',
      maxAge: 12 * 60 * 60,
    })
    response.cookies.set('participant_token', decision.participantToken!, {
      httpOnly: true,
      ...cookieSecurityOptions({ isProduction }),
      domain: process.env.COOKIE_DOMAIN,
      path: '/',
      maxAge: 14 * 24 * 60 * 60,
    })
    return response
  }

  // Guest path. Issue chat_participant_token; never override participant_token.
  let chatGuestToken: string
  try {
    chatGuestToken = await signChatGuestToken(
      decision.participantId!,
      learnerBinding
    )
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to sign chat guest token:', error)
    return NextResponse.json(
      { error: 'Failed to create guest session' },
      { status: 500 }
    )
  }

  // sessionStorage fallback for browsers where CHIPS is not yet supported.
  if (!cookiesAvailable) chatbotUrl.searchParams.set('_t', chatGuestToken)

  const response = launchResponse(chatbotUrl)
  response.cookies.set(LTI_PROBE_COOKIE_NAME, '', {
    ...cookieSecurityOptions({ isProduction }),
    domain: process.env.COOKIE_DOMAIN,
    path: '/',
    maxAge: 0,
  })
  response.cookies.set(PWA_CHAT_EMBED_SESSION_COOKIE, '', {
    httpOnly: true,
    ...cookieSecurityOptions({ isProduction }),
    path: '/',
    maxAge: 0,
  })

  // Host-only cookie: no `domain` set → cookie never leaves the chat subdomain.
  response.cookies.set('chat_participant_token', chatGuestToken, {
    httpOnly: true,
    ...cookieSecurityOptions({ isProduction }),
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  })

  return response
}
