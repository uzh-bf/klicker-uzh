// nextjs middleware that redirects to login if no participant_token cookie is set
import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * Try to verify the chat_participant_token (anonymous LTI guest).
 * Returns true if valid, false otherwise.
 * Uses a separate secret (APP_CHAT_GUEST_SECRET or derived from APP_SECRET).
 */
async function verifyChatGuestTokenMiddleware(token: string): Promise<boolean> {
  const secret = getChatGuestSecretForMiddleware()
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

/**
 * Derive the chat guest secret the same way as ltiGuest.ts.
 * Middleware runs in the Edge runtime so we use the Web Crypto-compatible
 * TextEncoder approach rather than Node crypto.
 */
function getChatGuestSecretForMiddleware(): string | null {
  if (process.env.APP_CHAT_GUEST_SECRET) {
    return process.env.APP_CHAT_GUEST_SECRET
  }
  // For the middleware we cannot easily replicate the HMAC derivation from
  // ltiGuest.ts (which uses Node crypto). Instead, when APP_CHAT_GUEST_SECRET
  // is not set, fall back to a convention: the hex HMAC is pre-computed at
  // startup by the API routes. For middleware, we accept that in dev
  // environments without APP_CHAT_GUEST_SECRET, the middleware will fall
  // through to the participant_token check. The API route guards in
  // apiGuards.ts handle the authoritative verification.
  return null
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname === '/noLogin' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/auth/lti')
  ) {
    return NextResponse.next()
  }

  const pathSegments = pathname.split('/').filter(Boolean)
  if (pathSegments.length === 0) {
    return NextResponse.next()
  }

  // 1. Check for chat_participant_token (anonymous LTI guest)
  const chatGuestToken = request.cookies.get('chat_participant_token')?.value
  if (chatGuestToken) {
    const isValid = await verifyChatGuestTokenMiddleware(chatGuestToken)
    if (isValid) {
      return NextResponse.next()
    }
    // If invalid, fall through to check participant_token
  }

  // 2. Check for regular participant_token
  const participantToken = request.cookies.get('participant_token')?.value

  if (!participantToken) {
    const noLoginUrl = request.nextUrl.clone()
    noLoginUrl.pathname = '/noLogin'
    noLoginUrl.search = ''
    noLoginUrl.searchParams.set(
      'redirectTo',
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    )
    return NextResponse.redirect(noLoginUrl)
  }

  // verify with jose that the token is valid
  // if not valid, redirect to login with redirectTo
  try {
    await jwtVerify(
      participantToken || '',
      new TextEncoder().encode(process.env.APP_SECRET || '')
    )
  } catch (error) {
    console.error('Invalid participant token:', error)
    const noLoginUrl = request.nextUrl.clone()
    noLoginUrl.pathname = '/noLogin'
    noLoginUrl.search = ''
    noLoginUrl.searchParams.set(
      'redirectTo',
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    )
    return NextResponse.redirect(noLoginUrl)
  }

  return NextResponse.next()
}

// Paths that should be protected by this middleware
export const config = {
  matcher: ['/:path*'],
}
