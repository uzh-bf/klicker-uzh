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

function pushFixture() {
  const repo = { id: 1, full_name: 'uzh-bf/klicker-uzh' }
  const oldSha = 'a'.repeat(40)
  const tipSha = 'b'.repeat(40)
  const run = {
    id: 20,
    workflow_id: 2,
    run_attempt: 1,
    path: '.github/workflows/test-unit.yml',
    event: 'push',
    status: 'queued',
    head_sha: oldSha,
    head_branch: 'v3',
    repository: repo,
    head_repository: repo,
    pull_requests: [],
  }
  const replacement = { ...run, id: 21, head_sha: tipSha }
  const state = { run, replacement, oldSha, tip: tipSha, writes: [] }
  const api = async (endpoint, method = 'GET') => {
    if (method === 'POST') {
      state.writes.push(endpoint)
      state.run.status = 'completed'
      state.run.conclusion = 'cancelled'
      return { data: null }
    }
    if (endpoint.endsWith('/runs/20'))
      return { data: structuredClone(state.run) }
    if (endpoint.endsWith('/runs/21')) return { data: state.replacement }
    if (endpoint.includes('/commits/')) return { data: { sha: state.tip } }
    if (endpoint.includes('/workflows/2/runs?'))
      return { data: { total_count: 1, workflow_runs: [state.replacement] } }
    throw new Error(`Unexpected endpoint ${endpoint}`)
  }
  return { state, api }
}

test('reclaims a queued push run superseded by the branch tip', async () => {
  const { state, api } = pushFixture()
  const result = await inspectRun(api, 20)
  assert.equal(result.reason, 'superseded-branch-tip')
  assert.equal(result.replacement, 21)
  assert.deepEqual(state.writes, [])
})

test('preserves a push run already at the branch tip', async () => {
  const { state, api } = pushFixture()
  state.tip = state.oldSha
  assert.equal((await inspectRun(api, 20)).reason, 'current-head')
})

test('preserves a push run bound to a pull request', async () => {
  const { api } = pushFixture()
  const bound = async (endpoint, method) => {
    if (endpoint.endsWith('/runs/20')) {
      const { data } = await api(endpoint, method)
      data.pull_requests = [{ number: 3 }]
      return { data }
    }
    return api(endpoint, method)
  }
  assert.equal((await inspectRun(bound, 20)).reason, 'outside-policy')
})

test('applies push cancellation and verifies terminal result', async () => {
  const { state, api } = pushFixture()
  const result = await cancelRun(api, 20, { wait: async () => {} })
  assert.equal(result.result, 'cancelled')
  assert.ok(state.writes[0].endsWith('/runs/20/cancel'))
})

test('input policy requires explicit IDs for every mutation', () => {
  test('a queued run that rejects cancellation is deferred, not failed', async () => {
    const { state, api } = fixture()
    const queued = async (endpoint, method) => {
      if (method === 'POST' && endpoint.endsWith('/cancel')) {
        throw new Error(
          'gh: Cannot cancel a workflow run that is not in progress. (HTTP 409)'
        )
      }
      return api(endpoint, method)
    }
    const result = await cancelRun(queued, 10, { wait: async () => {} })
    assert.equal(result.result, 'cancellation-not-yet-accepted')
    assert.deepEqual(state.writes, [])
  })

  test('a force rejection on a queued run is deferred too', async () => {
    const { state, api } = fixture()
    const stalled = async (endpoint, method) => {
      if (method === 'POST' && endpoint.endsWith('/force-cancel')) {
        throw new Error('gh: Run has not been queued yet (HTTP 422)')
      }
      if (method === 'POST') {
        state.writes.push(endpoint)
        return { data: null }
      }
      return api(endpoint, method)
    }
    const result = await cancelRun(stalled, 10, {
      force: true,
      wait: async () => {},
    })
    assert.equal(result.result, 'force-cancellation-not-yet-accepted')
    assert.equal(state.writes.length, 1)
  })

  test('a non-queue cancellation error still stops the batch', async () => {
    const { api } = fixture()
    const denied = async (endpoint, method) => {
      if (method === 'POST')
        throw new Error('gh: Resource not accessible (HTTP 403)')
      return api(endpoint, method)
    }
    await assert.rejects(cancelRun(denied, 10), /HTTP 403/)
  })
  function detachedFixture() {
    const repo = { id: 1, full_name: 'uzh-bf/klicker-uzh' }
    const run = {
      id: 30,
      workflow_id: 2,
      run_attempt: 1,
      path: '.github/workflows/test-unit.yml',
      event: 'pull_request',
      status: 'queued',
      head_sha: 'a'.repeat(40),
      head_branch: 'rs/merged-branch',
      repository: repo,
      head_repository: repo,
      pull_requests: [],
    }
    const state = { run, writes: [], branchMissing: true, openPR: false }
    const api = async (endpoint, method = 'GET') => {
      if (method === 'POST') {
        state.writes.push(endpoint)
        state.run.status = 'completed'
        state.run.conclusion = 'cancelled'
        return { data: null }
      }
      if (endpoint.endsWith('/runs/30'))
        return { data: structuredClone(state.run) }
      if (endpoint.includes('/branches/')) {
        if (state.branchMissing)
          throw new Error('gh: Branch not found (HTTP 404)')
        return { data: { name: 'rs/merged-branch' } }
      }
      if (endpoint.includes('/pulls'))
        return {
          data: state.openPR
            ? [{ number: 3, state: 'open', head: { ref: 'rs/merged-branch' } }]
            : [
                {
                  number: 3,
                  state: 'closed',
                  head: { ref: 'rs/merged-branch' },
                },
              ],
        }
      throw new Error(`Unexpected endpoint ${endpoint}`)
    }
    return { state, api }
  }

  test('reclaims a queued PR run whose branch was deleted', async () => {
    const { state, api } = detachedFixture()
    const result = await inspectRun(api, 30)
    assert.equal(result.reason, 'merged-or-closed-PR')
    assert.deepEqual(state.writes, [])
  })

  test('preserves a PR run whose branch still exists', async () => {
    const { state, api } = detachedFixture()
    state.branchMissing = false
    assert.equal((await inspectRun(api, 30)).reason, 'branch-still-exists')
  })

  test('preserves a PR run with an open PR for the same branch', async () => {
    const { state, api } = detachedFixture()
    state.openPR = true
    assert.equal((await inspectRun(api, 30)).reason, 'PR-still-open')
  })

  test('fails closed when the branch state cannot be resolved', async () => {
    const { api } = detachedFixture()
    const failing = async (endpoint, method) => {
      if (endpoint.includes('/branches/')) throw new Error('rate limited')
      return api(endpoint, method)
    }
    assert.equal(
      (await inspectRun(failing, 30)).reason,
      'branch-state-unavailable'
    )
  })

  test('applies detached cancellation and verifies terminal result', async () => {
    const { state, api } = detachedFixture()
    const result = await cancelRun(api, 30, { wait: async () => {} })
    assert.equal(result.result, 'cancelled')
    assert.ok(state.writes[0].endsWith('/runs/30/cancel'))
  })
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
