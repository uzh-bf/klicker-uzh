const CONTAINER_PATTERN = /^(?!.*--)[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const MAX_BLOB_PREFIX_LENGTH = 700

export const DEFAULT_KB_GRAPH_BUNDLE_CONTAINER = 'kg-graph-artifacts'
export const DEFAULT_KB_GRAPH_BUNDLE_PREFIX = 'graph-artifacts'

function containsControlCharacter(value: string) {
  return Array.from(value).some((character) => character.charCodeAt(0) <= 31)
}

function canonicalBlobPrefix(value: string): string | null {
  const normalized = value.trim().replace(/^\/+|\/+$/gu, '')
  const segments = normalized.split('/')
  return normalized.length > 0 &&
    normalized.length <= MAX_BLOB_PREFIX_LENGTH &&
    !normalized.includes('\\') &&
    !normalized.includes('?') &&
    !normalized.includes('#') &&
    !containsControlCharacter(normalized) &&
    segments.every((segment) => segment && segment !== '.' && segment !== '..')
    ? normalized
    : null
}

export function getKBGraphBundleCoordinates(
  buildId: string,
  env: NodeJS.ProcessEnv = process.env
) {
  const containerName =
    env.KB_GRAPH_ARTIFACT_CONTAINER?.trim() || DEFAULT_KB_GRAPH_BUNDLE_CONTAINER
  const configuredPrefix =
    env.KB_GRAPH_ARTIFACT_PREFIX?.trim() || DEFAULT_KB_GRAPH_BUNDLE_PREFIX
  const prefix = canonicalBlobPrefix(configuredPrefix)
  if (!CONTAINER_PATTERN.test(containerName) || prefix === null) {
    throw new Error('KB graph bundle storage configuration is invalid')
  }
  return {
    containerName,
    blobPrefix: `${prefix}/${buildId}/${buildId}`,
    storageName: buildId,
  }
}

export function expectedKBGraphManifestBlobName(
  blobPrefix: string,
  bundleSha256: string
): string | null {
  const prefix = canonicalBlobPrefix(blobPrefix)
  return prefix !== null && SHA256_PATTERN.test(bundleSha256)
    ? `${prefix}/${bundleSha256}/manifest.json`
    : null
}
