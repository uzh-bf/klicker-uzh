import { BlockList, isIP } from 'node:net'

const BLOCKED_IPV4_ADDRESSES = new BlockList()

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  BLOCKED_IPV4_ADDRESSES.addSubnet(network, prefix, 'ipv4')
}

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.home.arpa',
  '.internal',
  '.invalid',
  '.local',
  '.localhost',
  '.onion',
  '.test',
]
const BLOCKED_HOSTNAMES = new Set(
  BLOCKED_HOSTNAME_SUFFIXES.map((suffix) => suffix.slice(1))
)

export function isPublicIPv4Address(value: string): boolean {
  return isIP(value) === 4 && !BLOCKED_IPV4_ADDRESSES.check(value, 'ipv4')
}

export function normalizePublicHttpUrl(value: string): string {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(value.trim())
  } catch {
    throw new Error('URL is invalid')
  }

  if (
    (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error('URL is invalid')
  }

  const hostname = parsedUrl.hostname
    .replace(/^\[(.*)\]$/, '$1')
    .replace(/\.$/, '')
    .toLowerCase()
  const ipVersion = isIP(hostname)
  if (
    !hostname ||
    (ipVersion === 0 && !hostname.includes('.')) ||
    BLOCKED_HOSTNAMES.has(hostname) ||
    BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
    (ipVersion === 4 && !isPublicIPv4Address(hostname)) ||
    ipVersion === 6
  ) {
    throw new Error('URL is invalid')
  }

  return parsedUrl.toString()
}
