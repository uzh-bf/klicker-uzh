import type { HatchetHandlers } from '@klicker-uzh/types'
import { spawn } from 'child_process'

// Allow-list of analytics pipeline scripts to run, in dependency order.
// Kept as a typed const so the handler never invokes an arbitrary module — no
// shell interpolation, no user-supplied script names (per §3.6).
const ANALYTICS_SCRIPTS = [
  'src.scripts.0_initial_participant_analytics',
  'src.scripts.1_initial_aggregated_analytics',
  'src.scripts.2_initial_aggregated_course_analytics',
  'src.scripts.3_initial_instance_activity_performance',
  'src.scripts.4_initial_participant_performance',
  'src.scripts.5_initial_participant_course_analytics',
  'src.scripts.6_initial_activity_progress',
  'src.scripts.7_participant_activity_performance',
  'src.scripts.8_initial_chat_analytics',
  'src.scripts.9_initial_aggregated_chatbot_analytics',
  'src.scripts.13_platform_semester_analytics',
  'src.scripts.14_live_quiz_assessment_analytics',
  'src.scripts.10_chat_topic_clustering',
  'src.scripts.11_chat_quiz_correlation',
  'src.scripts.99_mark_analytics_valid',
] as const

const DEFAULT_SCRIPT_TIMEOUT_MS = 60 * 60 * 1000 // 1h per script — scripts 8/9 loop over every day since 2022

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
  input: Parameters<HatchetHandlers['handleRecomputeLearningAnalytics']>[0]
): ResolvedMode {
  if (input.mode) return input.mode
  // Scanner emits `courseId` without `mode` — promote it to finalize.
  if (input.courseId) return 'finalize'
  return 'incremental'
}

function collectCourseIds(
  input: Parameters<HatchetHandlers['handleRecomputeLearningAnalytics']>[0]
): string[] {
  return [input.courseId, ...(input.courseIds ?? [])].filter(
    (id): id is string => Boolean(id)
  )
}

export const handleRecomputeLearningAnalytics: HatchetHandlers['handleRecomputeLearningAnalytics'] =
  async (input, _globalCtx, executionCtx) => {
    // Deploy-time config — fail loud if unset so we never silently run against
    // the wrong cwd in a new env.
    const cwd = process.env.ANALYTICS_CWD
    if (!cwd) {
      await executionCtx.logger.error(
        '[recomputeLearningAnalytics] ANALYTICS_CWD not set — expected path to apps/analytics. Aborting.'
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
        '[recomputeLearningAnalytics] mode=finalize requires courseIds / courseId; aborting.'
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

    await executionCtx.logger.info(
      `[recomputeLearningAnalytics] mode=${mode} courseIds=${courseIds.length} windowSince=${windowSince ?? '-'} cwd=${cwd} runner=${[runnerCmd, ...runnerArgs].join(' ')}`
    )

    const overallStart = Date.now()
    for (const scriptModule of ANALYTICS_SCRIPTS) {
      const logPrefix = `[recomputeLearningAnalytics][${scriptModule}]`
      try {
        await runScript(
          scriptModule,
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
          `[recomputeLearningAnalytics] FAILED at ${scriptModule} (mode=${mode}): ${msg}`
        )
        return false
      }
    }

    const elapsedSec = Math.round((Date.now() - overallStart) / 1000)
    await executionCtx.logger.info(
      `[recomputeLearningAnalytics] pipeline OK in ${elapsedSec}s (mode=${mode})`
    )
    return true
  }
