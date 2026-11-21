import { once } from 'node:events'
import { createServer } from 'node:http'
import { describe, expect, test, vi } from 'vitest'
import {
  CHAT_ENGINE_CONTRACT_V2,
  CHAT_ENGINE_CONTRACT_VERSION,
  conformanceAbortRequest,
  conformanceAbortStream,
  conformanceManifest,
  conformanceRequest,
  conformanceRequestCredentialRequest,
  conformanceStream,
  conformanceToolRequest,
  conformanceToolStream,
  conformanceV2AbortRequest,
  conformanceV2Manifest,
  conformanceV2Request,
  conformanceV2RequestCredentialRequest,
  conformanceV2ToolRequest,
  runChatEngineConformance,
  runChatEngineConformanceSuite,
  type SupportedEngineChatRequest,
  type SupportedEngineStreamPart,
} from '../src/index.js'

function sse(parts: unknown[]): Response {
  return new Response(
    `${parts.map((part) => `data: ${JSON.stringify(part)}\n\n`).join('')}data: [DONE]\n\n`,
    { headers: { 'content-type': 'text/event-stream' } }
  )
}

function abortSse(signal: AbortSignal | null): Response {
  if (!signal)
    throw new Error('Abort conformance request did not carry a signal.')
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const part of conformanceAbortStream.slice(0, 3)) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(part)}\n\n`)
          )
        }
        const cancel = () =>
          controller.error(new DOMException('Cancelled', 'AbortError'))
        signal.addEventListener('abort', cancel, { once: true })
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } }
  )
}

function requestFixture(
  abortResponse: (
    signal: AbortSignal | null
  ) => Response | Promise<Response> = abortSse,
  version: 'v1' | 'v2' = CHAT_ENGINE_CONTRACT_VERSION,
  metadataVersion: 'v1' | 'v2' = version,
  manifestVersion: 'v1' | 'v2' = version
): typeof fetch {
  const withVersion = (parts: SupportedEngineStreamPart[]): unknown[] =>
    parts.map((part) =>
      'messageMetadata' in part && part.messageMetadata
        ? {
            ...part,
            messageMetadata: {
              ...part.messageMetadata,
              contractVersion: metadataVersion,
            },
          }
        : part
    )
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      typeof input === 'string' || input instanceof URL ? input : input.url
    )
    if (url.pathname === `/${version}/manifest`) {
      return Response.json(
        manifestVersion === CHAT_ENGINE_CONTRACT_V2
          ? conformanceV2Manifest
          : conformanceManifest
      )
    }
    if (url.pathname !== `/${version}/chat`)
      return new Response(null, { status: 404 })
    const headers = new Headers(init?.headers)
    if (headers.get('authorization') !== 'Bearer service-token') {
      return new Response(null, { status: 401 })
    }
    if (
      headers.get('traceparent') !==
        '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01' ||
      headers.get('tracestate') !== 'vendor=value'
    ) {
      return new Response(null, { status: 400 })
    }
    const body = JSON.parse(String(init?.body)) as SupportedEngineChatRequest
    if (body.contractVersion !== version)
      return new Response(null, { status: 400 })
    const provider = headers.get('provider-authorization')
    if (body.generation.credentialMode.mode === 'gateway' && !provider) {
      return new Response(null, { status: 400 })
    }
    if (body.generation.credentialMode.mode === 'deployment' && provider) {
      return new Response(null, { status: 400 })
    }
    if (body.tools.length > 0) {
      if (!headers.get('x-mcp-execution-token')) {
        return new Response(null, { status: 400 })
      }
      return sse(withVersion(conformanceToolStream))
    }
    if (body.requestId === conformanceAbortRequest.requestId) {
      return abortResponse(init?.signal ?? null)
    }
    return sse(withVersion(conformanceStream))
  }
}

const options = {
  baseUrl: 'https://engine.example.test',
  serviceToken: 'service-token',
  deploymentRequest: conformanceRequest,
  requestCredentialRequest: conformanceRequestCredentialRequest,
  requestProviderAuthorization: 'Bearer provider-token',
  toolRequest: conformanceToolRequest,
  mcpExecutionToken: 'mcp-token',
  abortRequest: conformanceAbortRequest,
  traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
  tracestate: 'vendor=value',
}

const v2Options = {
  ...options,
  deploymentRequest: conformanceV2Request,
  requestCredentialRequest: conformanceV2RequestCredentialRequest,
  toolRequest: conformanceV2ToolRequest,
  abortRequest: conformanceV2AbortRequest,
}

async function deadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('HTTP fixture deadline exceeded')),
          2000
        )
      }),
    ])
  } finally {
    clearTimeout(timer!)
  }
}

describe('chat engine conformance suite', () => {
  test.each([
    'https://engine.example.test/engine',
    'https://engine.example.test/engine/',
  ])('retains the configured path prefix for %s', async (baseUrl) => {
    const fixture = requestFixture()
    const urls: string[] = []
    const result = await runChatEngineConformanceSuite({
      ...options,
      baseUrl,
      fetch: async (input, init) => {
        const url = new URL(
          typeof input === 'string' || input instanceof URL ? input : input.url
        )
        urls.push(url.pathname)
        expect(url.pathname).toMatch(/^\/engine\/v1\//)
        url.pathname = url.pathname.slice('/engine'.length)
        return fixture(url, init)
      },
    })
    expect(result.transportCancelled).toBe(true)
    expect(urls).toContain('/engine/v1/manifest')
    expect(urls).toContain('/engine/v1/chat')
  })

  test('covers credentials, approved tools, and transport cancellation', async () => {
    const result = await runChatEngineConformanceSuite({
      ...options,
      fetch: requestFixture(),
    })

    expect(result.manifest).toEqual(conformanceManifest)
    expect(result.deploymentStream.at(-1)?.type).toBe('finish')
    expect(result.requestCredentialStream.at(-1)?.type).toBe('finish')
    expect(
      result.toolStream.some((part) => part.type === 'tool-output-available')
    ).toBe(true)
    expect(result.transportCancelled).toBe(true)
  })

  test('uses explicit v2 endpoints and rejects mixed generations', async () => {
    const urls: string[] = []
    const fixture = requestFixture(undefined, CHAT_ENGINE_CONTRACT_V2)
    const result = await runChatEngineConformanceSuite({
      ...v2Options,
      fetch: async (input, init) => {
        const url = new URL(
          typeof input === 'string' || input instanceof URL ? input : input.url
        )
        urls.push(url.pathname)
        return fixture(input, init)
      },
    })
    expect(result.manifest).toEqual(conformanceV2Manifest)
    expect(result.transportCancelled).toBe(true)
    expect(urls.every((url) => url.startsWith('/v2/'))).toBe(true)
    expect(urls).toContain('/v2/manifest')
    expect(urls).toContain('/v2/chat')

    const noFetch = vi.fn(requestFixture())
    await expect(
      runChatEngineConformanceSuite({
        ...v2Options,
        toolRequest: conformanceToolRequest,
        fetch: noFetch,
      })
    ).rejects.toThrow()
    expect(noFetch).not.toHaveBeenCalled()
    await expect(
      runChatEngineConformance({
        ...options,
        request: conformanceV2Request,
        fetch: requestFixture(
          undefined,
          CHAT_ENGINE_CONTRACT_V2,
          CHAT_ENGINE_CONTRACT_V2,
          CHAT_ENGINE_CONTRACT_VERSION
        ),
      })
    ).rejects.toThrow()
    await expect(
      runChatEngineConformance({
        ...options,
        request: conformanceV2Request,
        fetch: requestFixture(
          undefined,
          CHAT_ENGINE_CONTRACT_V2,
          CHAT_ENGINE_CONTRACT_VERSION
        ),
      })
    ).rejects.toThrow()
  })

  test.each([
    ['completed success', () => sse(conformanceStream)],
    ['completed abort', () => sse(conformanceAbortStream)],
    [
      'DONE',
      () =>
        new Response('data: [DONE]\n\n', {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ],
    [
      'ordinary EOF',
      () =>
        new Response(`data: ${JSON.stringify(conformanceStream[0])}\n\n`, {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ],
    [
      'unfinished event',
      () =>
        new Response('data: {', {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ],
    [
      'invalid event',
      () =>
        new Response('data: {"type":"invalid"}\n\n', {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ],
  ] as const)('rejects %s as cancellation and releases the reader', async (_, fixture) => {
    const response = fixture()
    await expect(
      runChatEngineConformanceSuite({
        ...options,
        fetch: requestFixture(() => response),
      })
    ).rejects.toThrow()
    const reader = response.body!.getReader()
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  })

  test('bounds a cancellation response that never arrives', async () => {
    vi.useFakeTimers()
    let admitted!: () => void
    const admission = new Promise<void>((resolve) => {
      admitted = resolve
    })
    let signal: AbortSignal | null = null
    const request = requestFixture((value) => {
      signal = value
      admitted()
      return new Promise<Response>(() => {})
    })
    try {
      const outcome = expect(
        runChatEngineConformanceSuite({ ...options, fetch: request })
      ).rejects.toThrow()
      await admission
      await vi.advanceTimersByTimeAsync(10000)
      await outcome
      expect(signal!.aborted).toBe(true)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  test('bounds a stalled initial read and preserves its error during cleanup', async () => {
    vi.useFakeTimers()
    let admitted!: () => void
    const admission = new Promise<void>((resolve) => {
      admitted = resolve
    })
    const cleanupError = new Error('synthetic cleanup failure')
    const response = new Response(
      new ReadableStream({
        start() {
          admitted()
        },
        cancel() {
          throw cleanupError
        },
      }),
      { headers: { 'content-type': 'text/event-stream' } }
    )
    try {
      const result = runChatEngineConformanceSuite({
        ...options,
        fetch: requestFixture(() => response),
      }).catch((error: unknown) => error)
      await admission
      await vi.advanceTimersByTimeAsync(10000)
      const error = await result
      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBe(cleanupError)
      expect(vi.getTimerCount()).toBe(0)
      const reader = response.body!.getReader()
      reader.releaseLock()
    } finally {
      vi.useRealTimers()
    }
  })

  test('cancels native fetch and closes the unfinished HTTP response', async () => {
    let peerClosed!: (premature: boolean) => void
    const closed = new Promise<boolean>((resolve) => {
      peerClosed = resolve
    })
    const server = createServer(async (request, response) => {
      try {
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        const body = Buffer.concat(chunks).toString()
        if (request.url === '/v1/manifest') {
          response.setHeader('content-type', 'application/json')
          response.end(JSON.stringify(conformanceManifest))
          return
        }
        if (request.headers.authorization !== 'Bearer service-token') {
          response.writeHead(401).end()
          return
        }
        const input = JSON.parse(body) as typeof conformanceRequest
        const provider = request.headers['provider-authorization']
        if (
          (input.generation.credentialMode.mode === 'gateway' && !provider) ||
          (input.generation.credentialMode.mode === 'deployment' && provider) ||
          (input.tools.length > 0 && !request.headers['x-mcp-execution-token'])
        ) {
          response.writeHead(400).end()
          return
        }
        response.setHeader('content-type', 'text/event-stream')
        if (input.requestId === conformanceAbortRequest.requestId) {
          response.once('close', () => peerClosed(!response.writableFinished))
          response.write(
            `data: ${JSON.stringify({ type: 'start', messageId: 'assistant-1' })}\n\n`
          )
          return
        }
        const parts =
          input.tools.length > 0 ? conformanceToolStream : conformanceStream
        response.end(
          `${parts.map((part) => `data: ${JSON.stringify(part)}\n\n`).join('')}data: [DONE]\n\n`
        )
      } catch (error) {
        response.destroy(
          error instanceof Error ? error : new Error('HTTP fixture failed')
        )
      }
    })
    server.requestTimeout = 2000
    server.listen(0, '127.0.0.1')
    let failed = false
    let failure: unknown
    try {
      await deadline(once(server, 'listening'))
      const address = server.address()
      if (!address || typeof address === 'string')
        throw new Error('Missing fixture port')
      const result = await runChatEngineConformanceSuite({
        ...options,
        baseUrl: `http://127.0.0.1:${address.port}`,
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(5000)])
              : AbortSignal.timeout(5000),
          }),
      })
      expect(result).toHaveProperty('transportCancelled', true)
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        expect(
          await Promise.race([
            closed,
            new Promise((_, reject) => {
              timer = setTimeout(
                () => reject(new Error('Peer response did not close')),
                2000
              )
            }),
          ])
        ).toBe(true)
      } finally {
        clearTimeout(timer)
      }
    } catch (error) {
      failed = true
      failure = error
    } finally {
      const stopped = new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
      server.closeAllConnections()
      try {
        await deadline(stopped)
      } catch (error) {
        if (!failed) {
          failed = true
          failure = error
        }
      }
      server.removeAllListeners()
    }
    if (failed) throw failure
  }, 10000)
})
