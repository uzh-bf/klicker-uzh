import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const CACHE_SCHEMA = '2'
const BUILD_ENVIRONMENT_SCHEMA = '1'
const NODE_VERSION = '24'
const PNPM_VERSION = '11.5.0'
const BUILD_IMAGE_DIGEST =
  'sha256:6446946a1d9fd62d9ae501312a2d76a43ee688542b21622056a372959b65d63d'

const FIXED_FILES = [
  '.github/actions/playwright-build/action.yml',
  '.github/actions/playwright-shard/action.yml',
  '.github/scripts/playwright-cache.ts',
  '.github/scripts/playwright-telemetry.ts',
  '.github/workflows/playwright-cache-seed.yml',
  '.github/workflows/public-pr-playwright-shards.yml',
  '.github/workflows/test-playwright.yml',
  '.npmrc',
  'playwright/profiles.json',
  'playwright/runtime-contract.yml',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
]

function compareNames(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

function trackedFiles(root: string) {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'buffer',
  })

  return output.toString('utf8').split('\0').filter(Boolean)
}

function isPackageManifest(file: string) {
  return path.basename(file) === 'package.json'
}

function relevantFiles(files: string[]) {
  const selected = new Set(
    files.filter(
      (file) => FIXED_FILES.includes(file) || isPackageManifest(file)
    )
  )

  return [...selected].sort(compareNames)
}

function buildFingerprint({
  root,
  files = trackedFiles(root),
  buildImageDigest = BUILD_IMAGE_DIGEST,
}: {
  root: string
  files?: string[]
  buildImageDigest?: string
}) {
  const hash = crypto.createHash('sha256')
  hash.update(
    JSON.stringify({
      cacheSchema: CACHE_SCHEMA,
      buildEnvironmentSchema: BUILD_ENVIRONMENT_SCHEMA,
      nodeVersion: NODE_VERSION,
      pnpmVersion: PNPM_VERSION,
      buildImageDigest,
    })
  )

  for (const file of relevantFiles(files)) {
    const filePath = path.join(root, file)
    let contents: Buffer
    try {
      contents = fs.readFileSync(filePath)
    } catch (error) {
      throw new Error(
        `could not read cache contract file ${file}: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    hash.update('\0')
    hash.update(file)
    hash.update('\0')
    hash.update(contents)
  }

  return `v${CACHE_SCHEMA}-${hash.digest('hex').slice(0, 32)}`
}

function dependencyFingerprint({
  root,
  files = trackedFiles(root),
  buildImageDigest = BUILD_IMAGE_DIGEST,
}: {
  root: string
  files?: string[]
  buildImageDigest?: string
}) {
  const hash = crypto.createHash('sha256')
  hash.update(
    JSON.stringify({
      schema: 2,
      node: NODE_VERSION,
      pnpm: PNPM_VERSION,
      buildImageDigest,
    })
  )
  const dependencyFiles = files.filter(
    (file) =>
      isPackageManifest(file) ||
      [
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        '.npmrc',
        '.pnpmfile.cjs',
      ].includes(file) ||
      file.startsWith('patches/')
  )
  for (const file of [...new Set(dependencyFiles)].sort(compareNames)) {
    hash.update('\0')
    hash.update(file)
    hash.update('\0')
    let contents: Buffer | string = fs.readFileSync(path.join(root, file))
    if (isPackageManifest(file)) {
      const manifest = JSON.parse(contents.toString('utf8'))
      // The pnpm store is reused before a fresh frozen install, not as node_modules.
      // Keep installation hooks and all other fields; omit routine task scripts.
      manifest.scripts = Object.fromEntries(
        Object.entries(manifest.scripts ?? {}).filter(([name]) =>
          [
            'pnpm:devPreinstall',
            'preinstall',
            'install',
            'postinstall',
            'prepublish',
            'preprepare',
            'prepare',
            'postprepare',
          ].includes(name)
        )
      )
      contents = JSON.stringify(manifest)
    }
    hash.update(contents)
  }
  return `v2-${hash.digest('hex').slice(0, 32)}`
}

function main(argv = process.argv.slice(2)) {
  const rootIndex = argv.indexOf('--root')
  const root = rootIndex === -1 ? process.cwd() : argv[rootIndex + 1]
  if (!root || root.startsWith('--')) {
    throw new Error('expected --root <repository>')
  }

  const fingerprint = buildFingerprint({ root: path.resolve(root) })
  const dependency = dependencyFingerprint({ root: path.resolve(root) })
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: GitHub Actions output contract
  const output = process.env.GITHUB_OUTPUT
  if (output) {
    fs.appendFileSync(output, `fingerprint=${fingerprint}\n`)
    fs.appendFileSync(output, `dependency-fingerprint=${dependency}\n`)
  }
  console.log(fingerprint)
}

if (import.meta.main) {
  try {
    main()
  } catch (error) {
    console.error(
      `Playwright cache contract failed: ${error instanceof Error ? error.message : String(error)}`
    )
    process.exitCode = 1
  }
}

export {
  BUILD_ENVIRONMENT_SCHEMA,
  BUILD_IMAGE_DIGEST,
  buildFingerprint,
  CACHE_SCHEMA,
  dependencyFingerprint,
  FIXED_FILES,
  isPackageManifest,
  NODE_VERSION,
  PNPM_VERSION,
  relevantFiles,
}
