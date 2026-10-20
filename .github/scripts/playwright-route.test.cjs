const assert = require('node:assert/strict')
const test = require('node:test')

const { choosePlaywrightRoute } = require('./playwright-route.cjs')

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
