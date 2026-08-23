const isAiTelemetryEnabled = () =>
  process.env.CHAT_ENABLE_AI_TELEMETRY !== 'false'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !isAiTelemetryEnabled()) {
    return
  }

  const { LangfuseSpanProcessor } = await import('@langfuse/otel')
  const { NodeSDK } = await import('@opentelemetry/sdk-node')

  const sdk = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor()],
  })

  sdk.start()
}
