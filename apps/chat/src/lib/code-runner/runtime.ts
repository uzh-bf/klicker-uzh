import { codeRuntimeResponseHeaders } from '@klicker-uzh/code-runner/serving'
import { NextResponse } from 'next/server'

export { CODE_RUNTIME_PATH_PREFIX } from '@klicker-uzh/code-runner/serving'

// Deployment kill switch for browser code execution. Absent or any value other
// than "true" keeps the capability off, whatever a chatbot's policy says.
export function isCodeExecutionEnabled(): boolean {
  return process.env.CHAT_CODE_EXECUTION_ENABLED === 'true'
}

// Runtime files are static files in public/, which Next.js would otherwise
// serve unconditionally. They are gated and given their headers here, at
// request time, ahead of the proxy's own frame-ancestors policy.
export function codeRuntimeProxyResponse(pathname: string): NextResponse {
  if (!isCodeExecutionEnabled()) {
    return new NextResponse(null, { status: 404 })
  }
  const response = NextResponse.next()
  for (const [name, value] of Object.entries(
    codeRuntimeResponseHeaders(pathname)
  )) {
    response.headers.set(name, value)
  }
  return response
}
