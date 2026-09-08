import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { renderBackingCompose } from './backing-compose.mjs'
import { renderProviderCompose } from './compose.mjs'
import { renderDocProcessingCompose } from './doc-processing-compose.mjs'
import {
  inspectUnusedComposeProject,
  runLocalDocker,
} from './docker-preflight.mjs'
import { renderIngestionCompose } from './ingestion-compose.mjs'
import { validateIsolatedConfig } from './isolated-config.mjs'
import {
  localCredentialNames,
  localRetrievalScope,
  renderLocalConfiguration,
  renderLocalRetrievalConfiguration,
} from './local-configuration.mjs'

// A failed setup deliberately retains its claim. It must not be mistaken for
// an unused runtime on the next invocation.
export async function claimPreparation(config, candidateRevision) {
  validateIsolatedConfig(config)
  if (!/^[a-f0-9]{40}$/.test(candidateRevision)) {
    throw new Error('An immutable candidate revision is required.')
  }
  const checkout = config.project.runtimeCheckoutPath
  if ((await realpath(checkout)) !== checkout) {
    throw new Error('Runtime checkout must be canonical.')
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

// This is a setup-only operation. An interrupted attempt leaves its directory
// in place so another invocation cannot silently rotate service credentials.
export async function prepareLocalConfiguration(config, candidateRevision) {
  const { directory } = await verifyClaim(config, candidateRevision)
  const providers = renderProviderCompose(config)
  const bootstrap = {
    name: config.project.identity,
    ...renderBackingCompose(config),
  }
  const ingestion = renderIngestionCompose(config)
  const documents = renderDocProcessingCompose(config)
  bootstrap.services['ingestion-setup'] = ingestion.services['ingestion-setup']
  bootstrap.services['doc-processing-setup'] =
    documents.services['doc-processing-setup']
  Object.assign(bootstrap.volumes, documents.volumes)
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
  await writeExclusive(join(directory, 'prepared.json'), claim)
}

export async function requirePreparation(config, candidateRevision) {
  const { directory, claim } = await verifyClaim(config, candidateRevision)
  const prepared = await readOwned(join(directory, 'prepared.json'))
  if (JSON.stringify(prepared) !== JSON.stringify(claim)) {
    throw new Error('Completed preparation does not match the runtime claim.')
  }
  return claim
}
