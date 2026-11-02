#!/usr/bin/env node
// Verify that dropping overrides did not let a below-fix version survive.
//
//   node verify-dropped.mjs --root . --before <pnpm-workspace.yaml at HEAD>
//     [--modules <installed checkout>]
//
// The script diffs the override sets, then checks the current pnpm-lock.yaml
// for any version that the dropped selector would have rewritten. A version
// landing back inside a dropped selector means the entry was still doing work
// and belongs in the workspace file.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const flags = (name) =>
  args.flatMap((arg, index) => (arg === name ? [args[index + 1]] : []))
const root = path.resolve(flags('--root')[0] ?? '.')
const beforePath = flags('--before')[0]
if (!beforePath)
  throw new Error('--before <pnpm-workspace.yaml at HEAD> is required')

// The audited checkout is often a fresh worktree without node_modules; the
// extra roots let the caller borrow an installed checkout's yaml and semver.
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
const semver = (
  await import(pathToFileURL(resolveModule('semver', 'index.js')).href)
).default

const read = (file) =>
  yaml.parseDocument(fs.readFileSync(file, 'utf8')).toJSON().overrides ?? {}
const before = read(beforePath)
const after = read(path.join(root, 'pnpm-workspace.yaml'))
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

const lockedVersions = new Map()
for (const section of ['packages', 'snapshots']) {
  for (const raw of Object.keys(lock[section] ?? {})) {
    const clean = raw.split('(')[0]
    const at = clean.lastIndexOf('@')
    if (at <= 0) continue
    const name = clean.slice(0, at)
    if (!lockedVersions.has(name)) lockedVersions.set(name, new Set())
    lockedVersions.get(name).add(clean.slice(at + 1))
  }
}

const removed = Object.keys(before).filter((key) => !(key in after))
const added = Object.keys(after).filter((key) => !(key in before))
let problems = 0
for (const key of removed) {
  const at = key.lastIndexOf('@')
  const name = at > 0 ? key.slice(0, at) : key
  const selector = at > 0 ? key.slice(at + 1) : '*'
  const target = String(before[key])
  const versions = [...(lockedVersions.get(name) ?? [])]
  const inside =
    selector === '*'
      ? versions
      : versions.filter((version) =>
          semver.satisfies(version, selector, { includePrerelease: true })
        )
  const below = inside.filter((version) => semver.lt(version, target))
  if (below.length) problems += 1
  console.log(
    (below.length ? 'PROBLEM' : 'clean').padEnd(8) +
      key.padEnd(44) +
      ' locked=[' +
      versions.join(' ') +
      ']' +
      ' insideSelector=[' +
      (inside.join(' ') || '-') +
      ']' +
      ' belowTarget=[' +
      (below.join(' ') || '-') +
      ']'
  )
}
console.log('')
console.log(
  'removed=' +
    removed.length +
    ' added=' +
    added.length +
    ' problems=' +
    problems +
    '; lockfile records ' +
    (lock.overrides ? Object.keys(lock.overrides).length : 0) +
    ' overrides'
)
process.exitCode = problems === 0 ? 0 : 1
