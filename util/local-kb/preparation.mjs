import { execFileSync } from 'node:child_process'
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, realpath, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'yaml'
import { renderBackingCompose } from './backing-compose.mjs'
import { renderProviderCompose } from './compose.mjs'
import {
  inspectUnusedComposeProject,
  runLocalDocker,
  runLocalManaged,
} from './docker-preflight.mjs'
import { validateIsolatedConfig } from './isolated-config.mjs'
import {
  localCredentialNames,
  localRetrievalScope,
  renderLocalConfiguration,
  renderLocalRetrievalConfiguration,
} from './local-configuration.mjs'
import {
  renderManagedConfiguration,
  renderProviderRouting,
} from './managed-configuration.mjs'

// A failed setup deliberately retains its claim. It must not be mistaken for
// an unused runtime on the next invocation.
export async function claimPreparation(
  config,
  candidateRevision,
  inspect = inspectRuntimeCheckout
) {
  validateIsolatedConfig(config)
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
    const rendered = renderManagedConfiguration(config, {
      devcontainer: JSON.parse(inputs[0]),
      compose: parse(inputs[1]),
      devrouter: parse(inputs[3]),
    })
    await mkdir(join(directory, 'managed-installation'), { mode: 0o700 })
    // Devrouter appends this standard overlay for linked worktrees. It must
    // not reintroduce the ordinary backing services or host port bindings.
    const replacements = [
      rendered.devcontainer,
      rendered.compose,
      { services: {} },
      rendered.devrouter,
    ]
    rendered.devcontainer.dockerComposeFile = [
      'docker-compose.yml',
      'docker-compose.devrouter.yml',
    ]
    for (const [index, file] of handles.entries()) {
      const bytes = Buffer.from(
        `${JSON.stringify(replacements[index], null, 2)}\n`
      )
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
  const providers = renderProviderCompose(config)
  const bootstrap = {
    name: config.project.identity,
    ...renderBackingCompose(config),
  }
  bootstrap.services['ingestion-setup'] = providers.services['ingestion-setup']
  bootstrap.services['doc-processing-setup'] =
    providers.services['doc-processing-setup']
  bootstrap.volumes['document-processing'] =
    providers.volumes['document-processing']
  const configurationClaim = join(directory, 'configuration-claimed')
  await mkdir(configurationClaim, { mode: 0o700 })
  const credentials = Object.fromEntries(
    localCredentialNames.map((name) => [name, randomBytes(32).toString('hex')])
  )
  const generated = renderLocalConfiguration(credentials)
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
    renderLocalRetrievalConfiguration(publicKey),
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
    ['run', '--no-deps', 'ingestion-setup'],
    ['run', '--no-deps', 'doc-processing-setup'],
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
      JSON.stringify(renderProviderCompose(config)) ||
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
  const services = renderProviderCompose(config).services
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

const infrastructureServices = [
  'postgres',
  'redis',
  'blob',
  'hatchet',
  'milvus-etcd',
  'minio',
  'milvus',
  'crawl4ai',
  'scraping',
  'ingestion-api',
  'doc-processing',
]

export async function inspectPreparedInfrastructure(
  config,
  candidateRevision,
  runDocker = runLocalDocker
) {
  const runtime = await preparedRuntime(config, candidateRevision, runDocker)
  const providers = await observeOwnedProviders(config, runtime, runDocker)
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
  return {
    providers,
    infrastructure,
    infrastructureHealthy: infrastructure.every(
      ({ status }) => status === 'healthy'
    ),
    managedRuntimeObserved: false,
    aiQualified: false,
  }
}

export async function stopPreparedInfrastructure(
  config,
  candidateRevision,
  runManaged = runLocalManaged,
  runDocker = runLocalDocker
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
      runDocker
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

async function stopInfrastructure(config, runtime, runManaged, runDocker) {
  await observeOwnedProviders(config, runtime, runDocker)
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

// This phase starts no queue consumers or model-dependent services. A failed
// attempt remains claimed; another invocation cannot silently resume work.
export async function startPreparedInfrastructure(
  config,
  candidateRevision,
  runManaged = runLocalManaged,
  runDocker = runLocalDocker
) {
  const runtime = await preparedRuntime(config, candidateRevision, runDocker)
  return withInfrastructureOperation(runtime, 'start', async () => {
    await observeOwnedProviders(config, runtime, runDocker)
    const attempt = join(runtime.directory, 'infrastructure-start')
    await mkdir(attempt, { mode: 0o700 })
    return launchInfrastructure(config, runtime, attempt, runManaged, runDocker)
  })
}

export async function resumePreparedInfrastructure(
  config,
  candidateRevision,
  runManaged = runLocalManaged,
  runDocker = runLocalDocker
) {
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
      cycle + 1
    )
  })
}

async function launchInfrastructure(
  config,
  runtime,
  attempt,
  runManaged,
  runDocker,
  cycle
) {
  const { checkout, directory, context, workspace } = runtime
  try {
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
      await runManaged([
        'ensure',
        checkout,
        '--profile',
        'manage,chat',
        '--json',
      ])
    )
    if (
      managed.kind !== 'linked' ||
      managed.repoPath !== checkout ||
      managed.workspace !== workspace ||
      managed.profile !== 'manage,chat'
    ) {
      throw new Error('Managed startup identity differs from preparation.')
    }
    await writeExclusive(join(attempt, 'complete.json'), {
      candidateRevision: runtime.candidateRevision,
      context,
      workspace,
      ...(cycle === undefined ? {} : { operation: 'resume', cycle }),
    })
    return {
      infrastructureStarted: true,
      aiQualified: false,
      workersStarted: false,
    }
  } catch {
    throw new Error(
      'Infrastructure startup failed; partial state is retained and output withheld.'
    )
  }
}

async function readApplicationSetup(directory, candidateRevision) {
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
    storage.context !== application.context
  ) {
    throw new Error(
      'Application setup evidence does not match prepared storage.'
    )
  }
  return application
}
