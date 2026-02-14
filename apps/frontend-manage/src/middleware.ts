import { NextResponse } from 'next/server'

export function middleware() {
  const response = NextResponse.next()
  const allowed = process.env.ALLOWED_FRAME_ANCESTORS
  if (allowed) {
    response.headers.set(
      'Content-Security-Policy',
      `frame-ancestors 'self' ${allowed}`
    )
  }
  return response
}

export const config = {
  matcher: ['/:path*'],
}
