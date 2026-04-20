import { handlers } from '@klicker-uzh/graphql'
import {
  bootstrapHatchetWorker,
  buildSelectWorkflows,
  createWorkerLogger,
  installWorkerCrashHandlers,
} from '@klicker-uzh/hatchet'

const WORKER_NAME = 'hatchet-worker-analytics'

const ANALYTICS_WORKFLOWS = ['recomputeLearningAnalytics'] as const

const logger = createWorkerLogger(WORKER_NAME)
installWorkerCrashHandlers(logger)

await bootstrapHatchetWorker({
  workerName: process.env.HATCHET_WORKER_NAME ?? WORKER_NAME,
  logger,
  handlers,
  selectWorkflows: buildSelectWorkflows({
    logger,
    defaultKeys: ANALYTICS_WORKFLOWS,
  }),
  onReady: (l) => {
    if (!process.env.ANALYTICS_CWD) {
      l.warn(
        'ANALYTICS_CWD is not set — the recompute handler will refuse to run. ' +
          'Point it at the apps/analytics directory inside this container.'
      )
    }
    // Soft warning only — the handler is the enforcement point. This line is
    // for an operator reading worker boot logs to notice that a mode=full
    // dispatch will be refused until they intentionally opt in.
    if (process.env.ANALYTICS_ALLOW_FULL !== '1') {
      l.warn(
        'ANALYTICS_ALLOW_FULL is not set — mode=full analytics runs will be ' +
          'refused by the handler. Set ANALYTICS_ALLOW_FULL=1 only on a ' +
          'worker intended to serve full-history recomputes.'
      )
    }
  },
})
