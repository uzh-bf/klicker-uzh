import { NextResponse } from 'next/server'
import { CODE_RUNTIME_MANIFEST, RUNNER_DOCUMENTS } from './manifest'

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

// The runner documents run untrusted learner code. The CSP sandbox keeps the
// document opaque even when its URL is opened directly, and no directive
// allows a network scheme. Only webR evaluates JavaScript strings, so only
// the R runner gets 'unsafe-eval'. There is no frame-ancestors directive:
// it checks every ancestor, so it would block the runner whenever an LMS on
// another origin embeds Chat, and the opaque runner has nothing to protect.
function runnerPolicy(allowEval: boolean): string {
  return [
    "default-src 'none'",
    `script-src 'sha256-${CODE_RUNTIME_MANIFEST.runnerScriptSha256}' blob: 'wasm-unsafe-eval'${allowEval ? " 'unsafe-eval'" : ''}`,
    'worker-src blob:',
    'connect-src blob:',
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    'sandbox allow-scripts',
  ].join('; ')
}

const RUNNER_POLICIES = new Map([
  [RUNNER_DOCUMENTS['python-core'], runnerPolicy(false)],
  [RUNNER_DOCUMENTS['r-base'], runnerPolicy(true)],
])

export function codeRuntimeProxyResponse(pathname: string): NextResponse {
  if (!isCodeExecutionEnabled()) {
    return new NextResponse(null, { status: 404 })
  }
  const response = NextResponse.next()
  for (const [name, value] of Object.entries(RUNTIME_FILE_HEADERS)) {
    response.headers.set(name, value)
  }
  const runnerPolicyForPath = RUNNER_POLICIES.get(
    pathname.slice(pathname.lastIndexOf('/') + 1)
  )
  if (runnerPolicyForPath) {
    response.headers.set('Content-Security-Policy', runnerPolicyForPath)
  }
  return response
}
