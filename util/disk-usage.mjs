#!/usr/bin/env node
// Reports where disk goes in this checkout: primary generated data, pnpm
// stores, and per-worktree generated data across all linked Git worktrees.
//
// Intended for the "why is my disk full?" moment in a repo where coding
// agents create many worktrees. Run `pnpm disk:usage`. The worktree scan runs
// `du` over generated directories only and can take a few minutes.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const dayMs = 24 * 60 * 60 * 1000

function die(msg) {
  console.error(`error: ${msg}`)
  process.exit(1)
}

function fmt(bytes) {
  if (bytes === 0) return '0'
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

function duAll(targets) {
  const existing = targets.filter((t) => fs.existsSync(t))
  if (existing.length === 0) return new Map()
  const res = spawnSync('du', ['-sk', ...existing], { encoding: 'utf8' })
  const sizes = new Map()
  if (res.stdout) {
    for (const line of res.stdout.split('\n')) {
      const [kb, ...rest] = line.split('\t')
      if (kb && rest.length > 0) {
        sizes.set(rest.join('\t'), Number.parseInt(kb, 10) * 1024)
      }
    }
  }
  return sizes
}

function git(args_, opts = {}) {
  return spawnSync('git', ['-C', repoRoot, ...args_], {
    encoding: 'utf8',
    ...opts,
  })
}

function listWorktrees() {
  const res = git(['worktree', 'list', '--porcelain'])
  if (res.status !== 0) die('git worktree list failed')
  const out = []
  let current = null
  for (const line of res.stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      current = {
        path: line.slice('worktree '.length),
        head: null,
        branch: null,
      }
      out.push(current)
    } else if (line.startsWith('HEAD ') && current) {
      current.head = line.slice(5)
    } else if (line.startsWith('branch ') && current) {
      current.branch = line.slice('branch refs/heads/'.length)
    }
  }
  return out
}

function mtime(p) {
  try {
    return fs.statSync(p).mtimeMs
  } catch {
    return 0
  }
}

function lastActivity(worktreePath) {
  const sentinels = [
    path.join(worktreePath, '.git'),
    path.join(worktreePath, '.turbo'),
    path.join(worktreePath, '.pnpm-store'),
    path.join(worktreePath, 'node_modules'),
    path.join(worktreePath, 'apps'),
    path.join(worktreePath, 'packages'),
  ]
  return Math.max(...sentinels.map((p) => mtime(p)))
}

function main() {
  console.log(`KlickerUZH disk usage — ${repoRoot}`)
  console.log('')

  // --- primary checkout generated data -------------------------------------
  const primaryTargets = {
    node_modules: path.join(repoRoot, 'node_modules'),
    '.turbo (turbo cache)': path.join(repoRoot, '.turbo'),
    '.pnpm-store (fallback store)': path.join(repoRoot, '.pnpm-store'),
    '.git': path.join(repoRoot, '.git'),
  }
  const nextDirs = []
  const appsDir = path.join(repoRoot, 'apps')
  try {
    for (const app of fs.readdirSync(appsDir)) {
      const next = path.join(appsDir, app, '.next')
      if (fs.existsSync(next)) nextDirs.push(next)
    }
  } catch {
    // no apps dir
  }
  const primarySizes = duAll([...Object.values(primaryTargets), ...nextDirs])
  console.log('Primary checkout')
  let primaryTotal = 0
  for (const [label, target] of Object.entries(primaryTargets)) {
    const size = primarySizes.get(target) ?? 0
    if (size > 0) {
      console.log(`  ${label.padEnd(30)} ${fmt(size)}`)
      primaryTotal += size
    }
  }
  const nextTotal = nextDirs.reduce(
    (sum, d) => sum + (primarySizes.get(d) ?? 0),
    0
  )
  if (nextTotal > 0) {
    console.log(
      `  ${'.next build output (apps/*)'.padEnd(30)} ${fmt(nextTotal)}`
    )
    primaryTotal += nextTotal
  }
  console.log(`  ${'subtotal (regenerable)'.padEnd(30)} ${fmt(primaryTotal)}`)
  console.log('')

  // --- pnpm stores ----------------------------------------------------------
  console.log('pnpm stores')
  const home = os.homedir()
  const storeDirs = [
    ['active content store', path.join(home, 'Library/pnpm/store/v11')],
    ['older store (pnpm <= 10)', path.join(home, 'Library/pnpm/store/v10')],
    ['older store (pnpm <= 9)', path.join(home, 'Library/pnpm/store/v3')],
    ['workspace fallback store', path.join(repoRoot, '.pnpm-store')],
  ]
  const storeSizes = duAll(storeDirs.map(([, p]) => p))
  for (const [label, p] of storeDirs) {
    const size = storeSizes.get(p) ?? 0
    if (size > 0) {
      console.log(`  ${label.padEnd(30)} ${fmt(size)}  ${p}`)
    }
  }
  console.log('')

  // --- per-worktree generated data ------------------------------------------
  const worktrees = listWorktrees()
  console.log(
    `Scanning ${worktrees.length} git worktrees for generated data...`
  )
  const generatedNames = [
    'node_modules',
    '.turbo',
    '.pnpm-store',
    'apps/frontend-manage/.next',
    'apps/frontend-pwa/.next',
    'apps/chat/.next',
    'apps/frontend-control/.next',
    'apps/auth/.next',
  ]
  const allTargets = []
  const perWorktree = worktrees.map((wt) => {
    const targets = generatedNames
      .map((name) => path.join(wt.path, name))
      .filter((p) => fs.existsSync(p))
    allTargets.push(...targets)
    return { ...wt, targets, generated: 0 }
  })
  const wtSizes = duAll(allTargets)
  for (const wt of perWorktree) {
    wt.generated = wt.targets.reduce((sum, t) => sum + (wtSizes.get(t) ?? 0), 0)
    const isMain = fs.existsSync(path.join(wt.path, '.git/HEAD'))
    wt.main = isMain
    if (!isMain) {
      const ancestor =
        wt.head &&
        git(['merge-base', '--is-ancestor', wt.head, 'v3']).status === 0
      wt.merged = Boolean(ancestor)
    }
    wt.inactiveDays = Math.max(
      0,
      Math.round((Date.now() - lastActivity(wt.path)) / dayMs)
    )
  }
  perWorktree.sort((a, b) => b.generated - a.generated)

  const name = (wt) => {
    const rel = path.relative(repoRoot, wt.path)
    return rel === '' ? '.' : rel
  }
  console.log('')
  console.log(
    'Generated data per worktree (node_modules + caches + .next), largest first:'
  )
  console.log(
    '       size   inactive  stale?  branch                          worktree'
  )
  let worktreeTotal = 0
  for (const wt of perWorktree) {
    worktreeTotal += wt.generated
    if (wt.generated === 0) continue
    const stale = wt.merged && wt.inactiveDays > 30
    const branch = wt.main ? '(main checkout)' : (wt.branch ?? '(detached)')
    console.log(
      `  ${fmt(wt.generated).padStart(9)}   ${String(wt.inactiveDays).padStart(5)} d  ${stale ? 'yes ' : 'no  '}  ${branch.padEnd(30)}  ${name(wt)}`
    )
  }
  console.log('')
  console.log(
    `Worktree generated total: ${fmt(worktreeTotal)} across ${perWorktree.filter((wt) => wt.generated > 0).length} worktrees`
  )
  const candidates = perWorktree.filter((wt) => {
    if (wt.main || !wt.merged || wt.inactiveDays <= 30) return false
    const status = git(['-C', wt.path, 'status', '--porcelain'])
    return status.status === 0 && status.stdout.trim() === ''
  })
  if (candidates.length > 0) {
    console.log('')
    console.log(
      `Stale candidates (fully merged into v3, inactive > 30 days): ${candidates.length}`
    )
    for (const wt of candidates) {
      console.log(`  ${name(wt)}  (${fmt(wt.generated)})`)
    }
    console.log(
      '  review each, then: devrouter stop <path> && git worktree remove <path>'
    )
  }
}

main()
