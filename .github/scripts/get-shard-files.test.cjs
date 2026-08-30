const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  buildShardPlans,
  parseProfileManifest,
  parseTimings,
} = require('./get-shard-files.js')

const repositoryRoot = path.join(__dirname, '../..')
const testsDir = path.join(repositoryRoot, 'playwright/tests')
const allFiles = fs
  .readdirSync(testsDir)
  .filter((file) => file.endsWith('.spec.ts'))
  .sort()
const manifest = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'playwright/profiles.json'), 'utf8')
)
const timings = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'playwright/timings.json'), 'utf8')
)

test('the profile manifest assigns every active spec exactly once', () => {
  const profiles = parseProfileManifest(manifest, allFiles)

  assert.deepEqual([...profiles.keys()].sort(), allFiles)
})

test('eight shard plans preserve every spec and emit canonical profiles', () => {
  const profiles = parseProfileManifest(manifest, allFiles)
  const durations = parseTimings(timings, allFiles, () => {})
  const plans = buildShardPlans(allFiles, durations, profiles, 8)

  assert.equal(plans.length, 8)
  assert.deepEqual(
    plans.flatMap((plan) => plan.files).sort(),
    allFiles.map((file) => `tests/${file}`).sort()
  )
  for (const [index, plan] of plans.entries()) {
    assert.equal(plan.version, 1)
    assert.equal(plan.shardIndex, index + 1)
    assert.equal(plan.shardTotal, 8)
    assert.ok(plan.files.length > 0)
    assert.ok(plan.estimatedDuration > 0)
    assert.deepEqual(
      plan.profile.split(','),
      [...plan.profile.split(',')].sort()
    )
  }
})

test('missing, stale, and duplicate profile assignments fail closed', () => {
  assert.throws(
    () =>
      parseProfileManifest(
        { version: 1, groups: [{ profile: 'manage', specs: [] }] },
        ['A-login.spec.ts']
      ),
    /at least one spec/
  )
  assert.throws(
    () =>
      parseProfileManifest(
        {
          version: 1,
          groups: [{ profile: 'manage', specs: ['stale.spec.ts'] }],
        },
        ['A-login.spec.ts']
      ),
    /inactive spec/
  )
  assert.throws(
    () =>
      parseProfileManifest(
        {
          version: 1,
          groups: [
            { profile: 'manage', specs: ['A-login.spec.ts'] },
            { profile: 'pwa', specs: ['A-login.spec.ts'] },
          ],
        },
        ['A-login.spec.ts']
      ),
    /more than one profile/
  )
})
