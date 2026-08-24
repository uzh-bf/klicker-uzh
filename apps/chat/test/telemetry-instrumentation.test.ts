import { afterEach, describe, expect, test, vi } from 'vitest'

const startMock = vi.fn()
// Assigned by the mocked NodeSDK constructor so assertions can inspect the
// processor list without fighting the real module's type surface.
let lastSdkProcessors: unknown[] = []

vi.mock('@langfuse/otel', () => ({
  LangfuseSpanProcessor: class {
    id = 'langfuse-processor'
  },
}))

vi.mock('@opentelemetry/sdk-node', () => {
  return {
    NodeSDK: class {
      constructor(options: { spanProcessors?: unknown[] }) {
        lastSdkProcessors = options.spanProcessors ?? []
      }
      start = startMock
    },
  }
})

async function registerOnce(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      vi.stubEnv(key, '')
      delete process.env[key]
    } else {
      vi.stubEnv(key, value)
    }
  }
  const mod = await import('../src/instrumentation')
  await mod.register()
}

describe('chat telemetry instrumentation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  test('registers NodeSDK with the Langfuse processor when telemetry is enabled', async () => {
    await registerOnce({
      NEXT_RUNTIME: 'nodejs',
      CHAT_ENABLE_AI_TELEMETRY: 'true',
    })
    expect(startMock).toHaveBeenCalledTimes(1)
    expect(lastSdkProcessors).toHaveLength(1)
    expect(lastSdkProcessors[0]).toMatchObject({ id: 'langfuse-processor' })
  })

  test('does not register when the killswitch disables telemetry', async () => {
    await registerOnce({ CHAT_ENABLE_AI_TELEMETRY: 'false' })
    expect(startMock).not.toHaveBeenCalled()
  })
})
