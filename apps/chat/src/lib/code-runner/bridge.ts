import {
  CODE_RUNTIME_BASE_PATH,
  CODE_RUNTIME_MANIFEST,
  RUNNER_DOCUMENTS,
} from './manifest'
import type { CodeProfile } from './profiles'
import {
  type CodeRunResult,
  hostResult,
  MAX_RUNNER_MESSAGES_PER_RUN,
  parseRunnerMessage,
  RUNNER_OUTPUT_CAP,
} from './protocol'

export type CodeRunPhase = 'loading' | 'running'

export interface CodeRunOptions {
  onPhase?: (phase: CodeRunPhase) => void
  /** Wall time for the program itself, after the runtime has started. */
  timeoutMs?: number
  /** Wall time for verifying files and starting the runtime. */
  startTimeoutMs?: number
}

export interface CodeRunHandle {
  result: Promise<CodeRunResult>
  stop: () => void
}

type VerifiedAssets = Record<string, { bytes: ArrayBuffer; type: string }>

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_START_TIMEOUT_MS = 120_000

// One verified copy of each profile's files per page. Every runner receives
// its own structured-clone copy, because an opaque runner cannot read blob
// URLs created by the Chat origin.
const verifiedAssets = new Map<CodeProfile, Promise<VerifiedAssets>>()

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

function loadVerifiedAssets(profile: CodeProfile): Promise<VerifiedAssets> {
  const cached = verifiedAssets.get(profile)
  if (cached) return cached
  const loading = (async () => {
    const entries = await Promise.all(
      CODE_RUNTIME_MANIFEST.profiles[profile].map(async (id) => {
        const file = CODE_RUNTIME_MANIFEST.files[id]
        const response = await fetch(`${CODE_RUNTIME_BASE_PATH}${id}`)
        if (!response.ok || !file) throw new Error(`missing ${id}`)
        const bytes = await response.arrayBuffer()
        if ((await sha256Hex(bytes)) !== file.sha256) {
          throw new Error(`hash mismatch ${id}`)
        }
        return [id, { bytes, type: file.type }] as const
      })
    )
    return Object.fromEntries(entries)
  })()
  verifiedAssets.set(profile, loading)
  loading.catch(() => verifiedAssets.delete(profile))
  return loading
}

let generation = 0
// At most one runner exists per page; starting a run stops the previous one.
let activeStop: (() => void) | null = null

/**
 * Runs learner code once in a fresh sandboxed runner and removes the runner
 * afterwards, so no interpreter state survives between runs.
 */
export function runCode(
  profile: CodeProfile,
  code: string,
  options: CodeRunOptions = {}
): CodeRunHandle {
  activeStop?.()
  const attemptId = crypto.randomUUID()
  const myGeneration = ++generation
  let frame: HTMLIFrameElement | null = null
  let port: MessagePort | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let settled = false
  let blockedAccess = false
  let programRunning = false
  let resolveResult: (result: CodeRunResult) => void = () => {}
  const result = new Promise<CodeRunResult>((resolve) => {
    resolveResult = resolve
  })

  function settle(
    status: CodeRunResult['status'],
    fields: Parameters<typeof hostResult>[2] = {}
  ) {
    if (settled) return
    settled = true
    clearTimeout(timer)
    port?.close()
    frame?.remove()
    if (activeStop === stop) activeStop = null
    resolveResult(hostResult(attemptId, status, { blockedAccess, ...fields }))
  }

  function stop() {
    settle('stopped')
  }
  activeStop = stop

  function startDeadline(
    ms: number,
    status: 'timeout' | 'error',
    error?: string
  ) {
    clearTimeout(timer)
    timer = setTimeout(() => settle(status, error ? { error } : {}), ms)
  }

  void (async () => {
    options.onPhase?.('loading')
    startDeadline(
      options.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS,
      'error',
      'The runtime did not start in time.'
    )
    let assets: VerifiedAssets
    try {
      assets = await loadVerifiedAssets(profile)
    } catch {
      settle('unavailable', {
        error: 'The runtime files could not be verified.',
      })
      return
    }
    if (settled) return

    const runner = document.createElement('iframe')
    frame = runner
    runner.setAttribute('sandbox', 'allow-scripts')
    runner.setAttribute('aria-hidden', 'true')
    runner.tabIndex = -1
    runner.title = 'Code runner'
    runner.style.cssText =
      'position:fixed;width:1px;height:1px;border:0;opacity:0;pointer-events:none;left:-10px;top:-10px'
    let loads = 0
    const loaded = new Promise<void>((resolve) => {
      runner.addEventListener('load', () => {
        loads += 1
        if (loads === 1) resolve()
        // A second load means the runner navigated itself: discard it.
        else settle('error', { error: 'The runner was discarded.' })
      })
    })
    runner.src = `${CODE_RUNTIME_BASE_PATH}${RUNNER_DOCUMENTS[profile]}`
    document.body.appendChild(runner)
    await loaded
    if (settled || !runner.contentWindow) return

    const channel = new MessageChannel()
    port = channel.port1
    let messages = 0
    port.onmessage = (event) => {
      if (settled) return
      messages += 1
      if (messages > MAX_RUNNER_MESSAGES_PER_RUN) {
        settle('error', { error: 'The runner sent too many messages.' })
        return
      }
      const parsed = parseRunnerMessage(event.data, {
        generation: myGeneration,
        attemptId,
      })
      if ('rejected' in parsed) return
      const runnerEvent = parsed.event
      if (runnerEvent.kind === 'diagnostic') {
        // Runtime start-up probes features the policy blocks (Pyodide tries a
        // data: script), so only report blocks while the program runs.
        if (programRunning) blockedAccess = true
      } else if (runnerEvent.kind === 'init-error') {
        settle('error', { error: runnerEvent.error })
      } else if (runnerEvent.kind === 'ready') {
        // Program code can post messages too; only the first ready starts it.
        if (programRunning) return
        programRunning = true
        options.onPhase?.('running')
        startDeadline(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 'timeout')
        port?.postMessage({
          type: 'run',
          attemptId,
          generation: myGeneration,
          code,
        })
      } else if (runnerEvent.kind === 'result') {
        settle(runnerEvent.status, {
          stdout: runnerEvent.stdout,
          stderr: runnerEvent.stderr,
          truncated: runnerEvent.truncated,
          error: runnerEvent.error,
        })
      }
    }
    // The runner is opaque, so its origin cannot be named as the target.
    runner.contentWindow.postMessage({ type: 'hello', v: 1 }, '*', [
      channel.port2,
    ])
    port.postMessage({
      type: 'init',
      profile,
      outputCap: RUNNER_OUTPUT_CAP,
      assets,
    })
  })().catch(() => settle('error', { error: 'The runner could not start.' }))

  return { result, stop }
}
