import { generateKeyPairSync, type KeyObject } from 'node:crypto'
import { generateText, isStepCount, type ToolSet } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { jwtVerify } from 'jose'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  CODEAPI_TOOL_NAME,
  withCodeApiTool,
} from '../src/lib/server/codeapiTool'

const BASE_URL = 'https://codeapi.example.test'
const ISSUER = 'https://chat.klicker.test'
const AUDIENCE = 'klicker-codeapi-test'
const KID = 'test-ed25519-key'
const TENANT = 'synthetic-tenant'
const CHATBOT_ID = 'synthetic-tutor-bot'
const SECOND_CHATBOT_ID = 'synthetic-second-tutor-bot'
const PARTICIPANT_ID = 'synthetic-participant-id'
const RESPONSE_LIMIT = 128 * 1024
const OUTPUT_LIMIT = 16 * 1024

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

type ToolExecute = (
  input: unknown,
  options?: {
    toolCallId?: string
    messages?: unknown[]
    abortSignal?: AbortSignal
  }
) => Promise<unknown>

let publicKey: KeyObject
let fetchMock: ReturnType<typeof vi.fn<FetchImplementation>>

function stubConfiguration() {
  vi.stubEnv('CHAT_CODEAPI_ENABLED', 'true')
  vi.stubEnv('CHAT_CODEAPI_PILOT_CHATBOT_IDS', JSON.stringify([CHATBOT_ID]))
  vi.stubEnv('CHAT_CODEAPI_BASE_URL', BASE_URL)
  vi.stubEnv('CHAT_CODEAPI_JWT_ISSUER', ISSUER)
  vi.stubEnv('CHAT_CODEAPI_JWT_AUDIENCE', AUDIENCE)
  vi.stubEnv('CHAT_CODEAPI_JWT_KEY_ID', KID)
  vi.stubEnv('CHAT_CODEAPI_TENANT_ID', TENANT)
}

function makeContext(
  overrides: Partial<Parameters<typeof withCodeApiTool>[0]> = {}
): Parameters<typeof withCodeApiTool>[0] {
  return {
    chatMode: 'tutor',
    chatbotId: CHATBOT_ID,
    participantId: PARTICIPANT_ID,
    abortSignal: new AbortController().signal,
    ...overrides,
  }
}

function makeTools(context = makeContext(), existing: ToolSet = {}): ToolSet {
  return withCodeApiTool(context, existing)
}

function getExecute(tools: ToolSet): ToolExecute {
  const execute = tools[CODEAPI_TOOL_NAME]?.execute
  if (!execute) throw new Error('run_python was not admitted')
  const callback = execute as unknown as (
    input: unknown,
    options: {
      toolCallId: string
      messages: unknown[]
      abortSignal?: AbortSignal
    }
  ) => Promise<unknown>
  return (input, options = {}) =>
    callback(input, {
      toolCallId: 'synthetic-tool-call',
      messages: [],
      ...options,
    })
}

function jsonResponse(
  value: unknown,
  status = 200,
  headers: HeadersInit = {}
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json',
      ...Object.fromEntries(new Headers(headers)),
    },
  })
}

function executionResponse(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    session_id: 'synthetic-session-reference',
    stdout: 'synthetic output',
    stderr: '',
    code: 0,
    signal: null,
    status: null,
    wall_time: 0.25,
    files: [],
    ...overrides,
  }
}

beforeEach(() => {
  const keyPair = generateKeyPairSync('ed25519')
  publicKey = keyPair.publicKey
  vi.stubEnv(
    'CHAT_CODEAPI_JWT_PRIVATE_KEY',
    keyPair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
  )
  stubConfiguration()
  fetchMock = vi.fn<FetchImplementation>(async () => {
    throw new Error('Unexpected fetch in synthetic test')
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('run_python admission and execution', () => {
  test('does not add the tool or dispatch when admission or configuration denies it', () => {
    const deniedCases: Array<{
      name: string
      configure?: () => void
      context?: Parameters<typeof withCodeApiTool>[0]
    }> = [
      {
        name: 'default off',
        configure: () => delete process.env.CHAT_CODEAPI_ENABLED,
      },
      {
        name: 'missing participant policy context',
        context: makeContext({ participantId: '' }),
      },
      {
        name: 'non-Tutor mode',
        context: makeContext({ chatMode: 'quizzer' }),
      },
      {
        name: 'chatbot outside the pilot',
        configure: () =>
          vi.stubEnv(
            'CHAT_CODEAPI_PILOT_CHATBOT_IDS',
            JSON.stringify(['another-synthetic-bot'])
          ),
      },
      {
        name: 'invalid signing configuration',
        configure: () =>
          vi.stubEnv('CHAT_CODEAPI_JWT_PRIVATE_KEY', 'not-a-pem'),
      },
    ]

    for (const denied of deniedCases) {
      stubConfiguration()
      vi.stubEnv(
        'CHAT_CODEAPI_JWT_PRIVATE_KEY',
        generateKeyPairSync('ed25519')
          .privateKey.export({ format: 'pem', type: 'pkcs8' })
          .toString()
      )
      denied.configure?.()
      const tools = makeTools(denied.context ?? makeContext())
      expect(Object.hasOwn(tools, CODEAPI_TOOL_NAME), denied.name).toBe(false)
    }

    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('keeps an existing run_python tool on collision without dispatch', () => {
    const existingTool = { description: 'synthetic existing tool' }
    const existing = {
      [CODEAPI_TOOL_NAME]: existingTool,
    } as unknown as ToolSet

    const tools = makeTools(makeContext(), existing)

    expect(tools).toBe(existing)
    expect(tools[CODEAPI_TOOL_NAME]).toBe(existingTool)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('rechecks the feature gate when the admitted callback executes', async () => {
    const execute = getExecute(makeTools())
    vi.stubEnv('CHAT_CODEAPI_ENABLED', 'false')

    await expect(execute({ code: 'print(1)' }, {})).resolves.toEqual({
      kind: 'unavailable',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('verifies the signed request and returns no session or file references', async () => {
    const sessionReference = 'synthetic-session-reference'
    const fileReference = 'synthetic-private-file-reference'
    const extensionReference = 'synthetic-extension-reference'
    vi.stubEnv(
      'CHAT_CODEAPI_PILOT_CHATBOT_IDS',
      JSON.stringify([CHATBOT_ID, SECOND_CHATBOT_ID])
    )
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        executionResponse({
          stdout: 'synthetic output: 42\n',
          files: [{ id: fileReference, name: 'synthetic.csv' }],
          deleted_files: [extensionReference],
          pending_tool_calls_payload: { reference: extensionReference },
        })
      )
    )
    fetchMock.mockResolvedValue(jsonResponse(executionResponse()))
    const tools = makeTools()
    const result = await getExecute(tools)({ code: 'print(6 * 7)' }, {})

    expect(result).toEqual({
      kind: 'execution',
      status: 'succeeded',
      exitCode: 0,
      stdout: { text: 'synthetic output: 42\n', truncated: false },
      stderr: { text: '', truncated: false },
      filesOmitted: true,
    })
    expect(JSON.stringify(result)).not.toContain(sessionReference)
    expect(JSON.stringify(result)).not.toContain(fileReference)
    expect(JSON.stringify(result)).not.toContain(extensionReference)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe(`${BASE_URL}/v1/exec`)
    expect(init?.method).toBe('POST')
    expect(init?.redirect).toBe('error')
    expect(init?.body).toBe(
      JSON.stringify({
        code: 'print(6 * 7)',
        lang: 'python',
        files: [],
        timeout: 5000,
      })
    )
    const headers = new Headers(init?.headers)
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('X-CodeAPI-Expected-Profile')).toBe('default')

    const authorization = headers.get('authorization')
    expect(authorization).toMatch(/^Bearer /)
    const token = authorization!.slice('Bearer '.length)
    const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
      algorithms: ['EdDSA'],
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    expect(protectedHeader).toEqual({ alg: 'EdDSA', typ: 'JWT', kid: KID })
    expect(payload).toMatchObject({
      iss: ISSUER,
      aud: AUDIENCE,
      tenant_id: TENANT,
      principal_source: 'external:klicker',
    })
    expect(payload.sub).not.toBe(PARTICIPANT_ID)
    expect(payload.auth_context_hash).toEqual(expect.any(String))
    expect(payload.iat).toEqual(expect.any(Number))
    expect(payload.nbf).toEqual(expect.any(Number))
    expect(payload.nbf).toBe(payload.iat)
    expect(payload.exp! - payload.iat!).toBe(120)
    expect(payload.jti).toEqual(expect.any(String))

    await getExecute(makeTools(makeContext({ chatbotId: SECOND_CHATBOT_ID })))({
      code: 'pass',
    })
    await getExecute(
      makeTools(makeContext({ participantId: 'synthetic-other-participant' }))
    )({ code: 'pass' })
    const secondToken = new Headers(fetchMock.mock.calls[1][1]?.headers)
      .get('authorization')!
      .slice('Bearer '.length)
    const thirdToken = new Headers(fetchMock.mock.calls[2][1]?.headers)
      .get('authorization')!
      .slice('Bearer '.length)
    const { payload: secondPayload } = await jwtVerify(secondToken, publicKey, {
      algorithms: ['EdDSA'],
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    const { payload: thirdPayload } = await jwtVerify(thirdToken, publicKey, {
      algorithms: ['EdDSA'],
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    expect(secondPayload.sub).toBe(payload.sub)
    expect(secondPayload.auth_context_hash).not.toBe(payload.auth_context_hash)
    expect(thirdPayload.sub).not.toBe(payload.sub)
  })

  test('distinguishes success, nonzero exit, signal termination, and unknown exit', async () => {
    const cases = [
      { response: { code: 0, signal: null }, status: 'succeeded', exitCode: 0 },
      { response: { code: 7, signal: null }, status: 'failed', exitCode: 7 },
      {
        response: { code: 0, signal: 'SIGTERM' },
        status: 'failed',
        exitCode: 0,
      },
      {
        response: { code: null, signal: 'SIGKILL', status: 'TO' },
        status: 'failed',
        exitCode: null,
      },
      ...['SG', 'OL', 'EL'].map((status) => ({
        response: { code: 0, signal: null, status },
        status: 'failed',
        exitCode: 0,
      })),
      {
        response: { code: null, signal: null },
        status: 'unknown',
        exitCode: null,
      },
    ] as const

    for (const testCase of cases) {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(executionResponse(testCase.response))
      )
      const result = (await getExecute(makeTools())({ code: 'pass' }, {})) as {
        status: string
        exitCode: number | null
      }
      expect(result.status).toBe(testCase.status)
      expect(result.exitCode).toBe(testCase.exitCode)
    }
    expect(fetchMock).toHaveBeenCalledTimes(cases.length)
  })

  test('reserves one concurrent call before transport and never retries', async () => {
    let releaseResponse!: (response: Response) => void
    let markFetchStarted!: () => void
    const response = new Promise<Response>((resolve) => {
      releaseResponse = resolve
    })
    const fetchStarted = new Promise<void>((resolve) => {
      markFetchStarted = resolve
    })
    fetchMock.mockImplementation(async () => {
      markFetchStarted()
      return response
    })
    const execute = getExecute(makeTools())

    const first = execute({ code: 'print(1)' }, {})
    await fetchStarted
    await expect(execute({ code: 'print(2)' }, {})).resolves.toEqual({
      kind: 'call_limit',
    })
    releaseResponse(jsonResponse({ error: 'synthetic upstream detail' }, 503))

    const firstResult = await first
    expect(firstResult).toEqual({ kind: 'service_error', status: 503 })
    expect(JSON.stringify(firstResult)).not.toContain(
      'synthetic upstream detail'
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('rejects invalid and oversized multibyte input before fetch', async () => {
    const execute = getExecute(makeTools())

    await expect(execute({ code: '' }, {})).resolves.toEqual({
      kind: 'invalid_input',
    })
    await expect(execute({ code: '🙂'.repeat(4097) }, {})).resolves.toEqual({
      kind: 'invalid_input',
    })
    await expect(
      execute({ code: 'pass', extra: 'synthetic' }, {})
    ).resolves.toEqual({ kind: 'invalid_input' })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('bounds stdout and stderr at 16 KiB without splitting UTF-8 characters', async () => {
    const stdout = `${'a'.repeat(OUTPUT_LIMIT - 3)}🙂tail`
    const stderr = '🙂'.repeat(4097)
    fetchMock.mockResolvedValueOnce(
      jsonResponse(executionResponse({ stdout, stderr }))
    )

    const result = (await getExecute(makeTools())({ code: 'pass' }, {})) as {
      stdout: { text: string; truncated: boolean }
      stderr: { text: string; truncated: boolean }
    }

    expect(result.stdout.truncated).toBe(true)
    expect(Buffer.byteLength(result.stdout.text, 'utf8')).toBeLessThanOrEqual(
      OUTPUT_LIMIT
    )
    expect(result.stderr.truncated).toBe(true)
    expect(Buffer.byteLength(result.stderr.text, 'utf8')).toBe(OUTPUT_LIMIT)
    expect(() =>
      new TextDecoder('utf-8', { fatal: true }).decode(
        Buffer.from(result.stdout.text)
      )
    ).not.toThrow()
    expect(() =>
      new TextDecoder('utf-8', { fatal: true }).decode(
        Buffer.from(result.stderr.text)
      )
    ).not.toThrow()
  })

  test.each([
    [
      'Content-Length over 128 KiB',
      () =>
        new Response('x'.repeat(RESPONSE_LIMIT + 1), {
          headers: {
            'content-type': 'application/json',
            'content-length': String(RESPONSE_LIMIT + 1),
          },
        }),
    ],
    [
      'stream over 128 KiB without Content-Length',
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array(RESPONSE_LIMIT + 1))
            },
          }),
          { headers: { 'content-type': 'application/json' } }
        ),
    ],
  ])('rejects a response with %s', async (_name, makeResponse) => {
    fetchMock.mockResolvedValueOnce(makeResponse())

    await expect(
      getExecute(makeTools())({ code: 'pass' }, {})
    ).resolves.toEqual({ kind: 'invalid_response' })
  })

  test.each([
    [
      'malformed JSON',
      () =>
        new Response('{', { headers: { 'content-type': 'application/json' } }),
    ],
    [
      'invalid JSON encoding',
      () =>
        new Response(new Uint8Array([0xff]), {
          headers: { 'content-type': 'application/json' },
        }),
    ],
    ['JSON with an invalid response shape', () => jsonResponse([])],
    [
      'wrong content type',
      () =>
        new Response('synthetic body', {
          headers: { 'content-type': 'text/plain' },
        }),
    ],
  ])('returns a safe category for %s', async (_name, makeResponse) => {
    fetchMock.mockResolvedValueOnce(makeResponse())

    await expect(
      getExecute(makeTools())({ code: 'pass' }, {})
    ).resolves.toEqual({ kind: 'invalid_response' })
  })

  test.each([
    401, 403, 429, 503, 504,
  ])('does not expose the response body for HTTP %i', async (status) => {
    const privateBody = 'synthetic upstream error body'
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: privateBody }, status)
    )

    const result = await getExecute(makeTools())({ code: 'pass' }, {})

    expect(result).toEqual({ kind: 'service_error', status })
    expect(JSON.stringify(result)).not.toContain(privateBody)
  })

  test('returns a redirect response as a service category without following it', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: '/synthetic-target' },
      })
    )

    await expect(
      getExecute(makeTools())({ code: 'pass' }, {})
    ).resolves.toEqual({ kind: 'service_error', status: 302 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe('error')
  })

  test('honors an already-aborted SDK signal before fetch', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      getExecute(makeTools())(
        { code: 'pass' },
        { abortSignal: controller.signal }
      )
    ).resolves.toEqual({ kind: 'cancelled' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('forwards turn cancellation to an in-flight fetch', async () => {
    const controller = new AbortController()
    let markFetchStarted!: () => void
    const fetchStarted = new Promise<void>((resolve) => {
      markFetchStarted = resolve
    })
    fetchMock.mockImplementation((_input, init) => {
      markFetchStarted()
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('synthetic abort', 'AbortError')),
          { once: true }
        )
      })
    })
    const execute = getExecute(makeTools())
    const result = execute({ code: 'pass' }, { abortSignal: controller.signal })
    await fetchStarted
    controller.abort()

    await expect(result).resolves.toEqual({ kind: 'cancelled' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true)
  })

  test('cancels a response body when the SDK caller aborts while it is being read', async () => {
    const controller = new AbortController()
    let markReadStarted!: () => void
    const readStarted = new Promise<void>((resolve) => {
      markReadStarted = resolve
    })
    let bodyCancelled = false
    fetchMock.mockResolvedValueOnce(
      new Response(
        new ReadableStream<Uint8Array>(
          {
            pull() {
              markReadStarted()
            },
            cancel() {
              bodyCancelled = true
            },
          },
          { highWaterMark: 0 }
        ),
        { headers: { 'content-type': 'application/json' } }
      )
    )
    const result = getExecute(makeTools())(
      { code: 'pass' },
      {
        abortSignal: controller.signal,
      }
    )
    await readStarted
    controller.abort()

    await expect(result).resolves.toEqual({ kind: 'cancelled' })
    expect(bodyCancelled).toBe(true)
  })

  test('enforces the fixed 30-second transport deadline', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let markFetchStarted!: () => void
    const fetchStarted = new Promise<void>((resolve) => {
      markFetchStarted = resolve
    })
    fetchMock.mockImplementation((_input, init) => {
      markFetchStarted()
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('synthetic deadline', 'AbortError')),
          { once: true }
        )
      })
    })
    const result = getExecute(makeTools())({ code: 'pass' }, {})
    await fetchStarted
    await vi.advanceTimersByTimeAsync(30_000)

    await expect(result).resolves.toEqual({ kind: 'timeout' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('run_python in a model turn', () => {
  test('returns the actual tool result to a deterministic second model step', async () => {
    const stdout = 'The synthetic calculation returned 42.'
    fetchMock.mockResolvedValueOnce(jsonResponse(executionResponse({ stdout })))
    const tools = makeTools()
    const codeApiTool = tools[CODEAPI_TOOL_NAME]
    if (!codeApiTool) throw new Error('run_python was not admitted')
    const input = { code: 'print(6 * 7)' }
    const toolCallId = 'synthetic-codeapi-call'
    const expectedOutput = {
      kind: 'execution',
      status: 'succeeded',
      exitCode: 0,
      stdout: { text: stdout, truncated: false },
      stderr: { text: '', truncated: false },
      filesOmitted: false,
    }
    const usage = {
      inputTokens: {
        total: 1,
        noCache: 1,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: { total: 1, text: 1, reasoning: undefined },
    }
    const model = new MockLanguageModelV4({
      doGenerate: async ({ prompt, tools: definitions }) => {
        expect(definitions?.map(({ name }) => name)).toEqual([
          CODEAPI_TOOL_NAME,
        ])
        if (model.doGenerateCalls.length === 1) {
          return {
            content: [
              {
                type: 'tool-call',
                toolCallId,
                toolName: CODEAPI_TOOL_NAME,
                input: JSON.stringify(input),
              },
            ],
            finishReason: { unified: 'tool-calls', raw: undefined },
            usage,
            warnings: [],
          }
        }

        expect(model.doGenerateCalls).toHaveLength(2)
        const toolResults = prompt.flatMap((message) =>
          message.role === 'tool'
            ? message.content.filter((part) => part.type === 'tool-result')
            : []
        )
        expect(toolResults).toHaveLength(1)
        const [toolResult] = toolResults
        expect(toolResult).toMatchObject({
          type: 'tool-result',
          toolCallId,
          toolName: CODEAPI_TOOL_NAME,
          output: { type: 'json', value: expectedOutput },
        })
        if (!toolResult || toolResult.output.type !== 'json') {
          throw new Error('Expected a JSON tool result')
        }
        const observed = toolResult.output.value as typeof expectedOutput
        return {
          content: [{ type: 'text', text: observed.stdout.text }],
          finishReason: { unified: 'stop', raw: undefined },
          usage,
          warnings: [],
        }
      },
    })

    const result = await generateText({
      model,
      tools: { [CODEAPI_TOOL_NAME]: codeApiTool },
      stopWhen: isStepCount(5),
      maxRetries: 0,
      prompt: 'Run Python once and report its actual output.',
    })

    expect(model.doGenerateCalls).toHaveLength(2)
    expect(result.steps).toHaveLength(2)
    expect(result.steps[0].toolResults[0].output).toEqual(expectedOutput)
    expect(result.steps[1].toolCalls).toHaveLength(0)
    expect(result.finishReason).toBe('stop')
    expect(result.text).toBe(stdout)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
