import { createServer, type Server } from 'node:http'

const DEFAULT_EVENT_LOOP_HEARTBEAT_MS = 5_000
const DEFAULT_MAX_EVENT_LOOP_HEARTBEAT_AGE_MS = 30_000
const DEFAULT_CONTROL_PLANE_LOSS_GRACE_MS = 30_000

type TimerHandle = ReturnType<typeof setTimeout>

export type WorkerHealthSnapshot = {
  startup: boolean
  ready: boolean
  live: boolean
}

export function createWorkerHealthController({
  now = Date.now,
  maxHeartbeatAgeMs = DEFAULT_MAX_EVENT_LOOP_HEARTBEAT_AGE_MS,
  controlPlaneLossGraceMs = DEFAULT_CONTROL_PLANE_LOSS_GRACE_MS,
  scheduleExit = (callback, delayMs) => setTimeout(callback, delayMs),
  exit = (code) => process.exit(code),
}: {
  now?: () => number
  maxHeartbeatAgeMs?: number
  controlPlaneLossGraceMs?: number
  scheduleExit?: (callback: () => void, delayMs: number) => TimerHandle
  exit?: (code: number) => never | void
} = {}) {
  let startup = false
  let ready = false
  let eventLoopStalled = false
  let lastHeartbeatAt = now()
  let controlPlaneExit: TimerHandle | undefined

  const snapshot = (): WorkerHealthSnapshot => {
    const live =
      !eventLoopStalled && now() - lastHeartbeatAt <= maxHeartbeatAgeMs
    return { startup, ready: startup && ready && live, live }
  }

  return {
    heartbeat() {
      const current = now()
      if (current - lastHeartbeatAt > maxHeartbeatAgeMs) {
        eventLoopStalled = true
      }
      lastHeartbeatAt = current
    },
    markWorkerRegistered() {
      startup = true
      ready = true
    },
    markControlPlaneLost() {
      ready = false
      if (controlPlaneExit) return
      controlPlaneExit = scheduleExit(() => exit(1), controlPlaneLossGraceMs)
      controlPlaneExit.unref?.()
    },
    snapshot,
  }
}

export type WorkerHealthController = ReturnType<
  typeof createWorkerHealthController
>

export async function startWorkerHealthServer({
  controller,
  port,
  host = '0.0.0.0',
}: {
  controller: WorkerHealthController
  port: number
  host?: string
}): Promise<{ server: Server; stopHeartbeat: () => void }> {
  const server = createServer((req, res) => {
    const health = controller.snapshot()
    const route = req.url?.split('?', 1)[0]
    const routeHealth =
      route === '/startup'
        ? health.startup
        : route === '/ready'
          ? health.ready
          : route === '/live'
            ? health.live
            : undefined

    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', 'application/json')
    if (typeof routeHealth === 'undefined') {
      res.statusCode = 404
      res.end('{"status":"not_found"}')
      return
    }

    res.statusCode = routeHealth ? 200 : 503
    res.end(JSON.stringify({ status: routeHealth ? 'ok' : 'unavailable' }))
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.removeListener('error', reject)
      resolve()
    })
  })

  const interval = setInterval(
    () => controller.heartbeat(),
    DEFAULT_EVENT_LOOP_HEARTBEAT_MS
  )
  interval.unref?.()

  return {
    server,
    stopHeartbeat: () => clearInterval(interval),
  }
}

export async function waitForWorkerRegistration(
  worker: { workerId?: string },
  {
    timeoutMs = 30_000,
    pollMs = 50,
  }: { timeoutMs?: number; pollMs?: number } = {}
) {
  const deadline = Date.now() + timeoutMs
  while (!worker.workerId) {
    if (Date.now() >= deadline) {
      throw new Error('Hatchet worker registration timed out.')
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
}

export async function markWorkerReadyAfterRegistration({
  controller,
  registration,
  workerRun,
}: {
  controller: WorkerHealthController
  registration: Promise<void>
  workerRun: Promise<unknown>
}) {
  await Promise.race([
    registration,
    workerRun.then(() => {
      throw new Error('Hatchet worker stopped before registration completed.')
    }),
  ])
  controller.markWorkerRegistered()
}
