#!/usr/bin/env node
// Read-only discovery, not test discovery by a runner or a quality gate.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const indicators = {
  fixedWait: /\bwaitForTimeout\s*\(/g,
  networkIdle: /\bnetworkidle\b/g,
  forcedAction: /\bforce\s*:\s*true\b/g,
  positionalLocator: /\.(?:nth|first|last)\s*\(/g,
  styleAssertion: /\.toHave(?:Class|CSS)\s*\(/g,
  disabledOrConditional:
    /\b(?:test|it|describe)\.(?:skip|fixme|todo)(?:\b|\()/g,
  serialGroup: /\.serial\s*\(|\bmode\s*:\s*['"]serial['"]/g,
  typecheckDisabled: /@ts-nocheck\b/g,
  sourceOrFixtureRead: /\b(?:readFileSync|readFile)\s*\(/g,
  staticRenderer: /\b(?:renderToStaticMarkup|renderToString)\b/g,
}

export function classifyTestFile(file) {
  if (/^playwright\/tests\/.*\.spec\.ts$/.test(file)) return 'playwright-active'
  if (/^playwright\/(?:retained|example)\/.*\.spec\.ts$/.test(file)) {
    return 'playwright-reference'
  }
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file))
    return 'javascript-typescript'
  if (/(?:^|\/)(?:test_[^/]+|[^/]+_test)\.py$/.test(file)) return 'python'
  if (/(?:^|\/)test[-_][^/]+\.sh$/.test(file)) return 'shell'
  return null
}

export function inspectTestFile(file, source) {
  const category = classifyTestFile(file)
  if (!category) return null
  const signals = {}
  for (const [name, expression] of Object.entries(indicators)) {
    const hits = Array.from(source.matchAll(expression))
    if (hits.length) {
      signals[name] = {
        count: hits.length,
        lines: [
          ...new Set(
            hits.map((hit) => source.slice(0, hit.index).split('\n').length)
          ),
        ],
      }
    }
  }
  return { path: file, category, signals }
}

export function summarize(files) {
  const categories = {}
  const signals = {}
  for (const file of files) {
    categories[file.category] = (categories[file.category] ?? 0) + 1
    for (const [name, value] of Object.entries(file.signals)) {
      signals[name] ??= { occurrences: 0, files: 0 }
      const entry = signals[name]
      entry.occurrences += value.count
      entry.files += 1
    }
  }
  return { files: files.length, categories, signals }
}

export function readFailureReason(error) {
  // Allow only known filesystem classes, never arbitrary messages or codes.
  const allowed = new Set([
    'ENOENT',
    'EACCES',
    'EPERM',
    'ELOOP',
    'EIO',
    'ENAMETOOLONG',
    'ENOTDIR',
  ])
  return allowed.has(error?.code) ? error.code : 'READ_ERROR'
}

export function inventory(root) {
  const canonicalRoot = realpathSync(root)
  const git = (...args) =>
    execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], {
      cwd: canonicalRoot,
      encoding: 'utf8',
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
        ),
        GIT_OPTIONAL_LOCKS: '0',
      },
      maxBuffer: 16 * 1024 * 1024,
    })
  const top = realpathSync(git('rev-parse', '--show-toplevel').trim())
  if (top !== canonicalRoot)
    throw new Error('--root must be the repository root')
  const paths = [
    ...new Set(git('ls-files', '--cached', '-z').split('\0').filter(Boolean)),
  ].sort()
  const files = []
  const unreadable = []
  const contents = createHash('sha256')
  for (const file of paths) {
    if (!classifyTestFile(file)) continue
    let source
    try {
      const absolute = path.join(canonicalRoot, file)
      if (!lstatSync(absolute).isFile()) {
        unreadable.push({ path: file, reason: 'NOT_REGULAR_FILE' })
        continue
      }
      const relative = path.relative(canonicalRoot, realpathSync(absolute))
      if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        unreadable.push({ path: file, reason: 'OUTSIDE_REPOSITORY' })
        continue
      }
      source = readFileSync(absolute, 'utf8')
    } catch (error) {
      // Diagnose filesystem failures without exposing error messages or source.
      unreadable.push({ path: file, reason: readFailureReason(error) })
      continue
    }
    // Scanner/programming errors must surface, not masquerade as unreadable files.
    contents.update(JSON.stringify([file, source]))
    files.push(inspectTestFile(file, source))
  }
  return {
    schemaVersion: 1,
    head: git('rev-parse', 'HEAD').trim(),
    contentsSha256: contents.digest('hex'),
    scope:
      'Tracked paths, current working-tree contents; untracked files and ad-hoc test names excluded.',
    limitations:
      'Text matches include comments, strings and legitimate contracts. Not runner discovery, executed test counts, coverage, flake rates or automatic cleanup decisions.',
    summary: summarize(files),
    activePlaywright: summarize(
      files.filter((file) => file.category === 'playwright-active')
    ),
    unreadable,
    files,
  }
}

function main(args) {
  let root = fileURLToPath(new URL('..', import.meta.url))
  let json = false
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--json') json = true
    else if (args[i] === '--root' && args[i + 1]) root = path.resolve(args[++i])
    else
      throw new Error(
        'Usage: node util/test-hygiene-inventory.mjs [--root <repo>] [--json]'
      )
  }
  const result = inventory(root)
  if (json) console.log(JSON.stringify(result, null, 2))
  else {
    console.log(
      `Test-file inventory of working-tree contents; HEAD ${result.head}`
    )
    console.log(`Scanned contents SHA-256: ${result.contentsSha256}`)
    console.log(result.scope)
    console.log(result.limitations)
    console.log(
      JSON.stringify(
        {
          summary: result.summary,
          activePlaywright: result.activePlaywright,
          unreadable: result.unreadable,
        },
        null,
        2
      )
    )
    console.log(
      'Use --json for per-file indicator locations; review before acting.'
    )
  }
  if (result.unreadable.length) process.exitCode = 1
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
