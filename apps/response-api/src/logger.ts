import { createLogger } from '@klicker-uzh/logging/node'

export function responseApiServiceName(assessmentMode: boolean) {
  return assessmentMode ? 'response-api-assessment' : 'response-api'
}

export const logger = createLogger({
  service: responseApiServiceName(process.env.ASSESSMENT_MODE === 'true'),
})
