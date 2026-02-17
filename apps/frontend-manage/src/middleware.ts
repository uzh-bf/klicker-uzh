import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const allowed = process.env.ALLOWED_FRAME_ANCESTORS
  if (!allowed) {
    return response
  }

  const accept = request.headers.get('accept') ?? ''
  const secFetchDest = request.headers.get('sec-fetch-dest')
  const isDocumentRequest =
    secFetchDest === 'document' || accept.includes('text/html')

  if (isDocumentRequest) {
    response.headers.set(
      'Content-Security-Policy',
      `frame-ancestors 'self' ${allowed}`
    )
  }
  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
