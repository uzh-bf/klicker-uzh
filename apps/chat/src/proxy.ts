import { createEdgeLogger } from '@klicker-uzh/logging/edge'
import { resolveRequestContext } from '@klicker-uzh/logging/request'
import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestContext = resolveRequestContext({
    requestId: request.headers.get('x-request-id'),
    correlationId: request.headers.get('x-correlation-id'),
  })
  const log = edgeLogger.child(requestContext)
  const respond = (response: NextResponse) => {
    response.headers.set('x-request-id', requestContext.requestId)
    response.headers.set('x-correlation-id', requestContext.correlationId)
    return applyFrameAncestorsCSP(response)
  }

  if (
    pathname === '/noLogin' ||
    pathname === '/KlickerLogo.png' ||
    pathname === '/user-solid.svg' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon')
  ) {
    return respond(NextResponse.next())
  }

  const pathSegments = pathname.split('/').filter(Boolean)
  if (pathSegments.length === 0) {
    return respond(NextResponse.next())
  }

  const participantToken = request.cookies.get('participant_token')?.value

  if (!participantToken) {
    const noLoginUrl = request.nextUrl.clone()
    noLoginUrl.pathname = '/noLogin'
    noLoginUrl.search = ''
    noLoginUrl.searchParams.set(
      'redirectTo',
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    )
    return respond(NextResponse.redirect(noLoginUrl))
  }

  // verify with jose that the token is valid
  // if not valid, redirect to login with redirectTo
  try {
    await jwtVerify(
      participantToken || '',
      new TextEncoder().encode(process.env.APP_SECRET || '')
    )
  } catch {
    log.warn(
      { event: 'participant_token.invalid', outcome: 'redirect' },
      'Invalid participant token'
    )
    const noLoginUrl = request.nextUrl.clone()
    noLoginUrl.pathname = '/noLogin'
    noLoginUrl.search = ''
    noLoginUrl.searchParams.set(
      'redirectTo',
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    )
    return respond(NextResponse.redirect(noLoginUrl))
  }

  return respond(NextResponse.next())
}

// Paths that should be protected by this proxy
export const config = {
  matcher: ['/:path*'],
}
