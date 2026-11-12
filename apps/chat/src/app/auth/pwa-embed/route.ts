import {
  PWA_CHAT_EMBED_QUERY_KEY,
  PWA_CHAT_EMBED_SESSION_COOKIE,
} from '@/src/lib/pwaEmbedAuth'
import { createLoggedRoute } from '@/src/lib/server/requestLogging'
import {
  signPwaEmbedSessionToken,
  verifyPwaEmbedExchangeToken,
} from '@/src/lib/server/pwaEmbed'
import type { AppLogger } from '@klicker-uzh/logging/node'
import { toSafeError } from '@klicker-uzh/logging/node'
import { prisma } from '@klicker-uzh/prisma'
import { cookieSecurityOptions } from '@klicker-uzh/util/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const EMBED_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12

const querySchema = z.object({
  token: z.string().min(1),
})

function noLoginRedirect(req: NextRequest, chatbotId: string | null) {
  const noLoginUrl = req.nextUrl.clone()
  noLoginUrl.pathname = '/noLogin'
  noLoginUrl.search = ''
  if (chatbotId) {
    noLoginUrl.searchParams.set('redirectTo', `/${chatbotId}?embed=true`)
  }
  return NextResponse.redirect(noLoginUrl)
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function embedBootstrapResponse(chatbotUrl: URL) {
  const destination = `${chatbotUrl.pathname}${chatbotUrl.search}`
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${escapeHtmlAttribute(destination)}"><script>window.location.replace(${JSON.stringify(destination)})</script></head><body></body></html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Referrer-Policy': 'no-referrer',
      },
    }
  )
}

export async function handleGET(
  req: NextRequest,
  _context: unknown,
  log: AppLogger
) {
  const queryResult = querySchema.safeParse({
    token: req.nextUrl.searchParams.get('token'),
  })

  if (!queryResult.success) {
    log.warn(
      { event: 'auth.embed.query.rejected' },
      'Missing or invalid PWA embed query parameters'
    )
    return noLoginRedirect(req, null)
  }

  let exchangePayload
  try {
    exchangePayload = await verifyPwaEmbedExchangeToken(queryResult.data.token)
  } catch {
    log.warn(
      {
        event: 'auth.embed.token.rejected',
        err: toSafeError('PWA embed exchange token verification failed'),
      },
      'PWA embed exchange token verification failed'
    )
    return noLoginRedirect(req, null)
  }

  const {
    chatbotId,
    cookiesAvailable,
    courseId,
    sub: participantId,
  } = exchangePayload

  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: { id: true, courseId: true },
  })

  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }
  if (chatbot.courseId !== courseId) {
    log.warn(
      {
        event: 'auth.embed.access.blocked',
        chatbotCourseId: chatbot.courseId,
        requestedCourseId: courseId,
        chatbotId,
      },
      'Blocked cross-course PWA embed attempt'
    )
    return NextResponse.json(
      { error: 'Chatbot not found in this course' },
      { status: 403 }
    )
  }

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
    return NextResponse.json(
      { error: 'No valid participation found for this chatbot' },
      { status: 403 }
    )
  }

  let sessionToken
  try {
    sessionToken = await signPwaEmbedSessionToken({
      chatbotId,
      courseId,
      participantId,
    })
  } catch {
    log.error(
      {
        event: 'auth.embed.session.sign_failed',
        err: toSafeError('Failed to sign PWA embed session token'),
      },
      'Failed to sign PWA embed session token'
    )
    return NextResponse.json(
      { error: 'Failed to create embed session' },
      { status: 500 }
    )
  }

  const chatbotUrl = req.nextUrl.clone()
  chatbotUrl.pathname = `/${chatbotId}`
  chatbotUrl.search = ''
  chatbotUrl.searchParams.set('embed', 'true')

  if (!cookiesAvailable) {
    chatbotUrl.searchParams.set(PWA_CHAT_EMBED_QUERY_KEY, sessionToken)
  }

  const response = embedBootstrapResponse(chatbotUrl)
  const isProduction =
    process.env.NODE_ENV === 'production' &&
    process.env.COOKIE_DOMAIN !== '127.0.0.1'

  response.cookies.set(PWA_CHAT_EMBED_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    ...cookieSecurityOptions({ isProduction }),
    path: '/',
    maxAge: EMBED_SESSION_MAX_AGE_SECONDS,
  })

  return response
}

export const GET = createLoggedRoute('/auth/pwa-embed', handleGET)
