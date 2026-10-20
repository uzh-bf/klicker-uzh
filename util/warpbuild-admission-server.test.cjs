const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { AdmissionStore } = require('../.github/scripts/warpbuild-admission.cjs')
const {
  createAdmissionHandler,
  verifyRun,
  verifyToken,
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
  assert.equal(
    (await handler(new Request('https://admission.example.invalid/status')))
      .status,
    404
  )
})

test('forge evidence rejects drafts, source drift, ambiguous preparation and started work', async () => {
  const baseline = {
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
    verifyRun(identity, config, async (route) =>
      route.includes('/jobs?')
        ? data.jobs
        : route.includes('/pulls/')
          ? data.pr
          : data.run
    )
  assert.equal(await verify(baseline), true)
  for (const mutate of [
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
        steps: [{ status: 'in_progress' }],
      })
      data.jobs.total_count = 2
    },
  ]) {
    const data = structuredClone(baseline)
    mutate(data)
    assert.equal(await verify(data), false, mutate.toString())
  }
})
