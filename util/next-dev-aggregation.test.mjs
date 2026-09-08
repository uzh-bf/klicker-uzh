import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import vm from 'node:vm'
import ts from 'typescript'

const appRequire = createRequire(
  new URL('../apps/frontend-manage/package.json', import.meta.url)
)
const nextRoot =
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Standalone uncached test override for the unpatched negative control.
  process.env.NEXT_AGGREGATION_PACKAGE_DIR ||
  path.dirname(appRequire.resolve('next/package.json'))
const relativeFile = 'server/lib/router-utils/setup-dev-bundler.js'
const nextRequire = createRequire(path.join(nextRoot, 'dist', relativeFile))

function uniqueIndex(source, anchor) {
  const index = source.indexOf(anchor)
  assert.ok(index >= 0 && index === source.lastIndexOf(anchor), anchor)
  return index
}

// Execute the dependency's complete registration and handler. Only its external
// filesystem inventory and asynchronous server propagation are controlled here.
function watcher(distribution) {
  const source = readFileSync(
    path.join(nextRoot, distribution, relativeFile),
    'utf8'
  )
  const imports = source.slice(
    0,
    uniqueIndex(source, 'async function verifyTypeScript(')
  )
  const registration = source.slice(
    uniqueIndex(source, '        let initialWatchTime ='),
    uniqueIndex(source, '        wp.watch({')
  )
  const dir = '/synthetic-next'
  const pagesDir = `${dir}/pages`
  let listener
  let inventory = new Map()
  let reads = 0
  let propagate = async () => {}
  let sortError
  const warnings = []
  const rejected = []
  const nextConfig = {
    pageExtensions: ['js'],
    experimental: {},
    basePath: '',
  }
  const fsChecker = {
    appFiles: new Set(),
    pageFiles: new Set(),
    staticMetadataFiles: new Map(),
    nextDataRoutes: new Set(),
    rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
  }
  const context = vm.createContext({
    exports: {},
    module: { exports: {} },
    performance,
    process,
    require(specifier) {
      if (specifier === '../../../build/output/log') {
        return { warn: (...args) => warnings.push(args) }
      }
      const actual = nextRequire(specifier)
      if (specifier === '../../../shared/lib/router/utils') {
        return {
          ...actual,
          getSortedRoutes(...args) {
            if (sortError) throw sortError
            return actual.getSortedRoutes(...args)
          },
        }
      }
      return actual
    },
    wp: {
      on(event, callback) {
        assert.equal(event, 'aggregated')
        listener = callback
      },
      getTimeInfoEntries() {
        reads++
        return inventory
      },
    },
    dir,
    pagesDir,
    appDir: undefined,
    directories: [pagesDir],
    files: [],
    envFiles: [],
    tsconfigPaths: [],
    fileWatchTimes: new Map(),
    enabledTypeScript: false,
    previousConflictingPagePaths: new Set(),
    previousClientRouterFilters: undefined,
    nestedMiddleware: [],
    validFileMatcher: nextRequire('../find-page-file').createValidFileMatcher([
      'js',
    ]),
    useFileSystemPublicRoutes: true,
    nextConfig,
    opts: { dir, nextConfig, fsChecker, turbo: true },
    serverFields: {},
    hotReloader: {},
    prevSortedRoutes: [],
    resolved: false,
    resolve() {},
    reject(error) {
      rejected.push(error)
    },
    propagateServerField: (...args) => propagate(...args),
  })
  const code = `${imports}\n${registration}`
  vm.runInContext(
    distribution === 'dist'
      ? code
      : ts.transpileModule(code, {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ESNext,
            esModuleInterop: true,
          },
        }).outputText,
    context
  )
  return {
    context,
    warnings,
    rejected,
    get reads() {
      return reads
    },
    emit(routes) {
      inventory = new Map(
        routes.map((route) => [
          `${pagesDir}${route}.js`,
          { accuracy: 1, timestamp: 1 },
        ])
      )
      return listener()
    },
    setPropagation(callback) {
      propagate = callback
    },
    setSortError(error) {
      sortError = error
    },
    assertRoutes(routes) {
      assert.deepEqual([...fsChecker.pageFiles].sort(), [...routes].sort())
      assert.deepEqual(
        [...new Set(fsChecker.dynamicRoutes.map((item) => item.page))].sort(),
        [...routes].sort()
      )
      assert.deepEqual(Array.from(context.prevSortedRoutes), [...routes].sort())
    },
  }
}

for (const distribution of ['dist', 'dist/esm']) {
  test(`${distribution}: overlapping scans retain the latest route inventory`, {
    timeout: 5000,
  }, async () => {
    const subject = watcher(distribution)
    const barrier = Promise.withResolvers()
    const entered = Promise.withResolvers()
    let first = true
    subject.setPropagation(async (_opts, field) => {
      if (field === 'appPathRoutes' && first) {
        first = false
        entered.resolve()
        await barrier.promise
      }
    })
    const older = subject.emit(['/old'])
    await entered.promise
    const newer = subject.emit(['/quizzes/[id]/cockpit'])
    await setImmediate()
    const overlappingReads = subject.reads
    barrier.resolve()
    await Promise.all([older, newer])
    assert.equal(
      overlappingReads,
      1,
      'newer scan must wait for older publication'
    )
    subject.assertRoutes(['/quizzes/[id]/cockpit'])
    assert.equal(subject.reads, 2)
    assert.deepEqual(subject.rejected, [])
    assert.deepEqual(subject.warnings, [])
  })

  for (const phase of ['startup', 'reload']) {
    for (const failureSite of ['propagation', 'sorting']) {
      test(`${distribution}: ${phase} ${failureSite} failure does not poison later scans`, {
        timeout: 5000,
      }, async () => {
        const subject = watcher(distribution)
        if (phase === 'reload') await subject.emit(['/initial'])
        const error = new Error('synthetic scan failure')
        if (failureSite === 'propagation')
          subject.setPropagation(async () => {
            throw error
          })
        else subject.setSortError(error)
        await subject.emit(['/failed'])
        assert.equal(subject.context.resolved, true)
        assert.deepEqual(subject.rejected, phase === 'startup' ? [error] : [])
        assert.equal(subject.warnings.length, phase === 'reload' ? 1 : 0)
        subject.setPropagation(async () => {})
        subject.setSortError(undefined)
        await subject.emit(['/recovered/[id]'])
        subject.assertRoutes(['/recovered/[id]'])
      })
    }
  }
}
