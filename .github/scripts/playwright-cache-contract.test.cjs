const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  BUILD_IMAGE_DIGEST,
  buildFingerprint,
  dependencyFingerprint,
  relevantFiles,
} = require('./playwright-cache-contract.cjs')

function fixtureRoot(files) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'playwright-cache-contract-')
  )
  for (const [file, contents] of Object.entries(files)) {
    const filePath = path.join(root, file)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, contents)
  }
  return root
}

test('the cache contract includes package manifests and fixed compatibility files', () => {
  assert.deepEqual(
    relevantFiles([
      'apps/auth/package.json',
      'packages/util/package.json',
      '.github/actions/playwright-build/action.yml',
      '.github/actions/playwright-shard/action.yml',
      'pnpm-lock.yaml',
      'turbo.json',
      '.npmrc',
      'README.md',
    ]),
    [
      '.github/actions/playwright-build/action.yml',
      '.github/actions/playwright-shard/action.yml',
      '.npmrc',
      'apps/auth/package.json',
      'packages/util/package.json',
      'pnpm-lock.yaml',
      'turbo.json',
    ]
  )
})

test('dependency cache survives orchestration changes but tracks installation inputs', (t) => {
  const files = {
    'package.json': '{"dependencies":{"example":"1.0.0"}}',
    'pnpm-lock.yaml': 'lockfileVersion: 9.0',
    'pnpm-workspace.yaml': 'packages: []',
    '.npmrc': 'verify-store-integrity=true',
    '.pnpmfile.cjs': 'module.exports = {}',
    'patches/example.patch': 'original patch',
    'turbo.json': '{"tasks":{}}',
    '.github/actions/playwright-build/action.yml': 'original workflow',
  }
  const root = fixtureRoot(files)
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const input = { root, files: Object.keys(files) }
  const original = dependencyFingerprint(input)
  assert.notEqual(
    original,
    dependencyFingerprint({ ...input, buildImageDigest: 'different-image' })
  )
  assert.equal(
    original,
    dependencyFingerprint({ ...input, files: [...input.files].reverse() })
  )
  for (const file of [
    'turbo.json',
    '.github/actions/playwright-build/action.yml',
  ]) {
    fs.writeFileSync(path.join(root, file), 'changed orchestration')
  }
  assert.equal(original, dependencyFingerprint(input))
  for (const file of Object.keys(files).slice(0, 6)) {
    fs.writeFileSync(
      path.join(root, file),
      file === 'package.json'
        ? '{"dependencies":{"example":"2.0.0"}}'
        : `${files[file]}\nchanged`
    )
    assert.notEqual(original, dependencyFingerprint(input), file)
    fs.writeFileSync(path.join(root, file), files[file])
  }
})

test('task scripts preserve the store key while installation hooks invalidate it', (t) => {
  const root = fixtureRoot({ 'package.json': '{}' })
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const input = { root, files: ['package.json'] }
  const original = dependencyFingerprint(input)
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ scripts: { 'test:dev-runtime': 'node test.mjs' } })
  )
  assert.equal(dependencyFingerprint(input), original)
  const build = buildFingerprint(input)
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ scripts: { 'test:dev-runtime': 'node other-test.mjs' } })
  )
  assert.equal(dependencyFingerprint(input), original)
  assert.notEqual(buildFingerprint(input), build)
  for (const hook of [
    'preinstall',
    'install',
    'postinstall',
    'prepare',
    'pnpm:devPreinstall',
  ]) {
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ scripts: { [hook]: 'node install.mjs' } })
    )
    assert.notEqual(dependencyFingerprint(input), original, hook)
  }
  fs.writeFileSync(path.join(root, 'package.json'), '{invalid')
  assert.throws(() => dependencyFingerprint(input), SyntaxError)
})

test('the fingerprint is deterministic and includes the image digest', (t) => {
  const root = fixtureRoot({
    'package.json': '{"engines":{"node":"24"}}',
    'pnpm-lock.yaml': 'lockfileVersion: 9.0',
    'turbo.json': '{"tasks":{}}',
    '.github/actions/playwright-build/action.yml': 'build-action',
    '.github/actions/playwright-shard/action.yml': 'shard-action',
    '.github/scripts/playwright-cache-contract.cjs': 'contract',
    '.github/scripts/playwright-telemetry.cjs': 'telemetry',
    '.github/workflows/playwright-cache-seed.yml': 'seed',
    '.github/workflows/public-pr-playwright-shards.yml': 'public',
    '.github/workflows/test-playwright.yml': 'hosted',
    '.npmrc': 'public-hoist-pattern[]=*',
    'playwright/profiles.json': '{}',
    'playwright/runtime-contract.yml': 'version: 1',
    'pnpm-workspace.yaml': 'packages:',
  })
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const files = Object.keys({
    'package.json': true,
    'pnpm-lock.yaml': true,
    'turbo.json': true,
    '.github/actions/playwright-build/action.yml': true,
    '.github/actions/playwright-shard/action.yml': true,
    '.github/scripts/playwright-cache-contract.cjs': true,
    '.github/scripts/playwright-telemetry.cjs': true,
    '.github/workflows/playwright-cache-seed.yml': true,
    '.github/workflows/public-pr-playwright-shards.yml': true,
    '.github/workflows/test-playwright.yml': true,
    '.npmrc': true,
    'playwright/profiles.json': true,
    'playwright/runtime-contract.yml': true,
    'pnpm-workspace.yaml': true,
  })

  const fingerprint = buildFingerprint({ root, files })
  assert.equal(fingerprint, buildFingerprint({ root, files }))
  assert.match(BUILD_IMAGE_DIGEST, /^sha256:[0-9a-f]{64}$/)
  assert.notEqual(
    fingerprint,
    buildFingerprint({
      root,
      files,
      buildImageDigest: `sha256:${'0'.repeat(64)}`,
    })
  )

  fs.writeFileSync(path.join(root, 'turbo.json'), '{"tasks":{"build":{}}}')
  assert.notEqual(fingerprint, buildFingerprint({ root, files }))
})
