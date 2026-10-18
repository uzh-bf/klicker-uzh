import { NextResponse } from 'next/server'

export const CODE_RUNTIME_PATH_PREFIX = '/code-runtimes/'

// Deployment kill switch for browser code execution. Absent or any value other
// than "true" keeps the capability off, whatever a chatbot's policy says.
export function isCodeExecutionEnabled(): boolean {
  return process.env.CHAT_CODE_EXECUTION_ENABLED === 'true'
}

// Runtime files are static files in public/, which Next.js would otherwise
// serve unconditionally. They are gated and given their headers here, at
// request time: build-time next.config headers cannot read the runtime
// environment, and the proxy's frame-ancestors policy would replace them.
// The paths carry a content-derived version, so they are safe to cache as
// immutable.
const RUNTIME_FILE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Content-Security-Policy':
    "default-src 'none'; frame-ancestors 'none'; sandbox",
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
}

export function codeRuntimeProxyResponse(pathname: string): NextResponse {
  if (!isCodeExecutionEnabled()) {
    return new NextResponse(null, { status: 404 })
  }
  const response = NextResponse.next()
  for (const [name, value] of Object.entries(RUNTIME_FILE_HEADERS)) {
    response.headers.set(name, value)
  }
  // Notices are generated independently of the runtime manifest version.
  if (
    pathname.endsWith('/NOTICE.md') ||
    pathname.endsWith('/LICENSE-webR.md')
  ) {
    response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
  }
  return response
}
