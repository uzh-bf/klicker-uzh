import { execFileSync } from 'node:child_process'
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, readdir, realpath, unlink } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { renderBackingCompose } from './backing-compose.mjs'
import {
  inspectUnusedComposeProject,
  requireLocalAiEnvironment,
  runLocalDocker,
  runLocalManaged,
} from './docker-preflight.mjs'
import { validateIsolatedConfig } from './isolated-config.mjs'
import {
  localCredentialNames,
  localRetrievalScope,
  renderLocalRetrievalConfiguration,
  renderProviderLocalConfiguration,
} from './local-configuration.mjs'
import {
  renderManagedConfiguration,
  renderProviderRouting,
} from './managed-configuration.mjs'
import {
  observeProviderLauncher,
  observeProviderLaunchers,
  providerCommands,
  runProviderCommand,
} from './provider-commands.mjs'

async function absent(path) {
  try {
    await lstat(path)
    return false
  } catch (error) {
    if (error.code === 'ENOENT') return true
    throw error
  }
}

function revisionAt(checkout, args) {
  return execFileSync(
    'git',
    ['-c', 'core.fsmonitor=false', '-C', checkout, ...args],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
      env: { PATH: process.env.PATH, GIT_OPTIONAL_LOCKS: '0' },
    }
  ).trim()
}

function managedReplacementBytes(config, inputs) {
  const rendered = renderManagedConfiguration(config, {
    devcontainer: JSON.parse(inputs[0]),
    compose: parse(inputs[1]),
    devrouter: parse(inputs[3]),
  })
  rendered.devcontainer.dockerComposeFile = [
    'docker-compose.yml',
    'docker-compose.devrouter.yml',
  ]
  // Devrouter appends this standard overlay for linked worktrees. It must
  // not reintroduce the ordinary backing services or host port bindings.
  return [
    rendered.devcontainer,
    rendered.compose,
    { services: {} },
    rendered.devrouter,
  ].map((value) => `${JSON.stringify(value, null, 2)}\n`)
}

// The executor and retained application are separate immutable identities.
// Only the managed configuration transformation may differ in the candidate.
export async function verifyContinuationSources(
  config,
  candidate,
  executor,
  allowLegacyProfile = false,
  git = revisionAt
) {
  const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
  const checkout = config.project.runtimeCheckoutPath
  const paths = [
    '.devcontainer/devcontainer.json',
    '.devcontainer/docker-compose.yml',
    '.devcontainer/docker-compose.devrouter.yml',
    '.devrouter.yml',
  ]
  if (
    !/^[a-f0-9]{40}$/.test(executor) ||
    git(root, ['rev-parse', 'HEAD']) !== executor ||
    git(root, ['status', '--porcelain', '--untracked-files=normal']) ||
    git(checkout, ['rev-parse', 'HEAD']) !== candidate ||
    git(checkout, ['rev-parse', '--abbrev-ref', 'HEAD']) !== 'HEAD' ||
    git(checkout, ['rev-parse', '--show-toplevel']) !== checkout ||
    git(checkout, ['ls-files', '--others', '--exclude-standard']) ||
    !git(checkout, ['rev-parse', '--git-dir']).includes('/worktrees/') ||
    git(checkout, [
      'diff',
      '--name-only',
      candidate,
      '--',
      '.',
      ...paths.map((path) => `:(exclude)${path}`),
    ])
  )
    throw new Error(
      'Continuation requires verified executor and candidate sources.'
    )
  const inputs = paths.map((path) =>
    readCandidateFile(checkout, candidate, path)
  )
  const expected = managedReplacementBytes(config, inputs)
  let profileRepair
  for (const [index, path] of paths.entries()) {
    const handle = await open(
      join(checkout, path),
      constants.O_RDONLY | constants.O_NOFOLLOW
    )
    try {
      const metadata = await handle.stat()
      const actual = await handle.readFile('utf8')
      if (index === 3 && allowLegacyProfile && actual !== expected[index]) {
        const legacy = JSON.parse(expected[index])
        legacy.profiles['local-kb-setup'] = {
          apps: [],
          devcontainerServices: [],
          processes: [],
        }
        if (actual === `${JSON.stringify(legacy, null, 2)}\n`)
          profileRepair = {
            path: join(checkout, path),
            previous: actual,
            next: expected[index],
          }
      }
      if (
        !metadata.isFile() ||
        metadata.uid !== process.getuid() ||
        metadata.nlink !== 1 ||
        (actual !== expected[index] && !(index === 3 && profileRepair))
      )
        throw new Error('Retained managed configuration has changed.')
    } finally {
      await handle.close()
    }
  }
  return profileRepair
}

async function requireUnusedProvider(config, name, context, runDocker) {
  const state = join(
    config.project.runtimeCheckoutPath,
    '.local-kb/state',
    name
  )
  if (!(await absent(state)))
    throw new Error(
      `Provider ${name} has retained state; setup is not permitted.`
    )
  if (name === 'ingestion') {
    await requireAbsentComposeResources(
      runDocker,
      context,
      ingestionComposeProject(config, state),
      'Untouched ingestion provider has existing Docker resources.'
    )
  } else if (name === 'retrieval') {
    await new Promise((resolve, reject) => {
      const socket = createConnection({
        host: '127.0.0.1',
        port: config.bindings.ports.retrieval.api,
      })
      socket.setTimeout(2000)
      socket.once('connect', () => {
        socket.destroy()
        reject(new Error('Retrieval listener is already occupied.'))
      })
      socket.once('timeout', () => {
        socket.destroy()
        reject(new Error('Retrieval listener state is unknown.'))
      })
      socket.once('error', (error) =>
        error.code === 'ECONNREFUSED'
          ? resolve()
          : reject(new Error('Retrieval listener state is unknown.'))
      )
    })
  } else
    throw new Error(
      'Only untouched ingestion and retrieval stages may be initialized.'
    )
}

// The provider derives its Compose project from the source root and state
// directory; only that exact value can observe the provider's own resources.
function ingestionComposeProject(config, state) {
  const suffix = createHash('sha256')
    .update(`${config.providers.ingestion.sourcePath}:${state}`)
    .digest('hex')
    .slice(0, 12)
  return `ingestion-provider-${config.project.identity}-${suffix}`
}

// Provider-owned containers, networks and volumes all carry the Compose
// project label; any listed resource means setup already had an effect.
async function requireAbsentComposeResources(
  runDocker,
  context,
  project,
  message
) {
  for (const resource of ['container', 'network', 'volume']) {
    if (
      (
        await runDocker([
          '--context',
          context,
          resource,
          'ls',
          ...(resource === 'container' ? ['--all'] : []),
          '--quiet',
          '--filter',
          `label=com.docker.compose.project=${project}`,
        ])
      ).trim()
    )
      throw new Error(message)
  }
}

// A bound port may be held by a retained provider start its own stop path did
// not remove. Occupancy is reported, never attributed to an owner.
async function occupiedLocalPort(port) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port })
    socket.setTimeout(2000)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      reject(new Error('Local port occupancy is unknown.'))
    })
    socket.once('error', (error) =>
      error.code === 'ECONNREFUSED'
        ? resolve(false)
        : reject(new Error('Local port occupancy is unknown.'))
    )
  })
}

function sameEntries(actual, expected) {
  if (typeof actual !== 'object' || actual === null) return false
  const keys = Object.keys(expected)
  return (
    Object.keys(actual).length === keys.length &&
    keys.every((key) => actual[key] === expected[key])
  )
}

const providerManifestName = '.provider-local-launcher.json'

// The provider's first setup step writes its manifest and Compose record and
// then fails while preparing dependencies. Its state directory therefore holds
// no credential file and no generated project configuration of its own, which
// would appear as additional entries.
const pendingIngestionInventory = [
  providerManifestName,
  'compose-project',
  'project-configs',
]
const providerDigest = /^[a-f0-9]{64}$/

// A recovery candidate is the retained ingestion attempt that stopped before
// any credential, container or listener existed. Every other retained shape is
// partial progress and must not be resumed.
async function verifyPendingIngestion(
  config,
  directory,
  context,
  observed,
  runDocker,
  portOccupied
) {
  const rejected = () =>
    new Error('Retained ingestion state is not an untouched preparation.')
  if (!observed.pending || !observed.effectsAbsent) throw rejected()
  const state = join(directory, 'state', 'ingestion')
  if (
    JSON.stringify((await readdir(state)).sort()) !==
    JSON.stringify(pendingIngestionInventory)
  )
    throw rejected()
  const configDirectory = join(state, 'project-configs')
  if (!(await lstat(configDirectory)).isDirectory()) throw rejected()
  const project = ingestionComposeProject(config, state)
  let manifest
  let record
  try {
    manifest = await readOwned(join(state, providerManifestName))
    const handle = await open(
      join(state, 'compose-project'),
      constants.O_RDONLY | constants.O_NOFOLLOW
    )
    try {
      const metadata = await handle.stat()
      if (!metadata.isFile() || metadata.uid !== process.getuid())
        throw new Error()
      record = (await handle.readFile('utf8')).trim()
    } finally {
      await handle.close()
    }
  } catch {
    throw rejected()
  }
  const runtimeRoot = join(config.project.runtimeCheckoutPath, '.local-kb')
  // The retained manifest binds the original provider, source and workload
  // pins. Recovering it must never rebind any of them.
  const workload = {
    INGESTION_LOCAL_WORKER_IMAGE: config.bindings.images.worker,
    INGESTION_LOCAL_API_IMAGE: config.bindings.images.api,
    INGESTION_LOCAL_RUNTIME_ENV_FILE: join(runtimeRoot, 'ingestion-worker.env'),
    INGESTION_LOCAL_API_ENV_FILE: join(runtimeRoot, 'ingestion-api.env'),
    INGESTION_LOCAL_PRODUCER_REGISTRY_DIR: join(
      runtimeRoot,
      'producer-registry'
    ),
    INGESTION_LOCAL_API_PORT: String(config.bindings.ports.ingestion.api),
    INGESTION_LOCAL_DISPATCHER_PORT: String(
      config.bindings.ports.ingestion.dispatcher
    ),
  }
  const ports = {
    hatchet_http: config.bindings.ports.ingestion.hatchetHttp,
    hatchet_grpc: config.bindings.ports.ingestion.hatchetGrpc,
    pgvector: config.bindings.ports.ingestion.postgres,
    azurite: config.bindings.ports.ingestion.azurite,
    milvus: config.bindings.ports.ingestion.milvus,
    milvus_health: config.bindings.ports.ingestion.milvusHealth,
    milvus_attu: config.bindings.ports.ingestion.milvusAttu,
  }
  const runtime = manifest?.runtime
  if (
    manifest?.version !== 1 ||
    manifest.owner !== 'provider-local-launcher' ||
    manifest.source_root !== config.providers.ingestion.sourcePath ||
    manifest.instance !== config.project.identity ||
    manifest.state_dir !== state ||
    manifest.config_dir !== configDirectory ||
    manifest.compose_project !== project ||
    manifest.source_revision !== config.providers.ingestion.revision ||
    record !== project ||
    !providerDigest.test(manifest.project_configs_fingerprint ?? '') ||
    typeof runtime !== 'object' ||
    runtime === null ||
    !sameEntries(runtime.ports, ports) ||
    !providerDigest.test(runtime.state_dsn_sha256 ?? '') ||
    !providerDigest.test(runtime.service_urls_sha256 ?? '') ||
    typeof manifest.workload !== 'object' ||
    manifest.workload === null ||
    !sameEntries(manifest.workload.configuration, workload) ||
    !providerDigest.test(manifest.workload.fingerprint ?? '')
  )
    throw rejected()
  await requireAbsentComposeResources(
    runDocker,
    context,
    project,
    'Retained ingestion state still owns Docker resources.'
  )
  for (const port of Object.values(config.bindings.ports.ingestion))
    if (await portOccupied(port))
      throw new Error('A retained ingestion port is still occupied.')
}

const ingestionResumeRootEntries = [
  'claim.json',
  'resume-after-profile',
  'setup-profile-intent.json',
]
const ingestionResumeChildEntries = [
  'bootstrap-intent.json',
  'claim.json',
  'docProcessing-reconciliation.json',
  'ingestion-intent.json',
]

// Only the exact retained profile-repair child authorizes one sibling
// ingestion attempt. Its own claim must link to the original root claim, and
// every receipt must record the child executor, so a predecessor cannot be
// confused with a foreign or rebuilt attempt.
async function requireIngestionResumePrefix(
  attempt,
  { claim, candidate, context, resumeIngestionExecutor }
) {
  const rejected = () =>
    new Error('Ingestion resume does not match the retained prefix.')
  try {
    if (
      JSON.stringify((await readdir(attempt)).sort()) !==
      JSON.stringify(ingestionResumeRootEntries)
    )
      throw new Error()
    const child = join(attempt, 'resume-after-profile')
    if (
      JSON.stringify((await readdir(child)).sort()) !==
      JSON.stringify(ingestionResumeChildEntries)
    )
      throw new Error()
    const childClaim = await readOwned(join(child, 'claim.json'))
    const childExecutor = childClaim?.executor
    // The child records the original root executor, which must still own the
    // retained root claim and its profile intent.
    const rootExecutor = childClaim?.resumeExecutor
    if (
      !/^[a-f0-9]{40}$/.test(childExecutor ?? '') ||
      !/^[a-f0-9]{40}$/.test(rootExecutor ?? '') ||
      childExecutor !== resumeIngestionExecutor ||
      JSON.stringify(childClaim) !==
        JSON.stringify({
          ...claim,
          executor: childExecutor,
          context,
          resumeExecutor: rootExecutor,
        })
    )
      throw new Error()
    const rootClaim = await readOwned(join(attempt, 'claim.json'))
    if (
      JSON.stringify(rootClaim) !==
        JSON.stringify({ ...claim, executor: rootExecutor, context }) ||
      JSON.stringify(
        await readOwned(join(attempt, 'setup-profile-intent.json'))
      ) !== JSON.stringify({ candidate, executor: rootExecutor })
    )
      throw new Error()
    for (const [name, receipt] of [
      ['bootstrap-intent.json', { candidate, executor: childExecutor }],
      [
        'docProcessing-reconciliation.json',
        { candidate, executor: childExecutor, prepared: true },
      ],
      ['ingestion-intent.json', { candidate, executor: childExecutor }],
    ])
      if (
        JSON.stringify(await readOwned(join(child, name))) !==
        JSON.stringify(receipt)
      )
        throw new Error()
  } catch {
    throw rejected()
  }
}

// Explicit recovery never retries an ambiguous stage or recreates credentials.
export async function continuePreparation(
  config,
  candidate,
  executor,
  {
    run = runProviderCommand,
    runDocker = runLocalDocker,
    runManaged = runLocalManaged,
    observeBacking = observeOwnedProviders,
    verifySources = verifyContinuationSources,
    unusedProvider = requireUnusedProvider,
    initializeApplication = initializeManagedApplication,
    resumeExecutor,
    resumeIngestionExecutor,
    portOccupied = occupiedLocalPort,
  } = {}
) {
  if (resumeExecutor !== undefined && resumeIngestionExecutor !== undefined)
    throw new Error('Continuation accepts one recovery executor.')
  requireLocalAiEnvironment(config)
  const { directory, claim } = await verifyClaim(config, candidate)
  const profileRepair = await verifySources(config, candidate, executor, true)
  const storage = await readOwned(
    join(directory, 'storage-setup/complete.json')
  )
  const installation = await readOwned(
    join(directory, 'managed-installation/complete.json')
  )
  const context = (await runDocker(['context', 'show'])).trim()
  const endpoint = (
    await runDocker([
      'context',
      'inspect',
      context,
      '--format',
      '{{.Endpoints.docker.Host}}',
    ])
  ).trim()
  if (
    !storage.initialized ||
    storage.context !== context ||
    installation.candidateRevision !== candidate ||
    !endpoint.startsWith('unix:///') ||
    /[\r\n]/.test(endpoint)
  )
    throw new Error(
      'Continuation prerequisites do not match local prepared storage.'
    )
  const managed = JSON.parse(
    await runManaged([
      'status',
      '--repo',
      config.project.runtimeCheckoutPath,
      '--json',
    ])
  )
  if (
    managed.dockerContext !== context ||
    managed.repo?.path !== config.project.runtimeCheckoutPath ||
    (managed.repo?.valid !== true && !profileRepair)
  )
    throw new Error(
      'Continuation requires valid managed configuration and an unused managed runtime.'
    )
  const verifyUnusedManaged = async () => {
    const inventory = JSON.parse(
      await runManaged([
        'workspace',
        'ls',
        '--repo',
        config.project.runtimeCheckoutPath,
        '--json',
      ])
    )
    const rows = Array.isArray(inventory)
      ? inventory.filter(
          (row) => row.worktreePath === config.project.runtimeCheckoutPath
        )
      : []
    if (
      rows.length !== 1 ||
      rows[0].devpodStatus !== 'absent' ||
      rows[0].routeCount !== 0
    )
      throw new Error(
        'Managed runtime allocation must be absent with zero routes.'
      )
    for (const label of [
      'devcontainer.local_folder',
      'devpod.workspace.source',
    ]) {
      if (
        (
          await runDocker([
            '--context',
            context,
            'container',
            'ls',
            '--all',
            '--quiet',
            '--filter',
            `label=${label}=${config.project.runtimeCheckoutPath}`,
          ])
        ).trim()
      )
        throw new Error('Retained application runtime already exists.')
    }
  }
  await verifyUnusedManaged()
  // Both recovery modes resume an attempt that stopped while the original
  // bootstrap containers were already shut down.
  const recovered = [resumeExecutor, resumeIngestionExecutor].some(
    (value) => value !== undefined
  )
  const verifyBacking = async () => {
    const backing = await observeBacking(
      config,
      { directory, context },
      runDocker
    )
    for (const name of ['postgres', 'hatchet']) {
      const rows = backing.filter(({ service }) => service === name)
      if (
        rows.length !== 1 ||
        !(recovered ? ['exited'] : ['running', 'exited']).includes(
          rows[0].state
        )
      )
        throw new Error(
          'Continuation requires the original owned bootstrap containers.'
        )
    }
  }
  await verifyBacking()
  const composition = await readOwned(join(directory, 'providers.compose.json'))
  if (
    JSON.stringify(composition) !==
    JSON.stringify(renderConsumerBacking(config))
  )
    throw new Error('Retained provider composition has changed.')
  if (
    JSON.stringify(
      await readOwned(join(directory, 'bootstrap.compose.json'))
    ) !== JSON.stringify(renderConsumerBacking(config))
  )
    throw new Error('Retained bootstrap composition has changed.')
  await requirePrivateDirectory(
    join(directory, 'provider-setup'),
    'Provider attempt must be private.'
  )
  await requirePrivateDirectory(
    join(directory, 'state'),
    'Provider state root must be private.'
  )
  for (const path of [
    'prepared.json',
    'application-setup',
    'provider-setup/complete.json',
    'infrastructure-operation',
  ])
    if (!(await absent(join(directory, path))))
      throw new Error(
        'Continuation requires an unfinished provider prefix and untouched application.'
      )
  const commands = providerCommands(config)
  const retrieval = await readOwned(
    join(directory, 'retrieval-environment.json')
  )
  const classify = async (name) => {
    const missing = await absent(
      join(directory, 'provider-setup', `${name}.json`)
    )
    if (missing && (await absent(join(directory, 'state', name)))) {
      await unusedProvider(config, name, context, runDocker)
      return 'untouched'
    }
    await requirePrivateDirectory(
      join(directory, 'state', name),
      'Prepared provider state must be private.'
    )
    const observed = await observeProviderLauncher(
      config,
      name,
      run,
      { DOCKER_CONTEXT: context },
      retrieval
    )
    if (resumeIngestionExecutor !== undefined && name === 'ingestion') {
      if (!missing)
        throw new Error('Retained ingestion completion is not resumable.')
      await verifyPendingIngestion(
        config,
        directory,
        context,
        observed,
        runDocker,
        portOccupied
      )
      return 'pending-ingestion'
    }
    if (!observed.prepared || !observed.stopped)
      throw new Error(`Provider ${name} must be prepared and stopped.`)
    if (
      !missing &&
      (await readOwned(join(directory, 'provider-setup', `${name}.json`)))
        .setupCompleted !== true
    )
      throw new Error('Invalid provider completion receipt.')
    return missing ? 'reconcile' : 'complete'
  }
  const classifications = []
  for (const name of commands.lifecycleOrder)
    classifications.push(await classify(name))
  let attempt = join(directory, 'setup-continuation')
  if (resumeExecutor !== undefined) {
    if (!/^[a-f0-9]{40}$/.test(resumeExecutor) || profileRepair)
      throw new Error(
        'Profile resume requires a corrected profile and original executor.'
      )
    await requirePrivateDirectory(
      attempt,
      'Continuation attempt must be private.'
    )
    const entries = (await readdir(attempt)).sort()
    if (
      JSON.stringify(entries) !==
        JSON.stringify(['claim.json', 'setup-profile-intent.json']) ||
      JSON.stringify(await readOwned(join(attempt, 'claim.json'))) !==
        JSON.stringify({ ...claim, executor: resumeExecutor, context }) ||
      JSON.stringify(
        await readOwned(join(attempt, 'setup-profile-intent.json'))
      ) !== JSON.stringify({ candidate, executor: resumeExecutor })
    )
      throw new Error('Profile resume does not match the retained prefix.')
    const expected = {
      scraping: 'complete',
      docProcessing: 'reconcile',
      ingestion: 'untouched',
      retrieval: 'untouched',
    }
    if (
      commands.lifecycleOrder.some(
        (name, index) => classifications[index] !== expected[name]
      )
    )
      throw new Error('Retained provider prefix has changed.')
    attempt = join(attempt, 'resume-after-profile')
  } else if (resumeIngestionExecutor !== undefined) {
    if (!/^[a-f0-9]{40}$/.test(resumeIngestionExecutor) || profileRepair)
      throw new Error(
        'Ingestion resume requires a corrected profile and original executor.'
      )
    await requirePrivateDirectory(
      attempt,
      'Continuation attempt must be private.'
    )
    await requireIngestionResumePrefix(attempt, {
      claim,
      candidate,
      context,
      resumeIngestionExecutor,
    })
    const expected = {
      scraping: 'complete',
      docProcessing: 'complete',
      ingestion: 'pending-ingestion',
      retrieval: 'untouched',
    }
    if (
      commands.lifecycleOrder.some(
        (name, index) => classifications[index] !== expected[name]
      )
    )
      throw new Error('Retained provider prefix has changed.')
    attempt = join(attempt, 'resume-after-ingestion')
  }
  await mkdir(attempt, { mode: 0o700 })
  await writeExclusive(join(attempt, 'claim.json'), {
    ...claim,
    executor,
    context,
    ...(resumeExecutor ? { resumeExecutor } : {}),
    ...(resumeIngestionExecutor ? { resumeIngestionExecutor } : {}),
  })
  if (profileRepair) {
    await writeExclusive(join(attempt, 'setup-profile-intent.json'), {
      candidate,
      executor,
    })
    const handle = await open(
      profileRepair.path,
      constants.O_RDWR | constants.O_NOFOLLOW
    )
    try {
      const metadata = await handle.stat()
      if (
        !metadata.isFile() ||
        metadata.uid !== process.getuid() ||
        metadata.nlink !== 1 ||
        (await handle.readFile('utf8')) !== profileRepair.previous
      )
        throw new Error('Setup profile changed before repair.')
      const bytes = Buffer.from(profileRepair.next)
      if (
        (await handle.write(bytes, 0, bytes.length, 0)).bytesWritten !==
        bytes.length
      )
        throw new Error('Incomplete setup profile repair; state retained.')
      await handle.truncate(bytes.length)
      await handle.sync()
    } finally {
      await handle.close()
    }
    const repaired = JSON.parse(
      await runManaged([
        'status',
        '--repo',
        config.project.runtimeCheckoutPath,
        '--json',
      ])
    )
    if (
      repaired.dockerContext !== context ||
      repaired.repo?.path !== config.project.runtimeCheckoutPath ||
      repaired.repo?.valid !== true
    )
      throw new Error('Repaired setup profile could not be qualified.')
  }
  await verifySources(config, candidate, executor)
  await verifyUnusedManaged()
  await verifyBacking()
  for (const [index, name] of commands.lifecycleOrder.entries()) {
    if ((await classify(name)) !== classifications[index])
      throw new Error('Provider state changed before bootstrap startup.')
  }
  await writeExclusive(join(attempt, 'bootstrap-intent.json'), {
    candidate,
    executor,
  })
  await runDocker([
    '--context',
    context,
    'compose',
    '--project-name',
    config.project.identity,
    '--file',
    join(directory, 'bootstrap.compose.json'),
    'start',
    'postgres',
    'hatchet',
  ])
  for (const [index, name] of commands.lifecycleOrder.entries()) {
    const disposition = await classify(name)
    if (disposition !== classifications[index])
      throw new Error('Provider state changed during continuation.')
    if (disposition === 'complete') continue
    if (disposition === 'untouched' || disposition === 'pending-ingestion') {
      await writeExclusive(join(attempt, `${name}-intent.json`), {
        candidate,
        executor,
      })
      await run(commands.providers[name].lifecycle.setup, {
        ...(name === 'retrieval' ? retrieval : {}),
        DOCKER_CONTEXT: context,
      })
      const observed = await observeProviderLauncher(
        config,
        name,
        run,
        { DOCKER_CONTEXT: context },
        retrieval
      )
      if (!observed.prepared)
        throw new Error(`Provider ${name} preparation is incomplete.`)
    } else
      await writeExclusive(join(attempt, `${name}-reconciliation.json`), {
        candidate,
        executor,
        prepared: true,
      })
    await writeExclusive(join(directory, 'provider-setup', `${name}.json`), {
      setupCompleted: true,
    })
  }
  await writeExclusive(join(directory, 'provider-setup/complete.json'), {
    candidateRevision: candidate,
    context,
    initialized: true,
  })
  await initializeApplication(config, candidate, runManaged, runDocker)
  await completePreparation(config, candidate)
  await writeExclusive(join(attempt, 'complete.json'), { candidate, executor })
  return { prepared: true, applicationStarted: false, aiQualified: false }
}

function renderConsumerBacking(config) {
  return { name: config.project.identity, ...renderBackingCompose(config) }
}

// A failed setup deliberately retains its claim. It must not be mistaken for
// an unused runtime on the next invocation.
export async function claimPreparation(
  config,
  candidateRevision,
  inspect = inspectRuntimeCheckout
) {
  validateIsolatedConfig(config)
  requireLocalAiEnvironment(config)
  if (!/^[a-f0-9]{40}$/.test(candidateRevision)) {
    throw new Error('An immutable candidate revision is required.')
  }
  const checkout = config.project.runtimeCheckoutPath
  if ((await realpath(checkout)) !== checkout) {
    throw new Error('Runtime checkout must be canonical.')
  }
  if (!inspect(checkout, candidateRevision)) {
    throw new Error('A clean detached checkout at the candidate is required.')
  }
  const directory = join(checkout, '.local-kb')
  await mkdir(directory, { mode: 0o700 })
  const identity = {
    candidateRevision,
    configurationDigest: createHash('sha256')
      .update(JSON.stringify(config))
      .digest('hex'),
    sourcePath: checkout,
    project: config.project.identity,
  }
  await writeExclusive(join(directory, 'preparation.json'), identity)
  return identity
}

// Run on the host before claiming a fresh runtime. Ignored files count as
// existing state too: a clean tracked diff alone does not prove freshness.
export function inspectRuntimeCheckout(checkout, candidateRevision, read) {
  const git =
    read ??
    ((args) =>
      execFileSync(
        'git',
        ['-c', 'core.fsmonitor=false', '-C', checkout, ...args],
        {
          encoding: 'utf8',
          timeout: 5000,
          stdio: ['ignore', 'pipe', 'ignore'],
          env: { PATH: process.env.PATH, GIT_OPTIONAL_LOCKS: '0' },
        }
      ))
  try {
    return (
      git(['rev-parse', '--show-toplevel']).trim() === checkout &&
      git(['rev-parse', 'HEAD']).trim() === candidateRevision &&
      git(['rev-parse', '--abbrev-ref', 'HEAD']).trim() === 'HEAD' &&
      git(['rev-parse', '--git-dir']).trim().includes('/worktrees/') &&
      git([
        'status',
        '--porcelain',
        '--untracked-files=all',
        '--ignored',
        '--ignore-submodules=none',
      ]).trim() === ''
    )
  } catch {
    return false
  }
}

// Install only into the claimed runtime checkout. Compare every tracked input
// with the immutable candidate before the first write, and retain a failed
// attempt so configuration replacement cannot be silently replayed.
export async function installManagedConfiguration(
  config,
  candidateRevision,
  readCandidate = readCandidateFile
) {
  const { directory } = await verifyClaim(config, candidateRevision)
  const checkout = config.project.runtimeCheckoutPath
  if (
    (await realpath(join(checkout, '.devcontainer'))) !==
    join(checkout, '.devcontainer')
  ) {
    throw new Error('Managed configuration directory must be canonical.')
  }
  const inputPaths = [
    '.devcontainer/devcontainer.json',
    '.devcontainer/docker-compose.yml',
    '.devcontainer/docker-compose.devrouter.yml',
    '.devrouter.yml',
  ]
  const handles = []
  try {
    const inputs = []
    for (const path of inputPaths) {
      const candidate = readCandidate(checkout, candidateRevision, path)
      const file = await open(
        join(checkout, path),
        constants.O_RDWR | constants.O_NOFOLLOW
      )
      handles.push(file)
      const metadata = await file.stat()
      if (
        !metadata.isFile() ||
        metadata.uid !== process.getuid() ||
        metadata.nlink !== 1 ||
        (await file.readFile('utf8')) !== candidate
      ) {
        throw new Error('Managed configuration differs from the candidate.')
      }
      inputs.push(candidate)
    }
    const replacements = managedReplacementBytes(config, inputs)
    await mkdir(join(directory, 'managed-installation'), { mode: 0o700 })
    for (const [index, file] of handles.entries()) {
      const bytes = Buffer.from(replacements[index])
      const { bytesWritten } = await file.write(bytes, 0, bytes.length, 0)
      if (bytesWritten !== bytes.length) {
        throw new Error(
          'Incomplete configuration write; partial state is retained.'
        )
      }
      await file.truncate(bytes.length)
      await file.sync()
    }
    await writeExclusive(
      join(directory, 'managed-installation/complete.json'),
      {
        candidateRevision,
      }
    )
    return { installed: true }
  } finally {
    await Promise.all(handles.map((file) => file.close()))
  }
}

export async function installProviderRouting(
  config,
  candidateRevision,
  result
) {
  const { directory } = await verifyClaim(config, candidateRevision)
  const installation = await readOwned(
    join(directory, 'managed-installation/complete.json')
  )
  if (
    installation.candidateRevision !== candidateRevision ||
    result?.kind !== 'linked' ||
    result.repoPath !== config.project.runtimeCheckoutPath ||
    result.profile !== 'local-kb-setup'
  ) {
    throw new Error('Routing requires the linked checkout setup result.')
  }
  await writeExclusive(
    join(directory, 'provider-routing.compose.json'),
    renderProviderRouting(result.workspace)
  )
  return { configured: true }
}

// Setup builds the managed image without starting application processes.
// Every failure retains the attempt; normal startup never calls this phase.
export async function initializeManagedApplication(
  config,
  candidateRevision,
  runManaged = runLocalManaged,
  runDocker = runLocalDocker
) {
  requireLocalAiEnvironment(config)
  const { directory } = await verifyClaim(config, candidateRevision)
  const storage = await readOwned(
    join(directory, 'storage-setup/complete.json')
  )
  const installation = await readOwned(
    join(directory, 'managed-installation/complete.json')
  )
  if (
    storage.initialized !== true ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(storage.context ?? '') ||
    installation.candidateRevision !== candidateRevision
  ) {
    throw new Error(
      'Managed setup requires initialized local storage and configuration.'
    )
  }
  const attempt = join(directory, 'application-setup')
  await mkdir(attempt, { mode: 0o700 })
  const checkout = config.project.runtimeCheckoutPath
  const compose = [
    '--context',
    storage.context,
    'compose',
    '--project-name',
    config.project.identity,
    '--file',
    join(directory, 'providers.compose.json'),
  ]
  try {
    const result = JSON.parse(
      await runManaged([
        'ensure',
        checkout,
        '--profile',
        'local-kb-setup',
        '--json',
      ])
    )
    await installProviderRouting(config, candidateRevision, result)
    await runDocker([
      ...compose,
      '--file',
      join(directory, 'provider-routing.compose.json'),
      'up',
      '--detach',
      '--wait',
      '--wait-timeout',
      '120',
      '--no-deps',
      'blob',
    ])
    for (const command of [
      ['pnpm', '--filter', '@klicker-uzh/prisma', 'run', 'prisma:push:raw'],
      ['pnpm', '--filter', '@klicker-uzh/prisma-data', 'run', 'seed:raw'],
      [
        'env',
        `NEXT_PUBLIC_MANAGE_URL=https://manage.klicker.${result.workspace}.localhost`,
        'pnpm',
        '--filter',
        '@klicker-uzh/graphql',
        'exec',
        'tsx',
        'src/scripts/setupLocalBlobStorage.ts',
      ],
    ]) {
      await runManaged(['exec', checkout, '--', ...command])
    }
    await writeExclusive(join(attempt, 'complete.json'), {
      candidateRevision,
      workspace: result.workspace,
      context: storage.context,
    })
    return { initialized: true }
  } catch {
    throw new Error(
      'Managed application setup failed; partial state is retained and output withheld.'
    )
  }
}

function readCandidateFile(checkout, revision, path) {
  return execFileSync('git', ['-C', checkout, 'show', `${revision}:${path}`], {
    encoding: 'utf8',
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'ignore'],
    env: { PATH: process.env.PATH, GIT_OPTIONAL_LOCKS: '0' },
  })
}

async function writeExclusive(
  path,
  value,
  serialize = JSON.stringify,
  mode = 0o600
) {
  const file = await open(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    mode
  )
  try {
    await file.writeFile(serialize(value))
    await file.sync()
  } finally {
    await file.close()
  }
}

async function acquireInfrastructureOperation(runtime, operation) {
  const path = join(runtime.directory, 'infrastructure-operation')
  const claim = {
    operation,
    candidateRevision: runtime.candidateRevision,
    configurationDigest: runtime.configurationDigest,
    sourcePath: runtime.checkout,
    project: runtime.project,
    context: runtime.context,
    workspace: runtime.workspace,
  }
  let file
  try {
    file = await open(
      path,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600
    )
    await file.writeFile(JSON.stringify(claim))
    await file.sync()
  } catch (error) {
    if (file) {
      await file.close().catch(() => {})
      await unlink(path).catch(() => {})
    }
    throw error
  }
  await file.close()
  return async () => {
    await unlink(path)
  }
}

async function withInfrastructureOperation(runtime, operation, callback) {
  const release = await acquireInfrastructureOperation(runtime, operation)
  try {
    return await callback()
  } finally {
    await release()
  }
}

function lifecycleReceipt(runtime) {
  return {
    candidateRevision: runtime.candidateRevision,
    context: runtime.context,
    workspace: runtime.workspace,
  }
}

function sameLifecycleReceipt(receipt, expected) {
  return (
    receipt?.candidateRevision === expected.candidateRevision &&
    receipt?.context === expected.context &&
    receipt?.workspace === expected.workspace
  )
}

async function requirePrivateDirectory(path, message) {
  const stat = await lstat(path)
  if (
    !stat.isDirectory() ||
    stat.uid !== process.getuid() ||
    stat.mode & 0o077
  ) {
    throw new Error(message)
  }
}

async function requireStartedInfrastructure(runtime) {
  const started = await readOwned(
    join(runtime.directory, 'infrastructure-start/complete.json')
  )
  if (!sameLifecycleReceipt(started, lifecycleReceipt(runtime))) {
    throw new Error(
      'Infrastructure startup evidence does not match the runtime.'
    )
  }
}

async function readInfrastructureReceipt(runtime, operation, attempt) {
  let receipt
  try {
    receipt = await readOwned(join(attempt, 'complete.json'))
  } catch (error) {
    if (error.code === 'ENOENT') {
      const incomplete = new Error(
        `Infrastructure ${operation} attempt is incomplete; explicit recovery is required.`
      )
      incomplete.code = 'INCOMPLETE_INFRASTRUCTURE_ATTEMPT'
      throw incomplete
    }
    throw error
  }
  if (
    !sameLifecycleReceipt(receipt, lifecycleReceipt(runtime)) ||
    receipt.operation !== operation ||
    !Number.isInteger(receipt.cycle) ||
    receipt.cycle < 0
  ) {
    throw new Error(
      `Infrastructure ${operation} evidence does not match the runtime.`
    )
  }
  return receipt
}

async function readLatestInfrastructureEvidence(runtime, operation) {
  const root = join(runtime.directory, `infrastructure-${operation}`)
  try {
    await requirePrivateDirectory(
      root,
      `Infrastructure ${operation} evidence is not private.`
    )
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
  let index = 1
  let latest
  while (true) {
    const attempt = join(root, `attempt-${index}`)
    try {
      await requirePrivateDirectory(
        attempt,
        `Infrastructure ${operation} attempt is not private.`
      )
    } catch (error) {
      if (error.code === 'ENOENT') break
      throw error
    }
    latest = await readInfrastructureReceipt(runtime, operation, attempt)
    index += 1
  }
  if (!latest) {
    throw new Error(`A successful infrastructure ${operation} is required.`)
  }
  return latest
}

async function claimInfrastructureAttempt(runtime, operation) {
  const root = join(runtime.directory, `infrastructure-${operation}`)
  try {
    await mkdir(root, { mode: 0o700 })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    await requirePrivateDirectory(
      root,
      `Infrastructure ${operation} evidence is not private.`
    )
  }
  let index = 1
  while (true) {
    const attempt = join(root, `attempt-${index}`)
    try {
      await mkdir(attempt, { mode: 0o700 })
      return attempt
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      await requirePrivateDirectory(
        attempt,
        `Infrastructure ${operation} attempt is not private.`
      )
      await readInfrastructureReceipt(runtime, operation, attempt)
      index += 1
    }
  }
}

// This is a setup-only operation. An interrupted attempt leaves its directory
// in place so another invocation cannot silently rotate service credentials.
export async function prepareLocalConfiguration(config, candidateRevision) {
  const { directory } = await verifyClaim(config, candidateRevision)
  const providers = renderConsumerBacking(config)
  const bootstrap = renderConsumerBacking(config)
  const configurationClaim = join(directory, 'configuration-claimed')
  await mkdir(configurationClaim, { mode: 0o700 })
  const credentials = Object.fromEntries(
    localCredentialNames.map((name) => [name, randomBytes(32).toString('hex')])
  )
  const generated = renderProviderLocalConfiguration(
    credentials,
    config.bindings
  )
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  })
  generated.environment.chat = {
    DOC_QUERY_SCOPE_PRIVATE_KEY: privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .replaceAll('\n', '\\n'),
    DOC_QUERY_SCOPE_KID: localRetrievalScope.kid,
    DOC_QUERY_SCOPE_ISSUER: localRetrievalScope.issuer,
    DOC_QUERY_SCOPE_AUDIENCE: localRetrievalScope.audience,
  }
  for (const [name, environment] of Object.entries(generated.environment)) {
    const content =
      Object.entries(environment)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n') + '\n'
    await writeExclusive(join(directory, `${name}.env`), content, String)
  }
  await writeExclusive(
    join(directory, 'doc-processing.json'),
    generated.docProcessing
  )
  await writeExclusive(
    join(directory, 'scraping-api-key'),
    generated.scrapingApiKey,
    String
  )
  await writeExclusive(
    join(directory, 'retrieval-environment.json'),
    generated.retrievalEnvironment
  )
  const registry = join(directory, 'producer-registry')
  const initialization = join(directory, 'postgres-init')
  const retrieval = join(directory, 'doc-query-tools')
  const projects = join(directory, 'project-configs')
  // These files contain references and schema names, not credentials. Their
  // bind mounts must be readable by the providers' non-root container users.
  // The enclosing host configuration directory remains owner-only.
  await mkdir(registry, { mode: 0o755 })
  await mkdir(initialization, { mode: 0o755 })
  await mkdir(retrieval, { mode: 0o755 })
  await mkdir(projects, { mode: 0o755 })
  await writeExclusive(
    join(projects, `${generated.project.project_name}.yaml`),
    generated.project,
    JSON.stringify,
    0o644
  )
  await writeExclusive(
    join(retrieval, 'knowledge-bases.yaml'),
    renderLocalRetrievalConfiguration(
      publicKey,
      generated.project.vector_store.collection_name
    ),
    JSON.stringify,
    0o644
  )
  // JSON is a YAML subset accepted by the provider's YAML loader.
  await writeExclusive(
    join(registry, 'klicker.yaml'),
    generated.producer,
    JSON.stringify,
    0o644
  )
  await writeExclusive(
    join(initialization, '01-databases.sql'),
    generated.databaseInitialization,
    String,
    0o644
  )
  // Bootstrap cannot load worker env files: Hatchet creates their token only
  // after its own isolated database and configuration have been initialized.
  await writeExclusive(join(directory, 'bootstrap.compose.json'), bootstrap)
  await writeExclusive(join(directory, 'providers.compose.json'), providers)
  return { configured: true }
}

// Keep each provider's setup attempt even on failure. Retained start must not
// repair or repeat initialization behind the user's back.
export async function initializeProviderLaunchers(
  config,
  candidateRevision,
  run = runProviderCommand,
  runDocker = runLocalDocker
) {
  const { directory } = await verifyClaim(config, candidateRevision)
  const storage = await readOwned(
    join(directory, 'storage-setup/complete.json')
  )
  const context = (await runDocker(['context', 'show'])).trim()
  if (context !== storage.context) {
    throw new Error(
      'Provider launchers require the prepared local Docker context.'
    )
  }
  const endpoint = (
    await runDocker([
      'context',
      'inspect',
      context,
      '--format',
      '{{.Endpoints.docker.Host}}',
    ])
  ).trim()
  if (!endpoint.startsWith('unix:///') || /[\r\n]/.test(endpoint)) {
    throw new Error('Provider launchers require a local Docker endpoint.')
  }
  const attempt = join(directory, 'provider-setup')
  await mkdir(attempt, { mode: 0o700 })
  const commands = providerCommands(config)
  const retrievalEnvironment = await readOwned(
    join(directory, 'retrieval-environment.json')
  )
  for (const provider of commands.lifecycleOrder) {
    try {
      const output = await run(commands.providers[provider].lifecycle.setup, {
        ...(provider === 'retrieval' ? retrievalEnvironment : {}),
        DOCKER_CONTEXT: context,
      })
      const status = JSON.parse(output)
      const instance =
        provider === 'ingestion'
          ? status.instance?.name
          : provider === 'docProcessing'
            ? status.instance_id
            : status.instance
      const revision =
        provider === 'ingestion'
          ? status.source?.revision
          : status.source_revision
      const prepared =
        provider === 'ingestion'
          ? ['configuration', 'credentials', 'schema'].every(
              (key) => status.preparation?.[key] === 'prepared'
            )
          : provider === 'docProcessing'
            ? status.setup === 'ready'
            : status.prepared === true
      if (
        instance !== config.project.identity ||
        revision !== config.providers[provider].revision ||
        !prepared
      ) {
        throw new Error(
          'Provider preparation evidence is incomplete or mismatched.'
        )
      }
      await writeExclusive(join(attempt, `${provider}.json`), {
        setupCompleted: true,
      })
    } catch {
      throw new Error(
        `Provider ${provider} setup failed; partial state is retained.`
      )
    }
  }
  await writeExclusive(join(attempt, 'complete.json'), {
    candidateRevision,
    context,
    initialized: true,
  })
  return { providersInitialized: true }
}

// Explicit setup checks all owned volumes before invoking the host runner.
// A failed attempt stays claimed; normal startup never calls this operation.
export async function initializeProviderStorage(
  config,
  candidateRevision,
  run = runLocalDocker,
  inspect = inspectUnusedComposeProject
) {
  if (typeof run !== 'function') {
    throw new Error('An ownership-checked Compose runner is required.')
  }
  const { directory } = await verifyClaim(config, candidateRevision)
  const composePath = join(directory, 'bootstrap.compose.json')
  await readOwned(composePath)
  const attempt = join(directory, 'storage-setup')
  await mkdir(attempt, { mode: 0o700 })
  const providers = await readOwned(join(directory, 'providers.compose.json'))
  const observation = inspect(providers)
  if (!observation.unused || !observation.context) {
    throw new Error(
      'Provider storage is not confirmed unused on a local Docker context.'
    )
  }
  const prefix = [
    '--context',
    observation.context,
    'compose',
    '--project-name',
    config.project.identity,
    '--file',
    composePath,
  ]
  const steps = [
    ['up', '--detach', '--wait', '--wait-timeout', '120', 'postgres'],
    ['run', '--no-deps', 'hatchet-setup'],
    ['up', '--detach', '--no-deps', 'hatchet'],
  ]
  for (const [index, args] of steps.entries()) {
    try {
      await run([...prefix, ...args])
    } catch {
      // Provider output can contain connection strings; do not relay it.
      throw new Error(
        `Provider storage setup step ${index + 1} failed; partial state is retained.`
      )
    }
  }
  try {
    // Exec output is captured by the host runner, not recorded in container
    // startup logs or printed by the launcher. Never use a one-off `run` here.
    const token = await run([
      ...prefix,
      'exec',
      '-T',
      'hatchet',
      'cat',
      '/config/authdisabled-token',
    ])
    await deliverHatchetToken(config, candidateRevision, token)
  } catch {
    throw new Error(
      'Local Hatchet token delivery failed; partial state is retained.'
    )
  }
  await writeExclusive(join(attempt, 'complete.json'), {
    initialized: true,
    context: observation.context,
  })
  return { storageInitialized: true }
}

// The setup caller captures this token from the exact owned Hatchet instance.
// Store it once without returning it to command output or rotating it on start.
export async function deliverHatchetToken(config, candidateRevision, token) {
  const { directory } = await verifyClaim(config, candidateRevision)
  if (
    typeof token !== 'string' ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token.trim())
  ) {
    throw new Error('Hatchet setup did not supply a valid token shape.')
  }
  await writeExclusive(
    join(directory, 'hatchet-client.env'),
    `HATCHET_CLIENT_TOKEN=${token.trim()}\nHATCHET_CLIENT_HOST_PORT=hatchet:7077\nHATCHET_CLIENT_TLS_STRATEGY=none\n`,
    String
  )
  return { delivered: true }
}

async function readOwned(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stat = await file.stat()
    if (!stat.isFile() || stat.uid !== process.getuid() || stat.mode & 0o077) {
      throw new Error(
        'Preparation evidence must be an owner-only regular file.'
      )
    }
    return JSON.parse(await file.readFile('utf8'))
  } finally {
    await file.close()
  }
}

async function verifyClaim(config, candidateRevision) {
  validateIsolatedConfig(config)
  const checkout = config.project.runtimeCheckoutPath
  if ((await realpath(checkout)) !== checkout) {
    throw new Error('Runtime checkout must be canonical.')
  }
  const directory = join(checkout, '.local-kb')
  const stat = await lstat(directory)
  if (
    !stat.isDirectory() ||
    stat.uid !== process.getuid() ||
    stat.mode & 0o077
  ) {
    throw new Error('Preparation directory must be owned and private.')
  }
  const claim = await readOwned(join(directory, 'preparation.json'))
  const expected = {
    candidateRevision,
    configurationDigest: createHash('sha256')
      .update(JSON.stringify(config))
      .digest('hex'),
    sourcePath: checkout,
    project: config.project.identity,
  }
  if (JSON.stringify(claim) !== JSON.stringify(expected)) {
    throw new Error(
      'Preparation identity does not match the requested runtime.'
    )
  }
  return { directory, claim }
}

// Called only after every explicit setup command has succeeded. This receipt
// proves preparation completion, not service health or upstream AI capability.
export async function completePreparation(config, candidateRevision) {
  const { directory, claim } = await verifyClaim(config, candidateRevision)
  const application = await readApplicationSetup(directory, candidateRevision)
  await writeExclusive(join(directory, 'prepared.json'), {
    ...claim,
    application,
  })
}

export async function requirePreparation(config, candidateRevision) {
  const { directory, claim } = await verifyClaim(config, candidateRevision)
  const application = await readApplicationSetup(directory, candidateRevision)
  const prepared = await readOwned(join(directory, 'prepared.json'))
  if (JSON.stringify(prepared) !== JSON.stringify({ ...claim, application })) {
    throw new Error('Completed preparation does not match the runtime claim.')
  }
  return prepared
}

async function preparedRuntime(config, candidateRevision, runDocker) {
  const prepared = await requirePreparation(config, candidateRevision)
  const checkout = config.project.runtimeCheckoutPath
  const directory = join(checkout, '.local-kb')
  const { context, workspace } = prepared.application
  const composition = await readOwned(join(directory, 'providers.compose.json'))
  const routing = await readOwned(
    join(directory, 'provider-routing.compose.json')
  )
  if (
    JSON.stringify(composition) !==
      JSON.stringify(renderConsumerBacking(config)) ||
    JSON.stringify(routing) !== JSON.stringify(renderProviderRouting(workspace))
  ) {
    throw new Error('Prepared provider configuration has changed.')
  }
  const endpoint = await runDocker([
    'context',
    'inspect',
    context,
    '--format',
    '{{.Endpoints.docker.Host}}',
  ])
  if (!endpoint.startsWith('unix:///') || /[\r\n]/.test(endpoint)) {
    throw new Error('Prepared runtime requires its local Docker context.')
  }
  return {
    checkout,
    directory,
    context,
    workspace,
    candidateRevision,
    configurationDigest: prepared.configurationDigest,
    project: config.project.identity,
  }
}

async function observeOwnedProviders(config, runtime, runDocker) {
  const { context, directory } = runtime
  const ids = (
    await runDocker([
      '--context',
      context,
      'container',
      'ls',
      '--all',
      '--quiet',
      '--filter',
      `label=com.docker.compose.project=${config.project.identity}`,
    ])
  )
    .split(/\s+/)
    .filter(Boolean)
  const services = renderConsumerBacking(config).services
  const rows = []
  for (const id of ids) {
    if (!/^[a-f0-9]{12,64}$/.test(id))
      throw new Error('Invalid provider container identity.')
    const result = await runDocker([
      '--context',
      context,
      'container',
      'inspect',
      '--format',
      '{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.project.working_dir"}}|{{index .Config.Labels "com.docker.compose.project.config_files"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}unreported{{end}}',
      id,
    ])
    const [project, workingDirectory, files, service, state, health, extra] =
      result.split('|')
    const allowedFiles = [
      join(directory, 'bootstrap.compose.json'),
      join(directory, 'providers.compose.json'),
      join(directory, 'provider-routing.compose.json'),
    ]
    if (
      project !== config.project.identity ||
      workingDirectory !== directory ||
      !files ||
      files.split(',').some((file) => !allowedFiles.includes(file)) ||
      !Object.hasOwn(services, service) ||
      extra !== undefined ||
      ![
        'created',
        'running',
        'paused',
        'restarting',
        'removing',
        'exited',
        'dead',
      ].includes(state) ||
      !['unreported', 'starting', 'healthy', 'unhealthy'].includes(health)
    )
      throw new Error('Provider container ownership or state is ambiguous.')
    rows.push({ service, state, health })
  }
  return rows
}

const infrastructureServices = ['postgres', 'redis', 'blob', 'hatchet']

export async function inspectPreparedInfrastructure(
  config,
  candidateRevision,
  runDocker = runLocalDocker,
  runManaged = runLocalManaged,
  runProvider = runProviderCommand
) {
  const runtime = await preparedRuntime(config, candidateRevision, runDocker)
  const providers = await observeOwnedProviders(config, runtime, runDocker)
  let managed
  try {
    const observation = JSON.parse(
      await runManaged(['status', '--repo', runtime.checkout, '--json'])
    )
    managed = observation.repo?.managedRuntime
    if (
      observation.dockerContext !== runtime.context ||
      observation.repo?.path !== runtime.checkout ||
      observation.repo?.valid !== true ||
      managed?.mode !== 'managed' ||
      managed.workspace !== runtime.workspace ||
      ![
        'ready',
        'starting',
        'stopped',
        'drifted',
        'failed-transition',
      ].includes(managed.status) ||
      !Array.isArray(managed.drift)
    ) {
      throw new Error()
    }
  } catch {
    throw new Error('Managed runtime observation is unavailable or mismatched.')
  }
  const infrastructure = infrastructureServices.map((service) => {
    const instances = providers.filter((row) => row.service === service)
    if (instances.length === 0) return { service, status: 'missing' }
    if (instances.length !== 1) return { service, status: 'ambiguous' }
    const [{ state, health }] = instances
    if (state !== 'running') return { service, status: 'not-running' }
    return {
      service,
      status: health === 'unreported' ? 'readiness-unverified' : health,
    }
  })
  const launchers = await observeProviderLaunchers(
    config,
    runProvider,
    { DOCKER_CONTEXT: runtime.context },
    await readOwned(join(runtime.directory, 'retrieval-environment.json'))
  )
  return {
    providers,
    launchers,
    infrastructure,
    infrastructureHealthy: infrastructure.every(
      ({ status }) => status === 'healthy'
    ),
    managedRuntimeObserved: true,
    managedRuntimeStatus: managed.status,
    managedRuntimeReady:
      managed.status === 'ready' &&
      managed.profile === 'ai,chat,manage' &&
      managed.activeProfile === 'ai,chat,manage' &&
      managed.drift.length === 0,
    aiQualified: false,
  }
}

export async function stopPreparedInfrastructure(
  config,
  candidateRevision,
  runManaged = runLocalManaged,
  runDocker = runLocalDocker,
  runProvider = runProviderCommand
) {
  const runtime = await preparedRuntime(config, candidateRevision, runDocker)
  return withInfrastructureOperation(runtime, 'stop', async () => {
    let started = true
    try {
      await requireStartedInfrastructure(runtime)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      started = false
    }
    let resumed
    let stopped
    let incomplete = false
    try {
      resumed = await readLatestInfrastructureEvidence(runtime, 'resume')
      stopped = await readLatestInfrastructureEvidence(runtime, 'stop')
    } catch (error) {
      if (error.code !== 'INCOMPLETE_INFRASTRUCTURE_ATTEMPT') throw error
      incomplete = true
    }
    const result = await stopInfrastructure(
      config,
      runtime,
      runManaged,
      runDocker,
      runProvider
    )
    // Shutdown is safe after a partial attempt, but cannot authorize replay.
    if (incomplete) return result
    const cycle = resumed?.cycle ?? 0
    // Stopping setup or a partial initial start cannot authorize a later resume.
    if (started && stopped?.cycle !== cycle) {
      const attempt = await claimInfrastructureAttempt(runtime, 'stop')
      await writeExclusive(join(attempt, 'complete.json'), {
        ...lifecycleReceipt(runtime),
        operation: 'stop',
        cycle,
      })
    }
    return result
  })
}

async function stopInfrastructure(
  config,
  runtime,
  runManaged,
  runDocker,
  runProvider
) {
  await observeOwnedProviders(config, runtime, runDocker)
  const environment = { DOCKER_CONTEXT: runtime.context }
  const retrievalEnvironment = await readOwned(
    join(runtime.directory, 'retrieval-environment.json')
  )
  await observeProviderLaunchers(
    config,
    runProvider,
    environment,
    retrievalEnvironment
  )
  const commands = providerCommands(config)
  for (const name of commands.stopOrder) {
    await runProvider(commands.providers[name].lifecycle.stop, {
      ...(name === 'retrieval' ? retrievalEnvironment : {}),
      ...environment,
    })
  }
  const launchers = await observeProviderLaunchers(
    config,
    runProvider,
    environment,
    retrievalEnvironment
  )
  if (launchers.some((row) => !row.stopped)) {
    throw new Error('Provider shutdown is incomplete; data is retained.')
  }
  const managed = JSON.parse(
    await runManaged(['stop', runtime.checkout, '--json'])
  )
  if (
    managed.stopped !== true ||
    managed.kind !== 'linked' ||
    managed.repoPath !== runtime.checkout ||
    managed.workspace !== runtime.workspace
  )
    throw new Error('Managed shutdown is not confirmed.')
  await runDocker([
    '--context',
    runtime.context,
    'compose',
    '--project-name',
    config.project.identity,
    '--file',
    join(runtime.directory, 'providers.compose.json'),
    '--file',
    join(runtime.directory, 'provider-routing.compose.json'),
    '--profile',
    '*',
    'stop',
  ])
  const providers = await observeOwnedProviders(config, runtime, runDocker)
  if (
    providers.some(
      ({ state }) => !['exited', 'created', 'dead'].includes(state)
    )
  ) {
    throw new Error('Provider shutdown is incomplete; data is retained.')
  }
  return { stopped: true, dataRetained: true }
}

// Provider activation is explicit. A failed attempt remains claimed; another
// invocation cannot silently resume queue processing or initialization.
export async function startPreparedInfrastructure(
  config,
  candidateRevision,
  runManaged = runLocalManaged,
  runDocker = runLocalDocker,
  runProvider = runProviderCommand
) {
  requireLocalAiEnvironment(config)
  const runtime = await preparedRuntime(config, candidateRevision, runDocker)
  return withInfrastructureOperation(runtime, 'start', async () => {
    await observeOwnedProviders(config, runtime, runDocker)
    const attempt = join(runtime.directory, 'infrastructure-start')
    await mkdir(attempt, { mode: 0o700 })
    return launchInfrastructure(
      config,
      runtime,
      attempt,
      runManaged,
      runDocker,
      undefined,
      runProvider
    )
  })
}

export async function resumePreparedInfrastructure(
  config,
  candidateRevision,
  runManaged = runLocalManaged,
  runDocker = runLocalDocker,
  runProvider = runProviderCommand
) {
  requireLocalAiEnvironment(config)
  const runtime = await preparedRuntime(config, candidateRevision, runDocker)
  return withInfrastructureOperation(runtime, 'resume', async () => {
    await requireStartedInfrastructure(runtime)
    const resumed = await readLatestInfrastructureEvidence(runtime, 'resume')
    const stopped = await readLatestInfrastructureEvidence(runtime, 'stop')
    const cycle = resumed?.cycle ?? 0
    if (!stopped || stopped.cycle !== cycle) {
      throw new Error(
        'A successful stop of the current infrastructure cycle is required.'
      )
    }
    const providers = await observeOwnedProviders(config, runtime, runDocker)
    if (
      providers.some(
        ({ state }) => !['exited', 'created', 'dead'].includes(state)
      )
    ) {
      throw new Error(
        'Infrastructure must remain stopped before explicit resume.'
      )
    }
    const attempt = await claimInfrastructureAttempt(runtime, 'resume')
    return launchInfrastructure(
      config,
      runtime,
      attempt,
      runManaged,
      runDocker,
      cycle + 1,
      runProvider
    )
  })
}

async function launchInfrastructure(
  config,
  runtime,
  attempt,
  runManaged,
  runDocker,
  cycle,
  runProvider
) {
  const { checkout, directory, context, workspace } = runtime
  try {
    const commands = providerCommands(config)
    const environment = { DOCKER_CONTEXT: context }
    const retrievalEnvironment = await readOwned(
      join(directory, 'retrieval-environment.json')
    )
    const prepared = await observeProviderLaunchers(
      config,
      runProvider,
      environment,
      retrievalEnvironment
    )
    if (prepared.some((row) => !row.prepared)) throw new Error()
    for (const name of ['scraping', 'docProcessing']) {
      await runProvider(commands.providers[name].lifecycle.start, environment)
    }
    await runDocker([
      '--context',
      context,
      'compose',
      '--project-name',
      config.project.identity,
      '--file',
      join(directory, 'providers.compose.json'),
      '--file',
      join(directory, 'provider-routing.compose.json'),
      'up',
      '--detach',
      '--wait',
      '--wait-timeout',
      '180',
      ...infrastructureServices,
    ])
    const managed = JSON.parse(
      await runManaged(
        ['ensure', checkout, '--profile', 'ai,chat,manage', '--json'],
        config.aiUpstream
      )
    )
    if (
      managed.kind !== 'linked' ||
      managed.repoPath !== checkout ||
      managed.workspace !== workspace ||
      managed.profile !== 'ai,chat,manage'
    ) {
      throw new Error('Managed startup identity differs from preparation.')
    }
    await runProvider(commands.providers.ingestion.lifecycle.start, environment)
    await runProvider(commands.providers.retrieval.lifecycle.start, {
      ...retrievalEnvironment,
      ...environment,
    })
    await observeProviderLaunchers(
      config,
      runProvider,
      environment,
      retrievalEnvironment
    )
    await writeExclusive(join(attempt, 'complete.json'), {
      candidateRevision: runtime.candidateRevision,
      context,
      workspace,
      ...(cycle === undefined ? {} : { operation: 'resume', cycle }),
    })
    return {
      infrastructureStarted: true,
      aiQualified: false,
      providerWorkerActivationRequested: true,
    }
  } catch {
    throw new Error(
      'Infrastructure startup failed; partial state is retained and output withheld.'
    )
  }
}

async function readApplicationSetup(directory, candidateRevision) {
  const providers = await readOwned(
    join(directory, 'provider-setup/complete.json')
  )
  const application = await readOwned(
    join(directory, 'application-setup/complete.json')
  )
  const storage = await readOwned(
    join(directory, 'storage-setup/complete.json')
  )
  if (
    application.candidateRevision !== candidateRevision ||
    !/^[a-z0-9][a-z0-9-]*$/.test(application.workspace ?? '') ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(application.context ?? '') ||
    storage.initialized !== true ||
    storage.context !== application.context ||
    providers.initialized !== true ||
    providers.candidateRevision !== candidateRevision ||
    providers.context !== storage.context
  ) {
    throw new Error(
      'Application setup evidence does not match prepared storage.'
    )
  }
  return application
}
