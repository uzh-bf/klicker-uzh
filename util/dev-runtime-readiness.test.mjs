import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { missingDynamicRoutes } from './check-dev-pages-manifest.mjs'

const script = fileURLToPath(new URL('./dev-runtime.sh', import.meta.url))

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'klicker-readiness-'))
  const pages = join(root, 'apps/frontend-manage/src/pages')
  mkdirSync(join(pages, 'api/auth'), { recursive: true })
  mkdirSync(join(pages, 'item/[id]'), { recursive: true })
  writeFileSync(join(pages, 'api/auth/[...login].ts'), '')
  writeFileSync(join(pages, 'item/[id]/index.jsx'), '')
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return { root, pages }
}

const completeManifest = { pages: ['/api/auth/[...login]', '/item/[id]'] }

function runProbe(root, command = 'probe-app') {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [script, command, 'frontend-manage'], {
      env: {
        ...process.env,
        KLICKER_DEV_RUNTIME_ROOT: root,
        DEV_TURBO_TASK: 'dev',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 95_000,
    })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
    })
    child.stderr.on('data', (chunk) => {
      output += chunk
    })
    child.once('error', reject)
    child.once('close', (code, signal) => resolve({ code, signal, output }))
  })
}

async function serve(t, handler) {
  const server = http.createServer(handler)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(3002, '127.0.0.1', resolve)
  })
  t.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })
}

test('dynamic source routes include API and normalized index routes', (t) => {
  const { root, pages } = fixture(t)
  assert.deepEqual(missingDynamicRoutes(pages, completeManifest), [])
  assert.deepEqual(missingDynamicRoutes(pages, { pages: ['/item/[id]'] }), [
    '/api/auth/[...login]',
  ])
  assert.throws(() => missingDynamicRoutes(pages, { pages: [null] }))
  assert.throws(() =>
    missingDynamicRoutes(join(root, 'missing'), completeManifest)
  )
  const empty = join(root, 'empty')
  mkdirSync(empty)
  assert.throws(() => missingDynamicRoutes(empty, completeManifest))
})

test('inventory failures cannot pass a healthy shell or request cache repair', async (t) => {
  const { root } = fixture(t)
  let payload = { pages: [] }
  let status = 200
  let shells = 0
  await serve(t, (request, response) => {
    if (request.url.endsWith('/_devPagesManifest.json')) {
      response.writeHead(status, { 'content-type': 'application/json' })
      response.end(
        typeof payload === 'string' ? payload : JSON.stringify(payload)
      )
    } else {
      shells += 1
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('shell')
    }
  })
  for (const [body, code, expected] of [
    [{ pages: [] }, 200, 21],
    [{ pages: ['/item/[id]'] }, 200, 21],
    ['invalid JSON', 200, 22],
    [{ pages: [null] }, 200, 22],
    [completeManifest, 404, 22],
  ]) {
    payload = body
    status = code
    assert.equal((await runProbe(root)).code, expected)
  }
  assert.equal(shells, 0)
  status = 200
  payload = completeManifest
  assert.equal((await runProbe(join(root, 'missing'))).code, 22)
  assert.equal((await runProbe(root)).code, 0)
  assert.equal(shells, 1)
  // probe-app is read-only, including failed inventories.
  assert.equal(
    existsSync(join(root, '.devcontainer/.runtime/next-repair-request')),
    false
  )
})

test('an initially incomplete inventory can become ready within the existing wait', async (t) => {
  const { root } = fixture(t)
  let manifests = 0
  await serve(t, (request, response) => {
    if (request.url.endsWith('/_devPagesManifest.json')) {
      manifests += 1
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify(manifests < 3 ? { pages: [] } : completeManifest)
      )
    } else {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('shell')
    }
  })
  const result = await runProbe(root, 'wait-app')
  assert.equal(result.code, 0, result.output)
  assert.equal(manifests, 3)
})

test('the manifest and shell share one request budget', async (t) => {
  const { root } = fixture(t)
  await serve(t, (request, response) => {
    if (request.url.endsWith('/_devPagesManifest.json')) {
      setTimeout(() => {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify(completeManifest))
      }, 3000)
    }
  })
  const started = performance.now()
  const result = await runProbe(root)
  assert.equal(result.code, 21)
  assert.ok(performance.now() - started < 17_000)
})

test('a hanging HTTP response cannot extend the readiness deadline', {
  timeout: 100_000,
}, async (t) => {
  const { root } = fixture(t)
  let requests = 0
  const server = http.createServer(() => {
    requests += 1
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(3002, '127.0.0.1', resolve)
  })
  const started = performance.now()
  const child = spawn('bash', [script, 'wait-app', 'frontend-manage'], {
    env: {
      ...process.env,
      KLICKER_DEV_RUNTIME_ROOT: root,
      DEV_TURBO_TASK: 'dev',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 95_000,
  })
  let stdout = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  child.stderr.resume()
  try {
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', (code, signal) => resolve({ code, signal }))
    })
    assert.equal(result.signal, null)
    assert.equal(result.code, 1)
    const elapsed = performance.now() - started
    assert.ok(elapsed >= 88_000 && elapsed < 94_000)
    assert.ok(requests >= 2)
    // Curl's timeout code must remain visible during unchanged observations.
    assert.ok((stdout.match(/curl 28/g) ?? []).length >= 2)
  } finally {
    if (child.exitCode === null) child.kill()
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
})
