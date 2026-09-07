#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const COMPOSE_WORKSPACE_ROOT = '/workspaces/klicker-uzh'
const PNPM_VERIFY_DEPS_ENV = 'pnpm_config_verify_deps_before_run'
const PNPM_LIST_TIMEOUT_MS = 55_000
const SAFE_RELATIVE_PATH = /^(?!\/)(?!.*\/\/)(?!.*\/$)[a-zA-Z0-9_./-]+$/

const STABLE_VOLUME_NAMES = new Map([
  ['playwright', 'node_modules_playwright'],
  ['packages/prisma', 'node_modules_prisma'],
  ['packages/types', 'node_modules_types'],
])

function fail(message) {
  throw new Error(message)
}

function canonicalRoot(root) {
  const candidate = resolve(root)

  try {
    const stat = lstatSync(candidate)
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      fail('checkout root is not a real directory')
    }
    return realpathSync(candidate)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'checkout root is not a real directory'
    ) {
      throw error
    }
    fail('checkout root could not be resolved')
  }
}

function assertSafeRelativePath(packagePath) {
  if (
    typeof packagePath !== 'string' ||
    packagePath.length === 0 ||
    !SAFE_RELATIVE_PATH.test(packagePath) ||
    packagePath
      .split('/')
      .some((segment) => segment === '.' || segment === '..')
  ) {
    fail('workspace package path is unsafe')
  }
}

function assertInsideRoot(root, candidate) {
  const relativePath = relative(root, candidate)
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    fail('workspace package path escapes the checkout')
  }
  return relativePath.split(sep).join('/')
}

function assertPackageDirectory(root, packagePath) {
  const absolutePath = resolve(root, ...packagePath.split('/'))
  const normalizedPath = assertInsideRoot(root, absolutePath)

  if (normalizedPath !== packagePath) {
    fail('workspace package path is not canonical')
  }

  let packageStat
  try {
    packageStat = lstatSync(absolutePath)
  } catch {
    fail('workspace package directory is missing')
  }

  if (!packageStat.isDirectory() || packageStat.isSymbolicLink()) {
    fail('symlinked workspace packages are not supported')
  }

  let resolvedPath
  try {
    resolvedPath = realpathSync(absolutePath)
  } catch {
    fail('workspace package directory could not be resolved')
  }
  if (resolvedPath !== absolutePath) {
    fail('symlinked workspace packages are not supported')
  }

  const packageJsonPath = join(absolutePath, 'package.json')
  let packageJsonStat
  try {
    packageJsonStat = lstatSync(packageJsonPath)
  } catch {
    fail('workspace package package.json is missing')
  }
  if (!packageJsonStat.isFile() || packageJsonStat.isSymbolicLink()) {
    fail('workspace package package.json is not a regular file')
  }

  return packagePath
}

/**
 * Validate relative package paths against a checkout and return them sorted.
 * This is also used after discovery so injected or future discovery paths stay
 * subject to the same fail-closed checks.
 */
export function validateWorkspacePackagePaths(root, packagePaths) {
  const checkoutRoot = canonicalRoot(root)
  if (!Array.isArray(packagePaths)) {
    fail('workspace package discovery did not return an array')
  }

  const seen = new Set()
  const validated = []
  for (const packagePath of packagePaths) {
    assertSafeRelativePath(packagePath)
    if (seen.has(packagePath)) {
      fail('workspace package paths contain duplicates')
    }
    seen.add(packagePath)
    validated.push(assertPackageDirectory(checkoutRoot, packagePath))
  }

  return validated.sort()
}

function relativeDiscoveryPath(root, entryPath) {
  if (typeof entryPath !== 'string' || !isAbsolute(entryPath)) {
    fail('pnpm returned a non-absolute workspace package path')
  }

  const absolutePath = resolve(entryPath)
  if (entryPath !== absolutePath) {
    fail('pnpm returned a non-canonical workspace package path')
  }
  const relativePath = relative(root, absolutePath)
  if (relativePath === '') return ''

  const normalizedPath = assertInsideRoot(root, absolutePath)
  assertSafeRelativePath(normalizedPath)

  let resolvedPath
  try {
    resolvedPath = realpathSync(absolutePath)
  } catch {
    fail('pnpm returned a workspace package path that does not exist')
  }
  if (resolvedPath !== absolutePath) {
    fail('symlinked workspace packages are not supported')
  }

  return normalizedPath
}

function validateRootPackage(root) {
  const packageJsonPath = join(root, 'package.json')
  try {
    const stat = lstatSync(packageJsonPath)
    if (!stat.isFile() || stat.isSymbolicLink()) {
      fail('checkout package.json is not a regular file')
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'checkout package.json is not a regular file'
    ) {
      throw error
    }
    fail('checkout package.json is missing')
  }
}

/**
 * Run pnpm's workspace-aware discovery using literal argv and no package
 * imports. The caller is expected to invoke this script with the repository's
 * pinned host Node and pnpm toolchain available on PATH.
 */
export function discoverWorkspacePackages(
  root = SCRIPT_ROOT,
  { spawn = spawnSync } = {}
) {
  const checkoutRoot = canonicalRoot(root)
  const result = spawn(
    'pnpm',
    ['list', '--recursive', '--depth', '-1', '--json'],
    {
      cwd: checkoutRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        [PNPM_VERIFY_DEPS_ENV]: 'error',
        VOLTA_FEATURE_PNPM: '1',
      },
      maxBuffer: 4 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: PNPM_LIST_TIMEOUT_MS,
    }
  )

  if (result.error || result.status !== 0) {
    fail('pnpm workspace discovery failed')
  }

  let entries
  try {
    entries = JSON.parse(result.stdout)
  } catch {
    fail('pnpm workspace discovery returned invalid JSON')
  }
  if (!Array.isArray(entries)) {
    fail('pnpm workspace discovery returned an invalid result')
  }

  let sawRoot = false
  const packagePaths = []
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      fail('pnpm workspace discovery returned an invalid package entry')
    }
    const packagePath = relativeDiscoveryPath(checkoutRoot, entry.path)
    if (packagePath === '') {
      if (sawRoot)
        fail('pnpm workspace discovery returned duplicate checkout root')
      sawRoot = true
      validateRootPackage(checkoutRoot)
      continue
    }
    packagePaths.push(packagePath)
  }

  if (!sawRoot) {
    fail('pnpm workspace discovery did not return the checkout root')
  }

  return validateWorkspacePackagePaths(checkoutRoot, packagePaths)
}

function volumeNameForPackage(packagePath) {
  return (
    STABLE_VOLUME_NAMES.get(packagePath) ??
    `node_modules_${packagePath.replaceAll('/', '_')}`
  )
}

/**
 * Build the JSON-compatible Compose overlay. JSON is valid YAML and keeps the
 * generated artifact deterministic without adding a YAML dependency.
 */
export function createDependencyCompose(packagePaths) {
  if (!Array.isArray(packagePaths)) {
    fail('workspace package paths must be an array')
  }

  const normalizedPaths = [...packagePaths].sort()
  const seenPaths = new Set()
  for (const packagePath of normalizedPaths) {
    assertSafeRelativePath(packagePath)
    if (seenPaths.has(packagePath)) {
      fail('workspace package paths contain duplicates')
    }
    seenPaths.add(packagePath)
  }

  const mounts = [
    { packagePath: '', volume: 'node_modules_root' },
    ...normalizedPaths.map((packagePath) => ({
      packagePath,
      volume: volumeNameForPackage(packagePath),
    })),
  ]

  const volumesByName = new Map()
  for (const mount of mounts) {
    if (volumesByName.has(mount.volume)) {
      fail('workspace package paths produce colliding dependency volumes')
    }
    volumesByName.set(mount.volume, mount.packagePath)
  }

  const appVolumes = mounts.map(({ packagePath, volume }) => {
    const target = packagePath
      ? `${COMPOSE_WORKSPACE_ROOT}/${packagePath}/node_modules`
      : `${COMPOSE_WORKSPACE_ROOT}/node_modules`
    return `${volume}:${target}`
  })

  const declaredVolumes = Object.fromEntries(
    [...volumesByName.keys()].map((volume) => [volume, {}])
  )

  return {
    services: {
      app: {
        volumes: appVolumes,
      },
    },
    volumes: declaredVolumes,
  }
}

export function serializeDependencyCompose(compose) {
  return `${JSON.stringify(compose, null, 2)}\n`
}

function writeAtomicIfChanged(outputPath, contents) {
  const bytes = Buffer.from(contents)
  const outputDirectory = dirname(outputPath)

  let directoryStat
  try {
    directoryStat = lstatSync(outputDirectory)
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      fail('dependency overlay directory could not be inspected')
    }
    try {
      mkdirSync(outputDirectory, { recursive: true })
      directoryStat = lstatSync(outputDirectory)
    } catch {
      fail('dependency overlay directory could not be created')
    }
  }
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
    fail('dependency overlay directory is not a real directory')
  }
  try {
    if (realpathSync(outputDirectory) !== outputDirectory) {
      fail('dependency overlay directory is not canonical')
    }
  } catch {
    fail('dependency overlay directory could not be resolved')
  }

  try {
    const outputStat = lstatSync(outputPath)
    if (outputStat.isSymbolicLink() || !outputStat.isFile()) {
      fail('existing dependency overlay is not a regular file')
    }
    if (readFileSync(outputPath).equals(bytes)) return false
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'existing dependency overlay is not a regular file'
    ) {
      throw error
    }
    if (error?.code !== 'ENOENT')
      fail('existing dependency overlay could not be read')
  }

  let temporaryPath
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = join(
      outputDirectory,
      `.${basename(outputPath)}.${process.pid}.${attempt}.tmp`
    )
    try {
      writeFileSync(candidate, bytes, { flag: 'wx', mode: 0o644 })
      temporaryPath = candidate
      break
    } catch (error) {
      if (error?.code !== 'EEXIST')
        fail('dependency overlay could not be staged')
    }
  }

  if (!temporaryPath) fail('dependency overlay could not be staged')
  try {
    renameSync(temporaryPath, outputPath)
  } catch {
    fail('dependency overlay could not be replaced')
  } finally {
    try {
      unlinkSync(temporaryPath)
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        // The rename already completed or the next invocation can safely
        // overwrite the sibling temporary file.
      }
    }
  }

  return true
}

export function generateDependencyMounts(
  root = SCRIPT_ROOT,
  { discover = discoverWorkspacePackages } = {}
) {
  const checkoutRoot = canonicalRoot(root)
  const packagePaths = validateWorkspacePackagePaths(
    checkoutRoot,
    discover(checkoutRoot)
  )
  const compose = createDependencyCompose(packagePaths)
  const outputPath = join(
    checkoutRoot,
    '.devcontainer',
    'docker-compose.dependencies.yml'
  )
  const changed = writeAtomicIfChanged(
    outputPath,
    serializeDependencyCompose(compose)
  )

  return { changed, compose, outputPath, packagePaths }
}

function isDirectInvocation() {
  return (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  )
}

if (isDirectInvocation()) {
  const [checkoutArg, ...unexpectedArgs] = process.argv.slice(2)
  if (unexpectedArgs.length > 0) {
    console.error(
      'generate-dependency-mounts failed: expected at most one checkout path'
    )
    process.exitCode = 1
  } else {
    try {
      const result = generateDependencyMounts(checkoutArg ?? SCRIPT_ROOT)
      console.log(
        result.changed
          ? 'Dependency mount overlay generated.'
          : 'Dependency mount overlay is unchanged.'
      )
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message.replace(/[\r\n\t]+/g, ' ').slice(0, 240)
          : 'unknown generator failure'
      console.error(`generate-dependency-mounts failed: ${message}`)
      process.exitCode = 1
    }
  }
}
