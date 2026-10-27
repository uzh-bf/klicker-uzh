import assert from 'node:assert/strict'
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
} from 'node:crypto'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'

import {
  isPrivateAddress,
  privateMcpEndpoint,
  runtimeEnvironment,
  supervise,
} from './runtime.mjs'

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
})
const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' })
const publicPem = publicKey.export({ format: 'pem', type: 'spki' })
const privatePemEncoded = Buffer.from(privatePem).toString('base64')
const publicPemEncoded = Buffer.from(publicPem).toString('base64')
const azuriteAccountKey = randomBytes(32).toString('hex')

const privateResolver = async () => ({
  address: '10.24.0.8',
  family: 4,
})

test('isPrivateAddress accepts RFC1918 IPv4 ranges only', () => {
  const privateAddresses = [
    '10.0.0.0',
    '10.255.255.255',
    '172.16.0.0',
    '172.31.255.255',
    '192.168.0.0',
    '192.168.255.255',
  ]
  const refusedAddresses = [
    '9.255.255.255',
    '11.0.0.0',
    '172.15.255.255',
    '172.32.0.0',
    '192.167.255.255',
    '192.169.0.0',
    '8.8.8.8',
    '127.0.0.1',
    '::1',
  ]

  for (const address of privateAddresses) {
    assert.equal(isPrivateAddress(address), true)
  }
  for (const address of refusedAddresses) {
    assert.equal(isPrivateAddress(address), false)
  }
})

test('privateMcpEndpoint maps a hostname to its private IPv4 address', async () => {
  const calls = []
  const endpoint = await privateMcpEndpoint(
    { KLICKER_PREVIEW_MCP_HOST: 'mcp.preview.internal' },
    async (host, options) => {
      calls.push({ host, options })
      return { address: '172.20.4.9', family: 4 }
    }
  )

  assert.equal(endpoint.href, 'http://172.20.4.9:1417/mcp')
  assert.deepEqual(calls, [
    {
      host: 'mcp.preview.internal',
      options: { family: 4 },
    },
  ])
})

test('privateMcpEndpoint refuses public and loopback resolutions', async () => {
  for (const address of ['8.8.8.8', '127.0.0.1']) {
    await assert.rejects(
      privateMcpEndpoint(
        { KLICKER_PREVIEW_MCP_HOST: 'mcp.preview.internal' },
        async () => ({ address, family: 4 })
      ),
      Error
    )
  }
})

test('chat decodes the private PKCS8 signer', async () => {
  const env = await runtimeEnvironment('chat', {
    KLICKER_PREVIEW_SCOPE_PRIVATE_KEY: privatePemEncoded,
  })

  assert.equal(env.DOC_QUERY_SCOPE_PRIVATE_KEY, privatePem)
  assert.equal(env.KLICKER_PREVIEW_SCOPE_PRIVATE_KEY, undefined)

  const decodedSigner = createPrivateKey(env.DOC_QUERY_SCOPE_PRIVATE_KEY)
  assert.equal(decodedSigner.asymmetricKeyType, 'ec')

  const message = Buffer.from('synthetic preview key check')
  const signature = sign('sha256', message, decodedSigner)
  assert.equal(verify('sha256', message, publicKey, signature), true)
})

test('mcp decodes only the matching public SPKI verifier key', async () => {
  const env = await runtimeEnvironment(
    'mcp',
    {
      KLICKER_PREVIEW_MCP_HOST: 'mcp.preview.internal',
      KLICKER_PREVIEW_SCOPE_PUBLIC_KEY: publicPemEncoded,
    },
    privateResolver
  )

  assert.equal(env.LOCAL_MCP_PUBLIC_KEY, publicPem)
  assert.equal(env.KLICKER_PREVIEW_SCOPE_PRIVATE_KEY, undefined)
  assert.equal(env.DOC_QUERY_SCOPE_PRIVATE_KEY, undefined)
  assert.equal(
    env.LOCAL_MCP_FIXTURE_FILE,
    '/app/deploy/preview/mcp-fixture.json'
  )
  assert.equal(env.KLICKER_PREVIEW_SCOPE_PUBLIC_KEY, undefined)
  assert.equal(env.LOCAL_MCP_BIND_HOST, '0.0.0.0')
  assert.equal(
    env.LOCAL_MCP_ALLOWED_HOSTS,
    'mcp.preview.internal:1417,10.24.0.8:1417'
  )

  const decodedVerifier = createPublicKey(env.LOCAL_MCP_PUBLIC_KEY)
  assert.equal(decodedVerifier.asymmetricKeyType, 'ec')
})

test('mcp refuses to start when the private signer is present', async () => {
  let resolverCalled = false

  await assert.rejects(
    runtimeEnvironment(
      'mcp',
      {
        KLICKER_PREVIEW_MCP_HOST: 'mcp.preview.internal',
        KLICKER_PREVIEW_SCOPE_PRIVATE_KEY: privatePemEncoded,
        KLICKER_PREVIEW_SCOPE_PUBLIC_KEY: publicPemEncoded,
      },
      async () => {
        resolverCalled = true
        return { address: '10.24.0.8', family: 4 }
      }
    ),
    Error
  )

  assert.equal(resolverCalled, false)
})

test('mcp refuses another fixture path', async () => {
  await assert.rejects(
    runtimeEnvironment(
      'mcp',
      {
        KLICKER_PREVIEW_MCP_HOST: 'mcp.private',
        KLICKER_PREVIEW_SCOPE_PUBLIC_KEY: publicPemEncoded,
        LOCAL_MCP_FIXTURE_FILE: '/tmp/foreign.json',
      },
      privateResolver
    )
  )
})

test('runtimeEnvironment leaves the caller environment unchanged', async () => {
  const cases = [
    [
      'chat',
      Object.freeze({
        KLICKER_PREVIEW_SCOPE_PRIVATE_KEY: privatePemEncoded,
      }),
    ],
    [
      'mcp',
      Object.freeze({
        KLICKER_PREVIEW_MCP_HOST: 'mcp.preview.internal',
        KLICKER_PREVIEW_SCOPE_PUBLIC_KEY: publicPemEncoded,
      }),
    ],
    [
      'azurite',
      Object.freeze({
        AZURITE_ACCOUNT_KEY: azuriteAccountKey,
        AZURITE_ACCOUNT_NAME: 'klickerdev',
      }),
    ],
  ]

  for (const [mode, supplied] of cases) {
    const before = { ...supplied }
    await runtimeEnvironment(mode, supplied, privateResolver)
    assert.deepEqual(supplied, before)
  }
})

test('runtimeEnvironment refuses unsupported modes and malformed keys', async () => {
  await assert.rejects(runtimeEnvironment('worker', Object.freeze({})), Error)

  const notPem = Buffer.from('not a PEM key').toString('base64')
  await assert.rejects(
    runtimeEnvironment('chat', {
      KLICKER_PREVIEW_SCOPE_PRIVATE_KEY: notPem,
    }),
    Error
  )
  await assert.rejects(
    runtimeEnvironment(
      'mcp',
      {
        KLICKER_PREVIEW_MCP_HOST: 'mcp.preview.internal',
        KLICKER_PREVIEW_SCOPE_PUBLIC_KEY: privatePemEncoded,
      },
      privateResolver
    ),
    Error
  )
})

test('runtimeEnvironment composes the Azurite account from 64 hex digits', async () => {
  const env = await runtimeEnvironment('azurite', {
    AZURITE_ACCOUNT_KEY: azuriteAccountKey,
    AZURITE_ACCOUNT_NAME: 'klickerdev',
  })

  assert.equal(env.AZURITE_ACCOUNTS, `klickerdev:${azuriteAccountKey}`)
  assert.equal(env.AZURITE_ACCOUNT_KEY, undefined)
  assert.equal(env.AZURITE_ACCOUNT_NAME, undefined)

  await assert.rejects(
    runtimeEnvironment('azurite', {
      AZURITE_ACCOUNT_KEY: azuriteAccountKey.slice(1),
      AZURITE_ACCOUNT_NAME: 'klickerdev',
    }),
    Error
  )
})

function createSupervisorHarness() {
  const signals = new EventEmitter()
  const child = new EventEmitter()
  const kills = []
  const baseline = {
    SIGINT: () => {},
    SIGTERM: () => {},
  }

  child.kill = (signal) => {
    kills.push(signal)
    return true
  }
  signals.on('SIGINT', baseline.SIGINT)
  signals.on('SIGTERM', baseline.SIGTERM)

  return {
    child,
    kills,
    signals,
    baselineCounts: {
      SIGINT: signals.listenerCount('SIGINT'),
      SIGTERM: signals.listenerCount('SIGTERM'),
    },
  }
}

function assertSupervisorCleanup(harness) {
  assert.equal(
    harness.signals.listenerCount('SIGINT'),
    harness.baselineCounts.SIGINT
  )
  assert.equal(
    harness.signals.listenerCount('SIGTERM'),
    harness.baselineCounts.SIGTERM
  )
}

test('supervise forwards termination and interrupt signals', async () => {
  const termination = createSupervisorHarness()
  const terminationRun = supervise(termination.child, termination.signals)

  assert.equal(
    termination.signals.listenerCount('SIGTERM'),
    termination.baselineCounts.SIGTERM + 1
  )
  termination.signals.emit('SIGTERM')
  assert.deepEqual(termination.kills, ['SIGTERM'])
  termination.child.emit('exit', 23, null)
  assert.equal(await terminationRun, 23)
  assertSupervisorCleanup(termination)

  const interruption = createSupervisorHarness()
  const interruptionRun = supervise(interruption.child, interruption.signals)

  interruption.signals.emit('SIGINT')
  assert.deepEqual(interruption.kills, ['SIGINT'])
  interruption.child.emit('exit', null, 'SIGINT')
  assert.equal(await interruptionRun, 130)
  assertSupervisorCleanup(interruption)
})

test('supervise reports child signal exits and cleanup after termination', async () => {
  const harness = createSupervisorHarness()
  const run = supervise(harness.child, harness.signals)

  harness.child.emit('exit', null, 'SIGTERM')
  assert.equal(await run, 143)
  assertSupervisorCleanup(harness)
})

test('supervise rejects child startup errors and detaches listeners', async () => {
  const harness = createSupervisorHarness()
  const run = supervise(harness.child, harness.signals)

  harness.child.emit('error', new Error('synthetic child error'))
  await assert.rejects(run, Error)
  assertSupervisorCleanup(harness)
})
