import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  inputIdentity,
  verify,
  productionEnvironment,
} from './production-standalone.mjs'

function fixture() {
  return {
    NODE_ENV: 'production',
    DEVROUTER_PROFILE: 'manage,pwa,email',
    EMAIL_HOST: 'mailhog',
    EMAIL_PORT: '1025',
    CANDIDATE_SHA: 'a'.repeat(40),
    APP_ORIGIN_API: 'http://127.0.0.1:3000',
    APP_ORIGIN_AUTH: 'http://127.0.0.1:3010',
    APP_ORIGIN_PWA: 'http://127.0.0.1:3001',
    APP_ORIGIN_MANAGE: 'http://127.0.0.1:3002',
    NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3000/api/graphql',
    NEXT_PUBLIC_PWA_URL: 'http://127.0.0.1:3001',
    NEXT_PUBLIC_MANAGE_URL: 'http://127.0.0.1:3002',
  }
}
test('accepts a production build with local synthetic services', () => {
  const env = productionEnvironment({
    ...fixture(),
    NEXT_PUBLIC_MATOMO_URL: 'https://example.invalid',
    NEXT_PUBLIC_MATOMO_SITE_ID: '1',
  })
  assert.equal(env.NODE_ENV, 'production')
  assert.equal(env.NEXT_PUBLIC_MATOMO_URL, '')
  assert.equal(env.NEXT_PUBLIC_MATOMO_SITE_ID, '')
})
test('rejects development, external origins, stale public inputs and external SMTP', () => {
  for (const change of [
    { NODE_ENV: 'test' },
    { DEVROUTER_PROFILE: 'full' },
    { EMAIL_HOST: 'smtp.example.com' },
    { EMAIL_PORT: '465' },
    { EMAIL_USER: 'external' },
    { EMAIL_PASS: 'external' },
    { TEAMS_WEBHOOK_URL: 'https://example.com' },
    { CANDIDATE_SHA: '' },
    { APP_ORIGIN_PWA: 'https://example.com' },
    { NEXT_PUBLIC_PWA_URL: 'http://127.0.0.1:9999' },
  ])
    assert.throws(() => productionEnvironment({ ...fixture(), ...change }))
})

test('artifact verification rejects changed inputs and replaced standalone output', () => {
  const root = mkdtempSync(join(tmpdir(), 'account-artifact-'))
  const env = fixture()
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'synthetic-lock')
  const artifacts = {}
  for (const app of [
    'auth',
    'frontend-pwa',
    'frontend-manage',
    'backend-docker',
  ]) {
    const dir = join(
      root,
      'apps',
      app,
      app === 'backend-docker' ? 'dist' : '.next/standalone'
    )
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'server.js'), 'synthetic-entry')
    artifacts[app] = {
      digest: createHash('sha256')
        .update('/server.js')
        .update('synthetic-entry')
        .digest('hex'),
    }
  }
  mkdirSync(join(root, '.devcontainer/.runtime'), { recursive: true })
  writeFileSync(
    join(root, '.devcontainer/.runtime/production-artifacts.json'),
    JSON.stringify({ ...inputIdentity(env, root), artifacts })
  )
  assert.equal(verify(env, root).sourceSha, env.CANDIDATE_SHA)
  const imageCache = join(
    root,
    'apps/frontend-pwa/.next/standalone/apps/frontend-pwa/.next/cache/images'
  )
  mkdirSync(imageCache, { recursive: true })
  writeFileSync(join(imageCache, 'request.webp'), 'optimized-image')
  const pageCache = join(
    root,
    'apps/frontend-pwa/.next/standalone/apps/frontend-pwa/.next/server/pages/en'
  )
  mkdirSync(pageCache, { recursive: true })
  writeFileSync(join(pageCache, 'request.html'), 'rendered-page')
  writeFileSync(join(pageCache, 'request.json'), 'rendered-data')
  assert.equal(verify(env, root).sourceSha, env.CANDIDATE_SHA)
  assert.throws(
    () =>
      verify({ ...env, NEXT_PUBLIC_PWA_URL: 'http://127.0.0.1:9999' }, root),
    /Stale/
  )
  writeFileSync(
    join(root, 'apps/frontend-pwa/.next/standalone/server.js'),
    'replaced-entry'
  )
  assert.throws(() => verify(env, root), /Changed production artifact/)
})
