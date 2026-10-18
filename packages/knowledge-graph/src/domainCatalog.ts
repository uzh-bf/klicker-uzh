import catalogJson from './domainCatalog.json' with { type: 'json' }

/**
 * Non-secret capability gate for explicit KB graph domain selection. The reader
 * advertises and accepts explicit domain options only while this value is a
 * non-empty match for the shipped catalog's revision; an unset value or a
 * mismatch leaves the legacy Finance/German path as the only supported route.
 */
export const KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV =
  'KB_GRAPH_DOMAIN_CATALOG_REVISION'

export const KB_GRAPH_DOMAIN_LANGUAGES = ['German', 'English'] as const

export type KBGraphDomainLanguage = (typeof KB_GRAPH_DOMAIN_LANGUAGES)[number]

export type KBGraphDomainCategory = {
  name: string
  definition: string
}

export type KBGraphDomainPolicyLanguage = {
  language: KBGraphDomainLanguage
  /**
   * Digest of the fully resolved policy for this language, computed by the
   * canonical catalog export. Integrity metadata for the catalog only: a
   * resolved selection never exposes it to callers.
   */
  policyDigest: string
  categories: KBGraphDomainCategory[]
}

export type KBGraphDomainPolicy = {
  id: string
  version: number
  labelKey: string
  languages: KBGraphDomainPolicyLanguage[]
}

export type KBGraphDomainCatalog = {
  revision: string
  digest: string
  policies: KBGraphDomainPolicy[]
}

export type KBGraphDomainSelection = {
  domainPolicyId: string
  domainPolicyVersion: number
  language: KBGraphDomainLanguage
  categories: KBGraphDomainCategory[]
}

export type KBGraphDomainSelectionRequest = {
  domainPolicyId?: string | null
  domainPolicyVersion?: number | null
  language?: string | null
}

export type KBGraphDomainSelectionRejectionReason =
  | 'INCOMPLETE'
  | 'CAPABILITY_DISABLED'
  | 'UNKNOWN_POLICY'
  | 'UNSUPPORTED_VERSION'
  | 'UNSUPPORTED_LANGUAGE'

export const KB_GRAPH_DOMAIN_ERROR_CODES: Record<
  KBGraphDomainSelectionRejectionReason,
  string
> = {
  INCOMPLETE: 'KB_GRAPH_DOMAIN_SELECTION_INCOMPLETE',
  CAPABILITY_DISABLED: 'KB_GRAPH_DOMAIN_CAPABILITY_DISABLED',
  UNKNOWN_POLICY: 'KB_GRAPH_DOMAIN_UNKNOWN_POLICY',
  UNSUPPORTED_VERSION: 'KB_GRAPH_DOMAIN_UNSUPPORTED_VERSION',
  UNSUPPORTED_LANGUAGE: 'KB_GRAPH_DOMAIN_UNSUPPORTED_LANGUAGE',
}

export type KBGraphDomainSelectionResolution =
  | { ok: true; selection: KBGraphDomainSelection | null }
  | { ok: false; reason: KBGraphDomainSelectionRejectionReason }

/**
 * The catalog is a trusted build-time artifact: the canonical export is typed
 * against KBGraphDomainCatalog and inlined into the bundle, so it is never
 * parsed or read from the filesystem at runtime.
 */
const KB_GRAPH_DOMAIN_CATALOG: KBGraphDomainCatalog =
  catalogJson as KBGraphDomainCatalog

export function getDefaultKBGraphDomainCatalog(): KBGraphDomainCatalog {
  return KB_GRAPH_DOMAIN_CATALOG
}

export function isKBGraphDomainCapabilityEnabled(
  catalogRevision: string,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const configured = env[KB_GRAPH_DOMAIN_CATALOG_REVISION_ENV]?.trim()
  return (
    configured !== undefined &&
    configured !== '' &&
    configured === catalogRevision
  )
}

/**
 * Presence is about the caller having supplied a value at all. An empty string
 * is a supplied, invalid value: it must be rejected as an explicit selection
 * rather than silently collapsed into the legacy path.
 */
function isProvided(value: unknown): boolean {
  return value !== undefined && value !== null
}

/**
 * Resolves a requested or persisted domain selection against the catalog. An
 * entirely absent request is the legacy path and resolves to a null selection;
 * a partial request is rejected before any policy lookup so an incomplete
 * selection can never be stored or dispatched.
 */
export function resolveKBGraphDomainSelection(
  request: KBGraphDomainSelectionRequest,
  options: { catalog: KBGraphDomainCatalog | null; capabilityEnabled: boolean }
): KBGraphDomainSelectionResolution {
  const hasPolicyId = isProvided(request.domainPolicyId)
  const hasVersion = isProvided(request.domainPolicyVersion)
  const hasLanguage = isProvided(request.language)

  const providedCount =
    (hasPolicyId ? 1 : 0) + (hasVersion ? 1 : 0) + (hasLanguage ? 1 : 0)

  if (providedCount === 0) {
    return { ok: true, selection: null }
  }
  if (providedCount < 3) {
    return { ok: false, reason: 'INCOMPLETE' }
  }
  if (!options.capabilityEnabled || options.catalog === null) {
    return { ok: false, reason: 'CAPABILITY_DISABLED' }
  }

  const requestedVersion = request.domainPolicyVersion
  if (
    typeof requestedVersion !== 'number' ||
    !Number.isInteger(requestedVersion) ||
    requestedVersion < 1
  ) {
    return { ok: false, reason: 'UNSUPPORTED_VERSION' }
  }

  const policyId = request.domainPolicyId as string
  // A catalog may retain several versions of one policy id. Look the pair up
  // together so a retained id with an unretained version is a version problem,
  // not a missing policy.
  if (
    !options.catalog.policies.some((candidate) => candidate.id === policyId)
  ) {
    return { ok: false, reason: 'UNKNOWN_POLICY' }
  }
  const policy = options.catalog.policies.find(
    (candidate) =>
      candidate.id === policyId && candidate.version === requestedVersion
  )
  if (!policy) {
    return { ok: false, reason: 'UNSUPPORTED_VERSION' }
  }

  const requestedLanguage = request.language as string
  const policyLanguage = policy.languages.find(
    (candidate) => candidate.language === requestedLanguage
  )
  if (!policyLanguage) {
    return { ok: false, reason: 'UNSUPPORTED_LANGUAGE' }
  }

  return {
    ok: true,
    selection: {
      domainPolicyId: policy.id,
      domainPolicyVersion: policy.version,
      language: policyLanguage.language,
      categories: policyLanguage.categories,
    },
  }
}
