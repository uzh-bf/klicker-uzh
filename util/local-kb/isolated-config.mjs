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
 *   ports: explicit provider and consumer port allocations,
 *   images: { api, worker }: immutable ingestion image references,
 * }
 *
 * The returned object is a validation model, not rendered Compose/devrouter
 * configuration. No filesystem, Git, network, provider, or secret access
 * occurs here. Roots and health are arrays for plan and inspection
 * consumers; providers, sourceMounts, and mutableState are keyed lifecycle
 * data. Launcher bindings derive from project, providers, and endpoints.
 * Provider state roots belong to the provider launchers; this model does not
 * invent their internal volume names or prove runtime capabilities.
 */

const PROVIDER_STATE_KEYS = {
  ingestion: ['ingestionOutbox', 'milvus', 'milvusMetadata', 'objectBacking'],
  scraping: ['scraperCache'],
  retrieval: ['docQuery'],
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
  milvus: 'ingestion',
  milvusMetadata: 'ingestion',
  objectBacking: 'ingestion',
  callback: 'ingestion',
  docQuery: 'retrieval',
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
    ['ingestionBacking', 'ingestionOutbox'],
    'ingestion',
    null,
    'ingestion',
  ],
  [
    'ingestionWorkers',
    'provider-workers',
    ['ingestionApi', 'ingestionBacking', 'scraping', 'documentProcessing'],
    null,
    null,
    'ingestion',
  ],
  [
    'ingestionOutbox',
    'provider-state',
    ['ingestionBacking'],
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
    ['scrapingBacking', 'scraperCache', 'crawl4ai'],
    'scraping',
    null,
    'scraping',
  ],
  ['scraperCache', 'provider-state', [], null, 'scraperCache', 'scraping'],
  ['crawl4ai', 'service', ['scrapingBacking'], 'crawl4ai', null, 'scraping'],
  ['ingestionBacking', 'provider-backing', [], null, null, 'ingestion'],
  ['scrapingBacking', 'provider-backing', [], null, null, 'scraping'],
  ['docProcessingBacking', 'provider-backing', [], null, null, 'docProcessing'],
  [
    'milvus',
    'service',
    ['objectBacking', 'milvusMetadata'],
    'milvus',
    'milvus',
    'ingestion',
  ],
  ['milvusMetadata', 'state-service', [], null, 'milvusMetadata', 'ingestion'],
  [
    'objectBacking',
    'state-service',
    [],
    'objectBacking',
    'objectBacking',
    'ingestion',
  ],
  [
    'docQuery',
    'provider-service',
    ['milvus'],
    'retrieval',
    'docQuery',
    'retrieval',
  ],
  [
    'documentProcessing',
    'provider-service',
    ['docProcessingBacking'],
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
  'ports',
  'images',
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
  'bindings',
]
const IDENTIFIER = /^[a-z][a-z0-9-]{2,63}$/
const REVISION = /^[0-9a-f]{40}$/i
const VOLUME_NAME = /^[a-z][a-z0-9-]{2,127}$/
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

// Immutable port contract for the isolated local-KB provider stack. Every port
// is supplied by the caller; nothing is allocated here. A retained endpoint at
// any protocol or host reserves its numeric port so a fresh stack cannot bind
// an address an existing stack already owns.
const PROVIDER_PORT_GROUPS = {
  klicker: ['backend', 'model', 'blob'],
  ingestion: [
    'api',
    'dispatcher',
    'hatchetHttp',
    'hatchetGrpc',
    'postgres',
    'azurite',
    'milvus',
    'milvusHealth',
    'milvusAttu',
  ],
  docProcessing: ['api', 'postgres', 'hatchetHttp', 'hatchetGrpc'],
  scraping: ['api', 'crawl4ai', 'postgres'],
  retrieval: ['api'],
}
const PROVIDER_PORT_GROUPS_KEYS = Object.keys(PROVIDER_PORT_GROUPS)
const INSTANCE = /^[a-z0-9][a-z0-9-]*$/
const INSTANCE_MAX_LENGTH = 48

function instanceIdentifier(value) {
  string(value, 'instance')
  ensure(
    value.length <= INSTANCE_MAX_LENGTH,
    'instance must be at most 48 characters.'
  )
  ensure(
    INSTANCE.test(value),
    'instance must be a lowercase [a-z0-9][a-z0-9-]* identifier.'
  )
}

function portNumber(value, field) {
  ensure(
    Number.isInteger(value) && value >= 1024 && value <= 65535,
    `${field} must be an integer between 1024 and 65535.`
  )
  return value
}

function endpointPortNumber(value) {
  let endpoint
  try {
    endpoint = new URL(value)
  } catch {
    invalid('retainedEndpointOrigins contains an invalid URL.')
  }
  ensure(
    LOCAL_PROTOCOLS.has(endpoint.protocol) && endpoint.hostname,
    'retainedEndpointOrigins contains an unsupported endpoint.'
  )
  return endpoint.port ? Number(endpoint.port) : null
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

  const bindings = resolveProviderBindings(
    input.ports,
    input.projectIdentity,
    input.retainedEndpointOrigins
  )
  exactKeys(input.images, ['api', 'worker'], 'images')
  for (const name of ['api', 'worker']) {
    ensure(
      typeof input.images[name] === 'string' &&
        /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*@sha256:[a-f0-9]{64}$/.test(
          input.images[name]
        ),
      `images.${name} must be an immutable image reference.`
    )
  }
  bindings.images = { ...input.images }
  const host = bindings.hostBases
  const endpoints = {
    klicker: `${host.backend}/graphql`,
    postgres: 'postgresql://postgres:5432/klicker',
    hatchet: 'http://hatchet:8888/api/v1/meta',
    redis: 'redis://redis:6379/0',
    blob: host.blob,
    ingestion: `${host.ingestion}/ready`,
    dispatcher: `${host.dispatcher}/health`,
    callback: `${host.backend}/health`,
    scraping: `${host.scraping}/ready`,
    crawl4ai: `http://127.0.0.1:${bindings.ports.scraping.crawl4ai}/health`,
    milvus: `http://127.0.0.1:${bindings.ports.ingestion.milvusHealth}/healthz`,
    objectBacking: 'http://minio:9000/minio/health/live',
    retrieval: host.retrieval.replace(/\/mcp$/, '/health'),
    docProcessing: `${host.docProcessing}/health`,
  }
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
    bindings,
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
      if (PROVIDER_NAMES.includes(owner)) {
        return [
          name,
          {
            owner,
            path: `${root}/${owner}`,
            managedBy: 'provider-launcher',
            generated: true,
          },
        ]
      }
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
    if (state.managedBy === 'provider-launcher') continue
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
    schemaVersion: 'isolated-local-kb.provider-config.v2',
    bindings: normalized.bindings,
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
        id: 'provider-runtime-qualification',
        status: 'required',
        description:
          'Qualify the provider launchers and their installed local dependencies before claiming runtime readiness.',
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
    ports: config.bindings?.ports,
    images: config.bindings?.images,
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

/**
 * Pure input:
 * {
 *   ports: { klicker: { backend, model, blob },
 *            ingestion: { api, dispatcher, hatchetHttp, hatchetGrpc, postgres,
 *                         azurite, milvus, milvusHealth, milvusAttu },
 *            docProcessing: { api, postgres, hatchetHttp, hatchetGrpc },
 *            scraping: { api, crawl4ai, postgres },
 *            retrieval: { api } },
 *   instance: lowercase identifier,
 *   retainedEndpointOrigins: [url],
 * }
 *
 * The result is a host/container binding model, not rendered Compose or
 * devrouter configuration. Ports are returned unchanged; callers allocate all
 * of them. No filesystem, Git, network, provider, or secret access occurs here.
 */
export function resolveProviderBindings(
  ports,
  instance,
  retainedEndpointOrigins = []
) {
  instanceIdentifier(instance)
  exactKeys(ports, PROVIDER_PORT_GROUPS_KEYS, 'ports')
  const resolved = {}
  const selected = new Set()
  for (const [group, names] of Object.entries(PROVIDER_PORT_GROUPS)) {
    exactKeys(ports[group], names, `ports.${group}`)
    resolved[group] = {}
    for (const name of names) {
      const value = portNumber(ports[group][name], `ports.${group}.${name}`)
      ensure(
        !selected.has(value),
        `ports.${group}.${name} duplicates another selected port.`
      )
      selected.add(value)
      resolved[group][name] = value
    }
  }

  strings(retainedEndpointOrigins, 'retainedEndpointOrigins')
  const retained = new Set()
  for (const origin of retainedEndpointOrigins) {
    const port = endpointPortNumber(origin)
    if (port !== null) retained.add(port)
  }
  for (const [group, names] of Object.entries(PROVIDER_PORT_GROUPS)) {
    for (const name of names) {
      ensure(
        !retained.has(resolved[group][name]),
        `ports.${group}.${name} reuses a retained endpoint port.`
      )
    }
  }

  const suffix = instance.replaceAll('-', '_')
  const host = (port) => `http://127.0.0.1:${port}`
  const container = (port) => `http://host.docker.internal:${port}`

  return {
    schemaVersion: 'isolated-local-kb.provider-bindings.v1',
    instance,
    ports: resolved,
    collection: `local_cli_ingestion_${suffix}`,
    stateSchema: `ingestion_state_${suffix}`,
    hostBases: {
      backend: host(resolved.klicker.backend),
      model: `${host(resolved.klicker.model)}/v1`,
      blob: `${host(resolved.klicker.blob)}/klickerdev`,
      ingestion: host(resolved.ingestion.api),
      dispatcher: host(resolved.ingestion.dispatcher),
      scraping: host(resolved.scraping.api),
      docProcessing: host(resolved.docProcessing.api),
      milvus: host(resolved.ingestion.milvus),
      retrieval: `${host(resolved.retrieval.api)}/mcp`,
    },
    containerBases: {
      backend: container(resolved.klicker.backend),
      model: `${container(resolved.klicker.model)}/v1`,
      blob: `${container(resolved.klicker.blob)}/klickerdev`,
      ingestion: container(resolved.ingestion.api),
      dispatcher: container(resolved.ingestion.dispatcher),
      scraping: container(resolved.scraping.api),
      docProcessing: container(resolved.docProcessing.api),
      milvus: 'http://milvus-standalone:19530',
      retrieval: `${container(resolved.retrieval.api)}/mcp`,
    },
  }
}

export function validateIsolatedConfig(config) {
  return validateResolvedConfig(config)
}
