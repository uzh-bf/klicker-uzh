import { resolveRequestContext } from '@klicker-uzh/logging/request'
import { type NextRequest, NextResponse } from 'next/server'
import { resolveSecureCookies } from './lib/authCookies'
import {
  DEFAULT_LECTURER_HOSTS,
  DEFAULT_PWA_HOSTS,
  DEFAULT_STUDENT_HOSTS,
} from './lib/constants'
import { edgeLogger } from './lib/edgeLogger'
import { hostFromUrl, validateRedirectTarget } from './lib/redirectTarget'

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
  const nextResponse = () => {
    const headers = new Headers(request.headers)
    headers.set('x-request-id', requestContext.requestId)
    headers.set('x-correlation-id', requestContext.correlationId)
    return NextResponse.next({ request: { headers } })
  }
  const secure = resolveSecureCookies(
    process.env.NEXTAUTH_URL,
    process.env.AUTH_SECURE_COOKIES
  )

  // If the request is initiated from the PWA, redirect to the PWA login.
  // Restricted to UI paths: this referer-based routing must never intercept
  // auth protocol endpoints under /api/auth.
  if (!pathname.startsWith('/api/')) {
    const referer = request.headers.get('referer')
    const refererHost = hostFromUrl(referer)
    const redirectToParam = request.nextUrl.searchParams.get('redirectTo')
    const redirectToHost = hostFromUrl(redirectToParam)
    if (
      (refererHost && PWA_HOSTS.includes(refererHost)) ||
      (redirectToHost && PWA_HOSTS.includes(redirectToHost))
    ) {
      const pwaLoginUrl = process.env.NEXT_PUBLIC_PWA_URL
        ? `${process.env.NEXT_PUBLIC_PWA_URL.replace(/\/$/, '')}/login`
        : 'https://pwa.klicker.uzh.ch/login'
      log.info(
        { event: 'auth.redirect.selected', audience: 'participant' },
        'Selected PWA login redirect'
      )
      return withRequestId(NextResponse.redirect(pwaLoginUrl))
    }
  }

  // Early target validation: an invalid explicit initiation target is
  // rejected before any OAuth flow can begin. No state is stored here —
  // the return destination travels with the sign-in request and is stored
  // in the audience-namespaced NextAuth callback-URL cookie.
  if (pathname === '/') {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo')
    if (redirectTo) {
      const validation = validateRedirectTarget(redirectTo, LECTURER_HOSTS, {
        secure,
      })
      if (!validation.ok) {
        log.warn(
          { event: 'auth.redirect.rejected', audience: 'lecturer' },
          'Rejected auth redirect'
        )
        return withRequestId(
          new NextResponse('Invalid redirect URL', { status: 400 })
        )
      }
    }
    return nextResponse()
  }

  if (pathname === '/lecturer') {
    const redirectTo =
      request.nextUrl.searchParams.get('redirectTo') ||
      process.env.NEXT_PUBLIC_MANAGE_URL ||
      'https://manage.klicker.uzh.ch'

    const validation = validateRedirectTarget(redirectTo, LECTURER_HOSTS, {
      secure,
    })
    if (!validation.ok) {
      log.warn(
        { event: 'auth.redirect.rejected', audience: 'lecturer' },
        'Rejected auth redirect'
      )
      return withRequestId(
        new NextResponse('Invalid redirect URL', { status: 400 })
      )
    }

    // Show the lecturer login page (UI offers EduID or delegated)
    const dest = new URL('/', request.url)
    dest.searchParams.set('redirectTo', redirectTo)
    return withRequestId(NextResponse.redirect(dest))
  }

  if (pathname === '/student') {
    const redirectTo =
      request.nextUrl.searchParams.get('redirectTo') ||
      process.env.NEXT_PUBLIC_ASSESSMENT_URL ||
      'https://assessment.klicker.uzh.ch'

    const validation = validateRedirectTarget(redirectTo, STUDENT_HOSTS, {
      secure,
    })
    if (!validation.ok) {
      log.warn(
        { event: 'auth.redirect.rejected', audience: 'participant' },
        'Rejected auth redirect'
      )
      return withRequestId(
        new NextResponse('Invalid redirect URL', { status: 400 })
      )
    }

    return nextResponse()
  }

  // Auth protocol endpoints are handled entirely by the NextAuth route
  // with strict per-request audience dispatch (see lib/dispatch.ts).
  return nextResponse()
}

export const config = {
  matcher: ['/', '/student', '/lecturer', '/api/auth/:path*'],
}
