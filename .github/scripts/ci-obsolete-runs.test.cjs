const assert = require('node:assert/strict')
const test = require('node:test')
const {
  allowedRun,
  inspectRun,
  cancelRun,
  parseArgs,
} = require('./ci-obsolete-runs.cjs')

function fixture() {
  const repo = { id: 1, full_name: 'uzh-bf/klicker-uzh' }
  const run = {
    id: 10,
    workflow_id: 2,
    run_attempt: 1,
    path: '.github/workflows/test-unit.yml',
    event: 'pull_request',
    status: 'queued',
    head_sha: 'old',
    head_branch: 'branch',
    repository: repo,
    head_repository: repo,
    pull_requests: [
      { number: 3, head: { sha: 'old', repo }, base: { sha: 'base', repo } },
    ],
  }
  const pull = {
    number: 3,
    state: 'open',
    head: { sha: 'new', ref: 'branch', repo },
    base: { sha: 'base', repo },
  }
  const replacement = {
    ...run,
    id: 11,
    head_sha: 'new',
    pull_requests: [
      { number: 3, head: { sha: 'new', repo }, base: { sha: 'base', repo } },
    ],
  }
  const state = { run, pull, replacement, writes: [], reads: 0 }
  const api = async (endpoint, method = 'GET') => {
    if (method === 'POST') {
      state.writes.push(endpoint)
      state.run.status = 'completed'
      state.run.conclusion = 'cancelled'
      return { data: null }
    }
    if (endpoint.endsWith('/runs/10')) {
      state.reads += 1
      return { data: structuredClone(state.run) }
    }
    if (endpoint.endsWith('/runs/11')) return { data: state.replacement }
    if (endpoint.endsWith('/pulls/3')) return { data: state.pull }
    if (endpoint.includes('/workflows/2/runs?'))
      return { data: { total_count: 1, workflow_runs: [state.replacement] } }
    throw new Error(`Unexpected endpoint ${endpoint}`)
  }
  return { state, api }
}

test('dry-run inspection proves replacement without writes', async () => {
  const { state, api } = fixture()
  assert.equal((await inspectRun(api, 10)).replacement, 11)
  assert.deepEqual(state.writes, [])
})

test('closed PR permits exact validation cleanup without replacement', async () => {
  const { state, api } = fixture()
  state.pull.state = 'closed'
  assert.equal((await inspectRun(api, 10)).reason, 'closed-PR')
})

for (const [name, mutate] of Object.entries({
  push: (s) => {
    s.run.event = 'push'
  },
  manual: (s) => {
    s.run.event = 'workflow_dispatch'
  },
  review: (s) => {
    s.run.event = 'pull_request_target'
  },
  image: (s) => {
    s.run.path = '.github/workflows/build-image.yml'
  },
  deployment: (s) => {
    s.run.path = '.github/workflows/deploy-stg-promote.yml'
  },
  'other repo': (s) => {
    s.run.repository = { id: 2, full_name: 'other/repo' }
  },
  fork: (s) => {
    s.run.head_repository = { id: 2, full_name: 'fork/repo' }
  },
  'ambiguous PR': (s) => {
    s.run.pull_requests.push(s.run.pull_requests[0])
  },
  'finished run': (s) => {
    s.run.status = 'completed'
  },
  'current head': (s) => {
    s.pull.head.sha = 'old'
  },
  'wrong replacement PR': (s) => {
    s.replacement.pull_requests[0].number = 4
  },
  'wrong replacement workflow': (s) => {
    s.replacement.workflow_id = 4
  },
  'wrong replacement base': (s) => {
    s.replacement.pull_requests[0].base.sha = 'different'
  },
  'failed replacement': (s) => {
    s.replacement.status = 'completed'
    s.replacement.conclusion = 'failure'
  },
  'canceled replacement': (s) => {
    s.replacement.status = 'completed'
    s.replacement.conclusion = 'cancelled'
  },
})) {
  test(`preserves ${name}`, async () => {
    const { state, api } = fixture()
    mutate(state)
    assert.equal(
      (await cancelRun(api, 10, { wait: async () => {} })).eligible,
      false
    )
    assert.deepEqual(state.writes, [])
  })
}

test('applies normal cancellation and verifies terminal result', async () => {
  const { state, api } = fixture()
  assert.equal(
    (await cancelRun(api, 10, { wait: async () => {} })).result,
    'cancelled'
  )
  assert.equal(state.writes.length, 1)
  assert.ok(state.writes[0].endsWith('/runs/10/cancel'))
})

test('changed attempt between inspection and mutation prevents cancellation', async () => {
  const { state, api } = fixture()
  const raced = async (endpoint, method) => {
    if (state.reads === 1 && endpoint.endsWith('/runs/10'))
      state.run.run_attempt += 1
    return api(endpoint, method)
  }
  assert.equal((await cancelRun(raced, 10)).reason, 'run-identity-changed')
  assert.deepEqual(state.writes, [])
})

test('force mode revalidates after normal cancellation fails to finish', async () => {
  const { state, api } = fixture()
  const stalled = async (endpoint, method) => {
    if (method === 'POST' && endpoint.endsWith('/cancel')) {
      state.writes.push(endpoint)
      return { data: null }
    }
    return api(endpoint, method)
  }
  assert.equal(
    (await cancelRun(stalled, 10, { force: true, wait: async () => {} }))
      .result,
    'cancelled'
  )
  assert.equal(state.writes.length, 2)
  assert.ok(state.writes[1].endsWith('/force-cancel'))
})

test('inconclusive cancellation does not force by default', async () => {
  const { state, api } = fixture()
  const stalled = async (endpoint, method) => {
    if (method === 'POST') {
      state.writes.push(endpoint)
      return { data: null }
    }
    return api(endpoint, method)
  }
  assert.equal(
    (await cancelRun(stalled, 10, { wait: async () => {} })).result,
    'cancellation-unconfirmed'
  )
  assert.equal(state.writes.length, 1)
})

test('input policy requires explicit IDs for every mutation', () => {
  assert.deepEqual(parseArgs([]), { apply: false, force: false, ids: [] })
  for (const args of [
    ['--apply'],
    ['--force'],
    ['--run-id', 'x'],
    ['--force', '--run-id', '1'],
  ])
    assert.throws(() => parseArgs(args))
  assert.deepEqual(parseArgs(['--apply', '--run-id', '10']), {
    apply: true,
    force: false,
    ids: [10],
  })
  assert.equal(allowedRun({}), false)
})

test('force cancellation stops when the replacement becomes invalid', async () => {
  const { state, api } = fixture()
  const raced = async (endpoint, method) => {
    if (method === 'POST' && endpoint.endsWith('/cancel')) {
      state.writes.push(endpoint)
      state.replacement.status = 'completed'
      state.replacement.conclusion = 'cancelled'
      return { data: null }
    }
    return api(endpoint, method)
  }
  assert.equal(
    (await cancelRun(raced, 10, { force: true, wait: async () => {} }))
      .eligible,
    false
  )
  assert.equal(state.writes.length, 1)
})

test('API errors during mutation preflight never trigger cancellation', async () => {
  const { state, api } = fixture()
  const failed = async (endpoint, method) => {
    if (state.reads === 1 && endpoint.endsWith('/runs/10'))
      throw new Error('rate limited')
    return api(endpoint, method)
  }
  await assert.rejects(cancelRun(failed, 10), /rate limited/)
  assert.deepEqual(state.writes, [])
})

// The current head can legitimately own more than one active run: a push and a
// pull-request event for the same branch land in different concurrency groups.
// The older queued entry has consumed nothing, so it is safe to drop while the
// newer run carries the plan for the current pull-request state.
function duplicateFixture({
  olderStatus = 'queued',
  newerStatus = 'queued',
} = {}) {
  const repo = { id: 1, full_name: 'uzh-bf/klicker-uzh' }
  const head = { sha: 'head', repo }
  const binding = { number: 3, head, base: { sha: 'base', repo } }
  const run = {
    id: 10,
    workflow_id: 2,
    run_attempt: 1,
    path: '.github/workflows/test-playwright.yml',
    event: 'pull_request',
    status: olderStatus,
    head_sha: 'head',
    head_branch: 'branch',
    repository: repo,
    head_repository: repo,
    pull_requests: [binding],
  }
  const newer = { ...run, id: 12, status: newerStatus }
  const pull = {
    number: 3,
    state: 'open',
    head: { sha: 'head', ref: 'branch', repo },
    base: { sha: 'base', repo },
  }
  const state = { run, newer, pull, ids: [newer], writes: [] }
  const api = async (endpoint, method = 'GET') => {
    if (method === 'POST') {
      state.writes.push(endpoint)
      return { data: null }
    }
    if (endpoint.endsWith('/runs/10'))
      return { data: structuredClone(state.run) }
    if (endpoint.endsWith('/runs/12'))
      return { data: structuredClone(state.newer) }
    if (endpoint.endsWith('/pulls/3')) return { data: state.pull }
    if (endpoint.includes('/workflows/2/runs?'))
      return {
        data: { total_count: state.ids.length, workflow_runs: [...state.ids] },
      }
    throw new Error(`Unexpected endpoint ${endpoint}`)
  }
  return { state, api }
}

test('a queued duplicate for the current head is redundant', async () => {
  const { state, api } = duplicateFixture()
  const result = await inspectRun(api, 10)
  assert.equal(result.eligible, true)
  assert.equal(result.reason, 'redundant-queued-duplicate')
  assert.equal(result.replacement, 12)
  assert.deepEqual(state.writes, [])
})

test('a duplicate that already started keeps running', async () => {
  const { api } = duplicateFixture({ olderStatus: 'in_progress' })
  assert.equal((await inspectRun(api, 10)).reason, 'current-head')
})

test('a sole queued run for the current head is never redundant', async () => {
  const { state, api } = duplicateFixture()
  state.ids = [state.run]
  assert.equal((await inspectRun(api, 10)).reason, 'current-head')
})

test('a newer duplicate only from another workflow is not a replacement', async () => {
  const { state, api } = duplicateFixture()
  state.newer.workflow_id = 9
  assert.equal((await inspectRun(api, 10)).reason, 'unverified-replacement')
})

// A pull_request run whose binding never appeared belongs to a pull request that
// was closed, merged, or never opened for this head; nothing reads its result.
function unboundFixture({ created, openPulls }) {
  const repo = { id: 1, full_name: 'uzh-bf/klicker-uzh' }
  const run = {
    id: 20,
    workflow_id: 2,
    run_attempt: 1,
    path: '.github/workflows/test-playwright.yml',
    event: 'pull_request',
    status: 'queued',
    head_sha: 'orphan',
    head_branch: 'rs/audit-ci-fixtures',
    created_at: created,
    repository: repo,
    head_repository: repo,
    pull_requests: [],
  }
  const api = async (endpoint) => {
    if (endpoint.endsWith('/runs/20')) return { data: structuredClone(run) }
    if (endpoint.includes('/pulls?state=open')) return { data: openPulls }
    throw new Error(`Unexpected endpoint ${endpoint}`)
  }
  return api
}

test('an unbound run whose binding never appeared is abandoned', async () => {
  const created = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  const result = await inspectRun(
    unboundFixture({ created, openPulls: [] }),
    20
  )
  assert.equal(result.eligible, true)
  assert.equal(result.reason, 'unbound-head')
})

test('an unbound run inside the binding window is preserved', async () => {
  const created = new Date(Date.now() - 60 * 1000).toISOString()
  const result = await inspectRun(
    unboundFixture({ created, openPulls: [] }),
    20
  )
  assert.equal(result.eligible, false)
  assert.equal(result.reason, 'unbound-recent')
})

test('an unbound run whose head an open pull request claims is preserved', async () => {
  const created = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  const repo = { id: 1, full_name: 'uzh-bf/klicker-uzh' }
  const result = await inspectRun(
    unboundFixture({
      created,
      openPulls: [{ number: 3, head: { sha: 'orphan', repo } }],
    }),
    20
  )
  assert.equal(result.eligible, false)
  assert.equal(result.reason, 'unbound-live-head')
})

test('an unbound run without a creation timestamp is preserved', async () => {
  const result = await inspectRun(
    unboundFixture({ created: undefined, openPulls: [] }),
    20
  )
  assert.equal(result.eligible, false)
  assert.equal(result.reason, 'unbound-recent')
})

test('the run policy admits an unbound pull-request run', () => {
  const repo = { id: 1, full_name: 'uzh-bf/klicker-uzh' }
  assert.equal(
    allowedRun({
      id: 21,
      workflow_id: 2,
      run_attempt: 1,
      path: '.github/workflows/test-playwright.yml',
      event: 'pull_request',
      status: 'queued',
      repository: repo,
      head_repository: repo,
      pull_requests: [],
    }),
    true
  )
})
