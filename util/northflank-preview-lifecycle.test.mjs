import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assemblePreviewArguments,
  createNorthflankPreviewLifecycleDriver,
  createPreviewLifecycleState,
  createSerializedPreviewLifecycle,
  DEFAULT_PREVIEW_LIFECYCLE_LIMITS,
  PreviewLifecycleError,
  planPreviewReconciliation,
  runCli,
} from './northflank-preview-lifecycle.mjs'

const REPOSITORY = 'example-org/klicker-uzh'
const REVISION_A = 'a'.repeat(40)
const REVISION_B = 'b'.repeat(40)
const REVISION_C = 'c'.repeat(40)
const REVISION_D = 'd'.repeat(40)
const STARTED_AT = 1_000_000
const DEADLINE = STARTED_AT + 60_000

function initialState(limits = {}) {
  return createPreviewLifecycleState({
    startedAt: STARTED_AT,
    deadline: DEADLINE,
    limits,
  })
}

function resource(binding, kind = 'app') {
  return { binding, kind }
}

function plan({
  revision = REVISION_A,
  eventName = 'pull_request',
  sourceBranch = 'feature/test',
  profile = ['chat'],
  resources = [resource('chat'), resource('postgres', 'data-service')],
  builds = 2,
  fixturesRequired = true,
  label = 'preview',
} = {}) {
  return {
    schemaVersion: 1,
    status: 'planning-ready',
    sha: { candidate: revision },
    provenance: { candidate: { sha: revision, status: 'verified' } },
    sourceSelection: {
      eventName,
      sourceBranch,
      repository: REPOSITORY,
      headRepository: REPOSITORY,
      state: eventName === 'pull_request' ? 'open' : null,
      merged: eventName === 'pull_request' ? false : null,
      isFork: eventName === 'pull_request' ? false : null,
      eligible: true,
      labels: eventName === 'pull_request' ? [label] : [],
      manualOptIn: false,
      branchAllowlist: ['v3-ai'],
      pullRequestPolicy: { label, manualOptIn: true },
    },
    profile: { canonical: profile },
    resources: {
      bindings: resources,
      dataResources: resources
        .filter((entry) => entry.kind === 'data-service')
        .map((entry) => entry.binding),
    },
    images: {
      builds: Array.from({ length: builds }, () => ({ binding: 'image' })),
    },
    postgresFixturesRequired: fixturesRequired,
    recreationRequired: false,
    reuseEligibility: { eligible: true, reasons: [] },
    effects: { providerCredentialsRead: false, runtimeStarted: false },
  }
}

function pullRequest({
  number = 1,
  revision = REVISION_A,
  sequence = 1,
  state = 'open',
  merged = false,
  isFork = false,
  labels = ['preview'],
  manualOptIn = false,
  obsolete = false,
  repository = REPOSITORY,
  headRepository = REPOSITORY,
} = {}) {
  return {
    eventName: 'pull_request',
    repository,
    headRepository,
    number,
    revision,
    sequence,
    state,
    merged,
    isFork,
    labels,
    manualOptIn,
    obsolete,
  }
}

function push({ branch = 'v3-ai', revision = REVISION_A, sequence = 1 } = {}) {
  return {
    eventName: 'push',
    repository: REPOSITORY,
    branch,
    revision,
    sequence,
  }
}

function environmentEvent(
  eventName,
  number = 1,
  sequence = 2,
  revision = REVISION_A
) {
  return {
    eventName,
    repository: REPOSITORY,
    headRepository: REPOSITORY,
    number,
    revision,
    sequence,
    state: 'open',
    merged: false,
    isFork: false,
    labels: ['preview'],
    manualOptIn: false,
  }
}

function receiptFor(action) {
  return {
    settled: true,
    environmentId: action.environmentId,
    resources: action.resources.map(({ binding, state }) => ({
      binding,
      state,
    })),
    buildAttempts: action.buildAttemptsReserved,
    fixturesSeeded: action.fixturesSeeded,
    retryPolicy: 'none',
  }
}

function recordingDriver({ firstGate } = {}) {
  const calls = []
  let first = true
  return {
    calls,
    async applyLifecycle(action) {
      calls.push(structuredClone(action))
      if (first && firstGate) {
        first = false
        await firstGate
      }
      first = false
      return receiptFor(action)
    },
  }
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof PreviewLifecycleError)
    assert.equal(error.code, code)
    return true
  })
}

const NATIVE_PROJECT = 'preview-project'
const NATIVE_ENVIRONMENT = 'pr-42'
const NATIVE_LIFECYCLE_ENVIRONMENT = `${REPOSITORY}#pull/1`

function nativeResource(
  binding,
  nativeType = 'service',
  kind = nativeType === 'addon' ? 'data-service' : 'app'
) {
  const id = `${nativeType}-${binding}`
  const segment = nativeType === 'service' ? 'services' : 'addons'
  return {
    binding,
    nativeType,
    kind,
    id,
    endpoint: `/v1/projects/${NATIVE_PROJECT}/${segment}/${id}`,
    ...(nativeType === 'service'
      ? { uid: `${nativeType}-${binding}`.padEnd(24, '0') }
      : { createdAt: `2026-01-01T00:00:00.${binding.length}Z` }),
  }
}

function nativeOwnership(resources) {
  return {
    schemaVersion: 1,
    projectId: NATIVE_PROJECT,
    environmentId: NATIVE_ENVIRONMENT,
    lifecycleEnvironmentId: NATIVE_LIFECYCLE_ENVIRONMENT,
    resources,
  }
}

function nativeAction(command, resources, overrides = {}) {
  return {
    schemaVersion: 1,
    command,
    environmentId: NATIVE_LIFECYCLE_ENVIRONMENT,
    resources: resources.map((resource) => ({
      binding: resource.binding,
      kind: resource.kind,
      data: resource.nativeType === 'addon',
      state:
        command === 'delete'
          ? 'deleted'
          : command === 'pause' && resource.nativeType === 'addon'
            ? 'active'
            : command === 'pause'
              ? 'paused'
              : 'active',
    })),
    buildAttemptsReserved: 0,
    fixturesSeeded: false,
    retryPolicy: 'none',
    providerDefaults: false,
    ...overrides,
  }
}

function nativeRead(resource, overrides = {}) {
  return {
    status: 200,
    body: {
      data: {
        id: resource.id,
        uid: resource.uid,
        createdAt: resource.createdAt,
        ...overrides,
      },
    },
  }
}

function nativeHarness(resources, { write, read } = {}) {
  const byEndpoint = new Map(
    resources.map((resource) => [resource.endpoint, resource])
  )
  const calls = []
  return {
    calls,
    async request(call) {
      calls.push(structuredClone(call))
      if (call.method === 'GET') {
        const resource = byEndpoint.get(call.endpoint)
        return read?.(call, resource) ?? nativeRead(resource)
      }
      return write?.(call, calls) ?? { status: 202 }
    },
  }
}

const CHAT_RESOURCES = [
  'auth',
  'chat',
  'pwa',
  'api',
  'postgres',
  'redis_cache',
  'redis_exec',
  'redis_assessment',
  'hatchet',
  'litellm',
  'klicker-local-mcp',
  'migrator',
]

function argumentPlan({
  resources = CHAT_RESOURCES,
  revision = REVISION_A,
  fixturesRequired = false,
} = {}) {
  const data = new Set([
    'postgres',
    'redis_cache',
    'redis_exec',
    'redis_assessment',
  ])
  const images = new Set(['migrator', 'worker-general', 'worker-response'])
  const services = new Set(['litellm', 'oidc', 'mailhog', 'azurite'])
  return {
    schemaVersion: 1,
    status: 'planning-ready',
    sha: { controller: REVISION_D, candidate: revision },
    provenance: {
      controller: { sha: REVISION_D, status: 'verified' },
      candidate: { sha: revision, status: 'verified' },
    },
    sourceSelection: {
      sourceBranch: 'feature/test',
      repository: REPOSITORY,
      eligible: true,
    },
    resources: {
      bindings: resources.map((binding) => ({
        binding,
        kind: data.has(binding)
          ? 'data-service'
          : images.has(binding)
            ? 'image'
            : binding === 'postgres-fixtures'
              ? 'fixture-job'
              : binding === 'klicker-local-mcp'
                ? 'process'
                : services.has(binding)
                  ? 'service'
                  : 'app',
      })),
    },
    postgresFixturesRequired: fixturesRequired,
    recreationRequired: false,
    reuseEligibility: { eligible: true },
    effects: { providerCredentialsRead: false, runtimeStarted: false },
  }
}

function argumentAction(
  plan,
  { command = 'create', migrate = true, seedFixtures = false } = {}
) {
  const resources = plan.resources.bindings.map(({ binding }) => binding)
  return {
    command,
    revision: plan.sha.candidate,
    migrate,
    seedFixtures,
    pauseResources: command === 'pause' ? resources : [],
    resumeResources: command === 'resume' ? resources : [],
  }
}

function previewEnvironment(envId, domain = 'preview.example.test') {
  const origin = (app) => `https://${envId}--${app}.${domain}`
  return {
    COOKIE_DOMAIN: `.${domain}`,
    APP_ORIGIN_API: origin('api'),
    APP_ORIGIN_AUTH: origin('auth'),
    APP_ORIGIN_MANAGE: origin('manage'),
    APP_ORIGIN_PWA: origin('pwa'),
    APP_ORIGIN_LTI: origin('lti'),
    APP_ORIGIN_ASSESSMENT_API: origin('api'),
    APP_ORIGIN_ASSESSMENT_PWA: origin('pwa'),
    NEXTAUTH_URL: origin('auth'),
  }
}

function argumentInputs(
  plan,
  { envId = 'pr-42', command = 'create', admitted = true } = {}
) {
  const image = (binding) => ({
    serviceId: `service-${binding}`,
    buildId: `build-${binding}`,
    branch: 'feature/test',
  })
  const images = Object.fromEntries(
    [
      'api',
      'auth',
      'chat',
      'control',
      'fixtures',
      'localMcp',
      'lti',
      'manage',
      'mcpLecturer',
      'mcpStudent',
      'migrator',
      'olatApi',
      'pwa',
      'responseApi',
      'workerGeneral',
      'workerResponse',
    ].map((binding) => [binding, image(binding)])
  )
  for (const binding of ['azurite', 'litellm', 'mailhog', 'oidc']) {
    images[binding] = { image: `registry.example/${binding}@sha256:111` }
  }
  const secrets = Object.fromEntries(
    [
      'appDatabaseUrl',
      'appSecret',
      'fixtureDatabaseUrl',
      'hatchetClientToken',
      'hatchetDatabaseUrl',
      'localMcpGeneration',
      'localMcpPrivateKey',
      'localMcpPublicKey',
      'localMcpToken',
      'migrationDatabaseUrl',
      'nextauthSecret',
      'redisAssessmentPass',
      'redisCachePass',
      'redisExecPass',
    ].map((key) => [key, `synthetic-${key}`])
  )
  return {
    plan,
    action: argumentAction(plan, {
      command,
      seedFixtures: command === 'create' && plan.postgresFixturesRequired,
    }),
    admitted,
    runtime: {
      envId,
      projectId: 'preview-project',
      domain: 'preview.example.test',
      allowedIp: '203.0.113.10',
      lifetimeSeconds: 3600,
    },
    source: {
      repository: REPOSITORY,
      ref: 'feature/test',
      headSha: plan.sha.candidate,
      controllerSha: plan.sha.controller,
    },
    config: {
      runtimeEnvironment: previewEnvironment(envId),
      jobs: {
        schemaMigration: { entrypoint: 'node', command: 'migrate.js' },
        fixtures: { entrypoint: 'node', command: 'fixtures.js' },
      },
      files: {
        litellmConfig: {
          data: 'synthetic-litellm-config',
          encoding: 'utf-8',
        },
        localMcpFixture: {
          data: 'synthetic-local-mcp-fixture',
          encoding: 'utf-8',
        },
        localMcpDocuments: {
          data: 'synthetic-local-mcp-documents',
          encoding: 'utf-8',
        },
      },
      configuration: {
        oidcJson: 'synthetic-oidc-json',
      },
    },
    images,
    credentials: {
      secrets,
      bindings: {
        localMcp: {
          host: `${envId}-local-mcp`,
          issuer: 'synthetic-issuer',
          audience: 'synthetic-audience',
        },
        redisAssessment: { host: `${envId}-assessment`, port: 6379 },
        redisCache: { host: `${envId}-cache`, port: 6379 },
        redisExec: { host: `${envId}-exec`, port: 6379 },
      },
    },
  }
}

test('assembler fails before provider use when a referenced image field is absent', () => {
  const input = argumentInputs(argumentPlan())
  input.images.chat.buildId = undefined
  assert.throws(
    () => assemblePreviewArguments(input),
    (error) => {
      assert.equal(error.code, 'MISSING_PREVIEW_ARGUMENT')
      assert.match(error.message, /images\.chat\.buildId/)
      assert.doesNotMatch(
        `${error.message}${error.details ?? ''}`,
        /synthetic-/
      )
      return true
    }
  )
})

test('Chat assembly selects its closure and excludes management and workers', () => {
  const args = assemblePreviewArguments(argumentInputs(argumentPlan()))
  for (const selected of [
    'api',
    'auth',
    'chat',
    'localMcp',
    'pwa',
    'litellm',
  ]) {
    assert.equal(args.skip[selected], 'false', selected)
  }
  for (const excluded of [
    'manage',
    'responseApi',
    'workerGeneral',
    'workerResponse',
  ]) {
    assert.equal(args.skip[excluded], 'true', excluded)
  }
  const paused = assemblePreviewArguments(
    argumentInputs(argumentPlan(), { command: 'pause' })
  )
  assert.equal(paused.startInstances, 0)
  for (const key of [
    'schemaMigration',
    'fixtures',
    'runMigration',
    'runFixtures',
  ]) {
    assert.equal(paused.skip[key], 'true', key)
  }
})

test('full assembly carries workers and keeps lifecycle graphs idle', () => {
  const plan = argumentPlan({
    resources: [
      ...CHAT_RESOURCES,
      'control',
      'manage',
      'response-api',
      'worker-general',
      'worker-response',
      'lti',
      'olat-api',
      'mcp-lecturer',
      'mcp-student',
      'oidc',
      'mailhog',
      'azurite',
      'postgres-fixtures',
    ],
    fixturesRequired: true,
  })
  const created = assemblePreviewArguments(argumentInputs(plan))
  const updated = assemblePreviewArguments(
    argumentInputs(plan, { command: 'update' })
  )
  assert.equal(created.skip.postgres, 'false')
  assert.equal(created.skip.fixtures, 'false')
  assert.equal(created.skip.runFixtures, 'false')
  assert.deepEqual(created.images.workerGeneral, {
    serviceId: 'service-workerGeneral',
    buildId: 'build-workerGeneral',
    branch: 'feature/test',
  })
  assert.equal(
    created.images.oidc.image.startsWith('registry.example/oidc@'),
    true
  )
  assert.equal(updated.startInstances, 1)
  assert.equal(updated.skip.postgres, 'true')
  assert.equal(updated.skip.hatchet, 'true')
  assert.equal(updated.skip.fixtures, 'true')

  for (const command of ['pause', 'resume']) {
    const idle = assemblePreviewArguments(argumentInputs(plan, { command }))
    assert.equal(idle.startInstances, 0)
    assert.equal(
      Object.values(idle.skip).every((value) => value === 'true'),
      true
    )
    assert.equal(idle.runtimeEnvironment, undefined)
    assert.equal(idle.jobs, undefined)
    assert.deepEqual(idle.images, {})
    assert.deepEqual(idle.secrets, {})
    assert.deepEqual(idle.bindings, {})
  }
})

test('assembler constrains preview environment namespaces', () => {
  const plan = argumentPlan()
  const maxEnvId = 'a'.repeat(32)
  const max = assemblePreviewArguments(
    argumentInputs(plan, { envId: maxEnvId })
  )
  assert.equal(max.envId, maxEnvId)
  expectCode(
    () =>
      assemblePreviewArguments(argumentInputs(plan, { envId: 'a'.repeat(33) })),
    'INVALID_INPUT'
  )

  const first = assemblePreviewArguments(
    argumentInputs(plan, { envId: 'pr-42' })
  )
  const second = assemblePreviewArguments(
    argumentInputs(plan, { envId: 'pr-43' })
  )
  assert.notEqual(
    first.runtimeEnvironment.APP_ORIGIN_PWA,
    second.runtimeEnvironment.APP_ORIGIN_PWA
  )
  assert.equal(
    first.runtimeEnvironment.APP_ORIGIN_PWA,
    'https://pr-42--pwa.preview.example.test'
  )

  const dotless = argumentInputs(plan)
  dotless.config.runtimeEnvironment.COOKIE_DOMAIN = 'preview.example.test'
  assert.equal(
    assemblePreviewArguments(dotless).runtimeEnvironment.COOKIE_DOMAIN,
    'preview.example.test'
  )
  const badCookie = argumentInputs(plan)
  badCookie.config.runtimeEnvironment.COOKIE_DOMAIN = 'example.test'
  expectCode(() => assemblePreviewArguments(badCookie), 'UNSAFE_PREVIEW_ORIGIN')

  for (const origin of [
    'http://pr-42--pwa.preview.example.test',
    'https://user@pr-42--pwa.preview.example.test',
    'https://user:pass@pr-42--pwa.preview.example.test',
    'https://pr-42--pwa.preview.example.test/?query=1',
    'https://pr-42--pwa.preview.example.test/#fragment',
    'https://pr-42--pwa.preview.example.test/path',
    'https://pr-42--evil.example/path/.preview.example.test',
    'https://pr-42--evil.preview.example.test',
    'https://pr-43--pwa.preview.example.test',
    'https://pr-42--manage.preview.example.test',
  ]) {
    const input = argumentInputs(plan)
    input.config.runtimeEnvironment.APP_ORIGIN_PWA = origin
    expectCode(() => assemblePreviewArguments(input), 'UNSAFE_PREVIEW_ORIGIN')
  }
})

test('serializes every environment through one admission queue and driver seam', async () => {
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const driver = recordingDriver({ firstGate: gate })
  const controller = createSerializedPreviewLifecycle({
    state: initialState(),
    driver,
    now: () => STARTED_AT,
  })

  const first = controller.reconcile({
    desired: plan(),
    event: pullRequest({ number: 1 }),
  })
  while (driver.calls.length === 0) await new Promise(setImmediate)
  const second = controller.reconcile({
    desired: plan(),
    event: pullRequest({ number: 2 }),
  })
  await new Promise(setImmediate)
  assert.equal(driver.calls.length, 1)

  release()
  const [firstResult, secondResult] = await Promise.all([first, second])
  assert.equal(firstResult.reason, 'preview-admitted')
  assert.equal(secondResult.reason, 'preview-admitted')
  assert.deepEqual(
    driver.calls.map((call) => call.environmentId),
    [`${REPOSITORY}#pull/1`, `${REPOSITORY}#pull/2`]
  )
  assert.equal(controller.snapshot().trial.buildAttempts, 4)
})

test('admits labelled or manually selected same-repository open pull requests only', () => {
  const state = initialState()
  const labelled = planPreviewReconciliation({
    state,
    desired: plan(),
    event: pullRequest(),
    now: STARTED_AT,
  })
  assert.equal(labelled.decision, 'execute')
  assert.equal(labelled.action.command, 'create')

  const manual = planPreviewReconciliation({
    state,
    desired: plan(),
    event: pullRequest({ labels: [], manualOptIn: true }),
    now: STARTED_AT,
  })
  assert.equal(manual.decision, 'execute')

  const cases = [
    [pullRequest({ labels: [] }), 'preview-opt-in-missing'],
    [pullRequest({ isFork: true }), 'pull-request-fork'],
    [pullRequest({ repository: 'other/repository' }), 'repository-mismatch'],
    [pullRequest({ state: 'closed' }), 'pull-request-closed'],
    [pullRequest({ merged: true }), 'pull-request-merged'],
    [pullRequest({ state: 'open', obsolete: true }), 'obsolete-event'],
  ]
  for (const [event, reason] of cases) {
    const result = planPreviewReconciliation({
      state,
      desired: plan(),
      event,
      now: STARTED_AT,
    })
    assert.equal(result.decision, 'drop', reason)
    assert.equal(result.reason, reason)
  }
})

test('admits only the allowlisted v3-ai push and requires the exact planner revision', () => {
  const state = initialState()
  const accepted = planPreviewReconciliation({
    state,
    desired: plan({ eventName: 'push', sourceBranch: 'v3-ai' }),
    event: push(),
    now: STARTED_AT,
  })
  assert.equal(accepted.decision, 'execute')

  const otherBranch = planPreviewReconciliation({
    state,
    desired: plan({ eventName: 'push', sourceBranch: 'feature/other' }),
    event: push({ branch: 'feature/other' }),
    now: STARTED_AT,
  })
  assert.equal(otherBranch.reason, 'branch-not-allowlisted')

  expectCode(
    () =>
      planPreviewReconciliation({
        state,
        desired: plan({ revision: REVISION_B }),
        event: pullRequest({ revision: REVISION_A }),
        now: STARTED_AT,
      }),
    'SOURCE_REVISION_MISMATCH'
  )
})

test('enforces configurable environment, build-attempt and fixed-deadline limits', async () => {
  assert.deepEqual(DEFAULT_PREVIEW_LIFECYCLE_LIMITS, {
    maxEnvironments: 2,
    maxBuildAttempts: 42,
    maxLifetimeMs: 48 * 60 * 60 * 1000,
  })

  const oneEnvironment = initialState({ maxEnvironments: 1 })
  const driver = recordingDriver()
  const controller = createSerializedPreviewLifecycle({
    state: oneEnvironment,
    driver,
    now: () => STARTED_AT,
  })
  await controller.reconcile({
    desired: plan(),
    event: pullRequest({ number: 1 }),
  })
  const limited = await controller.reconcile({
    desired: plan(),
    event: pullRequest({ number: 2 }),
  })
  assert.equal(limited.reason, 'environment-limit')
  assert.equal(driver.calls.length, 1)

  const buildLimited = planPreviewReconciliation({
    state: initialState({ maxBuildAttempts: 2 }),
    desired: plan({ builds: 3 }),
    event: pullRequest(),
    now: STARTED_AT,
  })
  assert.equal(buildLimited.reason, 'build-attempt-limit')

  const pet = createSerializedPreviewLifecycle({
    state: initialState(),
    driver: recordingDriver(),
    now: () => DEADLINE,
  })
  const expired = await pet.reconcile({
    desired: plan(),
    event: pullRequest(),
  })
  assert.equal(expired.reason, 'deadline-exceeded')
  assert.equal(expired.action, null)
  assert.equal(
    pet.snapshot().terminalIdentities[`${REPOSITORY}#pull/1`].reason,
    'deadline'
  )
})

test('updates migrate without reseeding, contracts by pausing removed services and retains data', async () => {
  const driver = recordingDriver()
  const controller = createSerializedPreviewLifecycle({
    state: initialState(),
    driver,
    now: () => STARTED_AT,
  })
  await controller.reconcile({ desired: plan(), event: pullRequest() })

  const updated = await controller.reconcile({
    desired: plan({ revision: REVISION_B }),
    event: pullRequest({ revision: REVISION_B, sequence: 2 }),
  })
  assert.equal(updated.action.command, 'update')
  assert.equal(updated.action.migrate, true)
  assert.equal(updated.action.seedFixtures, false)
  assert.equal(
    updated.state.environments[updated.action.environmentId].fixturesSeeded,
    true
  )

  const contracted = await controller.reconcile({
    desired: plan({
      revision: REVISION_B,
      profile: ['pwa'],
      resources: [resource('postgres', 'data-service')],
      builds: 0,
    }),
    event: pullRequest({ revision: REVISION_B, sequence: 3 }),
  })
  assert.equal(contracted.action.command, 'update')
  assert.deepEqual(contracted.action.pauseResources, ['chat'])
  const contractedResources = Object.fromEntries(
    contracted.action.resources.map(({ binding, state }) => [binding, state])
  )
  assert.deepEqual(contractedResources, { chat: 'paused', postgres: 'active' })
  assert.equal(contracted.action.seedFixtures, false)
})

test('pause and resume preserve owned data resources', async () => {
  const driver = recordingDriver()
  const controller = createSerializedPreviewLifecycle({
    state: initialState(),
    driver,
    now: () => STARTED_AT,
  })
  await controller.reconcile({ desired: plan(), event: pullRequest() })

  const paused = await controller.reconcile({
    desired: null,
    event: environmentEvent('pause', 1, 2),
  })
  assert.equal(paused.action.command, 'pause')
  assert.deepEqual(
    Object.fromEntries(
      paused.action.resources.map(({ binding, state }) => [binding, state])
    ),
    { chat: 'paused', postgres: 'active' }
  )

  const resumed = await controller.reconcile({
    desired: null,
    event: environmentEvent('resume', 1, 3),
  })
  assert.equal(resumed.action.command, 'resume')
  assert.ok(resumed.action.resumeResources.includes('chat'))
  assert.equal(
    resumed.action.resources.find(({ binding }) => binding === 'postgres')
      .state,
    'active'
  )
})

test('close and deadline deletion are terminal and cannot be recreated', async () => {
  let now = STARTED_AT
  const driver = recordingDriver()
  const controller = createSerializedPreviewLifecycle({
    state: initialState(),
    driver,
    now: () => now,
  })
  await controller.reconcile({ desired: plan(), event: pullRequest() })
  const closed = await controller.reconcile({
    desired: null,
    event: pullRequest({ state: 'closed', sequence: 2 }),
  })
  assert.equal(closed.action.command, 'delete')
  assert.equal(
    controller.snapshot().environments[closed.action.environmentId].phase,
    'terminal'
  )
  const callsAfterClose = driver.calls.length
  const reopened = await controller.reconcile({
    desired: plan({ revision: REVISION_B }),
    event: pullRequest({ revision: REVISION_B, sequence: 3 }),
  })
  assert.equal(reopened.reason, 'terminal-identity')
  assert.equal(driver.calls.length, callsAfterClose)

  const other = createSerializedPreviewLifecycle({
    state: initialState(),
    driver,
    now: () => now,
  })
  await other.reconcile({ desired: plan(), event: pullRequest({ number: 2 }) })
  now = DEADLINE
  const expired = await other.reconcile({
    desired: plan({ revision: REVISION_B }),
    event: pullRequest({ number: 2, revision: REVISION_B, sequence: 2 }),
  })
  assert.equal(expired.action.command, 'delete')
  const afterExpiry = await other.reconcile({
    desired: plan({ revision: REVISION_C }),
    event: pullRequest({ number: 2, revision: REVISION_C, sequence: 3 }),
  })
  assert.equal(afterExpiry.reason, 'terminal-identity')
})

test('close blocks admission before a failed delete can be retried', async () => {
  let failDelete = true
  const driver = {
    async applyLifecycle(action) {
      if (action.command === 'delete' && failDelete) {
        failDelete = false
        throw new Error('delete did not settle')
      }
      return receiptFor(action)
    },
  }
  const controller = createSerializedPreviewLifecycle({
    state: initialState(),
    driver,
    now: () => STARTED_AT,
  })
  await controller.reconcile({ desired: plan(), event: pullRequest() })
  await assert.rejects(
    controller.reconcile({
      desired: null,
      event: pullRequest({ state: 'closed', sequence: 2 }),
    }),
    /delete did not settle/
  )
  const closedEnvironment =
    controller.snapshot().environments[`${REPOSITORY}#pull/1`]
  assert.equal(closedEnvironment.phase, 'terminal')
  assert.equal(closedEnvironment.deleted, false)

  const reopened = await controller.reconcile({
    desired: plan(),
    event: pullRequest({ sequence: 3 }),
  })
  assert.equal(reopened.reason, 'terminal-identity')

  const retried = await controller.reconcile({
    desired: null,
    event: environmentEvent('teardown', 1, 3),
  })
  assert.equal(retried.action.command, 'delete')
  assert.equal(
    controller.snapshot().environments[`${REPOSITORY}#pull/1`].deleted,
    true
  )
})

test('drops stale and duplicate operations before the provider', async () => {
  const driver = recordingDriver()
  const controller = createSerializedPreviewLifecycle({
    state: initialState(),
    driver,
    now: () => STARTED_AT,
  })
  await controller.reconcile({
    desired: plan(),
    event: pullRequest({ sequence: 5 }),
  })
  const stale = await controller.reconcile({
    desired: plan({ revision: REVISION_B }),
    event: pullRequest({ revision: REVISION_B, sequence: 4 }),
  })
  assert.equal(stale.reason, 'stale-sequence')

  const duplicate = await controller.reconcile({
    desired: plan(),
    event: pullRequest({ sequence: 6 }),
  })
  assert.equal(duplicate.reason, 'duplicate-update')

  const staleAfterDuplicate = await controller.reconcile({
    desired: plan({ revision: REVISION_B }),
    event: pullRequest({ revision: REVISION_B, sequence: 5 }),
  })
  assert.equal(staleAfterDuplicate.reason, 'stale-sequence')
  assert.equal(driver.calls.length, 1)
})

test('fails closed on missing, inconsistent or unknown owned-resource receipts', async () => {
  const state = initialState()
  const missing = recordingDriver()
  const missingController = createSerializedPreviewLifecycle({
    state,
    driver: {
      async applyLifecycle() {
        return {
          settled: true,
          environmentId: `${REPOSITORY}#pull/1`,
          retryPolicy: 'none',
        }
      },
    },
    now: () => STARTED_AT,
  })
  await assert.rejects(
    missingController.reconcile({ desired: plan(), event: pullRequest() }),
    (error) => error.code === 'INCOMPLETE_RECEIPT'
  )
  assert.equal(missingController.snapshot().trial.buildAttempts, 2)
  assert.equal(
    missingController.snapshot().environments[`${REPOSITORY}#pull/1`].phase,
    'pending'
  )
  const retry = await missingController.reconcile({
    desired: plan(),
    event: pullRequest({ sequence: 2 }),
  })
  assert.equal(retry.reason, 'unsettled-provider-operation')

  const unknownController = createSerializedPreviewLifecycle({
    state,
    driver: {
      async applyLifecycle(action) {
        const receipt = receiptFor(action)
        receipt.resources.push({ binding: 'provider-default', state: 'active' })
        return receipt
      },
    },
    now: () => STARTED_AT,
  })
  await assert.rejects(
    unknownController.reconcile({ desired: plan(), event: pullRequest() }),
    (error) => error.code === 'UNKNOWN_RESOURCE'
  )

  const inconsistentController = createSerializedPreviewLifecycle({
    state,
    driver: {
      async applyLifecycle(action) {
        const receipt = receiptFor(action)
        receipt.resources[0].state = 'paused'
        return receipt
      },
    },
    now: () => STARTED_AT,
  })
  await assert.rejects(
    inconsistentController.reconcile({ desired: plan(), event: pullRequest() }),
    (error) => error.code === 'INCONSISTENT_RECEIPT'
  )
})

test('failed provider work retains reservations across identities and blocks replay', async () => {
  let calls = 0
  const controller = createSerializedPreviewLifecycle({
    state: initialState({ maxBuildAttempts: 2 }),
    driver: {
      async applyLifecycle() {
        calls++
        throw new Error('Native partial failure')
      },
    },
    now: () => STARTED_AT,
  })
  await assert.rejects(
    controller.reconcile({ desired: plan(), event: pullRequest() })
  )
  assert.equal(controller.snapshot().trial.buildAttempts, 2)
  assert.equal(
    (
      await controller.reconcile({
        desired: plan(),
        event: pullRequest({ sequence: 2 }),
      })
    ).reason,
    'unsettled-provider-operation'
  )
  assert.equal(
    (
      await controller.reconcile({
        desired: plan(),
        event: pullRequest({ number: 2 }),
      })
    ).reason,
    'build-attempt-limit'
  )
  assert.equal(calls, 1)
})

test('close, merge and teardown before creation leave terminal admission records', () => {
  for (const event of [
    pullRequest({ state: 'closed', sequence: 5 }),
    pullRequest({ state: 'closed', merged: true, sequence: 5 }),
    environmentEvent('teardown', 1, 5),
  ]) {
    const closed = planPreviewReconciliation({
      state: initialState(),
      event,
      now: STARTED_AT,
    })
    const stale = planPreviewReconciliation({
      state: closed.nextState,
      desired: plan(),
      event: pullRequest({ sequence: 3 }),
      now: STARTED_AT,
    })
    assert.equal(stale.reason, 'terminal-identity')
    assert.equal(stale.action, null)
  }
})

test('CLI is side-effect free and prints only the exact planning decision', () => {
  const writes = []
  const output = runCli(
    [
      'plan',
      '--state',
      JSON.stringify(initialState()),
      '--desired',
      JSON.stringify(plan()),
      '--event',
      JSON.stringify(pullRequest()),
      '--now',
      String(STARTED_AT),
    ],
    { write: (value) => writes.push(value) }
  )
  assert.equal(output.decision, 'execute')
  assert.equal(output.action.command, 'create')
  assert.equal(output.action.retryPolicy, 'none')
  assert.equal(output.action.providerDefaults, false)
  assert.equal(writes.length, 1)
  assert.match(writes[0], /"decision": "execute"/)
})

test('defaults cannot be widened beyond the approved trial ceilings', () => {
  expectCode(() => initialState({ maxEnvironments: 3 }), 'INVALID_INPUT')
  expectCode(() => initialState({ maxBuildAttempts: 43 }), 'INVALID_INPUT')
  expectCode(
    () =>
      createPreviewLifecycleState({
        startedAt: STARTED_AT,
        deadline:
          STARTED_AT + DEFAULT_PREVIEW_LIFECYCLE_LIMITS.maxLifetimeMs + 1,
      }),
    'INVALID_DEADLINE'
  )
})

test('native driver refuses create and update without provider calls', async () => {
  const resources = [nativeResource('chat')]
  const harness = nativeHarness(resources)
  const driver = createNorthflankPreviewLifecycleDriver({
    ownership: nativeOwnership(resources),
    request: harness.request,
    settle: async () => ({ settled: true }),
  })

  for (const command of ['create', 'update']) {
    await assert.rejects(
      driver.applyLifecycle(nativeAction(command, resources)),
      (error) => error.code === 'STAGED_PROVISIONER_REQUIRED'
    )
  }
  assert.deepEqual(harness.calls, [])
})

test('native ownership rejects unsafe project and resource path segments', () => {
  const harness = nativeHarness([nativeResource('chat')])
  const unsafe = [
    '.',
    '..',
    'nested/id',
    'nested\\id',
    'encoded%2Fid',
    'id?query=1',
    'id#fragment',
  ]
  for (const value of unsafe) {
    const ownership = nativeOwnership([nativeResource('chat')])
    ownership.projectId = value
    expectCode(
      () =>
        createNorthflankPreviewLifecycleDriver({
          ownership,
          request: harness.request,
          settle: async () => ({ settled: true }),
        }),
      'UNSAFE_OWNERSHIP_PATH'
    )

    const resourceOwnership = nativeOwnership([nativeResource('chat')])
    resourceOwnership.resources[0].id = value
    expectCode(
      () =>
        createNorthflankPreviewLifecycleDriver({
          ownership: resourceOwnership,
          request: harness.request,
          settle: async () => ({ settled: true }),
        }),
      'UNSAFE_OWNERSHIP_PATH'
    )
  }
  assert.deepEqual(harness.calls, [])
})

test('native ownership mismatches refuse every write', async () => {
  const resources = [
    nativeResource('chat'),
    nativeResource('postgres', 'addon'),
  ]
  const harness = nativeHarness(resources, {
    read(call, resource) {
      return call.endpoint === resources[0].endpoint
        ? nativeRead(resource, { uid: 'different-permanent-uid' })
        : nativeRead(resource)
    },
    write() {
      assert.fail('ownership mismatch must not write')
    },
  })
  const settlements = []
  const driver = createNorthflankPreviewLifecycleDriver({
    ownership: nativeOwnership(resources),
    request: harness.request,
    settle: async (value) => {
      settlements.push(value)
      return { settled: true }
    },
  })

  await assert.rejects(
    driver.applyLifecycle(nativeAction('pause', resources)),
    (error) => error.code === 'OWNERSHIP_MISMATCH'
  )
  assert.equal(harness.calls.length, 1)
  assert.equal(harness.calls[0].method, 'GET')
  assert.equal(settlements.length, 0)

  const wrongProject = structuredClone(resources[0])
  wrongProject.endpoint = wrongProject.endpoint.replace(
    NATIVE_PROJECT,
    'another-project'
  )
  expectCode(
    () =>
      createNorthflankPreviewLifecycleDriver({
        ownership: nativeOwnership([wrongProject]),
        request: harness.request,
        settle: async () => ({ settled: true }),
      }),
    'OWNERSHIP_MISMATCH'
  )

  const wrongEnvironmentHarness = nativeHarness(resources, {
    read: (_call, resource) =>
      nativeRead(resource, { stageId: 'another-environment' }),
  })
  const wrongEnvironmentDriver = createNorthflankPreviewLifecycleDriver({
    ownership: nativeOwnership(resources),
    request: wrongEnvironmentHarness.request,
    settle: async () => ({ settled: true }),
  })
  await assert.rejects(
    wrongEnvironmentDriver.applyLifecycle(nativeAction('pause', resources)),
    (error) => error.code === 'OWNERSHIP_MISMATCH'
  )
  assert.equal(wrongEnvironmentHarness.calls[0].method, 'GET')
})

test('native pause refuses missing ownership before settlement or writes', async () => {
  const resources = [
    nativeResource('chat'),
    nativeResource('postgres', 'addon'),
  ]
  const harness = nativeHarness(resources, {
    read(_call, resource) {
      return resource.id === 'addon-postgres'
        ? { status: 404 }
        : nativeRead(resource)
    },
    write() {
      assert.fail('missing owner must not write')
    },
  })
  let settleCalls = 0
  const driver = createNorthflankPreviewLifecycleDriver({
    ownership: nativeOwnership(resources),
    request: harness.request,
    settle: async () => {
      settleCalls++
      return { settled: true }
    },
  })

  await assert.rejects(
    driver.applyLifecycle(nativeAction('pause', resources)),
    (error) => error.code === 'OWNED_RESOURCE_MISSING'
  )
  assert.deepEqual(
    harness.calls.map(({ method }) => method),
    ['GET', 'GET']
  )
  assert.equal(settleCalls, 0)
})

test('native identity accepts absent stageId while writes require settlement proof', async () => {
  const resources = [nativeResource('chat')]
  assert.equal(
    Object.hasOwn(nativeRead(resources[0]).body.data, 'stageId'),
    false
  )
  const acceptedHarness = nativeHarness(resources)
  const unsettled = []
  const acceptedDriver = createNorthflankPreviewLifecycleDriver({
    ownership: nativeOwnership(resources),
    request: acceptedHarness.request,
    settle: async (value) => {
      unsettled.push(value)
      return { settled: false }
    },
  })
  await assert.rejects(
    acceptedDriver.applyLifecycle(nativeAction('pause', resources)),
    (error) => error.code === 'UNSETTLED_PROVIDER'
  )
  assert.deepEqual(
    acceptedHarness.calls.map(({ method }) => method),
    ['GET', 'POST']
  )
  assert.equal(unsettled.length, 1)

  const settledHarness = nativeHarness(resources)
  const settlements = []
  const settledDriver = createNorthflankPreviewLifecycleDriver({
    ownership: nativeOwnership(resources),
    request: settledHarness.request,
    settle: async (value) => {
      settlements.push(value)
      return { settled: true }
    },
  })
  const receipt = await settledDriver.applyLifecycle(
    nativeAction('pause', resources)
  )
  assert.deepEqual(receipt, {
    settled: true,
    environmentId: NATIVE_LIFECYCLE_ENVIRONMENT,
    resources: [{ binding: 'chat', state: 'paused' }],
    buildAttempts: 0,
    fixturesSeeded: false,
    retryPolicy: 'none',
  })
  assert.deepEqual(settlements[0].resources, [
    {
      binding: 'chat',
      nativeType: 'service',
      endpoint: resources[0].endpoint,
      id: resources[0].id,
      expectedState: 'paused',
    },
  ])
})

test('native partial failure stops later writes and settlement', async () => {
  const resources = [
    nativeResource('chat'),
    nativeResource('auth'),
    nativeResource('postgres', 'addon'),
  ]
  const harness = nativeHarness(resources, {
    write(call) {
      if (call.endpoint.includes('/services/service-auth/pause')) {
        throw new Error('synthetic native write failure')
      }
      return { status: 202 }
    },
  })
  let settleCalls = 0
  const driver = createNorthflankPreviewLifecycleDriver({
    ownership: nativeOwnership(resources),
    request: harness.request,
    settle: async () => {
      settleCalls++
      return { settled: true }
    },
  })

  await assert.rejects(
    driver.applyLifecycle(nativeAction('pause', resources)),
    /synthetic native write failure/
  )
  assert.deepEqual(
    harness.calls.map(({ method, endpoint }) => [method, endpoint]),
    [
      ['GET', resources[0].endpoint],
      ['GET', resources[1].endpoint],
      ['GET', resources[2].endpoint],
      ['POST', `${resources[0].endpoint}/pause`],
      ['POST', `${resources[1].endpoint}/pause`],
    ]
  )
  assert.equal(settleCalls, 0)
})

test('native ordering preserves dependency-first receipt order', async () => {
  const resources = [
    nativeResource('hatchet', 'service', 'process'),
    nativeResource('litellm', 'service', 'service'),
    nativeResource('postgres', 'addon'),
    nativeResource('redis', 'addon'),
    nativeResource('app-b'),
    nativeResource('app-a'),
  ]
  async function run(command) {
    const harness = nativeHarness(resources)
    const driver = createNorthflankPreviewLifecycleDriver({
      ownership: nativeOwnership(resources),
      request: harness.request,
      settle: async () => ({ settled: true }),
    })
    const action = nativeAction(command, [...resources].reverse())
    if (command === 'resume') {
      action.resources.find((r) => r.binding === 'app-a').state = 'paused'
      action.resumeResources = ['hatchet', 'litellm', 'app-b']
    }
    await driver.applyLifecycle(action)
    return harness.calls
  }

  const pauseCalls = await run('pause')
  assert.deepEqual(
    pauseCalls
      .filter(({ method }) => method === 'GET')
      .map(({ endpoint }) => endpoint),
    resources.map(({ endpoint }) => endpoint)
  )
  assert.deepEqual(
    pauseCalls
      .filter(({ method }) => method === 'POST')
      .map(({ endpoint }) => endpoint),
    [
      `${resources[4].endpoint}/pause`,
      `${resources[5].endpoint}/pause`,
      `${resources[0].endpoint}/pause`,
      `${resources[1].endpoint}/pause`,
    ]
  )

  const resumeCalls = await run('resume')
  assert.deepEqual(
    resumeCalls
      .filter(({ method }) => method === 'POST')
      .map(({ endpoint }) => endpoint),
    [
      `${resources[0].endpoint}/resume`,
      `${resources[1].endpoint}/resume`,
      `${resources[4].endpoint}/resume`,
    ]
  )
  assert.deepEqual(
    resumeCalls.find(
      ({ endpoint }) => endpoint === `${resources[4].endpoint}/resume`
    ).body,
    {}
  )
  assert.equal(
    resumeCalls.some(({ endpoint }) =>
      endpoint.endsWith('/addons/addon-postgres/resume')
    ),
    false
  )
})

test('native delete is exact, idempotent on 404 and settles absence', async () => {
  const resources = [
    nativeResource('chat'),
    nativeResource('postgres', 'addon'),
    nativeResource('redis', 'addon'),
  ]
  const harness = nativeHarness(resources, {
    read(call, resource) {
      if (call.endpoint === resources[1].endpoint) return { status: 404 }
      return nativeRead(resource)
    },
    write(call) {
      return call.endpoint === resources[2].endpoint
        ? { status: 404 }
        : { status: 200 }
    },
  })
  const settlements = []
  const driver = createNorthflankPreviewLifecycleDriver({
    ownership: nativeOwnership(resources),
    request: harness.request,
    settle: async (value) => {
      settlements.push(value)
      return { settled: true }
    },
  })

  const receipt = await driver.applyLifecycle(nativeAction('delete', resources))
  assert.deepEqual(harness.calls, [
    { method: 'GET', endpoint: resources[0].endpoint },
    { method: 'GET', endpoint: resources[1].endpoint },
    { method: 'GET', endpoint: resources[2].endpoint },
    { method: 'DELETE', endpoint: resources[0].endpoint },
    { method: 'DELETE', endpoint: resources[2].endpoint },
  ])
  assert.deepEqual(
    settlements[0].resources.map(({ expectedState }) => expectedState),
    ['absent', 'absent', 'absent']
  )
  assert.deepEqual(
    receipt.resources.map(({ state }) => state),
    ['deleted', 'deleted', 'deleted']
  )
})

test('partial pause retains pending state and blocks conflicting resume', async () => {
  const controller = createSerializedPreviewLifecycle({
    state: initialState(),
    now: () => STARTED_AT,
    driver: {
      async applyLifecycle(action) {
        if (action.command === 'pause') throw new Error('partial native pause')
        return receiptFor(action)
      },
    },
  })
  await controller.reconcile({ desired: plan(), event: pullRequest() })
  const before = controller.snapshot().trial.buildAttempts
  await assert.rejects(
    controller.reconcile({ event: environmentEvent('pause') }),
    /partial native pause/
  )
  const state = controller.snapshot()
  assert.equal(Object.values(state.environments)[0].phase, 'pending')
  assert.equal(state.trial.buildAttempts, before)
  const resume = await controller.reconcile({
    event: environmentEvent('resume', 1, 3),
  })
  assert.equal(resume.decision, 'drop')
  assert.equal(resume.reason, 'unsettled-provider-operation')
})
