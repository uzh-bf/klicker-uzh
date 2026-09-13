export const RESPONSE_PROCESSOR_READY_FILE =
  '/tmp/klicker-response-processor-ready'

type HatchetWorkerRuntime = {
  action_registry: Record<string, unknown>
  workerId: string | undefined
}

type HatchetWorkerRegistrationState = {
  nonDurable: HatchetWorkerRuntime
  durable?: HatchetWorkerRuntime
}

function activeWorkerRuntimes(worker: HatchetWorkerRegistrationState) {
  return [worker.nonDurable, worker.durable].filter(
    (runtime): runtime is HatchetWorkerRuntime =>
      runtime !== undefined && Object.keys(runtime.action_registry).length > 0
  )
}

export function isHatchetWorkerRegistered(
  worker: HatchetWorkerRegistrationState
) {
  const runtimes = activeWorkerRuntimes(worker)

  return (
    runtimes.length > 0 &&
    runtimes.every((runtime) => runtime.workerId !== undefined)
  )
}

function delay(milliseconds: number) {
  return new Promise<'waiting'>((resolve) => {
    setTimeout(() => resolve('waiting'), milliseconds)
  })
}

export async function waitForHatchetWorkerRegistration(
  worker: HatchetWorkerRegistrationState,
  workerStart: Promise<unknown>,
  pollIntervalMs = 100
) {
  const workerStopped = workerStart.then(
    () => 'stopped' as const,
    (error: unknown) => Promise.reject(error)
  )

  while (!isHatchetWorkerRegistered(worker)) {
    const outcome = await Promise.race([workerStopped, delay(pollIntervalMs)])

    if (outcome === 'stopped') {
      throw new Error('Hatchet worker stopped before registering')
    }
  }
}
