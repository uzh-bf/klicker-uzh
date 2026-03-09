export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { LangfuseSpanProcessor } = await import('@langfuse/otel')
    // type ShouldExportSpan = import('@langfuse/otel').ShouldExportSpan
    const { NodeTracerProvider } = await import('@opentelemetry/sdk-trace-node')

    // Optional: filter out Next.js infra spans
    // const shouldExportSpan: ShouldExportSpan = (span) => {
    //   return span.otelSpan.instrumentationScope.name !== 'next.js'
    // }

    const langfuseSpanProcessor = new LangfuseSpanProcessor({
      // shouldExportSpan,
    })

    const tracerProvider = new NodeTracerProvider()
    tracerProvider.addSpanProcessor(langfuseSpanProcessor)
    tracerProvider.register()
  }
}
