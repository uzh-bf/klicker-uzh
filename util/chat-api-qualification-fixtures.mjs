import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  createHash,
  generateKeyPairSync,
  randomUUID,
  verify,
} from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { createServer as createTlsServer } from 'node:https'

export const SYNTHETIC_SERVICE_TOKEN = 'local-chat-qualification-service'
export const SYNTHETIC_PROVIDER_TOKEN = 'local-chat-qualification-provider'
export const QUALIFICATION_ENGINE_ID = 'klicker-uzh-catalyst-tutoring-engine'

async function jsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 128 * 1024) throw new Error('Fixture request exceeds bound')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString())
}

/** Local deterministic transports; this module never evaluates Python. */
export async function startQualificationFixtures({
  hostname,
  chatbotId,
  participantId,
}) {
  if (
    process.env.CHAT_API_QUALIFICATION !== '1' ||
    !/^[a-z0-9-]+$/.test(hostname)
  )
    throw new Error('Explicit local qualification configuration required')
  const keys = generateKeyPairSync('ed25519')
  const tls = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const certificate = execFileSync(
    'sh',
    [
      '-c',
      'cat | openssl req -new -x509 -key /dev/stdin -subj "$1" -addext "$2" -days 1',
      'qualification-certificate',
      `/CN=${hostname}`,
      `subjectAltName=DNS:${hostname},IP:127.0.0.1`,
    ],
    {
      input: tls.privateKey.export({ type: 'pkcs8', format: 'pem' }),
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 10000,
    }
  ).toString()
  const nonce = randomUUID()
  const answer = `synthetic-result:${nonce}`
  const stats = {
    modelCalls: 0,
    codeApiCalls: 0,
    resultConsumed: false,
    violations: 0,
  }
  let behavior = 'success'
  let cancelledCalls = 0
  const used = new Set()
  const tenant = 'synthetic-chat-api-qualification'
  const scopeHash = (parts) =>
    createHash('sha256').update(JSON.stringify(parts)).digest('hex')
  const guarded = (handler) => async (request, response) => {
    try {
      await handler(request, response)
    } catch {
      stats.violations += 1
      if (!response.headersSent)
        response.writeHead(400, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'fixture-contract-violation' }))
    }
  }
  const backend = createTlsServer(
    {
      key: tls.privateKey.export({ type: 'pkcs8', format: 'pem' }),
      cert: certificate,
    },
    guarded(async (request, response) => {
      assert.equal(request.method, 'POST')
      assert.equal(request.url, '/v1/exec')
      assert.equal(request.headers['x-codeapi-expected-profile'], 'default')
      const token = request.headers.authorization?.slice(7) ?? ''
      const [header, payload, signature] = token.split('.')
      assert(header && payload && signature)
      assert(
        verify(
          null,
          Buffer.from(`${header}.${payload}`),
          keys.publicKey,
          Buffer.from(signature, 'base64url')
        )
      )
      assert.deepEqual(
        JSON.parse(Buffer.from(header, 'base64url').toString()),
        { alg: 'EdDSA', typ: 'JWT', kid: 'synthetic-key' }
      )
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
      assert.equal(claims.iss, 'synthetic-host')
      assert.equal(claims.aud, 'synthetic-codeapi')
      assert(claims.nbf <= Date.now() / 1000)
      assert.equal(typeof claims.run_id, 'string')
      const subject = scopeHash([
        'klicker-codeapi-sub-v1',
        tenant,
        participantId,
      ])
      assert.equal(claims.sub, subject)
      assert.equal(claims.tenant_id, tenant)
      assert.equal(claims.chatbot_id, chatbotId)
      assert.equal(claims.principal_source, 'external:klicker')
      assert.equal(
        claims.auth_context_hash,
        scopeHash([
          'klicker-codeapi-context-v1',
          tenant,
          chatbotId,
          subject,
          'external:klicker',
        ])
      )
      assert(claims.exp > Date.now() / 1000 && claims.exp - claims.iat <= 120)
      assert(!used.has(claims.jti))
      const input = await jsonBody(request)
      assert.equal(input.lang, 'python')
      assert.equal(input.timeout, 5000)
      assert.deepEqual(input.files, [])
      assert.equal(typeof input.code, 'string')
      assert(Buffer.byteLength(input.code) <= 16 * 1024)
      assert(
        Buffer.byteLength(JSON.stringify({ code: input.code })) <= 16 * 1024
      )
      used.add(claims.jti)
      stats.codeApiCalls += 1
      if (behavior === 'cancel') {
        response.on('close', () => {
          if (!response.writableEnded) cancelledCalls += 1
        })
        return
      }
      if (behavior === 'failure') {
        response.writeHead(503, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ error: 'synthetic-unavailable' }))
        return
      }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          session_id: randomUUID(),
          stdout: `${nonce}\n`,
          stderr: '',
          files: [],
          code: 0,
        })
      )
    })
  )
  const provider = createServer(
    guarded(async (request, response) => {
      assert.equal(request.method, 'POST')
      assert.equal(request.url, '/v1/responses')
      assert.equal(
        request.headers.authorization,
        `Bearer ${SYNTHETIC_PROVIDER_TOKEN}`
      )
      const body = await jsonBody(request)
      stats.modelCalls += 1
      assert(stats.modelCalls <= 32)
      const userIndex = body.input.findLastIndex((item) => item.role === 'user')
      const result = body.input
        .slice(userIndex + 1)
        .find((item) => item.type === 'function_call_output')
      const hasPython = body.tools?.some((tool) => tool.name === 'run_python')
      const events = [
        {
          type: 'response.created',
          response: {
            id: randomUUID(),
            created_at: Math.floor(Date.now() / 1000),
            model: body.model,
          },
        },
      ]
      if (hasPython && !result) {
        const args = JSON.stringify({ code: 'print(1 + 1)' })
        const item = {
          type: 'function_call',
          status: 'completed',
          id: randomUUID(),
          call_id: randomUUID(),
          name: 'run_python',
          arguments: args,
        }
        events.push(
          {
            type: 'response.output_item.added',
            output_index: 0,
            item: { ...item, arguments: '' },
          },
          {
            type: 'response.function_call_arguments.delta',
            item_id: item.id,
            output_index: 0,
            delta: args,
          },
          { type: 'response.output_item.done', output_index: 0, item }
        )
      } else {
        if (result) {
          const output = JSON.parse(result.output)
          stats.resultConsumed =
            output.kind === 'execution' && output.stdout.text === `${nonce}\n`
          if (behavior !== 'failure') assert(stats.resultConsumed)
        }
        const item = { type: 'message', id: randomUUID() }
        events.push(
          { type: 'response.output_item.added', output_index: 0, item },
          {
            type: 'response.output_text.delta',
            item_id: item.id,
            delta: result
              ? behavior === 'failure'
                ? 'synthetic-service-unavailable'
                : answer
              : 'synthetic-without-tool',
          },
          { type: 'response.output_item.done', output_index: 0, item }
        )
      }
      events.push({
        type: 'response.completed',
        response: {
          usage: {
            input_tokens: 7,
            output_tokens: 3,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
        },
      })
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      for (const event of events)
        response.write(`data: ${JSON.stringify(event)}\n\n`)
      response.end('data: [DONE]\n\n')
    })
  )
  const servers = [backend, provider]
  async function close() {
    for (const server of servers) {
      server.closeAllConnections()
      await new Promise((resolve) => server.close(() => resolve()))
    }
  }
  try {
    for (const server of servers) {
      server.listen(0, '0.0.0.0')
      await once(server, 'listening')
    }
  } catch (error) {
    await close()
    throw error
  }
  const common = {
    JWT_ISSUER: 'synthetic-host',
    JWT_AUDIENCE: 'synthetic-codeapi',
    JWT_KEY_ID: 'synthetic-key',
    TENANT_ID: tenant,
    PILOT_CHATBOT_IDS: JSON.stringify([chatbotId]),
  }
  const apiEnvironment = Object.fromEntries(
    Object.entries(common).map(([key, value]) => [`CHAT_CODEAPI_${key}`, value])
  )
  apiEnvironment.CHAT_CODEAPI_ENABLED = 'true'
  apiEnvironment.CHAT_CODEAPI_JWT_PRIVATE_KEY = keys.privateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString()
  const engineEnvironment = Object.fromEntries(
    Object.entries(common).map(([key, value]) => [
      `CATALYST_ENGINE_CODEAPI_${key}`,
      value,
    ])
  )
  engineEnvironment.CATALYST_ENGINE_CODEAPI_ENABLED = 'true'
  engineEnvironment.CATALYST_ENGINE_CODEAPI_JWT_PUBLIC_KEY = keys.publicKey
    .export({ type: 'spki', format: 'pem' })
    .toString()
  engineEnvironment.CATALYST_ENGINE_CODEAPI_BASE_URL = `https://${hostname}:${backend.address().port}`
  engineEnvironment.CATALYST_ENGINE_PROVIDER_BASE_URL = `http://${hostname}:${provider.address().port}/v1`
  engineEnvironment.CATALYST_ENGINE_PROVIDER_API_KEY = SYNTHETIC_PROVIDER_TOKEN
  engineEnvironment.CATALYST_ENGINE_SERVICE_TOKEN = SYNTHETIC_SERVICE_TOKEN
  return {
    apiEnvironment,
    engineEnvironment,
    certificate,
    answer,
    stats: () => ({ ...stats }),
    browserStats: () => ({ ...stats, cancelledCalls }),
    setBehavior: (value) => {
      if (!['success', 'cancel', 'failure'].includes(value))
        throw new Error('Invalid fixture scenario')
      behavior = value
    },
    close,
  }
}
