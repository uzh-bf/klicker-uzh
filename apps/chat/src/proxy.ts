import { routing } from '@klicker-uzh/i18n'
import { createEdgeLogger } from '@klicker-uzh/logging/edge'
import { resolveRequestContext } from '@klicker-uzh/logging/request'
import { extractBearerToken } from '@klicker-uzh/util/auth'
import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { hasLocale } from 'next-intl'
import {
  CHAT_SCOPED_TOKEN_HEADER,
  PWA_CHAT_EMBED_QUERY_KEY,
  PWA_CHAT_EMBED_SESSION_COOKIE,
  PWA_CHAT_EMBED_SESSION_SCOPE,
} from '@/src/lib/pwaEmbedAuth'

const edgeLogger = createEdgeLogger({
  service: 'chat',
  level: process.env.LOG_LEVEL,
})

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

async function getChatGuestSecretForProxy(): Promise<string | null> {
  if (process.env.APP_CHAT_GUEST_SECRET) {
    return process.env.APP_CHAT_GUEST_SECRET
  }

  // Mirror `getChatGuestSecret()` in `lib/server/ltiGuest.ts`: in production,
  // refuse the APP_SECRET-derived fallback. Otherwise the proxy would
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

async function verifyChatGuestTokenInProxy(token: string): Promise<boolean> {
  const secret = await getChatGuestSecretForProxy()
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

async function verifyPwaEmbedTokenInProxy({
  chatbotId,
  token,
}: {
  chatbotId: string
  token: string
}): Promise<boolean> {
  const appSecret = process.env.APP_SECRET
  if (!appSecret) return false

  try {
    const result = await jwtVerify(token, new TextEncoder().encode(appSecret))
    return (
      typeof result.payload.sub === 'string' &&
      result.payload.scope === PWA_CHAT_EMBED_SESSION_SCOPE &&
      result.payload.chatbotId === chatbotId &&
      typeof result.payload.courseId === 'string'
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

// Allow a verified scoped token to reach the server render when the cookie
// transport is unavailable. The token is handed over in a reserved request
// header, so the page render can re-verify signature, scope and binding; a
// client-supplied value for that header is always replaced (blanked when this
// request carries no verified token) and can therefore never authorize.
function passThroughWithScopedToken(
  request: NextRequest,
  scopedToken: string | null,
  requestContext: { requestId: string; correlationId: string },
  queryLocale: { locale: string; path: string } | null = null
) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(CHAT_SCOPED_TOKEN_HEADER, scopedToken ?? '')
  requestHeaders.set('x-request-id', requestContext.requestId)
  requestHeaders.set('x-correlation-id', requestContext.correlationId)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('x-request-id', requestContext.requestId)
  response.headers.set('x-correlation-id', requestContext.correlationId)
  if (queryLocale) {
    response.cookies.set({
      name: 'NEXT_LOCALE',
      value: queryLocale.locale,
      path: queryLocale.path,
    })
  }
  return applyFrameAncestorsCSP(response)
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestContext = resolveRequestContext({
    requestId: request.headers.get('x-request-id'),
    correlationId: request.headers.get('x-correlation-id'),
  })
  const log = edgeLogger.child(requestContext)
  // Every response echoes the validated diagnostic IDs (the logging
  // contract): redirects and pass-throughs included.
  const respond = (response: NextResponse) => {
    response.headers.set('x-request-id', requestContext.requestId)
    response.headers.set('x-correlation-id', requestContext.correlationId)
    return applyFrameAncestorsCSP(response)
  }
  // Pass-throughs inject the resolved IDs into the forwarded request headers
  // so the Node handler's logging carries the same correlation.
  const nextResponse = () => {
    const headers = new Headers(request.headers)
    headers.set('x-request-id', requestContext.requestId)
    headers.set('x-correlation-id', requestContext.correlationId)
    return NextResponse.next({ request: { headers } })
  }

  // The embedded Manage assistant and the eLearning handoff receive their locale
  // as a query parameter, but Chat's root layout resolves the active locale from
  // the NEXT_LOCALE cookie. That cookie cannot be stored in a cookie-blocked
  // iframe, so promote a narrowly validated query locale onto the request
  // itself; the effective language then does not depend on cookie acceptance.
  const requestedLocale = request.nextUrl.searchParams.get('locale')
  const queryLocale = hasLocale(routing.locales, requestedLocale)
    ? requestedLocale
    : null

  if (pathname === '/manage' && queryLocale) {
    request.cookies.set({
      name: 'NEXT_LOCALE',
      value: queryLocale,
    })
    const response = nextResponse()
    response.cookies.set({
      name: 'NEXT_LOCALE',
      value: queryLocale,
      path: '/manage',
    })
    return respond(response)
  }

  if (queryLocale) {
    request.cookies.set({
      name: 'NEXT_LOCALE',
      value: queryLocale,
    })
  }

  if (
    pathname === '/noLogin' ||
    pathname === '/manage' ||
    pathname.startsWith('/manage/') ||
    pathname === '/preview' ||
    pathname.startsWith('/preview/') ||
    pathname === '/KlickerLogo.png' ||
    pathname === '/user-solid.svg' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/auth/lti') ||
    pathname.startsWith('/auth/pwa-embed') ||
    // The eLearning handoff is an unauthenticated entrypoint: the route
    // verifies its own signed grant, and the arriving iframe carries no chat
    // session yet, so the identity gate must not divert it to /noLogin.
    pathname.startsWith('/auth/elearning')
  ) {
    return respond(nextResponse())
  }

  const pathSegments = pathname.split('/').filter(Boolean)
  if (pathSegments.length === 0) {
    return respond(nextResponse())
  }

  // Persist the promoted language for this conversation's own path so later
  // navigations inside the embedded chat keep it even without the query.
  const promotedLocale = queryLocale
    ? { locale: queryLocale, path: `/${pathSegments[0]}` }
    : null

  // 1. chat_participant_token (anonymous LTI guest) — checked first so a
  // future "switch to anonymous" flow only needs to set this cookie.
  // Falls back to `?_t=` query and `Authorization: Bearer` header for the
  // CHIPS-unsupported-browser code path (sessionStorage-driven; see
  // `useChatGuestTokenBootstrap`).
  const guestCookieToken = request.cookies.get('chat_participant_token')?.value
  const guestQueryToken = request.nextUrl.searchParams.get('_t')
  // Each transport is validated independently and the first valid one wins.
  // A stale cookie must not shadow a valid fallback, otherwise a browser that
  // still carries an expired guest cookie is refused even though it holds a
  // usable `_t` handoff, and the no-login self-heal turns that into a reload
  // loop.
  const guestCandidates = [
    guestCookieToken,
    guestQueryToken,
    extractBearerToken(request.headers.get('authorization')),
  ].filter((token): token is string => Boolean(token))
  let hadGuestToken = false
  for (const chatGuestToken of guestCandidates) {
    hadGuestToken = true
    if (await verifyChatGuestTokenInProxy(chatGuestToken)) {
      // Only the query token needs the server-side handoff; the cookie and the
      // sessionStorage-driven bearer header reach the server on their own.
      // A stale cookie can still be present while the query token is the
      // transport that verified, so the handoff follows the verified value
      // rather than the presence of a cookie.
      return passThroughWithScopedToken(
        request,
        chatGuestToken === guestQueryToken ? guestQueryToken : null,
        requestContext,
        promotedLocale
      )
    }
    // Invalid transport → try the next candidate.
  }

  const pwaEmbedCookieToken = request.cookies.get(
    PWA_CHAT_EMBED_SESSION_COOKIE
  )?.value
  const pwaEmbedQueryToken = request.nextUrl.searchParams.get(
    PWA_CHAT_EMBED_QUERY_KEY
  )
  const pwaEmbedCandidates = [
    pwaEmbedCookieToken,
    pwaEmbedQueryToken,
    extractBearerToken(request.headers.get('authorization')),
  ].filter((token): token is string => Boolean(token))
  for (const pwaEmbedToken of pwaEmbedCandidates) {
    if (
      await verifyPwaEmbedTokenInProxy({
        chatbotId: pathSegments[0],
        token: pwaEmbedToken,
      })
    ) {
      return passThroughWithScopedToken(
        request,
        pwaEmbedToken === pwaEmbedQueryToken ? pwaEmbedQueryToken : null,
        requestContext,
        promotedLocale
      )
    }
  }

  // 2. participant_token (account). Raw participant-token header fallback is
  // intentionally not supported; PWA iframe fallback uses the scoped token
  // branch above.
  const participantToken = request.cookies.get('participant_token')?.value

  if (!participantToken) {
    return respond(redirectToNoLogin(request, hadGuestToken))
  }

  // Fail closed when APP_SECRET is missing — the previous `|| ''` fallback
  // would have used an empty signing key, which is not a meaningful gate.
  const appSecret = process.env.APP_SECRET
  if (!appSecret) {
    return respond(redirectToNoLogin(request, hadGuestToken))
  }

  try {
    await jwtVerify(participantToken, new TextEncoder().encode(appSecret))
  } catch {
    log.warn(
      { event: 'participant_token.invalid' },
      'Invalid participant token'
    )
    return respond(redirectToNoLogin(request, hadGuestToken))
  }

  return passThroughWithScopedToken(
    request,
    null,
    requestContext,
    promotedLocale
  )
}

export const config = {
  // The Manage chat route owns a streaming 16 MiB request limit. Excluding it
  // here prevents Next.js proxy from first cloning and buffering the body
  // (10 MiB by default), which would both truncate supported requests and
  // defeat the route's bounded streaming reader.
  matcher: ['/((?!api/manage/chat$).*)'],
}
