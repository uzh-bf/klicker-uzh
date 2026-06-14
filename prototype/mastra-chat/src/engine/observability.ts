// A1 (observability half) — wire Mastra's NATIVE tracing.
// A standalone `new Agent(...)` emits no spans on its own; tracing lives on a
// Mastra container's Observability instance. Crucial finding (verified against
// @mastra/core 1.41): the AI SDK's `experimental_telemetry` pass-through is
// disabled inside Mastra, so registering a global OTEL TracerProvider (the way
// apps/chat does for its `streamText` calls) produces NOTHING for Mastra agents.
// The supported path is this container + `agent.__registerMastra(mastra)`.
//
// We build ONE container at startup. The ConsoleExporter prints each span (with
// token usage) to stdout — the offline emission proof, since this prototype has
// no Langfuse UI to inspect. Production swaps in an OTLP/Langfuse-compatible
// exporter here (env-driven) WITHOUT touching agent code.
import { Mastra } from '@mastra/core'
import { Agent } from '@mastra/core/agent'
import { Observability, ConsoleExporter } from '@mastra/observability'
import { env } from '../env.js'

// Build the container once at startup. Observability must never take the chat
// server down: if construction fails, we log and run without tracing.
let mastra: Mastra | null = null
try {
  const mode = env.OBSERVABILITY
  if (mode !== 'console' && mode !== 'off') {
    console.warn(`[observability] unknown OBSERVABILITY="${mode}", treating as "off"`)
  }
  const exporters = mode === 'console' ? [new ConsoleExporter()] : []
  mastra = new Mastra({
    observability: new Observability({
      configs: { default: { serviceName: 'mastra-chat-prototype', exporters } },
    }),
  })
} catch (err) {
  console.error('[observability] init failed; continuing without tracing:', err)
  mastra = null
}

// Attach a per-request agent to the observability container so its model calls
// emit spans. NOTE: `__registerMastra` is Mastra-internal (double-underscore) —
// the supported attach path for a standalone agent in 1.41, but churn-exposed.
// It registers the agent's tools/processors onto the shared container by id
// (first write wins; the prototype's toolset is small and stable, so repeated
// ids dedup rather than grow). No-op when tracing failed to init or is off.
export function withObservability(agent: Agent): Agent {
  if (!mastra) return agent
  try {
    agent.__registerMastra(mastra)
  } catch (err) {
    console.error('[observability] agent registration failed; tracing skipped for this request:', err)
  }
  return agent
}

// Flush in-flight spans on shutdown. Harmless for the ConsoleExporter, but
// essential once this points at an OTLP/Langfuse exporter (otherwise the final
// batch is dropped on process exit). The container's observability entrypoint
// owns the live exporters, so flush through it rather than holding a second ref.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void Promise.resolve(mastra?.observability?.shutdown?.()).finally(() => process.exit(0))
  })
}
