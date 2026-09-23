const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { main, parseTurboOutput } = require('./turbo-telemetry.cjs')

test('parses the standard Turbo task and cache summary', () => {
  assert.deepEqual(
    parseTurboOutput(`
Tasks:    21 successful, 21 total
Cached:    17 cached, 21 total
`),
    {
      tasksSuccessful: 21,
      tasksTotal: 21,
      tasksCached: 17,
      cachedTotal: 21,
    }
  )
})

test('missing or unsuccessful Turbo summaries remain bounded', () => {
  assert.deepEqual(
    parseTurboOutput('build failed before Turbo printed a summary'),
    {
      tasksSuccessful: null,
      tasksTotal: null,
      tasksCached: null,
      cachedTotal: null,
    }
  )
})

test('partial Turbo summaries preserve present values and zeroes', () => {
  assert.deepEqual(parseTurboOutput(`Tasks:    0 successful, 21 total`), {
    tasksSuccessful: 0,
    tasksTotal: 21,
    tasksCached: null,
    cachedTotal: null,
  })
  assert.deepEqual(parseTurboOutput(`Cached:    0 cached, 21 total`), {
    tasksSuccessful: null,
    tasksTotal: null,
    tasksCached: 0,
    cachedTotal: 21,
  })
})

test('CLI writes the same uppercase telemetry fields to both GitHub files', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'turbo-telemetry-'))
  const log = path.join(root, 'turbo.log')
  const output = path.join(root, 'output')
  const environment = path.join(root, 'environment')
  const old = { ...process.env }
  t.after(() => {
    for (const key of Object.keys(process.env)) {
      if (!Object.hasOwn(old, key)) delete process.env[key]
    }
    Object.assign(process.env, old)
    fs.rmSync(root, { recursive: true, force: true })
  })

  fs.writeFileSync(
    log,
    'Tasks:    2 successful, 3 total\nCached:    1 cached, 3 total\n'
  )
  process.env.GITHUB_OUTPUT = output
  process.env.GITHUB_ENV = environment

  main(['--log', log])

  const expected = [
    'TURBO_TASKS_SUCCESSFUL=2',
    'TURBO_TASKS_TOTAL=3',
    'TURBO_TASKS_CACHED=1',
    'TURBO_CACHED_TOTAL=3',
  ].join('\n')
  assert.equal(fs.readFileSync(output, 'utf8').trim(), expected)
  assert.equal(fs.readFileSync(environment, 'utf8').trim(), expected)
})
