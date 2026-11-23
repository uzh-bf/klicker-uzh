import { createLogger } from '@klicker-uzh/logging/node'

export function backendServiceName(assessmentMode: boolean) {
  return assessmentMode ? 'backend-assessment' : 'backend-graphql'
}

export const logger = createLogger({
  service: backendServiceName(process.env.ASSESSMENT_MODE === 'true'),
})
