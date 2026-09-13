import assert from 'node:assert/strict'
import { createHash, createPrivateKey, createPublicKey } from 'node:crypto'
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { resolveIsolatedConfig } from './isolated-config.mjs'
import {
  claimPreparation as claimObservedPreparation,
  completePreparation,
  continuePreparation,
  deliverHatchetToken,
  initializeManagedApplication,
  initializeProviderLaunchers,
  initializeProviderStorage,
  inspectPreparedInfrastructure,
  inspectRuntimeCheckout,
  installManagedConfiguration,
  installProviderRouting,
  prepareLocalConfiguration,
  requirePreparation,
  resumePreparedInfrastructure as resumeInfrastructure,
  startPreparedInfrastructure as startInfrastructure,
  stopPreparedInfrastructure as stopInfrastructure,
  verifyContinuationSources,
} from './preparation.mjs'
import { providerImages, providerPorts } from './test-fixtures.mjs'

const revision = 'a'.repeat(40)

test('continuation source checks reject executor and candidate drift before reading managed files', async () => {
  const config = await fixture()
  for (const failure of ['executor', 'dirty', 'candidate-file']) {
    const git = (path, args) => {
      const runtime = path === config.project.runtimeCheckoutPath
      if (args[0] === 'status')
        return failure === 'dirty' ? ' M source.mjs' : ''
      if (args[0] === 'diff')
        return failure === 'candidate-file' ? 'source.mjs' : ''
      if (args[0] === 'ls-files') return ''
      if (args.includes('--git-dir')) return '/synthetic/.git/worktrees/runtime'
      if (args.includes('--show-toplevel')) return path
      if (args.includes('--abbrev-ref')) return 'HEAD'
      return runtime
        ? revision
        : failure === 'executor'
          ? 'c'.repeat(40)
          : 'b'.repeat(40)
    }
    await assert.rejects(
      verifyContinuationSources(config, revision, 'b'.repeat(40), false, git),
      /verified executor and candidate/
    )
  }
})

test('explicit continuation reconciles prepared stages and initializes the untouched tail once', async () => {
  for (const failure of [
    false,
    'source',
    'context',
    'partial',
    'managed',
    'unused',
    'docker-resource',
    'profile-repair',
    'profile-drift',
    'after-effect',
  ]) {
    const config = await fixture()
    await claimPreparation(config, revision)
    await prepareLocalConfiguration(config, revision)
    await initializeProviderStorage(
      config,
      revision,
      async (args) =>
        args.includes('exec') ? 'synthetic.header.signature' : '',
      unusedProject
    )
    const root = join(config.project.runtimeCheckoutPath, '.local-kb')
    const repair = ['profile-repair', 'profile-drift'].includes(failure)
    const profilePath = join(
      config.project.runtimeCheckoutPath,
      '.devrouter.yml'
    )
    if (repair) await writeFile(profilePath, 'old', { mode: 0o600 })
    await mkdir(join(root, 'managed-installation'), { mode: 0o700 })
    await writeFile(
      join(root, 'managed-installation/complete.json'),
      JSON.stringify({ candidateRevision: revision }),
      { mode: 0o600 }
    )
    await mkdir(join(root, 'provider-setup'), { mode: 0o700 })
    const original = JSON.stringify({ setupCompleted: true })
    await writeFile(join(root, 'provider-setup/scraping.json'), original, {
      mode: 0o600,
    })
    for (const name of ['scraping', 'docProcessing'])
      await mkdir(join(root, 'state', name), { recursive: true, mode: 0o700 })
    if (failure === 'partial')
      await mkdir(join(root, 'application-setup'), { mode: 0o700 })
    const calls = []
    const runner = lifecycleRunner(config)
    const options = {
      // The workspace verb reports retained allocation; the identity field in
      // the status payload must stay informational.
      runManaged: async (args) =>
        JSON.stringify(
          args[0] === 'workspace'
            ? [
                {
                  worktreePath: config.project.runtimeCheckoutPath,
                  devpodStatus: 'absent',
                  routeCount: 0,
                },
              ]
            : {
                dockerContext: 'synthetic-local',
                repo: {
                  path: config.project.runtimeCheckoutPath,
                  valid: failure !== 'managed',
                  managedRuntime: { workspace: 'synthetic-retained' },
                },
              }
        ),
      observeBacking: async () =>
        ['postgres', 'hatchet'].map((service) => ({
          service,
          state: 'exited',
        })),
      verifySources: async () => {
        if (failure === 'source') throw new Error('source mismatch')
        if (repair)
          return {
            path: profilePath,
            previous: failure === 'profile-drift' ? 'changed' : 'old',
            next: 'corrected',
          }
      },
      runDocker: async (args) =>
        args[0] === 'context'
          ? args[1] === 'show'
            ? failure === 'context'
              ? 'foreign'
              : 'synthetic-local'
            : 'unix:///synthetic/docker.sock'
          : failure === 'docker-resource' &&
              args.some((value) => value.includes('ingestion-provider-'))
            ? 'existing-resource'
            : '',
      unusedProvider:
        failure === 'docker-resource'
          ? undefined
          : async () => {
              if (failure === 'unused')
                throw new Error('existing provider resources')
            },
      run: async (command, env) => {
        if (command.args.includes('setup')) {
          calls.push(command.cwd.split('/').at(-1))
          if (failure === 'after-effect') throw new Error('withheld')
          return '{}'
        }
        return runner(command, env)
      },
      initializeApplication: async () => {
        calls.push('application')
        await mkdir(join(root, 'application-setup'), { mode: 0o700 })
        await writeFile(
          join(root, 'application-setup/complete.json'),
          JSON.stringify({
            candidateRevision: revision,
            context: 'synthetic-local',
            workspace: 'synthetic',
          }),
          { mode: 0o600 }
        )
      },
    }
    const execute = () =>
      continuePreparation(config, revision, 'b'.repeat(40), options)
    if (failure && failure !== 'profile-repair') {
      await assert.rejects(execute())
      assert.deepEqual(calls, failure === 'after-effect' ? ['ingestion'] : [])
      if (failure === 'after-effect') {
        await assert.rejects(execute())
        assert.deepEqual(calls, ['ingestion'])
      }
      if (failure === 'docker-resource') {
        await assert.rejects(stat(join(root, 'setup-continuation')), {
          code: 'ENOENT',
        })
        await assert.rejects(
          stat(join(root, 'provider-setup/ingestion.json')),
          { code: 'ENOENT' }
        )
      }
    } else {
      assert.equal((await execute()).prepared, true)
      assert.deepEqual(calls, ['ingestion', 'retrieval', 'application'])
      await assert.rejects(execute())
      assert.deepEqual(calls, ['ingestion', 'retrieval', 'application'])
    }
    if (repair)
      assert.equal(
        await readFile(profilePath, 'utf8'),
        failure === 'profile-repair' ? 'corrected' : 'old'
      )
    assert.equal(
      await readFile(join(root, 'provider-setup/scraping.json'), 'utf8'),
      original
    )
  }
})

test('missing AI injection rejects setup, start and resume before any state or provider access', async (t) => {
  const previous = process.env.UPSTREAM_OPENAI_API_KEY
  delete process.env.UPSTREAM_OPENAI_API_KEY
  t.after(() => {
    if (previous !== undefined) process.env.UPSTREAM_OPENAI_API_KEY = previous
  })
  const config = { ...(await fixture()), aiUpstream: 'openrouter' }
  const unexpected = () => assert.fail('must reject before side effects')
  await assert.rejects(
    claimObservedPreparation(config, revision, unexpected),
    /runtime-injected/
  )
  for (const operation of [
    initializeManagedApplication,
    startInfrastructure,
    resumeInfrastructure,
  ]) {
    await assert.rejects(
      operation(config, revision, unexpected, unexpected, unexpected),
      /runtime-injected/
    )
  }
  await assert.rejects(
    stat(join(config.project.runtimeCheckoutPath, '.local-kb')),
    { code: 'ENOENT' }
  )
})

function lifecycleRunner(config) {
  return async (command, environment) => {
    const name = Object.keys(config.providers).find(
      (key) => config.providers[key].sourcePath === command.cwd
    )
    if (name === 'retrieval') {
      assert.equal(
        environment.KLICKER_LOCAL_RETRIEVAL_MILVUS_URI,
        config.bindings.hostBases.milvus
      )
      assert.equal(
        environment.KLICKER_LOCAL_RETRIEVAL_OPENAI_BASE_URL,
        config.bindings.hostBases.model
      )
    }
    if (!command.args.includes('status')) {
      assert.ok(command.args.includes('start') || command.args.includes('stop'))
      return '{}'
    }
    const common = {
      instance: config.project.identity,
      source_revision: config.providers[name].revision,
    }
    if (name === 'ingestion')
      return JSON.stringify({
        instance: { name: common.instance },
        source: { revision: common.source_revision },
        preparation: {
          configuration: 'prepared',
          credentials: 'prepared',
          schema: 'prepared',
        },
        process: { infrastructure: [], workloads: [] },
      })
    if (name === 'docProcessing')
      return JSON.stringify({
        ...common,
        instance_id: common.instance,
        ownership: 'verified',
        setup: 'ready',
        ready: false,
        api: 'stopped',
      })
    if (name === 'scraping')
      return JSON.stringify({
        ...common,
        owned: true,
        setup: { prepared: true },
        readiness: { api: false },
        runtime: { api: { running: false }, services: [] },
      })
    return JSON.stringify({
      ...common,
      prepared: true,
      ready: false,
      runtime: 'stopped',
    })
  }
}

const startPreparedInfrastructure = (config, revision, managed, docker) =>
  startInfrastructure(
    config,
    revision,
    managed,
    docker,
    lifecycleRunner(config)
  )
const stopPreparedInfrastructure = (config, revision, managed, docker) =>
  stopInfrastructure(config, revision, managed, docker, lifecycleRunner(config))
const resumePreparedInfrastructure = (config, revision, managed, docker) =>
  resumeInfrastructure(
    config,
    revision,
    managed,
    docker,
    lifecycleRunner(config)
  )
const claimPreparation = (config, candidate) =>
  claimObservedPreparation(config, candidate, () => true)
const unusedProject = () => ({ unused: true, context: 'synthetic-local' })

async function setupReceipts(config) {
  const directory = join(config.project.runtimeCheckoutPath, '.local-kb')
  for (const [name, receipt] of [
    ['storage-setup', { initialized: true, context: 'synthetic-local' }],
    [
      'provider-setup',
      {
        initialized: true,
        context: 'synthetic-local',
        candidateRevision: revision,
      },
    ],
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

async function installationFixture(aiUpstream) {
  const config = await fixture()
  if (aiUpstream) config.aiUpstream = aiUpstream
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

test('explicit startup orders provider activation without repeating setup and retains failures', async () => {
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
    const phases = []
    const docker = async (args) => {
      calls.push(args)
      if (args[0] === 'context') return 'unix:///synthetic/docker.sock'
      if (args.includes('ls')) return ''
      if (failure) throw new Error('synthetic private diagnostic')
      return ''
    }
    const managed = async (args) => {
      calls.push(args)
      phases.push('applications-and-model')
      return JSON.stringify({ ...identity, profile: 'ai,chat,manage' })
    }
    const provider = async (command, environment) => {
      assert.equal(environment.DOCKER_CONTEXT, 'synthetic-local')
      if (command.args.includes('start')) {
        const name = Object.keys(config.providers).find(
          (key) => config.providers[key].sourcePath === command.cwd
        )
        phases.push(name)
        if (name === 'retrieval')
          assert.ok(environment.KLICKER_LOCAL_RETRIEVAL_OPENAI_BASE_URL)
      }
      return lifecycleRunner(config)(command, environment)
    }
    const run = () =>
      startInfrastructure(config, revision, managed, docker, provider)
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
        providerWorkerActivationRequested: true,
      })
      assert.equal(calls.length, 4)
      assert.deepEqual(phases, [
        'scraping',
        'docProcessing',
        'applications-and-model',
        'ingestion',
        'retrieval',
      ])
      assert.deepEqual(calls[3], [
        'ensure',
        checkout,
        '--profile',
        'ai,chat,manage',
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
    if (!failure) {
      const shutdown = []
      await stopInfrastructure(
        config,
        revision,
        async () => {
          shutdown.push('applications-and-model')
          return JSON.stringify({ ...identity, stopped: true })
        },
        docker,
        async (command, environment) => {
          assert.equal(environment.DOCKER_CONTEXT, 'synthetic-local')
          if (command.args.includes('stop'))
            shutdown.push(
              Object.keys(config.providers).find(
                (key) => config.providers[key].sourcePath === command.cwd
              )
            )
          return lifecycleRunner(config)(command, environment)
        }
      )
      assert.deepEqual(shutdown, [
        'retrieval',
        'ingestion',
        'docProcessing',
        'scraping',
        'applications-and-model',
      ])
    }
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

test('explicit resume requires stop evidence, serializes operations and retains failures', async (t) => {
  const names = ['UPSTREAM_OPENAI_API_KEY', 'UPSTREAM_OPENAI_BASE_URL']
  const previous = names.map((name) => process.env[name])
  t.after(() =>
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name]
      else process.env[name] = previous[index]
    })
  )
  process.env.UPSTREAM_OPENAI_API_KEY = 'synthetic-resume-sentinel'
  process.env.UPSTREAM_OPENAI_BASE_URL = 'https://openrouter.ai/api/v1'
  const { config, checkout, read } = await installationFixture('openrouter')
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
  const writes = []
  let fail = false
  let pending
  const docker = async (args) => {
    if (args[0] === 'context') return 'unix:///synthetic/docker.sock'
    if (args.includes('ls')) return ''
    writes.push(args)
    if (pending) await pending
    if (fail) throw new Error('synthetic private failure')
    return ''
  }
  const managed = async (args, aiUpstream) => {
    assert.equal(aiUpstream, args[0] === 'ensure' ? 'openrouter' : undefined)
    writes.push(args)
    return JSON.stringify({
      ...identity,
      profile: 'ai,chat,manage',
      stopped: true,
    })
  }
  const resume = () =>
    resumePreparedInfrastructure(config, revision, managed, docker)
  await assert.rejects(resume(), { code: 'ENOENT' })
  assert.equal(writes.length, 0)
  await stopPreparedInfrastructure(config, revision, managed, docker)
  await startPreparedInfrastructure(config, revision, managed, docker)
  await assert.rejects(resume(), /successful stop/)
  for (let cycle = 0; cycle < 2; cycle++) {
    delete process.env.UPSTREAM_OPENAI_API_KEY
    await stopPreparedInfrastructure(config, revision, managed, docker)
    const before = writes.length
    await assert.rejects(resume(), /runtime-injected/)
    assert.equal(writes.length, before)
    process.env.UPSTREAM_OPENAI_API_KEY = 'synthetic-resume-sentinel'
    assert.equal((await resume()).providerWorkerActivationRequested, true)
    await assert.rejects(resume(), /successful stop/)
  }
  const launches = writes.filter((args) => args.includes('up'))
  assert.equal(launches.length, 3)
  for (const launch of launches) assert.deepEqual(launch, launches[0])
  assert.ok(
    writes.every(
      (args) =>
        !args.some((arg) =>
          /migrat|seed|callback|dispatcher|doc-query/.test(arg)
        )
    )
  )
  await stopPreparedInfrastructure(config, revision, managed, docker)
  let release
  pending = new Promise((resolve) => {
    release = resolve
  })
  const active = resume()
  // Wait for the synthetic runner to enter the startup operation.
  while (writes.filter((args) => args.includes('up')).length < 4) {
    await new Promise((resolve) => setImmediate(resolve))
  }
  await assert.rejects(resume(), { code: 'EEXIST' })
  await assert.rejects(
    stopPreparedInfrastructure(config, revision, managed, docker),
    { code: 'EEXIST' }
  )
  fail = true
  release()
  await assert.rejects(active, /partial state is retained/)
  pending = undefined
  const count = writes.length
  await assert.rejects(resume(), /incomplete/)
  await assert.rejects(
    startPreparedInfrastructure(config, revision, managed, docker),
    { code: 'EEXIST' }
  )
  assert.equal(writes.length, count)
  fail = false
  assert.deepEqual(
    await stopPreparedInfrastructure(config, revision, managed, docker),
    { stopped: true, dataRetained: true }
  )
  await assert.rejects(resume(), /incomplete/)
})

test('interrupted stop evidence permits shutdown but not resume', async () => {
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
  const writes = []
  const docker = async (args) => {
    if (args[0] === 'context') return 'unix:///synthetic/docker.sock'
    if (args.includes('ls')) return ''
    writes.push(args)
    return ''
  }
  const managed = async (args) => {
    writes.push(args)
    return JSON.stringify({
      ...identity,
      profile: 'ai,chat,manage',
      stopped: true,
    })
  }
  await startPreparedInfrastructure(config, revision, managed, docker)
  const root = join(checkout, '.local-kb/infrastructure-stop')
  await mkdir(root, { mode: 0o700 })
  const attempt = join(root, 'attempt-1')
  await mkdir(attempt, { mode: 0o700 })
  for (let retry = 0; retry < 2; retry++) {
    const before = writes.length
    assert.deepEqual(
      await stopPreparedInfrastructure(config, revision, managed, docker),
      { stopped: true, dataRetained: true }
    )
    assert.equal(writes.length, before + 2)
    assert.ok(writes.slice(before).every((args) => args.includes('stop')))
    await assert.rejects(
      resumePreparedInfrastructure(config, revision, managed, docker),
      /incomplete/
    )
    await assert.rejects(stat(join(attempt, 'complete.json')), {
      code: 'ENOENT',
    })
  }
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
  const managedObservation = {
    dockerContext: 'synthetic-local',
    repo: {
      path: checkout,
      valid: true,
      managedRuntime: {
        mode: 'managed',
        workspace: 'synthetic-runtime',
        status: 'ready',
        profile: 'ai,chat,manage',
        activeProfile: 'ai,chat,manage',
        drift: [],
      },
    },
  }
  const observeManaged = async (args) => {
    assert.deepEqual(args, ['status', '--repo', checkout, '--json'])
    return JSON.stringify(managedObservation)
  }
  const observeProvider = async (command) => {
    const name = Object.keys(config.providers).find(
      (key) => config.providers[key].sourcePath === command.cwd
    )
    assert.ok(command.args.includes('status'))
    const common = {
      instance: config.project.identity,
      source_revision: config.providers[name].revision,
    }
    if (name === 'ingestion')
      return JSON.stringify({
        instance: { name: common.instance },
        source: { revision: common.source_revision },
        preparation: {},
        process: { infrastructure: [], workloads: [] },
      })
    if (name === 'docProcessing')
      return JSON.stringify({
        ...common,
        instance_id: common.instance,
        ownership: 'verified',
        setup: 'ready',
        ready: false,
      })
    if (name === 'scraping')
      return JSON.stringify({
        ...common,
        owned: true,
        setup: { prepared: true },
        readiness: { api: false },
      })
    return JSON.stringify({ ...common, prepared: true, ready: false })
  }
  const status = await inspectPreparedInfrastructure(
    config,
    revision,
    docker,
    observeManaged,
    observeProvider
  )
  assert.deepEqual(status.providers, [
    { service: 'postgres', state: 'running', health: 'unreported' },
  ])
  assert.equal(status.aiQualified, false)
  assert.equal(status.launchers.length, 4)
  assert.ok(
    status.launchers.every((row) => !row.endpointReady && !row.aiQualified)
  )
  assert.equal(status.infrastructureHealthy, false)
  assert.deepEqual(
    status.infrastructure.find(({ service }) => service === 'postgres'),
    { service: 'postgres', status: 'readiness-unverified' }
  )
  assert.deepEqual(
    status.infrastructure.find(({ service }) => service === 'blob'),
    { service: 'blob', status: 'missing' }
  )
  const services = status.infrastructure.map(({ service }) => service)
  for (const condition of [
    'healthy',
    'starting',
    'unhealthy',
    'exited',
    'duplicate',
  ]) {
    const observed =
      condition === 'duplicate' ? [...services, services[0]] : services
    const ids = observed.map((_, index) =>
      (index + 1).toString(16).padStart(12, '0')
    )
    const observation = async (args) => {
      if (args[0] === 'context') return 'unix:///synthetic/docker.sock'
      if (args.includes('ls')) return ids.join('\n')
      assert.ok(args.includes('inspect'))
      return [
        config.project.identity,
        directory,
        join(directory, 'providers.compose.json'),
        observed[ids.indexOf(args.at(-1))],
        condition === 'exited' ? 'exited' : 'running',
        ['starting', 'unhealthy'].includes(condition) ? condition : 'healthy',
      ].join('|')
    }
    const result = await inspectPreparedInfrastructure(
      config,
      revision,
      observation,
      observeManaged,
      observeProvider
    )
    assert.equal(result.infrastructureHealthy, condition === 'healthy')
    assert.equal(result.aiQualified, false)
    assert.equal(result.managedRuntimeObserved, true)
    assert.equal(result.managedRuntimeReady, true)
  }
  for (const change of [
    { status: 'stopped' },
    { status: 'drifted', drift: ['synthetic drift'] },
    { profile: 'local-kb-setup', activeProfile: 'local-kb-setup' },
    { activeProfile: undefined },
  ]) {
    const observation = structuredClone(managedObservation)
    Object.assign(observation.repo.managedRuntime, change)
    const result = await inspectPreparedInfrastructure(
      config,
      revision,
      docker,
      async () => JSON.stringify(observation),
      observeProvider
    )
    assert.equal(result.managedRuntimeObserved, true)
    assert.equal(result.managedRuntimeReady, false)
    assert.equal(
      result.managedRuntimeStatus,
      observation.repo.managedRuntime.status
    )
    assert.equal(result.aiQualified, false)
  }
  for (const change of [
    (value) => {
      value.dockerContext = 'other'
    },
    (value) => {
      value.repo.path = '/synthetic/other'
    },
    (value) => {
      value.repo.managedRuntime.workspace = 'other'
    },
    (value) => {
      value.repo.managedRuntime.status = 'unknown'
    },
    (value) => {
      value.repo.managedRuntime.drift = null
    },
  ]) {
    const observation = structuredClone(managedObservation)
    change(observation)
    await assert.rejects(
      inspectPreparedInfrastructure(config, revision, docker, async () =>
        JSON.stringify(observation)
      ),
      /observation is unavailable or mismatched/
    )
  }
  for (const observe of [
    async () => 'synthetic malformed response',
    async () => {
      throw new Error('synthetic private diagnostic')
    },
  ]) {
    await assert.rejects(
      inspectPreparedInfrastructure(config, revision, docker, observe),
      { message: 'Managed runtime observation is unavailable or mismatched.' }
    )
  }
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
          ingestion: 'a'.repeat(40),
          scraping: 'b'.repeat(40),
          retrieval: '8'.repeat(40),
          docProcessing: 'd'.repeat(40),
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
    ports: providerPorts(),
    images: { ...providerImages },
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
  await assert.rejects(
    requirePreparation({ ...config, aiUpstream: 'openrouter' }, revision),
    /identity/
  )
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

test('provider setup invokes supported launchers once and retains partial failure', async () => {
  for (const failure of [false, 'docProcessing', 'malformed', 'context']) {
    const config = await fixture()
    await claimPreparation(config, revision)
    await prepareLocalConfiguration(config, revision)
    await initializeProviderStorage(
      config,
      revision,
      async (args) =>
        args.includes('exec') ? 'synthetic.header.signature' : '',
      unusedProject
    )
    const calls = []
    const run = async (command, env) => {
      assert.equal(env.DOCKER_CONTEXT, 'synthetic-local')
      const provider = command.cwd.split('/').at(-1)
      calls.push({ provider, args: command.args, env })
      if (provider === failure) throw new Error('synthetic private diagnostic')
      if (failure === 'malformed') return '{}'
      const instance = config.project.identity
      const source_revision = config.providers[provider].revision
      return JSON.stringify(
        provider === 'ingestion'
          ? {
              instance: { name: instance },
              source: { revision: source_revision },
              preparation: {
                configuration: 'prepared',
                credentials: 'prepared',
                schema: 'prepared',
              },
            }
          : provider === 'docProcessing'
            ? { instance_id: instance, source_revision, setup: 'ready' }
            : { instance, source_revision, prepared: true }
      )
    }
    const docker = async (args) =>
      args[1] === 'show'
        ? failure === 'context'
          ? 'other'
          : 'synthetic-local'
        : 'unix:///synthetic/docker.sock'
    const execute = () =>
      initializeProviderLaunchers(config, revision, run, docker)
    if (failure) {
      await assert.rejects(execute(), /context|partial state/)
    } else {
      assert.deepEqual(await execute(), { providersInitialized: true })
      assert.deepEqual(
        calls.map(({ provider }) => provider),
        ['scraping', 'docProcessing', 'ingestion', 'retrieval']
      )
      assert.equal(
        calls.at(-1).env.KLICKER_LOCAL_RETRIEVAL_MILVUS_URI,
        config.bindings.hostBases.milvus
      )
      assert.ok(
        calls.every(
          ({ args }) => args.includes('setup') && !args.includes('start')
        )
      )
    }
    const count = calls.length
    if (failure === 'context') assert.equal(count, 0)
    else {
      await assert.rejects(execute(), { code: 'EEXIST' })
      assert.equal(calls.length, count)
    }
    if (failure === 'docProcessing') {
      assert.deepEqual(
        calls.map(({ provider }) => provider),
        ['scraping', 'docProcessing']
      )
      const path = join(
        config.project.runtimeCheckoutPath,
        '.local-kb/provider-setup'
      )
      assert.equal(
        JSON.parse(await readFile(join(path, 'scraping.json'), 'utf8'))
          .setupCompleted,
        true
      )
      await assert.rejects(stat(join(path, 'complete.json')), {
        code: 'ENOENT',
      })
    }
  }
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
    ['postgres', 'hatchet-setup', 'hatchet', '/config/authdisabled-token']
  )
  await assert.rejects(requirePreparation(config, revision), { code: 'ENOENT' })
  await assert.rejects(
    initializeProviderStorage(config, revision, run, unusedProject),
    {
      code: 'EEXIST',
    }
  )
  assert.equal(calls.length, 4)
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
        assert.ok(compose.volumes.postgres)
        assert.equal(compose.volumes['document-processing'], undefined)
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
  const environment = join(directory, 'ingestion-worker.env')
  const bootstrapPath = join(directory, 'bootstrap.compose.json')
  const bootstrap = JSON.parse(await readFile(bootstrapPath, 'utf8'))
  assert.equal(bootstrap.name, config.project.identity)
  assert.equal((await stat(bootstrapPath)).mode & 0o777, 0o600)
  assert.ok(bootstrap.services['hatchet-setup'])
  assert.equal(bootstrap.services['ingestion-api'], undefined)
  const providers = JSON.parse(
    await readFile(join(directory, 'providers.compose.json'), 'utf8')
  )
  assert.equal(providers.services['ingestion-api'], undefined)
  assert.equal(providers.services['doc-query'], undefined)
  assert.equal(providers.volumes.milvus, undefined)
  for (const name of [
    'ingestion-api.env',
    'ingestion-worker.env',
    'doc-processing.json',
    'scraping-api-key',
    'retrieval-environment.json',
  ]) {
    assert.equal((await stat(join(directory, name))).mode & 0o777, 0o600)
  }
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

const continuationContext = 'synthetic-local'
const priorExecutor = 'e'.repeat(40)
const nextExecutor = 'f'.repeat(40)

async function pendingIngestionFixture() {
  const retained = await retainedContinuationPrefix({ profileAttempt: true })
  const { config, root } = retained
  const failed = continuationRunner(config, root, { setupFailure: true })
  await assert.rejects(
    continuePreparation(config, revision, nextExecutor, {
      ...failed.options,
      resumeExecutor: priorExecutor,
    })
  )
  const state = join(root, 'state/ingestion')
  await mkdir(join(state, 'project-configs'), { recursive: true, mode: 0o700 })
  const project = `ingestion-provider-${config.project.identity}-${createHash('sha256').update(`${config.providers.ingestion.sourcePath}:${state}`).digest('hex').slice(0, 12)}`
  const p = config.bindings.ports.ingestion
  const manifest = {
    version: 1,
    owner: 'provider-local-launcher',
    source_root: config.providers.ingestion.sourcePath,
    source_revision: config.providers.ingestion.revision,
    instance: config.project.identity,
    state_dir: state,
    config_dir: join(state, 'project-configs'),
    compose_project: project,
    project_configs_fingerprint: 'a'.repeat(64),
    preparation: {
      configuration: 'pending',
      credentials: 'pending',
      schema: 'pending',
    },
    process: { infrastructure: 'stopped' },
    runtime: {
      ports: {
        hatchet_http: p.hatchetHttp,
        hatchet_grpc: p.hatchetGrpc,
        pgvector: p.postgres,
        azurite: p.azurite,
        milvus: p.milvus,
        milvus_health: p.milvusHealth,
        milvus_attu: p.milvusAttu,
      },
      state_dsn_sha256: 'b'.repeat(64),
      service_urls_sha256: 'c'.repeat(64),
    },
    workload: {
      fingerprint: 'd'.repeat(64),
      configuration: {
        INGESTION_LOCAL_WORKER_IMAGE: config.bindings.images.worker,
        INGESTION_LOCAL_API_IMAGE: config.bindings.images.api,
        INGESTION_LOCAL_RUNTIME_ENV_FILE: join(root, 'ingestion-worker.env'),
        INGESTION_LOCAL_API_ENV_FILE: join(root, 'ingestion-api.env'),
        INGESTION_LOCAL_PRODUCER_REGISTRY_DIR: join(root, 'producer-registry'),
        INGESTION_LOCAL_API_PORT: String(p.api),
        INGESTION_LOCAL_DISPATCHER_PORT: String(p.dispatcher),
      },
    },
  }
  await writeFile(
    join(state, '.provider-local-launcher.json'),
    JSON.stringify(manifest),
    { mode: 0o600 }
  )
  await writeFile(join(state, 'compose-project'), project, { mode: 0o600 })
  const base = continuationRunner(config, root)
  let prepared = false
  const calls = []
  const options = {
    ...base.options,
    resumeIngestionExecutor: nextExecutor,
    portOccupied: async () => false,
    run: async (command, env) => {
      const name = Object.keys(config.providers).find(
        (key) => config.providers[key].sourcePath === command.cwd
      )
      if (command.args.includes('setup')) {
        calls.push(name)
        await readFile(
          join(
            root,
            'setup-continuation/resume-after-ingestion',
            `${name}-intent.json`
          )
        )
        if (name === 'ingestion') prepared = true
        return '{}'
      }
      const status = JSON.parse(await base.options.run(command, env))
      if (name === 'ingestion' && !prepared)
        status.preparation = manifest.preparation
      return JSON.stringify(status)
    },
  }
  return { ...retained, state, manifest, options, calls }
}

test('pending ingestion recovery preserves predecessors and runs unfinished providers once', async () => {
  const f = await pendingIngestionFixture()
  const before = await readFile(join(f.child, 'claim.json'), 'utf8')
  const result = await continuePreparation(
    f.config,
    revision,
    '9'.repeat(40),
    f.options
  )
  assert.equal(result.prepared, true)
  assert.deepEqual(f.calls, ['ingestion', 'retrieval'])
  assert.equal(await readFile(join(f.child, 'claim.json'), 'utf8'), before)
  await assert.rejects(
    continuePreparation(f.config, revision, '9'.repeat(40), f.options)
  )
  assert.deepEqual(f.calls, ['ingestion', 'retrieval'])
})

test('pending ingestion recovery rejects credential residue, occupied ports and foreign lineage', async () => {
  for (const change of ['token', 'port', 'lineage', 'resources']) {
    const f = await pendingIngestionFixture()
    if (change === 'token')
      await writeFile(join(f.state, 'ingestion.env'), 'synthetic', {
        mode: 0o600,
      })
    if (change === 'port') f.options.portOccupied = async () => true
    if (change === 'lineage') f.options.resumeIngestionExecutor = '0'.repeat(40)
    if (change === 'resources') {
      const original = f.options.runDocker
      f.options.runDocker = async (args) =>
        args.some((arg) =>
          arg.startsWith('label=com.docker.compose.project=ingestion-provider-')
        )
          ? 'owned-resource'
          : original(args)
    }
    await assert.rejects(
      continuePreparation(f.config, revision, '9'.repeat(40), f.options)
    )
    assert.deepEqual(f.calls, [], change)
  }
})

test('failed ingestion recovery retains intent and prevents downstream work or replay', async () => {
  const f = await pendingIngestionFixture()
  let attempts = 0
  const run = f.options.run
  f.options.run = async (command, env) => {
    if (command.args.includes('setup')) {
      attempts++
      throw new Error('synthetic dependency failure')
    }
    return run(command, env)
  }
  await assert.rejects(
    continuePreparation(f.config, revision, '9'.repeat(40), f.options),
    /synthetic dependency failure/
  )
  const recovery = join(f.root, 'setup-continuation/resume-after-ingestion')
  assert.deepEqual((await readdir(recovery)).sort(), [
    'bootstrap-intent.json',
    'claim.json',
    'ingestion-intent.json',
  ])
  await assert.rejects(
    continuePreparation(f.config, revision, '9'.repeat(40), f.options)
  )
  assert.equal(attempts, 1)
  assert.deepEqual(f.calls, [])
})

test('continuation rejects combined recovery modes before runtime effects', async () => {
  const { config, root } = await retainedContinuationPrefix({
    profileAttempt: true,
  })
  const { calls, options } = continuationRunner(config, root)
  await assert.rejects(
    continuePreparation(config, revision, nextExecutor, {
      ...options,
      resumeExecutor: priorExecutor,
      resumeIngestionExecutor: nextExecutor,
    })
  )
  assert.deepEqual(calls, [])
  assert.deepEqual((await readdir(join(root, 'setup-continuation'))).sort(), [
    'claim.json',
    'setup-profile-intent.json',
  ])
})

// Rebuild the retained prefix the profile-repair executor left behind: one
// private attempt holding its claim and profile intent, with scraping complete,
// document processing reconcilable and ingestion/retrieval untouched.
async function retainedContinuationPrefix({ profileAttempt = false } = {}) {
  const config = await fixture()
  const claim = await claimPreparation(config, revision)
  await prepareLocalConfiguration(config, revision)
  await initializeProviderStorage(
    config,
    revision,
    async (args) => (args.includes('exec') ? 'synthetic.header.signature' : ''),
    unusedProject
  )
  const root = join(config.project.runtimeCheckoutPath, '.local-kb')
  await mkdir(join(root, 'managed-installation'), { mode: 0o700 })
  await writeFile(
    join(root, 'managed-installation/complete.json'),
    JSON.stringify({ candidateRevision: revision }),
    { mode: 0o600 }
  )
  await mkdir(join(root, 'provider-setup'), { mode: 0o700 })
  await writeFile(
    join(root, 'provider-setup/scraping.json'),
    JSON.stringify({ setupCompleted: true }),
    { mode: 0o600 }
  )
  for (const name of ['scraping', 'docProcessing'])
    await mkdir(join(root, 'state', name), { recursive: true, mode: 0o700 })
  const parent = join(root, 'setup-continuation')
  const child = join(parent, 'resume-after-profile')
  if (profileAttempt) {
    await mkdir(parent, { mode: 0o700 })
    await writeFile(
      join(parent, 'claim.json'),
      JSON.stringify({
        ...claim,
        executor: priorExecutor,
        context: continuationContext,
      }),
      { mode: 0o600 }
    )
    await writeFile(
      join(parent, 'setup-profile-intent.json'),
      JSON.stringify({ candidate: revision, executor: priorExecutor }),
      { mode: 0o600 }
    )
  }
  return { config, claim, root, parent, child }
}

function continuationRunner(config, root, overrides = {}) {
  const calls = []
  const observed = {}
  const runner = lifecycleRunner(config)
  const options = {
    runDocker: async (args) => {
      if (args[0] === 'context')
        return args[1] === 'show'
          ? continuationContext
          : 'unix:///synthetic/docker.sock'
      if (args.includes('compose') && args.includes('start')) {
        observed.composeStart = [...args]
        // The bootstrap intent must exist inside the current attempt before
        // the bootstrap services are started.
        observed.intentAtStart = await readFile(
          join(
            root,
            'setup-continuation',
            'resume-after-profile',
            'bootstrap-intent.json'
          ),
          'utf8'
        )
      }
      return overrides.docker ? overrides.docker(args) : ''
    },
    runManaged: async (args) =>
      JSON.stringify(
        args[0] === 'workspace'
          ? (overrides.workspace ?? [
              {
                worktreePath: config.project.runtimeCheckoutPath,
                devpodStatus: 'absent',
                routeCount: 0,
              },
            ])
          : {
              dockerContext: continuationContext,
              repo: {
                path: config.project.runtimeCheckoutPath,
                valid: true,
                managedRuntime: { workspace: 'synthetic-retained' },
              },
            }
      ),
    observeBacking: async () =>
      overrides.backing ??
      ['postgres', 'hatchet'].map((service) => ({
        service,
        state: 'exited',
      })),
    verifySources: async () => overrides.profileRepair,
    run: async (command, env) => {
      if (command.args.includes('setup')) {
        calls.push(command.cwd.split('/').at(-1))
        if (overrides.setupFailure) throw new Error('withheld')
        return '{}'
      }
      return runner(command, env)
    },
    unusedProvider: async () => {},
    initializeApplication: async () => {
      calls.push('application')
      await mkdir(join(root, 'application-setup'), { mode: 0o700 })
      await writeFile(
        join(root, 'application-setup/complete.json'),
        JSON.stringify({
          candidateRevision: revision,
          context: continuationContext,
          workspace: 'synthetic',
        }),
        { mode: 0o600 }
      )
    },
  }
  return { calls, observed, options }
}

test('managed workspace allocation must be exactly absent with zero routes', async () => {
  const cases = [
    ['missing', () => []],
    [
      'duplicate',
      (config) => [
        {
          worktreePath: config.project.runtimeCheckoutPath,
          devpodStatus: 'absent',
          routeCount: 0,
        },
        {
          worktreePath: config.project.runtimeCheckoutPath,
          devpodStatus: 'absent',
          routeCount: 0,
        },
      ],
    ],
    [
      'owned',
      (config) => [
        {
          worktreePath: config.project.runtimeCheckoutPath,
          devpodStatus: 'running',
          routeCount: 0,
        },
      ],
    ],
    [
      'unknown',
      (config) => [
        {
          worktreePath: config.project.runtimeCheckoutPath,
          devpodStatus: 'unknown',
          routeCount: 0,
        },
      ],
    ],
    [
      'routes',
      (config) => [
        {
          worktreePath: config.project.runtimeCheckoutPath,
          devpodStatus: 'absent',
          routeCount: 1,
        },
      ],
    ],
    [
      'other-path',
      () => [
        {
          worktreePath: '/synthetic/checkouts/elsewhere',
          devpodStatus: 'absent',
          routeCount: 0,
        },
      ],
    ],
  ]
  for (const [name, build] of cases) {
    const { config, root } = await retainedContinuationPrefix()
    const { options } = continuationRunner(config, root, {
      workspace: build(config),
    })
    await assert.rejects(
      continuePreparation(config, revision, nextExecutor, options),
      /Managed runtime allocation must be absent with zero routes/,
      name
    )
  }
})

test('retained application runtime labels reject continuation before effects', async () => {
  for (const label of [
    'devcontainer.local_folder',
    'devpod.workspace.source',
  ]) {
    const { config, root } = await retainedContinuationPrefix()
    const exact = `label=${label}=${config.project.runtimeCheckoutPath}`
    const { options } = continuationRunner(config, root, {
      docker: (args) => (args.includes(exact) ? 'abcdef012345\n' : ''),
    })
    await assert.rejects(
      continuePreparation(config, revision, nextExecutor, options),
      /Retained application runtime already exists/,
      label
    )
  }
})

test('profile resume requires the exact retained attempt and creates one exclusive child', async () => {
  const cases = [
    ['missing-attempt', { profileAttempt: false }, { code: 'ENOENT' }],
    [
      'extra-entry',
      {
        setup: ({ parent }) =>
          writeFile(join(parent, 'extra.json'), '{}', { mode: 0o600 }),
      },
      /Profile resume does not match the retained prefix/,
    ],
    [
      'claim-drift',
      {
        setup: ({ parent }) =>
          writeFile(
            join(parent, 'claim.json'),
            JSON.stringify({ executor: nextExecutor }),
            { mode: 0o600 }
          ),
      },
      /Profile resume does not match the retained prefix/,
    ],
    [
      'intent-drift',
      {
        setup: ({ parent }) =>
          writeFile(
            join(parent, 'setup-profile-intent.json'),
            JSON.stringify({
              candidate: '0'.repeat(40),
              executor: priorExecutor,
            }),
            { mode: 0o600 }
          ),
      },
      /Profile resume does not match the retained prefix/,
    ],
    [
      'prefix-drift',
      {
        setup: ({ root }) =>
          writeFile(
            join(root, 'provider-setup/docProcessing.json'),
            JSON.stringify({ setupCompleted: true }),
            { mode: 0o600 }
          ),
      },
      /Retained provider prefix has changed/,
    ],
    [
      'bootstrap-bytes',
      {
        setup: ({ root }) =>
          writeFile(
            join(root, 'bootstrap.compose.json'),
            JSON.stringify({ name: 'drifted' }),
            { mode: 0o600 }
          ),
      },
      /Retained bootstrap composition has changed/,
    ],
    [
      'backing-running',
      {
        backing: ['postgres', 'hatchet'].map((service) => ({
          service,
          state: service === 'postgres' ? 'running' : 'exited',
        })),
      },
      /Continuation requires the original owned bootstrap containers/,
    ],
    [
      'profile-repair',
      {
        profileRepair: {
          path: '/synthetic/.devrouter.yml',
          previous: 'old',
          next: 'new',
        },
      },
      /Profile resume requires a corrected profile and original executor/,
    ],
    [
      'invalid-resume-executor',
      { resumeExecutor: 'not-a-sha' },
      /Profile resume requires a corrected profile and original executor/,
    ],
    // A prior resume left its child inside the exclusive attempt, so reentry
    // is refused by the parent inventory rather than a second mkdir.
    [
      'reentry',
      {
        setup: ({ parent }) =>
          mkdir(join(parent, 'resume-after-profile'), { mode: 0o700 }),
      },
      /Profile resume does not match the retained prefix/,
    ],
  ]
  for (const [name, overrides, expected] of cases) {
    const profileAttempt = overrides.profileAttempt !== false
    const { config, root, parent } = await retainedContinuationPrefix({
      profileAttempt,
    })
    const claimPath = join(parent, 'claim.json')
    const intentPath = join(parent, 'setup-profile-intent.json')
    await overrides.setup?.({ root, parent })
    const before = profileAttempt
      ? await Promise.all([
          readFile(claimPath, 'utf8'),
          readFile(intentPath, 'utf8'),
        ])
      : undefined
    const { calls, options } = continuationRunner(config, root, overrides)
    await assert.rejects(
      continuePreparation(config, revision, nextExecutor, {
        ...options,
        resumeExecutor: overrides.resumeExecutor ?? priorExecutor,
      }),
      expected,
      name
    )
    assert.deepEqual(calls, [], name)
    if (profileAttempt)
      assert.deepEqual(
        await Promise.all([
          readFile(claimPath, 'utf8'),
          readFile(intentPath, 'utf8'),
        ]),
        before,
        name
      )
  }

  // One exclusive child, with the parent receipts left exactly as found.
  const { config, claim, root, parent, child } =
    await retainedContinuationPrefix({ profileAttempt: true })
  const { calls, observed, options } = continuationRunner(config, root)
  const before = await Promise.all([
    readFile(join(parent, 'claim.json'), 'utf8'),
    readFile(join(parent, 'setup-profile-intent.json'), 'utf8'),
  ])
  const resumeOptions = { ...options, resumeExecutor: priorExecutor }
  const result = await continuePreparation(
    config,
    revision,
    nextExecutor,
    resumeOptions
  )
  assert.equal(result.prepared, true)
  assert.deepEqual(calls, ['ingestion', 'retrieval', 'application'])
  assert.equal(observed.composeStart !== undefined, true)
  assert.equal(
    observed.intentAtStart,
    JSON.stringify({ candidate: revision, executor: nextExecutor })
  )
  assert.deepEqual((await readdir(parent)).sort(), [
    'claim.json',
    'resume-after-profile',
    'setup-profile-intent.json',
  ])
  assert.deepEqual(
    await Promise.all([
      readFile(join(parent, 'claim.json'), 'utf8'),
      readFile(join(parent, 'setup-profile-intent.json'), 'utf8'),
    ]),
    before
  )
  assert.deepEqual((await readdir(child)).sort(), [
    'bootstrap-intent.json',
    'claim.json',
    'complete.json',
    'docProcessing-reconciliation.json',
    'ingestion-intent.json',
    'retrieval-intent.json',
  ])
  assert.equal(
    await readFile(join(child, 'claim.json'), 'utf8'),
    JSON.stringify({
      ...claim,
      executor: nextExecutor,
      context: continuationContext,
      resumeExecutor: priorExecutor,
    })
  )
  assert.equal(
    await readFile(join(child, 'bootstrap-intent.json'), 'utf8'),
    JSON.stringify({ candidate: revision, executor: nextExecutor })
  )
  await assert.rejects(
    continuePreparation(config, revision, nextExecutor, resumeOptions)
  )
  assert.deepEqual(calls, ['ingestion', 'retrieval', 'application'])

  // A failure after the child claim retains the child and its receipts.
  const failed = await retainedContinuationPrefix({ profileAttempt: true })
  const failure = continuationRunner(failed.config, failed.root, {
    setupFailure: true,
  })
  const failureOptions = {
    ...failure.options,
    resumeExecutor: priorExecutor,
  }
  await assert.rejects(
    continuePreparation(failed.config, revision, nextExecutor, failureOptions),
    /withheld/
  )
  assert.deepEqual(failure.calls, ['ingestion'])
  assert.deepEqual((await readdir(failed.child)).sort(), [
    'bootstrap-intent.json',
    'claim.json',
    'docProcessing-reconciliation.json',
    'ingestion-intent.json',
  ])
  await assert.rejects(
    continuePreparation(failed.config, revision, nextExecutor, failureOptions)
  )
  assert.deepEqual(failure.calls, ['ingestion'])
})
