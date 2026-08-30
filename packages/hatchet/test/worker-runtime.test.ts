import { strict as assert } from 'node:assert'
import { test } from 'vitest'
import type { HatchetWorker } from '../src/worker-runtime.js'
import {
  createHatchetWorkerRuntime,
  createWorkerHealthServer,
  type HatchetWorkerFactory,
  type HatchetWorkflows,
  resolveWorkerRuntimeConfig,
  type TerminationSignalSource,
  WorkerLifecycle,
} from '../src/worker-runtime.js'

class FakeSignals implements TerminationSignalSource {
  private readonly listeners = new Map<
    'SIGTERM' | 'SIGINT',
    Array<() => void>
  >()

  on(signal: 'SIGTERM' | 'SIGINT', listener: () => void) {
    const listeners = this.listeners.get(signal) ?? []
    listeners.push(listener)
    this.listeners.set(signal, listeners)
  }

  removeListener(signal: 'SIGTERM' | 'SIGINT', listener: () => void) {
    this.listeners.set(
      signal,
      (this.listeners.get(signal) ?? []).filter(
        (registered) => registered !== listener
      )
    )
  }

  emitFirst(signal: 'SIGTERM' | 'SIGINT') {
    this.listeners.get(signal)?.[0]?.()
  }

  emitRemaining(signal: 'SIGTERM' | 'SIGINT') {
    for (const listener of this.listeners.get(signal)?.slice(1) ?? []) {
      listener()
    }
  }
}

async function waitFor(condition: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (condition()) return
    await new Promise<void>((resolve) => setImmediate(resolve))
  }

  assert.fail('condition did not become true')
}

async function requestStatus(port: number, path: string) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`)
  await response.arrayBuffer()
  return response.status
}

test('resolves distinct mode defaults and rejects invalid explicit values', () => {
  const general = resolveWorkerRuntimeConfig('general', {})
  const regular = resolveWorkerRuntimeConfig('regular-response', {})
  const assessment = resolveWorkerRuntimeConfig('assessment', {})

  assert.deepEqual(
    [general.name, general.slots, general.durableSlots, general.healthPort],
    ['hatchet-worker-general', 100, 1000, 8001]
  )
  assert.deepEqual(
    [regular.name, regular.slots, regular.durableSlots, regular.healthPort],
    ['hatchet-worker-response-processor', 100, 1000, 8002]
  )
  assert.deepEqual(
    [
      assessment.name,
      assessment.slots,
      assessment.durableSlots,
      assessment.healthPort,
    ],
    ['hatchet-worker-response-processor-assessment', 100, 1000, 8003]
  )

  assert.throws(
    () =>
      resolveWorkerRuntimeConfig('general', {
        HATCHET_WORKER_SLOTS: '0',
      }),
    /HATCHET_WORKER_SLOTS must be a positive integer/
  )
  assert.throws(
    () =>
      resolveWorkerRuntimeConfig('general', {
        HATCHET_WORKER_HEALTH_PORT: '65536',
      }),
    /HATCHET_WORKER_HEALTH_PORT must be between 1 and 65535/
  )
})

test('health endpoints distinguish liveness from intake readiness', async () => {
  const lifecycle = new WorkerLifecycle()
  const server = createWorkerHealthServer({
    lifecycle,
    host: '127.0.0.1',
    port: 0,
  })

  await server.start()
  const port = server.getPort()
  assert.ok(port)

  assert.equal(await requestStatus(port, '/healthz'), 200)
  assert.equal(await requestStatus(port, '/readyz'), 503)

  lifecycle.markReady()
  assert.equal(await requestStatus(port, '/healthz'), 200)
  assert.equal(await requestStatus(port, '/readyz'), 200)

  lifecycle.beginDraining()
  assert.equal(await requestStatus(port, '/healthz'), 200)
  assert.equal(await requestStatus(port, '/readyz'), 503)

  lifecycle.markFaulted()
  assert.equal(await requestStatus(port, '/healthz'), 503)
  assert.equal(await requestStatus(port, '/readyz'), 503)
  assert.equal(await requestStatus(port, '/unknown'), 404)

  await server.close()
})

test('runtime exposes startup failures and unexpected worker stops', async () => {
  const startupFailure = createHatchetWorkerRuntime({
    config: {
      mode: 'general',
      name: 'startup-failure-worker',
      slots: 1,
      durableSlots: 1,
      healthPort: 0,
      startupTimeoutMs: 1_000,
    },
    workflows: [] as HatchetWorkflows,
    workerFactory: async () => {
      throw new Error('registration failed')
    },
    signalSource: new FakeSignals(),
    healthHost: '127.0.0.1',
  })

  await assert.rejects(startupFailure.start(), /registration failed/)
  assert.equal(startupFailure.lifecycle.state, 'faulted')

  const unexpectedStop = createHatchetWorkerRuntime({
    config: {
      mode: 'general',
      name: 'unexpected-stop-worker',
      slots: 1,
      durableSlots: 1,
      healthPort: 0,
      startupTimeoutMs: 1_000,
    },
    workflows: [] as HatchetWorkflows,
    workerFactory: async () =>
      ({ start: async () => undefined }) as unknown as HatchetWorker,
    signalSource: new FakeSignals(),
    healthHost: '127.0.0.1',
  })

  await assert.rejects(
    unexpectedStop.start(),
    /Hatchet worker stopped before termination/
  )
  assert.equal(unexpectedStop.lifecycle.state, 'faulted')
})

test('runtime stops a worker that registers after startup times out', async () => {
  let resolveWorkerFactory!: (worker: HatchetWorker) => void
  let stopCount = 0
  const workerPromise = new Promise<HatchetWorker>((resolve) => {
    resolveWorkerFactory = resolve
  })
  const runtime = createHatchetWorkerRuntime({
    config: {
      mode: 'general',
      name: 'late-registration-worker',
      slots: 1,
      durableSlots: 1,
      healthPort: 0,
      startupTimeoutMs: 10,
    },
    workflows: [] as HatchetWorkflows,
    workerFactory: async () => workerPromise,
    signalSource: new FakeSignals(),
    healthHost: '127.0.0.1',
  })

  await assert.rejects(runtime.start(), /Hatchet worker startup exceeded 10ms/)
  assert.equal(runtime.lifecycle.state, 'faulted')

  resolveWorkerFactory({
    stop: async () => {
      stopCount += 1
      return []
    },
  } as unknown as HatchetWorker)
  await waitFor(() => stopCount === 1)
})

test('runtime preserves workflows and drops readiness before SDK intake stops', async () => {
  const signals = new FakeSignals()
  const lifecycleEvents: string[] = []
  let resolveWorkerStart!: () => void
  let accepting = true
  let capturedName = ''
  let capturedOptions: Parameters<HatchetWorkerFactory>[1] | undefined
  const workflow = {} as HatchetWorkflows[number]
  const workflows = [workflow] as HatchetWorkflows

  const workerFactory: HatchetWorkerFactory = async (name, options) => {
    capturedName = name
    capturedOptions = options
    signals.on('SIGTERM', () => {
      lifecycleEvents.push(
        `intake-allowed:${runtime.lifecycle.canAcceptIntake()}`
      )
      accepting = false
      lifecycleEvents.push('sdk-exit')
      resolveWorkerStart()
    })

    const worker = {
      start: async () => {
        lifecycleEvents.push('worker-start')
        await new Promise<void>((resolve) => {
          resolveWorkerStart = resolve
        })
      },
    } as unknown as HatchetWorker

    return worker
  }

  const runtime = createHatchetWorkerRuntime({
    config: {
      mode: 'general',
      name: 'test-worker',
      slots: 4,
      durableSlots: 4,
      healthPort: 0,
      startupTimeoutMs: 1_000,
    },
    workflows,
    workerFactory,
    signalSource: signals,
    healthHost: '127.0.0.1',
  })

  const runPromise = runtime.start()
  await waitFor(() => runtime.lifecycle.isReady)

  const port = runtime.healthServer.getPort()
  assert.ok(port)
  assert.equal(await requestStatus(port, '/readyz'), 200)

  signals.emitFirst('SIGTERM')
  assert.equal(runtime.lifecycle.state, 'draining')
  assert.equal(await requestStatus(port, '/readyz'), 503)
  signals.emitRemaining('SIGTERM')
  await runPromise

  assert.equal(accepting, false)
  assert.deepEqual(lifecycleEvents, [
    'worker-start',
    'intake-allowed:false',
    'sdk-exit',
  ])
  assert.equal(capturedName, 'test-worker')
  assert.equal(capturedOptions?.workflows, workflows)
  assert.equal(capturedOptions?.slots, 4)
  assert.equal(capturedOptions?.durableSlots, 4)
  assert.equal(runtime.lifecycle.state, 'stopped')
})
