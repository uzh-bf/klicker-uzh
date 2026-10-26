const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  TURBO_FILTER,
  inspectPlan,
  mergedProfile,
  planBuildGraph,
  planProfiles,
  resolveProfileFilters,
  writeBuildFilters,
  writeGithubOutputs,
} = require('./playwright-build-graph.cjs')

function shards(...profiles) {
  return profiles.map((profile, index) => ({
    files: [`tests/spec-${String(index)}.spec.ts`],
    profile,
    shardIndex: index + 1,
    shardTotal: profiles.length,
  }))
}

function plan(mode, ...profiles) {
  return { mode, schemaVersion: 1, shards: shards(...profiles) }
}

// A candidate checkout that carries the complete profile runtime the shard
// runtime requires before it will resolve a profile at all.
function profileRuntimeRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'klicker-build-graph-'))
  t.after(() => fs.rmSync(root, { force: true, recursive: true }))
  for (const file of [
    'playwright/profiles.json',
    'playwright/runtime-contract.yml',
    'util/playwright-profile-runtime.mjs',
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), '')
  }
  return root
}

// A resolver stand-in that writes the devrouter plan shape the real module
// validates and returns.
function resolverWriting(payload, status = 0, stderr = '') {
  return (_command, args) => {
    const outputPath = args[args.indexOf('--output') + 1]
    if (status === 0) {
      fs.writeFileSync(outputPath, JSON.stringify(payload))
    }
    return { status, stderr, stdout: '' }
  }
}

test('only a bounded selected plan narrows the build graph', (t) => {
  const root = profileRuntimeRoot(t)
  assert.deepEqual(inspectPlan({ plan: plan('full'), root }), {
    mode: 'full',
    profile: '',
    reason: 'plan-mode-full',
  })
  assert.deepEqual(inspectPlan({ plan: plan('skip'), root }), {
    mode: 'full',
    profile: '',
    reason: 'plan-mode-skip',
  })
  assert.deepEqual(
    inspectPlan({ plan: plan('selected', 'manage,pwa', 'pwa'), root }),
    { mode: 'bounded', profile: 'manage,pwa', reason: 'bounded-profile' }
  )
})

test('an incomplete profile runtime, a maximal profile, and a missing shard profile all keep the full graph', (t) => {
  const root = profileRuntimeRoot(t)
  assert.deepEqual(
    inspectPlan({ plan: plan('selected', 'pwa'), root: os.tmpdir() }),
    {
      mode: 'full',
      profile: '',
      reason: 'profile-runtime-incomplete',
    }
  )
  assert.deepEqual(
    inspectPlan({ plan: plan('selected', 'manage,full'), root }),
    { mode: 'full', profile: '', reason: 'maximal-profile' }
  )
  assert.deepEqual(
    inspectPlan({ plan: plan('selected', 'playwright'), root }),
    { mode: 'full', profile: '', reason: 'maximal-profile' }
  )
  const missing = plan('selected', 'pwa')
  delete missing.shards[0].profile
  const inspection = inspectPlan({ plan: missing, root })
  assert.equal(inspection.mode, 'full')
  assert.equal(inspection.reason, 'plan-unusable')
})

test('shard profiles merge additively and reject empty components', () => {
  assert.deepEqual(mergedProfile(['manage,pwa', 'pwa']), {
    maximal: false,
    profile: 'manage,pwa',
  })
  assert.deepEqual(mergedProfile(['live-quiz', 'manage,chat']), {
    maximal: false,
    profile: 'chat,live-quiz,manage',
  })
  assert.throws(() => mergedProfile(['manage,,pwa']), /empty component/)
  assert.throws(
    () => planProfiles({ mode: 'selected', schemaVersion: 1 }),
    /shard profile/
  )
  assert.throws(
    () => planProfiles({ mode: 'unknown', schemaVersion: 1, shards: [] }),
    /unsupported Playwright plan mode/
  )
  assert.throws(
    () => planProfiles({ mode: 'full', schemaVersion: 2, shards: [] }),
    /unsupported Playwright plan schema/
  )
})

test('the resolved plan supplies sorted unique workspace filters', (t) => {
  const root = profileRuntimeRoot(t)
  const outputPath = path.join(root, 'runtime.json')
  const resolved = resolveProfileFilters({
    devrouterBin: '/opt/devrouter',
    outputPath,
    profile: 'manage,pwa',
    root,
    run: resolverWriting({
      apps: ['pwa', 'api'],
      bindings: {
        serviceEndpoints: ['http://127.0.0.1:3001'],
        turboFilters: [
          '--filter=@klicker-uzh/frontend-pwa',
          '--filter=@klicker-uzh/backend-docker',
          '--filter=@klicker-uzh/frontend-pwa',
        ],
      },
    }),
  })
  assert.deepEqual(resolved.filters, [
    '--filter=@klicker-uzh/backend-docker',
    '--filter=@klicker-uzh/frontend-pwa',
  ])
  assert.deepEqual(resolved.apps, ['api', 'pwa'])
  assert.equal(TURBO_FILTER.test(resolved.filters[0]), true)
})

test('a resolver that fails, crashes, or returns an unexpected filter keeps the full graph', (t) => {
  const root = profileRuntimeRoot(t)
  const outputPath = path.join(root, 'runtime.json')
  const bounded = plan('selected', 'manage,pwa')
  const resolve = (run) =>
    planBuildGraph({ outputPath, plan: bounded, root, run })

  const failed = resolve(resolverWriting({}, 1, 'devrouter missing'))
  assert.equal(failed.mode, 'full')
  assert.equal(failed.reason, 'resolver-unavailable')
  assert.match(failed.detail, /devrouter missing/)

  const crashed = resolve(() => ({ error: new Error('spawn failed') }))
  assert.equal(crashed.mode, 'full')
  assert.match(crashed.detail, /could not start/)

  const unexpected = resolve(
    resolverWriting({
      apps: ['api'],
      bindings: { turboFilters: ['--filter=@klicker-uzh/../../etc'] },
    })
  )
  assert.equal(unexpected.mode, 'full')
  assert.match(unexpected.detail, /unexpected turbo filter/)

  const empty = resolve(
    resolverWriting({ apps: [], bindings: { turboFilters: [] } })
  )
  assert.equal(empty.mode, 'full')
  assert.match(empty.detail, /no turbo filters/)

  const missing = resolve(resolverWriting({ apps: [] }))
  assert.equal(missing.mode, 'full')
  assert.match(missing.detail, /no bindings/)
})

test('a bounded plan publishes the filters the build step consumes', (t) => {
  const root = profileRuntimeRoot(t)
  const output = path.join(root, 'github-output')
  fs.writeFileSync(output, '')
  const filtersPath = path.join(root, 'filters.txt')
  const graph = planBuildGraph({
    outputPath: path.join(root, 'runtime.json'),
    plan: plan('selected', 'manage,pwa', 'pwa'),
    root,
    run: resolverWriting({
      apps: ['auth'],
      bindings: { turboFilters: ['--filter=@klicker-uzh/auth'] },
    }),
  })
  assert.equal(graph.mode, 'bounded')
  assert.deepEqual(graph.filters, ['--filter=@klicker-uzh/auth'])

  writeBuildFilters(filtersPath, graph)
  assert.equal(
    fs.readFileSync(filtersPath, 'utf8'),
    '--filter=@klicker-uzh/auth\n'
  )

  writeGithubOutputs(
    {
      filters: graph.filters.join(' '),
      mode: graph.mode,
      profile: graph.profile,
    },
    output
  )
  assert.equal(
    fs.readFileSync(output, 'utf8'),
    'filters=--filter=@klicker-uzh/auth\nmode=bounded\nprofile=manage,pwa\n'
  )
})

test('a wave that stays complete removes an earlier filter list', (t) => {
  const root = profileRuntimeRoot(t)
  const filtersPath = path.join(root, 'filters.txt')
  fs.writeFileSync(filtersPath, '--filter=@klicker-uzh/auth\n')

  writeBuildFilters(filtersPath, { filters: [], mode: 'full' })
  assert.equal(fs.existsSync(filtersPath), false)

  // A bounded decision without any filter cannot bound the wave either.
  writeBuildFilters(filtersPath, { filters: [], mode: 'bounded' })
  assert.equal(fs.existsSync(filtersPath), false)

  assert.doesNotThrow(() =>
    writeBuildFilters('', { filters: [], mode: 'full' })
  )
})
