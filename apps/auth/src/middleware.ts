import { NextRequest, NextResponse } from 'next/server'

function isValidStudentRedirectUrl(url: string): boolean {
  if (!url) return false

  try {
    const parsed = new URL(url)
    const allowedDomains = [
      'assessment.klicker.uzh.ch',
      'assessment.klicker.com',
      'localhost:3001',
      '127.0.0.1:3001',
    ]

    return allowedDomains.some(
      (domain) => parsed.host === domain || parsed.host.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

function isValidLecturerRedirectUrl(url: string): boolean {
  if (!url) return false

  try {
    const parsed = new URL(url)
    const allowedDomains = [
      'manage.klicker.uzh.ch',
      'manage.klicker.com',
      'localhost:3002',
      '127.0.0.1:3002',
    ]

    return allowedDomains.some(
      (domain) => parsed.host === domain || parsed.host.endsWith(`.${domain}`)
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
  })

  // Handle /lecturer route - redirect to OAuth immediately for lecturer auth
  if (pathname === '/lecturer') {
    console.log('LECTURER ROUTE MATCHED!')
    const redirectTo =
      request.nextUrl.searchParams.get('redirectTo') ||
      process.env.NEXT_PUBLIC_MANAGE_URL ||
      'https://manage.klicker.uzh.ch'

    console.log('RedirectTo parameter (with default):', redirectTo)

    if (!isValidLecturerRedirectUrl(redirectTo)) {
      console.log('Invalid lecturer redirect URL:', redirectTo)
      return new NextResponse('Invalid redirect URL', { status: 400 })
    }

    console.log('Valid lecturer redirect URL, proceeding with OAuth redirect')

    // Redirect to lecturer signin with both EduID and credentials options
    const signinUrl = new URL('/api/auth/signin', request.url)
    signinUrl.searchParams.set('callbackUrl', redirectTo)
    // No participant parameter - default to lecturer context

    console.log('Lecturer route redirect to:', signinUrl.toString())

    const response = NextResponse.redirect(signinUrl)

    console.log('Returning lecturer redirect response')
    return response
  }

  // Handle /student route - redirect to OAuth immediately
  if (pathname === '/student') {
    console.log('STUDENT ROUTE MATCHED!')
    const redirectTo =
      request.nextUrl.searchParams.get('redirectTo') ||
      process.env.NEXT_PUBLIC_ASSESSMENT_URL ||
      'https://assessment.klicker.uzh.ch'

    console.log('RedirectTo parameter (with default):', redirectTo)

    if (!isValidStudentRedirectUrl(redirectTo)) {
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

    console.log('Returning redirect response')
    return response
  }

  // Process auth routes for context detection (stateless approach)
  if (pathname.startsWith('/api/auth')) {
    const referer = request.headers.get('referer') || ''
    const participantParam = request.nextUrl.searchParams.get('participant')

    // Only detect participant context from explicit parameters and current request context
    const isParticipantContext =
      participantParam === 'true' ||
      pathname.includes('eduid-participant') ||
      referer.includes('assessment.') ||
      referer.includes('/student')

    console.log('Stateless context detection result:', {
      isParticipantContext,
      participantParam,
      referer,
      pathname,
    })

    // For participant context, ensure participant parameter is present in URL
    if (isParticipantContext && participantParam !== 'true') {
      const url = request.nextUrl.clone()
      url.searchParams.set('participant', 'true')
      console.log('Adding participant parameter to URL:', url.toString())
      return NextResponse.redirect(url)
    }

    // For lecturer context (default), clear any participant parameters
    if (!isParticipantContext && participantParam === 'true') {
      const url = request.nextUrl.clone()
      url.searchParams.delete('participant')
      console.log('Removing participant parameter from URL:', url.toString())
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/auth/:path*', '/student', '/lecturer'],
}
