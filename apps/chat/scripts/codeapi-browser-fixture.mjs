import { spawn, spawnSync } from 'node:child_process'
import { generateKeyPairSync, randomUUID, verify } from 'node:crypto'
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:https'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const fixtureBotIds = [
  '42d614f8-9b1c-4d0f-a34a-312b190c3621',
  '42d614f8-9b1c-4d0f-a34a-312b190c3622',
]
export const CODEAPI_BROWSER_CHATBOT_ID = fixtureBotIds[0]
export const CODEAPI_BROWSER_DENIED_CHATBOT_ID = fixtureBotIds[1]
const root = fileURLToPath(new URL('../../../', import.meta.url))
export const FIXTURE_STATUS_PATH =
  '.devcontainer/.runtime/codeapi-browser-fixture-status.json'
const markerPath = '.devcontainer/.runtime/codeapi-browser-fixture'
const marker =
  /CODEAPI_E2E:(success|python-error|http-error|timeout|stop|double):([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})/g
const issuer = 'klicker-browser-fixture'
const audience = 'codeapi-browser-fixture'
const keyId = 'synthetic'

export function fixtureRegistry() {
  return ['auto', 'gpt-6-luna'].map((id) => ({
    id,
    deploymentId: id,
    name: 'Synthetic local model',
    fallback: id !== 'auto',
    usageClass: 'BASE',
    usesResponsesApi: false,
    supportsReasoning: false,
    maxOutputTokens: 1024,
    cost: { input: 0, output: 0 },
  }))
}

export function certificate(hostname = 'localhost') {
  if (!['localhost', 'host.docker.internal'].includes(hostname))
    throw new Error('fixture_certificate_host_invalid')
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const key = privateKey.export({ type: 'pkcs8', format: 'pem' })
  const result = spawnSync(
    'sh',
    [
      '-c',
      `cat | openssl req -new -x509 -key /dev/stdin -subj /CN=${hostname} -addext subjectAltName=IP:127.0.0.1,DNS:localhost,DNS:${hostname} -days 1`,
    ],
    { input: key, maxBuffer: 32 * 1024, timeout: 10_000 }
  )
  if (result.status !== 0 || result.error)
    throw new Error('fixture_certificate_failed')
  return { key, cert: result.stdout }
}

async function readBody(request) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > 128 * 1024) throw new Error('fixture_request_bound')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function scenarioFrom(text) {
  const matches = [...text.matchAll(marker)]
  if (matches.length !== 1) throw new Error('fixture_scenario_invalid')
  return { scenario: matches[0][1], nonce: matches[0][2] }
}

function textContent(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content))
    return content
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
  throw new Error('fixture_content_invalid')
}

/** Deterministic model fixture; real execution requires an explicit qualification transport. */
export async function startFixture({
  mode,
  statusPath,
  tls = certificate(),
  blockedMs = 20_000,
  lifetimeMs = 20 * 60_000,
  deferReady = false,
  qualification = undefined,
  generation = undefined,
}) {
  if (
    !['enabled', 'disabled'].includes(mode) ||
    blockedMs > 20_000 ||
    blockedMs < 1 ||
    lifetimeMs > 20 * 60_000 ||
    lifetimeMs < 1
  )
    throw new Error('fixture_configuration_invalid')
  if (
    qualification &&
    (mode !== 'enabled' ||
      typeof qualification.program !== 'function' ||
      new URL(qualification.origin).protocol !== 'https:' ||
      new URL(qualification.origin).hostname !== 'host.docker.internal')
  )
    throw new Error('fixture_qualification_invalid')
  if (
    generation !== undefined &&
    (!qualification ||
      !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(generation))
  )
    throw new Error('fixture_qualification_generation_invalid')
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const state = {
    schemaVersion: 1,
    generation: generation ?? randomUUID(),
    mode,
    ...(qualification ? { transport: 'stg' } : {}),
    ready: false,
    scenarios:
      /** @type {Record<string, {scenario: string, modelCalls: number, dispatches: number, completed: number, disconnected: number, toolResults: number}>} */ ({}),
  }
  let writes = Promise.resolve()
  const persist = () => {
    const value = JSON.stringify(state)
    writes = writes.then(async () => {
      const temporary = `${statusPath}.${state.generation}.tmp`
      await writeFile(temporary, value, { mode: 0o600 })
      await rename(temporary, statusPath)
    })
    return writes
  }
  const sockets = new Set()
  const timers = new Set()
  const jwtIds = new Set()
  let requests = 0
  let closing
  const getScenario = ({ scenario, nonce }) => {
    if (!state.scenarios[nonce]) {
      if (Object.keys(state.scenarios).length >= 64)
        throw new Error('fixture_scenario_bound')
      state.scenarios[nonce] = {
        scenario,
        modelCalls: 0,
        dispatches: 0,
        completed: 0,
        disconnected: 0,
        toolResults: 0,
      }
    }
    if (state.scenarios[nonce].scenario !== scenario)
      throw new Error('fixture_nonce_reused')
    return state.scenarios[nonce]
  }
  const json = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }
  const stream = (res, delta, reason) => {
    const chunk = {
      id: 'chatcmpl-synthetic',
      object: 'chat.completion.chunk',
      created: 0,
      model: 'synthetic',
      choices: [{ index: 0, delta, finish_reason: null }],
    }
    const end = {
      ...chunk,
      choices: [{ index: 0, delta: {}, finish_reason: reason }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }
    const body = `data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(end)}\n\ndata: [DONE]\n\n`
    if (Buffer.byteLength(body) > 32 * 1024)
      throw new Error('fixture_response_bound')
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
    })
    res.end(body)
  }
  const server = createServer(tls, async (req, res) => {
    try {
      if (++requests > 256)
        return json(res, 429, { error: 'fixture_request_bound' })
      if (
        req.method !== 'POST' ||
        !['/v1/exec', '/v1/chat/completions'].includes(req.url)
      )
        return json(res, 404, { error: 'fixture_route' })
      const body = await readBody(req)
      if (req.url === '/v1/chat/completions') {
        if (
          req.headers.authorization !== 'Bearer local-fixture' ||
          body.stream !== true ||
          !['auto', 'gpt-6-luna'].includes(body.model) ||
          !Array.isArray(body.messages)
        )
          throw new Error('fixture_model_contract')
        const lastUser = body.messages.findLastIndex(
          (message) => message.role === 'user'
        )
        if (lastUser < 0) throw new Error('fixture_missing_user')
        const selected = scenarioFrom(
          textContent(body.messages[lastUser].content)
        )
        const record = getScenario(selected)
        record.modelCalls++
        const results = body.messages
          .slice(lastUser + 1)
          .filter((message) => message.role === 'tool')
        if (results.length) {
          const values = results.map((message) =>
            JSON.parse(textContent(message.content))
          )
          const result = values.find((value) => value.kind !== 'call_limit')
          if (
            !result ||
            !['execution', 'service_error', 'timeout', 'cancelled'].includes(
              result.kind
            )
          )
            throw new Error('fixture_tool_result_missing')
          if (
            selected.scenario === 'success' ||
            selected.scenario === 'double'
          ) {
            if (
              result.stdout?.text !== `CODEAPI_VALUE:${selected.nonce}` ||
              result.status !== 'succeeded'
            )
              throw new Error('fixture_result_not_grounded')
          }
          record.toolResults += values.length
          await persist()
          return stream(
            res,
            {
              role: 'assistant',
              content: `CODEAPI_RESULT:${selected.nonce}:${result.kind}:${result.status ?? 'none'}`,
            },
            'stop'
          )
        }
        const available = body.tools?.some(
          (entry) =>
            entry.type === 'function' && entry.function?.name === 'run_python'
        )
        if (!available) {
          await persist()
          return stream(
            res,
            {
              role: 'assistant',
              content: `CODEAPI_UNAVAILABLE:${selected.nonce}`,
            },
            'stop'
          )
        }
        if (record.modelCalls > 1) throw new Error('fixture_redispatch')
        const calls = Array.from(
          { length: selected.scenario === 'double' ? 2 : 1 },
          (_, index) => ({
            index,
            id: `call_${selected.nonce}_${index}`,
            type: 'function',
            function: {
              name: 'run_python',
              arguments: JSON.stringify({
                code: qualification
                  ? qualification.program(selected.scenario, selected.nonce)
                  : `# CODEAPI_E2E:${selected.scenario}:${selected.nonce}`,
              }),
            },
          })
        )
        await persist()
        return stream(
          res,
          { role: 'assistant', tool_calls: calls },
          'tool_calls'
        )
      }
      if (qualification)
        return json(res, 404, { error: 'fixture_exec_disabled' })
      if (
        mode !== 'enabled' ||
        req.headers['x-codeapi-expected-profile'] !== 'default' ||
        body.lang !== 'python' ||
        body.timeout !== 5000 ||
        !Array.isArray(body.files) ||
        body.files.length ||
        typeof body.code !== 'string' ||
        Object.keys(body).sort().join(',') !== 'code,files,lang,timeout'
      )
        throw new Error('fixture_exec_contract')
      const token = req.headers.authorization?.match(
        /^Bearer ([A-Za-z0-9_.-]+)$/
      )?.[1]
      const parts = token?.split('.')
      if (parts?.length !== 3) throw new Error('fixture_auth')
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
      const now = Math.floor(Date.now() / 1000)
      if (
        header.alg !== 'EdDSA' ||
        header.kid !== keyId ||
        header.typ !== 'JWT' ||
        !verify(
          null,
          Buffer.from(`${parts[0]}.${parts[1]}`),
          publicKey,
          Buffer.from(parts[2], 'base64url')
        ) ||
        claims.iss !== issuer ||
        claims.aud !== audience ||
        claims.tenant_id !== 'synthetic' ||
        claims.principal_source !== 'external:klicker' ||
        !/^[a-f0-9]{64}$/.test(claims.sub) ||
        !/^[a-f0-9]{64}$/.test(claims.auth_context_hash) ||
        !Number.isInteger(claims.nbf) ||
        claims.nbf > now ||
        claims.iat !== claims.nbf ||
        claims.exp <= now ||
        claims.exp - claims.iat !== 120 ||
        typeof claims.jti !== 'string' ||
        jwtIds.has(claims.jti)
      )
        throw new Error('fixture_auth')
      jwtIds.add(claims.jti)
      const selected = scenarioFrom(body.code)
      const record = getScenario(selected)
      if (record.modelCalls !== 1 || record.dispatches)
        throw new Error('fixture_dispatch_contract')
      record.dispatches++
      await persist()
      if (selected.scenario === 'stop') {
        const timer = setTimeout(() => {
          timers.delete(timer)
          record.completed++
          json(res, 504, { error: 'fixture_block_deadline' })
          void persist().catch(() => server.closeAllConnections())
        }, blockedMs)
        timers.add(timer)
        res.once('close', () => {
          clearTimeout(timer)
          timers.delete(timer)
          if (!res.writableEnded) {
            record.disconnected++
            void persist().catch(() => server.closeAllConnections())
          }
        })
        return
      }
      record.completed++
      await persist()
      if (selected.scenario === 'http-error')
        return json(res, 503, { error: 'synthetic_failure' })
      return json(res, 200, {
        session_id: 'synthetic',
        stdout:
          selected.scenario === 'python-error' ||
          selected.scenario === 'timeout'
            ? ''
            : `CODEAPI_VALUE:${selected.nonce}`,
        stderr: '',
        files: [],
        code:
          selected.scenario === 'python-error'
            ? 1
            : selected.scenario === 'timeout'
              ? 137
              : 0,
        ...(selected.scenario === 'timeout'
          ? { signal: 'SIGKILL', status: 'timeout' }
          : {}),
      })
    } catch {
      if (!res.headersSent && !res.destroyed)
        json(res, 400, { error: 'fixture_contract' })
      else res.destroy()
    }
  })
  server.requestTimeout = 15_000
  server.headersTimeout = 10_000
  server.keepAliveTimeout = 1000
  server.on('connection', (socket) => {
    if (sockets.size >= 16) return socket.destroy()
    sockets.add(socket)
    socket.setTimeout(25_000, () => socket.destroy())
    socket.once('close', () => sockets.delete(socket))
  })
  const close = () => {
    if (closing) return closing
    closing = (async () => {
      clearTimeout(lifetime)
      for (const timer of timers) clearTimeout(timer)
      for (const socket of sockets) socket.destroy()
      await new Promise((resolve) => server.close(resolve))
      state.ready = false
      await persist()
    })()
    return closing
  }
  const lifetime = setTimeout(() => void close().catch(() => {}), lifetimeMs)
  lifetime.unref()
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    state.ready = !deferReady
    await persist()
  } catch (error) {
    await close()
    throw error
  }
  const origin = `https://127.0.0.1:${server.address().port}`
  return {
    state,
    origin,
    close,
    cert: tls.cert,
    publicKey,
    ready: async () => {
      state.ready = true
      await persist()
    },
    childEnv: {
      OPENAI_API_KEY: 'local-fixture',
      OPENAI_BASE_URL: `${origin}/v1`,
      CHAT_PRIMARY_MODEL_ID: 'auto',
      CHAT_MODEL_REGISTRY_JSON: JSON.stringify(fixtureRegistry()),
      KLICKER_EVAL_GUARD_ORIGIN: origin,
      KLICKER_EVAL_GUARD_GENERATION: state.generation,
      CHAT_CODEAPI_ENABLED: String(mode === 'enabled'),
      CHAT_CODEAPI_PILOT_CHATBOT_IDS: JSON.stringify([
        CODEAPI_BROWSER_CHATBOT_ID,
      ]),
      CHAT_CODEAPI_BASE_URL: qualification?.origin ?? origin,
      CHAT_CODEAPI_JWT_ISSUER: qualification
        ? 'klicker-stg-qualification'
        : issuer,
      CHAT_CODEAPI_JWT_AUDIENCE: qualification
        ? 'klicker-stg-qualification'
        : audience,
      CHAT_CODEAPI_JWT_KEY_ID: qualification?.keyId ?? keyId,
      CHAT_CODEAPI_TENANT_ID: 'synthetic',
      CHAT_CODEAPI_JWT_PRIVATE_KEY: privateKey.export({
        type: 'pkcs8',
        format: 'pem',
      }),
    },
  }
}

export async function fixtureMode(env = process.env, checkout = root) {
  let mode
  try {
    mode = (await readFile(path.join(checkout, markerPath), 'utf8')).trim()
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
  if (
    env.NODE_ENV !== 'test' ||
    env.KLICKER_CODEAPI_FIXTURE_MODE !== mode ||
    !['enabled', 'disabled'].includes(mode)
  )
    throw new Error('fixture_marker_invalid')
  try {
    await readFile(
      path.join(checkout, '.devcontainer/.runtime/beta-enrollment-fixture')
    )
    throw new Error('fixture_marker_conflict')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  return mode
}

async function main() {
  let fixture, directory, child, forcedExit, lifetime
  const stopped = new AbortController()
  const signalChild = (signal) => {
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      try {
        child.kill(signal)
      } catch (error) {
        if (error.code !== 'ESRCH') throw error
      }
    }
  }
  const stop = () => {
    stopped.abort()
    signalChild('SIGTERM')
    if (child && !forcedExit)
      forcedExit = setTimeout(() => signalChild('SIGKILL'), 5000)
  }
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop)
  try {
    const mode = await fixtureMode()
    stopped.signal.throwIfAborted()
    const env = { ...process.env }
    if (mode) {
      directory = await mkdtemp(path.join(tmpdir(), 'codeapi-browser-fixture-'))
      stopped.signal.throwIfAborted()
      fixture = await startFixture({
        mode,
        statusPath: path.join(root, FIXTURE_STATUS_PATH),
        deferReady: true,
      })
      stopped.signal.throwIfAborted()
      if (!env.NODE_EXTRA_CA_CERTS) throw new Error('fixture_local_ca_missing')
      const existingCA = await readFile(env.NODE_EXTRA_CA_CERTS)
      const trustPath = path.join(directory, 'public-trust.pem')
      await writeFile(
        trustPath,
        Buffer.concat([existingCA, Buffer.from('\n'), fixture.cert]),
        { mode: 0o600 }
      )
      Object.assign(env, fixture.childEnv, { NODE_EXTRA_CA_CERTS: trustPath })
      delete env.LANGFUSE_PUBLIC_KEY
      delete env.LANGFUSE_SECRET_KEY
    }
    stopped.signal.throwIfAborted()
    const next = fileURLToPath(
      new URL('../node_modules/next/dist/bin/next', import.meta.url)
    )
    child = spawn(
      process.execPath,
      [next, 'dev', '--turbopack', '--port', '3004'],
      { env, stdio: 'inherit' }
    )
    const exit = new Promise((resolve, reject) => {
      child.once('exit', (code) => resolve(code ?? 1))
      child.once('error', reject)
    })
    void exit.catch(() => {})
    if (fixture) {
      await new Promise((resolve, reject) => {
        child.once('spawn', resolve)
        child.once('error', reject)
      })
      stopped.signal.throwIfAborted()
      await fixture.ready()
      lifetime = setTimeout(stop, 20 * 60_000)
    }
    process.exitCode = await exit
  } catch {
    if (!stopped.signal.aborted)
      console.error('codeapi_browser_fixture_startup_failed')
    process.exitCode = 1
  } finally {
    clearTimeout(lifetime)
    clearTimeout(forcedExit)
    // Keep Next in the managed group so forced replacement contains it too.
    signalChild('SIGKILL')
    await fixture?.close()
    if (directory) await rm(directory, { recursive: true, force: true })
    for (const signal of ['SIGINT', 'SIGTERM'])
      process.removeListener(signal, stop)
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main()
