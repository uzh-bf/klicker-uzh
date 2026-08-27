const isAiTelemetryEnabled = () =>
  process.env.CHAT_ENABLE_AI_TELEMETRY !== 'false'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }

  const { getChatModelRegistry } = await import(
    './lib/server/chatModelRegistry'
  )
  getChatModelRegistry()

  if (!isAiTelemetryEnabled()) return

  const { LangfuseSpanProcessor } = await import('@langfuse/otel')
  const { NodeTracerProvider } = await import('@opentelemetry/sdk-trace-node')

  const langfuseSpanProcessor = new LangfuseSpanProcessor()

  const tracerProvider = new NodeTracerProvider()
  tracerProvider.addSpanProcessor(langfuseSpanProcessor)
  tracerProvider.register()
}
