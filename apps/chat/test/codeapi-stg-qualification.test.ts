import { spawn } from 'node:child_process'
import { createServer, type RequestListener } from 'node:http'
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { request } from 'node:https'
import { generateKeyPairSync, randomUUID, verify } from 'node:crypto'
import { afterEach, describe, expect, test } from 'vitest'
import { certificate } from '../scripts/codeapi-browser-fixture.mjs'
import {
  buildQualificationTrust,
  qualificationProgram,
  startQualificationRelay,
  startQualificationFixture,
  registerQualification,
  startManagedQualification,
  readQualificationBootstrap,
  admitQualificationVerifier,
  cleanupQualificationVerifier,
  probeLegacyCompatibility,
} from '../scripts/codeapi-stg-qualification.mjs'

const cleanups: Array<() => Promise<unknown>> = []
afterEach(async () => {
  for (const fn of cleanups.splice(0).reverse()) await fn()
})
const tls = certificate('host.docker.internal')
const body = (scenario = 'success', nonce = randomUUID()) => ({
  code: qualificationProgram(scenario, nonce),
  lang: 'python',
  files: [],
  timeout: 5000,
})
async function setup(handler: RequestListener) {
  const backend = createServer(handler)
  await new Promise<void>((resolve) => backend.listen(0, '127.0.0.1', resolve))
  cleanups.push(async () => {
    backend.closeAllConnections()
    await new Promise<void>((r) => backend.close(() => r()))
  })
  const address = backend.address()
  if (!address || typeof address === 'string')
    throw new Error('Synthetic backend missing address')
  const relay = await startQualificationRelay({
    upstreamOrigin: `http://127.0.0.1:${address.port}`,
    tls,
  })
  cleanups.push(relay.close)
  return relay
}
function post(
  origin: string,
  value: unknown,
  options: { path?: string; auth?: string; ca?: string | Buffer } = {}
) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const req = request(
      `${origin}${options.path ?? '/v1/exec'}`,
      {
        method: 'POST',
        ca: options.ca ?? tls.cert,
        headers: {
          authorization: options.auth ?? 'Bearer synthetic.jwt.value',
          'content-type': 'application/json',
          'x-codeapi-expected-profile': 'default',
        },
      },
      (res) => {
        let text = ''
        res.on('data', (chunk) => (text += chunk))
        res.on('end', () => resolve({ status: res.statusCode!, text }))
      }
    )
    req.on('error', reject)
    req.end(JSON.stringify(value))
  })
}
describe('bounded real-transport qualification', () => {
  test('requires matching one-time public registration and explicit arming', async () => {
    let received = 0
    const backend = createServer((_req, res) => {
      received++
      res.end('{}')
    })
    await new Promise<void>((resolve) =>
      backend.listen(0, '127.0.0.1', resolve)
    )
    cleanups.push(async () => {
      backend.closeAllConnections()
      await new Promise<void>((resolve) => backend.close(() => resolve()))
    })
    const address = backend.address() as { port: number }
    const generation = randomUUID()
    const relay = await startQualificationRelay({
      upstreamOrigin: `http://127.0.0.1:${address.port}`,
      tls,
      generation,
      requireRegistration: true,
      maxAttempts: 2,
    })
    cleanups.push(relay.close)
    expect((await post(relay.origin, body())).status).toBe(503)
    expect(() => relay.arm()).toThrow('qualification_arm_invalid')
    const publicJwk = {
      ...generateKeyPairSync('ed25519').publicKey.export({ format: 'jwk' }),
      kid: `qualification-${randomUUID()}`,
      alg: 'EdDSA',
    }
    await expect(
      registerQualification({
        origin: relay.origin,
        ca: tls.cert,
        generation: randomUUID(),
        publicJwk,
      })
    ).rejects.toThrow('qualification_registration_failed')
    await registerQualification({
      origin: relay.origin,
      ca: tls.cert,
      generation,
      publicJwk,
    })
    expect(await relay.registration).toMatchObject({ generation, publicJwk })
    await expect(
      registerQualification({
        origin: relay.origin,
        ca: tls.cert,
        generation,
        publicJwk,
      })
    ).rejects.toThrow('qualification_registration_failed')
    expect((await post(relay.origin, body())).status).toBe(503)
    relay.arm()
    expect((await post(relay.origin, body())).status).toBe(200)
    expect((await post(relay.origin, body())).status).toBe(200)
    expect((await post(relay.origin, body())).status).toBe(429)
    expect(received).toBe(2)
    expect(relay.snapshot()).toMatchObject({
      attempts: 2,
      requestedGuestMs: 10000,
    })
  })

  test('coordinates canonical lifecycle and removes only its own public bootstrap', async () => {
    const parent = await mkdtemp(path.join(tmpdir(), 'qualification-managed-'))
    cleanups.push(() => rm(parent, { recursive: true, force: true }))
    const checkout = path.join(parent, 'chat-codeapi-browser-qualification')
    await mkdir(path.join(checkout, '.devcontainer/.runtime'), {
      recursive: true,
    })
    const calls: string[][] = []
    const managed = await startManagedQualification({
      checkout,
      upstreamOrigin: 'http://127.0.0.1:1',
      runLifecycle: async (args: string[]) => {
        calls.push(args)
        if (args[0] === 'ensure') {
          const bootstrap = await readQualificationBootstrap(checkout)
          expect(bootstrap).not.toHaveProperty('privateKey')
          expect(
            await readFile(
              path.join(
                checkout,
                '.devcontainer/.runtime/codeapi-browser-fixture'
              ),
              'utf8'
            )
          ).toBe('enabled')
          const publicJwk = {
            ...generateKeyPairSync('ed25519').publicKey.export({
              format: 'jwk',
            }),
            kid: `qualification-${randomUUID()}`,
            alg: 'EdDSA',
          }
          await registerQualification({
            origin: bootstrap.relayOrigin.replace(
              'host.docker.internal',
              '127.0.0.1'
            ),
            ca: bootstrap.relayCA,
            generation: bootstrap.generation,
            publicJwk,
          })
        }
      },
    })
    expect(calls.map((x) => x[0])).toEqual(['stop', 'ensure'])
    expect(calls[1]).toEqual([
      'ensure',
      checkout,
      '--profile',
      'chat',
      '--json',
    ])
    await managed.close()
    expect(calls.map((x) => x[0])).toEqual(['stop', 'ensure', 'stop'])
    expect(await readQualificationBootstrap(checkout)).toBeNull()
    await writeFile(
      path.join(checkout, '.devcontainer/.runtime/codeapi-browser-fixture'),
      'disabled'
    )
    await expect(
      startManagedQualification({
        checkout,
        upstreamOrigin: 'http://127.0.0.1:1',
        runLifecycle: async () => {
          throw new Error('must not run')
        },
      })
    ).rejects.toThrow('qualification_marker_conflict')
    expect(
      await readFile(
        path.join(checkout, '.devcontainer/.runtime/codeapi-browser-fixture'),
        'utf8'
      )
    ).toBe('disabled')
  })

  test('rejects expired bootstrap instead of silently starting another attempt', async () => {
    const checkout = await mkdtemp(
      path.join(tmpdir(), 'qualification-expired-')
    )
    cleanups.push(() => rm(checkout, { recursive: true, force: true }))
    await mkdir(path.join(checkout, '.devcontainer/.runtime'), {
      recursive: true,
    })
    await writeFile(
      path.join(
        checkout,
        '.devcontainer/.runtime/codeapi-stg-qualification.json'
      ),
      JSON.stringify({
        generation: randomUUID(),
        relayOrigin: 'https://host.docker.internal:12345',
        relayCA: tls.cert.toString(),
        expiresAt: Date.now() - 1,
      })
    )
    await expect(readQualificationBootstrap(checkout)).rejects.toThrow(
      'qualification_bootstrap_invalid'
    )
  })

  test('create conflicts and ambiguous writes never become updates or inferred ownership', async () => {
    const secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: 'codeapi-klicker-verifier', namespace: 'codeapi' },
      type: 'Opaque',
      data: {},
    }
    const externalSecret = {
      apiVersion: 'external-secrets.io/v1',
      kind: 'ExternalSecret',
      metadata: secret.metadata,
      spec: {
        target: {
          name: secret.metadata.name,
          creationPolicy: 'Owner',
          deletionPolicy: 'Retain',
        },
      },
    }
    for (const second of [409, 403, 'ambiguous', 'malformed']) {
      const writes: string[] = []
      const result = await admitQualificationVerifier({
        secret,
        externalSecret,
        request: async (method: string, object: typeof secret) => {
          writes.push(`${method}:${object.kind}`)
          if (object.kind === 'Secret')
            return {
              status: 201,
              metadata: {
                ...secret.metadata,
                uid: 'owned-secret',
                resourceVersion: '1',
              },
            }
          if (second === 'ambiguous') throw new Error('unknown response')
          if (second === 'malformed') return undefined
          return { status: second }
        },
      })
      expect(writes).toEqual(['POST:Secret', 'POST:ExternalSecret'])
      expect(result.created).toEqual([
        {
          kind: 'Secret',
          metadata: {
            ...secret.metadata,
            uid: 'owned-secret',
            resourceVersion: '1',
          },
        },
      ])
      expect(result.outcome).toBe(
        second === 409 ? 'conflict' : second === 403 ? 'rejected' : 'unknown'
      )
      const deletions: unknown[] = []
      expect(
        await cleanupQualificationVerifier({
          created: result.created,
          request: async (_method: string, object: unknown) => {
            deletions.push(object)
            return { status: 409 }
          },
        })
      ).toEqual({ outcome: 'held' })
      expect(deletions).toHaveLength(1)
      expect(deletions[0]).toMatchObject({
        options: {
          preconditions: { uid: 'owned-secret', resourceVersion: '1' },
        },
      })
    }
    const unknown = await admitQualificationVerifier({
      secret,
      externalSecret,
      request: async () => {
        throw new Error('ambiguous first create')
      },
    })
    expect(unknown).toEqual({ outcome: 'unknown', created: [] })
    expect(
      await cleanupQualificationVerifier({
        created: [],
        request: async () => {
          throw new Error('must not run')
        },
      })
    ).toEqual({ outcome: 'deletion_requested' })
  })

  test('cleanup supplies both identity preconditions and stops on conflict or interruption', async () => {
    const created = ['Secret', 'ExternalSecret'].map((kind) => ({
      kind,
      metadata: {
        name: 'codeapi-klicker-verifier',
        namespace: 'codeapi',
        uid: `owned-${kind}`,
        resourceVersion: '2',
      },
    }))
    let attempts = 0
    expect(
      await cleanupQualificationVerifier({
        created,
        request: async (
          _method: string,
          object: { options: { preconditions: unknown } }
        ) => {
          attempts++
          expect(object.options.preconditions).toEqual({
            uid: 'owned-ExternalSecret',
            resourceVersion: '2',
          })
          return { status: 409 }
        },
      })
    ).toEqual({ outcome: 'held' })
    expect(attempts).toBe(1)
    expect(
      await cleanupQualificationVerifier({
        created,
        request: async () => {
          throw new Error('interrupted')
        },
      })
    ).toEqual({ outcome: 'unknown' })
    expect(
      await cleanupQualificationVerifier({ created, request: async () => null })
    ).toEqual({ outcome: 'unknown' })
  })

  test('reserves attempts before forwarding and does not interpret responses as guest admission', async () => {
    let received = 0
    const relay = await setup((_req, res) => {
      received++
      res.end('{"code":0,"stdout":"synthetic"}')
    })
    const value = body()
    expect((await post(relay.origin, value)).status).toBe(200)
    expect(received).toBe(1)
    expect(relay.snapshot()).toMatchObject({
      attempts: 1,
      requestedGuestMs: 5000,
      observations: [{ outcome: 'response_received', httpStatus: 200 }],
    })
    expect((await post(relay.origin, value)).status).toBe(429)
    expect(
      (
        await post(relay.origin, {
          ...body(),
          code: 'print("unbounded operator program")',
        })
      ).status
    ).toBe(400)
    expect((await post(relay.origin, body(), { path: '/other' })).status).toBe(
      404
    )
    expect(relay.snapshot().attempts).toBe(1)
    expect(JSON.stringify(relay.snapshot())).not.toContain(
      'synthetic.jwt.value'
    )
  })
  test('enforces ten total reservations and has no automatic retry on redirect or failure', async () => {
    const relay = await setup((_req, res) => {
      res.writeHead(302, { location: 'https://invalid.example.test' })
      res.end('{}')
    })
    for (let i = 0; i < 10; i++)
      expect((await post(relay.origin, body())).status).toBe(302)
    expect((await post(relay.origin, body())).status).toBe(429)
    expect(relay.snapshot()).toMatchObject({
      attempts: 10,
      requestedGuestMs: 50000,
    })
  })
  test('observes abort before the guest deadline without claiming remote termination', async () => {
    let admitted: () => void = () => {}
    const received = new Promise<void>((resolve) => (admitted = resolve))
    const relay = await setup(() => admitted())
    const req = request(`${relay.origin}/v1/exec`, {
      method: 'POST',
      ca: tls.cert,
      headers: {
        authorization: 'Bearer synthetic.jwt.value',
        'content-type': 'application/json',
        'x-codeapi-expected-profile': 'default',
      },
    })
    req.on('error', () => {})
    req.end(JSON.stringify(body('stop')))
    await received
    req.destroy()
    await expect
      .poll(() => relay.snapshot().observations[0]?.outcome)
      .toBe('transport_aborted')
    expect(relay.snapshot().observations[0].abortAfterMs).toBeLessThan(5000)
    expect(relay.snapshot().observations[0]).not.toHaveProperty(
      'guestTerminated'
    )
  })
  test('refuses oversized response and arbitrary upstreams', async () => {
    const relay = await setup((_req, res) =>
      res.end('x'.repeat(128 * 1024 + 1))
    )
    expect((await post(relay.origin, body())).status).toBe(502)
    expect(relay.snapshot().observations[0].outcome).toBe(
      'invalid_or_oversized_response'
    )
    for (const origin of [
      'http://example.test',
      'https://example.test/path',
      'https://user:pass@example.test',
    ])
      await expect(
        startQualificationRelay({ upstreamOrigin: origin, tls })
      ).rejects.toThrow('qualification_upstream_invalid')
  })
  test('qualification fixture uses real programs and keeps its canned execution route closed', async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'qualification-fixture-test-')
    )
    cleanups.push(() => rm(directory, { recursive: true, force: true }))
    const statusPath = path.join(directory, 'status.json')
    const generation = randomUUID()
    const fixture = await startQualificationFixture({
      relayOrigin: 'https://host.docker.internal:12345',
      relayCA: tls.cert.toString(),
      statusPath,
      generation,
    })
    cleanups.push(fixture.close)
    const result = await post(fixture.origin, body(), { ca: fixture.cert })
    expect(result.status).toBe(404)
    expect(JSON.parse(await readFile(statusPath, 'utf8')).transport).toBe('stg')
    expect(fixture.childEnv.CHAT_CODEAPI_BASE_URL).toBe(
      'https://host.docker.internal:12345'
    )
    expect(fixture.state.generation).toBe(generation)
    expect(fixture.publicJwk).not.toHaveProperty('d')
    expect(fixture.childEnv.CHAT_CODEAPI_JWT_PRIVATE_KEY).toContain(
      'BEGIN PRIVATE KEY'
    )
    expect(JSON.stringify(fixture.state)).not.toContain('BEGIN PRIVATE KEY')
    expect(qualificationProgram('success', randomUUID())).toContain('print(')
  })
  test('persists the same generation with safe attempt evidence and rejects other upstreams', async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'qualification-receipt-test-')
    )
    cleanups.push(() => rm(directory, { recursive: true, force: true }))
    const receiptDir = path.join(directory, '.devcontainer', '.runtime')
    await mkdir(receiptDir, { recursive: true })
    const statusPath = path.join(receiptDir, 'codeapi-stg-relay-status.json')
    const generation = randomUUID()
    const relay = await startQualificationRelay({
      upstreamOrigin: 'http://127.0.0.1:1',
      tls,
      statusPath,
      generation,
    })
    cleanups.push(relay.close)
    expect(JSON.parse(await readFile(statusPath, 'utf8'))).toMatchObject({
      generation,
      attempts: 0,
      observations: [],
    })
    expect((await post(relay.origin, body())).status).toBe(502)
    await relay.close()
    const saved = JSON.parse(await readFile(statusPath, 'utf8'))
    expect(saved).toMatchObject({
      generation,
      attempts: 1,
      requestedGuestMs: 5000,
    })
    expect(saved.observations[0].outcome).toBe('transport_failure')
    expect(JSON.stringify(saved)).not.toContain('synthetic.jwt.value')
    await expect(
      startQualificationRelay({ upstreamOrigin: 'https://example.test', tls })
    ).rejects.toThrow('qualification_upstream_invalid')
  })
  test('supervisor reaps an immediately exiting child and clears readiness', async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'qualification-supervisor-test-')
    )
    cleanups.push(() => rm(directory, { recursive: true, force: true }))
    const scripts = path.join(directory, 'apps/chat/scripts')
    const fakeNext = path.join(
      directory,
      'apps/chat/node_modules/next/dist/bin'
    )
    await mkdir(scripts, { recursive: true })
    await mkdir(fakeNext, { recursive: true })
    await mkdir(path.join(directory, '.devcontainer/.runtime'), {
      recursive: true,
    })
    for (const name of [
      'codeapi-browser-fixture.mjs',
      'codeapi-stg-qualification.mjs',
    ])
      await copyFile(
        path.join(process.cwd(), 'scripts', name),
        path.join(scripts, name)
      )
    await writeFile(path.join(fakeNext, 'next'), 'process.exit(7)')
    const child = spawn(
      process.execPath,
      [
        path.join(scripts, 'codeapi-stg-qualification.mjs'),
        '--container-fixture',
      ],
      {
        env: { PATH: process.env.PATH, NODE_ENV: 'test' },
        stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
      }
    )
    child.stdin!.end(
      JSON.stringify({
        relayOrigin: 'https://host.docker.internal:12345',
        relayCA: tls.cert.toString(),
        generation: randomUUID(),
      })
    )
    let output = ''
    child.stdout!.on('data', (x) => (output += x))
    child.stderr!.resume()
    child.stdio[3]!.on('data', () => {})
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
    const code = await new Promise((resolve) => child.once('exit', resolve))
    clearTimeout(timer)
    expect([2, 7]).toContain(code)
    const state = JSON.parse(
      await readFile(
        path.join(
          directory,
          '.devcontainer/.runtime/codeapi-browser-fixture-status.json'
        ),
        'utf8'
      )
    )
    expect(state.ready).toBe(false)
    expect(output).not.toContain('PRIVATE KEY')
  })
  test('preserves legacy effective policy and rejects private or duplicate key material', () => {
    const makeKey = (kid: string) => ({
      ...generateKeyPairSync('ed25519').publicKey.export({ format: 'jwk' }),
      kid,
      alg: 'EdDSA',
    })
    const legacy = makeKey('legacy-synthetic'),
      external = makeKey('external-synthetic')
    const config = {
      jwks: JSON.stringify({ keys: [legacy] }),
      issuer: 'synthetic-legacy',
      audience: 'synthetic-audience',
      allowedAlgorithms: 'RS256, EdDSA,ignored,EdDSA',
      publicJwk: external,
    }
    const parsed = JSON.parse(buildQualificationTrust(config).trustEntries)
    expect(parsed[0]).toMatchObject({
      issuer: 'synthetic-legacy',
      keyIds: ['legacy-synthetic'],
      allowedAlgorithms: ['RS256', 'EdDSA'],
      principalSources: ['librechat_jwt', 'openid_reuse'],
    })
    expect(parsed[1]).toMatchObject({
      keyIds: ['external-synthetic'],
      allowedAlgorithms: ['EdDSA'],
      principalSources: ['external:klicker'],
      codeWorkerIdPrefixes: ['klicker-stg-qualification:'],
    })
    expect(() =>
      buildQualificationTrust({
        ...config,
        publicJwk: { ...external, d: 'synthetic-private' },
      })
    ).toThrow('qualification_public_key_invalid')
    expect(() =>
      buildQualificationTrust({
        ...config,
        publicJwk: { ...external, kid: legacy.kid },
      })
    ).toThrow('qualification_public_key_invalid')
    expect(() => qualificationProgram('http-error', randomUUID())).toThrow(
      'qualification_scenario_invalid'
    )
  })
})

describe('existing-client compatibility probe transport', () => {
  test('sends one signed bounded request and requires successful exact output', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const privateJwk = {
      ...privateKey.export({ format: 'jwk' }),
      kid: 'legacy-synthetic',
    }
    const nonce = randomUUID()
    let calls = 0
    const server = createServer(async (req, res) => {
      calls++
      const token = req.headers.authorization!.slice(7)
      const [header, payload, signature] = token.split('.')
      expect(
        verify(
          null,
          Buffer.from(`${header}.${payload}`),
          publicKey,
          Buffer.from(signature, 'base64url')
        )
      ).toBe(true)
      expect(
        JSON.parse(Buffer.from(header, 'base64url').toString())
      ).toMatchObject({ alg: 'EdDSA', kid: privateJwk.kid })
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
      expect(claims).toMatchObject({
        iss: 'synthetic-issuer',
        aud: 'synthetic-audience',
        principal_source: 'librechat_jwt',
        tenant_id: 'synthetic',
      })
      expect(claims.exp - claims.iat).toBe(120)
      expect(req.url).toBe('/v1/exec')
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual({
        code: `print("CODEAPI_VALUE:${nonce}", end="")`,
        files: [],
        lang: 'python',
        timeout: 5000,
      })
      res.end(
        JSON.stringify({
          code: 0,
          stdout: `CODEAPI_VALUE:${nonce}`,
          stderr: '',
          files: [],
        })
      )
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    cleanups.push(async () => {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    })
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    expect(
      await probeLegacyCompatibility({
        origin,
        privateJwk,
        issuer: 'synthetic-issuer',
        audience: 'synthetic-audience',
        nonce,
      })
    ).toEqual({ outcome: 'accepted' })
    expect(calls).toBe(1)
    await expect(
      probeLegacyCompatibility({
        origin: 'https://example.test',
        privateJwk,
        issuer: 'synthetic-issuer',
        audience: 'synthetic-audience',
        nonce,
      })
    ).rejects.toThrow('qualification_legacy_probe_origin_invalid')
    expect(calls).toBe(1)
  })

  test.each([
    'redirect',
    'oversized',
    'wrong-output',
    'status-failure',
    'disconnect',
  ])('fails closed for %s without retry or value output', async (failure) => {
    const privateJwk = {
      ...generateKeyPairSync('ed25519').privateKey.export({ format: 'jwk' }),
      kid: 'legacy-synthetic',
    }
    const nonce = randomUUID()
    let calls = 0
    const server = createServer((req, res) => {
      calls++
      req.resume()
      if (failure === 'redirect') {
        res.writeHead(302, { location: 'http://127.0.0.1:1/other' })
        res.end()
        return
      }
      if (failure === 'disconnect') {
        req.socket.destroy()
        return
      }
      if (failure === 'oversized') {
        res.end('x'.repeat(128 * 1024 + 1))
        return
      }
      res.end(
        JSON.stringify({
          code: 0,
          stdout:
            failure === 'wrong-output' ? 'wrong' : `CODEAPI_VALUE:${nonce}`,
          stderr: '',
          files: [],
          status: failure === 'status-failure' ? 'failed' : null,
        })
      )
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    cleanups.push(async () => {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    })
    const result = await probeLegacyCompatibility({
      origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
      privateJwk,
      issuer: 'synthetic-issuer',
      audience: 'synthetic-audience',
      nonce,
    })
    expect(result.outcome).not.toBe('accepted')
    expect(Object.keys(result)).toEqual(['outcome'])
    expect(calls).toBe(1)
  })
})
