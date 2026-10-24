import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  PreviewBuildEnvError,
  parsePreviewBuildEnv,
  prepareChildEnvironment,
} from './preview-build-env.mjs'

const helperPath = fileURLToPath(
  new URL('./preview-build-env.mjs', import.meta.url)
)

const printEnvironmentFixture = `
const keys = process.env.PRINT_KEYS.split(',')
process.stdout.write(JSON.stringify(Object.fromEntries(
  keys.map((key) => [key, process.env[key] ?? null]),
)))
`

const validPreviewConfig = {
  API_DOMAIN: 'api.preview.test',
  API_URL_SSR: 'http://api:7078/api/graphql',
  BLOB_STORAGE_ACCOUNT_URL: 'https://blob.preview.test/klickerdev',
  COOKIE_DOMAIN: '.preview.test',
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
  NEXT_PUBLIC_ENV: 'staging',
  NEXT_PUBLIC_GROWTHBOOK_API_HOST: 'https://growthbook.preview.test',
  NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY: 'sdk-preview-test',
  NEXT_PUBLIC_LTI_URL: 'https://lti.preview.test',
  NEXT_PUBLIC_MANAGE_URL: 'https://manage.preview.test',
  NEXT_PUBLIC_MATOMO_ID: '12',
  NEXT_PUBLIC_MATOMO_SITE_ID: '34',
  NEXT_PUBLIC_MATOMO_URL: 'https://analytics.preview.test/matomo',
  NEXT_PUBLIC_PWA_URL: 'https://pwa.preview.test',
  NEXT_TELEMETRY_DISABLED: '1',
}

function createEnvironment(overrides = {}) {
  return {
    PATH: process.env.PATH,
    PRINT_KEYS: [
      ...Object.keys(validPreviewConfig),
      'KLICKER_PREVIEW_BUILD_ENV_JSON',
      'TURBO_FORCE',
    ].join(','),
    ...overrides,
  }
}

function createWorkspace(context) {
  const workspace = mkdtempSync(join(tmpdir(), 'klicker-preview-build-env-'))
  context.after(() => rmSync(workspace, { force: true, recursive: true }))
  return workspace
}

function runHelper(workspace, env, args = []) {
  return spawnSync(process.execPath, [helperPath, ...args], {
    cwd: workspace,
    encoding: 'utf8',
    env,
    timeout: 10_000,
  })
}

function environmentArguments() {
  return [
    '--app',
    'frontend-manage',
    '--',
    process.execPath,
    '-e',
    printEnvironmentFixture,
  ]
}

test('absent and empty input preserve the legacy build environment', (t) => {
  const workspace = createWorkspace(t)
  const emptyBindings = {
    NEXT_PUBLIC_API_URL: '',
    NEXT_PUBLIC_MANAGE_URL: '',
  }
  const keys = [
    ...Object.keys(emptyBindings),
    'KLICKER_PREVIEW_BUILD_ENV_JSON',
    'TURBO_FORCE',
  ]
  const baseEnv = createEnvironment({
    ...emptyBindings,
    PRINT_KEYS: keys.join(','),
  })

  for (const input of [undefined, '', '   ']) {
    const env = { ...baseEnv }
    if (input === undefined) delete env.KLICKER_PREVIEW_BUILD_ENV_JSON
    else env.KLICKER_PREVIEW_BUILD_ENV_JSON = input

    const result = runHelper(workspace, env, environmentArguments())
    assert.equal(result.status, 0, result.stderr)
    const childEnv = JSON.parse(result.stdout)
    assert.equal(childEnv.NEXT_PUBLIC_API_URL, '')
    assert.equal(childEnv.NEXT_PUBLIC_MANAGE_URL, '')
    assert.equal(childEnv.KLICKER_PREVIEW_BUILD_ENV_JSON, null)
    assert.equal(childEnv.TURBO_FORCE, null)
    assert.deepEqual(readdirSync(workspace), [])
  }
})

test('valid preview bindings override existing values without changing files', (t) => {
  const workspace = createWorkspace(t)
  const env = createEnvironment({
    KLICKER_PREVIEW_BUILD_ENV_JSON: JSON.stringify(validPreviewConfig),
    NEXT_PUBLIC_API_URL: 'https://legacy-api.preview.test',
    NEXT_PUBLIC_MANAGE_URL: 'https://legacy-manage.preview.test',
    TURBO_FORCE: 'false',
  })

  const result = runHelper(workspace, env, environmentArguments())
  assert.equal(result.status, 0, result.stderr)
  const childEnv = JSON.parse(result.stdout)

  for (const [key, value] of Object.entries(validPreviewConfig)) {
    assert.equal(childEnv[key], value, key)
  }
  assert.equal(childEnv.KLICKER_PREVIEW_BUILD_ENV_JSON, null)
  assert.equal(childEnv.TURBO_FORCE, 'true')
  assert.deepEqual(readdirSync(workspace), [])
})

test('endpoint and image paths survive validation for every app', () => {
  for (const app of [
    'auth',
    'chat',
    'frontend-control',
    'frontend-manage',
    'frontend-pwa',
  ]) {
    const result = parsePreviewBuildEnv(JSON.stringify(validPreviewConfig), app)
    assert.deepEqual({ ...result }, validPreviewConfig)
  }
})

test('each required binding must be supplied by preview config', () => {
  for (const [app, key] of [
    ['auth', 'NEXTAUTH_URL'],
    ['chat', 'NEXT_PUBLIC_PWA_URL'],
    ['frontend-control', 'NEXT_PUBLIC_CONTROL_URL'],
    ['frontend-manage', 'NEXT_PUBLIC_API_URL'],
    ['frontend-pwa', 'NEXT_PUBLIC_ADD_RESPONSE_URL'],
  ]) {
    const partialConfig = { ...validPreviewConfig }
    delete partialConfig[key]
    assert.throws(
      () =>
        prepareChildEnvironment(
          {
            ...validPreviewConfig,
            KLICKER_PREVIEW_BUILD_ENV_JSON: JSON.stringify(partialConfig),
          },
          app
        ),
      PreviewBuildEnvError
    )
  }
})

test('app URLs remain origins and only classified SSR endpoints allow HTTP', () => {
  const originKeys = [
    'NEXTAUTH_URL',
    'NEXT_PUBLIC_ASSESSMENT_URL',
    'NEXT_PUBLIC_AUTH_URL',
    'NEXT_PUBLIC_CHAT_URL',
    'NEXT_PUBLIC_CONTROL_URL',
    'NEXT_PUBLIC_LTI_URL',
    'NEXT_PUBLIC_MANAGE_URL',
    'NEXT_PUBLIC_PWA_URL',
  ]
  const publicEndpointKeys = [
    'BLOB_STORAGE_ACCOUNT_URL',
    'NEXT_PUBLIC_ADD_RESPONSE_URL',
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_ASSESSMENT_API_URL',
    'NEXT_PUBLIC_AVATAR_BASE_PATH',
    'NEXT_PUBLIC_GROWTHBOOK_API_HOST',
    'NEXT_PUBLIC_MATOMO_URL',
  ]
  const internalKeys = ['API_URL_SSR', 'NEXT_PUBLIC_API_URL_SSR']
  const parseValue = (key, value) =>
    parsePreviewBuildEnv(
      JSON.stringify({ ...validPreviewConfig, [key]: value }),
      'frontend-pwa'
    )

  for (const key of originKeys) {
    assert.throws(
      () => parseValue(key, 'https://service.preview.test/not-an-origin'),
      PreviewBuildEnvError
    )
  }
  for (const key of [...originKeys, ...publicEndpointKeys]) {
    assert.throws(
      () => parseValue(key, 'http://service.preview.test/api/graphql'),
      PreviewBuildEnvError
    )
  }
  for (const key of internalKeys) {
    for (const value of [
      'http://api:7078/api/graphql',
      'https://api.preview.test/api/graphql',
    ]) {
      assert.equal(parseValue(key, value)[key], value)
    }
  }
  for (const key of [...originKeys, ...publicEndpointKeys, ...internalKeys]) {
    for (const value of [
      'https://service.preview.test/api/graphql?token=synthetic-test',
      'https://service.preview.test/api/graphql#fragment',
      'https://user:synthetic-test@service.preview.test/api/graphql',
      'https://@service.preview.test/',
      'https://bad_host.preview.test/',
      'https://service.preview.test/?',
      'ftp://service.preview.test/',
      'https://service.preview.test/\n',
    ]) {
      assert.throws(() => parseValue(key, value), PreviewBuildEnvError)
    }
  }
})

test('telemetry can be explicitly disabled without falling back to existing values', () => {
  const disabled = {
    NEXT_PUBLIC_GROWTHBOOK_API_HOST: '',
    NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY: '',
    NEXT_PUBLIC_MATOMO_ID: '',
    NEXT_PUBLIC_MATOMO_SITE_ID: '',
    NEXT_PUBLIC_MATOMO_URL: '',
    NEXT_TELEMETRY_DISABLED: '1',
  }
  const result = prepareChildEnvironment(
    {
      ...validPreviewConfig,
      KLICKER_PREVIEW_BUILD_ENV_JSON: JSON.stringify({
        ...validPreviewConfig,
        ...disabled,
      }),
    },
    'frontend-manage'
  )

  for (const [key, value] of Object.entries(disabled)) {
    assert.equal(result[key], value)
  }
  assert.throws(
    () =>
      parsePreviewBuildEnv(
        JSON.stringify({ ...validPreviewConfig, NEXT_PUBLIC_API_URL: '' }),
        'frontend-manage'
      ),
    PreviewBuildEnvError
  )
})

test('invalid or partial preview config fails before the build without leaking values', (t) => {
  const workspace = createWorkspace(t)
  const secretValue = 'synthetic-value-that-must-not-leak'
  const cases = [
    {
      input: JSON.stringify({
        NEXT_PUBLIC_MANAGE_URL: 'https://manage.preview.test',
      }),
    },
    {
      input: JSON.stringify({
        ...validPreviewConfig,
        OPENROUTER_API_KEY: secretValue,
      }),
    },
    {
      input: `{"__proto__":"${secretValue}"}`,
    },
    {
      input: JSON.stringify({
        ...validPreviewConfig,
        NEXT_PUBLIC_PWA_URL: 'http://pwa.preview.test',
      }),
    },
    {
      input: JSON.stringify({
        ...validPreviewConfig,
        NEXT_PUBLIC_API_URL: `https://user:${secretValue}@api.preview.test`,
      }),
    },
    {
      input: JSON.stringify({
        ...validPreviewConfig,
        NEXT_PUBLIC_AUTH_URL: 'https://bad_host.preview.test',
      }),
    },
    { input: `{"NEXT_PUBLIC_API_URL":"${secretValue}"` },
    { input: JSON.stringify([secretValue]) },
    { input: JSON.stringify(null) },
    { input: JSON.stringify({ ...validPreviewConfig, API_DOMAIN: 123 }) },
    {
      input: JSON.stringify({
        ...validPreviewConfig,
        NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY: `${secretValue}\n`,
      }),
    },
  ]

  for (const { input } of cases) {
    const env = createEnvironment({ KLICKER_PREVIEW_BUILD_ENV_JSON: input })
    const result = runHelper(workspace, env, environmentArguments())
    assert.equal(result.status, 1, result.stderr)
    assert.notEqual(result.stderr, '')
    assert.doesNotMatch(result.stderr, new RegExp(secretValue))
    assert.equal(result.stdout, '')
    assert.deepEqual(readdirSync(workspace), [])
  }
})

test('child exit status is preserved', (t) => {
  const workspace = createWorkspace(t)
  const env = createEnvironment({
    KLICKER_PREVIEW_BUILD_ENV_JSON: JSON.stringify(validPreviewConfig),
  })
  const result = runHelper(workspace, env, [
    '--app',
    'frontend-manage',
    '--',
    process.execPath,
    '-e',
    'process.exit(23)',
  ])

  assert.equal(result.status, 23)
  assert.deepEqual(readdirSync(workspace), [])
})

test('help exits without starting the build command', (t) => {
  const workspace = createWorkspace(t)
  const env = createEnvironment({ KLICKER_PREVIEW_BUILD_ENV_JSON: 'invalid' })
  const result = runHelper(workspace, env, [
    '--help',
    '--',
    process.execPath,
    '-e',
    `require('node:fs').writeFileSync('build-ran', 'unexpected')`,
  ])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /Usage: node util\/preview-build-env\.mjs/)
  assert.deepEqual(readdirSync(workspace), [])
})
