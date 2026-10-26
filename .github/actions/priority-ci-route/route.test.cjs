const assert = require('node:assert/strict')
const test = require('node:test')
const { route, requested, marker } = require('./route.cjs')

function fixture() {
  const pr = {
    number: 42,
    state: 'open',
    draft: false,
    head: { sha: 'a'.repeat(40), repo: { full_name: 'uzh-bf/klicker-uzh' } },
    base: { sha: 'b'.repeat(40), repo: { full_name: 'uzh-bf/klicker-uzh' } },
    user: { login: 'synthetic-contributor' },
    labels: [{ name: 'ci:priority' }],
  }
  const event = {
    repository: { full_name: 'uzh-bf/klicker-uzh', private: false },
    action: 'labeled',
    label: { name: 'ci:priority' },
    pull_request: pr,
  }
  const env = {
    PRIORITY_ENABLED: 'true',
    GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_RUN_ID: '200',
    GITHUB_RUN_ATTEMPT: '1',
  }
  const state = {
    pull: structuredClone(pr),
    events: [
      {
        id: 100,
        event: 'labeled',
        label: { name: 'ci:priority' },
        actor: { login: 'synthetic-maintainer' },
      },
    ],
    permission: 'write',
    run: {
      id: 200,
      workflow_id: 10,
      path: '.github/workflows/check.yml',
      event: 'pull_request',
      run_attempt: 1,
      repository: { full_name: 'uzh-bf/klicker-uzh' },
      head_repository: { full_name: 'uzh-bf/klicker-uzh' },
      head_sha: pr.head.sha,
      display_title: marker(pr),
    },
    extraRuns: [],
    calls: [],
  }
  const api = async (path, query) => {
    state.calls.push({ path, query })
    if (path.endsWith('/pulls/42')) return state.pull
    if (path.endsWith('/issues/42/events')) return state.events
    if (path.endsWith('/permission')) return { permission: state.permission }
    if (path.endsWith('/actions/runs/200')) return state.run
    if (path.endsWith('/workflows/10/runs')) {
      const runs = [state.run, ...state.extraRuns]
      return { total_count: runs.length, workflow_runs: runs }
    }
    throw new Error('unexpected API path')
  }
  return { event, env, state, api }
}

test('authorized current first attempt selects fixed scalable compute runners', async () => {
  const { event, env, api, state } = fixture()
  const result = await route(event, env, api)
  assert.equal(result.admitted, 'true')
  assert.equal(result.run_label_event, 'true')
  assert.equal(result.run_attempt, '1')
  assert.equal(result.runner_x64, 'warp-ubuntu-2404-x64-4x')
  assert.equal(result.runner_build, 'warp-ubuntu-2404-x64-8x')
  assert.equal(result.runner_arm, 'warp-ubuntu-2404-arm64-8x')
  const inventory = state.calls.find((call) => call.path.endsWith('/10/runs'))
  assert.equal(inventory.query.head_sha, event.pull_request.head.sha)
  assert.equal(inventory.query.event, 'pull_request')
  assert.equal(
    state.calls.filter((call) => call.path.endsWith('/pulls/42')).length,
    2
  )
})

test('source updates keep priority and earlier ordinary runs do not own it', async () => {
  const { event, env, api, state } = fixture()
  event.action = 'synchronize'
  state.extraRuns.push({ id: 199, display_title: 'ordinary:199' })
  const result = await route(event, env, api)
  assert.equal(result.admitted, 'true')
  assert.equal(result.run_label_event, 'false')
})

test('disabled, fork, bot, draft, unrelated label and missing priority make no API request', async () => {
  const mutations = [
    (f) => {
      f.env.PRIORITY_ENABLED = 'false'
    },
    (f) => {
      f.env.GITHUB_EVENT_NAME = 'push'
    },
    (f) => {
      f.event.repository.private = true
    },
    (f) => {
      f.event.pull_request.draft = true
    },
    (f) => {
      f.event.pull_request.state = 'closed'
    },
    (f) => {
      f.event.pull_request.head.repo.full_name = 'synthetic/fork'
    },
    (f) => {
      f.event.pull_request.user.login = 'synthetic[bot]'
    },
    (f) => {
      f.event.label.name = 'unrelated'
    },
    (f) => {
      f.event.pull_request.labels = []
    },
  ]
  for (const mutate of mutations) {
    const f = fixture()
    mutate(f)
    const result = await route(f.event, f.env, f.api)
    assert.equal(result.admitted, 'false')
    assert.equal(result.run_label_event, 'false')
    assert.equal(f.state.calls.length, 0)
  }
})

test('reruns, conflicting controls, canary mismatch and force-hosted never admit', async () => {
  for (const [key, value] of [
    ['GITHUB_RUN_ATTEMPT', '2'],
    ['GITHUB_RUN_ID', 'invalid'],
    ['PRIORITY_CANARY_PR', '43'],
    ['PRIORITY_CANARY_HEAD_SHA', 'c'.repeat(40)],
    ['PRIORITY_CANARY_BASE_SHA', 'c'.repeat(40)],
    ['PRIORITY_EXPIRES_AT', 'invalid'],
    ['PRIORITY_EXPIRES_AT', '2000-01-01T00:00:00Z'],
    ['LEGACY_ADMISSIONS', '[]'],
    ['LEGACY_ADMISSION_URL', 'https://example.invalid/admit'],
    ['LEGACY_BURST_GRANT', '{}'],
    ['FORCE_HOSTED_PR', '42'],
  ]) {
    const f = fixture()
    f.env[key] = value
    assert.equal((await route(f.event, f.env, f.api)).admitted, 'false')
    assert.equal(f.state.calls.length, 0)
  }
})

test('canary limits admission without changing trusted runner selection', async () => {
  const f = fixture()
  f.env.PRIORITY_CANARY_PR = '42'
  f.env.PRIORITY_CANARY_HEAD_SHA = f.event.pull_request.head.sha
  f.env.PRIORITY_CANARY_BASE_SHA = f.event.pull_request.base.sha
  f.env.PRIORITY_EXPIRES_AT = new Date(Date.now() + 60000).toISOString()
  assert.equal((await route(f.event, f.env, f.api)).admitted, 'true')
})

test('only latest priority setter with write, maintain or admin authority admits', async () => {
  for (const permission of ['read', 'triage', 'unknown', undefined]) {
    const f = fixture()
    f.state.permission = permission
    assert.equal((await route(f.event, f.env, f.api)).admitted, 'false')
  }
  for (const permission of ['maintain', 'admin']) {
    const f = fixture()
    f.state.permission = permission
    assert.equal((await route(f.event, f.env, f.api)).admitted, 'true')
  }
  for (const latest of [
    { id: 101, event: 'unlabeled', label: { name: 'ci:priority' } },
    { id: 101, event: 'labeled', label: { name: 'ci:priority' }, actor: {} },
  ]) {
    const f = fixture()
    f.state.events.push(latest)
    assert.equal((await route(f.event, f.env, f.api)).admitted, 'false')
  }
})

test('stale head, base, removed label or closed state denies current PR admission', async () => {
  for (const mutate of [
    (pull) => {
      pull.head.sha = 'c'.repeat(40)
    },
    (pull) => {
      pull.base.sha = 'c'.repeat(40)
    },
    (pull) => {
      pull.labels = []
    },
    (pull) => {
      pull.state = 'closed'
    },
  ]) {
    const f = fixture()
    mutate(f.state.pull)
    assert.equal((await route(f.event, f.env, f.api)).admitted, 'false')
  }
})

test('run source, workflow, title and exact attempt must match the event', async () => {
  for (const [key, value] of [
    ['head_sha', 'c'.repeat(40)],
    ['path', '.github/workflows/release.yml'],
    ['event', 'workflow_dispatch'],
    ['run_attempt', 2],
    ['id', 201],
    ['display_title', 'ordinary:200'],
  ]) {
    const f = fixture()
    f.state.run[key] = value
    assert.equal((await route(f.event, f.env, f.api)).admitted, 'false')
  }
})

test('earlier matching request owns admission even after failure or cancellation', async () => {
  for (const conclusion of ['success', 'failure', 'cancelled', null]) {
    const f = fixture()
    f.state.extraRuns.push({ ...f.state.run, id: 199, conclusion })
    assert.equal((await route(f.event, f.env, f.api)).admitted, 'false')
  }
})

test('another base is a separate validation request', async () => {
  const f = fixture()
  f.state.extraRuns.push({
    ...f.state.run,
    id: 199,
    display_title: `priority:42:${'a'.repeat(40)}:${'c'.repeat(40)}`,
  })
  assert.equal((await route(f.event, f.env, f.api)).admitted, 'true')
})

test('incomplete API collections or errors retain ordinary fallback', async () => {
  const f = fixture()
  for (const api of [
    async () => {
      throw new Error('synthetic sensitive diagnostic')
    },
    async (path, query) =>
      path.endsWith('/10/runs')
        ? { total_count: 2, workflow_runs: [f.state.run] }
        : f.api(path, query),
    async (path, query) =>
      path.endsWith('/42/events')
        ? Array(100).fill(f.state.events[0])
        : f.api(path, query),
  ]) {
    assert.equal((await route(f.event, f.env, api)).admitted, 'false')
  }
})

test('a final PR recheck catches a source update during admission', async () => {
  const f = fixture()
  let reads = 0
  const api = async (path, query) => {
    if (path.endsWith('/pulls/42') && ++reads === 2)
      return { ...f.state.pull, labels: [] }
    return f.api(path, query)
  }
  assert.equal((await route(f.event, f.env, api)).admitted, 'false')
})

test('request identity is immutable PR, head and base', () => {
  const f = fixture()
  assert.equal(requested(f.event, f.env), true)
  assert.equal(
    marker(f.event.pull_request),
    `priority:42:${'a'.repeat(40)}:${'b'.repeat(40)}`
  )
})
