import { handlers } from '@klicker-uzh/graphql'
import {
  bootstrapHatchetWorker,
  buildSelectWorkflows,
  createWorkerLogger,
  installWorkerCrashHandlers,
} from '@klicker-uzh/hatchet'

const WORKER_NAME = 'hatchet-worker-general'

const logger = createWorkerLogger(WORKER_NAME)
installWorkerCrashHandlers(logger)

await bootstrapHatchetWorker({
  workerName: process.env.HATCHET_WORKER_NAME ?? WORKER_NAME,
  logger,
  handlers,
  selectWorkflows: buildSelectWorkflows({
    logger,
  }),
})
