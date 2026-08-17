import { extractBearerToken } from '@klicker-uzh/util/auth'
import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

function applyFrameAncestorsCSP(response: NextResponse) {
  const allowed = process.env.ALLOWED_FRAME_ANCESTORS
  if (allowed) {
    response.headers.set(
      'Content-Security-Policy',
      `frame-ancestors 'self' ${allowed}`
    )
  }
  return response
}

// Edge runtime cannot use Node `crypto.createHmac`. Replicate the
// `getChatGuestSecret()` HMAC fallback from ltiGuest.ts via Web Crypto.
let cachedDerivedSecret: string | null = null

async function getChatGuestSecretForMiddleware(): Promise<string | null> {
  if (process.env.APP_CHAT_GUEST_SECRET) {
    return process.env.APP_CHAT_GUEST_SECRET
  }

  // Mirror `getChatGuestSecret()` in `lib/server/ltiGuest.ts`: in production,
  // refuse the APP_SECRET-derived fallback. Otherwise the middleware would
  // accept guest tokens the server signer will not produce (and vice versa).
  if (process.env.NODE_ENV === 'production') {
    return null
  }

  if (cachedDerivedSecret) return cachedDerivedSecret

  const appSecret = process.env.APP_SECRET
  if (!appSecret) return null

  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode('chat-guest-secret')
  )
  cachedDerivedSecret = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return cachedDerivedSecret
}

async function verifyChatGuestTokenInMiddleware(
  token: string
): Promise<boolean> {
  const secret = await getChatGuestSecretForMiddleware()
  if (!secret) return false
  try {
    const result = await jwtVerify(token, new TextEncoder().encode(secret))
    return (
      typeof result.payload.sub === 'string' &&
      result.payload.scope === 'CHAT_GUEST'
    )
  } catch {
    return false
  }
}

function redirectToNoLogin(request: NextRequest, ltiContext: boolean) {
  const noLoginUrl = request.nextUrl.clone()
  noLoginUrl.pathname = '/noLogin'
  noLoginUrl.search = ''
  noLoginUrl.searchParams.set(
    'redirectTo',
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  )
  if (ltiContext) noLoginUrl.searchParams.set('lti', '1')
  return applyFrameAncestorsCSP(NextResponse.redirect(noLoginUrl))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname === '/noLogin' ||
    pathname === '/KlickerLogo.png' ||
    pathname === '/user-solid.svg' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/auth/lti')
  ) {
    return applyFrameAncestorsCSP(NextResponse.next())
  }

  const pathSegments = pathname.split('/').filter(Boolean)
  if (pathSegments.length === 0) {
    return applyFrameAncestorsCSP(NextResponse.next())
  }

  // 1. chat_participant_token (anonymous LTI guest) — checked first so a
  // future "switch to anonymous" flow only needs to set this cookie.
  // Falls back to `?_t=` query and `Authorization: Bearer` header for the
  // CHIPS-unsupported-browser code path (sessionStorage-driven; see
  // `useChatGuestTokenBootstrap`).
  const chatGuestToken =
    request.cookies.get('chat_participant_token')?.value ||
    request.nextUrl.searchParams.get('_t') ||
    extractBearerToken(request.headers.get('authorization'))
  let hadGuestToken = false
  if (chatGuestToken) {
    hadGuestToken = true
    if (await verifyChatGuestTokenInMiddleware(chatGuestToken)) {
      return applyFrameAncestorsCSP(NextResponse.next())
    }
    // Invalid guest token → fall through to participant_token.
  }

  // 2. participant_token (account). Account-mode header fallback is not
  // supported by API guards yet, so keep middleware behavior consistent.
  const participantToken = request.cookies.get('participant_token')?.value

  if (!participantToken) {
    return redirectToNoLogin(request, hadGuestToken)
  }

  // Fail closed when APP_SECRET is missing — the previous `|| ''` fallback
  // would have used an empty signing key, which is not a meaningful gate.
  const appSecret = process.env.APP_SECRET
  if (!appSecret) {
    return redirectToNoLogin(request, hadGuestToken)
  }

  try {
    await jwtVerify(participantToken, new TextEncoder().encode(appSecret))
  } catch (error) {
    console.error('Invalid participant token:', error)
    return redirectToNoLogin(request, hadGuestToken)
  }

  return applyFrameAncestorsCSP(NextResponse.next())
}

export const config = {
  matcher: ['/:path*'],
}
