import { createOpenAI } from '@ai-sdk/openai'
import { LangfuseSpanProcessor } from '@langfuse/otel'
import { propagateAttributes } from '@langfuse/tracing'
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { generateText, isStepCount, tool } from 'ai'
import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'
import {
  createPrivacyPreservingLangfuseSpanProcessor,
  maskLangfuseData,
} from '../src/lib/server/langfuseTracing'

type ProcessorOptions = NonNullable<
  ConstructorParameters<typeof LangfuseSpanProcessor>[0]
>

describe('Langfuse SDK and OpenTelemetry compatibility', () => {
  test('exports AI SDK 7 spans through the Langfuse v5 OTel 2 processor', async () => {
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
    const sdk = new NodeSDK({ spanProcessors: [processor] })
    sdk.start()

    const forbiddenInput = 'FORBIDDEN_STUDENT_PROMPT'
    const forbiddenOutput = 'FORBIDDEN_ASSISTANT_ANSWER'
    const forbiddenToolInput = 'FORBIDDEN_TOOL_ARGUMENT'
    const forbiddenToolOutput = 'FORBIDDEN_TOOL_RESULT'
    const forbiddenProviderError = 'FORBIDDEN_PROVIDER_ERROR_BODY'
    const forbiddenToolError = 'FORBIDDEN_TOOL_ERROR_MESSAGE'
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
      expect(exportedPayload).toContain('AI operation failed')
      expect(exportedPayload).not.toContain(forbiddenInput)
      expect(exportedPayload).not.toContain(forbiddenOutput)
      expect(exportedPayload).not.toContain(forbiddenToolInput)
      expect(exportedPayload).not.toContain(forbiddenToolOutput)
      expect(exportedPayload).not.toContain(forbiddenProviderError)
      expect(exportedPayload).not.toContain(forbiddenToolError)
      expect(exportedPayload).not.toContain('Error: FORBIDDEN')
    } finally {
      await sdk.shutdown()
    }
  })
})
