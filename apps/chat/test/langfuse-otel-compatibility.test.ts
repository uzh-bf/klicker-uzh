import { createServer, type IncomingHttpHeaders } from 'node:http'
import { gunzipSync } from 'node:zlib'
import { createOpenAI } from '@ai-sdk/openai'
import { LangfuseSpanProcessor } from '@langfuse/otel'
import { propagateAttributes, startActiveObservation } from '@langfuse/tracing'
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk'
import { NodeSDK, tracing } from '@opentelemetry/sdk-node'
import { generateText, isStepCount, tool } from 'ai'
import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'
import {
  createPrivacyPreservingLangfuseSpanProcessor,
  maskLangfuseData,
  SANITIZED_ERROR_MESSAGE,
} from '../src/lib/server/langfuseTracing'

type ProcessorOptions = NonNullable<
  ConstructorParameters<typeof LangfuseSpanProcessor>[0]
>

describe('Langfuse SDK and OpenTelemetry compatibility', () => {
  test('exports AI SDK 7 spans through the Langfuse v6 OTel 2 processor', async () => {
    const exportedSpans: Parameters<
      NonNullable<ProcessorOptions['exporter']>['export']
    >[0][number][] = []
    const exporter: NonNullable<ProcessorOptions['exporter']> = {
      export(spans, resultCallback) {
        exportedSpans.push(...spans)
        resultCallback({ code: 0 })
      },
      forceFlush: async () => {},
      shutdown: async () => {},
    }
    const processor = createPrivacyPreservingLangfuseSpanProcessor(
      new LangfuseSpanProcessor({
        exporter,
        exportMode: 'immediate',
        mediaUploadEnabled: false,
        mask: maskLangfuseData,
      })
    )
    const sdk = new NodeSDK({
      // The privacy gate must not inherit a host's sampled-out traces.
      sampler: new tracing.AlwaysOnSampler(),
      spanProcessors: [processor],
    })
    sdk.start()

    const forbiddenInput = 'FORBIDDEN_STUDENT_PROMPT'
    const forbiddenOutput = 'FORBIDDEN_ASSISTANT_ANSWER'
    const forbiddenToolInput = 'FORBIDDEN_TOOL_ARGUMENT'
    const forbiddenToolOutput = 'FORBIDDEN_TOOL_RESULT'
    const forbiddenProviderError = 'FORBIDDEN_PROVIDER_ERROR_BODY'
    const forbiddenToolError = 'FORBIDDEN_TOOL_ERROR_MESSAGE'
    const forbiddenSetDigest = 'FORBIDDEN_RESPONSE_EXAMPLE_SET_DIGEST'
    const forbiddenProjectionDigest =
      'FORBIDDEN_RESPONSE_EXAMPLE_PROJECTION_DIGEST'
    const fetch = vi.fn(async () => {
      const response =
        fetch.mock.calls.length === 1
          ? {
              id: 'chatcmpl-langfuse-tool-test',
              object: 'chat.completion',
              created: 1,
              model: 'compatible-model',
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call-langfuse-test',
                        type: 'function',
                        function: {
                          name: 'lookup',
                          arguments: JSON.stringify({
                            query: forbiddenToolInput,
                          }),
                        },
                      },
                    ],
                  },
                  finish_reason: 'tool_calls',
                },
              ],
              usage: {
                prompt_tokens: 3,
                completion_tokens: 4,
                total_tokens: 7,
              },
            }
          : {
              id: 'chatcmpl-langfuse-test',
              object: 'chat.completion',
              created: 1,
              model: 'compatible-model',
              choices: [
                {
                  index: 0,
                  message: { role: 'assistant', content: forbiddenOutput },
                  finish_reason: 'stop',
                },
              ],
              usage: {
                prompt_tokens: 3,
                completion_tokens: 4,
                total_tokens: 7,
              },
            }

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    const provider = createOpenAI({
      apiKey: 'synthetic-test-key',
      baseURL: 'https://example.test/v1',
      fetch,
    })

    try {
      await startActiveObservation('typed-metadata', (observation) => {
        observation.update({
          metadata: {
            mode: 'tutor',
            attemptCount: 2,
            synthetic: true,
            nested: {
              authorization: 'Bearer SYNTHETIC_SECRET_TOKEN',
              image: 'data:image/png;base64,QUJD',
              apiKey: 'sk-lf-SYNTHETIC_SECRET_KEY',
            },
          },
        })
      })
      const result = await propagateAttributes(
        {
          traceName: 'langfuse-v4-compatibility-test',
          sessionId: 'pseudonymous-session',
          metadata: { privacyMode: 'metadata-only' },
        },
        () =>
          generateText({
            model: provider.chat('compatible-model'),
            prompt: forbiddenInput,
            runtimeContext: {
              responseExampleRole: 'included',
              responseExampleSkillAvailable: true,
              responseExampleSetDigest: forbiddenSetDigest,
              responseExampleProjectionDigest: forbiddenProjectionDigest,
            },
            tools: {
              lookup: tool({
                inputSchema: z.object({ query: z.string() }),
                execute: async () => ({ answer: forbiddenToolOutput }),
              }),
            },
            stopWhen: isStepCount(2),
            telemetry: {
              isEnabled: true,
              recordInputs: false,
              recordOutputs: false,
              includeRuntimeContext: {
                responseExampleRole: true,
                responseExampleSkillAvailable: true,
                responseExampleSetDigest: false,
                responseExampleProjectionDigest: false,
              },
              functionId: 'langfuse-v4-compatibility-test',
              integrations: [new LangfuseVercelAiSdkIntegration()],
            },
          })
      )

      expect(result.text).toBe(forbiddenOutput)

      const providerErrorModel = createOpenAI({
        apiKey: 'synthetic-test-key',
        baseURL: 'https://example.test/v1',
        fetch: async () =>
          new Response(
            JSON.stringify({
              error: {
                message: forbiddenProviderError,
                type: 'server_error',
                code: 'synthetic_error',
              },
            }),
            {
              status: 500,
              headers: { 'content-type': 'application/json' },
            }
          ),
      }).chat('compatible-model')
      await expect(
        generateText({
          maxRetries: 0,
          model: providerErrorModel,
          prompt: 'safe provider-error input',
          telemetry: {
            isEnabled: true,
            recordInputs: false,
            recordOutputs: false,
            functionId: 'langfuse-v4-provider-error-test',
            integrations: [new LangfuseVercelAiSdkIntegration()],
          },
        })
      ).rejects.toThrow()

      const toolErrorProvider = createOpenAI({
        apiKey: 'synthetic-test-key',
        baseURL: 'https://example.test/v1',
        fetch: async () =>
          new Response(
            JSON.stringify({
              id: 'chatcmpl-langfuse-tool-error-test',
              object: 'chat.completion',
              created: 1,
              model: 'compatible-model',
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call-langfuse-error-test',
                        type: 'function',
                        function: {
                          name: 'lookup',
                          arguments: JSON.stringify({ query: 'safe query' }),
                        },
                      },
                    ],
                  },
                  finish_reason: 'tool_calls',
                },
              ],
              usage: {
                prompt_tokens: 3,
                completion_tokens: 4,
                total_tokens: 7,
              },
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          ),
      }).chat('compatible-model')
      const toolErrorResult = await generateText({
        model: toolErrorProvider,
        prompt: 'safe tool-error input',
        tools: {
          lookup: tool({
            inputSchema: z.object({ query: z.string() }),
            execute: async (): Promise<{ answer: string }> => {
              throw new Error(forbiddenToolError)
            },
          }),
        },
        stopWhen: isStepCount(1),
        telemetry: {
          isEnabled: true,
          recordInputs: false,
          recordOutputs: false,
          functionId: 'langfuse-v4-tool-error-test',
          integrations: [new LangfuseVercelAiSdkIntegration()],
        },
      })
      expect(toolErrorResult.steps[0]?.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            error: expect.objectContaining({ message: forbiddenToolError }),
            type: 'tool-error',
          }),
        ])
      )

      await processor.forceFlush()

      const exportedPayload = JSON.stringify(
        exportedSpans.map((span) => ({
          attributes: span.attributes,
          events: span.events,
          name: span.name,
          status: span.status,
        }))
      )
      expect(exportedSpans.length).toBeGreaterThan(0)
      expect(exportedPayload).toContain('compatible-model')
      expect(exportedPayload).toContain('pseudonymous-session')
      expect(exportedPayload).toContain('metadata-only')
      expect(exportedPayload).toContain(SANITIZED_ERROR_MESSAGE)
      expect(exportedPayload).not.toContain(forbiddenInput)
      expect(exportedPayload).not.toContain(forbiddenOutput)
      expect(exportedPayload).not.toContain(forbiddenToolInput)
      expect(exportedPayload).not.toContain(forbiddenToolOutput)
      expect(exportedPayload).not.toContain(forbiddenProviderError)
      expect(exportedPayload).not.toContain(forbiddenToolError)
      expect(exportedPayload).not.toContain(forbiddenSetDigest)
      expect(exportedPayload).not.toContain(forbiddenProjectionDigest)
      expect(exportedPayload).not.toContain('Error: FORBIDDEN')

      // v6 JSON-encodes metadata, including strings, and passes decoded
      // values to mask(). Verify the real SDK preserves types and redaction.
      const metadata = exportedSpans.find(
        (span) => span.name === 'typed-metadata'
      )?.attributes
      expect(metadata).toBeDefined()
      const decodeMetadata = (key: string) =>
        JSON.parse(String(metadata?.[`langfuse.observation.metadata.${key}`]))
      expect(decodeMetadata('mode')).toBe('tutor')
      expect(decodeMetadata('attemptCount')).toBe(2)
      expect(decodeMetadata('synthetic')).toBe(true)
      expect(decodeMetadata('nested')).toEqual({
        authorization: 'Bearer [REDACTED]',
        image: '[REDACTED_DATA_URL]',
        apiKey: '[REDACTED_LANGFUSE_KEY]',
      })
      expect(exportedPayload).not.toContain('SYNTHETIC_SECRET')

      // The in-memory exporter above deliberately bypasses HTTP. Replay only
      // its synthetic, sanitized spans through the SDK's default exporter to
      // prove the new gzip default, OTLP path and authentication on loopback.
      await verifyLoopbackExport(exportedSpans)
    } finally {
      await sdk.shutdown()
    }
  })
})

async function verifyLoopbackExport(
  spans: Parameters<NonNullable<ProcessorOptions['exporter']>['export']>[0]
) {
  const requests: {
    method: string | undefined
    url: string | undefined
    headers: IncomingHttpHeaders
    body: Buffer
  }[] = []
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    requests.push({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: Buffer.concat(chunks),
    })
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end('{}')
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Loopback receiver did not bind a TCP port')
  }

  // Ambient exporter settings must not turn this default-compression check
  // into a test of the developer/CI environment.
  const compressionVariables = [
    'LANGFUSE_OTEL_COMPRESSION',
    'OTEL_EXPORTER_OTLP_TRACES_COMPRESSION',
    'OTEL_EXPORTER_OTLP_COMPRESSION',
  ] as const
  for (const variable of compressionVariables) vi.stubEnv(variable, '')
  const processor = new LangfuseSpanProcessor({
    baseUrl: `http://127.0.0.1:${address.port}`,
    publicKey: 'synthetic-public-key',
    secretKey: 'synthetic-secret-key',
    exportMode: 'batched',
    mediaUploadEnabled: false,
    mask: maskLangfuseData,
  })
  try {
    for (const span of spans) processor.onEnd(span)
    await processor.forceFlush()
    expect(requests.length).toBeGreaterThan(0)
    for (const request of requests) {
      expect(request.method).toBe('POST')
      expect(request.url).toBe('/api/public/otel/v1/traces')
      expect(request.headers.authorization).toBe(
        `Basic ${Buffer.from('synthetic-public-key:synthetic-secret-key').toString('base64')}`
      )
      expect(request.headers['x-langfuse-sdk-version']).toBe('6.0.0')
      expect(request.headers['content-encoding']).toBe('gzip')
      const payload = gunzipSync(request.body).toString('utf8')
      expect(JSON.parse(payload).resourceSpans.length).toBeGreaterThan(0)
      expect(payload).not.toContain('FORBIDDEN_')
      expect(payload).not.toContain('SYNTHETIC_SECRET')
    }
  } finally {
    await processor.shutdown()
    vi.unstubAllEnvs()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}
