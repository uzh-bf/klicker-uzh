#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ARCHIVE = 'playwright-runtime.tar'
const RECEIPT = 'playwright-runtime.json'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${command} failed (${result.status})`)
}

function manifest(appDir) {
  return JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8'))
}

export function buildRuntime(appDir, execute = run) {
  const app = basename(appDir)
  const buildCommand = manifest(appDir).scripts.build
  assert(buildCommand, `${app} must define its production build command`)
  console.log(`Playwright production build: ${app}: ${buildCommand}`)
  execute('pnpm', ['run', 'build'], {
    cwd: appDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      KLICKER_PLAYWRIGHT_FIXTURES: '1',
    },
  })

  const next = join(appDir, '.next')
  const standalone = join(next, 'standalone')
  const serverApp = join(standalone, 'apps', app)
  assert(existsSync(join(serverApp, 'server.js')), 'Missing standalone server')
  cpSync(join(next, 'static'), join(serverApp, '.next/static'), {
    recursive: true,
  })
  if (existsSync(join(appDir, 'public'))) {
    cpSync(join(appDir, 'public'), join(serverApp, 'public'), {
      recursive: true,
    })
  }
  const receipt = {
    version: 1,
    app,
    nodeEnv: 'production',
    buildCommand,
    buildId: readFileSync(join(next, 'BUILD_ID'), 'utf8').trim(),
  }
  writeFileSync(join(standalone, RECEIPT), JSON.stringify(receipt))
  // The trusted CI action excludes .next/standalone. Carry the complete server
  // inside its existing .next archive contract, preserving traced symlinks.
  run('tar', [
    '--exclude=.env*',
    '-cf',
    join(next, ARCHIVE),
    '-C',
    standalone,
    '.',
  ])
  console.log(`Playwright runtime built: ${JSON.stringify(receipt)}`)
}

export function startRuntime(appDir, port) {
  assert(/^\d+$/.test(port), 'Pass the application port')
  const archive = join(appDir, '.next', ARCHIVE)
  assert(
    existsSync(archive),
    'Missing production runtime; run build:test first'
  )
  const extracted = mkdtempSync(join(tmpdir(), 'klicker-playwright-next-'))
  try {
    run('tar', ['-xf', archive, '-C', extracted])
    const receipt = JSON.parse(readFileSync(join(extracted, RECEIPT), 'utf8'))
    const app = basename(appDir)
    assert.equal(receipt.version, 1)
    assert.equal(receipt.app, app)
    assert.equal(receipt.nodeEnv, 'production')
    assert.equal(receipt.buildCommand, manifest(appDir).scripts.build)
    const serverApp = join(extracted, 'apps', app)
    assert.equal(
      readFileSync(join(serverApp, '.next/BUILD_ID'), 'utf8').trim(),
      receipt.buildId
    )
    console.log(`Playwright production runtime: ${JSON.stringify(receipt)}`)
    const child = spawn(process.execPath, [join(serverApp, 'server.js')], {
      cwd: serverApp,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        KLICKER_PLAYWRIGHT_FIXTURES: '1',
        PORT: port,
        HOSTNAME: '0.0.0.0',
      },
    })
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => child.kill(signal))
    }
    child.once('error', (error) => {
      console.error(error)
      process.exitCode = 1
    })
    child.once('close', (code, signal) => {
      rmSync(extracted, { recursive: true, force: true })
      process.exitCode = code ?? (signal === 'SIGTERM' ? 143 : 130)
    })
    return child
  } catch (error) {
    rmSync(extracted, { recursive: true, force: true })
    throw error
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [command, port] = process.argv.slice(2)
  if (command === 'build') buildRuntime(process.cwd())
  else if (command === 'start') startRuntime(process.cwd(), port)
  else throw new Error('Use build or start <port>')
}
