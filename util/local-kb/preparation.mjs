import { execFileSync } from 'node:child_process'
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, realpath } from 'node:fs/promises'
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
