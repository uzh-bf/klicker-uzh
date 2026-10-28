import { request as httpRequest } from 'node:http'
import { spawn } from 'node:child_process'
import {
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
} from 'node:crypto'
import {
  lstat,
  mkdtemp,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createServer, request as httpsRequest } from 'node:https'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  certificate,
  startFixture,
  FIXTURE_STATUS_PATH,
} from './codeapi-browser-fixture.mjs'

const NONCE = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/
const CASES = new Set(['success', 'python-error', 'timeout', 'stop', 'double'])
const BODY_LIMIT = 128 * 1024
export const QUALIFICATION_BOOTSTRAP =
  '.devcontainer/.runtime/codeapi-stg-qualification.json'

export function qualificationProgram(scenario, nonce) {
  if (!CASES.has(scenario) || !NONCE.test(nonce))
    throw new Error('qualification_scenario_invalid')
  const marker = `# CODEAPI_E2E:${scenario}:${nonce}`
  if (scenario === 'python-error')
    return `${marker}\nraise ValueError("synthetic")`
  if (scenario === 'timeout' || scenario === 'stop')
    return `${marker}\nimport time\ntime.sleep(30)`
  return `${marker}\nprint("CODEAPI_VALUE:${nonce}", end="")`
}

export function buildQualificationTrust({
  jwks,
  issuer,
  audience,
  allowedAlgorithms,
  publicJwk,
}) {
  const parsed = JSON.parse(jwks)
  if (
    !Array.isArray(parsed?.keys) ||
    !parsed.keys.length ||
    typeof issuer !== 'string' ||
    !issuer ||
    issuer !== issuer.trim() ||
    typeof audience !== 'string' ||
    !audience ||
    audience !== audience.trim()
  )
    throw new Error('qualification_legacy_config_invalid')
  const algorithms = [
    ...new Set(
      allowedAlgorithms
        .split(',')
        .map((x) => x.trim())
        .filter((x) => ['EdDSA', 'RS256', 'HS256'].includes(x))
    ),
  ]
  if (!algorithms.length || issuer === 'klicker-stg-qualification')
    throw new Error('qualification_legacy_policy_invalid')
  const keys = [...parsed.keys, publicJwk]
  const ids = new Set()
  for (const key of keys) {
    if (
      !key ||
      typeof key.kid !== 'string' ||
      !key.kid ||
      key.kid !== key.kid.trim() ||
      ids.has(key.kid) ||
      key.kty === 'oct' ||
      ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'].some((field) =>
        Object.hasOwn(key, field)
      )
    )
      throw new Error('qualification_public_key_invalid')
    const publicKey = createPublicKey({ key, format: 'jwk' })
    const algorithm =
      publicKey.asymmetricKeyType === 'ed25519'
        ? 'EdDSA'
        : publicKey.asymmetricKeyType === 'rsa'
          ? 'RS256'
          : undefined
    if (
      !algorithm ||
      (key.alg !== undefined && key.alg !== algorithm) ||
      (key !== publicJwk && !algorithms.includes(algorithm))
    )
      throw new Error('qualification_key_policy_invalid')
    ids.add(key.kid)
  }
  if (
    publicJwk.kty !== 'OKP' ||
    publicJwk.crv !== 'Ed25519' ||
    publicJwk.alg !== 'EdDSA'
  )
    throw new Error('qualification_external_key_invalid')
  return {
    jwks: JSON.stringify({ keys }),
    trustEntries: JSON.stringify([
      {
        issuer,
        audiences: [audience],
        keyIds: parsed.keys.map((x) => x.kid),
        allowedAlgorithms: algorithms,
        principalSources: ['librechat_jwt', 'openid_reuse'],
      },
      {
        issuer: 'klicker-stg-qualification',
        audiences: ['klicker-stg-qualification'],
        keyIds: [publicJwk.kid],
        allowedAlgorithms: ['EdDSA'],
        principalSources: ['external:klicker'],
        codeWorkerIdPrefixes: ['klicker-stg-qualification:'],
      },
    ]),
  }
}

/** One no-file legacy-client probe; all supplied credentials remain in memory. */
export async function probeLegacyCompatibility({
  origin,
  privateJwk,
  issuer,
  audience,
  nonce,
}) {
  if (!NONCE.test(nonce ?? ''))
    throw new Error('qualification_legacy_probe_nonce_invalid')
  if (
    [issuer, audience].some(
      (value) => typeof value !== 'string' || !value || value !== value.trim()
    )
  )
    throw new Error('qualification_legacy_probe_config_invalid')
  let endpoint
  try {
    endpoint = new URL(origin)
  } catch {
    throw new Error('qualification_legacy_probe_origin_invalid')
  }
  if (
    endpoint.origin !== origin ||
    endpoint.protocol !== 'http:' ||
    endpoint.hostname !== '127.0.0.1' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== '/' ||
    endpoint.search ||
    endpoint.hash
  )
    throw new Error('qualification_legacy_probe_origin_invalid')
  let key
  try {
    if (
      privateJwk?.kty !== 'OKP' ||
      privateJwk.crv !== 'Ed25519' ||
      (privateJwk.alg !== undefined && privateJwk.alg !== 'EdDSA') ||
      typeof privateJwk.kid !== 'string' ||
      !privateJwk.kid ||
      privateJwk.kid !== privateJwk.kid.trim()
    )
      throw new Error()
    key = createPrivateKey({ key: privateJwk, format: 'jwk' })
    if (key.asymmetricKeyType !== 'ed25519') throw new Error()
  } catch {
    throw new Error('qualification_legacy_probe_key_invalid')
  }
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(
    JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid: privateJwk.kid })
  ).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      iss: issuer,
      aud: audience,
      sub: 'synthetic-legacy-probe',
      tenant_id: 'synthetic',
      principal_source: 'librechat_jwt',
      auth_context_hash: 'synthetic-legacy-probe',
      jti: randomUUID(),
      iat: now,
      nbf: now,
      exp: now + 120,
    })
  ).toString('base64url')
  const input = `${header}.${payload}`
  const token = `${input}.${sign(null, Buffer.from(input), key).toString('base64url')}`
  const signal = AbortSignal.timeout(30_000)
  let request
  try {
    const response = await new Promise((resolve, reject) => {
      request = httpRequest(
        new URL('/v1/exec', endpoint),
        {
          method: 'POST',
          agent: false,
          signal,
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
            'x-codeapi-expected-profile': 'default',
          },
        },
        resolve
      )
      request.once('error', reject)
      request.end(
        JSON.stringify({
          code: `print("CODEAPI_VALUE:${nonce}", end="")`,
          files: [],
          lang: 'python',
          timeout: 5000,
        })
      )
    })
    if (response.statusCode >= 300 && response.statusCode < 400)
      return { outcome: 'redirect_rejected' }
    if (response.statusCode !== 200) return { outcome: 'http_failure' }
    let result
    try {
      result = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(
          await boundedBody(response)
        )
      )
    } catch (error) {
      if (signal.aborted) return { outcome: 'transport_timeout' }
      return {
        outcome:
          error.message === 'qualification_body_bound'
            ? 'response_too_large'
            : 'response_invalid',
      }
    }
    if (
      !result ||
      result.code !== 0 ||
      result.stdout !== `CODEAPI_VALUE:${nonce}` ||
      result.stderr !== '' ||
      result.status != null ||
      result.signal != null ||
      !Array.isArray(result.files) ||
      result.files.length
    )
      return { outcome: 'execution_failure' }
    return { outcome: 'accepted' }
  } catch {
    return {
      outcome: signal.aborted ? 'transport_timeout' : 'transport_failure',
    }
  } finally {
    request?.destroy()
  }
}

async function boundedBody(stream) {
  const parts = []
  let bytes = 0
  for await (const part of stream) {
    bytes += part.length
    if (bytes > BODY_LIMIT) throw new Error('qualification_body_bound')
    parts.push(part)
  }
  return Buffer.concat(parts)
}

/**
 * A closed-route transport observer; attempted forwarding never implies guest admission.
 * @param {{upstreamOrigin: string, tls?: ReturnType<typeof certificate>,
 * onObservation?: (record: Record<string, unknown>) => void, lifetimeMs?: number,
 * statusPath?: string, generation?: string, requireRegistration?: boolean}} options
 */
export async function startQualificationRelay({
  upstreamOrigin,
  tls = certificate('host.docker.internal'),
  onObservation = () => {},
  lifetimeMs = 20 * 60_000,
  statusPath = undefined,
  generation = undefined,
  requireRegistration = false,
}) {
  const upstream = new URL(upstreamOrigin)
  if (
    upstream.username ||
    upstream.password ||
    upstream.search ||
    upstream.hash ||
    upstream.pathname !== '/' ||
    upstream.protocol !== 'http:' ||
    upstream.hostname !== '127.0.0.1' ||
    lifetimeMs <= 0 ||
    lifetimeMs > 20 * 60_000
  )
    throw new Error('qualification_upstream_invalid')
  if (
    statusPath &&
    (!path.isAbsolute(statusPath ?? '') ||
      !NONCE.test(generation ?? '') ||
      !statusPath.endsWith(
        '/.devcontainer/.runtime/codeapi-stg-relay-status.json'
      ))
  )
    throw new Error('qualification_receipt_invalid')
  if (requireRegistration && !NONCE.test(generation ?? ''))
    throw new Error('qualification_generation_invalid')
  let registered
  let armed = !requireRegistration
  let registrationResolve
  const registration = new Promise((resolve) => {
    registrationResolve = resolve
  })
  const started = performance.now()
  const records = new Map()
  const sockets = new Set()
  const requests = new Set()
  let attempts = 0
  let healthChecks = 0
  let active = null
  let closed = false
  let closing
  let lifetime
  let writes = Promise.resolve()
  const persist = () => {
    if (!statusPath) return
    const data = JSON.stringify({
      generation,
      attempts,
      requestedGuestMs: attempts * 5000,
      healthChecks,
      observations: [...records.values()].map((record) => ({ ...record })),
    })
    writes = writes.then(async () => {
      const temporary = `${statusPath}.${generation}.tmp`
      await writeFile(temporary, data, { mode: 0o600 })
      await rename(temporary, statusPath)
    })
    void writes.catch(() => {
      closed = true
      server.closeAllConnections()
    })
  }
  const emit = (record) => {
    onObservation({ ...record })
    persist()
  }
  const reply = (res, status, error) => {
    if (!res.destroyed && !res.headersSent) {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error }))
    }
  }
  const server = createServer(tls, async (req, res) => {
    let record
    let forwarded
    let timer
    let responseReceived = false
    const disconnect = () => {
      if (record && !responseReceived && !record.outcome) {
        record.outcome = 'transport_aborted'
        record.abortAfterMs = Math.round(performance.now() - record.startedMs)
        emit(record)
      }
      forwarded?.destroy()
    }
    res.once('close', disconnect)
    try {
      if (closed || performance.now() - started >= lifetimeMs)
        return reply(res, 503, 'qualification_expired')
      if (req.method === 'GET' && req.url === '/health') {
        if (++healthChecks > 10)
          return reply(res, 429, 'qualification_health_bound')
        res.writeHead(200, { 'content-type': 'application/json' })
        return res.end('{"ready":true}')
      }
      if (
        requireRegistration &&
        req.method === 'POST' &&
        req.url === '/qualification/register'
      ) {
        const value = JSON.parse((await boundedBody(req)).toString('utf8'))
        const key = value?.publicJwk
        if (
          registered ||
          value?.generation !== generation ||
          Object.keys(value).sort().join(',') !== 'generation,publicJwk' ||
          !key ||
          Object.keys(key).sort().join(',') !== 'alg,crv,kid,kty,x' ||
          key.kty !== 'OKP' ||
          key.crv !== 'Ed25519' ||
          key.alg !== 'EdDSA' ||
          typeof key.kid !== 'string' ||
          !/^qualification-[a-f0-9-]{36}$/.test(key.kid) ||
          typeof key.x !== 'string' ||
          !/^[A-Za-z0-9_-]{43}$/.test(key.x)
        )
          return reply(res, 409, 'qualification_registration_invalid')
        createPublicKey({ key, format: 'jwk' })
        registered = { generation, publicJwk: { ...key } }
        registrationResolve(registered)
        res.writeHead(204)
        return res.end()
      }
      if (req.method === 'POST' && req.url === '/v1/exec' && !armed)
        return reply(res, 503, 'qualification_not_armed')
      if (req.method !== 'POST' || req.url !== '/v1/exec')
        return reply(res, 404, 'qualification_route')
      const body = JSON.parse((await boundedBody(req)).toString('utf8'))
      const matches =
        typeof body.code === 'string'
          ? [...body.code.matchAll(/# CODEAPI_E2E:([a-z-]+):([a-f0-9-]+)/g)]
          : []
      const [selected] = matches
      if (
        matches.length !== 1 ||
        !selected ||
        !CASES.has(selected[1]) ||
        !NONCE.test(selected[2]) ||
        body.code !== qualificationProgram(selected[1], selected[2]) ||
        body.lang !== 'python' ||
        body.timeout !== 5000 ||
        !Array.isArray(body.files) ||
        body.files.length ||
        Object.keys(body).sort().join(',') !== 'code,files,lang,timeout' ||
        req.headers['x-codeapi-expected-profile'] !== 'default' ||
        !/^Bearer [A-Za-z0-9_.-]{1,16384}$/.test(
          req.headers.authorization ?? ''
        )
      )
        return reply(res, 400, 'qualification_contract')
      if (active || records.has(selected[2]) || attempts >= 10)
        return reply(res, 429, 'qualification_attempt_bound')
      // Reserve before constructing or writing an upstream request; unknown outcomes consume it.
      attempts++
      record = {
        nonce: selected[2],
        scenario: selected[1],
        attempt: attempts,
        requestedGuestMs: 5000,
        startedMs: performance.now(),
        outcome: null,
      }
      active = record
      records.set(record.nonce, record)
      emit(record)
      const request = httpRequest
      forwarded = request(
        new URL('/v1/exec', upstream),
        {
          method: 'POST',
          headers: {
            authorization: req.headers.authorization,
            'content-type': 'application/json',
            'x-codeapi-expected-profile': 'default',
          },
        },
        async (response) => {
          try {
            const bytes = await boundedBody(response)
            responseReceived = true
            record.httpStatus = response.statusCode
            record.elapsedMs = Math.round(performance.now() - record.startedMs)
            record.outcome =
              response.statusCode === 200 ? 'response_received' : 'http_failure'
            emit(record)
            res.writeHead(response.statusCode, {
              'content-type': 'application/json',
            })
            res.end(bytes)
          } catch {
            if (!record.outcome) {
              record.outcome = 'invalid_or_oversized_response'
              emit(record)
            }
            forwarded.destroy()
            reply(res, 502, 'qualification_response')
          } finally {
            clearTimeout(timer)
            if (active === record) active = null
          }
        }
      )
      requests.add(forwarded)
      forwarded.once('close', () => {
        requests.delete(forwarded)
        clearTimeout(timer)
        if (active === record) active = null
      })
      forwarded.once('error', () => {
        if (!record.outcome) {
          record.outcome = 'transport_failure'
          emit(record)
        }
        reply(res, 502, 'qualification_transport')
      })
      timer = setTimeout(() => {
        if (!record.outcome) {
          record.outcome = 'transport_deadline'
          emit(record)
        }
        forwarded.destroy()
        reply(res, 504, 'qualification_deadline')
      }, 30_000)
      forwarded.end(JSON.stringify(body))
    } catch {
      if (record && !record.outcome) {
        record.outcome = 'request_failure'
        emit(record)
      }
      forwarded?.destroy()
      if (active === record) active = null
      reply(res, 400, 'qualification_contract')
    }
  })
  server.headersTimeout = 10_000
  server.requestTimeout = 15_000
  server.on('connection', (socket) => {
    if (sockets.size >= 16) return socket.destroy()
    sockets.add(socket)
    socket.setTimeout(35_000, () => socket.destroy())
    socket.once('close', () => sockets.delete(socket))
  })
  const close = () => {
    if (closing) return closing
    closed = true
    clearTimeout(lifetime)
    for (const request of requests) request.destroy()
    for (const socket of sockets) socket.destroy()
    closing = new Promise((resolve) => server.close(resolve)).then(() => writes)
    return closing
  }
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    persist()
    await writes
    lifetime = setTimeout(() => void close().catch(() => {}), lifetimeMs)
    lifetime.unref()
  } catch {
    await close()
    throw new Error('qualification_listen_failed')
  }
  return {
    origin: `https://127.0.0.1:${server.address().port}`,
    containerOrigin: `https://host.docker.internal:${server.address().port}`,
    cert: tls.cert,
    close,
    registration,
    arm: () => {
      if (closed || armed || !registered || attempts)
        throw new Error('qualification_arm_invalid')
      armed = true
    },
    snapshot: () => ({
      attempts,
      requestedGuestMs: attempts * 5000,
      healthChecks,
      observations: [...records.values()].map((record) => ({ ...record })),
    }),
  }
}

/** Starts only the explicit test child; no network forwarding or secret provisioning is implicit. */
export async function startQualificationFixture({
  relayOrigin,
  relayCA,
  statusPath,
  generation,
}) {
  const origin = new URL(relayOrigin)
  if (
    origin.protocol !== 'https:' ||
    origin.hostname !== 'host.docker.internal' ||
    origin.pathname !== '/' ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    typeof relayCA !== 'string' ||
    !relayCA.startsWith('-----BEGIN CERTIFICATE-----')
  )
    throw new Error('qualification_fixture_config_invalid')
  if (!NONCE.test(generation ?? ''))
    throw new Error('qualification_generation_invalid')
  const fixture = await startFixture({
    mode: 'enabled',
    statusPath,
    deferReady: true,
    generation,
    qualification: {
      origin: origin.origin,
      keyId: `qualification-${randomUUID()}`,
      program: qualificationProgram,
    },
  })
  return {
    ...fixture,
    relayCA,
    publicJwk: {
      ...fixture.publicKey.export({ format: 'jwk' }),
      kid: fixture.childEnv.CHAT_CODEAPI_JWT_KEY_ID,
      alg: 'EdDSA',
    },
  }
}

async function runQualificationLifecycle(args, { signal = undefined } = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn('devrouter', args, {
      stdio: 'ignore',
      signal,
      timeout: 600_000,
    })
    child.once('error', () =>
      reject(new Error('qualification_lifecycle_failed'))
    )
    child.once('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('qualification_lifecycle_failed'))
    )
  })
}

/** The canonical lifecycle owns the only chat process; bootstrap carries public material only. */
export async function startManagedQualification({
  checkout,
  upstreamOrigin,
  runLifecycle = runQualificationLifecycle,
  lifetimeMs = 600_000,
}) {
  if (
    !path.isAbsolute(checkout) ||
    path.basename(checkout) !== 'chat-codeapi-browser-qualification' ||
    typeof runLifecycle !== 'function' ||
    lifetimeMs <= 0 ||
    lifetimeMs > 600_000
  )
    throw new Error('qualification_managed_config_invalid')
  const owned = []
  let relay, closing
  const startup = new AbortController()
  const generation = randomUUID()
  const bootstrap = path.join(checkout, QUALIFICATION_BOOTSTRAP)
  const mode = path.join(
    checkout,
    '.devcontainer/.runtime/codeapi-browser-fixture'
  )
  for (const relative of [
    QUALIFICATION_BOOTSTRAP,
    '.devcontainer/.runtime/codeapi-browser-fixture',
    '.devcontainer/.runtime/beta-enrollment-fixture',
    '.devcontainer/.runtime/playwright-ci-plan.json',
  ]) {
    try {
      await lstat(path.join(checkout, relative))
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
    throw new Error('qualification_marker_conflict')
  }
  const close = () => {
    if (closing) return closing
    closing = (async () => {
      let failure
      try {
        await runLifecycle(['stop', checkout])
      } catch {
        failure = true
      }
      for (const file of [...owned].reverse()) {
        try {
          const current = await lstat(file.path)
          if (
            current.ino !== file.ino ||
            (await readFile(file.path, 'utf8')) !== file.contents
          )
            throw new Error('qualification_marker_owner_changed')
          await unlink(file.path)
        } catch (error) {
          if (error.code !== 'ENOENT') failure = true
        }
      }
      await relay?.close()
      if (failure) throw new Error('qualification_cleanup_incomplete')
    })()
    return closing
  }
  try {
    await runLifecycle(['stop', checkout])
    relay = await startQualificationRelay({
      upstreamOrigin,
      generation,
      requireRegistration: true,
      lifetimeMs,
      statusPath: path.join(
        checkout,
        '.devcontainer/.runtime/codeapi-stg-relay-status.json'
      ),
    })
    for (const [file, contents] of [
      [mode, 'enabled'],
      [
        bootstrap,
        JSON.stringify({
          generation,
          relayOrigin: relay.containerOrigin,
          relayCA: relay.cert.toString(),
          expiresAt: Date.now() + lifetimeMs,
        }),
      ],
    ]) {
      await writeFile(file, contents, { flag: 'wx', mode: 0o600 })
      owned.push({ path: file, contents, ino: (await lstat(file)).ino })
    }
    let timer
    try {
      const ensured = runLifecycle(
        ['ensure', checkout, '--profile', 'chat', '--json'],
        { signal: startup.signal }
      )
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          startup.abort()
          reject(new Error('qualification_managed_deadline'))
        }, lifetimeMs)
      })
      try {
        await Promise.race([
          Promise.all([ensured, relay.registration]),
          deadline,
        ])
      } finally {
        if (startup.signal.aborted) await ensured.catch(() => {})
      }
    } finally {
      clearTimeout(timer)
    }
    return { relay, generation, close }
  } catch {
    await close()
    throw new Error('qualification_managed_start_failed')
  }
}

export async function readQualificationBootstrap(checkout) {
  let contents
  try {
    contents = await readFile(
      path.join(checkout, QUALIFICATION_BOOTSTRAP),
      'utf8'
    )
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
  const value = JSON.parse(contents)
  if (
    Object.keys(value).sort().join(',') !==
      'expiresAt,generation,relayCA,relayOrigin' ||
    !NONCE.test(value.generation ?? '') ||
    typeof value.relayCA !== 'string' ||
    !Number.isFinite(value.expiresAt) ||
    value.expiresAt <= Date.now() ||
    value.expiresAt > Date.now() + 20 * 60_000
  )
    throw new Error('qualification_bootstrap_invalid')
  return value
}

export async function registerQualification({
  origin,
  ca,
  generation,
  publicJwk,
  signal = undefined,
}) {
  await new Promise((resolve, reject) => {
    const req = httpsRequest(
      new URL('/qualification/register', origin),
      {
        method: 'POST',
        ca,
        timeout: 10_000,
        signal,
        headers: { 'content-type': 'application/json' },
      },
      (res) => {
        res.resume()
        res.once('end', () =>
          res.statusCode === 204
            ? resolve()
            : reject(new Error('qualification_registration_failed'))
        )
      }
    )
    req.once('error', () =>
      reject(new Error('qualification_registration_failed'))
    )
    req.once('timeout', () =>
      req.destroy(new Error('qualification_registration_deadline'))
    )
    req.end(JSON.stringify({ generation, publicJwk }))
  })
}

/** Create-only admission. Ambiguous writes never grant cleanup ownership. */
export async function admitQualificationVerifier({
  request,
  secret,
  externalSecret,
}) {
  if (
    typeof request !== 'function' ||
    secret?.kind !== 'Secret' ||
    secret.apiVersion !== 'v1' ||
    secret.type !== 'Opaque' ||
    Object.keys(secret.data ?? {}).length ||
    Object.hasOwn(secret, 'stringData') ||
    externalSecret?.kind !== 'ExternalSecret' ||
    externalSecret.apiVersion !== 'external-secrets.io/v1' ||
    [secret, externalSecret].some(
      (object) =>
        object.metadata?.name !== 'codeapi-klicker-verifier' ||
        object.metadata.namespace !== 'codeapi' ||
        object.metadata.ownerReferences?.length
    ) ||
    externalSecret.spec?.target?.name !== 'codeapi-klicker-verifier' ||
    externalSecret.spec.target.creationPolicy !== 'Owner' ||
    externalSecret.spec.target.deletionPolicy !== 'Retain'
  )
    throw new Error('qualification_admission_invalid')
  const created = []
  for (const object of [secret, externalSecret]) {
    let result
    try {
      result = await request('POST', object)
    } catch {
      return { outcome: 'unknown', created }
    }
    if (result.status !== 201)
      return {
        outcome: result.status === 409 ? 'conflict' : 'rejected',
        created,
      }
    const metadata = result.metadata
    if (
      typeof metadata?.uid !== 'string' ||
      !metadata.uid ||
      typeof metadata?.resourceVersion !== 'string' ||
      !metadata.resourceVersion ||
      metadata.name !== object.metadata.name ||
      metadata.namespace !== object.metadata.namespace
    )
      return { outcome: 'unknown', created }
    created.push({
      kind: object.kind,
      metadata: {
        name: metadata.name,
        namespace: metadata.namespace,
        uid: metadata.uid,
        resourceVersion: metadata.resourceVersion,
      },
    })
  }
  return { outcome: 'created', created }
}

/** A changed identity or revision must make deletion fail at the API server. */
export async function cleanupQualificationVerifier({ request, created }) {
  if (
    typeof request !== 'function' ||
    !Array.isArray(created) ||
    created.length > 2 ||
    created.some(
      (object) =>
        !['Secret', 'ExternalSecret'].includes(object.kind) ||
        object.metadata?.name !== 'codeapi-klicker-verifier' ||
        object.metadata.namespace !== 'codeapi' ||
        !object.metadata.uid ||
        !object.metadata.resourceVersion
    )
  )
    throw new Error('qualification_cleanup_owner_invalid')
  for (const object of [...created].reverse()) {
    let result
    try {
      result = await request('DELETE', {
        ...object,
        options: {
          apiVersion: 'v1',
          kind: 'DeleteOptions',
          preconditions: {
            uid: object.metadata.uid,
            resourceVersion: object.metadata.resourceVersion,
          },
        },
      })
    } catch {
      return { outcome: 'unknown' }
    }
    if (![200, 202, 404].includes(result.status)) return { outcome: 'held' }
  }
  return { outcome: 'deletion_requested' }
}

export async function superviseQualification(config) {
  if (
    process.env.NODE_ENV !== 'test' ||
    process.env.CI ||
    process.env.GITHUB_ACTIONS
  )
    throw new Error('qualification_requires_explicit_local_supervisor')
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  let fixture, directory, child, forceTimer, lifetime, exit
  const stopped = new AbortController()
  const stop = () => {
    stopped.abort()
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
      if (!forceTimer)
        forceTimer = setTimeout(() => child.kill('SIGKILL'), 5000)
    }
  }
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop)
  try {
    fixture = await startQualificationFixture({
      ...config,
      statusPath: path.join(root, FIXTURE_STATUS_PATH),
    })
    directory = await mkdtemp(path.join(tmpdir(), 'codeapi-qualification-'))
    const caPath = path.join(directory, 'public-trust.pem')
    const existing = process.env.NODE_EXTRA_CA_CERTS
      ? await readFile(process.env.NODE_EXTRA_CA_CERTS)
      : Buffer.alloc(0)
    await writeFile(
      caPath,
      Buffer.concat([
        existing,
        Buffer.from('\n'),
        fixture.cert,
        Buffer.from('\n' + fixture.relayCA),
      ]),
      { mode: 0o600 }
    )
    stopped.signal.throwIfAborted()
    const env = {
      ...process.env,
      ...fixture.childEnv,
      NODE_EXTRA_CA_CERTS: caPath,
    }
    delete env.LANGFUSE_PUBLIC_KEY
    delete env.LANGFUSE_SECRET_KEY
    stopped.signal.throwIfAborted()
    const next = fileURLToPath(
      new URL('../node_modules/next/dist/bin/next', import.meta.url)
    )
    child = spawn(
      process.execPath,
      [next, 'dev', '--turbopack', '--port', '3004'],
      { env, stdio: 'inherit' }
    )
    exit = new Promise((resolve, reject) => {
      child.once('exit', (code) => {
        stopped.abort()
        resolve(code ?? 1)
      })
      child.once('error', reject)
    })
    void exit.catch(() => {})
    // The coordinator supplies an explicit public-only channel; the signer remains child-only.
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve)
      child.once('error', reject)
    })
    stopped.signal.throwIfAborted()
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error('qualification_child_exited')
    await registerQualification({
      origin: config.relayOrigin,
      ca: config.relayCA,
      generation: fixture.state.generation,
      publicJwk: fixture.publicJwk,
      signal: stopped.signal,
    })
    stopped.signal.throwIfAborted()
    await fixture.ready()
    lifetime = setTimeout(
      stop,
      Math.min(
        20 * 60_000,
        config.expiresAt
          ? Math.max(1, config.expiresAt - Date.now())
          : 20 * 60_000
      )
    )
    const code = await exit
    process.exitCode = Number(code)
  } finally {
    clearTimeout(lifetime)
    clearTimeout(forceTimer)
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await exit?.catch(() => {})
    }
    await fixture?.close()
    if (directory) await rm(directory, { recursive: true, force: true })
    for (const signal of ['SIGINT', 'SIGTERM'])
      process.removeListener(signal, stop)
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv[2] !== '--container-fixture' || process.argv.length !== 3)
      throw new Error('qualification_requires_explicit_local_supervisor')
    await superviseQualification(
      JSON.parse((await boundedBody(process.stdin)).toString('utf8'))
    )
  } catch {
    console.error('qualification_supervisor_failed')
    process.exitCode = 2
  }
}
