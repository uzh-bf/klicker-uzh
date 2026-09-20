#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
// Audit every pnpm override against the locked dependency graph.
//
//   node audit-overrides.mjs --root . [--manifests <checkout>]...
//     [--modules <checkout>] [--json <file>]
//
// For each entry in pnpm-workspace.yaml overrides the script reconstructs what
// pnpm would resolve today for every locked edge to that package, honoring the
// workspace's minimumReleaseAge policy, and reports whether the entry changes
// that outcome:
//
//   load-bearing  an edge resolves below the target, so the override is what
//                 keeps the patch; dropping it reintroduces the old version
//   line-pin      the target sits inside its own selector: the entry pins a
//                 line for lockstep or consolidation reasons
//   exact-pin     no version selector at all (a by-name lockstep pin)
//   downgrade     an edge resolves above the target: the entry pins below the
//                 newest release and deserves a second look
//   no-op         no edge lands inside the selector: the entry changes nothing
//   absent        the package is not in the locked graph at all
//   unknown       declared ranges could not be read (no installed tree)
//
// --manifests points at a checkout whose node_modules/.pnpm holds the
// manifests that carry the declared ranges; the root itself is always used.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const flags = (name) =>
  args.flatMap((arg, index) => (arg === name ? [args[index + 1]] : []))
const root = path.resolve(flags('--root')[0] ?? '.')
const manifestTrees = [
  root,
  ...flags('--manifests').map((dir) => path.resolve(dir)),
]

// ---------- resolve the workspace's own yaml/semver copies ----------
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

const lock = yaml.parse(
  fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8')
)
const workspace = yaml
  .parseDocument(
    fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')
  )
  .toJSON()
const overrides = workspace.overrides ?? {}
const cutoffMs = Date.now() - Number(workspace.minimumReleaseAge ?? 0) * 60_000
const ageExclude = new Set(workspace.minimumReleaseAgeExclude ?? [])

// ---------- locked versions per package ----------
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

// ---------- declared ranges from installed manifests ----------
const manifests = new Map()
function walk(dir, depth) {
  if (depth > 5) return
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, depth + 1)
      continue
    }
    if (entry.name !== 'package.json') continue
    let manifest
    try {
      manifest = JSON.parse(fs.readFileSync(full, 'utf8'))
    } catch {
      continue
    }
    const key = manifest.name + '@' + manifest.version
    if (manifest.name && manifest.version && !manifests.has(key))
      manifests.set(key, manifest)
  }
}
for (const tree of manifestTrees) walk(path.join(tree, 'node_modules/.pnpm'), 0)

// ---------- registry metadata, cached next to the caller's temp dir --------
const metaDir =
  flags('--meta')[0] ?? path.join(os.tmpdir(), 'klicker-override-audit')
fs.mkdirSync(metaDir, { recursive: true })
const packuments = new Map()
function packument(name) {
  if (packuments.has(name)) return packuments.get(name)
  const file = path.join(metaDir, name.replace(/\//g, '+') + '.json')
  if (!fs.existsSync(file) || fs.statSync(file).size < 100) {
    const url = 'https://registry.npmjs.org/' + name.replace(/\//g, '%2F')
    fs.writeFileSync(
      file,
      execFileSync('curl', ['-sS', '--retry', '4', '--retry-all-errors', url], {
        maxBuffer: 512 * 1024 * 1024,
      })
    )
  }
  let doc
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    doc = { versions: {}, time: {} }
  }
  packuments.set(name, doc)
  return doc
}
function allowedVersions(name) {
  const doc = packument(name)
  return Object.keys(doc.versions ?? {}).filter((version) => {
    if (ageExclude.has(name + '@' + version)) return true
    const published = doc.time?.[version] ? Date.parse(doc.time[version]) : null
    return published !== null && published <= cutoffMs
  })
}

// ---------- edges of the locked graph ----------
const edges = new Map()
const upgradable = new Set()
for (const [raw, snapshot] of Object.entries(lock.snapshots ?? {})) {
  const owner = raw.split('(')[0]
  for (const field of ['dependencies', 'optionalDependencies']) {
    for (const dep of Object.keys(snapshot[field] ?? {})) {
      const manifest = manifests.get(owner)
      if (!manifest) upgradable.add(owner)
      const declared =
        manifest?.dependencies?.[dep] ??
        manifest?.optionalDependencies?.[dep] ??
        manifest?.peerDependencies?.[dep] ??
        null
      const kind = manifest?.dependencies?.[dep]
        ? 'dependencies'
        : manifest?.optionalDependencies?.[dep]
          ? 'optionalDependencies'
          : manifest?.peerDependencies?.[dep]
            ? 'peerDependencies'
            : 'unavailable'
      if (!edges.has(dep)) edges.set(dep, [])
      // A package installed only as an optional peer (declared through
      // peerDependenciesMeta) has no range to evaluate: the lockfile decides
      // its version, so it neither justifies nor refutes an entry.
      const optionalPeer =
        declared === null &&
        manifest?.peerDependenciesMeta?.[dep]?.optional === true
      edges.get(dep).push({ owner, range: declared, kind, optionalPeer })
    }
  }
}

// ---------- verdicts ----------
const rows = []
const evidence = []
for (const [key, rawTarget] of Object.entries(overrides)) {
  const target = String(rawTarget)
  const at = key.lastIndexOf('@')
  const name = at > 0 ? key.slice(0, at) : key
  const selector = at > 0 ? key.slice(at + 1) : '*'
  if (selector === '*') {
    rows.push({
      verdict: 'exact-pin',
      key,
      target,
      locked: (lockedVersions.get(name) ?? new Set()).size,
    })
    continue
  }
  const versions = [...(lockedVersions.get(name) ?? [])]
  const list = edges.get(name) ?? []
  const targetInSelector = semver.satisfies(target, selector, {
    includePrerelease: true,
  })
  if (!versions.length && !list.length) {
    rows.push({
      verdict: 'absent',
      key,
      target,
      locked: 0,
      inSelector: '-',
      lifted: 0,
      downgraded: 0,
      unavailable: 0,
    })
    continue
  }
  const allowed = allowedVersions(name)
  const lifted = []
  const downgraded = []
  const unavailableOwners = []
  const optionalPeers = []
  let evaluated = 0
  let unavailable = 0
  for (const edge of list) {
    if (!edge.range) {
      if (edge.optionalPeer) optionalPeers.push(edge.owner)
      else {
        unavailable += 1
        unavailableOwners.push(edge.owner)
      }
      continue
    }
    const natural = semver.maxSatisfying(allowed, edge.range, {
      includePrerelease: true,
    })
    if (!natural) continue
    evaluated += 1
    if (!semver.satisfies(natural, selector, { includePrerelease: true }))
      continue
    const comparison = semver.compare(natural, target)
    if (comparison < 0) lifted.push({ ...edge, natural })
    if (comparison > 0) downgraded.push({ ...edge, natural })
  }
  const inSelector = versions.filter((version) =>
    semver.satisfies(version, selector, { includePrerelease: true })
  )
  const verdict = lifted.length
    ? 'load-bearing'
    : downgraded.length
      ? 'downgrade'
      : evaluated === 0
        ? 'unknown'
        : targetInSelector
          ? 'line-pin'
          : 'no-op'
  rows.push({
    verdict,
    key,
    target,
    locked: versions.length,
    inSelector: inSelector.join(' ') || '-',
    lifted: lifted.length,
    downgraded: downgraded.length,
    unavailable,
    optionalPeer: optionalPeers.length,
  })
  if (verdict !== 'no-op' && verdict !== 'unknown') {
    evidence.push('')
    evidence.push('== ' + key + ' -> ' + target + '  [' + verdict + ']')
    for (const row of [...lifted, ...downgraded].slice(0, 8)) {
      evidence.push(
        '   ' +
          (semver.lt(row.natural, target) ? 'LIFT ' : 'DOWN ') +
          row.owner.padEnd(48) +
          row.kind.padEnd(21) +
          'range=' +
          row.range.padEnd(14) +
          'resolves=' +
          row.natural
      )
    }
    if (unavailableOwners.length) {
      evidence.push(
        '   RANGES UNAVAILABLE for ' +
          unavailableOwners.slice(0, 5).join(', ') +
          (unavailableOwners.length > 5
            ? ' +' + (unavailableOwners.length - 5)
            : '') +
          ' (add --manifests for the checkout that installed them)'
      )
    }
    if (optionalPeers.length) {
      evidence.push(
        '   OPTIONAL PEER ' +
          [...new Set(optionalPeers)].slice(0, 5).join(', ') +
          ' installs with no declared range'
      )
    }
  }
}

const width = Math.max(...rows.map((row) => row.key.length))
for (const row of rows) {
  console.log(
    row.verdict.padEnd(12) +
      ' ' +
      row.key.padEnd(width) +
      ' -> ' +
      String(row.target).padEnd(10) +
      ' locked=' +
      String(row.locked).padEnd(3) +
      ' inSelector=' +
      String(row.inSelector ?? '-').padEnd(12) +
      (row.verdict === 'exact-pin' || row.verdict === 'absent'
        ? ''
        : ' lifted=' +
          row.lifted +
          ' downgraded=' +
          row.downgraded +
          (row.unavailable ? ' rangesUnavailable=' + row.unavailable : '') +
          (row.optionalPeer ? ' optionalPeer=' + row.optionalPeer : ''))
  )
}
const totals = new Map()
for (const row of rows)
  totals.set(row.verdict, (totals.get(row.verdict) ?? 0) + 1)
console.log('')
console.log(
  'totals: ' +
    [...totals].map(([verdict, count]) => verdict + '=' + count).join(' ') +
    ' of ' +
    rows.length
)
if (evidence.length) console.log(evidence.join('\n'))

const jsonPath = flags('--json')[0]
if (jsonPath) fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2) + '\n')
