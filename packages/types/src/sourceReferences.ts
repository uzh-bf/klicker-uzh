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
  /^(?:access[_-]?token|api[_-]?key|auth|client[_-]?secret|credential|expires?|id[_-]?token|jwt|key|password|refresh[_-]?token|sas|secret|se|session[_-]?token|sig|signature|ske|skoid|sks|skt|sktid|skv|sp|spr|sr|st|sv|token)$/iu

function isSensitiveQueryParameter(key: string) {
  if (SENSITIVE_QUERY_PARAMETER.test(key)) return true

  const normalized = key.toLowerCase().replace(/[^a-z0-9]/gu, '')
  return /^(?:xamz|xgoog).*(?:credential|expires|signature)$/u.test(normalized)
}

function parseIpv4(hostname: string) {
  const parts = hostname.split('.').map(Number)
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return undefined
  }
  return parts as [number, number, number, number]
}

function isNonPublicIpv4(hostname: string) {
  const parts = parseIpv4(hostname)
  if (!parts) return false

  const [first, second] = parts
  return (
    first === 0 ||
    first === 10 ||
    (first === 100 && second >= 64 && second <= 127) ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && parts[2] === 100) ||
    (first === 203 && second === 0 && parts[2] === 113) ||
    first >= 224
  )
}

function parseIpv6(hostname: string) {
  const separatorIndex = hostname.indexOf('::')
  if (separatorIndex !== -1 && separatorIndex !== hostname.lastIndexOf('::')) {
    return undefined
  }

  const [head = '', tail = ''] =
    separatorIndex === -1
      ? [hostname, '']
      : [hostname.slice(0, separatorIndex), hostname.slice(separatorIndex + 2)]
  const parseHextets = (value: string) => {
    if (!value) return []
    return value
      .split(':')
      .map((part) =>
        /^[0-9a-f]{1,4}$/iu.test(part) ? Number.parseInt(part, 16) : Number.NaN
      )
  }
  const headParts = parseHextets(head)
  const tailParts = parseHextets(tail)
  if ([...headParts, ...tailParts].some(Number.isNaN)) return undefined

  const omitted = 8 - headParts.length - tailParts.length
  if (
    (separatorIndex === -1 && omitted !== 0) ||
    (separatorIndex !== -1 && omitted < 1)
  ) {
    return undefined
  }
  return [...headParts, ...Array(omitted).fill(0), ...tailParts] as number[]
}

function isNonPublicIpv6(hostname: string) {
  const parts = parseIpv6(hostname)
  if (!parts) return false

  const [first = 0, second = 0] = parts
  const isMappedIpv4 =
    parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff
  if (isMappedIpv4) {
    const mapped = `${parts[6]! >> 8}.${parts[6]! & 0xff}.${parts[7]! >> 8}.${parts[7]! & 0xff}`
    return isNonPublicIpv4(mapped)
  }

  const isGlobalUnicast = (first & 0xe000) === 0x2000
  const isDocumentation = first === 0x2001 && second === 0x0db8
  const isBenchmark = first === 0x2001 && second === 0x0002
  return !isGlobalUnicast || isDocumentation || isBenchmark
}

function hasSensitiveFragmentParameter(hash: string) {
  if (!hash) return false
  return hash
    .slice(1)
    .split(/[?&;]/u)
    .some((part) => {
      const equalsIndex = part.indexOf('=')
      if (equalsIndex < 1) return false
      try {
        return isSensitiveQueryParameter(
          decodeURIComponent(part.slice(0, equalsIndex))
        )
      } catch {
        return true
      }
    })
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
    return (
      ![...url.searchParams.keys()].some(isSensitiveQueryParameter) &&
      !hasSensitiveFragmentParameter(url.hash)
    )
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
    isNonPublicIpv4(hostname) ||
    (hostname.includes(':') && isNonPublicIpv6(hostname))
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
