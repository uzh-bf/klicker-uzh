import {
  PublicationStatus,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { TRPCError } from '@trpc/server'

type CookieResponse = {
  clearCookie?(name: string, options: Record<string, unknown>): unknown
  cookie(name: string, value: string, options: Record<string, unknown>): unknown
}

function getCookieResponse(res: unknown): CookieResponse {
  if (!res || typeof res !== 'object' || !('cookie' in res)) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Cookie response unavailable',
    })
  }

  return res as CookieResponse
}

function liveQuizPinInvalid(): never {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'LIVE_QUIZ_PIN_INVALID',
  })
}

export async function setLiveQuizPinCookie({
  liveQuizId,
  pin,
  prisma,
  res,
}: {
  liveQuizId: string
  pin: string
  prisma: PrismaClient
  res: unknown
}) {
  const liveQuiz = await prisma.liveQuiz.findUnique({
    where: { id: liveQuizId },
    select: { id: true, status: true, pinCode: true },
  })
  if (!liveQuiz || liveQuiz.status !== PublicationStatus.PUBLISHED) {
    liveQuizPinInvalid()
  }

  const cookieName = `live-quiz-pin-${liveQuizId}`
  const cookieResponse = getCookieResponse(res)
  if (!liveQuiz.pinCode || pin !== liveQuiz.pinCode) {
    try {
      cookieResponse.clearCookie?.(cookieName, {
        domain: process.env.COOKIE_DOMAIN as string | undefined,
        path: '/',
      })
    } catch (_) {}
    liveQuizPinInvalid()
  }

  cookieResponse.cookie(cookieName, pin, {
    domain: process.env.COOKIE_DOMAIN,
    path: '/',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
    secure:
      process.env.NODE_ENV === 'production' &&
      process.env.COOKIE_DOMAIN !== '127.0.0.1',
    sameSite: 'lax',
  })

  return true
}
