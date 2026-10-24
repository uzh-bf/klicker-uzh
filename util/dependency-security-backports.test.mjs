import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, realpathSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

const CHILD_FLAG = '--parser-child'
const TEST_FILE = fileURLToPath(import.meta.url)
const PARSED_TEXT = 'synthetic dependency probe'
const majorOf = (version) => Number.parseInt(version, 10)

if (process.argv[2] === CHILD_FLAG) {
  await runParserChild(process.argv[3])
} else {
  test('installed body-parser majors handle decoder failures', () => {
    const roots = installedRoots('body-parser')
    for (const major of [1, 2]) {
      const installed = roots.filter((root) => majorOf(root.version) === major)
      assert.ok(
        installed.length,
        `missing installed body-parser major ${major}`
      )
      for (const { root, version } of installed) {
        const result = spawnSync(
          process.execPath,
          [TEST_FILE, CHILD_FLAG, root],
          {
            cwd: process.cwd(),
            encoding: 'utf8',
            env: { NODE_ENV: 'test' },
            killSignal: 'SIGKILL',
            timeout: 15_000,
          }
        )
        const reason = result.error?.message || result.stderr || result.stdout
        assert.equal(result.status, 0, `body-parser ${version}: ${reason}`)
      }
    }
  })

  test('installed Zod 4 entrypoints cap oversized containers', async () => {
    const roots = installedRoots('zod').filter(
      ({ version }) => majorOf(version) === 4
    )
    assert.ok(roots.length > 0, 'missing installed Zod major 4')
    for (const { root, version } of roots) {
      for (const entry of ['.', './v4']) {
        for (const condition of ['require', 'import']) {
          const zod = await loadZod(root, entry, condition)
          await assertZod4Behavior(zod, `${version} ${entry} ${condition}`)
        }
      }
    }
  })
}

function probeRoot() {
  const configured = process.env.KLICKER_DEPENDENCY_PROBE_ROOT?.trim()
  return path.resolve(process.cwd(), configured || 'node_modules/.pnpm')
}

function installedRoots(name) {
  const root = probeRoot()
  const prefix = `${name}@`
  const lockfile = readFileSync(path.join(root, 'lock.yaml'), 'utf8')
  const lockedVersions = new Set(
    [
      ...lockfile.matchAll(
        new RegExp(`^  ${name}@(\\d+\\.\\d+\\.\\d+):`, 'gm')
      ),
    ].map((match) => match[1])
  )
  const found = new Map()
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue
    const packageRoot = path.join(root, entry.name, 'node_modules', name)
    const manifest = JSON.parse(
      readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
    )
    if (manifest.name !== name) continue
    if (!lockedVersions.has(manifest.version)) continue
    const realRoot = realpathSync(packageRoot)
    found.set(realRoot, { root: realRoot, version: manifest.version })
  }
  return [...found.values()]
}

async function loadZod(root, entry, condition) {
  const manifest = JSON.parse(
    readFileSync(path.join(root, 'package.json'), 'utf8')
  )
  const target = manifest.exports?.[entry]?.[condition]
  assert.equal(typeof target, 'string', `missing Zod export ${condition}`)
  const modulePath = path.resolve(root, target)
  return condition === 'require'
    ? createRequire(path.join(root, 'package.json'))(modulePath)
    : import(pathToFileURL(modulePath).href)
}
async function assertZod4Behavior(zod, label) {
  const oversized = ['first', 'second', 'third', 'fourth']
  const cases = [
    ['array max', oversized, (element) => zod.array(element).max(2)],
    ['array exact', oversized, (element) => zod.array(element).length(2)],
    ['set max', new Set(oversized), (element) => zod.set(element).max(2)],
  ]
  cases.push([
    'map max',
    new Map(oversized.map((value, index) => [String(index), value])),
    (element) => zod.map(zod.string(), element).check(zod.maxSize(2)),
  ])
  for (const [name, input, build] of cases) {
    for (const asyncMode of [false, true]) {
      let elementRuns = 0
      const count = () => ++elementRuns > 0
      const refine = asyncMode ? async () => count() : count
      const element = zod.string().refine(refine)
      const result = asyncMode
        ? await build(element).safeParseAsync(input)
        : build(element).safeParse(input)
      assert.equal(result.success, false, `${label} ${name}`)
      assert.equal(elementRuns, 0, `${label} ${name} traversed elements`)
    }
  }
  const defaulted = 'synthetic-default'
  const caught = 'synthetic-caught'
  const accepted = zod.object({
    defaulted: zod.string().default(defaulted),
    caught: zod.string().catch(caught),
    transformed: zod.string().transform((value) => value.toUpperCase()),
  })
  const input = { caught: 7, transformed: 'accepted' }
  const expected = { defaulted, caught, transformed: 'ACCEPTED' }
  assert.deepEqual(accepted.parse(input), expected)
  assert.deepEqual(await accepted.parseAsync(input), expected)

  const union = zod.union([
    zod.array(zod.string()).max(1),
    zod.preprocess(
      (value) => (Array.isArray(value) ? value.slice(0, 2) : value),
      zod.array(zod.string()).max(2)
    ),
  ])
  const unionInput = ['first', 'second', 'third']
  const unionOutput = unionInput.slice(0, 2)
  assert.deepEqual(union.parse(unionInput), unionOutput)
  assert.deepEqual(await union.parseAsync(unionInput), unionOutput)
}

async function runParserChild(packageRoot) {
  const load = createRequire(path.join(packageRoot, 'package.json'))
  const parser = load(packageRoot).text({ verify() {} })
  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/parse') {
      return sendJson(response, 404, { status: 'not_found' })
    }
    parser(request, response, (error) => {
      if (!error) {
        return sendJson(response, 200, {
          status: 'parsed',
          parsed: request.body,
        })
      }
      const status = error.status ?? 500
      sendJson(response, status, {
        status: status === 415 ? 'rejected' : 'error',
      })
    })
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = server.address().port
  try {
    const malformed = await fetch(`http://127.0.0.1:${port}/parse`, {
      body: Buffer.from('synthetic invalid gzip payload'),
      headers: {
        'content-encoding': 'gzip',
        'content-type': 'text/plain; charset=x-dependency-probe',
      },
      method: 'POST',
      signal: AbortSignal.timeout(3_000),
    })
    assert.equal(malformed.status, 415)
    assert.deepEqual(await malformed.json(), { status: 'rejected' })
    await delay(250)
    const valid = await fetch(`http://127.0.0.1:${port}/parse`, {
      body: gzipSync(Buffer.from(PARSED_TEXT)),
      headers: {
        'content-encoding': 'gzip',
        'content-type': 'text/plain; charset=utf-8',
      },
      method: 'POST',
      signal: AbortSignal.timeout(3_000),
    })
    assert.deepEqual(
      [valid.status, await valid.json()],
      [200, { status: 'parsed', parsed: PARSED_TEXT }]
    )
  } finally {
    await new Promise((resolve) => {
      server.close(resolve)
      server.closeAllConnections?.()
    })
  }
}

function sendJson(response, status, value) {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(value))
}
