import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  if (process.env.DISABLE_FRAME_ANCESTORS_MIDDLEWARE === 'true') {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const allowed = process.env.ALLOWED_FRAME_ANCESTORS
  if (!allowed) {
    return response
  }

  const nextRouterPrefetch = request.headers.has('next-router-prefetch')
  const purpose = (request.headers.get('purpose') ?? '').toLowerCase()
  const secPurpose = (request.headers.get('sec-purpose') ?? '').toLowerCase()
  const middlewarePrefetch = (
    request.headers.get('x-middleware-prefetch') ?? ''
  ).toLowerCase()
  const isPrefetchRequest =
    nextRouterPrefetch ||
    purpose === 'prefetch' ||
    secPurpose === 'prefetch' ||
    middlewarePrefetch === '1'
  if (isPrefetchRequest) {
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
    {
      source: '/((?!api|_next|favicon.ico|robots.txt|sitemap.xml).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
        { type: 'header', key: 'sec-purpose', value: 'prefetch' },
        { type: 'header', key: 'x-middleware-prefetch', value: '1' },
      ],
    },
  ],
}
