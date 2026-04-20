import type { HatchetHandlers } from '@klicker-uzh/types'
import { spawn } from 'child_process'

// Analytics pipeline scripts — runtime-invocable Python modules under
// apps/analytics. Kept as a named const so the Hatchet workflow references
// them by symbol rather than string interpolation (per §3.6, no user-supplied
// script names ever reach spawn()).
export const ANALYTICS_SCRIPTS = {
  s0_participant: 'src.scripts.0_initial_participant_analytics',
  s1_aggregated: 'src.scripts.1_initial_aggregated_analytics',
  s2_course_heatmap: 'src.scripts.2_initial_aggregated_course_analytics',
  s3_instance_activity: 'src.scripts.3_initial_instance_activity_performance',
  s4_participant_perf: 'src.scripts.4_initial_participant_performance',
  s5_participant_course: 'src.scripts.5_initial_participant_course_analytics',
  s6_activity_progress: 'src.scripts.6_initial_activity_progress',
  s7_participant_activity: 'src.scripts.7_participant_activity_performance',
  s8_chat: 'src.scripts.8_initial_chat_analytics',
  s9_chatbot: 'src.scripts.9_initial_aggregated_chatbot_analytics',
  s10_clustering: 'src.scripts.10_chat_topic_clustering',
  s11_chat_quiz: 'src.scripts.11_chat_quiz_correlation',
  s13_platform: 'src.scripts.13_platform_semester_analytics',
  s14_live_quiz: 'src.scripts.14_live_quiz_assessment_analytics',
  s99_validity: 'src.scripts.99_mark_analytics_valid',
} as const

export type AnalyticsScriptKey = keyof typeof ANALYTICS_SCRIPTS

// Per-script timeout — scripts 8/9 loop over every day since 2022 in full mode,
// so 1h is the correct ceiling. The Hatchet workflow tightens this per task for
// the lighter scripts; this const is the Node-side fallback.
const DEFAULT_SCRIPT_TIMEOUT_MS = 60 * 60 * 1000

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
            `${logPrefix} timed out after ${DEFAULT_SCRIPT_TIMEOUT_MS}ms`
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
export const handleRunAnalyticsScript: HatchetHandlers['handleRunAnalyticsScript'] =
  async (input, _globalCtx, executionCtx) => {
    // Deploy-time config — fail loud if unset so we never silently run against
    // the wrong cwd in a new env.
    const cwd = process.env.ANALYTICS_CWD
    if (!cwd) {
      await executionCtx.logger.error(
        `[${input.scriptModule}] ANALYTICS_CWD not set — expected path to apps/analytics. Aborting.`
      )
      return false
    }
    const runnerCmd = process.env.ANALYTICS_RUNNER_CMD ?? 'uv'
    const runnerArgs = (process.env.ANALYTICS_RUNNER_ARGS ?? 'run python')
      .split(' ')
      .filter(Boolean)

    const mode = resolveMode(input)
    const courseIds = collectCourseIds(input)

    if (mode === 'finalize' && courseIds.length === 0) {
      await executionCtx.logger.error(
        `[${input.scriptModule}] mode=finalize requires courseIds / courseId; aborting.`
      )
      return false
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
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await executionCtx.logger.error(
        `${logPrefix} FAILED (mode=${mode}): ${msg}`
      )
      return false
    }
  }
