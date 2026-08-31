const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  buildShardPlans,
  canonicalProfile,
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

test('activity lifecycle specs select the worker-bearing live-quiz profile', () => {
  const profiles = parseProfileManifest(manifest, allFiles)
  const activityLifecycleSpecs = [
    'MA-elements-operations.spec.ts',
    'N-course.spec.ts',
    'P-microlearning.spec.ts',
    'Q-practice-quiz.spec.ts',
    'R-bookmarking.spec.ts',
    'S-group-activity.spec.ts',
    'V-template.spec.ts',
  ]

  for (const spec of activityLifecycleSpecs) {
    assert.ok(
      profiles.get(spec)?.split(',').includes('live-quiz'),
      `${spec} must start the Hatchet workers through live-quiz`
    )
  }
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
    assert.equal(
      plan.profile,
      canonicalProfile(
        plan.files.map((file) => profiles.get(path.basename(file))).join(',')
      )
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

test('invalid timing data and shard counts fail closed', () => {
  assert.throws(
    () => parseTimings({ version: 2, durations: [] }, allFiles, () => {}),
    /unsupported timing schema version/
  )
  assert.throws(
    () =>
      parseTimings(
        {
          version: 1,
          durations: [
            { spec: allFiles[0], duration: 1 },
            { spec: allFiles[0], duration: 2 },
          ],
        },
        allFiles,
        () => {}
      ),
    /duplicate timing entries/
  )
  assert.throws(
    () =>
      parseTimings(
        {
          version: 1,
          durations: [{ spec: allFiles[0], duration: 0 }],
        },
        allFiles,
        () => {}
      ),
    /positive finite number/
  )

  const profiles = parseProfileManifest(manifest, allFiles)
  const durations = parseTimings(timings, allFiles, () => {})
  assert.throws(
    () => buildShardPlans(allFiles, durations, profiles, 0),
    /positive integer/
  )
  assert.throws(
    () => buildShardPlans(allFiles, durations, profiles, allFiles.length + 1),
    /exceeds/
  )
})
