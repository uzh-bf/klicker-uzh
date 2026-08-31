const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  BUILD_IMAGE_DIGEST,
  buildFingerprint,
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
      'README.md',
    ]),
    [
      '.github/actions/playwright-build/action.yml',
      '.github/actions/playwright-shard/action.yml',
      'apps/auth/package.json',
      'packages/util/package.json',
      'pnpm-lock.yaml',
      'turbo.json',
    ]
  )
})

test('the fingerprint is deterministic and includes the image digest', () => {
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
    'playwright/profiles.json': '{}',
    'playwright/runtime-contract.yml': 'version: 1',
    'pnpm-workspace.yaml': 'packages:',
  })
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
    'playwright/profiles.json': true,
    'playwright/runtime-contract.yml': true,
    'pnpm-workspace.yaml': true,
  })

  assert.equal(
    buildFingerprint({ root, files }),
    buildFingerprint({ root, files })
  )
  assert.match(BUILD_IMAGE_DIGEST, /^sha256:[0-9a-f]{64}$/)

  fs.writeFileSync(path.join(root, 'turbo.json'), '{"tasks":{"build":{}}}')
  assert.notEqual(
    buildFingerprint({ root, files }),
    buildFingerprint({
      root,
      files: files.filter((file) => file !== 'turbo.json'),
    })
  )
})
