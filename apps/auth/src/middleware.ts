import { NextRequest, NextResponse } from 'next/server'

function isValidStudentRedirectUrl(url: string): boolean {
  if (!url) return false

  try {
    const parsed = new URL(url)
    const allowedDomains = [
      'assessment.klicker.uzh.ch',
      'assessment.klicker.com',
    ]

    return allowedDomains.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  console.log('MIDDLEWARE RUNNING:', {
    pathname,
    fullUrl: request.url,
    referer: request.headers.get('referer'),
    searchParams: Object.fromEntries(request.nextUrl.searchParams.entries()),
    cookies: Object.fromEntries(
      request.cookies.getAll().map((c) => [c.name, c.value])
    ),
  })

  // Handle /student route - redirect to OAuth immediately
  if (pathname === '/student') {
    console.log('STUDENT ROUTE MATCHED!')
    const redirectTo = request.nextUrl.searchParams.get('redirectTo')

    console.log('RedirectTo parameter:', redirectTo)

    if (!redirectTo || !isValidStudentRedirectUrl(redirectTo)) {
      console.log('Invalid redirect URL:', redirectTo)
      return new NextResponse('Invalid redirect URL', { status: 400 })
    }

    console.log('Valid redirect URL, proceeding with OAuth redirect')

    // Redirect directly to the EduID OAuth flow
    const signinUrl = new URL('/api/auth/signin/eduid-participant', request.url)
    signinUrl.searchParams.set('callbackUrl', redirectTo)
    signinUrl.searchParams.set('participant', 'true')

    console.log('Student route redirect to:', signinUrl.toString())

    const response = NextResponse.redirect(signinUrl)

    // Set context cookie for the auth flow
    response.cookies.set('auth-context', 'participant', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      domain: process.env.COOKIE_DOMAIN,
      secure: process.env.NODE_ENV === 'production',
    })

    console.log('Returning redirect response')
    return response
  }

  // Process auth routes for context detection
  if (pathname.startsWith('/api/auth')) {
    // Detect participant context from various sources
    const referer = request.headers.get('referer') || ''
    const existingContext = request.cookies.get('auth-context')?.value
    const participantParam = request.nextUrl.searchParams.get('participant')

    const isParticipantContext =
      participantParam === 'true' ||
      existingContext === 'participant' ||
      referer.includes('assessment.') ||
      referer.includes('pwa.klicker.') ||
      referer.includes('/student') ||
      referer.includes('participant=true')

    console.log('Context detection result:', {
      isParticipantContext,
      participantParam,
      existingContext,
      referer,
    })

    if (isParticipantContext) {
      const response = NextResponse.next()

      // Set/refresh context cookie
      response.cookies.set('auth-context', 'participant', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        domain: process.env.COOKIE_DOMAIN,
        secure: process.env.NODE_ENV === 'production',
      })

      // Add participant parameter to the URL if not already present
      if (participantParam !== 'true') {
        const url = request.nextUrl.clone()
        url.searchParams.set('participant', 'true')
        return NextResponse.redirect(url)
      }

      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/auth/:path*', '/student'],
}
