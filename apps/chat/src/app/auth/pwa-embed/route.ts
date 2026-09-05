import {
  PWA_CHAT_EMBED_QUERY_KEY,
  PWA_CHAT_EMBED_SESSION_COOKIE,
} from '@/src/lib/pwaEmbedAuth'
import {
  signPwaEmbedSessionToken,
  verifyPwaEmbedExchangeToken,
} from '@/src/lib/server/pwaEmbed'
import { prisma } from '@klicker-uzh/prisma'
import { cookieSecurityOptions } from '@klicker-uzh/util/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const LOG_PREFIX = '[chat:auth/pwa-embed]'
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

export async function GET(req: NextRequest) {
  const queryResult = querySchema.safeParse({
    token: req.nextUrl.searchParams.get('token'),
  })

  if (!queryResult.success) {
    console.error(
      LOG_PREFIX,
      'Invalid query params:',
      queryResult.error.flatten()
    )
    return noLoginRedirect(req, null)
  }

  let exchangePayload
  try {
    exchangePayload = await verifyPwaEmbedExchangeToken(queryResult.data.token)
  } catch (error) {
    console.error(LOG_PREFIX, 'PWA exchange token verification failed:', error)
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
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to sign PWA embed session token:', error)
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
