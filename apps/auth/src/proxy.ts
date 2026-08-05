import { NextRequest, NextResponse } from 'next/server'
import {
  DEFAULT_LECTURER_HOSTS,
  DEFAULT_PWA_HOSTS,
  DEFAULT_STUDENT_HOSTS,
  LECTURER_REDIRECT_COOKIE_NAME,
  STUDENT_REDIRECT_COOKIE_NAME,
} from './lib/constants'
import { edgeLogger } from './lib/edgeLogger'
import { resolveRequestContext } from '@klicker-uzh/logging/request'

// Cookie maxAge is specified in seconds
const REDIRECT_COOKIE_TTL_S = 10

function parseCsvHosts(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const _STUDENT = parseCsvHosts(process.env.AUTH_STUDENT_ALLOWED_HOSTS)
const STUDENT_HOSTS = _STUDENT.length ? _STUDENT : DEFAULT_STUDENT_HOSTS
const _LECTURER = parseCsvHosts(process.env.AUTH_LECTURER_ALLOWED_HOSTS)
const LECTURER_HOSTS = _LECTURER.length ? _LECTURER : DEFAULT_LECTURER_HOSTS
const _PWA = parseCsvHosts(process.env.AUTH_PWA_HOSTS)
const PWA_HOSTS = _PWA.length ? _PWA : DEFAULT_PWA_HOSTS

function isAllowedHost(url: string, allowed: string[]): boolean {
  try {
    const parsed = new URL(url)
    return allowed.some(
      (domain) => parsed.host === domain || parsed.host.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

function isValidStudentRedirectUrl(url: string): boolean {
  if (!url) return false
  return isAllowedHost(url, STUDENT_HOSTS)
}

function isValidLecturerRedirectUrl(url: string): boolean {
  if (!url) return false
  return isAllowedHost(url, LECTURER_HOSTS)
}

function getHostFromHeaderUrl(h?: string | null): string | null {
  if (!h) return null
  try {
    const u = new URL(h)
    return u.host
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const requestContext = resolveRequestContext({
    requestId: request.headers.get('x-request-id'),
    correlationId: request.headers.get('x-correlation-id'),
  })
  const log = edgeLogger.child(requestContext)
  const withRequestId = (response: NextResponse) => {
    response.headers.set('x-request-id', requestContext.requestId)
    response.headers.set('x-correlation-id', requestContext.correlationId)
    return response
  }

  // If the request is initiated from the PWA, redirect to the PWA login
  const referer = request.headers.get('referer')
  const refererHost = getHostFromHeaderUrl(referer)
  const redirectToParam = request.nextUrl.searchParams.get('redirectTo')
  const redirectToHost = getHostFromHeaderUrl(redirectToParam || undefined)
  const currentHost = request.headers.get('host') || request.nextUrl.host
  let envAuthHost: string | null = null
  try {
    envAuthHost = process.env.NEXTAUTH_URL
      ? new URL(process.env.NEXTAUTH_URL).host
      : null
  } catch {
    envAuthHost = null
  }
  const cookieDomain =
    envAuthHost && envAuthHost === currentHost ? envAuthHost : undefined
  const commonCookieOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    // Limit to auth endpoints only
    path: '/api/auth',
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  }
  const clearCookieOpts = {
    path: '/api/auth',
    maxAge: 0,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  }

  function clearAllRedirectCookies(resp: NextResponse) {
    // Clear for both current host-only cookies (no domain) and domain-scoped (auth host), and for both paths
    const paths = ['/', '/api/auth']
    const domains = [undefined, cookieDomain].filter(Boolean) as (
      | string
      | undefined
    )[]

    for (const name of [
      STUDENT_REDIRECT_COOKIE_NAME,
      LECTURER_REDIRECT_COOKIE_NAME,
    ]) {
      for (const p of paths) {
        // Host-only
        resp.cookies.set(name, '', { path: p, maxAge: 0 })
        // With domain
        for (const d of domains) {
          if (d) resp.cookies.set(name, '', { path: p, maxAge: 0, domain: d })
        }
      }
    }
  }
  const pwaLoginUrl = process.env.NEXT_PUBLIC_PWA_URL
    ? `${process.env.NEXT_PUBLIC_PWA_URL.replace(/\/$/, '')}/login`
    : 'https://pwa.klicker.uzh.ch/login'

  if (
    (refererHost && PWA_HOSTS.includes(refererHost)) ||
    (redirectToHost && PWA_HOSTS.includes(redirectToHost))
  ) {
    log.info(
      { event: 'auth.redirect.selected', audience: 'participant' },
      'Selected PWA login redirect'
    )
    return withRequestId(NextResponse.redirect(pwaLoginUrl))
  }

  // Handle root (lecturer login UI). If a redirectTo is provided, set cookie early.
  if (pathname === '/') {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo')
    if (redirectTo && isValidLecturerRedirectUrl(redirectTo)) {
      const response = NextResponse.next()
      // Set lecturer-specific cookie, scoped to auth host
      response.cookies.set(LECTURER_REDIRECT_COOKIE_NAME, redirectTo, {
        ...commonCookieOpts,
        maxAge: REDIRECT_COOKIE_TTL_S,
      })
      log.info(
        { event: 'auth.redirect_cookie.updated', audience: 'lecturer' },
        'Updated redirect cookie'
      )
      return withRequestId(response)
    }
  }

  // Handle /lecturer route - redirect to lecturer UI and set cookie early
  if (pathname === '/lecturer') {
    const redirectTo =
      request.nextUrl.searchParams.get('redirectTo') ||
      process.env.NEXT_PUBLIC_MANAGE_URL ||
      'https://manage.klicker.uzh.ch'

    if (!isValidLecturerRedirectUrl(redirectTo)) {
      log.warn(
        { event: 'auth.redirect.rejected', audience: 'lecturer' },
        'Rejected auth redirect'
      )
      return withRequestId(new NextResponse('Invalid redirect URL', { status: 400 }))
    }

    // Set/refresh cookie and show index login page (UI offers EduID or delegated)
    const dest = new URL('/', request.url)
    dest.searchParams.set('redirectTo', redirectTo)
    const response = NextResponse.redirect(dest)
    // Set lecturer-specific cookie, scoped to auth host
    response.cookies.set(LECTURER_REDIRECT_COOKIE_NAME, redirectTo, {
      ...commonCookieOpts,
      maxAge: REDIRECT_COOKIE_TTL_S,
    })
    log.info(
      { event: 'auth.redirect_cookie.updated', audience: 'lecturer' },
      'Updated redirect cookie'
    )
    return withRequestId(response)
  }

  // Handle /student route - render login page and set cookie early (belt-and-suspenders)
  if (pathname === '/student') {
    const redirectTo =
      request.nextUrl.searchParams.get('redirectTo') ||
      process.env.NEXT_PUBLIC_ASSESSMENT_URL ||
      'https://assessment.klicker.uzh.ch'

    if (!isValidStudentRedirectUrl(redirectTo)) {
      log.warn(
        { event: 'auth.redirect.rejected', audience: 'participant' },
        'Rejected auth redirect'
      )
      return withRequestId(new NextResponse('Invalid redirect URL', { status: 400 }))
    }

    // Set/refresh the redirect cookie so it's available on callback even if
    // NextAuth posts the callbackUrl in the body (not readable in proxy)
    const response = NextResponse.next()
    // Set student-specific cookie, scoped to auth host
    response.cookies.set(STUDENT_REDIRECT_COOKIE_NAME, redirectTo, {
      ...commonCookieOpts,
      maxAge: REDIRECT_COOKIE_TTL_S,
    })
    log.info(
      { event: 'auth.redirect_cookie.updated', audience: 'participant' },
      'Updated redirect cookie'
    )
    return withRequestId(response)
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

    // If handling provider callback, ensure we carry the intended callbackUrl from cookie
    if (pathname.startsWith('/api/auth/callback')) {
      const studentRedirect = request.cookies.get(
        STUDENT_REDIRECT_COOKIE_NAME
      )?.value
      const lecturerRedirect = request.cookies.get(
        LECTURER_REDIRECT_COOKIE_NAME
      )?.value
      const effectiveRedirect = studentRedirect || lecturerRedirect
      if (effectiveRedirect) {
        const cookieSaysParticipant =
          isValidStudentRedirectUrl(effectiveRedirect)
        const cookieSaysLecturer = isValidLecturerRedirectUrl(effectiveRedirect)

        const url = request.nextUrl.clone()
        let modified = false

        // Ensure callbackUrl is present from cookie
        if (
          !url.searchParams.has('callbackUrl') &&
          (cookieSaysParticipant ||
            cookieSaysLecturer ||
            isValidStudentRedirectUrl(effectiveRedirect) ||
            isValidLecturerRedirectUrl(effectiveRedirect))
        ) {
          url.searchParams.set('callbackUrl', effectiveRedirect)
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
          // Clear all redirect cookies on callback (scoped + legacy)
          clearAllRedirectCookies(resp)
          log.info(
            { event: 'auth.callback.normalized' },
            'Normalized authentication callback'
          )
          return withRequestId(resp)
        }

        // Clear the cookies in any case on callback to avoid lingering state
        const passthrough = NextResponse.next()
        clearAllRedirectCookies(passthrough)
        return withRequestId(passthrough)
      }
      // If generic cookie is not present, still clear any specific cookies
      const passthrough = NextResponse.next()
      if (studentRedirect || lecturerRedirect) {
        clearAllRedirectCookies(passthrough)
      }
      return withRequestId(passthrough)
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
        // Set audience-specific cookie, scoped to auth host
        const cookieName = isParticipantContext
          ? STUDENT_REDIRECT_COOKIE_NAME
          : LECTURER_REDIRECT_COOKIE_NAME
        response.cookies.set(cookieName, cb, {
          ...commonCookieOpts,
          maxAge: REDIRECT_COOKIE_TTL_S,
        })
      }
    }

    return withRequestId(response)
  }

  return withRequestId(NextResponse.next())
}

export const config = {
  matcher: ['/', '/student', '/lecturer', '/api/auth/:path*'],
}
