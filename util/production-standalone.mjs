#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const nextApps = ['auth', 'frontend-pwa', 'frontend-manage']
const ports = {
  'backend-docker': 3000,
  auth: 3010,
  'frontend-pwa': 3001,
  'frontend-manage': 3002,
}
const manifestPath = join(
  root,
  '.devcontainer/.runtime/production-artifacts.json'
)
const digest = (value) => createHash('sha256').update(value).digest('hex')

export function productionEnvironment(env) {
  assert.equal(
    env.NODE_ENV,
    'production',
    'Production runtime requires NODE_ENV=production'
  )
  assert.deepEqual((env.DEVROUTER_PROFILE ?? '').split(',').sort(), [
    'email',
    'manage',
    'pwa',
  ])
  assert.equal(
    env.EMAIL_HOST,
    'mailhog',
    'Production tests require local MailHog SMTP'
  )
  assert.equal(String(env.EMAIL_PORT), '1025')
  for (const key of ['TEAMS_WEBHOOK_URL', 'EMAIL_USER', 'EMAIL_PASS'])
    assert(!env[key], `External integration must be absent: ${key}`)
  assert.match(
    env.KLICKER_PRODUCTION_SOURCE_SHA ?? env.CANDIDATE_SHA ?? '',
    /^[a-f0-9]{40}$/
  )
  for (const key of [
    'APP_ORIGIN_API',
    'APP_ORIGIN_AUTH',
    'APP_ORIGIN_PWA',
    'APP_ORIGIN_MANAGE',
  ]) {
    const url = new URL(env[key])
    assert(
      url.hostname === '127.0.0.1' || url.hostname.endsWith('.localhost'),
      `Nonlocal origin: ${key}`
    )
  }
  assert.equal(env.NEXT_PUBLIC_API_URL, `${env.APP_ORIGIN_API}/api/graphql`)
  assert.equal(env.NEXT_PUBLIC_PWA_URL, env.APP_ORIGIN_PWA)
  assert.equal(env.NEXT_PUBLIC_MANAGE_URL, env.APP_ORIGIN_MANAGE)
  assert(
    !existsSync(join(root, '.devcontainer/.runtime/beta-enrollment-fixture')),
    'Incompatible beta fixture'
  )
  return {
    ...env,
    EMAIL_FROM: 'account-tests@example.invalid',
    HOSTNAME: '0.0.0.0',
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_MATOMO_URL: '',
    NEXT_PUBLIC_MATOMO_SITE_ID: '',
  }
}

function treeDigest(directory) {
  const hash = createHash('sha256')
  function visit(dir, prefix = '') {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      const relative = `${prefix}/${entry.name}`
      // Next.js writes optimized images on requests; these are not build artifacts.
      if (entry.isDirectory() && relative.endsWith('/.next/cache/images'))
        continue
      // Pages Router also materializes and regenerates HTML/data on requests.
      if (
        relative.includes('/.next/server/pages/') &&
        /\.(?:html|json)$/.test(relative) &&
        !relative.endsWith('.nft.json')
      )
        continue
      const file = join(dir, entry.name)
      if (entry.isDirectory()) visit(file, relative)
      else if (entry.isFile()) hash.update(relative).update(readFileSync(file))
      else if (entry.isSymbolicLink())
        hash.update(relative).update(readlinkSync(file))
    }
  }
  visit(directory)
  return hash.digest('hex')
}

export function inputIdentity(env, workspaceRoot = root) {
  return {
    sourceSha: env.KLICKER_PRODUCTION_SOURCE_SHA ?? env.CANDIDATE_SHA,
    sourceDigest: env.KLICKER_PRODUCTION_SOURCE_DIGEST ?? env.CANDIDATE_SHA,
    architecture: process.arch,
    node: process.version,
    lockfile: digest(readFileSync(join(workspaceRoot, 'pnpm-lock.yaml'))),
    buildInputs: Object.fromEntries(
      Object.entries(env)
        .filter(
          ([key]) =>
            key.startsWith('NEXT_PUBLIC_') ||
            [
              'COOKIE_DOMAIN',
              'API_DOMAIN',
              'APP_ORIGIN_API',
              'APP_ORIGIN_AUTH',
              'APP_ORIGIN_PWA',
              'APP_ORIGIN_MANAGE',
            ].includes(key)
        )
        .sort(([a], [b]) => a.localeCompare(b))
    ),
  }
}

function command(args, env) {
  const result = spawnSync('pnpm', args, { cwd: root, env, stdio: 'inherit' })
  if (result.error) throw result.error
  assert.equal(result.status, 0, 'Production build failed')
}

export function build(env = process.env) {
  env = productionEnvironment(env)
  const identity = inputIdentity(env)
  const filters = Object.keys(ports).map(
    (app) => `--filter=@klicker-uzh/${app}^...`
  )
  command(['exec', 'turbo', 'run', 'build', '--force', ...filters], env)
  command(['--filter', '@klicker-uzh/backend-docker', 'build'], env)
  for (const app of nextApps) {
    command(
      ['--filter', `@klicker-uzh/${app}`, 'exec', 'next', 'build', '--webpack'],
      env
    )
    const appRoot = join(root, 'apps', app)
    const output = join(appRoot, '.next/standalone/apps', app)
    assert(existsSync(join(output, 'server.js')), 'Missing standalone server')
    cpSync(join(appRoot, '.next/static'), join(output, '.next/static'), {
      recursive: true,
    })
    if (existsSync(join(appRoot, 'public')))
      cpSync(join(appRoot, 'public'), join(output, 'public'), {
        recursive: true,
      })
  }
  const artifacts = Object.fromEntries(
    nextApps.map((app) => [
      app,
      {
        buildId: readFileSync(
          join(root, 'apps', app, '.next/BUILD_ID'),
          'utf8'
        ).trim(),
        digest: treeDigest(join(root, 'apps', app, '.next/standalone')),
        bundler: 'webpack',
      },
    ])
  )
  artifacts['backend-docker'] = {
    digest: treeDigest(join(root, 'apps/backend-docker/dist')),
    bundler: 'rollup',
  }
  mkdirSync(dirname(manifestPath), { recursive: true })
  writeFileSync(
    manifestPath,
    `${JSON.stringify({ ...identity, artifacts }, null, 2)}\n`
  )
}

export function verify(env, workspaceRoot = root) {
  const manifest = JSON.parse(
    readFileSync(
      join(workspaceRoot, '.devcontainer/.runtime/production-artifacts.json'),
      'utf8'
    )
  )
  const { artifacts, ...identity } = manifest
  assert.deepEqual(
    identity,
    inputIdentity(env, workspaceRoot),
    'Stale production build inputs'
  )
  for (const app of Object.keys(ports)) {
    const directory = join(
      workspaceRoot,
      'apps',
      app,
      app === 'backend-docker' ? 'dist' : '.next/standalone'
    )
    assert.equal(
      treeDigest(directory),
      artifacts[app]?.digest,
      `Changed production artifact: ${app}`
    )
  }
  return manifest
}

export function start(app, supplied = process.env) {
  const env = productionEnvironment(supplied)
  assert(Object.hasOwn(ports, app), 'Unknown production app')
  verify(env)
  const appRoot = join(root, 'apps', app)
  const cwd =
    app === 'backend-docker' ? appRoot : join(appRoot, '.next/standalone')
  const entry =
    app === 'backend-docker' ? 'dist/index.js' : `apps/${app}/server.js`
  const child = spawn(process.execPath, [entry], {
    cwd,
    env: { ...env, PORT: String(ports[app]) },
    stdio: 'inherit',
  })
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => child.kill(signal))
  child.on('error', () => {
    process.exitCode = 1
  })
  child.on('exit', (code) => {
    process.exitCode = code ?? 1
  })
}

export async function ready() {
  const pending = new Set([
    'http://127.0.0.1:3000/healthz',
    'http://127.0.0.1:3010',
    'http://127.0.0.1:3001/en/createAccount',
    'http://127.0.0.1:3001/de/createAccount',
    'http://127.0.0.1:3002',
  ])
  const deadline = Date.now() + 120_000
  while (pending.size && Date.now() < deadline) {
    await Promise.all(
      [...pending].map(async (url) => {
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(5000),
          })
          await response.body?.cancel()
          if (response.status === 200) pending.delete(url)
        } catch {}
      })
    )
    if (pending.size) await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  assert.equal(
    pending.size,
    0,
    `Production document readiness failed: ${[...pending].join(', ')}`
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [action, app] = process.argv.slice(2)
  if (action === 'build') build()
  else if (action === 'start') start(app)
  else if (action === 'ready') await ready()
  else if (action === 'verify') {
    verify(productionEnvironment(process.env))
    console.log('Production artifacts verified')
  } else throw Error('Expected build, start <app>, or verify')
}
