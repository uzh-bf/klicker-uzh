import { createServer, type Server } from 'node:http'
import type { HatchetClient } from '@hatchet-dev/typescript-sdk'

export type WorkerMode = 'general' | 'regular-response' | 'assessment'

export type WorkerLifecycleState =
  | 'starting'
  | 'ready'
  | 'draining'
  | 'faulted'
  | 'stopped'

const workerDefaults: Record<
  WorkerMode,
  Pick<WorkerRuntimeConfig, 'name' | 'slots' | 'durableSlots' | 'healthPort'>
> = {
  general: {
    name: 'hatchet-worker-general',
    slots: 100,
    durableSlots: 1000,
    healthPort: 8001,
  },
  'regular-response': {
    name: 'hatchet-worker-response-processor',
    slots: 100,
    durableSlots: 1000,
    healthPort: 8002,
  },
  assessment: {
    name: 'hatchet-worker-response-processor-assessment',
    slots: 100,
    durableSlots: 1000,
    healthPort: 8003,
  },
}

const defaultStartupTimeoutMs = 30_000

export interface WorkerRuntimeConfig {
  mode: WorkerMode
  name: string
  slots: number
  durableSlots: number
  healthPort: number
  startupTimeoutMs: number
}

function parsePositiveInteger(
  name: string,
  value: string | undefined,
  fallback: number
) {
  if (value === undefined) return fallback

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }

  return parsed
}

function parsePort(name: string, value: string | undefined, fallback: number) {
  const port = parsePositiveInteger(name, value, fallback)
  if (port > 65_535) {
    throw new Error(`${name} must be between 1 and 65535`)
  }

  return port
}

function parseWorkerName(value: string | undefined, fallback: string) {
  if (value === undefined) return fallback

  const name = value.trim()
  if (!name) throw new Error('HATCHET_WORKER_NAME must not be empty')

  return name
}

export function resolveWorkerRuntimeConfig(
  mode: WorkerMode,
  env: NodeJS.ProcessEnv = process.env
): WorkerRuntimeConfig {
  const defaults = workerDefaults[mode]

  return {
    mode,
    name: parseWorkerName(env.HATCHET_WORKER_NAME, defaults.name),
    slots: parsePositiveInteger(
      'HATCHET_WORKER_SLOTS',
      env.HATCHET_WORKER_SLOTS,
      defaults.slots
    ),
    durableSlots: parsePositiveInteger(
      'HATCHET_WORKER_DURABLE_SLOTS',
      env.HATCHET_WORKER_DURABLE_SLOTS,
      defaults.durableSlots
    ),
    healthPort: parsePort(
      'HATCHET_WORKER_HEALTH_PORT',
      env.HATCHET_WORKER_HEALTH_PORT,
      defaults.healthPort
    ),
    startupTimeoutMs: parsePositiveInteger(
      'HATCHET_WORKER_STARTUP_TIMEOUT_MS',
      env.HATCHET_WORKER_STARTUP_TIMEOUT_MS,
      defaultStartupTimeoutMs
    ),
  }
}

export class WorkerLifecycle {
  private currentState: WorkerLifecycleState = 'starting'

  get state() {
    return this.currentState
  }

  get isLive() {
    return ['starting', 'ready', 'draining'].includes(this.currentState)
  }

  get isReady() {
    return this.currentState === 'ready'
  }

  beginDraining() {
    if (this.currentState === 'starting' || this.currentState === 'ready') {
      this.currentState = 'draining'
    }
  }

  markReady() {
    if (this.currentState === 'starting') this.currentState = 'ready'
  }

  markFaulted() {
    if (this.currentState !== 'stopped') this.currentState = 'faulted'
  }

  markStopped() {
    this.currentState = 'stopped'
  }

  canAcceptIntake() {
    return this.isReady
  }
}

export interface WorkerHealthServer {
  start(): Promise<void>
  close(): Promise<void>
  getPort(): number | undefined
}

export function createWorkerHealthServer({
  lifecycle,
  host = '0.0.0.0',
  port,
}: {
  lifecycle: WorkerLifecycle
  host?: string
  port: number
}): WorkerHealthServer {
  let boundPort: number | undefined
  let started = false

  const server: Server = createServer((request, response) => {
    if (request.method !== 'GET') {
      response.statusCode = 404
      response.end()
      return
    }

    if (request.url === '/healthz') {
      response.statusCode = lifecycle.isLive ? 200 : 503
      response.end()
      return
    }

    if (request.url === '/readyz') {
      response.statusCode = lifecycle.isReady ? 200 : 503
      response.end()
      return
    }

    response.statusCode = 404
    response.end()
  })

  return {
    async start() {
      if (started) return

      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          server.removeListener('listening', onListening)
          reject(error)
        }
        const onListening = () => {
          server.removeListener('error', onError)
          const address = server.address()
          boundPort =
            typeof address === 'object' && address ? address.port : undefined
          started = true
          resolve()
        }

        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(port, host)
      })
    },

    async close() {
      if (!started) return

      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
      started = false
      boundPort = undefined
    },

    getPort() {
      return boundPort
    },
  }
}

export type HatchetWorkerOptions = Exclude<
  Parameters<HatchetClient['worker']>[1],
  undefined | number
>
export type HatchetWorker = Awaited<ReturnType<HatchetClient['worker']>>
export type HatchetWorkflows = NonNullable<HatchetWorkerOptions['workflows']>

export type HatchetWorkerFactory = (
  name: string,
  options: Pick<HatchetWorkerOptions, 'workflows' | 'slots' | 'durableSlots'>
) => Promise<HatchetWorker>

export interface TerminationSignalSource {
  on(signal: 'SIGTERM' | 'SIGINT', listener: () => void): unknown
  removeListener(signal: 'SIGTERM' | 'SIGINT', listener: () => void): unknown
}

function installTerminationGate(
  lifecycle: WorkerLifecycle,
  signalSource: TerminationSignalSource
) {
  const handleSignal = () => lifecycle.beginDraining()
  signalSource.on('SIGTERM', handleSignal)
  signalSource.on('SIGINT', handleSignal)

  return () => {
    signalSource.removeListener('SIGTERM', handleSignal)
    signalSource.removeListener('SIGINT', handleSignal)
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onLateResolution?: (value: T) => Promise<unknown> | void
) {
  return new Promise<T>((resolve, reject) => {
    let completed = false
    const timer = setTimeout(() => {
      completed = true
      reject(new Error(`Hatchet worker startup exceeded ${timeoutMs}ms`))
    }, timeoutMs)

    promise.then(
      (value) => {
        if (completed) {
          if (onLateResolution) {
            void Promise.resolve()
              .then(() => onLateResolution(value))
              .catch(() => undefined)
          }
          return
        }

        completed = true
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        if (completed) return

        completed = true
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

export interface HatchetWorkerRuntime {
  lifecycle: WorkerLifecycle
  healthServer: WorkerHealthServer
  start(): Promise<void>
}

export function createHatchetWorkerRuntime({
  config,
  workflows,
  workerFactory,
  signalSource = process as unknown as TerminationSignalSource,
  healthHost,
}: {
  config: WorkerRuntimeConfig
  workflows: HatchetWorkflows
  workerFactory: HatchetWorkerFactory
  signalSource?: TerminationSignalSource
  healthHost?: string
}): HatchetWorkerRuntime {
  const lifecycle = new WorkerLifecycle()
  const healthServer = createWorkerHealthServer({
    lifecycle,
    host: healthHost,
    port: config.healthPort,
  })
  let startPromise: Promise<void> | undefined

  return {
    lifecycle,
    healthServer,

    start() {
      if (startPromise) return startPromise

      startPromise = (async () => {
        await healthServer.start()
        const removeTerminationGate = installTerminationGate(
          lifecycle,
          signalSource
        )

        try {
          const workerPromise = workerFactory(config.name, {
            workflows,
            slots: config.slots,
            durableSlots: config.durableSlots,
          })
          const worker = await withTimeout(
            workerPromise,
            config.startupTimeoutMs,
            (lateWorker) => lateWorker.stop()
          )

          const workerStart = worker.start()
          lifecycle.markReady()
          await workerStart

          if (lifecycle.state !== 'draining') {
            lifecycle.markFaulted()
            throw new Error('Hatchet worker stopped before termination')
          }

          lifecycle.markStopped()
        } catch (error) {
          if (lifecycle.state !== 'draining') lifecycle.markFaulted()
          throw error
        } finally {
          removeTerminationGate()
          await healthServer.close()
        }
      })()

      return startPromise
    },
  }
}
