const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const CACHE_SCHEMA = '2'
const BUILD_ENVIRONMENT_SCHEMA = '1'
const NODE_VERSION = '24'
const PNPM_VERSION = '11.5.0'
const BUILD_IMAGE_DIGEST =
  'sha256:6446946a1d9fd62d9ae501312a2d76a43ee688542b21622056a372959b65d63d'

const FIXED_FILES = [
  '.github/scripts/playwright-cache-contract.cjs',
  '.github/scripts/playwright-telemetry.cjs',
  '.github/scripts/turbo-telemetry.cjs',
  '.github/workflows/playwright-cache-seed.yml',
  '.github/workflows/public-pr-playwright-shards.yml',
  '.github/workflows/test-playwright.yml',
  'playwright/profiles.json',
  'playwright/runtime-contract.yml',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
]

function compareNames(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

function trackedFiles(root) {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'buffer',
  })

  return output.toString('utf8').split('\0').filter(Boolean)
}

function isPackageManifest(file) {
  return path.basename(file) === 'package.json'
}

function relevantFiles(files) {
  const selected = new Set(
    files.filter(
      (file) => FIXED_FILES.includes(file) || isPackageManifest(file)
    )
  )

  return [...selected].sort(compareNames)
}

function buildFingerprint({ root, files = trackedFiles(root) }) {
  const hash = crypto.createHash('sha256')
  hash.update(
    JSON.stringify({
      cacheSchema: CACHE_SCHEMA,
      buildEnvironmentSchema: BUILD_ENVIRONMENT_SCHEMA,
      nodeVersion: NODE_VERSION,
      pnpmVersion: PNPM_VERSION,
      buildImageDigest: BUILD_IMAGE_DIGEST,
    })
  )

  for (const file of relevantFiles(files)) {
    const filePath = path.join(root, file)
    if (!fs.existsSync(filePath)) {
      throw new Error(`cache contract file is missing: ${file}`)
    }

    hash.update('\0')
    hash.update(file)
    hash.update('\0')
    hash.update(fs.readFileSync(filePath))
  }

  return `v${CACHE_SCHEMA}-${hash.digest('hex').slice(0, 32)}`
}

function main(argv = process.argv.slice(2)) {
  const rootIndex = argv.indexOf('--root')
  const root = rootIndex === -1 ? process.cwd() : argv[rootIndex + 1]
  if (!root || root.startsWith('--')) {
    throw new Error('expected --root <repository>')
  }

  const fingerprint = buildFingerprint({ root: path.resolve(root) })
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: GitHub Actions output contract
  const output = process.env.GITHUB_OUTPUT
  if (output) {
    fs.appendFileSync(output, `fingerprint=${fingerprint}\n`)
  }
  console.log(fingerprint)
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`Playwright cache contract failed: ${error.message}`)
    process.exitCode = 1
  }
}

module.exports = {
  BUILD_ENVIRONMENT_SCHEMA,
  BUILD_IMAGE_DIGEST,
  CACHE_SCHEMA,
  FIXED_FILES,
  NODE_VERSION,
  PNPM_VERSION,
  buildFingerprint,
  isPackageManifest,
  relevantFiles,
}
