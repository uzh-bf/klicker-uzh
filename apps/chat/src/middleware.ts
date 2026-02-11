// nextjs middleware that redirects to login if no participant_token cookie is set
import { jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

function withSecurityHeaders(response: NextResponse): NextResponse {
  const allowedFrameAncestors = process.env.ALLOWED_FRAME_ANCESTORS
  const frameAncestors = allowedFrameAncestors
    ? `frame-ancestors 'self' ${allowedFrameAncestors}`
    : "frame-ancestors 'self'"

  response.headers.set('Content-Security-Policy', frameAncestors)
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname === '/noLogin' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon')
  ) {
    return withSecurityHeaders(NextResponse.next())
  }

  const pathSegments = pathname.split('/').filter(Boolean)
  if (pathSegments.length === 0) {
    return withSecurityHeaders(NextResponse.next())
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
    return withSecurityHeaders(NextResponse.redirect(noLoginUrl))
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
    return withSecurityHeaders(NextResponse.redirect(noLoginUrl))
  }

  // TODO: relay participant data to api routes or similar

  return withSecurityHeaders(NextResponse.next())
}

// Paths that should be protected by this middleware
export const config = {
  matcher: ['/:path*'],
}
