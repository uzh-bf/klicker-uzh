const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')
const { once } = require('node:events')
const { test } = require('node:test')
const { snapshot } = require('./playwright-resource-sampler.cjs')

test('records numeric system metrics without double counting guest CPU', () => {
  const files = {
    '/proc/stat': 'cpu  1 2 3 4 5 6 7 8 9 10\n',
    '/proc/meminfo': 'MemAvailable: 1234 kB\n',
    '/proc/pressure/io': 'some avg10=0.00 avg60=0.00 avg300=0.00 total=42\n',
  }
  const result = snapshot((file) => files[file] || '')
  assert.deepEqual(result.cpuTicks, [1, 2, 3, 4, 5, 6, 7, 8])
  assert.equal(result.memoryAvailableKb, 1234)
  assert.deepEqual(result.pressureMicroseconds.io, { some: 42, full: null })
  assert.equal(result.pressureMicroseconds.cpu.some, null)
})

test('unavailable counters are null rather than idle measurements', () => {
  const result = snapshot(() => {
    throw new Error('unavailable')
  })
  assert.equal(result.cpuTicks, null)
  assert.equal(result.memoryAvailableKb, null)
})

test('preserves failed command exit and writes bounded numeric output', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'resource-test-'))
  try {
    const output = path.join(directory, 'samples.jsonl')
    const result = spawnSync(process.execPath, [
      path.join(__dirname, 'playwright-resource-sampler.cjs'),
      output,
      process.execPath,
      '-e',
      'process.exit(7)',
    ])
    assert.equal(result.status, 7)
    const rows = fs
      .readFileSync(output, 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse)
    assert.equal(rows.length, 2)
    const unavailable = spawnSync(process.execPath, [
      path.join(__dirname, 'playwright-resource-sampler.cjs'),
      output,
      process.execPath,
      '-e',
      'process.exit(0)',
    ])
    assert.equal(unavailable.status, 0)
    assert.equal(fs.readFileSync(output, 'utf8').trim().split('\n').length, 2)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('forwards cancellation and exits with signal status', {
  timeout: 10000,
}, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'resource-test-'))
  const child = spawn(process.execPath, [
    path.join(__dirname, 'playwright-resource-sampler.cjs'),
    path.join(directory, 'samples.jsonl'),
    process.execPath,
    '-e',
    'console.log("ready"); setInterval(() => {}, 1000)',
  ])
  try {
    await once(child.stdout, 'data')
    const exited = once(child, 'exit')
    child.kill('SIGTERM')
    const [code] = await exited
    assert.equal(code, 143)
  } finally {
    child.kill('SIGKILL')
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
