import type { LangfuseSpanProcessor } from '@langfuse/otel'
import { createTraceId } from '@langfuse/tracing'
import { LangfuseVercelAiSdkIntegration } from '@langfuse/vercel-ai-sdk'
import { logger } from './logger'

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

export const SANITIZED_ERROR_MESSAGE = 'AI operation failed'

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

/**
 * A span context needs a parent span id alongside the trace id. Nothing points
 * back at this id — it only anchors the stream's spans into the derived trace —
 * so it just has to be stable and a valid 16-hex-digit value.
 */
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
        logger.error(
          {
            event: 'chat.telemetry.span_prepare.failed',
            errorType: error instanceof Error ? error.name : typeof error,
          },
          'Failed to prepare a Langfuse span'
        )
      }
    },
    onEnd(span) {
      try {
        sanitizeLangfuseSpanForExport(span)
      } catch (error) {
        // Dropping a span is safer than exporting an error message or stack
        // that could contain prompt, provider, or tool data.
        logger.error(
          {
            event: 'chat.telemetry.span_sanitize.failed',
            errorType: error instanceof Error ? error.name : typeof error,
          },
          'Dropped a Langfuse span that could not be sanitized'
        )
        return
      }

      try {
        processor.onEnd(span)
      } catch (error) {
        logger.error(
          {
            event: 'chat.telemetry.span_export.failed',
            errorType: error instanceof Error ? error.name : typeof error,
          },
          'Failed to export a Langfuse span'
        )
      }
    },
    async forceFlush() {
      try {
        await processor.forceFlush()
      } catch (error) {
        logger.error(
          {
            event: 'chat.telemetry.flush.failed',
            errorType: error instanceof Error ? error.name : typeof error,
          },
          'Failed to flush Langfuse telemetry'
        )
      }
    },
    async shutdown() {
      try {
        await processor.shutdown()
      } catch (error) {
        logger.error(
          {
            event: 'chat.telemetry.shutdown.failed',
            errorType: error instanceof Error ? error.name : typeof error,
          },
          'Failed to shut down Langfuse telemetry'
        )
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
      logger.warn(
        {
          event: 'chat.telemetry.configuration.missing',
          missingVariables: configuration.missingEnvironmentVariables,
        },
        'Langfuse telemetry requested but not configured'
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
    logger.error(
      {
        event: 'chat.telemetry.initialize.failed',
        errorType: error instanceof Error ? error.name : typeof error,
      },
      'Failed to initialize Langfuse telemetry'
    )
    return false
  }
}

export function resetLangfuseTelemetryForTests() {
  delete runtimeState.__klickerLangfuseRuntime
}
