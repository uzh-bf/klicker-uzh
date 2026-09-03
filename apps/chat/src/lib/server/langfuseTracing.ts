import type { LangfuseSpanProcessor } from '@langfuse/otel'
import { createTraceId } from '@langfuse/tracing'
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk'

const REQUIRED_LANGFUSE_ENV_VARS = [
  'LANGFUSE_PUBLIC_KEY',
  'LANGFUSE_SECRET_KEY',
  'LANGFUSE_BASE_URL',
] as const

type LangfuseRuntimeState = {
  integration?: LangfuseVercelAiSdkIntegration
  processor?: LangfuseProcessor
  sdk?: { shutdown(): Promise<void> }
  registered?: boolean
}

type LangfuseProcessor = Pick<
  LangfuseSpanProcessor,
  'forceFlush' | 'onEnd' | 'onStart' | 'shutdown'
>

type LangfuseReadableSpan = Parameters<LangfuseProcessor['onEnd']>[0]

const runtimeState = globalThis as typeof globalThis & {
  __klickerLangfuseRuntime?: LangfuseRuntimeState
}

const getRuntimeState = () => {
  runtimeState.__klickerLangfuseRuntime ??= {}
  return runtimeState.__klickerLangfuseRuntime
}

export const LANGFUSE_CHAT_TRACE_NAME = 'generate-chat-response'

const SANITIZED_ERROR_MESSAGE = 'AI operation failed'

export function getLangfuseTelemetryConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  const requested = environment.CHAT_ENABLE_AI_TELEMETRY === 'true'
  const missingEnvironmentVariables = REQUIRED_LANGFUSE_ENV_VARS.filter(
    (name) => !environment[name]?.trim()
  )

  return {
    enabled: requested && missingEnvironmentVariables.length === 0,
    requested,
    missingEnvironmentVariables,
  }
}

export function isAiTelemetryEnabled() {
  return getLangfuseTelemetryConfiguration().enabled
}

export async function getChatTraceContext({
  assistantMessageId,
  chatbotId,
  threadId,
}: {
  assistantMessageId: string
  chatbotId: string
  threadId: string
}) {
  const [traceId, sessionId, pseudonymousChatbotId] = await Promise.all([
    createTraceId(`chat-turn:${chatbotId}:${threadId}:${assistantMessageId}`),
    createTraceId(`chat-session:${threadId}`),
    createTraceId(`chatbot:${chatbotId}`),
  ])

  return {
    traceId,
    sessionId,
    pseudonymousChatbotId,
    parentSpanContext: getParentSpanContext(traceId),
  }
}

export function getParentSpanContext(traceId: string) {
  return { traceId, spanId: traceId.slice(0, 16), traceFlags: 1 }
}

export function getLangfuseAiSdkIntegration() {
  const state = getRuntimeState()
  state.integration ??= new LangfuseVercelAiSdkIntegration()
  return state.integration
}

export function maskLangfuseData({ data }: { data: unknown }): unknown {
  if (typeof data === 'string') {
    return data
      .replace(/data:[^;\s]+;base64,[a-z0-9+/_=-]+/gi, '[REDACTED_DATA_URL]')
      .replace(/\b(?:pk|sk)-lf-[a-z0-9_-]+\b/gi, '[REDACTED_LANGFUSE_KEY]')
      .replace(/\bbearer\s+[a-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
  }

  if (Array.isArray(data)) {
    return data.map((value) => maskLangfuseData({ data: value }))
  }

  if (data && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        maskLangfuseData({ data: value }),
      ])
    )
  }

  return data
}

export function sanitizeLangfuseSpanForExport(span: LangfuseReadableSpan) {
  if (span.status.message) {
    span.status.message = SANITIZED_ERROR_MESSAGE
  }

  for (const event of span.events) {
    event.name = event.name === 'exception' ? 'exception' : 'event'
    if (!event.attributes) continue

    for (const key of Object.keys(event.attributes)) {
      delete event.attributes[key]
    }
  }
}

export function createPrivacyPreservingLangfuseSpanProcessor(
  processor: LangfuseProcessor
): LangfuseProcessor {
  return {
    onStart(...args) {
      try {
        processor.onStart(...args)
      } catch (error) {
        console.error('[chat] Failed to prepare a Langfuse span:', {
          errorType: error instanceof Error ? error.name : typeof error,
        })
      }
    },
    onEnd(span) {
      try {
        sanitizeLangfuseSpanForExport(span)
      } catch (error) {
        // Dropping a span is safer than exporting an error message or stack
        // that could contain prompt, provider, or tool data.
        console.error(
          '[chat] Dropped a Langfuse span that could not be sanitized:',
          {
            errorType: error instanceof Error ? error.name : typeof error,
          }
        )
        return
      }

      try {
        processor.onEnd(span)
      } catch (error) {
        console.error('[chat] Failed to export a Langfuse span:', {
          errorType: error instanceof Error ? error.name : typeof error,
        })
      }
    },
    async forceFlush() {
      try {
        await processor.forceFlush()
      } catch (error) {
        console.error('[chat] Failed to flush Langfuse telemetry:', {
          errorType: error instanceof Error ? error.name : typeof error,
        })
      }
    },
    async shutdown() {
      try {
        await processor.shutdown()
      } catch (error) {
        console.error('[chat] Failed to shut down Langfuse telemetry:', {
          errorType: error instanceof Error ? error.name : typeof error,
        })
      }
    },
  }
}

export async function flushLangfuseTelemetry() {
  const state = getRuntimeState()
  await state.processor?.forceFlush()
}

export async function registerLangfuseTelemetry() {
  const configuration = getLangfuseTelemetryConfiguration()
  if (!configuration.enabled) {
    if (configuration.requested) {
      console.warn(
        `[chat] Langfuse telemetry requested but not configured; missing ${configuration.missingEnvironmentVariables.join(', ')}`
      )
    }
    return false
  }

  const state = getRuntimeState()
  if (state.registered) return true

  try {
    const [{ LangfuseSpanProcessor }, { NodeSDK }] = await Promise.all([
      import('@langfuse/otel'),
      import('@opentelemetry/sdk-node'),
    ])
    const processor = createPrivacyPreservingLangfuseSpanProcessor(
      new LangfuseSpanProcessor({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASE_URL?.trim().replace(/\/+$/, ''),
        environment: process.env.LANGFUSE_TRACING_ENVIRONMENT,
        release: process.env.LANGFUSE_RELEASE,
        exportMode: 'batched',
        mediaUploadEnabled: false,
        mask: maskLangfuseData,
      })
    )
    const sdk = new NodeSDK({ spanProcessors: [processor] })

    try {
      sdk.start()
    } catch (error) {
      await sdk.shutdown()
      throw error
    }
    state.processor = processor
    state.sdk = sdk
    state.registered = true
    return true
  } catch (error) {
    console.error('[chat] Failed to initialize Langfuse telemetry:', {
      errorType: error instanceof Error ? error.name : typeof error,
    })
    return false
  }
}

export function resetLangfuseTelemetryForTests() {
  delete runtimeState.__klickerLangfuseRuntime
}
