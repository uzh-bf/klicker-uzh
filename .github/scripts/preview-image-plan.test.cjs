'use strict'

const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const path = require('node:path')
const { test } = require('node:test')

const {
  configurationDigest,
  isoWeek,
  resolvePreviewImages,
  validateDispatchInputs,
} = require('./preview-image-plan.cjs')
const { PREVIEW_IMAGE_TARGETS } = require('./staging-image-targets.cjs')

const repositoryRoot = path.resolve(__dirname, '../..')
const sourceRevision = 'a'.repeat(40)
const controlRevision = 'b'.repeat(40)

// These are synthetic public values. They exercise the trusted deployment
// validator without reading a secret or a live environment.
const deploymentConfiguration = {
  APP_ORIGIN_API: 'https://api.preview.test',
  APP_ORIGIN_ASSESSMENT_API: 'https://assessment-api.preview.test',
  APP_ORIGIN_ASSESSMENT_PWA: 'https://assessment.preview.test',
  APP_ORIGIN_AUTH: 'https://auth.preview.test',
  APP_ORIGIN_CHAT: 'https://chat.preview.test',
  APP_ORIGIN_CONTROL: 'https://control.preview.test',
  APP_ORIGIN_LTI: 'https://lti.preview.test',
  APP_ORIGIN_MANAGE: 'https://manage.preview.test',
  APP_ORIGIN_PWA: 'https://pwa.preview.test',
  API_DOMAIN: 'api.preview.test',
  API_URL_SSR: 'http://api:7078/api/graphql',
  AUTH_LECTURER_ALLOWED_HOSTS: 'auth.preview.test,manage.preview.test',
  AUTH_PWA_HOSTS: 'pwa.preview.test,assessment.preview.test',
  AUTH_STUDENT_ALLOWED_HOSTS: 'auth.preview.test,assessment.preview.test',
  NEXT_PUBLIC_IMAGE_BASE_PATH: 'https://blob.preview.test/klickerdev/images',
  BLOB_STORAGE_ACCOUNT_URL: 'https://blob.preview.test/klickerdev',
  COOKIE_DOMAIN: '.preview.test',
  EDUID_CLIENT_ID: 'synthetic-preview-client',
  EDUID_WELL_KNOWN:
    'https://eduid.preview.test/.well-known/openid-configuration',
  NEXTAUTH_URL: 'https://auth.preview.test',
  NEXT_PUBLIC_ADD_RESPONSE_URL: 'https://response.preview.test/AddResponse',
  NEXT_PUBLIC_API_URL: 'https://api.preview.test/api/graphql',
  NEXT_PUBLIC_API_URL_SSR: 'http://api.internal:7078/api/graphql',
  NEXT_PUBLIC_ASSESSMENT_API_URL:
    'https://assessment-api.preview.test/api/graphql',
  NEXT_PUBLIC_ASSESSMENT_URL: 'https://assessment.preview.test',
  NEXT_PUBLIC_AUTH_URL: 'https://auth.preview.test',
  NEXT_PUBLIC_AVATAR_BASE_PATH: 'https://blob.preview.test/klickerdev/avatars',
  NEXT_PUBLIC_CHAT_URL: 'https://chat.preview.test',
  NEXT_PUBLIC_CONTROL_URL: 'https://control.preview.test',
  NEXT_PUBLIC_EDUID_ID: 'eduid-preview',
  NEXT_PUBLIC_ENV: 'staging',
  NEXT_PUBLIC_GROWTHBOOK_API_HOST: 'https://growthbook.preview.test',
  NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY: 'sdk-preview-test',
  NEXT_PUBLIC_LTI_URL: 'https://lti.preview.test',
  NEXT_PUBLIC_MANAGE_URL: 'https://manage.preview.test',
  NEXT_PUBLIC_MATOMO_ID: '12',
  NEXT_PUBLIC_MATOMO_SITE_ID: '34',
  NEXT_PUBLIC_MATOMO_URL: 'https://analytics.preview.test/matomo',
  NEXT_PUBLIC_PWA_URL: 'https://pwa.preview.test',
  NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: 'synthetic-preview-web-push-key',
  NEXT_PUBLIC_WITH_MAGIC_LINK: 'false',
  NEXT_TELEMETRY_DISABLED: '1',
}

function dispatchInputs(overrides = {}) {
  return {
    buildConfigurationJson: JSON.stringify({ api: {} }),
    controlRevision,
    controlRoot: repositoryRoot,
    correlationId: 'preview-test-0001',
    eventName: 'workflow_dispatch',
    platform: 'linux/arm64',
    sourceRevision,
    targets: 'api',
    ...overrides,
  }
}

function digestOf(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

test('mixed backend and frontend targets keep per-target configurations', async () => {
  const validated = await validateDispatchInputs(
    dispatchInputs({
      buildConfigurationJson: JSON.stringify({
        api: {},
        pwa: {
          KLICKER_DEPLOYMENT_BUILD_ENV_JSON: JSON.stringify(
            deploymentConfiguration
          ),
        },
      }),
      targets: 'api,pwa',
    })
  )
  const plan = resolvePreviewImages({
    ...validated,
    sourceRoot: repositoryRoot,
  })

  assert.deepEqual(plan.expectedTargets, ['api', 'pwa'])
  const api = plan.targetMap.find((entry) => entry.logicalTarget === 'api')
  const pwa = plan.targetMap.find((entry) => entry.logicalTarget === 'pwa')
  assert.match(api.configurationDigest, /^sha256:[0-9a-f]{64}$/)
  assert.match(pwa.configurationDigest, /^sha256:[0-9a-f]{64}$/)
  assert.notEqual(api.configurationDigest, pwa.configurationDigest)
  assert.equal(api.targetKey, `target:api:config:${api.configurationDigest}`)
  assert.equal(pwa.targetKey, `target:pwa:config:${pwa.configurationDigest}`)
  assert.equal(api.configuration.KLICKER_DEPLOYMENT_BUILD_ENV_JSON, undefined)
  assert.deepEqual(
    JSON.parse(pwa.configuration.KLICKER_DEPLOYMENT_BUILD_ENV_JSON),
    deploymentConfiguration
  )
  const pwaBuild = plan.matrixBuild.find((entry) => entry.id === 'pwa')
  assert.equal(pwaBuild.platform, 'linux/arm64')
  assert.equal(
    pwaBuild.tag,
    `preview-${sourceRevision}-arm64-${pwa.configurationDigest.slice(7)}`
  )
  assert.equal(
    pwaBuild.stagingCacheRef,
    `frontend-pwa-arm:buildcache-trusted-${plan.cacheEpoch}`
  )
  assert.match(pwaBuild.buildArgs, /KLICKER_DEPLOYMENT_BUILD_ENV_JSON=/)
})

test('deployment build argument bytes retain the same variant identity across the request boundary', async () => {
  const first = await validateDispatchInputs(
    dispatchInputs({
      buildConfigurationJson: JSON.stringify({
        pwa: {
          KLICKER_DEPLOYMENT_BUILD_ENV_JSON: JSON.stringify(
            deploymentConfiguration
          ),
        },
      }),
      targets: 'pwa',
    })
  )
  const reversed = Object.fromEntries(
    Object.entries(deploymentConfiguration).reverse()
  )
  const second = await validateDispatchInputs(
    dispatchInputs({
      buildConfigurationJson: JSON.stringify({
        pwa: {
          KLICKER_DEPLOYMENT_BUILD_ENV_JSON: JSON.stringify(reversed),
        },
      }),
      targets: 'pwa',
    })
  )
  const firstEnvironment = first.configurations.get('pwa').environment
  const secondEnvironment = second.configurations.get('pwa').environment
  assert.equal(
    first.configurations.get('pwa').digest,
    configurationDigest(firstEnvironment)
  )
  assert.equal(
    second.configurations.get('pwa').digest,
    configurationDigest(secondEnvironment)
  )
  assert.notEqual(
    first.configurations.get('pwa').digest,
    second.configurations.get('pwa').digest
  )
  assert.deepEqual(
    JSON.parse(firstEnvironment.KLICKER_DEPLOYMENT_BUILD_ENV_JSON),
    JSON.parse(secondEnvironment.KLICKER_DEPLOYMENT_BUILD_ENV_JSON)
  )
})

test('dispatch validation rejects missing, unknown and wildcard targets', async () => {
  await assert.rejects(
    validateDispatchInputs(
      dispatchInputs({
        buildConfigurationJson: JSON.stringify({ api: {} }),
        targets: 'api,pwa',
      })
    ),
    /missing target\(s\): pwa/
  )
  await assert.rejects(
    validateDispatchInputs(dispatchInputs({ targets: 'api,unknown' })),
    /unknown logical target\(s\): unknown/
  )
  await assert.rejects(
    validateDispatchInputs(dispatchInputs({ targets: '*' })),
    /wildcard target selection/
  )
  await assert.rejects(
    validateDispatchInputs(
      dispatchInputs({ buildConfigurationJson: JSON.stringify({ pwa: {} }) })
    ),
    /pwa requires KLICKER_DEPLOYMENT_BUILD_ENV_JSON/
  )
})

test('dispatch validation requires an exact SHA, platform and bounded correlation', async () => {
  await assert.rejects(
    validateDispatchInputs(dispatchInputs({ sourceRevision: 'abc123' })),
    /full 40-character commit SHA/
  )
  await assert.rejects(
    validateDispatchInputs(dispatchInputs({ platform: 'linux/386' })),
    /platform must be one of/
  )
  await assert.rejects(
    validateDispatchInputs(dispatchInputs({ correlationId: 'x'.repeat(101) })),
    /at most 100 characters/
  )
  await assert.rejects(
    validateDispatchInputs(dispatchInputs({ eventName: 'push' })),
    /requires a workflow_dispatch event/
  )
})

test('shared fixture Dockerfile builds once and emits one receipt per logical target', async () => {
  const validated = await validateDispatchInputs(
    dispatchInputs({
      buildConfigurationJson: JSON.stringify({
        'db-bootstrap': {},
        fixtures: {},
        'local-mcp': {},
      }),
      targets: 'db-bootstrap,fixtures,local-mcp',
    })
  )
  const plan = resolvePreviewImages({
    ...validated,
    sourceRoot: repositoryRoot,
  })

  assert.deepEqual(plan.expectedTargets, ['fixtures'])
  assert.equal(plan.matrixBuild.length, 1)
  assert.deepEqual(
    plan.targetMap.map((entry) => entry.logicalTarget),
    ['db-bootstrap', 'fixtures', 'local-mcp']
  )
  assert.equal(new Set(plan.targetMap.map((entry) => entry.image)).size, 1)
  assert.equal(
    new Set(plan.targetMap.map((entry) => entry.configurationDigest)).size,
    1
  )
})

test('the fixtures logical target needs no sibling alias configuration', async () => {
  const validated = await validateDispatchInputs(
    dispatchInputs({
      buildConfigurationJson: JSON.stringify({ fixtures: {} }),
      targets: 'fixtures',
    })
  )
  const plan = resolvePreviewImages({
    ...validated,
    sourceRoot: repositoryRoot,
  })
  assert.deepEqual(plan.expectedTargets, ['fixtures'])
  assert.deepEqual(
    plan.targetMap.map((entry) => entry.logicalTarget),
    ['fixtures']
  )
})

test('chat fingerprint inputs include the preview runtime command', () => {
  const chat = PREVIEW_IMAGE_TARGETS.find((target) => target.id === 'chat')
  assert.ok(chat)
  assert.ok(chat.globs.includes('deploy/preview/**'))
})

test('one physical target cannot carry two public configurations', async () => {
  const validated = await validateDispatchInputs(
    dispatchInputs({
      buildConfigurationJson: JSON.stringify({
        'db-bootstrap': {},
        fixtures: { EXTRA_PUBLIC_FLAG: 'true' },
      }),
      targets: 'db-bootstrap,fixtures',
    })
  )
  assert.throws(
    () =>
      resolvePreviewImages({
        ...validated,
        sourceRoot: repositoryRoot,
      }),
    /require identical configuration/
  )
})

test('configurationDigest hashes the canonical empty configuration once', () => {
  assert.equal(configurationDigest({}), digestOf('{}'))
  assert.equal(
    configurationDigest({ Z: 'last', A: 'first' }),
    digestOf('{"A":"first","Z":"last"}')
  )
})

test('the preview cache epoch uses the trusted ISO week format', () => {
  assert.equal(isoWeek(new Date('2020-12-31T23:59:59Z')), '2020-W53')
  assert.equal(isoWeek(new Date('2021-01-01T00:00:00Z')), '2020-W53')
  assert.equal(isoWeek(new Date('2021-01-04T00:00:00Z')), '2021-W01')
})
