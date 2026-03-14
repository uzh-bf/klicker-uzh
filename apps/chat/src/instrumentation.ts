export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { LangfuseSpanProcessor } = await import('@langfuse/otel')
    const { NodeTracerProvider } = await import('@opentelemetry/sdk-trace-node')

    const langfuseSpanProcessor = new LangfuseSpanProcessor()

    const tracerProvider = new NodeTracerProvider()
    tracerProvider.addSpanProcessor(langfuseSpanProcessor)
    tracerProvider.register()
  }
}
