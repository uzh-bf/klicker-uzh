// Wire Mastra's NATIVE tracing.
// A standalone `new Agent(...)` emits no spans on its own; tracing lives on a
// Mastra container's Observability instance. Crucial finding (verified against
// @mastra/core 1.41): the AI SDK's `experimental_telemetry` pass-through is
// disabled inside Mastra, so registering a global OTEL TracerProvider (the way
// apps/chat does for its `streamText` calls) produces NOTHING for Mastra agents.
// The supported path is this container + `agent.__registerMastra(mastra)`.
//
// We build ONE container at import. The ConsoleExporter prints each span (with
// token usage) to stdout. Production swaps in an OTLP/Langfuse-compatible
// exporter here (env-driven) WITHOUT touching agent code.
import { Mastra } from '@mastra/core'
import { Agent } from '@mastra/core/agent'
import { ConsoleExporter, Observability } from '@mastra/observability'
import { env } from './env.js'

// Build the container once. Observability must never take the chat server down:
// if construction fails, we log and run without tracing.
//
// "off" skips the container entirely (mastra stays null) rather than building one
// with no exporters: Mastra's Observability rejects an empty exporter set
// (OBSERVABILITY_INVALID_INSTANCE_CONFIG, "At least one exporter or a bridge is
// required"), so the empty-exporter path would throw on EVERY default startup. A
// null container makes withObservability a no-op — exactly the "off" behaviour —
// so only the exporter-bearing "console" mode constructs one.
let mastra: Mastra | null = null
const mode = env.OBSERVABILITY
if (mode !== 'console' && mode !== 'off') {
  console.warn(
    `[observability] unknown OBSERVABILITY="${mode}", treating as "off"`
  )
}
if (mode === 'console') {
  try {
    mastra = new Mastra({
      observability: new Observability({
        configs: {
          default: {
            serviceName: 'klicker-chat-engine',
            exporters: [new ConsoleExporter()],
          },
        },
      }),
    })
  } catch (err) {
    console.error(
      '[observability] init failed; continuing without tracing:',
      err
    )
    mastra = null
  }
}

// Attach a per-request agent to the observability container so its model calls
// emit spans. NOTE: `__registerMastra` is Mastra-internal (double-underscore) —
// the supported attach path for a standalone agent in 1.41, but churn-exposed.
// It registers the agent's tools/processors onto the shared container by id
// (first write wins; ids dedup rather than grow). No-op when tracing failed to
// init or is off.
export function withObservability(agent: Agent): Agent {
  if (!mastra) return agent
  try {
    agent.__registerMastra(mastra)
  } catch (err) {
    console.error(
      '[observability] agent registration failed; tracing skipped for this request:',
      err
    )
  }
  return agent
}

// Flush in-flight spans on shutdown. Harmless for the ConsoleExporter, but
// essential once this points at an OTLP/Langfuse exporter (otherwise the final
// batch is dropped on process exit). The host service owns process lifecycle — a
// library must not register process-exit handlers of its own — so the host must
// register its own SIGTERM/SIGINT handlers, await this, AND then exit explicitly:
//
//   process.once('SIGTERM', async () => {
//     await shutdownObservability()
//     process.exit(0)
//   })
//
// Awaiting alone does not exit the process (the prototype's handler called
// process.exit(0) after flushing); a host that forgets the exit will hang.
export async function shutdownObservability(): Promise<void> {
  await Promise.resolve(mastra?.observability?.shutdown?.())
}
