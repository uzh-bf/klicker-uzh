import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import http from 'node:http'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./dev-runtime.sh', import.meta.url))

test('a hanging HTTP response cannot extend the readiness deadline', {
  timeout: 100_000,
}, async () => {
  let requests = 0
  const server = http.createServer(() => {
    requests += 1
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(3010, '127.0.0.1', resolve)
  })
  const started = performance.now()
  const child = spawn('bash', [script, 'wait-app', 'auth'], {
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
