import { NextResponse } from 'next/server'

export function middleware() {
  const response = NextResponse.next()

  const allowedFrameAncestors = process.env.ALLOWED_FRAME_ANCESTORS
  const frameAncestors = allowedFrameAncestors
    ? `frame-ancestors 'self' ${allowedFrameAncestors}`
    : "frame-ancestors 'self'"

  response.headers.set('Content-Security-Policy', frameAncestors)
  return response
}

export const config = {
  matcher: ['/:path*'],
}
