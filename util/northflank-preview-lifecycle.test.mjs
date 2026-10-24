import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_PREVIEW_LIFECYCLE_LIMITS,
  PreviewLifecycleError,
  createPreviewLifecycleState,
  createSerializedPreviewLifecycle,
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
