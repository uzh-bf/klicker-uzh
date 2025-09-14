import { NextRequest, NextResponse } from 'next/server'

// Short-lived cookie to persist redirect target through OAuth dance
const REDIRECT_COOKIE_NAME = 'klicker_redirect_to'

function isValidStudentRedirectUrl(url: string): boolean {
  if (!url) return false

  try {
    const parsed = new URL(url)
    const allowedDomains = [
      'assessment.klicker.uzh.ch',
      'assessment.klicker-qa.bf-app.ch',
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
      'manage.klicker-qa.bf-app.ch',
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

  // Handle root (lecturer login UI). If a redirectTo is provided, set cookie early.
  if (pathname === '/') {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo')
    if (redirectTo && isValidLecturerRedirectUrl(redirectTo)) {
      const response = NextResponse.next()
      response.cookies.set(REDIRECT_COOKIE_NAME, redirectTo, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 10,
      })
      console.log('Root route: lecturer redirect cookie set')
      return response
    }
  }

  // Handle /lecturer route - redirect to lecturer UI and set cookie early
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

    // Set/refresh cookie and show index login page (UI offers EduID or delegated)
    const dest = new URL('/', request.url)
    dest.searchParams.set('redirectTo', redirectTo)
    const response = NextResponse.redirect(dest)
    response.cookies.set(REDIRECT_COOKIE_NAME, redirectTo, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 10,
    })
    console.log(
      'Lecturer route: set cookie and redirect to index UI:',
      dest.toString()
    )
    return response
  }

  // Handle /student route - render login page and set cookie early (belt-and-suspenders)
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

    // Set/refresh the redirect cookie so it's available on callback even if
    // NextAuth posts the callbackUrl in the body (not readable in middleware)
    const response = NextResponse.next()
    response.cookies.set(REDIRECT_COOKIE_NAME, redirectTo, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 10, // 10 minutes to account for user delays
    })
    console.log('Student route: cookie set, rendering student login page')
    return response
  }

  // Process auth routes for context detection (stateless approach)
  if (pathname.startsWith('/api/auth')) {
    const referer = request.headers.get('referer') || ''
    const participantParam = request.nextUrl.searchParams.get('participant')

    // Only detect participant context from explicit parameters and current request context
    const isParticipantContext =
      participantParam === 'true' ||
      referer.includes('assessment.') ||
      referer.includes('/student')

    console.log('Stateless context detection result:', {
      isParticipantContext,
      participantParam,
      referer,
      pathname,
    })

    // If handling provider callback, ensure we carry the intended callbackUrl from cookie
    if (pathname.startsWith('/api/auth/callback')) {
      const redirectCookie = request.cookies.get(REDIRECT_COOKIE_NAME)?.value
      if (redirectCookie) {
        const cookieSaysParticipant = isValidStudentRedirectUrl(redirectCookie)
        const cookieSaysLecturer = isValidLecturerRedirectUrl(redirectCookie)

        const url = request.nextUrl.clone()
        let modified = false

        // Ensure callbackUrl is present from cookie
        if (
          !url.searchParams.has('callbackUrl') &&
          (cookieSaysParticipant || cookieSaysLecturer)
        ) {
          url.searchParams.set('callbackUrl', redirectCookie)
          modified = true
        }

        // Ensure participant parameter aligns with cookie host
        const currentParticipant = url.searchParams.get('participant')
        if (cookieSaysParticipant && currentParticipant !== 'true') {
          url.searchParams.set('participant', 'true')
          modified = true
        } else if (cookieSaysLecturer && currentParticipant === 'true') {
          url.searchParams.delete('participant')
          modified = true
        }

        if (modified) {
          const resp = NextResponse.redirect(url)
          resp.cookies.set(REDIRECT_COOKIE_NAME, '', { path: '/', maxAge: 0 })
          console.log('Callback: injected params from cookie and cleared it', {
            url: url.toString(),
            cookieSaysParticipant,
            cookieSaysLecturer,
          })
          return resp
        }

        // Clear the cookie in any case on callback to avoid lingering state
        const passthrough = NextResponse.next()
        passthrough.cookies.set(REDIRECT_COOKIE_NAME, '', {
          path: '/',
          maxAge: 0,
        })
        console.log('Callback: cleared unused redirect cookie')
        return passthrough
      }
    }

    // Default passthrough for auth routes; avoid unnecessary URL rewrites
    let response: NextResponse | null = NextResponse.next()

    // On signin routes, set the short-lived redirect cookie based on callbackUrl (set after user triggers sign-in)
    if (pathname.startsWith('/api/auth/signin')) {
      const cb = request.nextUrl.searchParams.get('callbackUrl') || ''
      const valid = isParticipantContext
        ? isValidStudentRedirectUrl(cb)
        : isValidLecturerRedirectUrl(cb)

      if (valid) {
        response.cookies.set(REDIRECT_COOKIE_NAME, cb, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 60 * 10, // 10 minutes to account for user delays
        })
        console.log('Set redirect cookie on signin:', {
          cb,
          isParticipantContext,
        })
      }
    }

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/student', '/lecturer', '/api/auth/:path*'],
}
