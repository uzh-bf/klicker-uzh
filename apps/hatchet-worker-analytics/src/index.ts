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
  },
})
