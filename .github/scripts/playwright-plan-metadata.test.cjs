const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  buildPlanMetadata,
  writeGithubOutputs,
  main,
} = require('./playwright-plan-metadata.cjs')

function plan(
  mode,
  shardCount = mode === 'skip' ? 0 : 1,
  envelopeClass = 'application'
) {
  return {
    schemaVersion: 1,
    mode,
    envelopeClass,
    shardCount,
    reasonCodes: [],
    shards: Array.from({ length: shardCount }, (_, index) => ({
      shardIndex: index + 1,
      shardTotal: shardCount,
      files: [`tests/spec-${index}.spec.ts`],
    })),
  }
}

test('only a validated nonempty plan can request admission before output publication', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-admission-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const planFile = path.join(directory, 'plan.json')
  const routeFile = path.join(directory, 'route.json')
  const output = path.join(directory, 'output')
  const env = {
    EVENT_NAME: 'pull_request',
    REPOSITORY: 'uzh-bf/klicker-uzh',
    REPOSITORY_PRIVATE: 'false',
    HEAD_REPOSITORY: 'uzh-bf/klicker-uzh',
    PR_AUTHOR: 'synthetic',
    PR_DRAFT: 'false',
    PR_NUMBER: '1234',
    PUBLIC_ROLLOUT_ENABLED: 'true',
    GITHUB_RUN_ID: '100',
    GITHUB_RUN_ATTEMPT: '1',
    HEAD_SHA: 'a'.repeat(40),
    BASE_SHA: 'b'.repeat(40),
    CONTROL_SHA: 'c'.repeat(40),
    WARPBUILD_ADMISSION_URL: 'https://admission.example.invalid/admit',
    ACTIONS_ID_TOKEN_REQUEST_URL:
      'https://pipelines.actions.githubusercontent.com/token',
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'synthetic',
  }
  const route = { route: 'public-pr', selectorPrState: 'ready' }
  let earlyCalls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    earlyCalls++
    throw new Error('admission before plan')
  })
  await require('./playwright-route.cjs').main(['--output', routeFile], env)
  assert.equal(earlyCalls, 0)
  let calls = 0
  const network = async () => {
    calls++
    return calls % 2 === 1
      ? Response.json({ value: 'synthetic-token' })
      : Response.json({
          ticket: {
            runId: '100',
            runAttempt: '1',
            pullRequestNumber: '1234',
            headSha: env.HEAD_SHA,
            baseSha: env.BASE_SHA,
            controlSha: env.CONTROL_SHA,
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          },
        })
  }
  const args = ['--plan', planFile, '--route', routeFile, '--output', output]
  for (const candidate of [
    plan('skip', 0, 'documentation-and-planning'),
    plan('full', 8),
  ]) {
    fs.writeFileSync(planFile, JSON.stringify(candidate))
    fs.writeFileSync(routeFile, JSON.stringify(route))
    await main(args, env, network)
    const result = JSON.parse(fs.readFileSync(routeFile))
    assert.equal(calls, candidate.mode === 'skip' ? 0 : 2)
    assert.equal(
      result.provider,
      candidate.mode === 'skip' ? undefined : 'warpbuild'
    )
    assert.match(
      fs.readFileSync(output, 'utf8'),
      candidate.mode === 'skip' ? /should_run=false/ : /provider=warpbuild/
    )
  }
  fs.writeFileSync(planFile, JSON.stringify(plan('full', 0)))
  await assert.rejects(main(args, env, network))
  assert.equal(calls, 2)
  fs.writeFileSync(planFile, JSON.stringify(plan('full', 8)))
  fs.writeFileSync(routeFile, JSON.stringify(route))
  fs.writeFileSync(output, '')
  let fallbackCalls = 0
  await main(args, env, async () =>
    ++fallbackCalls === 1
      ? Response.json({ value: 'synthetic-token' })
      : Response.json({ reason: 'unavailable' }, { status: 409 })
  )
  const fallback = JSON.parse(fs.readFileSync(routeFile))
  assert.equal(fallbackCalls, 2)
  assert.equal(fallback.provider, undefined)
  assert.equal(fallback.admissionAttempt, undefined)
  assert.match(fs.readFileSync(output, 'utf8'), /^provider=public-pool$/m)
  assert.match(fs.readFileSync(output, 'utf8'), /^should_run=true$/m)
  delete env.WARPBUILD_ADMISSION_URL
  env.GITHUB_RUN_NUMBER = '42'
  env.GITHUB_REF = 'refs/pull/1234/merge'
  env.WARPBUILD_BURST_GRANT = JSON.stringify({
    workflowId: '900',
    runNumber: '42',
    pullRequestNumber: env.PR_NUMBER,
    headSha: env.HEAD_SHA,
    baseSha: env.BASE_SHA,
    controlSha: env.CONTROL_SHA,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  })
  let apiCalls = 0
  let coordinatorCalls = 0
  const deniedApi = async () => {
    apiCalls++
    throw new Error('unavailable')
  }
  for (const candidate of [
    plan('skip', 0, 'documentation-and-planning'),
    plan('full', 8),
  ]) {
    fs.writeFileSync(planFile, JSON.stringify(candidate))
    fs.writeFileSync(routeFile, JSON.stringify(route))
    fs.writeFileSync(output, '')
    await main(
      args,
      env,
      async () => {
        coordinatorCalls++
        throw new Error('unexpected coordinator')
      },
      deniedApi
    )
    assert.equal(apiCalls, candidate.mode === 'skip' ? 0 : 1)
    assert.equal(JSON.parse(fs.readFileSync(routeFile)).provider, undefined)
    assert.match(fs.readFileSync(output, 'utf8'), /^provider=public-pool$/m)
  }
  fs.writeFileSync(planFile, JSON.stringify(plan('full', 0)))
  await assert.rejects(main(args, env, undefined, deniedApi))
  assert.equal(apiCalls, 1)
  env.WARPBUILD_ADMISSION_URL = 'https://admission.example.invalid/admit'
  fs.writeFileSync(planFile, JSON.stringify(plan('full', 8)))
  await main(
    args,
    env,
    async () => {
      coordinatorCalls++
      throw new Error('unexpected coordinator')
    },
    deniedApi
  )
  assert.equal(coordinatorCalls, 0)
})

test('provider metadata selects only fixed runners and binds paid attempts', () => {
  const route = {
    route: 'public-pr',
    selectorPrState: 'ready',
    provider: 'warpbuild',
    admissionAttempt: '2',
  }
  const cloud = buildPlanMetadata(plan('full', 8), route)
  assert.deepEqual(cloud.buildRunner, {
    group: 'Default',
    labels: 'warp-ubuntu-2404-arm64-8x',
  })
  assert.deepEqual(cloud.shardRunner, {
    group: 'Default',
    labels: 'warp-ubuntu-2404-arm64-4x',
  })
  assert.equal(cloud.admissionAttempt, '2')
  assert.equal(cloud.jobTimeout, 45)
  const ordinary = buildPlanMetadata(plan('full', 8), {
    route: 'public-pr',
    selectorPrState: 'ready',
  })
  assert.equal(ordinary.provider, 'public-pool')
  assert.deepEqual(ordinary.buildRunner, {
    group: 'public-pr-arm64',
    labels: [
      'linux',
      'arm64',
      'docker',
      'public-pr-arm64',
      'playwright',
      'playwright-build',
    ],
  })
  assert.deepEqual(ordinary.shardRunner, {
    group: 'public-pr-arm64',
    labels: [
      'linux',
      'arm64',
      'docker',
      'public-pr-arm64',
      'playwright',
      'playwright-shard',
    ],
  })
  assert.equal(ordinary.jobTimeout, 120)
  for (const overrides of [
    { provider: 'arbitrary' },
    { route: 'hosted' },
    { selectorPrState: 'draft' },
    { admissionAttempt: '' },
    { admissionAttempt: '1\ninjected=x' },
  ]) {
    assert.throws(
      () => buildPlanMetadata(plan('full', 8), { ...route, ...overrides }),
      /provider|admission/
    )
  }
})

test('metadata exposes one matrix for selected plans and no matrix for skips', () => {
  const selected = buildPlanMetadata(plan('selected', 2), {
    route: 'hosted',
    selectorPrState: 'draft',
  })
  assert.equal(selected.shouldRun, true)
  assert.deepEqual(selected.shardMatrix, {
    include: [
      { shardIndex: 1, shardTotal: 2 },
      { shardIndex: 2, shardTotal: 2 },
    ],
  })

  const skipped = buildPlanMetadata(plan('skip'), {
    route: 'hosted',
    selectorPrState: 'draft',
  })
  assert.equal(skipped.shouldRun, false)
  assert.deepEqual(skipped.shardMatrix, { include: [] })
})

test('ready execution fails closed unless the plan is full', () => {
  assert.throws(
    () =>
      buildPlanMetadata(plan('selected'), {
        route: 'public-pr',
        selectorPrState: 'ready',
      }),
    /ready execution must use the full/
  )
})

test('a bounded change class may narrow the ready plan it attests', () => {
  const documented = buildPlanMetadata(
    plan('skip', 0, 'documentation-and-planning'),
    {
      route: 'hosted',
      selectorPrState: 'ready',
    }
  )
  assert.equal(documented.mode, 'skip')
  assert.equal(documented.envelopeClass, 'documentation-and-planning')
  assert.equal(documented.shouldRun, false)

  const ci = buildPlanMetadata(plan('selected', 1, 'ci-orchestration'), {
    route: 'public-pr',
    selectorPrState: 'ready',
  })
  assert.equal(ci.mode, 'selected')
  assert.equal(ci.envelopeClass, 'ci-orchestration')
  assert.equal(ci.shouldRun, true)
})

test('an unknown or absent change class fails closed', () => {
  const absent = plan('selected', 1)
  // delete, because an explicit undefined argument would take the fixture
  // default and silently exercise the application class instead.
  delete absent.envelopeClass
  for (const candidate of [absent, null, '', 'narrow', 'constructor']) {
    const target =
      candidate && typeof candidate === 'object'
        ? candidate
        : plan('selected', 1, candidate)
    assert.throws(
      () =>
        buildPlanMetadata(target, {
          route: 'hosted',
          selectorPrState: 'ready',
        }),
      /unsupported change class/,
      String(candidate)
    )
  }
})

test('the envelope class travels through the workflow output', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-metadata-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const output = path.join(directory, 'outputs.txt')
  fs.writeFileSync(output, '')
  writeGithubOutputs(
    buildPlanMetadata(plan('selected', 1, 'ci-orchestration'), {
      route: 'public-pr',
      selectorPrState: 'ready',
    }),
    output
  )
  assert.match(
    fs.readFileSync(output, 'utf8'),
    /^envelope_class=ci-orchestration$/m
  )
})

test('ready execution fails closed unless the full plan has eight shards', () => {
  assert.throws(
    () =>
      buildPlanMetadata(plan('full', 4), {
        route: 'public-pr',
        selectorPrState: 'ready',
      }),
    /exactly eight/
  )
})

test('valid full ready execution exposes all eight matrix entries', () => {
  const metadata = buildPlanMetadata(plan('full', 8), {
    route: 'public-pr',
    selectorPrState: 'ready',
  })

  assert.equal(metadata.shouldRun, true)
  assert.equal(metadata.shardMatrix.include.length, 8)
  assert.deepEqual(
    metadata.shardMatrix.include,
    Array.from({ length: 8 }, (_, index) => ({
      shardIndex: index + 1,
      shardTotal: 8,
    }))
  )
})

test('invalid shard metadata fails closed', () => {
  const invalid = plan('full', 8)
  invalid.shards[0].files = []
  assert.throws(
    () =>
      buildPlanMetadata(invalid, {
        route: 'hosted',
        selectorPrState: 'ready',
      }),
    /invalid shard/
  )
})

test('duplicate shard indices and unsafe reason codes fail closed', () => {
  const duplicate = plan('full', 8)
  duplicate.shards[1].shardIndex = 1
  assert.throws(
    () =>
      buildPlanMetadata(duplicate, {
        route: 'hosted',
        selectorPrState: 'ready',
      }),
    /duplicate shard indices/
  )

  const unsafeReason = plan('selected', 1)
  unsafeReason.reasonCodes = ['ok\nforged=value']
  assert.throws(
    () =>
      buildPlanMetadata(unsafeReason, {
        route: 'hosted',
        selectorPrState: 'draft',
      }),
    /reason codes/
  )
})

test('deferred execution attests only the skip plan', () => {
  const deferred = buildPlanMetadata(plan('skip'), {
    route: 'hosted',
    selectorPrState: 'deferred',
  })
  assert.equal(deferred.shouldRun, false)
  assert.equal(deferred.selectorPrState, 'deferred')
  assert.throws(
    () =>
      buildPlanMetadata(plan('selected'), {
        route: 'hosted',
        selectorPrState: 'deferred',
      }),
    /deferred execution must use the skip/
  )
})
