// Keep launch-target parsing and validation centralized so a future
// Provider.onDeepLinking(...) implementation can reuse the same contract.

const CUSTOM_REDIRECT_CLAIM_KEY = 'klicker_redirect_to'

export type LaunchTargetSource = 'custom' | 'query' | 'env'

export type LaunchTargetFailureReason =
  | 'missing_target'
  | 'invalid_type'
  | 'invalid_url'
  | 'disallowed_host'

export type ResolveLaunchTargetResult =
  | { ok: true; source: LaunchTargetSource; target: URL }
  | {
      ok: false
      source: LaunchTargetSource | null
      reason: LaunchTargetFailureReason
      rawValue?: unknown
    }

export function resolveLaunchTarget(
  token: unknown,
  req: { query: Record<string, unknown> }
): ResolveLaunchTargetResult {
  const candidates: Array<{ source: LaunchTargetSource; value: unknown }> = [
    {
      source: 'custom',
      value: extractCustomRedirectTarget(token),
    },
    {
      source: 'query',
      value: req.query.redirectTo,
    },
    {
      source: 'env',
      value: process.env.LTI_REDIRECT_URL,
    },
  ]

  for (const candidate of candidates) {
    if (candidate.value == null) continue
    return validateLaunchTarget(candidate.value, candidate.source)
  }

  return {
    ok: false,
    source: null,
    reason: 'missing_target',
  }
}

export function validateLaunchTarget(
  rawValue: unknown,
  source: LaunchTargetSource
): ResolveLaunchTargetResult {
  if (typeof rawValue !== 'string') {
    return {
      ok: false,
      source,
      reason: 'invalid_type',
      rawValue,
    }
  }

  let target: URL
  try {
    target = new URL(rawValue)
  } catch {
    return {
      ok: false,
      source,
      reason: 'invalid_url',
      rawValue,
    }
  }

  const allowedDomains = getAllowedDomains()
  if (!isAllowedHost(target.hostname, allowedDomains)) {
    return {
      ok: false,
      source,
      reason: 'disallowed_host',
      rawValue,
    }
  }

  return {
    ok: true,
    source,
    target,
  }
}

export function appendJwt(target: URL, jwt: string): string {
  const url = new URL(target.toString())
  url.searchParams.set('jwt', jwt)
  return url.toString()
}

function extractCustomRedirectTarget(token: unknown): unknown {
  if (!isRecord(token)) return undefined

  const platformContext = token.platformContext
  if (!isRecord(platformContext)) return undefined

  const custom = platformContext.custom
  if (!isRecord(custom)) return undefined

  return custom[CUSTOM_REDIRECT_CLAIM_KEY]
}

function getAllowedDomains(): string[] {
  return [process.env.COOKIE_DOMAIN, process.env.DF_DOMAIN]
    .filter((domain): domain is string => typeof domain === 'string')
    .map((domain) => normalizeDomain(domain))
    .filter((domain) => domain.length > 0)
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^\.+/, '').replace(/\.+$/, '')
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.+$/, '')
}

function isAllowedHost(host: string, allowedDomains: string[]): boolean {
  const normalizedHost = normalizeHost(host)
  return allowedDomains.some(
    (domain) =>
      normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
