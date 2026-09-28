import { createLogger } from '@klicker-uzh/logging/node'

export const logger = createLogger({
  service:
    process.env.ASSESSMENT_MODE === 'true'
      ? 'hatchet-worker-response-processor-assessment'
      : 'hatchet-worker-response-processor',
})
