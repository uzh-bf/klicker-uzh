import { createServer, type RequestListener } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { request } from 'node:https'
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { afterEach, describe, expect, test } from 'vitest'
import { certificate } from '../scripts/codeapi-browser-fixture.mjs'
import {
  buildQualificationTrust,
  qualificationProgram,
  startQualificationRelay,
  startQualificationFixture,
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
    const fixture = await startQualificationFixture({
      relayOrigin: 'https://host.docker.internal:12345',
      relayCA: tls.cert.toString(),
      statusPath,
    })
    cleanups.push(fixture.close)
    const result = await post(fixture.origin, body(), { ca: fixture.cert })
    expect(result.status).toBe(404)
    expect(JSON.parse(await readFile(statusPath, 'utf8')).transport).toBe('stg')
    expect(fixture.childEnv.CHAT_CODEAPI_BASE_URL).toBe(
      'https://host.docker.internal:12345'
    )
    expect(fixture.publicJwk).not.toHaveProperty('d')
    expect(fixture.childEnv.CHAT_CODEAPI_JWT_PRIVATE_KEY).toContain(
      'BEGIN PRIVATE KEY'
    )
    expect(JSON.stringify(fixture.state)).not.toContain('BEGIN PRIVATE KEY')
    expect(qualificationProgram('success', randomUUID())).toContain('print(')
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
