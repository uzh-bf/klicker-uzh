import { createLogger } from '@klicker-uzh/logging/node'

export const logger = createLogger({
  service: process.env.HATCHET_WORKER_NAME ?? 'hatchet-worker-general',
})

export default logger
