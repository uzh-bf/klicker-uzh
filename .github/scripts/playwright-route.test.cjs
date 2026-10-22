const assert = require('node:assert/strict')
const test = require('node:test')

const {
  choosePlaywrightRoute,
  chooseRouteWithAdmission,
} = require('./playwright-route.cjs')

function pullRequest(overrides = {}) {
  return {
    eventName: 'pull_request',
    repository: 'uzh-bf/klicker-uzh',
    repositoryPrivate: 'false',
    headRepository: 'uzh-bf/klicker-uzh',
    prAuthor: 'contributor',
    prDraft: 'false',
    pullRequestNumber: '1234',
    publicRolloutEnabled: 'true',
    publicRolloutCanaryPr: '',
    smartDraftEnabled: '',
    smartDraftCanaryPr: '',
    forceHostedCanaryPr: '',
    ...overrides,
  }
}

function cloudAdmission(overrides = {}) {
  const ticket = {
    runId: '100',
    runAttempt: '1',
    pullRequestNumber: '1234',
    headSha: 'a'.repeat(40),
    baseSha: 'b'.repeat(40),
    controlSha: 'c'.repeat(40),
    expiresAt: '2026-10-19T13:00:00Z',
  }
  return pullRequest({
    ...ticket,
    now: '2026-10-19T12:00:00Z',
    warpbuildAdmissions: JSON.stringify([ticket]),
    ...overrides,
  })
}

test('a prospective workflow number binds one first-attempt validation without a coordinator', async (t) => {
  let coordinatorCalls = 0
  const noCoordinator = async () => {
    coordinatorCalls++
    throw new Error('unexpected coordinator')
  }
  t.mock.method(globalThis, 'fetch', noCoordinator)
  const input = cloudAdmission({ warpbuildAdmissions: '' })
  const { runId, runAttempt, ...source } = JSON.parse(
    cloudAdmission().warpbuildAdmissions
  )[0]
  const env = {
    GITHUB_RUN_NUMBER: '42',
    GITHUB_REF: 'refs/pull/1234/merge',
    WARPBUILD_ADMISSION_URL: 'https://admission.example.invalid/admit',
    ACTIONS_ID_TOKEN_REQUEST_URL:
      'https://pipelines.actions.githubusercontent.com/token',
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'synthetic',
    WARPBUILD_BURST_GRANT: JSON.stringify({
      ...source,
      workflowId: '900',
      runNumber: '42',
    }),
  }
  const calls = []
  const api = async (route) => {
    calls.push(route)
    if (route.endsWith('/jobs?per_page=100')) {
      return {
        total_count: 1,
        jobs: [
          {
            name: 'test-playwright-execution / prepare',
            status: 'in_progress',
          },
        ],
      }
    }
    if (route.includes('/pulls/')) {
      return {
        number: 1234,
        state: 'open',
        draft: false,
        head: { sha: source.headSha, repo: { full_name: input.repository } },
        base: { sha: source.baseSha, repo: { full_name: input.repository } },
      }
    }
    return {
      id: Number(runId),
      run_attempt: Number(runAttempt),
      run_number: 42,
      workflow_id: 900,
      event: 'pull_request',
      status: 'in_progress',
      head_sha: source.headSha,
      path: '.github/workflows/test-playwright.yml',
      repository: { full_name: input.repository, private: false },
      pull_requests: [
        {
          number: 1234,
          head: { sha: source.headSha },
          base: { sha: source.baseSha },
        },
      ],
    }
  }
  const result = await chooseRouteWithAdmission(input, env, noCoordinator, api)
  assert.equal(result.provider, 'warpbuild')
  assert.equal(result.admissionAttempt, '1')
  assert.deepEqual(calls, [
    '/repos/uzh-bf/klicker-uzh/actions/runs/100/attempts/1',
    '/repos/uzh-bf/klicker-uzh/pulls/1234',
    '/repos/uzh-bf/klicker-uzh/actions/runs/100/attempts/1/jobs?per_page=100',
  ])
  const ordinary = choosePlaywrightRoute(input)
  const grant = JSON.parse(env.WARPBUILD_BURST_GRANT)
  for (const change of [
    { workflowId: '901' },
    { runNumber: '43' },
    { runNumber: 42 },
    { pullRequestNumber: '1235' },
    { headSha: 'd'.repeat(40) },
    { baseSha: 'd'.repeat(40) },
    { controlSha: 'd'.repeat(40) },
    { expiresAt: input.now },
    { expiresAt: '2026-10-20T12:00:00Z' },
    { runId: '100' },
    { runAttempt: '2' },
  ]) {
    assert.deepEqual(
      await chooseRouteWithAdmission(
        input,
        {
          ...env,
          WARPBUILD_BURST_GRANT: JSON.stringify({ ...grant, ...change }),
        },
        undefined,
        api
      ),
      ordinary
    )
  }
  for (const raw of ['{', '[]', 'null', '0', 'x'.repeat(4097)]) {
    assert.deepEqual(
      await chooseRouteWithAdmission(
        input,
        {
          ...env,
          WARPBUILD_BURST_GRANT: raw,
          WARPBUILD_ADMISSION_URL: 'https://must-not-call.invalid/admit',
        },
        noCoordinator,
        api
      ),
      ordinary
    )
  }
  for (const change of [
    { runAttempt: '2' },
    { runId: '101' },
    { prDraft: 'true' },
    { headRepository: 'fork/repo' },
    { publicRolloutEnabled: 'false' },
    { prAuthor: 'automation[bot]' },
  ]) {
    const changed = { ...input, ...change }
    assert.deepEqual(
      await chooseRouteWithAdmission(changed, env, undefined, api),
      choosePlaywrightRoute(changed)
    )
  }
  for (const [kind, change] of [
    ['run', { workflow_id: 901 }],
    ['run', { run_number: 43 }],
    ['run', { id: 101 }],
    ['run', { run_attempt: 2 }],
    ['run', { event: 'workflow_dispatch' }],
    ['run', { status: 'completed' }],
    ['run', { head_sha: 'd'.repeat(40) }],
    ['run', { path: '.github/workflows/other.yml' }],
    ['run', { repository: { full_name: 'other/repo', private: false } }],
    ['run', { pull_requests: [{ number: 1235 }] }],
    ['pr', { state: 'closed' }],
    ['pr', { draft: true }],
    ['pr', { head: { sha: 'd'.repeat(40) } }],
    ['pr', { base: { sha: 'd'.repeat(40) } }],
    ['jobs', { total_count: 101 }],
    ...['build-and-compile-public-pr', 'future-workload'].map((name) => [
      'jobs',
      {
        total_count: 2,
        jobs: [
          {
            name: 'test-playwright-execution / prepare',
            status: 'in_progress',
          },
          {
            name: `test-playwright-execution / ${name}`,
            status: 'queued',
            steps: [{ status: 'in_progress' }],
          },
        ],
      },
    ]),
    [
      'jobs',
      {
        total_count: 2,
        jobs: [
          {
            name: 'test-playwright-execution / prepare',
            status: 'in_progress',
          },
          { name: 'another / prepare', status: 'queued' },
        ],
      },
    ],
    [
      'jobs',
      {
        total_count: 2,
        jobs: [
          {
            name: 'test-playwright-execution / prepare',
            status: 'in_progress',
          },
          {
            name: 'test-playwright-execution / build-and-compile-public-pr',
            status: 'in_progress',
          },
        ],
      },
    ],
  ]) {
    const changedApi = async (route) => {
      const result = await api(route)
      let type = 'run'
      if (route.includes('/pulls/')) type = 'pr'
      else if (route.includes('/jobs?')) type = 'jobs'
      return type === kind ? { ...result, ...change } : result
    }
    assert.deepEqual(
      await chooseRouteWithAdmission(input, env, undefined, changedApi),
      ordinary
    )
  }
  assert.deepEqual(
    await chooseRouteWithAdmission(input, env, undefined, async () => {
      throw new Error('API unavailable')
    }),
    ordinary
  )
  assert.equal(
    (
      await chooseRouteWithAdmission(input, env, undefined, async (path) => {
        const response = await api(path)
        return response.workflow_id
          ? { ...response, pull_requests: [] }
          : response
      })
    ).provider,
    'warpbuild'
  )
  for (const ref of ['', 'refs/heads/topic', 'refs/pull/1235/merge']) {
    assert.deepEqual(
      await chooseRouteWithAdmission(
        input,
        { ...env, GITHUB_REF: ref },
        undefined,
        api
      ),
      ordinary
    )
  }
  assert.equal(coordinatorCalls, 0)
})

test('preparation obtains an exact ticket before selecting the paid backend', async (t) => {
  const deadlines = []
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    deadlines.push(milliseconds)
    return new AbortController().signal
  })
  const input = cloudAdmission({ warpbuildAdmissions: '' })
  const ticket = { ...JSON.parse(cloudAdmission().warpbuildAdmissions)[0] }
  const env = {
    WARPBUILD_ADMISSION_URL: 'https://admission.example.invalid/admit',
    ACTIONS_ID_TOKEN_REQUEST_URL:
      'https://pipelines.actions.githubusercontent.com/token',
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'synthetic-request-credential',
  }
  const calls = []
  const network = async (url, options) => {
    calls.push({ url: String(url), options })
    return calls.length === 1
      ? Response.json({ value: 'synthetic-jwt' })
      : Response.json({ ticket })
  }
  const result = await chooseRouteWithAdmission(input, env, network)
  assert.equal(result.provider, 'warpbuild')
  assert.equal(result.admissionAttempt, '1')
  assert.equal(calls.length, 2)
  assert.equal(calls[1].url, env.WARPBUILD_ADMISSION_URL)
  assert.equal(calls[1].options.method, 'POST')
  assert.equal(calls[0].options.redirect, 'error')
  assert.equal(calls[1].options.redirect, 'error')
  assert.notEqual(calls[0].options.signal, calls[1].options.signal)
  assert.deepEqual(deadlines, [12000, 20000])
  assert.equal(
    new URL(calls[0].url).searchParams.get('audience'),
    'klicker-playwright-admission'
  )
  assert.equal(calls[1].options.headers.authorization, 'Bearer synthetic-jwt')
  assert.equal(
    calls[0].options.headers.authorization,
    `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`
  )
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    runId: input.runId,
    runAttempt: input.runAttempt,
    pullRequestNumber: input.pullRequestNumber,
    headSha: input.headSha,
    baseSha: input.baseSha,
    controlSha: input.controlSha,
  })
})

test('disabled, legacy and ineligible preparations never request coordinator credentials', async () => {
  const input = cloudAdmission({ warpbuildAdmissions: '' })
  const env = {
    WARPBUILD_ADMISSION_URL: 'https://admission.example.invalid/admit',
    ACTIONS_ID_TOKEN_REQUEST_URL:
      'https://pipelines.actions.githubusercontent.com/token',
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'synthetic',
  }
  for (const [changes, settings] of [
    [{}, { WARPBUILD_ADMISSION_URL: '' }],
    [{}, { ACTIONS_ID_TOKEN_REQUEST_TOKEN: '' }],
    [{ prDraft: 'true' }, {}],
    [{ headRepository: 'external/fork' }, {}],
    [{ runAttempt: '2' }, {}],
    [{ warpbuildAdmissions: cloudAdmission().warpbuildAdmissions }, {}],
    [{}, { WARPBUILD_ADMISSION_URL: 'http://example.invalid/admit' }],
    [{}, { WARPBUILD_ADMISSION_URL: 'https://example.invalid/other' }],
    [{}, { WARPBUILD_ADMISSION_URL: 'https://example.invalid/admit?q=1' }],
    [
      {},
      { WARPBUILD_ADMISSION_URL: 'https://user:pass@example.invalid/admit' },
    ],
    [{}, { WARPBUILD_ADMISSION_URL: 'https://example.invalid/admit#fragment' }],
    [{}, { ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.invalid/token' }],
    [
      {},
      {
        ACTIONS_ID_TOKEN_REQUEST_URL:
          'https://user:pass@pipelines.actions.githubusercontent.com/token',
      },
    ],
    [
      {},
      {
        ACTIONS_ID_TOKEN_REQUEST_URL:
          'https://pipelines.actions.githubusercontent.com/token#fragment',
      },
    ],
  ]) {
    let called = false
    const candidate = { ...input, ...changes }
    assert.deepEqual(
      await chooseRouteWithAdmission(
        candidate,
        { ...env, ...settings },
        async () => {
          called = true
          throw new Error('unexpected request')
        }
      ),
      choosePlaywrightRoute(candidate)
    )
    assert.equal(called, false)
  }
})

test('coordinator denial, outages and invalid tickets preserve ordinary routing', async (t) => {
  const warnings = []
  t.mock.method(console, 'warn', (...values) => warnings.push(values))
  const input = cloudAdmission({ warpbuildAdmissions: '' })
  const env = {
    WARPBUILD_ADMISSION_URL: 'https://admission.example.invalid/admit',
    ACTIONS_ID_TOKEN_REQUEST_URL:
      'https://pipelines.actions.githubusercontent.com/token',
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'synthetic',
  }
  const ticket = JSON.parse(cloudAdmission().warpbuildAdmissions)[0]
  for (const result of [
    () => Response.json({ reason: 'unavailable' }, { status: 409 }),
    () => {
      throw new Error('network timeout')
    },
    () => Response.json({ ticket: { ...ticket, runId: '999' } }),
    () =>
      Response.json({
        ticket: { ...ticket, expiresAt: '2025-01-01T00:00:00Z' },
      }),
    () => new Response('malformed'),
    () => new Response('x'.repeat(4097)),
  ]) {
    let calls = 0
    const network = async () =>
      ++calls === 1 ? Response.json({ value: 'synthetic-token' }) : result()
    assert.deepEqual(
      await chooseRouteWithAdmission(input, env, network),
      choosePlaywrightRoute(input)
    )
    assert.equal(calls, 2)
  }
  assert.equal(warnings.length, 6)
  assert.equal(
    new Set(warnings.map((values) => JSON.stringify(values))).size,
    1
  )
  assert.ok(
    warnings.every((values) => !JSON.stringify(values).includes('synthetic'))
  )
  for (const tokenResponse of [
    Response.json({}, { status: 503 }),
    new Response('x'.repeat(20001)),
    Response.json({}),
    Response.json({ value: 42 }),
  ]) {
    let calls = 0
    assert.deepEqual(
      await chooseRouteWithAdmission(input, env, async () => {
        calls++
        return tokenResponse
      }),
      choosePlaywrightRoute(input)
    )
    assert.equal(calls, 1)
  }
})

test('paid admission binds the complete execution identity and eligibility', () => {
  const admitted = choosePlaywrightRoute(cloudAdmission())
  assert.equal(admitted.route, 'public-pr')
  assert.equal(admitted.provider, 'warpbuild')
  assert.equal(admitted.admissionAttempt, '1')
  for (const overrides of [
    { runId: '101' },
    { repository: 'other/repo', headRepository: 'other/repo' },
    { runAttempt: '2' },
    { pullRequestNumber: '1235' },
    { headSha: 'd'.repeat(40) },
    { baseSha: 'd'.repeat(40) },
    { controlSha: 'd'.repeat(40) },
    { prDraft: 'true' },
    { repositoryPrivate: 'true' },
    { headRepository: 'external/example' },
    { prAuthor: 'dependabot[bot]' },
    { publicRolloutEnabled: '' },
    { forceHostedCanaryPr: '1234' },
    { eventName: 'push' },
  ]) {
    assert.notEqual(
      choosePlaywrightRoute(cloudAdmission(overrides)).provider,
      'warpbuild',
      JSON.stringify(overrides)
    )
  }
})

test('invalid or stale paid tickets preserve the ordinary backend', () => {
  const ticket = JSON.parse(cloudAdmission().warpbuildAdmissions)[0]
  for (const warpbuildAdmissions of [
    '',
    '{',
    '{}',
    'null',
    JSON.stringify([]),
    JSON.stringify([ticket, ticket]),
    JSON.stringify([ticket, null]),
    JSON.stringify([{ ...ticket, runAttempt: 1 }]),
    JSON.stringify([{ ...ticket, headSha: 'bad' }]),
    JSON.stringify([{ ...ticket, expiresAt: 'not-a-date' }]),
    JSON.stringify([{ ...ticket, expiresAt: '2026-10-19T12:00:00Z' }]),
    JSON.stringify([{ ...ticket, expiresAt: '2026-10-19T16:00:01Z' }]),
    JSON.stringify(
      Array.from({ length: 4 }, (_, i) => ({
        ...ticket,
        runId: String(100 + i),
      }))
    ),
  ]) {
    assert.notEqual(
      choosePlaywrightRoute(cloudAdmission({ warpbuildAdmissions })).provider,
      'warpbuild'
    )
  }
  assert.notEqual(
    choosePlaywrightRoute(cloudAdmission({ now: 'invalid' })).provider,
    'warpbuild'
  )
  const retry = cloudAdmission({ runAttempt: '2' })
  retry.warpbuildAdmissions = JSON.stringify([{ ...ticket, runAttempt: '2' }])
  assert.equal(choosePlaywrightRoute(retry).admissionAttempt, '2')
})

test('pushes always use a hosted full plan', () => {
  assert.deepEqual(choosePlaywrightRoute({ eventName: 'push' }), {
    schemaVersion: 1,
    route: 'hosted',
    selectorPrState: 'ready',
    reasonCodes: ['push'],
  })
})

test('ready same-repository public PRs use the public route when enabled', () => {
  const route = choosePlaywrightRoute(pullRequest())
  assert.equal(route.route, 'public-pr')
  assert.equal(route.selectorPrState, 'ready')
  assert.ok(route.reasonCodes.includes('public-pr-rollout'))
})

test('ready same-repository public PRs fall back to hosted when rollout is off', () => {
  const route = choosePlaywrightRoute(pullRequest({ publicRolloutEnabled: '' }))
  assert.deepEqual(route, {
    schemaVersion: 1,
    route: 'hosted',
    selectorPrState: 'ready',
    reasonCodes: ['hosted-fallback'],
  })
})

test('drafts without a smart-draft control keep the ready-state hosted plan', () => {
  const disabled = choosePlaywrightRoute(
    pullRequest({ prDraft: 'true', publicRolloutEnabled: 'true' })
  )
  assert.deepEqual(disabled, {
    schemaVersion: 1,
    route: 'hosted',
    selectorPrState: 'ready',
    reasonCodes: ['hosted-fallback', 'smart-draft-disabled'],
  })

  // Unset, malformed and non-matching controls all keep the full plan.
  for (const overrides of [
    { smartDraftEnabled: 'false' },
    { smartDraftEnabled: 'enabled' },
    { smartDraftCanaryPr: '9999' },
  ]) {
    const route = choosePlaywrightRoute(
      pullRequest({ prDraft: 'true', ...overrides })
    )
    assert.equal(route.route, 'hosted')
    assert.equal(route.selectorPrState, 'ready')
    assert.ok(route.reasonCodes.includes('smart-draft-disabled'))
  }
})

test('an enabled smart-draft control narrows an eligible draft on the hosted route', () => {
  for (const overrides of [
    { smartDraftEnabled: 'true' },
    { smartDraftCanaryPr: '1234' },
  ]) {
    const route = choosePlaywrightRoute(
      pullRequest({ prDraft: 'true', ...overrides })
    )
    assert.equal(route.route, 'hosted')
    assert.equal(route.selectorPrState, 'draft')
    assert.ok(route.reasonCodes.includes('smart-draft-enabled'))
    assert.ok(route.reasonCodes.includes('hosted-fallback'))
  }

  // The enabled control must never move a ready pull request onto a narrowed
  // plan. Without this case, dropping the draft condition in the narrowing rule
  // would leave every other assertion in this file passing.
  const readyWithSmartDraft = choosePlaywrightRoute(
    pullRequest({ smartDraftEnabled: 'true' })
  )
  assert.equal(readyWithSmartDraft.route, 'public-pr')
  assert.equal(readyWithSmartDraft.selectorPrState, 'ready')
})

test('a smart-draft control narrows a draft even when the public rollout is off', () => {
  const route = choosePlaywrightRoute(
    pullRequest({
      prDraft: 'true',
      publicRolloutEnabled: '',
      smartDraftEnabled: 'true',
    })
  )
  assert.equal(route.route, 'hosted')
  assert.equal(route.selectorPrState, 'draft')
  assert.ok(route.reasonCodes.includes('smart-draft-enabled'))
  assert.ok(route.reasonCodes.includes('hosted-fallback'))
})

test('forks, bots, and private repositories remain hosted and full', () => {
  for (const overrides of [
    { headRepository: 'external/example' },
    { prAuthor: 'dependabot[bot]' },
    { repositoryPrivate: 'true' },
  ]) {
    const route = choosePlaywrightRoute(pullRequest(overrides))
    assert.equal(route.route, 'hosted')
    assert.equal(route.selectorPrState, 'ready')
  }
})

test('ineligible smart-draft requests report the eligibility reason, not disabled smart drafts', () => {
  const route = choosePlaywrightRoute(
    pullRequest({
      headRepository: 'external/example',
      smartDraftEnabled: 'true',
      prDraft: 'true',
    })
  )
  assert.equal(route.route, 'hosted')
  assert.equal(route.selectorPrState, 'ready')
  assert.ok(route.reasonCodes.includes('fork'))
  assert.ok(!route.reasonCodes.includes('smart-draft-disabled'))
})

test('missing identity fields fail closed to hosted full execution', () => {
  for (const overrides of [
    { repository: undefined },
    { headRepository: undefined },
    { prAuthor: undefined },
    { pullRequestNumber: undefined },
  ]) {
    const route = choosePlaywrightRoute(pullRequest(overrides))
    assert.equal(route.route, 'hosted')
    assert.equal(route.selectorPrState, 'ready')
  }
})

test('the exact force-hosted canary overrides public execution', () => {
  const route = choosePlaywrightRoute(
    pullRequest({ forceHostedCanaryPr: '1234' })
  )
  assert.equal(route.route, 'hosted')
  assert.equal(route.selectorPrState, 'ready')
  assert.ok(route.reasonCodes.includes('force-hosted-canary'))
})

test('a non-matching force-hosted canary does not override public execution', () => {
  const route = choosePlaywrightRoute(
    pullRequest({ forceHostedCanaryPr: '9999' })
  )
  assert.equal(route.route, 'public-pr')
  assert.equal(route.selectorPrState, 'ready')
  assert.ok(!route.reasonCodes.includes('force-hosted-canary'))
})

test('the force-hosted canary keeps a draft hosted and ready-state', () => {
  const route = choosePlaywrightRoute(
    pullRequest({
      prDraft: 'true',
      smartDraftEnabled: 'true',
      forceHostedCanaryPr: '1234',
    })
  )
  assert.deepEqual(route, {
    schemaVersion: 1,
    route: 'hosted',
    selectorPrState: 'ready',
    reasonCodes: [
      'force-hosted-canary',
      'smart-draft-enabled',
      'hosted-fallback',
    ].sort(),
  })
})

test('inconsistent caller route hints are rejected', () => {
  assert.throws(
    () => choosePlaywrightRoute(pullRequest({ requestedRoute: 'public-pr' })),
    /unsupported requested route/
  )
})

test('empty route hints use the automatic route', () => {
  for (const requestedRoute of ['', '   ']) {
    const route = choosePlaywrightRoute(pullRequest({ requestedRoute }))
    assert.equal(route.route, 'public-pr')
  }
})

test('draft sync pull requests defer Playwright to the ready transition', () => {
  const syncDraft = pullRequest({
    prDraft: 'true',
    headRef: 'sync/v3-into-v3-ai-0123456789',
    smartDraftEnabled: 'true',
  })
  assert.deepEqual(choosePlaywrightRoute(syncDraft), {
    schemaVersion: 1,
    route: 'hosted',
    selectorPrState: 'deferred',
    reasonCodes: ['draft-sync-deferred', 'smart-draft-enabled'],
  })

  // Readiness, a fork head, or a branch outside the maintained sync pairs
  // keeps the ordinary route decision.
  for (const overrides of [
    { prDraft: 'false' },
    { headRepository: 'someone/klicker-uzh' },
    { headRef: 'sync/v3-into-feature-0123456789' },
    { headRef: 'sync/v3-into-v3-ai-manual-fix' },
  ]) {
    const route = choosePlaywrightRoute({ ...syncDraft, ...overrides })
    assert.notEqual(route.selectorPrState, 'deferred')
    assert.ok(!route.reasonCodes.includes('draft-sync-deferred'))
  }
})
