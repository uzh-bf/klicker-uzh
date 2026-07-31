import { handlers } from '@klicker-uzh/graphql'
import {
  bootstrapHatchetWorker,
  buildSelectWorkflows,
  createWorkerLogger,
  installWorkerCrashHandlers,
} from '@klicker-uzh/hatchet'

const WORKER_NAME = 'hatchet-worker-general'

// Workflows owned by dedicated worker apps that ship runtime environments this
// image doesn't have (e.g. Python + uv for the analytics pipeline). Keep them
// off the general worker's default pickup set so Hatchet never routes them here.
const EXCLUDED_WORKFLOWS = ['recomputeLearningAnalytics'] as const

const logger = createWorkerLogger(WORKER_NAME)
installWorkerCrashHandlers(logger)

await bootstrapHatchetWorker({
  workerName: process.env.HATCHET_WORKER_NAME ?? WORKER_NAME,
  logger,
  handlers,
  selectWorkflows: buildSelectWorkflows({
    logger,
    excludeKeys: EXCLUDED_WORKFLOWS,
  }),
})
