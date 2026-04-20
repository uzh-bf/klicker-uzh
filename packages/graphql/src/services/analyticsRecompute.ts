import type { HatchetHandlers } from '@klicker-uzh/types'
import { spawn } from 'child_process'

// Re-export ANALYTICS_SCRIPTS / AnalyticsScriptKey for historical consumers of
// this module. The single source of truth now lives in `@klicker-uzh/types`
// so the Hatchet workflow (packages/hatchet/src/tasks.ts) and this handler
// stay in sync without parallel declarations.
export { ANALYTICS_SCRIPTS } from '@klicker-uzh/types'
export type { AnalyticsScriptKey } from '@klicker-uzh/types'

// Watchdog only — Hatchet's per-task `executionTimeout` is the real fence. We
// set this strictly greater than the maximum Hatchet timeout (60m) + a grace
// window so the Node-side SIGTERM only fires if Hatchet itself has gone silent
// (e.g. lost worker heartbeat), not on a normal-but-slow run.
const DEFAULT_SCRIPT_TIMEOUT_MS = 65 * 60 * 1000

// Incremental runs cover the last 14 days: one full WEEKLY window plus slack for
// late data and a tolerated missed cron. Overridable via `windowSince` on the input.
const INCREMENTAL_LOOKBACK_DAYS = 14

type LogFn = (msg: string) => unknown | Promise<unknown>

function runScript(
  scriptModule: string,
  cwd: string,
  runnerCmd: string,
  runnerArgs: string[],
  scriptEnv: NodeJS.ProcessEnv,
  logPrefix: string,
  logger: { info: LogFn; error: LogFn }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [...runnerArgs, '-m', scriptModule]
    const started = Date.now()
    const child = spawn(runnerCmd, args, { cwd, env: scriptEnv })

    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, DEFAULT_SCRIPT_TIMEOUT_MS)

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString().trimEnd()
      if (text.length > 0) void logger.info(`${logPrefix} [stdout] ${text}`)
    })
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString().trimEnd()
      if (text.length > 0) void logger.info(`${logPrefix} [stderr] ${text}`)
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      void logger.error(`${logPrefix} spawn error: ${err.message}`)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      const elapsed = Math.round((Date.now() - started) / 1000)
      if (timedOut) {
        reject(
          new Error(
            `${logPrefix} timed out after ${DEFAULT_SCRIPT_TIMEOUT_MS}ms (watchdog; Hatchet executionTimeout should fire first)`
          )
        )
      } else if (code === 0) {
        void Promise.resolve(
          logger.info(`${logPrefix} OK in ${elapsed}s`)
        ).finally(() => resolve())
      } else {
        reject(
          new Error(`${logPrefix} exited with code ${code} after ${elapsed}s`)
        )
      }
    })
  })
}

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

type ResolvedMode = 'incremental' | 'finalize' | 'full'

function resolveMode(
  input: Parameters<HatchetHandlers['handleRunAnalyticsScript']>[0]
): ResolvedMode {
  if (input.mode) return input.mode
  // Scanner emits `courseId` without `mode` — promote it to finalize.
  if (input.courseId) return 'finalize'
  return 'incremental'
}

function collectCourseIds(
  input: Parameters<HatchetHandlers['handleRunAnalyticsScript']>[0]
): string[] {
  return [input.courseId, ...(input.courseIds ?? [])].filter(
    (id): id is string => Boolean(id)
  )
}

// Invoke a single analytics Python script as a subprocess. One call = one task
// in the Hatchet DAG. Orchestration (order, fan-out, retries) lives in the
// workflow definition in packages/hatchet/src/tasks.ts.
//
// Error contract: throw on any failure so Hatchet's `taskDefaults.retries`
// triggers and downstream tasks with this node as a parent don't run. Never
// swallow a failure by returning void from a caught error path — the DAG
// treats "resolved promise" as success regardless of the return value.
export const handleRunAnalyticsScript: HatchetHandlers['handleRunAnalyticsScript'] =
  async (input, _globalCtx, executionCtx) => {
    // Deploy-time config — fail loud if unset so we never silently run against
    // the wrong cwd in a new env.
    const cwd = process.env.ANALYTICS_CWD
    if (!cwd) {
      const msg = `[${input.scriptModule}] ANALYTICS_CWD not set — expected path to apps/analytics. Aborting.`
      await executionCtx.logger.error(msg)
      throw new Error(msg)
    }
    const runnerCmd = process.env.ANALYTICS_RUNNER_CMD ?? 'uv'
    const runnerArgs = (process.env.ANALYTICS_RUNNER_ARGS ?? 'run python')
      .split(' ')
      .filter(Boolean)

    const mode = resolveMode(input)
    const courseIds = collectCourseIds(input)

    // Full mode walks every course on the platform — refuse unless the worker
    // has been deliberately opted in. Keeps a stray manual dispatch from
    // kicking off an unbounded run.
    if (mode === 'full' && process.env.ANALYTICS_ALLOW_FULL !== '1') {
      const msg = `[${input.scriptModule}] mode=full refused — set ANALYTICS_ALLOW_FULL=1 on the worker to allow unbounded runs.`
      await executionCtx.logger.error(msg)
      throw new Error(msg)
    }

    if (mode === 'finalize' && courseIds.length === 0) {
      const msg = `[${input.scriptModule}] mode=finalize requires courseIds / courseId; aborting.`
      await executionCtx.logger.error(msg)
      throw new Error(msg)
    }

    const windowSince =
      mode === 'incremental'
        ? (input.windowSince ?? isoDaysAgo(INCREMENTAL_LOOKBACK_DAYS))
        : undefined

    // Start from a clean slate for the analytics-specific vars so stale values
    // on the worker process can't leak into the subprocess.
    const scriptEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ANALYTICS_MODE: mode,
    }
    delete scriptEnv.ANALYTICS_COURSE_IDS
    delete scriptEnv.ANALYTICS_WINDOW_SINCE
    if (courseIds.length > 0)
      scriptEnv.ANALYTICS_COURSE_IDS = courseIds.join(',')
    if (windowSince) scriptEnv.ANALYTICS_WINDOW_SINCE = windowSince

    const logPrefix = `[${input.scriptModule}]`
    await executionCtx.logger.info(
      `${logPrefix} mode=${mode} courseIds=${courseIds.length} windowSince=${windowSince ?? '-'} cwd=${cwd} runner=${[runnerCmd, ...runnerArgs].join(' ')}`
    )

    try {
      await runScript(
        input.scriptModule,
        cwd,
        runnerCmd,
        runnerArgs,
        scriptEnv,
        logPrefix,
        {
          info: (msg: string) => executionCtx.logger.info(msg),
          error: (msg: string) => executionCtx.logger.error(msg),
        }
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await executionCtx.logger.error(
        `${logPrefix} FAILED (mode=${mode}): ${msg}`
      )
      throw err instanceof Error ? err : new Error(msg)
    }
  }
