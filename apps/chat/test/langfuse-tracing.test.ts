import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const telemetryMocks = vi.hoisted(() => ({
  processorOptions: null as unknown,
  processorForceFlush: vi.fn(async () => {}),
  sdkOptions: null as unknown,
  sdkShutdown: vi.fn(async () => {}),
  sdkStart: vi.fn(),
}))

vi.mock('@langfuse/otel', () => ({
  LangfuseSpanProcessor: class {
    constructor(options: unknown) {
      telemetryMocks.processorOptions = options
    }

    forceFlush = telemetryMocks.processorForceFlush
    onEnd = vi.fn()
    onStart = vi.fn()
    shutdown = vi.fn(async () => {})
  },
}))

vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: class {
    constructor(options: unknown) {
      telemetryMocks.sdkOptions = options
    }

    shutdown = telemetryMocks.sdkShutdown
    start = telemetryMocks.sdkStart
  },
}))

import {
  createPrivacyPreservingLangfuseSpanProcessor,
  flushLangfuseTelemetry,
  getChatTraceContext,
  getLangfuseAiSdkIntegration,
  getLangfuseTelemetryConfiguration,
  maskLangfuseData,
  registerLangfuseTelemetry,
  resetLangfuseTelemetryForTests,
} from '../src/lib/server/langfuseTracing'

beforeEach(() => {
  vi.clearAllMocks()
  telemetryMocks.processorOptions = null
  telemetryMocks.sdkOptions = null
  resetLangfuseTelemetryForTests()
})

afterEach(() => {
  resetLangfuseTelemetryForTests()
  vi.unstubAllEnvs()
})

describe('Langfuse telemetry configuration', () => {
  test('requires an explicit opt-in and complete self-hosted configuration', () => {
    expect(
      getLangfuseTelemetryConfiguration({
        CHAT_ENABLE_AI_TELEMETRY: 'true',
        LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
        LANGFUSE_SECRET_KEY: 'sk-lf-test',
        LANGFUSE_BASE_URL: 'https://langfuse.example.test',
      })
    ).toEqual({
      enabled: true,
      requested: true,
      missingEnvironmentVariables: [],
    })

    expect(
      getLangfuseTelemetryConfiguration({
        CHAT_ENABLE_AI_TELEMETRY: 'true',
        LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
      })
    ).toEqual({
      enabled: false,
      requested: true,
      missingEnvironmentVariables: ['LANGFUSE_SECRET_KEY', 'LANGFUSE_BASE_URL'],
    })

    expect(
      getLangfuseTelemetryConfiguration({
        CHAT_ENABLE_AI_TELEMETRY: 'false',
        LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
        LANGFUSE_SECRET_KEY: 'sk-lf-test',
        LANGFUSE_BASE_URL: 'https://langfuse.example.test',
      }).enabled
    ).toBe(false)
  })

  test('registers and flushes one batched self-hosted SDK instance', async () => {
    vi.stubEnv('CHAT_ENABLE_AI_TELEMETRY', 'true')
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', 'pk-lf-test')
    vi.stubEnv('LANGFUSE_SECRET_KEY', 'sk-lf-test')
    vi.stubEnv('LANGFUSE_BASE_URL', 'https://langfuse.example.test///')
    vi.stubEnv('LANGFUSE_TRACING_ENVIRONMENT', 'test')
    vi.stubEnv('LANGFUSE_RELEASE', 'test-release')

    await expect(registerLangfuseTelemetry()).resolves.toBe(true)
    await expect(registerLangfuseTelemetry()).resolves.toBe(true)

    expect(telemetryMocks.processorOptions).toMatchObject({
      baseUrl: 'https://langfuse.example.test',
      environment: 'test',
      exportMode: 'batched',
      mediaUploadEnabled: false,
      publicKey: 'pk-lf-test',
      release: 'test-release',
      secretKey: 'sk-lf-test',
    })
    expect(telemetryMocks.sdkOptions).toMatchObject({
      spanProcessors: [expect.any(Object)],
    })
    expect(telemetryMocks.sdkStart).toHaveBeenCalledOnce()

    await flushLangfuseTelemetry()
    expect(telemetryMocks.processorForceFlush).toHaveBeenCalledOnce()
    expect(telemetryMocks.sdkShutdown).not.toHaveBeenCalled()
  })

  test('fails open when SDK startup fails', async () => {
    vi.stubEnv('CHAT_ENABLE_AI_TELEMETRY', 'true')
    vi.stubEnv('LANGFUSE_PUBLIC_KEY', 'pk-lf-test')
    vi.stubEnv('LANGFUSE_SECRET_KEY', 'sk-lf-test')
    vi.stubEnv('LANGFUSE_BASE_URL', 'https://langfuse.example.test')
    telemetryMocks.sdkStart.mockImplementationOnce(() => {
      throw new Error('synthetic startup failure')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(registerLangfuseTelemetry()).resolves.toBe(false)
    expect(telemetryMocks.sdkShutdown).toHaveBeenCalledOnce()
  })
})

describe('Langfuse trace context', () => {
  test('is deterministic without exporting raw application identifiers', async () => {
    const rawIds = {
      assistantMessageId: 'assistant-message-id',
      chatbotId: 'chatbot-id',
      threadId: 'thread-id',
    }

    const first = await getChatTraceContext(rawIds)
    const second = await getChatTraceContext(rawIds)

    expect(first).toEqual(second)
    expect(first.traceId).toMatch(/^[a-f0-9]{32}$/)
    expect(first.sessionId).toMatch(/^[a-f0-9]{32}$/)
    expect(first.pseudonymousChatbotId).toMatch(/^[a-f0-9]{32}$/)
    expect(JSON.stringify(first)).not.toContain(rawIds.assistantMessageId)
    expect(JSON.stringify(first)).not.toContain(rawIds.chatbotId)
    expect(JSON.stringify(first)).not.toContain(rawIds.threadId)
  })

  test('reuses one AI SDK integration instance', () => {
    expect(getLangfuseAiSdkIntegration()).toBe(getLangfuseAiSdkIntegration())
  })
})

describe('Langfuse export masking', () => {
  test('redacts media and credentials recursively', () => {
    expect(
      maskLangfuseData({
        data: {
          image: 'data:image/png;base64,Zm9yYmlkZGVu',
          keys: ['pk-lf-public123', 'sk-lf-secret123'],
          authorization: 'Bearer token.value-123',
        },
      })
    ).toEqual({
      image: '[REDACTED_DATA_URL]',
      keys: ['[REDACTED_LANGFUSE_KEY]', '[REDACTED_LANGFUSE_KEY]'],
      authorization: 'Bearer [REDACTED]',
    })
  })

  test('removes error messages and exception details before export', () => {
    const exportedSpans: unknown[] = []
    const processor = createPrivacyPreservingLangfuseSpanProcessor({
      forceFlush: async () => {},
      onEnd: (span) => exportedSpans.push(span),
      onStart: () => {},
      shutdown: async () => {},
    })
    const span = {
      status: { code: 2, message: 'FORBIDDEN_PROVIDER_ERROR' },
      events: [
        {
          name: 'exception',
          attributes: {
            'exception.message': 'FORBIDDEN_TOOL_ERROR',
            'exception.stacktrace': 'Error: FORBIDDEN_TOOL_ERROR',
          },
        },
      ],
    } as unknown as Parameters<typeof processor.onEnd>[0]

    processor.onEnd(span)

    expect(exportedSpans).toEqual([span])
    expect(span.status.message).toBe('AI operation failed')
    expect(span.events).toEqual([{ name: 'exception', attributes: {} }])
  })

  test('drops a span when privacy sanitization cannot complete', () => {
    const onEnd = vi.fn()
    const processor = createPrivacyPreservingLangfuseSpanProcessor({
      forceFlush: async () => {},
      onEnd,
      onStart: () => {},
      shutdown: async () => {},
    })
    const span = {
      status: Object.freeze({ code: 2, message: 'FORBIDDEN_ERROR' }),
      events: [],
    } as unknown as Parameters<typeof processor.onEnd>[0]
    vi.spyOn(console, 'error').mockImplementation(() => {})

    processor.onEnd(span)

    expect(onEnd).not.toHaveBeenCalled()
  })
})
