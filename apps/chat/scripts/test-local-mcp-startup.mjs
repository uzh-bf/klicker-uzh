#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import pg from 'pg'

const helper = '/tmp/devrouter/bin/devrouter-process'
const root = '/workspaces/klicker-uzh'
let child
let db
let stage = 'runtime boundary'
let ownsProcesses = false

function stopped() {
  for (const name of ['klicker-dev', 'klicker-local-mcp']) {
    const result = spawnSync(helper, ['status', '--name', name], {
      encoding: 'utf8',
      timeout: 10000,
    })
    assert.equal(result.status, 0)
    assert.equal(JSON.parse(result.stdout).status, 'stopped')
  }
}

function start(env) {
  let output = ''
  child = spawn(
    process.execPath,
    ['apps/chat/scripts/local-mcp-bootstrap.mjs'],
    {
      cwd: root,
      env: { ...process.env, DEVROUTER_PROFILE: 'mcp', ...env },
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 20000,
      killSignal: 'SIGKILL',
    }
  )
  child.stdout.on('data', (data) => {
    output = (output + data.toString()).slice(-8192)
  })
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) =>
      resolve({
        code,
        signal,
        fixtureStarted: output.includes('LOCAL_MCP_TEST_FIXTURE_STARTED'),
      })
    )
  })
}

try {
  assert.equal(process.env.LOCAL_MCP_STARTUP_TEST, '1')
  assert.equal(realpathSync(process.cwd()), root)
  const url = new URL(process.env.DATABASE_URL)
  assert(['postgres:', 'postgresql:'].includes(url.protocol))
  assert(['postgres', 'localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  assert.equal(url.search, '')

  // Act as the delivered helper only for this subprocess. Start the real fixture
  // before reporting failure, so cleanup must terminate an actual process.
  if (['ensure', 'stop'].includes(process.argv[2])) {
    const result = spawnSync(helper, process.argv.slice(2), {
      stdio: 'ignore',
      timeout: 30000,
    })
    if (result.status === 0 && process.argv[2] === 'ensure') {
      console.log('LOCAL_MCP_TEST_FIXTURE_STARTED')
    }
    process.exit(
      result.status === 0 && process.argv[2] === 'ensure'
        ? 42
        : (result.status ?? 1)
    )
  }

  stage = 'post-start failure'
  ownsProcesses = true
  const failed = await start({ DEVROUTER_PROCESS_HELPER: process.argv[1] })
  assert.deepEqual(failed, { code: 1, signal: null, fixtureStarted: true })
  stopped()
  console.log('PASS: post-start failure stops both owned groups')

  stage = 'database lock setup'
  db = new pg.Client({ connectionString: process.env.DATABASE_URL })
  db.on('error', () => {})
  await db.connect()
  await db.query('BEGIN')
  await db.query("SET LOCAL statement_timeout = '10s'")
  await db.query(
    'SELECT id FROM "ChatbotMCPServer" WHERE name = $1 FOR UPDATE',
    ['KB']
  )
  const application = `local-mcp-interruption-test-${process.pid}`
  const completed = start({
    DEVROUTER_PROCESS_HELPER: helper,
    PGAPPNAME: application,
  })
  let waiting = false
  stage = 'observe bootstrap lock wait'
  for (let attempt = 0; attempt < 30; attempt++) {
    await db.query('SELECT pg_stat_clear_snapshot()')
    const result = await db.query(
      "SELECT 1 FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'",
      [application]
    )
    if (result.rowCount === 1) {
      waiting = true
      break
    }
    await delay(100)
  }
  assert(
    waiting,
    'Bootstrap must reach the locked transaction before interruption'
  )
  stage = 'interruption cleanup'
  child.kill('SIGTERM')
  await delay(100)
  await db.query('ROLLBACK')
  assert.deepEqual(await completed, {
    code: 1,
    signal: null,
    fixtureStarted: false,
  })
  stopped()
  console.log('PASS: SIGTERM during seed locking exits through owned cleanup')
} catch {
  console.error(
    `FAIL: local MCP startup acceptance at ${stage}; no credentials logged`
  )
  process.exitCode = 1
} finally {
  if (child?.exitCode === null && child?.signalCode === null)
    child.kill('SIGKILL')
  if (db) {
    await db.query('ROLLBACK').catch(() => {})
    await db.end()
  }
  if (ownsProcesses) {
    for (const name of ['klicker-dev', 'klicker-local-mcp']) {
      spawnSync(helper, ['stop', '--name', name], {
        stdio: 'ignore',
        timeout: 30000,
      })
    }
  }
}
