#!/usr/bin/env node
// Regenerable-data cleanup for the current worktree or an explicit worktree.
//
// Modes:
//   clean-worktree.mjs cache            caches in THIS worktree (.turbo,
//                                       node_modules/.cache, .next/cache)
//   clean-worktree.mjs generated        build/test outputs in THIS worktree
//                                       (.next, dist, out, coverage, reports)
//   clean-worktree.mjs worktree <path>  full reset of a finished worktree:
//                                       cache + generated + node_modules +
//                                       .pnpm-store (refuses the main checkout)
//
// Flags: --dry-run (preview sizes, delete nothing), --force (override the
// running-dev-servers guard).
//
// Never touches tracked source, committed data, or the GraphQL generated
// client documents that dev servers need until the next codegen run.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')
const positional = args.filter((a) => !a.startsWith('--'))
const mode = positional[0]

function die(msg) {
  console.error(`error: ${msg}`)
  process.exit(1)
}

function duSize(target) {
  const res = spawnSync('du', ['-sk', target], { encoding: 'utf8' })
  if (res.status !== 0) return 0
  return Number.parseInt(res.stdout.split('\t')[0], 10) * 1024
}

function fmt(bytes) {
  if (bytes === 0) return '0'
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Expands repo-root-relative glob patterns such as `apps/*/.next` against the
// filesystem. Returns existing paths only.
function expand(pattern) {
  let current = [repoRoot]
  for (const segment of pattern.split('/')) {
    const next = []
    for (const dir of current) {
      if (segment.includes('*')) {
        const re = new RegExp(
          `^${escapeRegExp(segment).replace(/\\\*/g, '.*')}$`
        )
        let entries = []
        try {
          entries = fs.readdirSync(dir)
        } catch {
          // parent missing
        }
        for (const entry of entries) {
          if (re.test(entry)) next.push(path.join(dir, entry))
        }
      } else {
        const p = path.join(dir, segment)
        if (fs.existsSync(p)) next.push(p)
      }
    }
    current = next
  }
  return current.filter((p) => {
    try {
      return fs.statSync(p).isDirectory() || p.endsWith('.tsbuildinfo')
    } catch {
      return false
    }
  })
}

// Pure caches: safe to delete even while working in this worktree. `.turbo` in
// the MAIN checkout is the shared Turbo cache for all linked worktrees
// (Turbo >= 2.8), so wiping it there warms every worktree.
const cacheTargets = [
  '.turbo',
  'node_modules/.cache',
  '.rollup.cache',
  'apps/*/.next/cache',
]

// Disposable build/test output. Deliberately excludes node_modules,
// .pnpm-store, and the ignored GraphQL client documents (needed by dev
// servers until the next `pnpm generate`).
const generatedTargets = [
  'apps/*/.next',
  'apps/*/dist',
  'apps/*/build',
  'apps/*/out',
  'packages/*/dist',
  'packages/*/build',
  'packages/*/out',
  'coverage',
  'apps/*/coverage',
  'packages/*/coverage',
  'playwright/playwright-report',
  'playwright/test-results',
  'tsconfig.tsbuildinfo',
  'apps/*/tsconfig.tsbuildinfo',
  'packages/*/tsconfig.tsbuildinfo',
]

// Dev servers for this workspace are published on these ports (Repo Layout).
// Deleting .next under a serving dev server breaks the server.
const devServerPorts = [3000, 3001, 3002, 3003, 3004, 3010, 7078]

function devServerListening() {
  return Promise.all(
    devServerPorts.map(
      (port) =>
        new Promise((resolve) => {
          const socket = net.connect({ port, host: '127.0.0.1' })
          socket.setTimeout(250)
          socket.on('connect', () => {
            socket.destroy()
            resolve(port)
          })
          socket.on('timeout', () => {
            socket.destroy()
            resolve(null)
          })
          socket.on('error', () => resolve(null))
        })
    )
  ).then((results) => results.filter(Boolean))
}

function resolveTargets(list) {
  const out = []
  for (const pattern of list) out.push(...expand(pattern))
  return [...new Set(out)]
}

function deleteTargets(label, list) {
  const targets = resolveTargets(list)
  if (targets.length === 0) {
    console.log(`${label}: nothing to remove`)
    return 0
  }
  let total = 0
  for (const target of targets) {
    const size = duSize(target)
    const rel = path.relative(repoRoot, target) || target
    if (dryRun) {
      console.log(`${label}: would remove ${rel} (${fmt(size)})`)
    } else {
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 })
      console.log(`${label}: removed ${rel} (${fmt(size)})`)
    }
    total += size
  }
  return total
}

function isMainCheckout(worktreePath) {
  const run = (gitArgs) =>
    spawnSync('git', ['-C', worktreePath, ...gitArgs], { encoding: 'utf8' })
  const gitDir = run(['rev-parse', '--git-dir'])
  const commonDir = run(['rev-parse', '--git-common-dir'])
  if (gitDir.status !== 0 || commonDir.status !== 0) return null
  const a = fs.realpathSync(path.resolve(worktreePath, gitDir.stdout.trim()))
  const b = fs.realpathSync(path.resolve(worktreePath, commonDir.stdout.trim()))
  return a === b
}

async function main() {
  if (mode === 'cache') {
    const total = deleteTargets('cache', cacheTargets)
    console.log(`cache: ${dryRun ? 'would free' : 'freed'} ${fmt(total)}`)
    console.log(
      'note: run from the main checkout, .turbo is the shared Turbo cache for all linked worktrees (Turbo >= 2.8)'
    )
    return
  }

  if (mode === 'generated' || mode === 'worktree') {
    const listening = await devServerListening()
    if (listening.length > 0 && !force) {
      console.log(
        `dev servers appear to be listening on port(s) ${listening.join(', ')}; deleting .next under them breaks the servers`
      )
      die('stop the dev stack first (devrouter stop) or pass --force')
    }
  }

  if (mode === 'generated') {
    const total = deleteTargets('generated', generatedTargets)
    console.log(`generated: ${dryRun ? 'would free' : 'freed'} ${fmt(total)}`)
    return
  }

  if (mode === 'worktree') {
    const target = positional[1]
    if (!target) {
      die('worktree mode requires a path: pnpm clean:worktree -- <path>')
    }
    let worktreePath
    try {
      worktreePath = fs.realpathSync(path.resolve(target))
    } catch {
      die(`no such directory: ${target}`)
    }
    if (isMainCheckout(worktreePath)) {
      die(
        'refusing to clean the main checkout; use the cache/generated modes or pass an explicit linked-worktree path'
      )
    }
    const branch = spawnSync(
      'git',
      ['-C', worktreePath, 'branch', '--show-current'],
      { encoding: 'utf8' }
    )
    const branchName =
      branch.status === 0 && branch.stdout.trim()
        ? branch.stdout.trim()
        : '(detached)'
    console.log(`cleaning worktree: ${worktreePath} (${branchName})`)
    console.log(
      'confirm no agent or dev session is still using this worktree (devrouter stop <path>)'
    )
    const worktreeTargets = [
      ...generatedTargets,
      ...cacheTargets,
      'node_modules',
      'apps/*/node_modules',
      'packages/*/node_modules',
      '.pnpm-store',
    ]
    const total = deleteTargets('worktree', worktreeTargets)
    console.log(`worktree: ${dryRun ? 'would free' : 'freed'} ${fmt(total)}`)
    console.log(
      'the worktree source itself is untouched; remove it with git worktree remove when done'
    )
    return
  }

  die(
    `unknown mode: ${mode ?? '(none)'}; expected cache | generated | worktree <path>`
  )
}

main().catch((err) => die(err?.message ?? String(err)))
