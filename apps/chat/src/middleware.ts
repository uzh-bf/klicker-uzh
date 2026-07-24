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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname === '/noLogin' ||
    pathname === '/KlickerLogo.png' ||
    pathname === '/user-solid.svg' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon')
  ) {
    return applyFrameAncestorsCSP(NextResponse.next())
  }

  const pathSegments = pathname.split('/').filter(Boolean)
  if (pathSegments.length === 0) {
    return applyFrameAncestorsCSP(NextResponse.next())
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
    return applyFrameAncestorsCSP(NextResponse.redirect(noLoginUrl))
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
    return applyFrameAncestorsCSP(NextResponse.redirect(noLoginUrl))
  }

  return applyFrameAncestorsCSP(NextResponse.next())
}

// Paths that should be protected by this middleware
export const config = {
  matcher: ['/:path*'],
}
