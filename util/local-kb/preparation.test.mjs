import assert from 'node:assert/strict'
import { createPrivateKey, createPublicKey } from 'node:crypto'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { docProcessingImageRevision } from './doc-processing-compose.mjs'
import { ingestionImageRevision } from './ingestion-compose.mjs'
import { resolveIsolatedConfig } from './isolated-config.mjs'
import {
  claimPreparation as claimObservedPreparation,
  completePreparation,
  deliverHatchetToken,
  initializeManagedApplication,
  initializeProviderStorage,
  inspectPreparedInfrastructure,
  inspectRuntimeCheckout,
  installManagedConfiguration,
  installProviderRouting,
  prepareLocalConfiguration,
  requirePreparation,
  startPreparedInfrastructure,
  stopPreparedInfrastructure,
} from './preparation.mjs'
import { retrievalImageRevision } from './retrieval-compose.mjs'
import { scrapingImageRevision } from './scraping-compose.mjs'

const revision = 'a'.repeat(40)
const claimPreparation = (config, candidate) =>
  claimObservedPreparation(config, candidate, () => true)
const unusedProject = () => ({ unused: true, context: 'synthetic-local' })

async function setupReceipts(config) {
  const directory = join(config.project.runtimeCheckoutPath, '.local-kb')
  for (const [name, receipt] of [
    ['storage-setup', { initialized: true, context: 'synthetic-local' }],
    [
      'application-setup',
      {
        candidateRevision: revision,
        workspace: 'synthetic-runtime',
        context: 'synthetic-local',
      },
    ],
  ]) {
    await mkdir(join(directory, name), { mode: 0o700 })
    await writeFile(
      join(directory, name, 'complete.json'),
      JSON.stringify(receipt),
      { mode: 0o600 }
    )
  }
}

async function installationFixture() {
  const config = await fixture()
  const checkout = config.project.runtimeCheckoutPath
  await mkdir(join(checkout, '.devcontainer'))
  const paths = [
    '.devcontainer/devcontainer.json',
    '.devcontainer/docker-compose.yml',
    '.devcontainer/docker-compose.devrouter.yml',
    '.devrouter.yml',
  ]
  const inputs = new Map()
  for (const path of paths) {
    const content = await readFile(
      new URL(`../../${path}`, import.meta.url),
      'utf8'
    )
    inputs.set(path, content)
    await writeFile(join(checkout, path), content)
  }
  await claimPreparation(config, revision)
  return {
    config,
    checkout,
    inputs,
    read: (root, candidate, path) => {
      assert.equal(root, checkout)
      assert.equal(candidate, revision)
      return inputs.get(path)
    },
  }
}

test('managed installation replaces only candidate config and neutralizes the linked overlay', async () => {
  const { config, checkout, read } = await installationFixture()
  assert.deepEqual(await installManagedConfiguration(config, revision, read), {
    installed: true,
  })
  const json = async (path) =>
    JSON.parse(await readFile(join(checkout, path), 'utf8'))
  assert.deepEqual(
    (await json('.devcontainer/devcontainer.json')).dockerComposeFile,
    ['docker-compose.yml', 'docker-compose.devrouter.yml']
  )
  assert.deepEqual(await json('.devcontainer/docker-compose.devrouter.yml'), {
    services: {},
  })
  assert.equal(
    (await json('.devcontainer/docker-compose.yml')).services.postgres,
    undefined
  )
  await assert.rejects(
    stat(join(checkout, '.local-kb/provider-routing.compose.json')),
    { code: 'ENOENT' }
  )
  for (const result of [
    { kind: 'primary', workspace: 'synthetic-runtime' },
    { kind: 'linked', workspace: '../unsafe' },
  ]) {
    await assert.rejects(installProviderRouting(config, revision, result))
  }
  const result = {
    kind: 'linked',
    workspace: 'synthetic-runtime',
    repoPath: checkout,
    profile: 'local-kb-setup',
  }
  await assert.rejects(
    installProviderRouting(config, revision, {
      ...result,
      repoPath: '/synthetic/other',
    }),
    /linked checkout/
  )
  await installProviderRouting(config, revision, result)
  assert.equal(
    (await json('.local-kb/provider-routing.compose.json')).services.blob
      .networks.devnet.aliases[0],
    'synthetic-runtime-azurite'
  )
  await assert.rejects(installProviderRouting(config, revision, result), {
    code: 'EEXIST',
  })
  await assert.rejects(
    installManagedConfiguration(config, revision, read),
    /differs from the candidate/
  )
})

test('application setup initializes once and retains failures without replay', async () => {
  for (const failure of [false, 'application', 'blob']) {
    const { config, checkout, read } = await installationFixture()
    await prepareLocalConfiguration(config, revision)
    await installManagedConfiguration(config, revision, read)
    await initializeProviderStorage(
      config,
      revision,
      async (args) =>
        args.includes('exec') ? 'synthetic.header.signature' : '',
      unusedProject
    )
    const calls = []
    const managed = async (args) => {
      calls.push(args)
      if (args[0] === 'ensure')
        return JSON.stringify({
          kind: 'linked',
          repoPath: checkout,
          workspace: 'synthetic-runtime',
          profile: 'local-kb-setup',
        })
      if (failure === 'application')
        throw new Error('synthetic private error must not escape')
      return ''
    }
    const docker = async (args) => {
      calls.push(args)
      assert.ok(args.includes('--wait'))
      assert.equal(args.at(-1), 'blob')
      if (failure === 'blob') throw new Error('synthetic Blob unavailable')
      return ''
    }
    const run = () =>
      initializeManagedApplication(config, revision, managed, docker)
    if (failure) {
      await assert.rejects(
        run(),
        /^Error: Managed application setup failed; partial state is retained and output withheld\.$/
      )
      assert.equal(calls.length, failure === 'blob' ? 2 : 3)
    } else {
      assert.deepEqual(await run(), { initialized: true })
      assert.equal(calls.length, 5)
      assert.ok(calls[2].includes('prisma:push:raw'))
      assert.ok(calls[3].includes('seed:raw'))
      assert.ok(calls[4].includes('src/scripts/setupLocalBlobStorage.ts'))
    }
    const before = calls.length
    await assert.rejects(run(), { code: 'EEXIST' })
    assert.equal(calls.length, before)
    await assert.rejects(requirePreparation(config, revision), {
      code: 'ENOENT',
    })
  }
})

test('prepared infrastructure starts without migrations or consumers and retains failures', async () => {
  for (const failure of [false, true]) {
    const { config, checkout, read } = await installationFixture()
    await prepareLocalConfiguration(config, revision)
    await installManagedConfiguration(config, revision, read)
    const identity = {
      kind: 'linked',
      repoPath: checkout,
      workspace: 'synthetic-runtime',
      profile: 'local-kb-setup',
    }
    await installProviderRouting(config, revision, identity)
    await setupReceipts(config)
    await completePreparation(config, revision)
    const calls = []
    const docker = async (args) => {
      calls.push(args)
      if (args[0] === 'context') return 'unix:///synthetic/docker.sock'
      if (args.includes('ls')) return ''
      if (failure) throw new Error('synthetic private diagnostic')
      return ''
    }
    const managed = async (args) => {
      calls.push(args)
      return JSON.stringify({ ...identity, profile: 'manage,chat' })
    }
    const run = () =>
      startPreparedInfrastructure(config, revision, managed, docker)
    if (failure) {
      await assert.rejects(
        run(),
        /partial state is retained and output withheld/
      )
      assert.equal(calls.length, 3)
    } else {
      assert.deepEqual(await run(), {
        infrastructureStarted: true,
        aiQualified: false,
        workersStarted: false,
      })
      assert.equal(calls.length, 4)
      assert.deepEqual(calls[3], [
        'ensure',
        checkout,
        '--profile',
        'manage,chat',
        '--json',
      ])
    }
    assert.equal(
      calls
        .flat()
        .some((value) =>
          /worker|dispatcher|callback|seed|migrat|doc-query/.test(value)
        ),
      false
    )
    const before = calls.length
    await assert.rejects(run(), { code: 'EEXIST' })
    // The repeated local-context observation is read-only.
    assert.equal(calls.length, before + 2)
  }
})

test('changed managed input prevents all installation writes', async () => {
  const { config, checkout, inputs, read } = await installationFixture()
  await writeFile(join(checkout, '.devrouter.yml'), 'changed')
  await assert.rejects(
    installManagedConfiguration(config, revision, read),
    /differs from the candidate/
  )
  assert.equal(
    await readFile(join(checkout, '.devcontainer/devcontainer.json'), 'utf8'),
    inputs.get('.devcontainer/devcontainer.json')
  )
  await assert.rejects(stat(join(checkout, '.local-kb/managed-installation')), {
    code: 'ENOENT',
  })
})

test('status is read-only and stop refuses foreign provider ownership', async () => {
  const { config, checkout, read } = await installationFixture()
  await prepareLocalConfiguration(config, revision)
  await installManagedConfiguration(config, revision, read)
  await installProviderRouting(config, revision, {
    kind: 'linked',
    repoPath: checkout,
    workspace: 'synthetic-runtime',
    profile: 'local-kb-setup',
  })
  await setupReceipts(config)
  await completePreparation(config, revision)
  let foreign = true
  let stopped = false
  let remainsRunning = true
  const writes = []
  const directory = join(checkout, '.local-kb')
  const docker = async (args) => {
    if (args[0] === 'context') return 'unix:///synthetic/docker.sock'
    if (args.includes('ls')) return 'abcdef123456'
    if (args.includes('inspect'))
      return [
        config.project.identity,
        foreign ? '/synthetic/other' : directory,
        join(directory, 'providers.compose.json'),
        'postgres',
        stopped && !remainsRunning ? 'exited' : 'running',
        'unreported',
      ].join('|')
    writes.push(args)
    stopped = true
    return ''
  }
  const managed = async (args) => {
    writes.push(args)
    return JSON.stringify({
      stopped: true,
      kind: 'linked',
      repoPath: checkout,
      workspace: 'synthetic-runtime',
    })
  }
  const remoteDocker = async (args) => {
    assert.equal(args[0], 'context')
    return 'tcp://synthetic.invalid:2376'
  }
  for (const operation of [
    () => startPreparedInfrastructure(config, revision, managed, remoteDocker),
    () => stopPreparedInfrastructure(config, revision, managed, remoteDocker),
    () => inspectPreparedInfrastructure(config, revision, remoteDocker),
  ]) {
    await assert.rejects(operation(), /local Docker context/)
    assert.equal(writes.length, 0)
  }
  await assert.rejects(
    stopPreparedInfrastructure(config, revision, managed, docker),
    /ownership/
  )
  assert.equal(writes.length, 0)
  foreign = false
  const status = await inspectPreparedInfrastructure(config, revision, docker)
  assert.deepEqual(status.providers, [
    { service: 'postgres', state: 'running', health: 'unreported' },
  ])
  assert.equal(status.aiQualified, false)
  assert.equal(writes.length, 0)
  await assert.rejects(
    stopPreparedInfrastructure(config, revision, managed, docker),
    /Provider shutdown is incomplete/
  )
  remainsRunning = false
  assert.deepEqual(
    await stopPreparedInfrastructure(config, revision, managed, docker),
    { stopped: true, dataRetained: true }
  )
  assert.deepEqual(writes[0], ['stop', checkout, '--json'])
  assert.equal(writes[1].at(-1), 'stop')
  assert.equal(
    writes
      .flat()
      .some((value) => ['down', 'rm', '--volumes', 'delete'].includes(value)),
    false
  )
})

test('interrupted installation remains claimed and cannot be replayed', async () => {
  const { config, checkout, inputs, read } = await installationFixture()
  await mkdir(join(checkout, '.local-kb/managed-installation'))
  await assert.rejects(installManagedConfiguration(config, revision, read), {
    code: 'EEXIST',
  })
  await assert.rejects(installManagedConfiguration(config, revision, read), {
    code: 'EEXIST',
  })
  assert.equal(
    await readFile(join(checkout, '.devcontainer/devcontainer.json'), 'utf8'),
    inputs.get('.devcontainer/devcontainer.json')
  )
  await assert.rejects(
    stat(join(checkout, '.local-kb/managed-installation/complete.json')),
    { code: 'ENOENT' }
  )
})
async function fixture() {
  const checkout = await realpath(
    await mkdtemp(join(tmpdir(), 'kb-preparation-'))
  )
  const providers = Object.fromEntries(
    ['ingestion', 'scraping', 'retrieval', 'docProcessing'].map((name) => [
      name,
      {
        path: `/synthetic/providers/${name}`,
        revision: {
          ingestion: ingestionImageRevision,
          scraping: scrapingImageRevision,
          retrieval: retrievalImageRevision,
          docProcessing: docProcessingImageRevision,
        }[name],
      },
    ])
  )
  return resolveIsolatedConfig({
    primaryCheckoutPath: '/synthetic/primary',
    runtimeCheckoutPath: checkout,
    retainedCheckoutPaths: ['/synthetic/retained'],
    projectIdentity: 'isolated-preparation-test',
    retainedProjectIdentities: [],
    retainedMutableVolumeNames: [],
    retainedEndpointOrigins: [],
    providerRoots: providers,
    providerObservations: Object.fromEntries(
      Object.entries(providers).map(([name, value]) => [
        name,
        { ...value, clean: true },
      ])
    ),
    endpoints: Object.fromEntries(
      [
        'klicker',
        'postgres',
        'hatchet',
        'redis',
        'blob',
        'ingestion',
        'dispatcher',
        'callback',
        'scraping',
        'crawl4ai',
        'milvus',
        'objectBacking',
        'retrieval',
        'docProcessing',
      ].map((name, i) => [name, `http://127.0.0.1:${19000 + i}/health`])
    ),
  })
}

test('runtime observation requires the exact detached candidate without ignored or tracked state', () => {
  const observations = [
    '/synthetic/runtime',
    revision,
    'HEAD',
    '/synthetic/primary/.git/worktrees/runtime',
    '',
  ]
  const inspect = (values) => {
    let index = 0
    return inspectRuntimeCheckout(
      '/synthetic/runtime',
      revision,
      () => values[index++]
    )
  }
  assert.equal(inspect(observations), true)
  for (const [index, value] of [
    [0, '/synthetic/other'],
    [1, 'b'.repeat(40)],
    [2, 'rs/implementation'],
    [3, '.git'],
    [4, ' M tracked'],
    [4, '?? untracked'],
    [4, '!! ignored-state'],
  ]) {
    const altered = [...observations]
    altered[index] = value
    assert.equal(inspect(altered), false)
  }
  assert.equal(
    inspectRuntimeCheckout('/synthetic/runtime', revision, () => {
      throw new Error('unavailable')
    }),
    false
  )
})

test('failed runtime observation leaves no preparation claim', async () => {
  const config = await fixture()
  await assert.rejects(
    claimObservedPreparation(config, revision, () => false),
    /clean detached checkout/
  )
  await assert.rejects(
    stat(join(config.project.runtimeCheckoutPath, '.local-kb')),
    {
      code: 'ENOENT',
    }
  )
})

test('exclusive preparation retains partial failure and never implicitly retries setup', async () => {
  const config = await fixture()
  const claims = await Promise.allSettled([
    claimPreparation(config, revision),
    claimPreparation(config, revision),
  ])
  assert.equal(claims.filter(({ status }) => status === 'fulfilled').length, 1)
  await assert.rejects(requirePreparation(config, revision), { code: 'ENOENT' })
  await assert.rejects(claimPreparation(config, revision), { code: 'EEXIST' })
  await assert.rejects(completePreparation(config, revision), {
    code: 'ENOENT',
  })
  await setupReceipts(config)
  await completePreparation(config, revision)
  assert.equal(
    (await requirePreparation(config, revision)).candidateRevision,
    revision
  )
  await assert.rejects(completePreparation(config, revision), {
    code: 'EEXIST',
  })
})

test('candidate or configuration changes invalidate prepared state without changing it', async () => {
  const config = await fixture()
  await claimPreparation(config, revision)
  await setupReceipts(config)
  await completePreparation(config, revision)
  const path = join(
    config.project.runtimeCheckoutPath,
    '.local-kb/prepared.json'
  )
  const before = await readFile(path, 'utf8')
  await assert.rejects(requirePreparation(config, 'b'.repeat(40)), /identity/)
  const altered = structuredClone(config)
  altered.endpoints.postgres.url = 'http://127.0.0.1:25000/health'
  await assert.rejects(requirePreparation(altered, revision), /configuration/)
  assert.equal(await readFile(path, 'utf8'), before)
})

test('Hatchet token delivery is private, one-shot and rejects injectable output', async () => {
  const config = await fixture()
  await claimPreparation(config, revision)
  await assert.rejects(
    deliverHatchetToken(config, revision, 'invalid\nINJECTED=value'),
    /valid token shape/
  )
  const token = 'synthetic.header.signature'
  assert.deepEqual(await deliverHatchetToken(config, revision, `${token}\n`), {
    delivered: true,
  })
  const path = join(
    config.project.runtimeCheckoutPath,
    '.local-kb/hatchet-client.env'
  )
  assert.equal((await stat(path)).mode & 0o777, 0o600)
  const original = await readFile(path, 'utf8')
  assert.ok(original.includes(`HATCHET_CLIENT_TOKEN=${token}\n`))
  await assert.rejects(
    deliverHatchetToken(config, revision, 'another.token.value'),
    {
      code: 'EEXIST',
    }
  )
  assert.equal(await readFile(path, 'utf8'), original)
})

test('storage setup runs migrations once and does not qualify the full runtime', async () => {
  const config = await fixture()
  await claimPreparation(config, revision)
  await prepareLocalConfiguration(config, revision)
  const calls = []
  const run = async (args) => {
    calls.push(args)
    return args.includes('exec') ? 'synthetic.header.signature' : ''
  }
  assert.deepEqual(
    await initializeProviderStorage(config, revision, run, unusedProject),
    {
      storageInitialized: true,
    }
  )
  assert.deepEqual(
    calls.map((args) => args.at(-1)),
    [
      'postgres',
      'hatchet-setup',
      'ingestion-setup',
      'doc-processing-setup',
      'hatchet',
      '/config/authdisabled-token',
    ]
  )
  await assert.rejects(requirePreparation(config, revision), { code: 'ENOENT' })
  await assert.rejects(
    initializeProviderStorage(config, revision, run, unusedProject),
    {
      code: 'EEXIST',
    }
  )
  assert.equal(calls.length, 6)
  assert.equal(
    (
      await stat(
        join(config.project.runtimeCheckoutPath, '.local-kb/hatchet-client.env')
      )
    ).mode & 0o777,
    0o600
  )
})

test('storage setup stops on failure, suppresses provider output and refuses replay', async () => {
  const config = await fixture()
  await claimPreparation(config, revision)
  await prepareLocalConfiguration(config, revision)
  let calls = 0
  const run = async () => {
    calls += 1
    if (calls === 2) throw new Error('synthetic-sensitive-provider-output')
  }
  await assert.rejects(
    initializeProviderStorage(config, revision, run, unusedProject),
    (error) => {
      assert.equal(
        error.message.includes('synthetic-sensitive-provider-output'),
        false
      )
      return true
    }
  )
  await assert.rejects(
    initializeProviderStorage(config, revision, run, unusedProject),
    {
      code: 'EEXIST',
    }
  )
  assert.equal(calls, 2)
})

test('storage collision prevents every setup command', async () => {
  const config = await fixture()
  await claimPreparation(config, revision)
  await prepareLocalConfiguration(config, revision)
  await assert.rejects(
    initializeProviderStorage(
      config,
      revision,
      async () => assert.fail('must not mutate Docker'),
      (compose) => {
        assert.ok(compose.volumes.milvus)
        assert.ok(compose.volumes['document-processing'])
        return { unused: false, reason: 'existing-project-or-storage' }
      }
    ),
    /not confirmed unused/
  )
})

test('preexisting state, exposed evidence and symlinked state are rejected', async () => {
  const config = await fixture()
  const directory = join(config.project.runtimeCheckoutPath, '.local-kb')
  await symlink('/synthetic/unowned', directory)
  await assert.rejects(claimPreparation(config, revision), { code: 'EEXIST' })

  const other = await fixture()
  await claimPreparation(other, revision)
  const claim = join(
    other.project.runtimeCheckoutPath,
    '.local-kb/preparation.json'
  )
  await chmod(claim, 0o644)
  await assert.rejects(completePreparation(other, revision), /owner-only/)
  await chmod(claim, 0o600)
  await writeFile(claim, '{}')
  await assert.rejects(completePreparation(other, revision), /identity/)
})

test('configuration setup writes private local material once without completing preparation', async () => {
  const config = await fixture()
  await claimPreparation(config, revision)
  assert.deepEqual(await prepareLocalConfiguration(config, revision), {
    configured: true,
  })
  const directory = join(config.project.runtimeCheckoutPath, '.local-kb')
  const environment = join(directory, 'ingestion.env')
  const bootstrapPath = join(directory, 'bootstrap.compose.json')
  const bootstrap = JSON.parse(await readFile(bootstrapPath, 'utf8'))
  assert.equal(bootstrap.name, config.project.identity)
  assert.equal((await stat(bootstrapPath)).mode & 0o777, 0o600)
  assert.ok(bootstrap.services['hatchet-setup'])
  assert.equal(bootstrap.services['ingestion-api'], undefined)
  const providers = JSON.parse(
    await readFile(join(directory, 'providers.compose.json'), 'utf8')
  )
  assert.ok(providers.services['ingestion-api'])
  assert.ok(providers.services['doc-query'])
  assert.ok(providers.volumes.milvus)
  // Hatchet publishes this file in the separate storage-initialization phase.
  await deliverHatchetToken(config, revision, 'synthetic.header.signature')
  for (const service of Object.values(providers.services)) {
    for (const entry of service.env_file ?? []) {
      assert.equal((await stat(entry.path)).isFile(), true)
      assert.equal((await stat(entry.path)).mode & 0o777, 0o600)
    }
  }
  const before = await readFile(environment, 'utf8')
  assert.equal((await stat(environment)).mode & 0o777, 0o600)
  assert.equal((await stat(directory)).mode & 0o777, 0o700)
  assert.equal(
    (await stat(join(directory, 'producer-registry'))).mode & 0o777,
    0o755
  )
  assert.equal(
    (await stat(join(directory, 'producer-registry/klicker.yaml'))).mode &
      0o777,
    0o644
  )
  assert.equal(
    (await stat(join(directory, 'postgres-init/01-databases.sql'))).mode &
      0o777,
    0o644
  )
  await assert.rejects(prepareLocalConfiguration(config, revision), {
    code: 'EEXIST',
  })
  assert.equal(await readFile(environment, 'utf8'), before)
  await assert.rejects(requirePreparation(config, revision), { code: 'ENOENT' })
  const registry = JSON.parse(
    await readFile(join(directory, 'producer-registry/klicker.yaml'), 'utf8')
  )
  assert.equal(
    registry.auth.credential_secret_ref,
    'ingestion-producer-klicker'
  )
  const projectPath = join(
    directory,
    'project-configs',
    `${registry.producer.allowed_projects[0]}.yaml`
  )
  const project = JSON.parse(await readFile(projectPath, 'utf8'))
  assert.equal(project.project_name, registry.producer.allowed_projects[0])
  assert.equal(project.artifacts.enabled, true)
  assert.equal((await stat(projectPath)).mode & 0o777, 0o644)
  const chatPath = join(directory, 'chat.env')
  assert.equal((await stat(chatPath)).mode & 0o777, 0o600)
  const chat = Object.fromEntries(
    (await readFile(chatPath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1)]
      })
  )
  const reader = JSON.parse(
    await readFile(
      join(directory, 'doc-query-tools/knowledge-bases.yaml'),
      'utf8'
    )
  )
  const verification = reader.token_scope.verification
  assert.equal(verification.issuer, chat.DOC_QUERY_SCOPE_ISSUER)
  assert.equal(verification.audience, chat.DOC_QUERY_SCOPE_AUDIENCE)
  assert.equal(verification.keys[0].kid, chat.DOC_QUERY_SCOPE_KID)
  const publicKey = createPublicKey(
    createPrivateKey(chat.DOC_QUERY_SCOPE_PRIVATE_KEY.replaceAll('\\n', '\n'))
  )
  assert.equal(
    publicKey.export({ type: 'spki', format: 'pem' }),
    verification.keys[0].pem
  )
})
