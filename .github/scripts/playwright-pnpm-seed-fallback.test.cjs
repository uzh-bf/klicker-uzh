const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const YAML = require('yaml')

const root = path.resolve(__dirname, '../..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

// The seed publishes only from v3 with a key that embeds the full dependency
// fingerprint, so a branch whose manifests differ can never match exactly and
// installs from an empty store. These tests pin the near-match fallback that
// makes the seed reachable without widening any write capability.
test('both public Playwright actions fall back to a same-platform pnpm store', () => {
  for (const action of ['playwright-build', 'playwright-shard']) {
    const actionPath = `.github/actions/${action}/action.yml`
    const parsed = YAML.parse(read(actionPath))
    const restores = parsed.runs.steps.filter((step) =>
      String(step.uses ?? '').startsWith('actions/cache/restore@')
    )
    const pnpm = restores.filter((step) =>
      String(step.with?.key ?? '').includes('-pnpm-')
    )
    assert.equal(pnpm.length, 1, `${actionPath} must have one pnpm restore`)
    assert.deepEqual(
      pnpm[0].with['restore-keys'],
      `playwright-\${{ runner.os }}-\${{ runner.arch }}-pnpm-\n`,
      `${actionPath} must fall back across dependency fingerprints`
    )
    // The fallback must stay inside one platform: a cross-platform restore
    // would hand native binaries to the wrong architecture.
    assert.ok(
      !/\.arch[^\n]*-pnpm-[^\n]*restore/.test(pnpm[0].with['restore-keys'])
    )
  }
})

test('public readers can only restore; the fallback adds no write path', () => {
  for (const action of ['playwright-build', 'playwright-shard']) {
    const contents = read(`.github/actions/${action}/action.yml`)
    assert.ok(
      !contents.includes('actions/cache/save@'),
      `${action} must never save a cache from public PR code`
    )
    assert.ok(
      !contents.includes('$' + '{' + '{ secrets.'),
      `${action} must not resolve secrets`
    )
  }
})

test('the seed keeps publishing one exact-fingerprint store from v3 only', () => {
  const seed = read('.github/workflows/playwright-cache-seed.yml')
  assert.ok(seed.includes('branches: [v3]'))
  assert.ok(!seed.includes('pull_request'))
  // The producer saves exactly one pnpm and one Turbo store; the fallback
  // changes what consumers may read, not what the seed may write.
  assert.equal((seed.match(/actions\/cache\/save@v4/g) ?? []).length, 2)

  // A partial restore reports cache-hit=false, so the seed must still save the
  // complete store. If a partial hit suppressed the save, the fleet would keep
  // inheriting an incomplete seed.
  const parsed = YAML.parse(seed)
  const steps = parsed.jobs.seed.steps
  const pnpmRestore = steps.find((step) =>
    String(step.with?.key ?? '').includes('-pnpm-')
  )
  const pnpmSave = steps.find(
    (step) =>
      String(step.with?.key ?? '').includes('-pnpm-') &&
      String(step.uses ?? '').startsWith('actions/cache/save@')
  )
  assert.ok(pnpmRestore, 'the seed must restore the pnpm store')
  assert.ok(pnpmSave, 'the seed must save the pnpm store')
  assert.equal(
    pnpmRestore.with['restore-keys'],
    `playwright-\${{ runner.os }}-\${{ runner.arch }}-pnpm-\n`
  )
  // Restoring a near-match must not look like an exact hit, otherwise the
  // seed would skip its save and stop refreshing the exact-fingerprint entry.
  assert.equal(
    pnpmSave.if,
    "steps.build.outcome == 'success' && steps.pnpm-cache.outputs.cache-hit != 'true'"
  )
})
