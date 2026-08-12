import { describe, expect, test } from 'vitest'
import {
  conformanceAbortRequest,
  conformanceAbortStream,
  conformanceManifest,
  conformanceRequest,
  conformanceRequestCredentialRequest,
  conformanceStream,
  conformanceToolRequest,
  conformanceToolStream,
  type EngineStreamPart,
  runChatEngineConformanceSuite,
} from '../src/index.js'

function sse(parts: EngineStreamPart[]): Response {
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
        signal.addEventListener(
          'abort',
          () => {
            for (const part of conformanceAbortStream.slice(3)) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(part)}\n\n`)
              )
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
          { once: true }
        )
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } }
  )
}

describe('chat engine conformance suite', () => {
  test('covers credentials, approved tools, and the abort terminal', async () => {
    const request = async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      const url = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url
      )
      if (url.pathname === '/v1/manifest') {
        return Response.json(conformanceManifest)
      }
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
      const body = JSON.parse(String(init?.body)) as typeof conformanceRequest
      const provider = headers.get('provider-authorization')
      if (body.generation.credentialMode.mode === 'request' && !provider) {
        return new Response(null, { status: 400 })
      }
      if (body.generation.credentialMode.mode === 'deployment' && provider) {
        return new Response(null, { status: 400 })
      }
      if (body.tools.length > 0) {
        if (!headers.get('x-mcp-execution-token')) {
          return new Response(null, { status: 400 })
        }
        return sse(conformanceToolStream)
      }
      if (body.requestId === conformanceAbortRequest.requestId) {
        return abortSse(init?.signal ?? null)
      }
      return sse(conformanceStream)
    }

    const result = await runChatEngineConformanceSuite({
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
      fetch: request as typeof fetch,
    })

    expect(result.manifest).toEqual(conformanceManifest)
    expect(result.deploymentStream.at(-1)?.type).toBe('finish')
    expect(result.requestCredentialStream.at(-1)?.type).toBe('finish')
    expect(
      result.toolStream.some((part) => part.type === 'tool-output-available')
    ).toBe(true)
    expect(result.abortStream.at(-1)?.type).toBe('abort')
  })
})
