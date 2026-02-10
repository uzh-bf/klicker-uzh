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

/**
 * Derive the chat guest secret the same way as ltiGuest.ts getChatGuestSecret().
 * Middleware runs in the Edge runtime, so we use the Web Crypto API
 * (crypto.subtle) instead of Node crypto.createHmac.
 *
 * Result is cached for the lifetime of the edge worker instance.
 */
let cachedDerivedSecret: string | null = null

async function getChatGuestSecretForMiddleware(): Promise<string | null> {
  if (process.env.APP_CHAT_GUEST_SECRET) {
    return process.env.APP_CHAT_GUEST_SECRET
  }

  if (cachedDerivedSecret) {
    return cachedDerivedSecret
  }

  const appSecret = process.env.APP_SECRET
  if (!appSecret) {
    return null
  }

  // Replicate the HMAC-SHA256 derivation from ltiGuest.ts using Web Crypto API
  // HMAC(APP_SECRET, 'chat-guest-secret') → hex digest
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
