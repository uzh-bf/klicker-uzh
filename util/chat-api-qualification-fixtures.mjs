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
export const DEFAULT_ENGINE_ID = 'public-ai-sdk'

async function jsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 32 * 1024 * 1024)
      throw new Error('Fixture request exceeds bound')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString())
}

/** Local deterministic transports; this module never evaluates Python. */
export async function startQualificationFixtures({
  hostname,
  chatbotId,
  participantId,
  courseId,
  mcpName = `qual_${chatbotId.replaceAll('-', '').slice(0, 8)}`,
}) {
  if (
    process.env.CHAT_API_QUALIFICATION !== '1' ||
    !/^[a-z0-9.-]+$/.test(hostname) ||
    !/^qual_[a-f0-9]{8}$/.test(mcpName)
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
      `subjectAltName=${/^\d+\.\d+\.\d+\.\d+$/.test(hostname) ? 'IP' : 'DNS'}:${hostname},IP:127.0.0.1`,
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
    calculatorResults: 0,
    courseCalls: 0,
    courseResults: 0,
    practiceLookups: 0,
    practiceStarts: 0,
    practiceSubmissions: 0,
    practiceResults: 0,
    cancelledCalls: 0,
    inputImages: 0,
    replyImages: 0,
    contextCalls: 0,
    elearningOriginalCalls: 0,
    elearningLiveCalls: 0,
    historyCalls: 0,
    documentCalls: 0,
    contextObserved: false,
    historyObserved: false,
    documentObserved: false,
    projectedCitation: false,
    violations: 0,
  }
  let behavior = 'success'
  let scenario = 'python'
  const questionRef = `synthetic-practice-${nonce}`
  const practiceQuiz = () => ({
    chatbotId,
    courseId,
    questionRef,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    stack: {
      stackId: 13,
      stackTitle: 'Synthetic practice',
      elements: [
        {
          id: 13,
          type: 'PRACTICE_QUIZ',
          elementType: 'NUMERICAL',
          elementData: {
            __typename: 'NumericalElementData',
            id: '13',
            name: 'Synthetic calculation',
            type: 'NUMERICAL',
            content: 'Calculate one plus one.',
            options: {},
          },
        },
      ],
    },
  })
  const used = new Set()
  const tenant = 'synthetic-chat-api-qualification'
  const scopeHash = (parts) =>
    createHash('sha256').update(JSON.stringify(parts)).digest('hex')
  const guarded = (handler) => async (request, response) => {
    try {
      await handler(request, response)
    } catch (error) {
      stats.lastViolation = {
        method: request.method,
        path: ['/mcp', '/v1/responses', '/v1/exec'].includes(request.url)
          ? request.url
          : 'unexpected',
        kind: error.name,
      }
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
          if (!response.writableEnded) stats.cancelledCalls += 1
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
  const course = createServer(
    guarded(async (request, response) => {
      const student = request.url === '/student-mcp'
      assert(student || request.url === '/mcp')
      if (request.method === 'GET') {
        // The streamable HTTP client probes an optional server event stream.
        response.writeHead(405, { Allow: 'POST, DELETE' }).end()
        return
      }
      if (request.method === 'DELETE') {
        response.writeHead(204).end()
        return
      }
      assert.equal(request.method, 'POST')
      if (student) {
        const { verifyJWT } = await import('../packages/util/dist/index.js')
        const claims = await verifyJWT(
          request.headers.authorization?.slice(7) ?? '',
          process.env.MCP_STUDENT_JWT_SECRET ?? process.env.APP_SECRET,
          { issuer: process.env.APP_ORIGIN_AUTH }
        )
        assert.equal(claims.sub, participantId)
        assert.equal(claims.role, 'PARTICIPANT')
        assert.equal(claims.purpose, 'student-mcp')
        assert(claims.scope.split(' ').includes('student:practice:submit'))
      } else assert.equal(request.headers['x-qualification-chatbot'], chatbotId)
      const message = await jsonBody(request)
      if (message.id === undefined) {
        response.writeHead(202).end()
        return
      }
      let result
      if (message.method === 'initialize') {
        result = {
          protocolVersion: message.params.protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: 'synthetic-qualification', version: '1' },
        }
      } else if (message.method === 'tools/list' && student) {
        result = {
          tools: [
            'lookup_relevant_practice_stacks',
            'get_practice_stack_for_quiz',
            'submit_practice_stack_answer',
          ].map((name) => ({
            name,
            description: 'Synthetic participant practice transport.',
            inputSchema: { type: 'object', additionalProperties: true },
          })),
        }
      } else if (message.method === 'tools/call' && student) {
        const args = message.params.arguments
        let value
        if (message.params.name === 'lookup_relevant_practice_stacks') {
          assert.equal(args.chatbotId, chatbotId)
          assert.equal(args.courseId, courseId)
          assert(++stats.practiceLookups <= 128)
          value = {
            candidates: [
              {
                questionRef,
                questionRefExpiresAt: practiceQuiz().expiresAt,
                stackTitle: 'Synthetic practice',
                sourcePracticeQuizTitle: 'Synthetic quiz',
                courseId,
                tags: [],
                supportedElementTypes: ['NUMERICAL'],
                shortQuestionPreview: 'Synthetic calculation',
                relevanceScore: 1,
                srsScore: 1,
                reason: 'Synthetic candidate',
              },
            ],
          }
        } else if (message.params.name === 'get_practice_stack_for_quiz') {
          assert.equal(args.questionRef, questionRef)
          assert(++stats.practiceStarts <= 12)
          value = practiceQuiz()
        } else {
          assert.equal(message.params.name, 'submit_practice_stack_answer')
          assert.equal(args.questionRef, questionRef)
          assert.deepEqual(args.responses, [
            { instanceId: 13, type: 'NUMERICAL', numericalResponse: 2 },
          ])
          assert(++stats.practiceSubmissions <= 12)
          value = {
            chatbotId,
            courseId,
            stackId: 13,
            result: { evaluations: [] },
          }
        }
        result = { content: [{ type: 'text', text: JSON.stringify(value) }] }
      } else if (message.method === 'tools/list') {
        result = {
          tools: [
            {
              name: 'doc_query',
              description: 'Retrieve the synthetic course source.',
              inputSchema: {
                type: 'object',
                properties: { query: { type: 'string' } },
                required: ['query'],
                additionalProperties: false,
              },
            },
          ],
        }
      } else if (message.method === 'tools/call') {
        assert.equal(message.params.name, 'doc_query')
        assert.equal(typeof message.params.arguments.query, 'string')
        assert(++stats.courseCalls <= 32)
        result = {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                mode: 'answer',
                answer: 'synthetic-course-answer',
                sources: [
                  {
                    display_name: 'Synthetic course source',
                    source_url: 'https://example.invalid/source',
                  },
                ],
              }),
            },
          ],
        }
      } else throw new Error('Unknown MCP method')
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }))
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
      assert(stats.modelCalls <= 128)
      assert(Array.isArray(body.input))
      const userIndex = body.input.findLastIndex((item) => item.role === 'user')
      const result = body.input
        .slice(userIndex + 1)
        .find((item) => item.type === 'function_call_output')
      const names = (body.tools ?? []).map((tool) => tool.name)
      const toolName =
        scenario === 'python'
          ? 'run_python'
          : scenario === 'course'
            ? `${mcpName}_doc_query`
            : scenario === 'practice'
              ? 'start_student_practice_quiz'
              : 'calculate'
      const input = JSON.stringify(body.input)
      const allInput = JSON.stringify(body)
      stats.imageDescriptionsObserved ||= allInput.includes(
        'synthetic-auxiliary-description'
      )
      stats.inputImages = Math.max(
        stats.inputImages,
        (input.match(/"type":"input_image"/g) ?? []).length
      )
      if (names.length)
        stats.lastReplyImages = (
          input.match(/"type":"input_image"/g) ?? []
        ).length
      if (names.length)
        stats.replyImages = Math.max(
          stats.replyImages,
          (input.match(/"type":"input_image"/g) ?? []).length
        )
      if (allInput.includes('synthetic-context-marker')) stats.contextCalls += 1
      if (allInput.includes('synthetic-elearning-original-evidence'))
        stats.elearningOriginalCalls += 1
      if (allInput.includes('synthetic-elearning-live-evidence'))
        stats.elearningLiveCalls += 1
      if (input.includes('synthetic-history-marker')) stats.historyCalls += 1
      if (input.includes('synthetic-document-marker')) stats.documentCalls += 1
      stats.contextObserved ||= allInput.includes('synthetic-context-marker')
      stats.historyObserved ||= input.includes('synthetic-history-marker')
      stats.documentObserved ||= input.includes('synthetic-document-marker')
      if (result) {
        const output =
          typeof result.output === 'string'
            ? result.output
            : JSON.stringify(result.output)
        if (scenario === 'python') {
          const parsed = JSON.parse(output)
          stats.resultConsumed =
            parsed.kind === 'execution' && parsed.stdout.text === `${nonce}\n`
          if (behavior !== 'failure') assert(stats.resultConsumed)
        } else if (scenario === 'calculator') {
          assert(output.includes('2'))
          stats.calculatorResults += 1
        } else if (scenario === 'course') {
          assert(output.includes('synthetic-course-answer'))
          stats.courseResults += 1
          stats.projectedCitation ||= /citation_index.{1,12}1/.test(output)
        } else if (scenario === 'practice') {
          assert(output.length > 0)
          assert(!output.includes(questionRef))
          assert(!output.includes('elementData'))
          stats.practiceResults += 1
        }
      }
      if (behavior === 'cancel' && result) {
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        response.write(
          `data: ${JSON.stringify({ type: 'response.created', response: { id: randomUUID(), created_at: Math.floor(Date.now() / 1000), model: body.model } })}\n\n`
        )
        response.on('close', () => {
          if (!response.writableEnded) stats.cancelledCalls += 1
        })
        return
      }
      if (body.stream !== true) {
        const output = [
          {
            type: 'message',
            id: randomUUID(),
            role: 'assistant',
            status: 'completed',
            content: [
              {
                type: 'output_text',
                text: 'synthetic-auxiliary-description',
                annotations: [],
              },
            ],
          },
        ]
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(
          JSON.stringify({
            id: randomUUID(),
            object: 'response',
            created_at: Math.floor(Date.now() / 1000),
            status: 'completed',
            model: body.model,
            output,
            usage: {
              input_tokens: 7,
              output_tokens: 3,
              total_tokens: 10,
              input_tokens_details: { cached_tokens: 0 },
              output_tokens_details: { reasoning_tokens: 0 },
            },
          })
        )
        return
      }
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
      if (scenario !== 'plain' && names.includes(toolName) && !result) {
        const args = JSON.stringify(
          scenario === 'python'
            ? { code: 'print(1 + 1)' }
            : scenario === 'course'
              ? { query: 'synthetic query' }
              : scenario === 'practice'
                ? { candidateId: 'practice_1' }
                : { expressions: ['1 + 1'] }
        )
        const item = {
          type: 'function_call',
          status: 'completed',
          id: randomUUID(),
          call_id: randomUUID(),
          name: toolName,
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
              : scenario === 'plain'
                ? answer
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
  const servers = [backend, course, provider]
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
  const providerOrigin = `http://${hostname}:${provider.address().port}`
  return {
    apiEnvironment,
    engineEnvironment,
    certificate,
    answer,
    providerOrigin,
    localProviderOrigin: `http://127.0.0.1:${provider.address().port}`,
    courseUrl: `http://127.0.0.1:${course.address().port}/mcp`,
    studentPracticeUrl: `http://127.0.0.1:${course.address().port}/student-mcp`,
    practiceQuiz,
    stats: () => ({ ...stats }),
    browserStats: () => ({ ...stats }),
    setScenario: (value) => {
      if (
        !['plain', 'calculator', 'course', 'python', 'practice'].includes(value)
      )
        throw new Error('Invalid fixture scenario')
      scenario = value
    },
    setBehavior: (value) => {
      if (!['success', 'cancel', 'failure'].includes(value))
        throw new Error('Invalid fixture scenario')
      behavior = value
    },
    close,
  }
}
