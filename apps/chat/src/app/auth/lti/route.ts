import {
  resolveLtiAuthDecision,
  signChatGuestToken,
  verifyLtiToken,
} from '@/src/lib/server/ltiGuest'
import { createLoggedRoute } from '@/src/lib/server/requestLogging'
import type { AppLogger } from '@klicker-uzh/logging/node'
import { toSafeError } from '@klicker-uzh/logging/node'
import { prisma } from '@klicker-uzh/prisma'
import {
  LTI_PROBE_COOKIE_NAME,
  cookieSecurityOptions,
  cookiesAvailableViaLtiProbe,
} from '@klicker-uzh/util/auth'
import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const querySchema = z.object({
  jwt: z.string().min(1),
  courseId: z.string().uuid(),
  chatbotId: z.string().uuid(),
})

async function getParticipantTokenSub(
  req: NextRequest
): Promise<string | null> {
  const token = req.cookies.get('participant_token')?.value
  if (!token) return null
  const appSecret = process.env.APP_SECRET
  if (!appSecret) return null
  try {
    const result = await jwtVerify(token, new TextEncoder().encode(appSecret))
    return typeof result.payload.sub === 'string' &&
      result.payload.sub.length > 0
      ? result.payload.sub
      : null
  } catch {
    return null
  }
}

function noLoginRedirect(req: NextRequest, chatbotId: string | null) {
  const noLoginUrl = req.nextUrl.clone()
  noLoginUrl.pathname = '/noLogin'
  noLoginUrl.search = ''
  noLoginUrl.searchParams.set('lti', '1')
  if (chatbotId) {
    noLoginUrl.searchParams.set('redirectTo', `/${chatbotId}`)
  }
  return NextResponse.redirect(noLoginUrl)
}

export async function handleGET(
  req: NextRequest,
  _context: unknown,
  log: AppLogger
) {
  const { searchParams } = req.nextUrl

  const queryResult = querySchema.safeParse({
    jwt: searchParams.get('jwt'),
    courseId: searchParams.get('courseId'),
    chatbotId: searchParams.get('chatbotId'),
  })

  if (!queryResult.success) {
    log.warn(
      { event: 'auth.lti.query.rejected' },
      'Missing or invalid LTI auth query parameters'
    )
    return NextResponse.json(
      {
        error: 'Missing or invalid query parameters (jwt, courseId, chatbotId)',
      },
      { status: 400 }
    )
  }

  const { jwt, courseId, chatbotId } = queryResult.data

  let ltiPayload
  try {
    ltiPayload = await verifyLtiToken(jwt)
  } catch {
    log.warn(
      {
        event: 'auth.lti.token.rejected',
        err: toSafeError('LTI JWT verification failed'),
      },
      'LTI JWT verification failed'
    )
    return noLoginRedirect(req, chatbotId)
  }

  const [course, chatbot] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }),
    prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { id: true, courseId: true },
    }),
  ])

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }
  if (chatbot.courseId !== courseId) {
    log.warn(
      {
        event: 'auth.lti.access.blocked',
        chatbotCourseId: chatbot.courseId,
        requestedCourseId: courseId,
        chatbotId,
      },
      'Blocked cross-course LTI auth attempt'
    )
    return NextResponse.json(
      { error: 'Chatbot not found in this course' },
      { status: 403 }
    )
  }

  const participantTokenSub = await getParticipantTokenSub(req)

  let decision
  try {
    decision = await resolveLtiAuthDecision({
      ltiSub: ltiPayload.sub,
      ltiScope: ltiPayload.scope,
      courseId,
      participantTokenSub,
    })
  } catch {
    log.error(
      {
        event: 'auth.lti.decision.failed',
        err: toSafeError('Failed to resolve LTI auth decision'),
      },
      'Failed to resolve LTI auth decision'
    )
    return NextResponse.json(
      { error: 'Failed to resolve auth decision' },
      { status: 500 }
    )
  }

  log.info(
    {
      event: 'auth.lti.decision.resolved',
      mode: decision.mode,
      chatbotId,
      courseId,
    },
    'LTI auth decision resolved'
  )

  // Probe whether third-party cookies survived the LMS iframe context.
  // `apps/lti` sets `lti-token` with `secure; sameSite=none; domain=COOKIE_DOMAIN`;
  // browsers blocking 3p cookies (Safari ITP, Brave, Firefox total cookie protection
  // pre-141, Chrome with Tracking Protection) strip it before this request lands.
  // Mirrors the PWA pattern in `getParticipantToken.ts`.
  const cookiesAvailable = cookiesAvailableViaLtiProbe({
    [LTI_PROBE_COOKIE_NAME]: req.cookies.get(LTI_PROBE_COOKIE_NAME)?.value,
  })

  const chatbotUrl = req.nextUrl.clone()
  chatbotUrl.pathname = `/${chatbotId}`
  chatbotUrl.search = ''

  const isProduction =
    process.env.NODE_ENV === 'production' &&
    process.env.COOKIE_DOMAIN !== '127.0.0.1'

  if (decision.mode === 'account') {
    // Account branch: clear any stale `chat_participant_token` so the
    // guest-first middleware order (verify chat-guest before participant) does
    // not keep forcing `authMode='anonymous'` after this redirect.
    const accountResponse = NextResponse.redirect(chatbotUrl)
    accountResponse.cookies.set('chat_participant_token', '', {
      httpOnly: true,
      ...cookieSecurityOptions({ isProduction }),
      path: '/',
      maxAge: 0,
    })
    return accountResponse
  }

  // Guest path. Issue chat_participant_token; never override participant_token.
  let chatGuestToken
  try {
    chatGuestToken = await signChatGuestToken(decision.participantId)
  } catch {
    log.error(
      {
        event: 'auth.lti.token.sign_failed',
        err: toSafeError('Failed to sign chat guest token'),
      },
      'Failed to sign chat guest token'
    )
    return NextResponse.json(
      { error: 'Failed to create guest session' },
      { status: 500 }
    )
  }

  // sessionStorage fallback for browsers where CHIPS is not yet supported
  // (pre-Safari 26.2, Firefox <141). Hand the token off via `?_t=` query so
  // the client bootstrap (`useChatGuestTokenBootstrap`) can stuff it into
  // sessionStorage and strip the URL parameter via `router.replace`.
  if (!cookiesAvailable) {
    chatbotUrl.searchParams.set('_t', chatGuestToken)
  }

  const response = NextResponse.redirect(chatbotUrl)

  // Host-only cookie: no `domain` set → cookie never leaves the chat subdomain.
  // Backend GraphQL on api.<domain> never sees this token even if leaked.
  // `Partitioned` (CHIPS) lets modern browsers keep the cookie in third-party
  // iframe contexts (Chrome 114+, Edge 114+, Firefox 141+, Safari 26.2+).
  response.cookies.set('chat_participant_token', chatGuestToken, {
    httpOnly: true,
    ...cookieSecurityOptions({ isProduction }),
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  })

  return response
}

export const GET = createLoggedRoute('/auth/lti', handleGET)
