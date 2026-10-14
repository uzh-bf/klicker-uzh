import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { AnyMap, encodedMap } from '@jridgewell/trace-mapping'
import { parse } from 'acorn'
import { convert } from 'ast-v8-to-istanbul'
import coverage from 'istanbul-lib-coverage'

const INCLUDED = [
  'apps/auth/src/',
  'packages/shared-components/src/',
  'packages/i18n/src/',
  'packages/util/src/',
]
const sha256 = (source) => createHash('sha256').update(source).digest('hex')

export function sourcePath(source) {
  // Only the observed, documented Turbopack source namespace is admitted.
  // An unfamiliar compiler map must be reviewed, never guessed into a metric.
  const prefix = 'turbopack:///[project]/'
  if (!source.startsWith(prefix)) return null
  const relative = source.slice(prefix.length)
  if (
    relative.includes('..') ||
    relative.includes('\\') ||
    !/\.(?:ts|tsx|js|jsx)$/.test(relative) ||
    /(?:^|\/)(?:node_modules|dist|api|types)(?:\/|$)/.test(relative) ||
    /(?:\.d\.ts|\.(?:test|spec)\.[^.]+|\/_document\.tsx)$/.test(relative) ||
    !INCLUDED.some((prefix) => relative.startsWith(prefix))
  )
    return null
  return relative
}

export function chunkPath(url, origin, root) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.origin !== origin || parsed.search || parsed.hash) return null
  if (!/^\/_next\/static\/[a-zA-Z0-9_./-]+\.js$/.test(parsed.pathname))
    return null
  const relative = parsed.pathname.slice('/_next/'.length)
  const base = path.join(root, 'apps/auth/.next')
  const resolved = path.resolve(base, relative)
  assert(resolved.startsWith(`${base}${path.sep}`), 'Invalid chunk path')
  return resolved
}

export async function remapEntry(entry, map, root) {
  const flattened = encodedMap(AnyMap(map))
  const admitted = new Map()
  const sources = await Promise.all(
    flattened.sources.map(async (source, index) => {
      const relative = sourcePath(source)
      if (!relative) return `coverage-excluded/${index}.js`
      const file = path.join(root, relative)
      const content = await readFile(file, 'utf8')
      assert(
        flattened.sourcesContent?.[index] === content,
        `Source map mismatch: ${relative}`
      )
      admitted.set(file, { path: relative, sourceSha256: sha256(content) })
      return file
    })
  )
  if (!admitted.size)
    return { data: {}, files: [], excludedSources: sources.length }
  const data = await convert({
    code: entry.source,
    ast: parse(entry.source, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
    }),
    coverage: {
      url: pathToFileURL(path.join(root, 'coverage-input.js')).href,
      functions: entry.functions,
    },
    sourceMap: { ...flattened, sources, sourceRoot: '' },
    wrapperLength: 0,
  })
  return {
    data: Object.fromEntries(
      Object.entries(data).filter(([file]) => admitted.has(file))
    ),
    files: [...admitted.values()],
    excludedSources: sources.length - admitted.size,
  }
}

export async function collectCoverage({
  entries,
  root,
  origin,
  journey,
  browserVersion,
}) {
  const map = coverage.createCoverageMap({})
  const sourceHashes = new Map()
  const diagnostics = {
    entries: entries.length,
    localChunks: 0,
    excludedScripts: 0,
    missingMaps: 0,
    excludedSourceOccurrences: 0,
  }
  for (const entry of entries) {
    const chunk = chunkPath(entry.url, origin, root)
    if (!chunk) {
      diagnostics.excludedScripts++
      continue
    }
    diagnostics.localChunks++
    assert.equal(
      typeof entry.source,
      'string',
      'Local chunk is missing V8 source'
    )
    assert(
      (await readFile(chunk, 'utf8')) === entry.source,
      'Executed chunk does not match the build'
    )
    let sourceMap
    try {
      sourceMap = JSON.parse(await readFile(`${chunk}.map`, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      diagnostics.missingMaps++
      continue
    }
    const remapped = await remapEntry(entry, sourceMap, root)
    diagnostics.excludedSourceOccurrences += remapped.excludedSources
    for (const file of remapped.files)
      sourceHashes.set(file.path, file.sourceSha256)
    map.merge(remapped.data)
  }
  const files = map
    .files()
    .sort()
    .map((file) => {
      const relative = path.relative(root, file).split(path.sep).join('/')
      const data = map.fileCoverageFor(file)
      return {
        path: relative,
        sourceSha256: sourceHashes.get(relative),
        ...data.toSummary().toJSON(),
        uncoveredLines: data.getUncoveredLines(),
      }
    })
  assert(
    files.some((file) => file.path === 'apps/auth/src/pages/index.tsx'),
    'No mapped auth page: refuse an empty or vendor-only report'
  )
  assert(
    files.every((file) => file.sourceSha256),
    'Unverified source file'
  )
  return {
    schemaVersion: 1,
    commit: execFileSync(
      'git',
      ['-c', 'core.fsmonitor=false', 'rev-parse', 'HEAD'],
      { cwd: root, encoding: 'utf8' }
    ).trim(),
    buildId: (
      await readFile(path.join(root, 'apps/auth/.next/BUILD_ID'), 'utf8')
    ).trim(),
    journey,
    browserVersion,
    build:
      'Next.js production Turbopack, synthetic fixtures, browser source maps enabled',
    collector: 'Playwright 1.58.2 V8 -> ast-v8-to-istanbul 0.3.12',
    denominator:
      'Allowlisted first-party sources present in loaded Chromium chunks with verified source maps; NOT all auth source or the monorepo',
    excluded: [
      'unloaded chunks/modules',
      'server/SSR/API code',
      'other applications',
      'vendors/framework/runtime',
      'generated code without a first-party source mapping',
      'types/tests',
      'workers/service workers',
    ],
    total: map.getCoverageSummary().toJSON(),
    files,
    diagnostics,
  }
}
