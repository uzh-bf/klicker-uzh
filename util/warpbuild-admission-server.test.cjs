const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { EventEmitter } = require('node:events')
const test = require('node:test')
const { AdmissionStore } = require('../.github/scripts/warpbuild-admission.cjs')
const {
  chooseRouteWithAdmission,
} = require('../.github/scripts/playwright-route.cjs')
const {
  createAdmissionHandler,
  verifyRun,
  verifyToken,
  main,
} = require('./warpbuild-admission-server.cjs')

const now = Date.parse('2026-01-01T12:00:00Z')
const identity = {
  runId: '100',
  runAttempt: '1',
  pullRequestNumber: '10',
  headSha: 'a'.repeat(40),
  baseSha: 'b'.repeat(40),
  controlSha: 'c'.repeat(40),
}
const config = {
  repository: 'uzh-bf/klicker-uzh',
  repositoryId: '123',
  groupId: '7',
  selectedWorkflows: [
    'uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@refs/heads/v3',
  ],
  workflowRef:
    'uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@refs/heads/v3',
  audience: 'klicker-playwright-admission',
}
const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = {
  ...keys.publicKey.export({ format: 'jwk' }),
  kid: 'test-key',
  alg: 'RS256',
  use: 'sig',
}
const claims = {
  iss: 'https://token.actions.githubusercontent.com',
  aud: config.audience,
  iat: now / 1000,
  nbf: now / 1000,
  exp: now / 1000 + 300,
  repository: config.repository,
  repository_id: config.repositoryId,
  repository_visibility: 'public',
  event_name: 'pull_request',
  run_id: '100',
  run_attempt: '1',
  job_workflow_ref: config.workflowRef,
  job_workflow_sha: identity.controlSha,
  runner_environment: 'github-hosted',
  ref: 'refs/pull/10/merge',
}
function token(overrides = {}, privateKey = keys.privateKey) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', kid: 'test-key', typ: 'JWT' })
  ).toString('base64url')
  const body = Buffer.from(
    JSON.stringify({ ...claims, ...overrides })
  ).toString('base64url')
  const input = `${header}.${body}`
  return `${input}.${crypto.sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`
}

test('only a signed token for trusted preparation can bind the requested identity', () => {
  assert.equal(
    verifyToken(token(), { keys: [jwk] }, config, identity, now).run_id,
    '100'
  )
  for (const override of [
    { aud: 'other' },
    { iss: 'https://example.invalid' },
    { repository_id: '999' },
    { repository: 'external/fork' },
    { repository_visibility: 'private' },
    { event_name: 'push' },
    { run_attempt: '2' },
    { run_id: '101' },
    { job_workflow_sha: 'd'.repeat(40) },
    { job_workflow_ref: 'external/workflow@main' },
    { ref: 'refs/pull/11/merge' },
    { exp: now / 1000 },
    { iat: now / 1000 + 1 },
    { runner_environment: 'self-hosted' },
  ]) {
    assert.throws(() =>
      verifyToken(token(override), { keys: [jwk] }, config, identity, now)
    )
  }
  assert.throws(() =>
    verifyToken(
      `${token().slice(0, -8)}AAAAAAAA`,
      { keys: [jwk] },
      config,
      identity,
      now
    )
  )
})

test('authenticated request verifies live eligibility before a durable ticket is returned', async (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'admission-http-test-')
  )
  const store = new AdmissionStore(path.join(directory, 'state.sqlite'))
  t.after(() => {
    store.close()
    fs.rmSync(directory, { recursive: true, force: true })
  })
  store.initialize(
    {
      windowId: 'test',
      expiresAt: '2026-01-01T13:00:00Z',
      controlSha: identity.controlSha,
      maxSubmissions: 2,
      maxConcurrent: 1,
      budgetMicros: 2000000,
      reservationMicros: 1000000,
      accountLimitMicros: 10000000,
      historicalLiabilityMicros: 0,
      maxBillingAgeSeconds: 900,
      ticketSeconds: 300,
    },
    now
  )
  store.recordBilling(
    { observedAt: new Date(now).toISOString(), reportedMicros: 0 },
    now
  )
  let eligible = false
  const handler = createAdmissionHandler({
    store,
    config,
    clock: () => now,
    readKeys: async () => ({ keys: [jwk] }),
    verifyRun: async () => eligible,
  })
  const request = () =>
    new Request('https://admission.example.invalid/admit', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(identity),
    })
  assert.equal((await handler(request())).status, 403)
  assert.equal(store.status().submissions, 0)
  eligible = true
  const response = await handler(request())
  assert.equal(response.status, 200)
  assert.deepEqual(Object.keys(await response.json()), ['ticket'])
  assert.equal(store.status().reservedMicros, 1000000)
  const route = await chooseRouteWithAdmission(
    {
      ...identity,
      eventName: 'pull_request',
      repository: config.repository,
      repositoryPrivate: 'false',
      headRepository: config.repository,
      prAuthor: 'synthetic-contributor',
      prDraft: 'false',
      publicRolloutEnabled: 'true',
      now: new Date(now).toISOString(),
    },
    {
      WARPBUILD_ADMISSION_URL: 'https://admission.example.invalid/admit',
      ACTIONS_ID_TOKEN_REQUEST_URL:
        'https://pipelines.actions.githubusercontent.com/token',
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'synthetic',
    },
    async (url, options) =>
      new URL(url).hostname === 'pipelines.actions.githubusercontent.com'
        ? Response.json({ value: token() })
        : handler(new Request(url, options))
  )
  assert.equal(route.provider, 'warpbuild')
  assert.equal(store.status().submissions, 1)
  assert.equal(
    (await handler(new Request('https://admission.example.invalid/status')))
      .status,
    404
  )
})

test('serve resolves only after binding and rejects asynchronous bind errors', async (t) => {
  const previousExitCode = process.exitCode
  t.after(() => {
    process.exitCode = previousExitCode
  })
  const errors = []
  t.mock.method(console, 'error', (...values) => errors.push(values))
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'admission-bind-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const filename = path.join(directory, 'state.sqlite')
  const configFile = path.join(directory, 'config.json')
  const store = new AdmissionStore(filename)
  store.initialize(
    {
      windowId: 'synthetic',
      expiresAt: '2026-01-01T13:00:00Z',
      controlSha: identity.controlSha,
      maxSubmissions: 1,
      maxConcurrent: 1,
      budgetMicros: 1000000,
      reservationMicros: 1000000,
      accountLimitMicros: 10000000,
      historicalLiabilityMicros: 0,
      maxBillingAgeSeconds: 900,
      ticketSeconds: 300,
    },
    now
  )
  store.close()
  fs.writeFileSync(configFile, JSON.stringify(config))
  for (const fail of [false, true]) {
    const server = new EventEmitter()
    let closed = false
    server.close = () => {
      closed = true
      server.emit('close')
    }
    let bound
    server.listen = (port, host, callback) => {
      assert.equal(port, 8080)
      assert.equal(host, '127.0.0.1')
      bound = callback
    }
    const mock = t.mock.method(http, 'createServer', () => server)
    let settled = false
    const pending = main(['serve', filename, configFile])
    pending.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      }
    )
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(settled, false)
    if (fail) {
      const failure = Object.assign(new Error('synthetic bind failure'), {
        code: 'EADDRINUSE',
      })
      server.emit('error', failure)
      await assert.rejects(pending, (error) => error === failure)
    } else {
      bound()
      assert.equal(await pending, server)
      server.emit('error', new Error('synthetic sensitive runtime detail'))
      assert.equal(closed, true)
      assert.equal(process.exitCode, 1)
      assert.equal(errors.length, 1)
      assert.ok(!JSON.stringify(errors).includes('synthetic sensitive'))
      process.exitCode = previousExitCode
    }
    mock.mock.restore()
  }
})

test('forge evidence rejects drafts, source drift, ambiguous preparation and started work', async () => {
  const baseline = {
    group: {
      id: 7,
      name: 'Default',
      visibility: 'selected',
      allows_public_repositories: true,
      restricted_to_workflows: true,
      inherited: false,
      selected_workflows: [...config.selectedWorkflows],
    },
    repositories: {
      total_count: 1,
      repositories: [{ id: 123, full_name: config.repository }],
    },
    run: {
      id: 100,
      run_attempt: 1,
      event: 'pull_request',
      status: 'in_progress',
      path: '.github/workflows/test-playwright.yml',
      head_sha: identity.headSha,
      repository: { id: 123, private: false },
      pull_requests: [
        {
          number: 10,
          head: { sha: identity.headSha },
          base: { sha: identity.baseSha },
        },
      ],
    },
    pr: {
      number: 10,
      state: 'open',
      draft: false,
      head: {
        sha: identity.headSha,
        repo: { full_name: config.repository, private: false },
      },
      base: { sha: identity.baseSha, repo: { full_name: config.repository } },
      user: { login: 'synthetic-contributor' },
    },
    jobs: {
      total_count: 1,
      jobs: [
        {
          name: 'test-playwright-execution / prepare',
          status: 'in_progress',
          steps: [],
        },
      ],
    },
  }
  const verify = (data) =>
    verifyRun(identity, config, async (route) => {
      const root = `/repos/${config.repository}`
      const routes = {
        [`/orgs/uzh-bf/actions/runner-groups/${config.groupId}/repositories?per_page=100`]:
          data.repositories,
        [`/orgs/uzh-bf/actions/runner-groups/${config.groupId}`]: data.group,
        [`${root}/actions/runs/${identity.runId}/attempts/${identity.runAttempt}/jobs?per_page=100`]:
          data.jobs,
        [`${root}/pulls/${identity.pullRequestNumber}`]: data.pr,
        [`${root}/actions/runs/${identity.runId}/attempts/${identity.runAttempt}`]:
          data.run,
      }
      assert.ok(Object.hasOwn(routes, route), `unexpected endpoint ${route}`)
      return routes[route]
    })
  assert.equal(await verify(baseline), true)
  const suffixed = structuredClone(baseline)
  suffixed.run.path += '@refs/pull/1234/merge'
  assert.equal(await verify(suffixed), true)
  for (const mutate of [
    (data) => {
      data.group.selected_workflows.push('external/workflow')
    },
    (data) => {
      data.group.restricted_to_workflows = false
    },
    (data) => {
      data.repositories.total_count = 2
    },
    (data) => {
      data.repositories.repositories[0].id = 124
    },
    (data) => {
      data.pr.draft = true
    },
    (data) => {
      data.pr.state = 'closed'
    },
    (data) => {
      data.pr.head.sha = 'e'.repeat(40)
    },
    (data) => {
      data.pr.base.sha = 'e'.repeat(40)
    },
    (data) => {
      data.run.pull_requests[0].base.sha = 'e'.repeat(40)
    },
    (data) => {
      data.pr.head.repo.full_name = 'external/fork'
    },
    (data) => {
      data.pr.user.login = 'synthetic[bot]'
    },
    (data) => {
      data.run.run_attempt = 2
    },
    (data) => {
      data.run.path = '.github/workflows/other.yml'
    },
    (data) => {
      data.jobs.total_count = 2
    },
    (data) => {
      data.jobs.jobs[0].status = 'completed'
    },
    (data) => {
      data.jobs.jobs.push({ name: 'other / prepare', status: 'in_progress' })
      data.jobs.total_count = 2
    },
    (data) => {
      data.jobs.jobs.push({
        name: 'test-playwright-execution / build-public',
        status: 'queued',
        steps: [{ status: 'in_progress' }],
      })
      data.jobs.total_count = 2
    },
    (data) => {
      data.jobs.jobs.push({
        name: 'test-playwright-execution / test-playwright-public-pr (1)',
        status: 'in_progress',
        steps: [],
      })
      data.jobs.total_count = 2
    },
  ]) {
    const data = structuredClone(baseline)
    mutate(data)
    assert.equal(await verify(data), false, mutate.toString())
  }
})
