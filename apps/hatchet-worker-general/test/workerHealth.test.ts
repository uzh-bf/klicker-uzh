import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { describe, it } from 'node:test'
import {
  createWorkerHealthController,
  markWorkerReadyAfterRegistration,
  startWorkerHealthServer,
  waitForWorkerRegistration,
} from '../src/workerHealth.js'

describe('worker health', () => {
  it('becomes ready only after startup and worker registration', () => {
    let now = 1_000
    const controller = createWorkerHealthController({ now: () => now })

    assert.deepEqual(controller.snapshot(), {
      startup: false,
      ready: false,
      live: true,
    })
    controller.markWorkerRegistered()
    assert.equal(controller.snapshot().ready, true)

    now += 5_000
    controller.heartbeat()
    assert.equal(controller.snapshot().live, true)
  })

  it('fails liveness permanently after a heartbeat gap', () => {
    let now = 0
    const controller = createWorkerHealthController({
      now: () => now,
      maxHeartbeatAgeMs: 30_000,
    })
    controller.markWorkerRegistered()

    now = 30_001
    controller.heartbeat()
    assert.deepEqual(controller.snapshot(), {
      startup: true,
      ready: false,
      live: false,
    })
  })

  it('becomes unready and schedules one bounded exit after control-plane loss', () => {
    const scheduled: Array<{ callback: () => void; delayMs: number }> = []
    const exits: number[] = []
    const controller = createWorkerHealthController({
      controlPlaneLossGraceMs: 12_000,
      scheduleExit: (callback, delayMs) => {
        scheduled.push({ callback, delayMs })
        return setTimeout(() => undefined, 60_000)
      },
      exit: (code) => exits.push(code),
    })
    controller.markWorkerRegistered()

    controller.markControlPlaneLost()
    controller.markControlPlaneLost()
    assert.equal(controller.snapshot().ready, false)
    assert.equal(scheduled.length, 1)
    assert.equal(scheduled[0]?.delayMs, 12_000)
    scheduled[0]?.callback()
    assert.deepEqual(exits, [1])
  })

  it('serves startup, readiness, and liveness without exposing other routes', async () => {
    const controller = createWorkerHealthController()
    const running = await startWorkerHealthServer({
      controller,
      port: 0,
      host: '127.0.0.1',
    })
    const address = running.server.address() as AddressInfo
    const url = (path: string) => `http://127.0.0.1:${address.port}${path}`

    try {
      assert.equal((await fetch(url('/startup'))).status, 503)
      controller.markWorkerRegistered()
      assert.equal((await fetch(url('/startup'))).status, 200)
      assert.equal((await fetch(url('/ready'))).status, 200)
      assert.equal((await fetch(url('/live'))).status, 200)
      assert.equal((await fetch(url('/unknown'))).status, 404)
    } finally {
      running.stopHeartbeat()
      await new Promise<void>((resolve, reject) =>
        running.server.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })

  it('waits for a registered worker and times out when registration never appears', async () => {
    const worker: { workerId?: string } = {}
    setTimeout(() => {
      worker.workerId = 'worker-1'
    }, 5)
    await waitForWorkerRegistration(worker, { timeoutMs: 100, pollMs: 1 })

    await assert.rejects(
      waitForWorkerRegistration({}, { timeoutMs: 5, pollMs: 1 }),
      /registration timed out/
    )
  })

  it('keeps startup incomplete until registration succeeds', async () => {
    const controller = createWorkerHealthController()
    let completeRegistration!: () => void
    const registration = new Promise<void>((resolve) => {
      completeRegistration = resolve
    })
    const workerRun = new Promise<void>(() => undefined)
    const readiness = markWorkerReadyAfterRegistration({
      controller,
      registration,
      workerRun,
    })

    assert.deepEqual(controller.snapshot(), {
      startup: false,
      ready: false,
      live: true,
    })
    completeRegistration()
    await readiness
    assert.deepEqual(controller.snapshot(), {
      startup: true,
      ready: true,
      live: true,
    })
  })

  it('does not complete startup when the worker stops before registration', async () => {
    const controller = createWorkerHealthController()
    await assert.rejects(
      markWorkerReadyAfterRegistration({
        controller,
        registration: new Promise<void>(() => undefined),
        workerRun: Promise.resolve(),
      }),
      /stopped before registration/
    )
    assert.equal(controller.snapshot().startup, false)
  })
})
