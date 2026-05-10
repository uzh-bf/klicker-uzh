import {
  resolveLtiAuthDecision,
  signChatGuestToken,
  verifyLtiToken,
} from '@/src/lib/server/ltiGuest'
import { prisma } from '@klicker-uzh/prisma'
import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const LOG_PREFIX = '[chat:auth/lti]'

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

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const queryResult = querySchema.safeParse({
    jwt: searchParams.get('jwt'),
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
        error: 'Missing or invalid query parameters (jwt, courseId, chatbotId)',
      },
      { status: 400 }
    )
  }

  const { jwt, courseId, chatbotId } = queryResult.data

  let ltiPayload
  try {
    ltiPayload = await verifyLtiToken(jwt)
  } catch (error) {
    console.error(LOG_PREFIX, 'LTI JWT verification failed:', error)
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
    console.error(LOG_PREFIX, 'Cross-course access blocked', {
      chatbotCourseId: chatbot.courseId,
      requestedCourseId: courseId,
      chatbotId,
    })
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
  } catch (error) {
    console.error(LOG_PREFIX, 'resolveLtiAuthDecision failed:', error)
    return NextResponse.json(
      { error: 'Failed to resolve auth decision' },
      { status: 500 }
    )
  }

  console.info(LOG_PREFIX, 'auth resolved', {
    mode: decision.mode,
    chatbotId,
    courseId,
  })

  const chatbotUrl = req.nextUrl.clone()
  chatbotUrl.pathname = `/${chatbotId}`
  chatbotUrl.search = ''

  if (decision.mode === 'account') {
    // Account branch: clear any stale `chat_participant_token` so the
    // guest-first middleware order (verify chat-guest before participant) does
    // not keep forcing `authMode='anonymous'` after this redirect.
    const accountResponse = NextResponse.redirect(chatbotUrl)
    accountResponse.cookies.delete({
      name: 'chat_participant_token',
      path: '/',
    })
    return accountResponse
  }

  // Guest path. Issue chat_participant_token; never override participant_token.
  let chatGuestToken
  try {
    chatGuestToken = await signChatGuestToken(decision.participantId)
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to sign chat guest token:', error)
    return NextResponse.json(
      { error: 'Failed to create guest session' },
      { status: 500 }
    )
  }

  const response = NextResponse.redirect(chatbotUrl)

  const isProduction =
    process.env.NODE_ENV === 'production' &&
    process.env.COOKIE_DOMAIN !== '127.0.0.1'

  // Host-only cookie: no `domain` set → cookie never leaves the chat subdomain.
  // Backend GraphQL on api.<domain> never sees this token even if leaked.
  response.cookies.set('chat_participant_token', chatGuestToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  })

  return response
}
