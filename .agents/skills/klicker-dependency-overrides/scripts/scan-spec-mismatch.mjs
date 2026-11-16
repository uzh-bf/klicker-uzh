#!/usr/bin/env node
// Compare every workspace manifest's dependency specifiers with the matching
// pnpm-lock.yaml importer specifiers, the way pnpm's verifyDepsBeforeRun deep
// check does. An overridden dependency is written into the lockfile as the
// override target, so a manifest carrying a range for that package drifts.
//
//   node scan-spec-mismatch.mjs [--root .] [--modules <installed checkout>]
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const flags = (name) =>
  args.flatMap((arg, index) => (arg === name ? [args[index + 1]] : []))
const root = path.resolve(flags('--root')[0] ?? '.')

// The audited checkout is often a fresh worktree without node_modules; the
// extra roots let the caller borrow an installed checkout's yaml.
const moduleRoots = [flags('--modules')[0], root, process.cwd()]
  .filter(Boolean)
  .map((dir) => path.resolve(dir))
function resolveModule(name, entry) {
  for (const base of moduleRoots) {
    const direct = path.join(base, 'node_modules', name, entry)
    if (fs.existsSync(direct)) return direct
  }
  for (const base of moduleRoots) {
    const store = path.join(base, 'node_modules/.pnpm')
    if (!fs.existsSync(store)) continue
    const candidates = fs
      .readdirSync(store)
      .filter((dir) => dir.startsWith(name + '@') && dir.indexOf('_') === -1)
      .sort()
    for (const dir of candidates.reverse()) {
      const candidate = path.join(store, dir, 'node_modules', name, entry)
      if (fs.existsSync(candidate)) return candidate
    }
  }
  throw new Error(
    'cannot find ' +
      name +
      ' in ' +
      moduleRoots.join(', ') +
      '; run this in an installed checkout'
  )
}
const yaml = await import(
  pathToFileURL(resolveModule('yaml', 'dist/index.js')).href
)

const workspace = yaml.parse(
  fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')
)
const dirs = []
for (const entry of workspace.packages ?? []) {
  if (entry.startsWith('!')) continue
  if (entry.endsWith('/*')) {
    const base = entry.slice(0, -2)
    for (const dirent of fs.readdirSync(path.join(root, base), {
      withFileTypes: true,
    })) {
      if (
        dirent.isDirectory() &&
        fs.existsSync(path.join(root, base, dirent.name, 'package.json'))
      ) {
        dirs.push(base + '/' + dirent.name)
      }
    }
  } else {
    dirs.push(entry)
  }
}

// pnpm 12 may prepend the package-manager/config-dependency environment.
// The project graph is always last; reject missing or ambiguous graphs instead
// of accidentally reporting a clean audit of pnpm's own dependencies.
// https://github.com/pnpm/pnpm/blob/main/pnpm/docs/lockfile.md
const lockDocuments = yaml
  .parseAllDocuments(fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8'))
  .map((document) => {
    if (document.errors.length) throw document.errors[0]
    return document.toJSON()
  })
const isMap = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const isLockfile = (document) =>
  isMap(document) &&
  document.lockfileVersion !== undefined &&
  isMap(document.importers) &&
  Object.keys(document.importers).length > 0 &&
  Object.values(document.importers).every(isMap)
const isEnvironment = (document) =>
  Object.values(document.importers).some(
    (importer) =>
      'configDependencies' in importer ||
      'packageManagerDependencies' in importer
  )
const hasProjectDependencies = (document) =>
  Object.values(document.importers).some((importer) =>
    ['dependencies', 'devDependencies', 'optionalDependencies'].some(
      (field) => field in importer
    )
  )
if (
  lockDocuments.length < 1 ||
  lockDocuments.length > 2 ||
  !lockDocuments.every(isLockfile) ||
  isEnvironment(lockDocuments.at(-1)) ||
  (lockDocuments.length === 2 &&
    (!isEnvironment(lockDocuments[0]) ||
      hasProjectDependencies(lockDocuments[0])))
) {
  throw new Error(
    'pnpm-lock.yaml must contain one project dependency graph, optionally ' +
      'preceded by one package-manager/config-dependency environment document'
  )
}
const lock = lockDocuments.at(-1)
let mismatches = 0
let compared = 0

for (const dir of ['.', ...dirs]) {
  const importer = lock.importers?.[dir]
  const manifestPath = path.join(root, dir, 'package.json')
  if (!importer || !fs.existsSync(manifestPath)) continue
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  // Mirror pnpm's satisfiesPackageManifest(): dev < deps < optional win, and
  // peers only contribute a specifier when the name is not declared already
  // (autoInstallPeers is on in this workspace).
  const declared = {
    ...manifest.devDependencies,
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
  }
  for (const [dep, spec] of Object.entries(manifest.peerDependencies ?? {})) {
    if (declared[dep] === undefined) declared[dep] = spec
  }
  const lockSpecifiers = {}
  for (const section of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
  ]) {
    for (const [dep, entry] of Object.entries(importer[section] ?? {})) {
      if (
        entry &&
        typeof entry === 'object' &&
        typeof entry.specifier === 'string'
      ) {
        lockSpecifiers[dep] = entry.specifier
      }
    }
  }
  for (const [dep, specifier] of Object.entries(lockSpecifiers)) {
    compared += 1
    if (declared[dep] !== undefined && declared[dep] !== specifier) {
      console.log(
        'MISMATCH ' +
          dir +
          ' ' +
          dep +
          ': lockfile=' +
          specifier +
          ' manifest=' +
          declared[dep]
      )
      mismatches += 1
    }
  }
}

console.log(
  'compared ' +
    compared +
    ' specifiers across ' +
    (dirs.length + 1) +
    ' projects; mismatches=' +
    mismatches
)
process.exitCode = mismatches === 0 ? 0 : 1
