export type ElementSourceKind = 'DOCUMENT' | 'WEB'

export type ElementSourcePageLocator = {
  type: 'PAGE_RANGE'
  pageFrom: number
  pageTo: number
  labelFrom?: string
  labelTo?: string
}

export type ElementSourceWebLocator = {
  type: 'WEB_ANCHOR'
  url: string
  label?: string
}

export type ElementSourceLocator =
  | ElementSourcePageLocator
  | ElementSourceWebLocator

export type ElementSourceReference = {
  sourceId: string
  kind: ElementSourceKind
  title: string
  canonicalUrl?: string
  chunkIds: string[]
  locators: ElementSourceLocator[]
}

const SENSITIVE_QUERY_PARAMETER =
  /^(?:access[_-]?token|api[_-]?key|auth|credential|expires?|jwt|key|password|sas|secret|se|sig|signature|ske|skoid|sks|skt|sktid|skv|sp|spr|sr|st|sv|token)$/iu

function isSensitiveQueryParameter(key: string) {
  if (SENSITIVE_QUERY_PARAMETER.test(key)) return true

  const normalized = key.toLowerCase().replace(/[^a-z0-9]/gu, '')
  return /^(?:xamz|xgoog).*(?:credential|expires|signature)$/u.test(normalized)
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false
  }

  const [first, second] = parts
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

/**
 * Source snapshots may retain stable http(s) addresses, but never embedded
 * credentials or URLs that look like signed, expiring access grants.
 */
export function isSafeElementSourceUrl(value: string) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    if (url.username || url.password) return false
    return ![...url.searchParams.keys()].some(isSensitiveQueryParameter)
  } catch {
    return false
  }
}

/**
 * A stored address is linkable without another access resolver only when its
 * shape is clearly public. This does not turn the snapshot into authorization.
 */
export function isDemonstrablyPublicElementSourceUrl(value: string) {
  if (!isSafeElementSourceUrl(value)) return false

  const url = new URL(value)
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, '')
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === '::1' ||
    (hostname.includes(':') &&
      (hostname.startsWith('fc') ||
        hostname.startsWith('fd') ||
        hostname.startsWith('fe80'))) ||
    isPrivateIpv4(hostname)
  ) {
    return false
  }

  return true
}

export function getElementSourceLocatorTarget(
  source: ElementSourceReference,
  locator: ElementSourceLocator
) {
  if (locator.type === 'WEB_ANCHOR') {
    return isDemonstrablyPublicElementSourceUrl(locator.url)
      ? locator.url
      : undefined
  }

  if (
    !source.canonicalUrl ||
    !isDemonstrablyPublicElementSourceUrl(source.canonicalUrl)
  ) {
    return undefined
  }

  const target = new URL(source.canonicalUrl)
  target.hash = `page=${locator.pageFrom}`
  return target.toString()
}
