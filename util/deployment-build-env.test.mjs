import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  DeploymentBuildEnvError,
  parseDeploymentBuildEnv,
  prepareChildEnvironment,
  requiredDeploymentKeys,
} from './deployment-build-env.mjs'

const helperPath = fileURLToPath(
  new URL('./deployment-build-env.mjs', import.meta.url)
)

const printEnvironmentFixture = `
const keys = process.env.PRINT_KEYS.split(',')
process.stdout.write(JSON.stringify(Object.fromEntries(
  keys.map((key) => [key, process.env[key] ?? null]),
)))
`

const validPreviewConfig = {
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

function createEnvironment(overrides = {}) {
  return {
    PATH: process.env.PATH,
    PRINT_KEYS: [
      ...Object.keys(validPreviewConfig),
      'KLICKER_DEPLOYMENT_BUILD_ENV_JSON',
      'TURBO_FORCE',
    ].join(','),
    ...overrides,
  }
}

function createWorkspace(context) {
  const workspace = mkdtempSync(join(tmpdir(), 'klicker-deployment-build-env-'))
  context.after(() => rmSync(workspace, { force: true, recursive: true }))
  return realpathSync(workspace)
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
    'KLICKER_DEPLOYMENT_BUILD_ENV_JSON',
    'TURBO_FORCE',
  ]
  const baseEnv = createEnvironment({
    ...emptyBindings,
    PRINT_KEYS: keys.join(','),
  })

  for (const input of [undefined, '', '   ']) {
    const env = { ...baseEnv }
    if (input === undefined) delete env.KLICKER_DEPLOYMENT_BUILD_ENV_JSON
    else env.KLICKER_DEPLOYMENT_BUILD_ENV_JSON = input

    const result = runHelper(workspace, env, environmentArguments())
    assert.equal(result.status, 0, result.stderr)
    const childEnv = JSON.parse(result.stdout)
    assert.equal(childEnv.NEXT_PUBLIC_API_URL, '')
    assert.equal(childEnv.NEXT_PUBLIC_MANAGE_URL, '')
    assert.equal(childEnv.KLICKER_DEPLOYMENT_BUILD_ENV_JSON, null)
    assert.equal(childEnv.TURBO_FORCE, null)
    assert.deepEqual(readdirSync(workspace), [])
  }

  for (const input of [undefined, '', '   ']) {
    const env = {
      ...baseEnv,
      NEXT_PUBLIC_GROWTHBOOK_API_HOST: 'https://production-growthbook.test',
      NEXT_PUBLIC_MATOMO_URL: 'https://production-matomo.test',
      NEXT_TELEMETRY_DISABLED: '0',
    }
    if (input === undefined) delete env.KLICKER_DEPLOYMENT_BUILD_ENV_JSON
    else env.KLICKER_DEPLOYMENT_BUILD_ENV_JSON = input

    assert.deepEqual(
      prepareChildEnvironment(env, 'frontend-manage'),
      Object.fromEntries(
        Object.entries(env).filter(
          ([key]) => key !== 'KLICKER_DEPLOYMENT_BUILD_ENV_JSON'
        )
      )
    )
  }
})

test('valid preview bindings override existing values without changing files', (t) => {
  const workspace = createWorkspace(t)
  const env = createEnvironment({
    KLICKER_DEPLOYMENT_BUILD_ENV_JSON: JSON.stringify(validPreviewConfig),
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
  assert.equal(childEnv.KLICKER_DEPLOYMENT_BUILD_ENV_JSON, null)
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
    const result = parseDeploymentBuildEnv(
      JSON.stringify(validPreviewConfig),
      app
    )
    assert.deepEqual({ ...result }, validPreviewConfig)
  }
})

test('each required binding must be supplied by preview config', () => {
  for (const [app, key] of [
    ['auth', 'NEXTAUTH_URL'],
    ['auth', 'APP_ORIGIN_API'],
    ['chat', 'NEXT_PUBLIC_MANAGE_URL'],
    ['frontend-control', 'NEXT_PUBLIC_CONTROL_URL'],
    ['frontend-manage', 'NEXT_PUBLIC_API_URL'],
    ['frontend-manage', 'NEXT_PUBLIC_CHAT_URL'],
    ['frontend-pwa', 'NEXT_PUBLIC_ADD_RESPONSE_URL'],
  ]) {
    const partialConfig = { ...validPreviewConfig }
    delete partialConfig[key]
    assert.throws(
      () =>
        prepareChildEnvironment(
          {
            ...validPreviewConfig,
            KLICKER_DEPLOYMENT_BUILD_ENV_JSON: JSON.stringify(partialConfig),
          },
          app
        ),
      DeploymentBuildEnvError
    )
  }
})

test('newly required preview bindings cannot fall back to production values', () => {
  for (const [app, key] of [
    ['auth', 'EDUID_CLIENT_ID'],
    ['chat', 'NEXT_PUBLIC_AVATAR_BASE_PATH'],
    ['frontend-control', 'API_URL_SSR'],
    ['frontend-manage', 'NEXT_PUBLIC_LTI_URL'],
    ['frontend-pwa', 'NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY'],
  ]) {
    const partialConfig = { ...validPreviewConfig }
    delete partialConfig[key]

    assert.throws(
      () =>
        prepareChildEnvironment(
          {
            ...partialConfig,
            [key]: 'existing-production-environment-value',
            KLICKER_DEPLOYMENT_BUILD_ENV_JSON: JSON.stringify(partialConfig),
          },
          app
        ),
      (error) =>
        error instanceof DeploymentBuildEnvError && error.message.includes(key)
    )
  }
})

test('harmless preview defaults replace unbound optional configuration', () => {
  const config = { ...validPreviewConfig }
  for (const key of [
    'NEXT_PUBLIC_GROWTHBOOK_API_HOST',
    'NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY',
    'NEXT_PUBLIC_IS_ASSESSMENT',
    'NEXT_PUBLIC_MATOMO_ID',
    'NEXT_PUBLIC_MATOMO_SITE_ID',
    'NEXT_PUBLIC_MATOMO_URL',
    'NEXT_PUBLIC_WITH_MAGIC_LINK',
    'NEXT_TELEMETRY_DISABLED',
  ]) {
    delete config[key]
  }

  const childEnv = prepareChildEnvironment(
    {
      ...config,
      NEXT_PUBLIC_GROWTHBOOK_API_HOST: 'https://production-growthbook.test',
      NEXT_PUBLIC_IS_ASSESSMENT: 'true',
      NEXT_PUBLIC_MATOMO_URL: 'https://production-matomo.test',
      NEXT_PUBLIC_WITH_MAGIC_LINK: 'true',
      NEXT_TELEMETRY_DISABLED: '0',
      KLICKER_DEPLOYMENT_BUILD_ENV_JSON: JSON.stringify(config),
    },
    'frontend-pwa'
  )

  for (const key of [
    'NEXT_PUBLIC_GROWTHBOOK_API_HOST',
    'NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY',
    'NEXT_PUBLIC_MATOMO_ID',
    'NEXT_PUBLIC_MATOMO_SITE_ID',
    'NEXT_PUBLIC_MATOMO_URL',
  ]) {
    assert.equal(childEnv[key], '', key)
  }
  assert.equal(childEnv.NEXT_PUBLIC_IS_ASSESSMENT, 'false')
  assert.equal(childEnv.NEXT_PUBLIC_WITH_MAGIC_LINK, 'false')
  assert.equal(childEnv.NEXT_TELEMETRY_DISABLED, '1')
})

test('app URLs remain origins and only classified SSR endpoints allow HTTP', () => {
  const originKeys = [
    'APP_ORIGIN_API',
    'APP_ORIGIN_ASSESSMENT_API',
    'APP_ORIGIN_ASSESSMENT_PWA',
    'APP_ORIGIN_AUTH',
    'APP_ORIGIN_CHAT',
    'APP_ORIGIN_CONTROL',
    'APP_ORIGIN_LTI',
    'APP_ORIGIN_MANAGE',
    'APP_ORIGIN_PWA',
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
    'NEXT_PUBLIC_IMAGE_BASE_PATH',
    'NEXT_PUBLIC_GROWTHBOOK_API_HOST',
    'NEXT_PUBLIC_MATOMO_URL',
  ]
  const endpointKeys = ['EDUID_WELL_KNOWN']
  const internalKeys = ['API_URL_SSR', 'NEXT_PUBLIC_API_URL_SSR']
  const parseValue = (key, value) =>
    parseDeploymentBuildEnv(
      JSON.stringify({ ...validPreviewConfig, [key]: value }),
      'frontend-pwa'
    )

  for (const key of originKeys) {
    assert.throws(
      () => parseValue(key, 'https://service.preview.test/not-an-origin'),
      DeploymentBuildEnvError
    )
  }
  for (const key of [...originKeys, ...publicEndpointKeys, ...endpointKeys]) {
    assert.throws(
      () => parseValue(key, 'http://service.preview.test/api/graphql'),
      DeploymentBuildEnvError
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
  for (const key of [
    ...originKeys,
    ...publicEndpointKeys,
    ...endpointKeys,
    ...internalKeys,
  ]) {
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
      assert.throws(() => parseValue(key, value), DeploymentBuildEnvError)
    }
  }
})

test('auth host lists accept trimmed host and host-port authorities', () => {
  const authHosts = {
    AUTH_LECTURER_ALLOWED_HOSTS:
      ' auth.preview.test , manage.preview.test:8443 ',
    AUTH_PWA_HOSTS: '127.0.0.1:3001, pwa.preview.test',
    AUTH_STUDENT_ALLOWED_HOSTS: 'assessment.preview.test,127.0.0.1:3001',
  }

  const result = parseDeploymentBuildEnv(
    JSON.stringify({ ...validPreviewConfig, ...authHosts }),
    'auth'
  )

  for (const [key, value] of Object.entries(authHosts)) {
    assert.equal(result[key], value)
  }
})

test('auth host lists reject malformed authorities', () => {
  for (const key of [
    'AUTH_LECTURER_ALLOWED_HOSTS',
    'AUTH_PWA_HOSTS',
    'AUTH_STUDENT_ALLOWED_HOSTS',
  ]) {
    for (const value of [
      'auth.preview.test,,manage.preview.test',
      'https://auth.preview.test',
      '*.preview.test',
      'auth.preview.test:65536',
      'auth.preview.test:invalid',
      'auth.preview.test:',
      'auth.preview.test/path',
      'auth.preview.test?query=synthetic',
      'user@auth.preview.test',
    ]) {
      assert.throws(
        () =>
          parseDeploymentBuildEnv(
            JSON.stringify({ ...validPreviewConfig, [key]: value }),
            'auth'
          ),
        DeploymentBuildEnvError
      )
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
      KLICKER_DEPLOYMENT_BUILD_ENV_JSON: JSON.stringify({
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
      parseDeploymentBuildEnv(
        JSON.stringify({ ...validPreviewConfig, NEXT_PUBLIC_API_URL: '' }),
        'frontend-manage'
      ),
    DeploymentBuildEnvError
  )
})

test('public boolean settings accept only explicit boolean values', () => {
  for (const key of [
    'NEXT_PUBLIC_IS_ASSESSMENT',
    'NEXT_PUBLIC_WITH_MAGIC_LINK',
  ]) {
    for (const value of ['true', 'false']) {
      assert.equal(
        parseDeploymentBuildEnv(
          JSON.stringify({ ...validPreviewConfig, [key]: value }),
          'frontend-pwa'
        )[key],
        value
      )
    }
    for (const value of ['', '1', 'yes']) {
      assert.throws(
        () =>
          parseDeploymentBuildEnv(
            JSON.stringify({ ...validPreviewConfig, [key]: value }),
            'frontend-pwa'
          ),
        DeploymentBuildEnvError
      )
    }
  }
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
      input: JSON.stringify({
        ...validPreviewConfig,
        APP_SECRET: secretValue,
      }),
    },
    {
      input: JSON.stringify({
        ...validPreviewConfig,
        EDUID_CLIENT_SECRET: secretValue,
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
    const env = createEnvironment({ KLICKER_DEPLOYMENT_BUILD_ENV_JSON: input })
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
    KLICKER_DEPLOYMENT_BUILD_ENV_JSON: JSON.stringify(validPreviewConfig),
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
  const env = createEnvironment({
    KLICKER_DEPLOYMENT_BUILD_ENV_JSON: 'invalid',
  })
  const result = runHelper(workspace, env, [
    '--help',
    '--',
    process.execPath,
    '-e',
    `require('node:fs').writeFileSync('build-ran', 'unexpected')`,
  ])

  assert.equal(result.status, 0)
  assert.deepEqual(readdirSync(workspace), [])
})

test('deployment declarations determine required bindings without reading values', () => {
  const required = requiredDeploymentKeys(
    'chat',
    [
      '# deployment keys',
      'NEXT_PUBLIC_CHAT_URL=unused',
      'export NEXT_PUBLIC_PWA_URL="unused"',
      'NEXT_PUBLIC_GROWTHBOOK_API_HOST=unused',
      '',
    ].join('\n')
  )
  assert.ok(required.includes('NEXT_PUBLIC_CHAT_URL'))
  assert.ok(required.includes('NEXT_PUBLIC_PWA_URL'))
  assert.ok(required.includes('BLOB_STORAGE_ACCOUNT_URL'))
  assert.ok(!required.includes('NEXT_PUBLIC_GROWTHBOOK_API_HOST'))
  for (const declaration of [
    'NEW_UNSUPPORTED_KEY=unused',
    'malformed declaration',
  ]) {
    assert.throws(
      () => requiredDeploymentKeys('chat', declaration),
      DeploymentBuildEnvError
    )
  }
})

test('every declared required binding must override the environment', () => {
  for (const app of [
    'auth',
    'chat',
    'frontend-control',
    'frontend-manage',
    'frontend-pwa',
  ]) {
    for (const key of requiredDeploymentKeys(app)) {
      const partial = { ...validPreviewConfig }
      delete partial[key]
      assert.throws(
        () =>
          prepareChildEnvironment(
            {
              ...validPreviewConfig,
              KLICKER_DEPLOYMENT_BUILD_ENV_JSON: JSON.stringify(partial),
            },
            app
          ),
        DeploymentBuildEnvError
      )
    }
  }
})

test('legacy build envelopes fail before a child can use deployment defaults', (t) => {
  const workspace = createWorkspace(t)
  const result = runHelper(
    workspace,
    createEnvironment({
      KLICKER_PREVIEW_BUILD_ENV_JSON: JSON.stringify(validPreviewConfig),
    }),
    environmentArguments()
  )
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.deepEqual(readdirSync(workspace), [])
})

test('active bindings require the defaults file but ordinary builds do not', (t) => {
  const workspace = createWorkspace(t)
  const copiedHelper = join(workspace, 'deployment-build-env.mjs')
  copyFileSync(helperPath, copiedHelper)
  const invoke = (env) =>
    spawnSync(process.execPath, [copiedHelper, ...environmentArguments()], {
      cwd: workspace,
      env: createEnvironment(env),
      encoding: 'utf8',
      timeout: 10_000,
    })
  const missing = invoke({
    KLICKER_DEPLOYMENT_BUILD_ENV_JSON: JSON.stringify(validPreviewConfig),
  })
  assert.equal(missing.status, 1)
  assert.equal(missing.stdout, '')
  assert.equal(invoke({}).status, 0)
})
