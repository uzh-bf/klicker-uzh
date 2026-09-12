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

test('drafts always use the ready-state hosted plan, whatever the controls say', () => {
  const disabled = choosePlaywrightRoute(
    pullRequest({ prDraft: 'true', publicRolloutEnabled: 'true' })
  )
  assert.deepEqual(disabled, {
    schemaVersion: 1,
    route: 'hosted',
    selectorPrState: 'ready',
    reasonCodes: ['hosted-fallback', 'smart-draft-disabled'],
  })

  // The enabled and canary controls are recorded for diagnostics but cannot
  // narrow a draft plan: the route stays hosted and the selector stays ready.
  for (const overrides of [
    { smartDraftEnabled: 'true' },
    { smartDraftCanaryPr: '1234' },
  ]) {
    const enabled = choosePlaywrightRoute(
      pullRequest({ prDraft: 'true', ...overrides })
    )
    assert.equal(enabled.route, 'hosted')
    assert.equal(enabled.selectorPrState, 'ready')
    assert.ok(enabled.reasonCodes.includes('smart-draft-enabled'))
    assert.ok(enabled.reasonCodes.includes('hosted-fallback'))
  }

  // With public rollout enabled, a draft must not switch to the public route
  // either: both routes must run the ready-state full plan.
  const publicDraft = choosePlaywrightRoute(
    pullRequest({ prDraft: 'true', smartDraftEnabled: 'true' })
  )
  assert.equal(publicDraft.route, 'hosted')
  assert.equal(publicDraft.selectorPrState, 'ready')
})

test('a smart-draft control keeps drafts hosted and ready-state when rollout is off', () => {
  const route = choosePlaywrightRoute(
    pullRequest({
      prDraft: 'true',
      publicRolloutEnabled: '',
      smartDraftEnabled: 'true',
    })
  )
  assert.equal(route.route, 'hosted')
  assert.equal(route.selectorPrState, 'ready')
  assert.ok(route.reasonCodes.includes('smart-draft-enabled'))
  assert.ok(route.reasonCodes.includes('hosted-fallback'))
})

test('false, malformed, and non-matching controls keep drafts hosted and full', () => {
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
