import { isAbsolute, relative, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

/**
 * Pure input:
 * {
 *   primaryCheckoutPath, runtimeCheckoutPath, retainedCheckoutPaths,
 *   projectIdentity, retainedProjectIdentities, retainedMutableVolumeNames,
 *   retainedEndpointOrigins,
 *   providerRoots: { [name]: { path, revision } },
 *   providerObservations: { [name]: { path, revision, clean: true } },
 *   endpoints: { [name]: url },
 * }
 *
 * The returned object is a validation model, not rendered Compose/devrouter
 * configuration. No filesystem, Git, network, provider, or secret access
 * occurs here. Roots and health are arrays for provider-commands.mjs;
 * providers, sourceMounts, and mutableState are keyed lifecycle data.
 * Doc Processing is an explicit, local-only but unqualified capability until
 * main's integration layer supplies its concrete local service.
 */

const PROVIDER_STATE_KEYS = {
  ingestion: ['ingestionOutbox'],
  scraping: ['scraperCache'],
  retrieval: ['milvus', 'objectBacking', 'docQuery'],
  docProcessing: ['documentProcessing'],
}
const PROVIDER_NAMES = Object.keys(PROVIDER_STATE_KEYS)

const STATE_OWNERS = {
  klicker: 'klicker',
  postgres: 'postgres',
  hatchet: 'hatchet',
  hatchetConfig: 'hatchet',
  redis: 'redis',
  blob: 'blob',
  ingestionOutbox: 'ingestion',
  scraperCache: 'scraping',
  milvus: 'docQuery',
  objectBacking: 'docQuery',
  callback: 'callback',
  docQuery: 'docQuery',
  documentProcessing: 'docProcessing',
}

const ENDPOINT_HOSTS = {
  klicker: ['klicker'],
  postgres: ['postgres'],
  hatchet: ['hatchet'],
  redis: ['redis'],
  blob: ['blob', 'azurite-blob'],
  ingestion: ['ingestion', 'ingestion-api'],
  dispatcher: ['dispatcher'],
  callback: ['callback'],
  scraping: ['scraping'],
  crawl4ai: ['crawl4ai'],
  milvus: ['milvus'],
  objectBacking: ['minio', 'object-backing'],
  retrieval: ['retrieval', 'doc-query'],
  docProcessing: ['doc-processing', 'document-processing'],
}
const ENDPOINT_NAMES = Object.keys(ENDPOINT_HOSTS)
const HEALTH_NAMES = [
  'ingestion',
  'dispatcher',
  'callback',
  'scraping',
  'crawl4ai',
  'milvus',
  'retrieval',
  'docProcessing',
]

// name, kind, dependencies, endpoint, state, provider
const GRAPH_NODES = [
  [
    'klicker',
    'service',
    ['postgres', 'redis', 'hatchet', 'blob', 'docQuery'],
    'klicker',
    'klicker',
    null,
  ],
  ['postgres', 'state-service', [], 'postgres', 'postgres', null],
  [
    'hatchet',
    'service',
    ['postgres', 'hatchetConfig'],
    'hatchet',
    'hatchet',
    null,
  ],
  ['hatchetConfig', 'generated-config', [], null, 'hatchetConfig', null],
  ['redis', 'state-service', [], 'redis', 'redis', null],
  ['blob', 'state-service', [], 'blob', 'blob', null],
  [
    'ingestionApi',
    'provider-service',
    ['postgres', 'redis', 'hatchet', 'blob', 'ingestionOutbox'],
    'ingestion',
    null,
    'ingestion',
  ],
  [
    'ingestionWorkers',
    'provider-workers',
    [
      'ingestionApi',
      'postgres',
      'redis',
      'hatchet',
      'blob',
      'scraping',
      'documentProcessing',
    ],
    null,
    null,
    'ingestion',
  ],
  [
    'ingestionOutbox',
    'provider-state',
    ['postgres'],
    null,
    'ingestionOutbox',
    'ingestion',
  ],
  [
    'callback',
    'callback-service',
    ['ingestionOutbox'],
    'callback',
    'callback',
    'ingestion',
  ],
  [
    'scraping',
    'provider-service',
    ['scraperCache', 'crawl4ai'],
    'scraping',
    null,
    'scraping',
  ],
  ['scraperCache', 'provider-state', [], null, 'scraperCache', 'scraping'],
  ['crawl4ai', 'service', [], 'crawl4ai', null, null],
  ['milvus', 'service', ['objectBacking'], 'milvus', 'milvus', 'retrieval'],
  [
    'objectBacking',
    'state-service',
    [],
    'objectBacking',
    'objectBacking',
    'retrieval',
  ],
  [
    'docQuery',
    'provider-service',
    ['milvus', 'objectBacking', 'blob'],
    'retrieval',
    'docQuery',
    'retrieval',
  ],
  [
    'documentProcessing',
    'provider-service',
    [],
    'docProcessing',
    'documentProcessing',
    'docProcessing',
  ],
]

const DOC_PROCESSING_ENVIRONMENT = [
  'DOC_PROCESSING_BASE_URL',
  'DOC_PROCESSING_API_KEY',
]
const INPUT_KEYS = [
  'primaryCheckoutPath',
  'runtimeCheckoutPath',
  'retainedCheckoutPaths',
  'projectIdentity',
  'retainedProjectIdentities',
  'retainedMutableVolumeNames',
  'retainedEndpointOrigins',
  'providerRoots',
  'providerObservations',
  'endpoints',
]
const CONFIG_KEYS = [
  'schemaVersion',
  'model',
  'deployment',
  'project',
  'reserved',
  'providers',
  'roots',
  'sourceMounts',
  'health',
  'endpoints',
  'mutableState',
  'dependencyGraph',
  'capabilities',
  'integrationRequirements',
]
const IDENTIFIER = /^[a-z][a-z0-9-]{2,63}$/
const REVISION = /^[0-9a-f]{40}$/i
const VOLUME_NAME = /^[a-z][a-z0-9-]{2,127}$/
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])
const LOCAL_PROTOCOLS = new Set([
  'http:',
  'https:',
  'postgres:',
  'postgresql:',
  'redis:',
  'rediss:',
])

function invalid(message) {
  throw new TypeError(`Invalid isolated local-KB configuration: ${message}`)
}

function ensure(condition, message) {
  if (!condition) invalid(message)
}

function object(value, field) {
  ensure(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    `${field} must be an object.`
  )
}

function exactKeys(value, keys, field) {
  object(value, field)
  const expected = new Set(keys)
  for (const key of Object.keys(value)) {
    ensure(expected.has(key), `${field}.${key} is not supported.`)
  }
  for (const key of keys) {
    ensure(Object.hasOwn(value, key), `${field}.${key} is required.`)
  }
}

function string(value, field) {
  ensure(
    typeof value === 'string' && value.length > 0,
    `${field} must be a non-empty string.`
  )
}

function strings(value, field) {
  ensure(Array.isArray(value), `${field} must be an array.`)
  const seen = new Set()
  value.forEach((entry, index) => {
    string(entry, `${field}[${index}]`)
    ensure(!seen.has(entry), `${field} must contain unique values.`)
    seen.add(entry)
  })
}

function canonicalPath(value, field) {
  string(value, field)
  ensure(
    value !== '/' &&
      !value.includes('\0') &&
      isAbsolute(value) &&
      resolve(value) === value,
    `${field} must be canonical and absolute.`
  )
}

function revision(value, field) {
  string(value, field)
  ensure(
    REVISION.test(value),
    `${field} must be a 40-character immutable revision.`
  )
}

function identifier(value, field) {
  string(value, field)
  ensure(IDENTIFIER.test(value), `${field} must be a lowercase identifier.`)
}

function inside(parent, child) {
  const childRelative = relative(parent, child)
  return (
    childRelative === '' ||
    (!childRelative.startsWith('..') && !isAbsolute(childRelative))
  )
}

function disjoint(paths, field) {
  for (let first = 0; first < paths.length; first += 1) {
    for (let second = first + 1; second < paths.length; second += 1) {
      ensure(
        !inside(paths[first], paths[second]) &&
          !inside(paths[second], paths[first]),
        `${field} contains overlapping paths.`
      )
    }
  }
}

function safeProjectIdentity(value, retained) {
  identifier(value, 'projectIdentity')
  ensure(!retained.includes(value), 'projectIdentity is already retained.')
  ensure(
    !/(^|-)(default|old|primary|remote|retained|shared)(-|$)/.test(value),
    'projectIdentity uses a retained or shared identity.'
  )
}

function safeDestination(value, field, projectIdentity, reserved) {
  string(value, field)
  ensure(
    VOLUME_NAME.test(value) && value.startsWith(`${projectIdentity}-`),
    `${field} uses an unsafe destination name.`
  )
  ensure(
    !reserved.includes(value) &&
      !/(^|-)(default|old|primary|remote|retained|shared)(-|$)/.test(value),
    `${field} uses a retained or shared destination.`
  )
}

function localEndpoint(value, field, name, reservedOrigins) {
  string(value, field)
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    invalid(`${field} must be a local URL.`)
  }
  ensure(
    LOCAL_PROTOCOLS.has(parsed.protocol) && parsed.hostname && parsed.port,
    `${field} must use an explicit local protocol, host and port.`
  )
  ensure(
    !parsed.username && !parsed.password,
    `${field} must not contain credentials.`
  )
  const host = parsed.hostname.toLowerCase()
  ensure(
    LOCAL_HOSTS.has(host) || ENDPOINT_HOSTS[name].includes(host),
    `${field} must use a loopback or declared local service host.`
  )
  const origin = `${parsed.protocol}//${host}:${parsed.port}`
  for (const reserved of reservedOrigins) {
    let reservedUrl
    try {
      reservedUrl = new URL(reserved)
    } catch {
      invalid('retainedEndpointOrigins contains an invalid URL.')
    }
    const reservedOrigin = `${reservedUrl.protocol}//${reservedUrl.hostname.toLowerCase()}:${reservedUrl.port}`
    ensure(
      reservedOrigin !== origin,
      `${field} reuses a retained or remote endpoint.`
    )
  }
  return { value, origin }
}

function validateInput(input) {
  exactKeys(input, INPUT_KEYS, 'input')
  canonicalPath(input.primaryCheckoutPath, 'primaryCheckoutPath')
  canonicalPath(input.runtimeCheckoutPath, 'runtimeCheckoutPath')
  strings(input.retainedCheckoutPaths, 'retainedCheckoutPaths')
  input.retainedCheckoutPaths.forEach((path, index) => {
    canonicalPath(path, `retainedCheckoutPaths[${index}]`)
  })
  ensure(
    input.runtimeCheckoutPath !== input.primaryCheckoutPath,
    'runtime checkout must not be the primary checkout.'
  )
  disjoint(
    [input.runtimeCheckoutPath, ...input.retainedCheckoutPaths],
    'checkout paths'
  )

  strings(input.retainedProjectIdentities, 'retainedProjectIdentities')
  input.retainedProjectIdentities.forEach((value, index) => {
    identifier(value, `retainedProjectIdentities[${index}]`)
  })
  strings(input.retainedMutableVolumeNames, 'retainedMutableVolumeNames')
  strings(input.retainedEndpointOrigins, 'retainedEndpointOrigins')
  safeProjectIdentity(input.projectIdentity, input.retainedProjectIdentities)

  exactKeys(input.providerRoots, PROVIDER_NAMES, 'providerRoots')
  exactKeys(input.providerObservations, PROVIDER_NAMES, 'providerObservations')
  const providers = {}
  const providerPaths = []
  for (const name of PROVIDER_NAMES) {
    const root = input.providerRoots[name]
    const observation = input.providerObservations[name]
    exactKeys(root, ['path', 'revision'], `providerRoots.${name}`)
    exactKeys(
      observation,
      ['path', 'revision', 'clean'],
      `providerObservations.${name}`
    )
    canonicalPath(root.path, `providerRoots.${name}.path`)
    revision(root.revision, `providerRoots.${name}.revision`)
    ensure(
      observation.clean === true,
      `providerObservations.${name} must be clean.`
    )
    ensure(
      observation.path === root.path && observation.revision === root.revision,
      `providerObservations.${name} does not match its root.`
    )
    providers[name] = { path: root.path, revision: root.revision }
    providerPaths.push(root.path)
  }
  disjoint(
    [
      input.runtimeCheckoutPath,
      ...input.retainedCheckoutPaths,
      ...providerPaths,
    ],
    'checkout and provider paths'
  )

  exactKeys(input.endpoints, ENDPOINT_NAMES, 'endpoints')
  const endpoints = {}
  const origins = []
  for (const name of ENDPOINT_NAMES) {
    const parsed = localEndpoint(
      input.endpoints[name],
      `endpoints.${name}`,
      name,
      input.retainedEndpointOrigins
    )
    endpoints[name] = parsed.value
    origins.push(parsed.origin)
  }
  ensure(
    new Set(origins).size === origins.length,
    'endpoints must use unique local origins.'
  )
  return {
    primaryCheckoutPath: input.primaryCheckoutPath,
    runtimeCheckoutPath: input.runtimeCheckoutPath,
    retainedCheckoutPaths: [...input.retainedCheckoutPaths],
    projectIdentity: input.projectIdentity,
    retainedProjectIdentities: [...input.retainedProjectIdentities],
    retainedMutableVolumeNames: [...input.retainedMutableVolumeNames],
    retainedEndpointOrigins: [...input.retainedEndpointOrigins],
    providers,
    endpoints,
  }
}

function kebab(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function deriveState(normalized) {
  const root = `${normalized.runtimeCheckoutPath}/.local-kb/state`
  return Object.fromEntries(
    Object.entries(STATE_OWNERS).map(([name, owner]) => {
      const suffix = kebab(name)
      return [
        name,
        {
          owner,
          volumeName: `${normalized.projectIdentity}-${suffix}-volume`,
          logicalName: `${normalized.projectIdentity}-${suffix}`,
          path: `${root}/${suffix}`,
          generated: true,
        },
      ]
    })
  )
}

function deriveGraph(endpoints, state) {
  const nodes = Object.fromEntries(
    GRAPH_NODES.map(
      ([name, kind, dependencies, endpointName, stateKey, provider]) => [
        name,
        {
          name,
          kind,
          dependsOn: [...dependencies],
          endpoint: endpointName ? endpoints[endpointName].url : null,
          stateKey,
          owner: stateKey ? state[stateKey].owner : null,
          provider,
          deployment: name === 'documentProcessing' ? 'unqualified' : 'local',
        },
      ]
    )
  )
  return { kind: 'local-dependency-graph', rendered: false, nodes }
}

function buildConfig(normalized) {
  const mutableState = deriveState(normalized)
  for (const state of Object.values(mutableState)) {
    safeDestination(
      state.volumeName,
      'volumeName',
      normalized.projectIdentity,
      normalized.retainedMutableVolumeNames
    )
  }
  const sourceMounts = Object.fromEntries(
    PROVIDER_NAMES.map((name) => [
      name,
      {
        name,
        sourcePath: normalized.providers[name].path,
        targetPath:
          normalized.runtimeCheckoutPath +
          '/.local-kb/providers/' +
          kebab(name),
        revision: normalized.providers[name].revision,
        readOnly: true,
      },
    ])
  )
  const providers = Object.fromEntries(
    PROVIDER_NAMES.map((name) => [
      name,
      {
        identity: name,
        sourcePath: normalized.providers[name].path,
        revision: normalized.providers[name].revision,
        observedPath: normalized.providers[name].path,
        observedRevision: normalized.providers[name].revision,
        clean: true,
        stateKeys: [...PROVIDER_STATE_KEYS[name]],
        sourceMount: sourceMounts[name],
      },
    ])
  )
  const endpoints = Object.fromEntries(
    ENDPOINT_NAMES.map((name) => [
      name,
      { url: normalized.endpoints[name], localOnly: true },
    ])
  )

  return {
    schemaVersion: 'isolated-local-kb.validation.v1',
    model: 'validation-only',
    deployment: {
      model: 'validation-only',
      rendered: false,
      executable: false,
      composeProjectIdentity: normalized.projectIdentity,
      sourceMountsReadOnly: true,
      generatedStateIsolated: true,
    },
    project: {
      identity: normalized.projectIdentity,
      primaryCheckoutPath: normalized.primaryCheckoutPath,
      runtimeCheckoutPath: normalized.runtimeCheckoutPath,
      retainedCheckoutPaths: [...normalized.retainedCheckoutPaths],
    },
    reserved: {
      projectIdentities: [...normalized.retainedProjectIdentities],
      mutableVolumeNames: [...normalized.retainedMutableVolumeNames],
      endpointOrigins: [...normalized.retainedEndpointOrigins],
    },
    providers,
    roots: PROVIDER_NAMES.map((name) => ({
      name,
      path: providers[name].sourcePath,
      revision: providers[name].revision,
      readOnly: true,
    })),
    sourceMounts,
    health: HEALTH_NAMES.map((name) => ({ name, url: endpoints[name].url })),
    endpoints,
    mutableState,
    dependencyGraph: deriveGraph(endpoints, mutableState),
    capabilities: {
      documentProcessing: {
        provider: 'docProcessing',
        stateKey: 'documentProcessing',
        status: 'unqualified',
        qualified: false,
        endpoint: null,
        healthEndpoint: endpoints.docProcessing.url,
        requiredEnvironment: [...DOC_PROCESSING_ENVIRONMENT],
        noRemoteFallback: true,
      },
    },
    integrationRequirements: [
      {
        id: 'rendered-local-deployment',
        status: 'required',
        description:
          'Render this validation model into concrete Compose/devrouter services before execution.',
      },
    ],
  }
}

// Validate persisted configuration through the same derivation as fresh input.
// This also rejects altered graph edges, mounts and capability claims.
function validateResolvedConfig(config) {
  exactKeys(config, CONFIG_KEYS, 'config')
  object(config.project, 'config.project')
  object(config.reserved, 'config.reserved')
  exactKeys(config.providers, PROVIDER_NAMES, 'config.providers')
  exactKeys(config.endpoints, ENDPOINT_NAMES, 'config.endpoints')
  const input = {
    primaryCheckoutPath: config.project.primaryCheckoutPath,
    runtimeCheckoutPath: config.project.runtimeCheckoutPath,
    retainedCheckoutPaths: config.project.retainedCheckoutPaths,
    projectIdentity: config.project.identity,
    retainedProjectIdentities: config.reserved.projectIdentities,
    retainedMutableVolumeNames: config.reserved.mutableVolumeNames,
    retainedEndpointOrigins: config.reserved.endpointOrigins,
    providerRoots: Object.fromEntries(
      PROVIDER_NAMES.map((name) => [
        name,
        {
          path: config.providers[name].sourcePath,
          revision: config.providers[name].revision,
        },
      ])
    ),
    providerObservations: Object.fromEntries(
      PROVIDER_NAMES.map((name) => [
        name,
        {
          path: config.providers[name].observedPath,
          revision: config.providers[name].observedRevision,
          clean: config.providers[name].clean,
        },
      ])
    ),
    endpoints: Object.fromEntries(
      ENDPOINT_NAMES.map((name) => [name, config.endpoints[name].url])
    ),
  }
  ensure(
    isDeepStrictEqual(config, resolveIsolatedConfig(input)),
    'config differs from its validated isolation contract.'
  )
  return true
}

export function resolveIsolatedConfig(input) {
  return buildConfig(validateInput(input))
}

export function validateIsolatedConfig(config) {
  return validateResolvedConfig(config)
}
