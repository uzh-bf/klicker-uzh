import { CODE_RUNTIME_MANIFEST, RUNNER_DOCUMENTS } from './manifest'

export {
  CODE_RUNTIME_BASE_PATH,
  CODE_RUNTIME_MANIFEST,
  CODE_RUNTIME_PATH_PREFIX,
} from './manifest'

// Headers for the runtime files and runner documents. The hosting app sets
// them at request time, behind its own deployment switch: build-time headers
// cannot read the runtime environment, and an app-wide frame-ancestors policy
// would replace them. The paths carry a content-derived version, so they are
// safe to cache as immutable.
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
// another origin embeds the hosting app, and the opaque runner has nothing to
// protect.
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

/** Response headers for a path under `CODE_RUNTIME_PATH_PREFIX`. */
export function codeRuntimeResponseHeaders(
  pathname: string
): Record<string, string> {
  const runnerPolicyForPath = RUNNER_POLICIES.get(
    pathname.slice(pathname.lastIndexOf('/') + 1)
  )
  const headers = runnerPolicyForPath
    ? {
        ...RUNTIME_FILE_HEADERS,
        'Content-Security-Policy': runnerPolicyForPath,
      }
    : { ...RUNTIME_FILE_HEADERS }
  // Notices are generated independently of the runtime manifest version.
  if (
    pathname.endsWith('/NOTICE.md') ||
    pathname.endsWith('/LICENSE-webR.md')
  ) {
    headers['Cache-Control'] = 'public, max-age=0, must-revalidate'
  }
  return headers
}
